/**
 * Health controller — Phase 17 (Step 17 final).
 *
 * GET /health  — Liveness probe: server is up and responding.
 * GET /ready   — Readiness probe: all critical dependencies are available.
 *
 * Reports status for all IBM services and dependencies without making live
 * inference / storage API calls on every health request.
 */
import { success, error } from '../utils/apiResponse.js'
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

const SERVER_START = Date.now()

/** Package version from env (injected at build time or default). */
const APP_VERSION = process.env.npm_package_version ?? '1.0.0'

export async function getHealth(req, res) {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START) / 1000)

  // ── Database status ────────────────────────────────────────────────────
  let dbStatus = 'not-configured'
  if (config.db.uri) {
    try {
      getDb()
      dbStatus = 'connected'
    } catch {
      dbStatus = 'not-connected'
    }
  }

  // ── AI (IBM Granite / watsonx.ai) ──────────────────────────────────────
  const aiStatus = getAiHealthStatus()

  // ── Storage (IBM COS) ──────────────────────────────────────────────────
  const storageStatus = getStorageHealthStatus()

  // ── RAG / Embedding ────────────────────────────────────────────────────
  const embeddingStatus = getEmbeddingHealthStatus()
  let indexedDocuments = 0
  try {
    indexedDocuments = await countIndexedDocuments()
  } catch {
    indexedDocuments = 0
  }

  // ── Weather (Open-Meteo) ───────────────────────────────────────────────
  const weatherStatus = getWeatherHealthStatus()
  const weatherCacheStats = getCacheStats()

  // ── Market (data.gov.in Agmarknet) ─────────────────────────────────────
  const marketStatus = getMarketHealthStatus()
  const marketCacheStats = getMarketCacheStats()

  // ── IBM Speech to Text ─────────────────────────────────────────────────
  const sttStatus = getSttHealthStatus()

  // ── IBM Text to Speech ─────────────────────────────────────────────────
  const ttsStatus = getTtsHealthStatus()

  return success(res, {
    status: 'ok',
    server: 'running',
    version: APP_VERSION,
    uptime: uptimeSeconds,
    database: dbStatus,
    ai: aiStatus,
    storage: storageStatus,
    stt: sttStatus,
    tts: ttsStatus,
    rag: {
      embeddingProvider: embeddingStatus,
      vectorStore: 'connected',
      indexedDocuments,
    },
    weather: {
      provider: weatherStatus,
      cache: weatherCacheStats,
    },
    market: {
      provider: marketStatus,
      cache: marketCacheStats,
    },
    mockMode: config.providers.useMocks,
    demoMode: config.demo.enabled,
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  })
}

/**
 * Step 17: Readiness probe.
 *
 * Returns 200 when the service is ready to accept production traffic,
 * or 503 when a critical dependency is unavailable.
 * Kubernetes / Docker Compose / load balancers poll this endpoint.
 */
export async function getReadiness(req, res) {
  const checks = {}
  let ready = true

  // ── Database ───────────────────────────────────────────────────────────
  if (config.db.uri) {
    try {
      getDb()
      checks.database = 'ok'
    } catch {
      checks.database = 'unavailable'
      ready = false
    }
  } else {
    checks.database = 'not-configured'
  }

  // ── IBM Granite / watsonx.ai ───────────────────────────────────────────
  const aiStatus = getAiHealthStatus()
  checks.ibmGranite = aiStatus
  if (!config.providers.useMocks && aiStatus === 'not-configured') {
    ready = false
  }

  // ── IBM Cloud Object Storage ───────────────────────────────────────────
  const storageStatus = getStorageHealthStatus()
  checks.ibmCOS = storageStatus
  if (!config.providers.useMocks && storageStatus === 'not-configured') {
    ready = false
  }

  // ── IBM Speech to Text ─────────────────────────────────────────────────
  const sttStatus = getSttHealthStatus()
  checks.ibmSTT = sttStatus
  // STT/TTS are optional — warn but do not block readiness

  // ── IBM Text to Speech ─────────────────────────────────────────────────
  const ttsStatus = getTtsHealthStatus()
  checks.ibmTTS = ttsStatus

  // ── MongoDB (alias for database) ───────────────────────────────────────
  checks.mongodb = checks.database

  const payload = {
    status: ready ? 'ready' : 'not-ready',
    checks,
    timestamp: new Date().toISOString(),
  }

  return ready
    ? success(res, payload, 200)
    : error(res, 'NOT_READY', 'Service is not ready to accept traffic', 503)
}
