import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { profile, updateProfileHandler } from '../controllers/profile.controller.js'

const router = Router()

// GET /profile/:userId
router.get('/:userId', asyncHandler(profile))

// PUT /profile/:userId
router.put('/:userId', asyncHandler(updateProfileHandler))

export default router
