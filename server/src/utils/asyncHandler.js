/**
 * Wraps an async route handler so that unhandled promise rejections
 * are forwarded to Express's next(err) error middleware.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
