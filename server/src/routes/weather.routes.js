import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { weather, weatherAdvice } from '../controllers/weather.controller.js'

const router = Router()

// GET /weather
router.get('/', asyncHandler(weather))

// POST /weather/advice
router.post('/advice', asyncHandler(weatherAdvice))

export default router
