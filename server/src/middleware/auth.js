import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Session } from '../models/Session.js';

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, phone: payload.phone, name: payload.name };
    req.sessionJti = payload.jti;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Session enforcement with idle timeout
  (async () => {
    try {
      const jti = req.sessionJti;
      if (!jti) return res.status(401).json({ error: 'Invalid session' });
      const session = await Session.findOne({ jti, user: req.user.id, revoked: false });
      if (!session) return res.status(401).json({ error: 'Session ended' });

      const maxIdleMinutes = parseInt(process.env.MAX_IDLE_MINUTES || '5', 10);
      const now = new Date();
      if (now.getTime() - session.lastActivityAt.getTime() > maxIdleMinutes * 60 * 1000) {
        session.revoked = true;
        await session.save();
        return res.status(401).json({ error: 'Session expired due to inactivity' });
      }
      session.lastActivityAt = now;
      await session.save();
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Session validation failed' });
    }
  })();
}

export function signToken(user) {
  const jti = randomUUID();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const payload = { id: user._id, phone: user.phone, name: user.name, jti };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  try {
    const decoded = jwt.decode(token);
    const expMs = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
    Session.create({
      jti,
      user: user._id,
      lastActivityAt: new Date(),
      expiresAt: new Date(expMs),
      revoked: false,
    }).catch(() => {});
  } catch {}
  return token;
}
