import { validationError } from '../utils/apiResponse.js'

/**
 * Lightweight field-level validator factory.
 *
 * Usage:
 *   router.post('/path', validate(rules), asyncHandler(controller))
 *
 * Rules example:
 *   [
 *     { field: 'message', required: true, type: 'string', minLength: 1 },
 *     { field: 'rating',  required: true, type: 'number', min: 1, max: 5 },
 *   ]
 */
export function validate(rules) {
  return (req, res, next) => {
    const body = req.body ?? {}
    const query = req.query ?? {}
    const params = req.params ?? {}
    const all = { ...params, ...query, ...body }
    const details = []

    for (const rule of rules) {
      const value = all[rule.field]
      const isEmpty = value === undefined || value === null || value === ''

      if (rule.required && isEmpty) {
        details.push({ field: rule.field, message: `${rule.field} is required` })
        continue
      }

      if (isEmpty) continue

      if (rule.type === 'string' && typeof value !== 'string') {
        details.push({ field: rule.field, message: `${rule.field} must be a string` })
        continue
      }

      if (rule.type === 'number') {
        const num = Number(value)
        if (isNaN(num)) {
          details.push({ field: rule.field, message: `${rule.field} must be a number` })
          continue
        }
        if (rule.min !== undefined && num < rule.min) {
          details.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min}` })
        }
        if (rule.max !== undefined && num > rule.max) {
          details.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max}` })
        }
      }

      if (rule.type === 'string' && rule.minLength !== undefined && value.trim().length < rule.minLength) {
        details.push({ field: rule.field, message: `${rule.field} must not be empty` })
      }
    }

    if (details.length > 0) {
      return validationError(res, 'Validation failed', details)
    }
    next()
  }
}
