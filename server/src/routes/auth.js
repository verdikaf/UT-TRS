import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User.js";
import { auth, signToken } from "../middleware/auth.js";
import { Session } from "../models/Session.js";
import { isValidPhone, isStrongPassword } from "../utils/validators.js";
import { cleanPhoneInput, makePhoneVariants } from "../utils/phone.js";
import { sendWhatsAppMessage } from "../services/fonnte.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Required fields are missing" });
    }
    const phoneTrim = cleanPhoneInput(phone);
    if (!isValidPhone(phoneTrim)) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }
    if (!isStrongPassword(password)) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters" });
    }
    const existing = await User.findOne({ phone: phoneTrim });
    if (existing)
      return res.status(409).json({ error: "Phone number already registered" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone: phoneTrim, passwordHash });
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: "Required fields are missing" });

    // Normalize common user input variants for phone: trim, drop spaces/dashes, try with/without leading +
    const variants = makePhoneVariants(phone);
    const user = await User.findOne({ phone: { $in: variants } });
    if (!user)
      return res
        .status(401)
        .json({ error: "Incorrect phone number or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res
        .status(401)
        .json({ error: "Incorrect phone number or password" });
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot password: generate a temporary password and send via WhatsApp
router.post("/forgot-password", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone)
      return res.status(400).json({ error: "Phone number is required" });

    // Normalize input similar to login
    const variants = makePhoneVariants(phone);
    const user = await User.findOne({ phone: { $in: variants } });
    if (!user) return res.status(404).json({ error: "Phone number not found" });

    // Generate strong temporary password (10 chars)
    const tempPassword = generateTempPassword(10);

    // Compose WhatsApp message in Bahasa (do NOT change password yet)
    const message = `Halo ${user.name}! 🔐\nPermintaan lupa kata sandi berhasil. Kata sandi sementara kamu:\n\n${tempPassword}\n\nSilakan login lalu segera ganti kata sandi di halaman Profil. Jangan bagikan kata sandi ini ke siapapun. Terima kasih 🙌`;
    try {
      await sendWhatsAppMessage({ phone: user.phone, message });
      // Only after successful send, update password to avoid lockout if send fails
      const hash = await bcrypt.hash(tempPassword, 10);
      user.passwordHash = hash;
      await user.save();
    } catch (e) {
      console.error(
        "Gagal kirim WA reset password:",
        e?.response?.data || e.message
      );
      return res
        .status(502)
        .json({
          error:
            "Failed to send WhatsApp message. Please try again in a moment.",
        });
    }
    return res.json({
      ok: true,
      message: "Temporary password has been sent via WhatsApp",
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function generateTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!";
  let out = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, chars.length);
    out += chars[idx];
  }
  if (!/[0-9]/.test(out)) out = out.slice(0, -1) + "7";
  if (!/[A-Za-z]/.test(out)) out = "A" + out.slice(1);
  return out;
}

export default router;

// Logout (stateless):
// This endpoint is provided for client symmetry. With stateless JWT,
// logging out is done client-side by deleting the token. This route
// simply validates the current token and returns ok, allowing clients
// to call it before clearing their local token.
router.post("/logout", auth, async (req, res) => {
  try {
    const jti = req.sessionJti;
    if (jti) {
      await Session.updateOne(
        { jti, user: req.user.id },
        { $set: { revoked: true } }
      );
    }
  } catch {}
  return res.json({ ok: true });
});
