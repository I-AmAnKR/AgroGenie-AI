import config from '../config/env.js'

/**
 * Phase 17A: Production-ready structured logger.
 *
 * - Development: human-readable formatted lines.
 * - Production:  newline-delimited JSON (easily ingested by log aggregators).
 * - Test:        silent (no output).
 * - Log level is controlled via LOG_LEVEL env var (error|warn|info|debug).
 *   Defaults to 'debug' in dev and 'info' in production.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

function resolveLevel() {
  // Explicit override always wins
  if (config.security.logLevel && LEVELS[config.security.logLevel] !== undefined) {
    return LEVELS[config.security.logLevel]
  }
  if (config.server.isTest) return -1 // silent
  return config.server.isDev ? LEVELS.debug : LEVELS.info
}

const currentLevel = resolveLevel()
const isProd = config.server.isProd

function formatDev(level, message, meta = {}) {
  const ts = new Date().toISOString()
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
  return `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}`
}

function formatProd(level, message, meta = {}) {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  })
}

function log(level, message, meta) {
  if (currentLevel < LEVELS[level]) return
  const line = isProd
    ? formatProd(level, message, meta)
    : formatDev(level, message, meta)
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
}

export default logger
