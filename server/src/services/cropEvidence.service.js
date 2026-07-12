/**
 * Crop Evidence Service — Phase 13.
 *
 * Thin adapters that call existing provider/service interfaces and
 * return normalized evidence structures for the Crop Scoring Engine.
 *
 * Architecture contract:
 *   CropRecommendationAgent → CropEvidenceService → {
 *     WeatherProvider (via factory),
 *     MarketProvider (via factory),
 *     RAG service,
 *     Scheme service
 *   }
 *
 * Safety rules:
 *   - Each adapter wraps its failure in a try/catch and returns
 *     { available: false } on error. Evidence failures do NOT abort
 *     the recommendation — they reduce evidenceCoverage.
 *   - NEVER invent data. If a provider fails, set available: false.
 *   - This service never calls the LLM.
 *   - Results are structured data only — no prose generation.
 */
import { getWeatherProvider } from '../providers/weather.provider.factory.js'
import { getMarketProvider } from '../providers/market.provider.factory.js'
import { buildCacheKey, getFromCache, setInCache } from './weatherCache.service.js'
import { buildMarketCacheKey, getMarketFromCache, setMarketInCache } from './marketCache.service.js'
import { searchKnowledge } from './rag.service.js'
import { findCandidates } from './schemes.service.js'
import { calculatePriceStatistics, calculateTrend } from './marketAnalytics.service.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Weather evidence adapter ──────────────────────────────────────────────────

/**
 * Collect weather evidence for the farmer's location.
 * Reuses the same provider and cache strategy as WeatherAgent.
 *
 * @param {object} params
 * @param {object} params.location - { state, district }
 * @param {object} [params.metadata={}]
 * @returns {Promise<{
 *   available: boolean,
 *   current: object|null,
 *   forecast: object[],
 *   provider: string,
 *   isDemo: boolean,
 *   error: string|null
 * }>}
 */
export async function collectWeatherEvidence({ location, metadata = {} }) {
  if (!location?.district && !location?.state) {
    return { available: false, current: null, forecast: [], provider: null, isDemo: false, error: 'Location not available' }
  }

  const locationName = location.district ?? location.state
  const providerName = config.providers.useMocks ? 'mock-weather' : 'open-meteo'

  try {
    const weatherProvider = getWeatherProvider()
    const cacheKey = buildCacheKey({
      provider: providerName,
      location: locationName,
      days: config.weather.forecastDays,
    })

    let weatherData = getFromCache(cacheKey)
    if (!weatherData) {
      weatherData = await weatherProvider.getWeatherByLocation({
        district: location.district,
        state: location.state,
        days: config.weather.forecastDays,
      })
      setInCache(cacheKey, weatherData)
    }

    return {
      available: true,
      current: weatherData.current ?? null,
      forecast: weatherData.forecast ?? [],
      locationName: weatherData.location?.name ?? locationName,
      provider: providerName,
      isDemo: weatherData.metadata?.isDemo === true,
      error: null,
    }
  } catch (err) {
    logger.warn('CropEvidenceService: weather collection failed', {
      requestId: metadata.requestId,
      location: locationName,
      code: err.code ?? 'UNKNOWN',
    })
    return {
      available: false,
      current: null,
      forecast: [],
      provider: providerName,
      isDemo: config.providers.useMocks,
      error: err.message,
    }
  }
}

// ── Market evidence adapter ───────────────────────────────────────────────────

/**
 * Collect market evidence for a specific crop.
 * Uses the same MarketProvider and cache as MarketAgent.
 *
 * Returns pre-computed price statistics — the scoring engine
 * uses these values directly without re-computing.
 *
 * @param {object} params
 * @param {string} params.commodityName - Market commodity name (from CropProfile.marketCommodityName)
 * @param {object} params.location - { state, district }
 * @param {object} [params.metadata={}]
 * @returns {Promise<{
 *   available: boolean,
 *   statistics: object|null,
 *   trend: object|null,
 *   isDemo: boolean,
 *   error: string|null
 * }>}
 */
export async function collectMarketEvidence({ commodityName, location, metadata = {} }) {
  if (!commodityName) {
    return { available: false, statistics: null, trend: null, isDemo: false, error: 'No commodity name' }
  }

  try {
    const marketProvider = getMarketProvider()
    const state = location?.state ?? null
    const district = location?.district ?? null

    const cacheKey = buildMarketCacheKey({
      provider: config.providers.useMocks ? 'mock-market' : 'agmarknet',
      commodity: commodityName,
      state,
      district,
    })
    let providerData = getMarketFromCache(cacheKey)

    if (!providerData) {
      providerData = await marketProvider.getPrices({
        commodity: commodityName,
        state,
        district,
        maxRecords: config.market.maxRecords,
      })
      setMarketInCache(cacheKey, providerData)
    }

    const records = providerData?.records ?? []
    if (records.length === 0) {
      return {
        available: true,
        statistics: null,
        trend: null,
        isDemo: providerData?.isDemo === true,
        error: null,
      }
    }

    const statistics = calculatePriceStatistics(records)
    const trend = calculateTrend(records)

    return {
      available: true,
      statistics,
      trend,
      recordCount: records.length,
      isDemo: providerData?.isDemo === true,
      error: null,
    }
  } catch (err) {
    logger.warn('CropEvidenceService: market collection failed', {
      requestId: metadata.requestId,
      commodity: commodityName,
      code: err.code ?? 'UNKNOWN',
    })
    return {
      available: false,
      statistics: null,
      trend: null,
      isDemo: config.providers.useMocks,
      error: err.message,
    }
  }
}

// ── RAG knowledge evidence adapter ───────────────────────────────────────────

/**
 * Retrieve agronomic knowledge chunks for a specific crop from the RAG pipeline.
 *
 * @param {object} params
 * @param {string} params.cropName - Name of the crop
 * @param {string} [params.season] - Optional season context
 * @param {object} [params.metadata={}]
 * @returns {Promise<{
 *   available: boolean,
 *   retrieved: boolean,
 *   relevantChunkCount: number,
 *   sources: object[],
 *   topChunks: object[],
 *   error: string|null
 * }>}
 */
export async function collectKnowledgeEvidence({ cropName, season = null, metadata = {} }) {
  const query = season
    ? `${cropName} cultivation ${season} season India agronomy`
    : `${cropName} cultivation India agronomy suitability`

  try {
    const result = await searchKnowledge({
      query,
      topK: config.crop.ragTopK,
      filters: { category: 'knowledge/crop-guides' },
    })

    // Fallback: if no results with crop category, search broadly
    let chunks = result.results ?? []
    if (chunks.length === 0) {
      const broadResult = await searchKnowledge({
        query,
        topK: config.crop.ragTopK,
      })
      chunks = broadResult.results ?? []
    }

    const relevantChunkCount = chunks.length
    const sources = chunks.map((c) => ({
      title: c.source?.title ?? 'Agronomic Knowledge Base',
      organization: c.source?.organization ?? null,
      documentDate: c.source?.documentDate ?? null,
      score: c.score,
    }))

    return {
      available: true,
      retrieved: relevantChunkCount > 0,
      relevantChunkCount,
      sources,
      topChunks: chunks.slice(0, 3).map((c) => ({ text: c.textPreview, score: c.score })),
      error: null,
    }
  } catch (err) {
    logger.warn('CropEvidenceService: RAG knowledge collection failed', {
      requestId: metadata.requestId,
      crop: cropName,
      code: err.code ?? 'UNKNOWN',
    })
    return {
      available: false,
      retrieved: false,
      relevantChunkCount: 0,
      sources: [],
      topChunks: [],
      error: err.message,
    }
  }
}

// ── Scheme evidence adapter ───────────────────────────────────────────────────

/**
 * Check whether relevant government schemes exist for the farmer's context.
 * Not per-crop — a shared signal across all candidates.
 *
 * @param {object} params
 * @param {object} params.farmerContext
 * @param {object} [params.metadata={}]
 * @returns {Promise<{
 *   available: boolean,
 *   hasRelevantSchemes: boolean,
 *   schemeCount: number,
 *   schemeNames: string[],
 *   isDemo: boolean,
 *   error: string|null
 * }>}
 */
export async function collectSchemeEvidence({ farmerContext, metadata = {} }) {
  try {
    const { candidates, warnings } = await findCandidates({
      farmerContext,
      categories: ['crop-insurance', 'input-subsidy', 'irrigation', 'market-support'],
    })

    const hasRelevantSchemes = candidates.length > 0

    return {
      available: true,
      hasRelevantSchemes,
      schemeCount: candidates.length,
      schemeNames: candidates.slice(0, 3).map((s) => s.shortName ?? s.name),
      isDemo: candidates.some((s) => s.isDemo),
      warnings,
      error: null,
    }
  } catch (err) {
    logger.warn('CropEvidenceService: scheme collection failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    return {
      available: false,
      hasRelevantSchemes: false,
      schemeCount: 0,
      schemeNames: [],
      isDemo: config.providers.useMocks,
      error: err.message,
    }
  }
}

// ── Parallel evidence collection orchestrator ─────────────────────────────────

/**
 * Collect all evidence in parallel for a set of crop candidates.
 * Failures in individual adapters do NOT stop the overall collection.
 *
 * @param {object} params
 * @param {object[]} params.candidates - CropProfile objects
 * @param {object} params.farmerContext
 * @param {string|null} params.season
 * @param {object} [params.metadata={}]
 * @returns {Promise<{
 *   weatherEvidence: object,
 *   marketEvidenceMap: object,      — { cropCode: marketEvidence }
 *   knowledgeEvidenceMap: object,   — { cropCode: knowledgeEvidence }
 *   schemeEvidence: object,
 *   collectionWarnings: string[]
 * }>}
 */
export async function collectAllEvidence({ candidates, farmerContext, season, metadata = {}, collectSchemes = false }) {
  const { location } = farmerContext
  const collectionWarnings = []

  // Collect weather + (optionally) scheme in parallel — shared across all crops.
  // Scheme collection is skipped unless the caller explicitly requests it
  // (i.e. the farmer's message contains scheme/subsidy keywords).
  const sharedTasks = [collectWeatherEvidence({ location, metadata })]
  if (collectSchemes) {
    sharedTasks.push(collectSchemeEvidence({ farmerContext, metadata }))
  }

  const sharedResults = await Promise.all(sharedTasks)
  const weatherEvidence = sharedResults[0]
  const schemeEvidence = collectSchemes
    ? sharedResults[1]
    : { available: false, hasRelevantSchemes: false, schemeCount: 0, schemeNames: [], isDemo: false, error: null }

  if (!weatherEvidence.available) {
    collectionWarnings.push('Weather data could not be retrieved — weather suitability not evaluated')
  }
  // Only warn about schemes if they were actually requested
  if (collectSchemes && !schemeEvidence.available) {
    collectionWarnings.push('Government scheme data could not be retrieved')
  }

  // Collect market + knowledge for each candidate in parallel
  const perCropResults = await Promise.all(
    candidates.map(async (crop) => {
      const [market, knowledge] = await Promise.all([
        collectMarketEvidence({
          commodityName: crop.marketCommodityName,
          location,
          metadata,
        }),
        collectKnowledgeEvidence({ cropName: crop.name, season, metadata }),
      ])
      return { cropCode: crop.cropCode, market, knowledge }
    })
  )

  const marketEvidenceMap = {}
  const knowledgeEvidenceMap = {}

  for (const { cropCode, market, knowledge } of perCropResults) {
    marketEvidenceMap[cropCode] = market
    knowledgeEvidenceMap[cropCode] = knowledge
  }

  return {
    weatherEvidence,
    marketEvidenceMap,
    knowledgeEvidenceMap,
    schemeEvidence,
    collectionWarnings,
  }
}
