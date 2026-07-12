import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { marketPrices, marketTrend } from '../controllers/market.controller.js'

const router = Router()

// GET /market/prices
router.get('/prices', asyncHandler(marketPrices))

// GET /market/trends
router.get('/trends', asyncHandler(marketTrend))

export default router
