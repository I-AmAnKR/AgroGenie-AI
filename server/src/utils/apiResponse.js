/**
 * Standard API response helpers.
 * All controllers use these — never construct response objects manually.
 *
 * Success shape:  { success: true,  data: {},   error: null, meta: { requestId } }
 * Failure shape:  { success: false, data: null, error: { code, message, details }, meta: { requestId } }
 */

export function success(res, data = {}, statusCode = 200, meta = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
    meta: {
      requestId: res.locals.requestId ?? null,
      ...meta,
    },
  })
}

export function error(res, code, message, statusCode = 500, details = []) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId: res.locals.requestId ?? null,
    },
  })
}

export function validationError(res, message, details = []) {
  return error(res, 'VALIDATION_ERROR', message, 400, details)
}

export function notFoundError(res, message = 'Resource not found') {
  return error(res, 'NOT_FOUND', message, 404)
}

export function internalError(res, message = 'An unexpected error occurred') {
  return error(res, 'INTERNAL_ERROR', message, 500)
}

export function providerError(res, message = 'External provider error') {
  return error(res, 'PROVIDER_ERROR', message, 502)
}
