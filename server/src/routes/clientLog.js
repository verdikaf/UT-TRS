import { Router } from 'express';
import { logger } from '../utils/logger.js';

const router = Router();

// Simple client log ingestion endpoint.
// In production you might add auth, rate limiting, or persistence.
router.post('/', async (req, res) => {
  try {
    const { type, message, stack, info, component, time } = req.body || {};
    if (!type || !message) {
      return res.status(400).json({ error: 'type and message are required' });
    }
    // Use structured logger; normal ingestion is info level.
    logger.info('client.log.ingest', { type, message, stack, info, component, time });
    return res.json({ ok: true });
  } catch (e) {
    logger.error('client.log.ingest.error', { err: e.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;