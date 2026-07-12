import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { schemes, schemeById } from '../controllers/schemes.controller.js'

const router = Router()

// GET /schemes
router.get('/', asyncHandler(schemes))

// GET /schemes/:id
router.get('/:id', asyncHandler(schemeById))

export default router
