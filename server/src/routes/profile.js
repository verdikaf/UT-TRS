import { Router } from "express";
import bcrypt from "bcryptjs";
import { auth, signToken } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { Session } from "../models/Session.js";
import { isValidPhone, isStrongPassword } from "../utils/validators.js";
import { decryptPasswordBase64 } from "../config/crypto.js";
import { makePhoneVariants } from "../utils/phone.js";

const router = Router();

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id name phone");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user._id, name: user.name, phone: user.phone });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update profile info (name and/or phone). Phone change returns fresh token.
router.put("/info", auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name && !phone)
      return res.status(400).json({ error: "No data to update" });

    const update = {};
    let phoneChanged = false;
    if (name) update.name = String(name).trim();
    if (phone) {
      const phoneTrim = String(phone).trim();
      if (!isValidPhone(phoneTrim))
        return res.status(400).json({ error: "Invalid phone number format" });
      // Check variants to prevent + / no + duplication
      const variants = makePhoneVariants(phoneTrim);
      const exists = await User.findOne({
        phone: { $in: variants },
        _id: { $ne: req.user.id },
      });
      if (exists)
        return res.status(409).json({ error: "Phone number already in use" });
      update.phone = phoneTrim;
      phoneChanged = true;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    let token;
    if (phoneChanged && req.sessionJti) {
      await Session.updateOne(
        { jti: req.sessionJti, user: req.user.id },
        { $set: { revoked: true } }
      );
      token = signToken(user);
    }
    return res.json({
      token,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// decryptPasswordBase64 already imported above
router.put("/password", auth, async (req, res) => {
  try {
    const { currentPasswordEncrypted, newPasswordEncrypted } = req.body;
    if (!currentPasswordEncrypted || !newPasswordEncrypted) {
      return res.status(400).json({ error: "Required fields are missing" });
    }
    const currentPlain = decryptPasswordBase64(currentPasswordEncrypted);
    const newPlain = decryptPasswordBase64(newPasswordEncrypted);
    if (!currentPlain || !newPlain) {
      return res.status(400).json({ error: "Invalid encrypted password" });
    }
    if (!isStrongPassword(newPlain)) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const ok = await bcrypt.compare(currentPlain, user.passwordHash);
    if (!ok) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    user.passwordHash = await bcrypt.hash(newPlain, 10);
    await user.save();
    await Session.updateMany(
      { user: req.user.id },
      { $set: { revoked: true } }
    );
    const token = signToken(user);
    return res.json({ token });
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
