import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { auth, signToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { isValidPhone, isStrongPassword } from '../utils/validators.js';

const router = Router();

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id name phone');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, phone: user.phone });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/phone', auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone is required' });
    const phoneTrim = String(phone).trim();
    if (!isValidPhone(phoneTrim)) return res.status(400).json({ error: 'Invalid phone format' });
    const exists = await User.findOne({ phone: phoneTrim, _id: { $ne: req.user.id } });
    if (exists) return res.status(409).json({ error: 'Phone already in use' });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { phone: phoneTrim } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (req.sessionJti) {
      await Session.updateOne({ jti: req.sessionJti, user: req.user.id }, { $set: { revoked: true } });
    }
    const token = signToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });
    if (!isStrongPassword(newPassword)) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await Session.updateMany({ user: req.user.id }, { $set: { revoked: true } });
    const token = signToken(user);
    return res.json({ token });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
