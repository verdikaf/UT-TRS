import { Router } from 'express';

const router = Router();

// Simple client log ingestion endpoint.
// In production you might add auth, rate limiting, or persistence.
router.post('/', async (req, res) => {
  try {
    const { type, message, stack, info, component, time } = req.body || {};
    if (!type || !message) {
      return res.status(400).json({ error: 'type and message are required' });
    }
    // For now just print to server console.
    console.error('[ClientLog]', JSON.stringify({ type, message, stack, info, component, time }));
    return res.json({ ok: true });
  } catch (e) {
    console.error('Failed to process client log', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;