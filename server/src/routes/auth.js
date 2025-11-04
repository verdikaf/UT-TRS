import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { auth, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ error: 'Phone already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, phone, passwordHash });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Missing fields' });
    const user = await User.findOne({ phone });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// Logout (stateless):
// This endpoint is provided for client symmetry. With stateless JWT,
// logging out is done client-side by deleting the token. This route
// simply validates the current token and returns ok, allowing clients
// to call it before clearing their local token.
router.post('/logout', auth, async (req, res) => {
  return res.json({ ok: true });
});
