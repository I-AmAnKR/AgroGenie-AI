/**
 * Monitoring Controller — Step 17 Part 4.
 *
 * GET /api/v1/monitoring/status — Full system status dashboard
 * GET /api/v1/monitoring/stats  — Usage statistics
 * GET /api/v1/monitoring/demo   — Demo mode data summary
 *
 * These endpoints aggregate data from all providers and services
 * for the monitoring dashboard in the frontend.
 *
 * No live API calls are made — all data is from config checks and
 * in-memory counters.
 */
import { success } from '../utils/apiResponse.js'
import config from '../config/env.js'
import { getDb } from '../services/db.service.js'
import { getAiHealthStatus } from '../providers/ai.provider.factory.js'
import { getStorageHealthStatus } from '../providers/storage.provider.factory.js'
import { getEmbeddingHealthStatus } from '../providers/embedding.provider.factory.js'
import { getWeatherHealthStatus } from '../providers/weather.provider.factory.js'
import { getMarketHealthStatus } from '../providers/market.provider.factory.js'
import { getSttHealthStatus } from '../providers/stt.provider.factory.js'
import { getTtsHealthStatus } from '../providers/tts.provider.factory.js'
import { getCacheStats } from '../services/weatherCache.service.js'
import { getMarketCacheStats } from '../services/marketCache.service.js'
import { countIndexedDocuments } from '../repositories/knowledgeChunk.repository.js'
import { getRoutingMetrics } from '../agents/router.js'
import { getDemoDataSummary } from '../services/demo.service.js'

const SERVER_START = Date.now()
const APP_VERSION = process.env.npm_package_version ?? '1.0.0'

/**
 * GET /monitoring/status
 * Full system status with all IBM services and infrastructure.
 */
export async function getMonitoringStatus(req, res) {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START) / 1000)

  // ── Database ───────────────────────────────────────────────────────────
  let dbStatus = 'not-configured'
  if (config.db.uri) {
    try {
      getDb()
      dbStatus = 'connected'
    } catch {
      dbStatus = 'not-connected'
    }
  }

  // ── IBM Services ───────────────────────────────────────────────────────
  const aiStatus = getAiHealthStatus()
  const storageStatus = getStorageHealthStatus()
  const embeddingStatus = getEmbeddingHealthStatus()
  const weatherStatus = getWeatherHealthStatus()
  const marketStatus = getMarketHealthStatus()
  const sttStatus = getSttHealthStatus()
  const ttsStatus = getTtsHealthStatus()

  // ── Cache Stats ────────────────────────────────────────────────────────
  const weatherCache = getCacheStats()
  const marketCache = getMarketCacheStats()

  // ── RAG Stats ──────────────────────────────────────────────────────────
  let indexedDocuments = 0
  try {
    indexedDocuments = await countIndexedDocuments()
  } catch {
    indexedDocuments = 0
  }

  // ── Routing Metrics ────────────────────────────────────────────────────
  const routingMetrics = getRoutingMetrics()

  const overallHealth = [dbStatus, aiStatus, storageStatus].every(
    s => ['connected', 'mock', 'not-configured'].includes(s)
  ) ? 'healthy' : 'degraded'

  return success(res, {
    overallHealth,
    version: APP_VERSION,
    uptime: uptimeSeconds,
    environment: config.server.nodeEnv,
    mockMode: config.providers.useMocks,
    demoMode: config.demo.enabled,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: {
        status: dbStatus,
        label: 'MongoDB Atlas',
        required: true,
      },
      ibmGranite: {
        status: aiStatus,
        label: 'IBM Granite (watsonx.ai)',
        model: config.watsonx.modelId || config.providers.useMocks ? 'mock' : 'not-configured',
        required: true,
      },
      ibmEmbedding: {
        status: embeddingStatus,
        label: 'IBM Slate Embeddings',
        model: config.rag.embeddingModelId || (config.providers.useMocks ? 'mock' : 'not-configured'),
        indexedDocuments,
        required: false,
      },
      ibmCOS: {
        status: storageStatus,
        label: 'IBM Cloud Object Storage',
        bucket: config.cos.bucketName || (config.providers.useMocks ? 'mock' : 'not-configured'),
        required: true,
      },
      ibmSTT: {
        status: sttStatus,
        label: 'IBM Speech to Text',
        model: config.stt.defaultModel,
        required: false,
      },
      ibmTTS: {
        status: ttsStatus,
        label: 'IBM Text to Speech',
        voice: config.tts.defaultVoice,
        required: false,
      },
      weatherApi: {
        status: weatherStatus,
        label: 'Open-Meteo (Weather)',
        provider: 'open-meteo',
        cache: weatherCache,
        required: false,
      },
      marketApi: {
        status: marketStatus,
        label: 'Agmarknet (Market Prices)',
        provider: 'data.gov.in',
        cache: marketCache,
        required: false,
      },
    },
    routing: routingMetrics,
  })
}

/**
 * GET /monitoring/stats
 * Usage statistics aggregated from routing metrics.
 */
export async function getMonitoringStats(req, res) {
  const metrics = getRoutingMetrics()

  // Compute average response time
  const avgResponseMs = metrics.requestCount > 0
    ? Math.round(metrics.totalDurationMs / metrics.requestCount)
    : 0

  // Break down by intent type
  const {
    CROP_RECOMMENDATION = 0,
    DISEASE = 0,
    WEATHER = 0,
    MARKET = 0,
    SCHEME = 0,
    KNOWLEDGE = 0,
    GENERAL = 0,
    MULTI_INTENT = 0,
    CLARIFICATION = 0,
  } = metrics.intentCounts

  return success(res, {
    totalConversations: metrics.requestCount,
    cropRecommendations: CROP_RECOMMENDATION,
    diseaseDiagnoses: DISEASE,
    weatherRequests: WEATHER,
    marketRequests: MARKET,
    schemeRequests: SCHEME,
    knowledgeRequests: KNOWLEDGE,
    generalRequests: GENERAL,
    multiIntentRequests: MULTI_INTENT,
    clarificationRequests: CLARIFICATION,
    ragGroundedCount: metrics.ragGroundedCount,
    clarificationCount: metrics.clarificationCount,
    agentFailureCount: metrics.agentFailureCount,
    avgResponseTimeMs: avgResponseMs,
    agentUsageCounts: metrics.agentSelectionCounts,
    timestamp: new Date().toISOString(),
  })
}

/**
 * GET /monitoring/demo
 * Demo mode data summary.
 */
export async function getDemoInfo(req, res) {
  const summary = getDemoDataSummary()
  return success(res, {
    demoMode: config.demo.enabled,
    summary: summary ?? null,
    timestamp: new Date().toISOString(),
  })
}
