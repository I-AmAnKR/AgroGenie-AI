import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getHealth, getReadiness } from '../controllers/health.controller.js'

const router = Router()

// GET /api/v1/health  — liveness probe (is the server process alive?)
router.get('/', asyncHandler(getHealth))

// GET /api/v1/health/ready — readiness probe (are all dependencies available?)
router.get('/ready', asyncHandler(getReadiness))

export default router
