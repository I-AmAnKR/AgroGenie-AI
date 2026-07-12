/**
 * Central route registry.
 * All API routes are mounted here and exposed via /api/v1.
 */
import { Router } from 'express'
import healthRoutes from './health.routes.js'
import chatRoutes from './chat.routes.js'
import cropRoutes from './crop.routes.js'
import weatherRoutes from './weather.routes.js'
import marketRoutes from './market.routes.js'
import schemesRoutes from './schemes.routes.js'
import diseaseRoutes from './disease.routes.js'
import profileRoutes from './profile.routes.js'
import recommendationsRoutes from './recommendations.routes.js'
import feedbackRoutes from './feedback.routes.js'
import aiRoutes from './ai.routes.js'
import knowledgeRoutes from './knowledge.routes.js'
import agentsRoutes from './agents.routes.js'
import voiceRoutes from './voice.routes.js'
import monitoringRoutes from './monitoring.routes.js'

const router = Router()

router.use('/health', healthRoutes)
router.use('/chat', chatRoutes)
router.use('/crop-recommendation', cropRoutes)
router.use('/weather', weatherRoutes)
router.use('/market', marketRoutes)
router.use('/schemes', schemesRoutes)
router.use('/disease', diseaseRoutes)
router.use('/profile', profileRoutes)
router.use('/recommendations', recommendationsRoutes)
router.use('/feedback', feedbackRoutes)
router.use('/ai', aiRoutes)
router.use('/knowledge', knowledgeRoutes)
// Phase 9: Agent Router observability (dev only)
router.use('/agents', agentsRoutes)
// Phase 14B: Voice transcription
router.use('/voice', voiceRoutes)
// Step 17: Monitoring dashboard API
router.use('/monitoring', monitoringRoutes)

export default router
