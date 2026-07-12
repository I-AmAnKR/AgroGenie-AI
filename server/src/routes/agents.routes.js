/**
 * Agents routes — Phase 9.
 *
 * Development-only endpoints for Agent Router testing and observability.
 *
 * Mounted at: /api/v1/agents
 *
 * Endpoints:
 *   POST /route-test  — classify intent only without executing the agent
 *   GET  /metrics     — routing metrics counters (dev only)
 */
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { routeTest, routingMetrics } from '../controllers/agents.controller.js'

const router = Router()

// POST /route-test — development only
router.post('/route-test', asyncHandler(routeTest))

// GET /metrics — development only
router.get('/metrics', asyncHandler(routingMetrics))

export default router
