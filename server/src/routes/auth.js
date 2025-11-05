import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { auth, signToken } from '../middleware/auth.js';
import { Session } from '../models/Session.js';
import { isValidPhone, isStrongPassword } from '../utils/validators.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Data wajib belum lengkap' });
    }
    const phoneTrim = String(phone).trim();
    if (!isValidPhone(phoneTrim)) {
      return res.status(400).json({ error: 'Format nomor telepon tidak valid' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Kata sandi minimal 8 karakter' });
    }
    const existing = await User.findOne({ phone: phoneTrim });
    if (existing) return res.status(409).json({ error: 'Nomor telepon sudah terdaftar' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone: phoneTrim, passwordHash });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Data wajib belum lengkap' });
    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: 'Nomor telepon atau kata sandi salah' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Nomor telepon atau kata sandi salah' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
});

export default router;

// Logout (stateless):
// This endpoint is provided for client symmetry. With stateless JWT,
// logging out is done client-side by deleting the token. This route
// simply validates the current token and returns ok, allowing clients
// to call it before clearing their local token.
router.post('/logout', auth, async (req, res) => {
  try {
    const jti = req.sessionJti;
    if (jti) {
      await Session.updateOne({ jti, user: req.user.id }, { $set: { revoked: true } });
    }
  } catch {}
  return res.json({ ok: true });
});
