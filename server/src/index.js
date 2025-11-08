import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { agenda, initAgenda } from "./config/agenda.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import profileRoutes from "./routes/profile.js";
import phoneRoutes from "./routes/phone.js";
import clientLogRoutes from "./routes/clientLog.js";
import { logger, attachRequestId } from "./utils/logger.js";

// Global error / rejection handlers - registered early to catch all errors
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled.rejection", { reason: String(reason) });
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.error("uncaught.exception", { err: err.message });
  process.exit(1);
});

const app = express();
attachRequestId(app);

const PORT = process.env.PORT || 4000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const rawOrigins = process.env.ALLOWED_ORIGINS || CLIENT_URL;
const allowedOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / health checks
      const normalized = origin.replace(/\/$/, "");
      const match = allowedOrigins.find((o) => o === normalized);
      logger.debug("cors.origin.check", { origin, normalized, match: !!match });
      if (match) return cb(null, true);
      logger.warn("cors.block", { origin });
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

// Basic request logging (can refine / ignore noise)
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    logger.info("req", {
      id: req.requestId,
      method: req.method,
      path: req.path,
    });
  }
  next();
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/phone", phoneRoutes);
app.use("/api/client-log", clientLogRoutes);

// Optional debug endpoint (enable only if DEBUG_ENV=true)
app.get("/api/_debug/env", (req, res) => {
  if (process.env.DEBUG_ENV !== "true")
    return res.status(404).json({ error: "Not enabled" });
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    TIMEZONE: process.env.TIMEZONE,
    CLIENT_URL: process.env.CLIENT_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    hasJWT: !!process.env.JWT_SECRET,
    hasFonnte: !!process.env.FONNTE_TOKEN,
    mongodbUriSet: !!process.env.MONGODB_URI,
  });
});

async function start() {
  await connectDB();
  await initAgenda();

  const server = app.listen(PORT, () => {
    logger.info("server.start", { port: PORT });
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      logger.error("port.in.use", { port: PORT });
    } else {
      logger.error("server.error", { err: err.message });
    }
    process.exit(1);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Choose another port by setting PORT in .env or stop the process using this port.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  logger.error("startup.fail", { err: err.message });
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    if (agenda) await agenda.stop();
  } catch (e) {}
  process.exit(0);
});
