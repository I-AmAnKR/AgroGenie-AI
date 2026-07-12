import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'

import config from './config/env.js'
import logger from './utils/logger.js'
import { requestIdMiddleware } from './middleware/requestId.middleware.js'
import { notFoundMiddleware } from './middleware/notFound.middleware.js'
import { errorMiddleware } from './middleware/error.middleware.js'
import apiRoutes from './routes/index.js'

const app = express()

// ── Security headers (Phase 17A: tighten defaults) ──────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow blob: URLs for image previews (Phase 15D)
}))

// ── CORS (Phase 17A: support multiple trusted origins) ─────────────────────
const allowedOrigins = [config.client.url]
if (config.security.extraOrigins) {
  config.security.extraOrigins.split(',').map(o => o.trim()).filter(Boolean).forEach(o => allowedOrigins.push(o))
}

app.use(
  cors({
    origin: (origin, cb) => {
    //Allow requests without an Origin header
    // (Render health checks, curl, Postman, server-to-server requests)
    if (!origin) {
      return cb(null, true);
    }

    if (allowedOrigins.includes(origin)) {
        return cb(null, true);
  }

    return cb(new Error(`CORS: Origin not allowed: ${origin}`));
  },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  })
)

// ── Rate limiting (Phase 17A: env-driven config) ────────────────────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.server.isDev ? config.rateLimit.maxDev : config.rateLimit.maxProd,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait before trying again.' }, meta: {} },
  skip: (req) => config.server.isTest, // never rate-limit during tests
})
app.use('/api/', limiter)

// ── Body parsers (Phase 17A: env-driven limit) ─────────────────────────────
const bodyLimit = `${Math.ceil(config.upload.maxBytes / (1024 * 1024))}mb`
app.use(express.json({ limit: bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: bodyLimit }))

// ── Request ID (must be before Morgan so it can be used in log tokens) ──────
app.use(requestIdMiddleware)

// ── Request logging (Phase 17A: include request ID in every log line) ───────
if (!config.server.isTest) {
  // Add a custom token so the requestId appears in every Morgan line
  morgan.token('reqId', (req) => req.requestId ?? '-')
  const morganFormat = config.server.isDev
    ? ':reqId :method :url :status :response-time ms'
    : ':reqId :remote-addr :method :url :status :res[content-length] :response-time ms'
  app.use(morgan(morganFormat, {
    stream: {
      write: (message) => logger.info(message.trim(), { source: 'http' }),
    },
  }))
}

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes)

// ── 404 ────────────────────────────────────────────────────────────────────
app.use(notFoundMiddleware)

// ── Centralised error handler (must be last) ───────────────────────────────
app.use(errorMiddleware)

logger.info('Express application configured', {
  cors: allowedOrigins,
  mockProviders: config.providers.useMocks,
  env: config.server.nodeEnv,
  rateLimit: { windowMs: config.rateLimit.windowMs, max: config.server.isDev ? config.rateLimit.maxDev : config.rateLimit.maxProd },
})

export default app
