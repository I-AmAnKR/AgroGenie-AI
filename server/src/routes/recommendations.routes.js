import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { recommendations, recentRecommendations } from '../controllers/recommendations.controller.js'

const router = Router()

// GET /recommendations/:userId
router.get('/:userId', asyncHandler(recommendations))

// GET /recommendations/:userId/recent
router.get('/:userId/recent', asyncHandler(recentRecommendations))

export default router
