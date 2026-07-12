import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { diseaseAnalyze, uploadDiseaseImage } from '../controllers/disease.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { uploadImageMiddleware } from '../middleware/upload.middleware.js'

const router = Router()

// POST /disease/analyze
router.post(
  '/analyze',
  validate([
    { field: 'crop', required: true, type: 'string', minLength: 1 },
    { field: 'plantPart', required: false, type: 'string' },
  ]),
  asyncHandler(diseaseAnalyze)
)

// POST /disease/image
router.post(
  '/image',
  uploadImageMiddleware,
  asyncHandler(uploadDiseaseImage)
)

export default router
