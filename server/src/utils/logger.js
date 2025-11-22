// Simple logger abstraction; can be expanded to use pino/winston later.
const LEVELS = ['error', 'warn', 'info', 'debug'];
const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentIdx = LEVELS.indexOf(currentLevel);

function log(level, msg, meta = {}) {
  const idx = LEVELS.indexOf(level);
  if (idx <= currentIdx && idx !== -1) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
    if (level === 'error') console.error(line); else console.log(line);
  }
}

export const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

export function attachRequestId(app) {
  let counter = 0;
  app.use((req, _res, next) => {
    req.requestId = `${Date.now().toString(36)}-${(counter++).toString(36)}`;
    next();
  });
}