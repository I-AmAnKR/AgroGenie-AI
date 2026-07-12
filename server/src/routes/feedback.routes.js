import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { feedback } from '../controllers/feedback.controller.js'
import { validate } from '../middleware/validate.middleware.js'

const router = Router()

// POST /feedback
router.post(
  '/',
  validate([
    { field: 'userId', required: true, type: 'string', minLength: 1 },
    { field: 'recommendationId', required: true, type: 'string', minLength: 1 },
    { field: 'rating', required: true, type: 'number', min: 1, max: 5 },
    { field: 'comment', required: false, type: 'string' },
  ]),
  asyncHandler(feedback)
)

export default router
