import { notFoundError } from '../utils/apiResponse.js'

/**
 * 404 catch-all — must be registered after all routes.
 */
export function notFoundMiddleware(req, res) {
  notFoundError(res, `Route ${req.method} ${req.originalUrl} not found`)
}
