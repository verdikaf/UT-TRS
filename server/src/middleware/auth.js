import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, phone: payload.phone, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function signToken(user) {
  const payload = { id: user._id, phone: user.phone, name: user.name };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}
