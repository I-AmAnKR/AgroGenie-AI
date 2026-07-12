import { v4 as uuidv4 } from 'uuid'

/**
 * Attaches a unique request ID to each incoming request.
 * Available via req.requestId and res.locals.requestId.
 */
export function requestIdMiddleware(req, res, next) {
  const id = req.headers['x-request-id'] ?? uuidv4()
  req.requestId = id
  res.locals.requestId = id
  res.setHeader('X-Request-ID', id)
  next()
}
