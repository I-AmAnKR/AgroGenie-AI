import config from '../config/env.js'
import logger from '../utils/logger.js'
import { error } from '../utils/apiResponse.js'

/**
 * Centralised error handler — must be the last middleware registered.
 * Catches errors forwarded via next(err).
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  // Normalise status code
  const statusCode = err.statusCode ?? err.status ?? 500
  const code = err.code ?? 'INTERNAL_ERROR'
  const message = err.message ?? 'An unexpected error occurred'

  // Always log the real error (with stack in dev)
  logger.error(`${code}: ${message}`, {
    requestId: res.locals.requestId,
    path: req.originalUrl,
    method: req.method,
    stack: config.server.isDev ? err.stack : undefined,
  })

  // Never expose stack traces in production
  return error(
    res,
    code,
    config.server.isProd ? 'An unexpected error occurred' : message,
    statusCode
  )
}
