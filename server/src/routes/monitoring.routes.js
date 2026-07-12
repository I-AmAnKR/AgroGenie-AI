import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getMonitoringStatus,
  getMonitoringStats,
  getDemoInfo,
} from '../controllers/monitoring.controller.js'

const router = Router()

// GET /api/v1/monitoring/status — full system status
router.get('/status', asyncHandler(getMonitoringStatus))

// GET /api/v1/monitoring/stats — usage statistics
router.get('/stats', asyncHandler(getMonitoringStats))

// GET /api/v1/monitoring/demo — demo mode info
router.get('/demo', asyncHandler(getDemoInfo))

export default router
