import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { cropRecommendation } from '../controllers/crop.controller.js'
import { validate } from '../middleware/validate.middleware.js'

const router = Router()

// POST /crop-recommendation
router.post(
  '/',
  validate([
    { field: 'state', required: true, type: 'string', minLength: 1 },
    { field: 'season', required: true, type: 'string', minLength: 1 },
    { field: 'soilType', required: true, type: 'string', minLength: 1 },
    { field: 'objective', required: false, type: 'string' },
  ]),
  asyncHandler(cropRecommendation)
)

export default router
