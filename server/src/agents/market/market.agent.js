/**
 * Market Agent — Phase 11.
 *
 * Replaces the Phase 9 placeholder with a full live implementation.
 *
 * Flow:
 *   1. Receive farmer message + FarmerProfile context
 *   2. Extract and normalize commodity from message
 *   3. Resolve location (mandi → district/state → profile → clarification)
 *   4. Detect market query type
 *   5. Check market cache
 *   6. Fetch market data from Market Provider (real or mock)
 *   7. Normalize records
 *   8. Validate freshness
 *   9. Calculate deterministic price statistics and trend
 *  10. Call IBM Granite for practical agricultural explanation
 *  11. Return normalized Agent Result with market data and source metadata
 *
 * Safety rules:
 *   - NEVER invent prices, mandi names, dates, or arrivals.
 *   - NEVER call Granite if market data retrieval fails.
 *   - NEVER let Granite calculate price statistics.
 *   - NEVER silently fall back to mock data in real mode.
 *   - NEVER fabricate if no commodity can be identified — request clarification.
 *   - All Granite inputs are pre-computed deterministic values.
 *
 * The Agent Router selects this agent for MARKET intent.
 * Controllers must not call this agent directly.
 */
import { getMarketProvider } from '../../providers/market.provider.factory.js'
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { extractCommodityFromMessage } from '../../services/commodityNormalizer.service.js'
import { resolveMarketLocation } from '../../services/marketLocationResolver.service.js'
import { classifyRecordsFreshness, FRESHNESS } from '../../services/marketFreshness.service.js'
import { calculatePriceStatistics, calculateTrend, findBestReportedMarket } from '../../services/marketAnalytics.service.js'
import { buildMarketCacheKey, getMarketFromCache, setMarketInCache } from '../../services/marketCache.service.js'
import { buildMarketAgentSystemPrompt, buildMarketAgentUserMessage } from './market.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import config from '../../config/env.js'
import logger from '../../utils/logger.js'

// ── Market query type detection ───────────────────────────────────────────────

/**
 * Supported market query types.
 */
export const MARKET_QUERY_TYPES = {
  CURRENT_PRICE: 'CURRENT_PRICE',
  LATEST_AVAILABLE_PRICE: 'LATEST_AVAILABLE_PRICE',
  MARKET_COMPARISON: 'MARKET_COMPARISON',
  PRICE_RANGE: 'PRICE_RANGE',
  PRICE_TREND: 'PRICE_TREND',
  BEST_REPORTED_MARKET: 'BEST_REPORTED_MARKET',
  COMMODITY_SEARCH: 'COMMODITY_SEARCH',
}

const QUERY_TYPE_PATTERNS = {
  PRICE_TREND: [
    /\b(rising|falling|up|down|increasing|decreasing|trend|movement)\b/i,
    /\b(are|is).*price.*(going|rising|falling|up|down)\b/i,
    /\bprice.*trend\b/i,
    /\bkya.*bhadh\b/i,
    /\bkya.*gir\b/i,
  ],
  BEST_REPORTED_MARKET: [
    /\bwhich.*\b(mandi|market)\b.*\bhighest\b/i,
    /\bwhere.*\b(sell|selling)\b.*\bbest\b/i,
    /\b(best|highest|maximum|top)\b.*\bprice\b/i,
  ],
  MARKET_COMPARISON: [
    /\bcompare\b/i,
    /\b(cheapest|most expensive|lowest)\b.*\b(mandi|market|price)\b/i,
    /\b(mandi|market|price)\b.*\b(cheapest|lowest)\b/i,
    /\bacross.*\b(mandi|market)\b/i,
    /\bdifferent.*(mandi|market)\b/i,
  ],
  PRICE_RANGE: [
    /\b(min|max|minimum|maximum|range)\b.*\bprice\b/i,
    /\bprice\s*(range|spread|variation)\b/i,
  ],
  CURRENT_PRICE: [
    /\b(today|current|aaj|abhi|right now|this moment)\b.*\bprice\b/i,
    /\bprice\b.*\b(today|current|aaj)\b/i,
    /\bhow much\b.*\b(today|now|current)\b/i,
  ],
  COMMODITY_SEARCH: [
    /\b(do you have|is there|available|data for)\b.*\bprice\b/i,
    /\bprice data\b/i,
  ],
}

/**
 * Detect the market query type from the farmer's message.
 *
 * @param {string} message
 * @returns {string} MARKET_QUERY_TYPES key
 */
export function detectMarketQueryType(message) {
  for (const [queryType, patterns] of Object.entries(QUERY_TYPE_PATTERNS)) {
    if (patterns.some((p) => p.test(message))) {
      return queryType
    }
  }
  return MARKET_QUERY_TYPES.LATEST_AVAILABLE_PRICE
}

// ── Granite advisory call ─────────────────────────────────────────────────────

/**
 * Call IBM Granite to generate a practical explanation of market data.
 * Only called after successful data retrieval and statistics calculation.
 *
 * @param {object} params
 * @returns {Promise<{ content, model, provider, isDemo }>}
 */
async function callGraniteMarketAdvisory({
  message,
  records,
  statistics,
  trend,
  freshness,
  commodity,
  resolvedLocation,
  queryType,
  language = 'en',
  isDemo = false,
  memoryContext = null,
  metadata = {},
}) {
  const aiProvider = getAiProvider()
  const systemPrompt = buildMarketAgentSystemPrompt(language)
  const userMessage = buildMarketAgentUserMessage({
    message,
    records,
    statistics,
    trend,
    freshness,
    commodity,
    resolvedLocation,
    queryType,
    memoryContext,
    isDemo,
  })

  return aiProvider.generate({
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt,
    parameters: {
      max_tokens: 800,
      temperature: 0.2,
      top_p: 0.9,
    },
    metadata,
  })
}

// ── Source metadata builder ───────────────────────────────────────────────────

/**
 * Build the sources array from market records and fetch metadata.
 *
 * @param {object[]} records
 * @param {string} providerName
 * @param {string} fetchedAt
 * @param {object} freshness
 * @param {boolean} cacheHit
 * @returns {object[]}
 */
function buildMarketSources(records, providerName, fetchedAt, freshness, cacheHit) {
  // Deduplicate by market+date for sources
  const seen = new Set()
  const sources = []
  for (const r of records) {
    const key = `${r.market}:${r.priceDate}`
    if (!seen.has(key)) {
      seen.add(key)
      sources.push({
        sourceType: 'market_api',
        provider: r.metadata?.provider ?? providerName,
        commodity: r.commodity,
        market: r.market,
        district: r.district,
        state: r.state,
        priceDate: r.priceDate,
        fetchedAt: r.metadata?.fetchedAt ?? fetchedAt,
        isDemo: r.metadata?.isDemo === true,
        cacheHit,
      })
    }
  }
  return sources.slice(0, 10) // Cap sources to avoid oversized responses
}

// ── Fallback answer builder ───────────────────────────────────────────────────

/**
 * Build a factual-only answer when Granite is unavailable.
 * Only uses values from verified records — never fabricates.
 *
 * @param {object[]} records
 * @param {object} statistics
 * @param {object} freshness
 * @param {string} commodityName
 * @param {object|null} resolvedLocation
 * @param {boolean} isDemo
 * @returns {string}
 */
function buildFallbackAnswer(records, statistics, freshness, commodityName, resolvedLocation, isDemo) {
  const lines = []

  if (isDemo) {
    lines.push('⚠️ **Demonstration data** — prices below are sample data for testing.')
    lines.push('')
  }

  lines.push(`**${commodityName} — Market Price Data**`)
  if (resolvedLocation?.locationName) {
    lines.push(`Location: ${resolvedLocation.locationName}`)
  }
  lines.push(`Data date: ${freshness.latestDate ?? 'Unknown'} (${freshness.label})`)
  lines.push('')

  if (statistics.recordsAnalyzed > 0) {
    lines.push(`**Price summary (${statistics.recordsAnalyzed} record${statistics.recordsAnalyzed !== 1 ? 's' : ''}, ${statistics.marketsCompared} mandi${statistics.marketsCompared !== 1 ? 's' : ''}):**`)
    if (statistics.minReportedPrice !== null) lines.push(`- Minimum price: ₹${statistics.minReportedPrice}/quintal`)
    if (statistics.maxReportedPrice !== null) lines.push(`- Maximum price: ₹${statistics.maxReportedPrice}/quintal`)
    if (statistics.averageModalPrice !== null) lines.push(`- Average modal price: ₹${statistics.averageModalPrice}/quintal`)
    lines.push('')

    // List individual market records
    if (records.length > 0) {
      lines.push('**Individual mandi prices:**')
      for (const r of records.slice(0, 5)) {
        const priceStr = r.modalPrice !== null
          ? `₹${r.modalPrice}/quintal (modal)`
          : r.minPrice !== null && r.maxPrice !== null
            ? `₹${r.minPrice}–₹${r.maxPrice}/quintal`
            : 'Price not available'
        lines.push(`- ${r.market} (${r.district}): ${priceStr}`)
      }
    }
  } else {
    lines.push('No price records available for the specified query.')
  }

  lines.push('')
  lines.push('*Market prices may vary by quality grade, transaction conditions, and timing. Do not rely on this data for selling decisions.*')

  return lines.join('\n')
}

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run the Market Agent.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's market price question
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runMarketAgent({ message, farmerContext = {}, memoryContext = null, language = 'en', metadata = {} }) {
  const start = Date.now()
  logger.info('MarketAgent: starting', { requestId: metadata.requestId })

  // ── Step 1: Extract commodity ─────────────────────────────────────────
  const commodity = extractCommodityFromMessage(message)

  if (!commodity.found) {
    logger.info('MarketAgent: no commodity identified — requesting clarification', {
      requestId: metadata.requestId,
    })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.MARKET,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer:
          "I'd like to help with market prices, but I couldn't identify which commodity you're asking about. " +
          'Could you please specify the crop or commodity? For example: "What is today\'s tomato price?" or ' +
          '"What is the current wheat price in Karnal?"',
        agentsUsed: ['MarketAgent'],
        sources: [],
        grounded: false,
        missingInformation: ['Commodity name (e.g., Tomato, Wheat, Onion, Rice)'],
        warnings: [],
        isDemo: config.providers.useMocks,
        provider: null,
      })
    )
  }

  logger.debug('MarketAgent: commodity identified', {
    requestId: metadata.requestId,
    userInput: commodity.userInput,
    canonical: commodity.canonicalName,
  })

  // ── Step 2: Resolve location ──────────────────────────────────────────
  const resolvedLocation = resolveMarketLocation({ message, farmerContext, metadata })

  // ── Step 3: Detect query type ─────────────────────────────────────────
  const queryType = detectMarketQueryType(message)
  logger.debug('MarketAgent: query type detected', {
    requestId: metadata.requestId,
    queryType,
    location: resolvedLocation?.locationName ?? 'none',
  })

  // ── Step 4: Check market cache ────────────────────────────────────────
  const providerName = config.providers.useMocks ? 'mock-market' : 'agmarknet-datagov'
  const cacheKey = buildMarketCacheKey({
    provider: providerName,
    commodity: commodity.canonicalName,
    state: resolvedLocation?.state ?? null,
    district: resolvedLocation?.district ?? null,
    market: resolvedLocation?.market ?? null,
    queryType,
  })

  let providerResult = getMarketFromCache(cacheKey)
  let cacheUsed = false

  if (providerResult) {
    cacheUsed = true
    logger.info('MarketAgent: serving from cache', {
      requestId: metadata.requestId,
      cacheKey,
    })
  } else {
    // ── Step 5: Fetch market data ─────────────────────────────────────
    let marketProvider
    try {
      marketProvider = getMarketProvider()
    } catch (err) {
      logger.error('MarketAgent: market provider configuration error', {
        requestId: metadata.requestId,
        code: err.code ?? 'UNKNOWN',
      })
      return normalizeAgentResult(
        createAgentResult({
          intent: INTENT.MARKET,
          status: RESULT_STATUS.FAILED,
          answer:
            'Market data is not configured. Set USE_MOCK_PROVIDERS=true for demo data or configure MARKET_API_KEY for live data.',
          agentsUsed: ['MarketAgent'],
          sources: [],
          grounded: false,
          warnings: ['Market provider configuration error.'],
          isDemo: false,
          provider: null,
        })
      )
    }

    try {
      // For trend queries, request historical records
      if (queryType === MARKET_QUERY_TYPES.PRICE_TREND && typeof marketProvider.getTrend === 'function') {
        providerResult = await marketProvider.getTrend({
          commodity: commodity.canonicalName,
          market: resolvedLocation?.market ?? null,
        })
      } else if (queryType === MARKET_QUERY_TYPES.MARKET_COMPARISON || queryType === MARKET_QUERY_TYPES.BEST_REPORTED_MARKET) {
        providerResult = await marketProvider.compareMarkets({
          commodity: commodity.canonicalName,
          state: resolvedLocation?.state ?? null,
          district: resolvedLocation?.district ?? null,
        })
      } else {
        providerResult = await marketProvider.getPrices({
          commodity: commodity.canonicalName,
          state: resolvedLocation?.state ?? null,
          district: resolvedLocation?.district ?? null,
          market: resolvedLocation?.market ?? null,
          limit: config.market.maxRecords,
        })
      }

      // Store in cache (only if we got records)
      if (providerResult?.records?.length > 0) {
        setMarketInCache(cacheKey, providerResult)
      }

      logger.info('MarketAgent: data fetched', {
        requestId: metadata.requestId,
        provider: providerResult.provider,
        recordCount: providerResult.records?.length ?? 0,
        isDemo: providerResult.isDemo,
      })
    } catch (err) {
      logger.error('MarketAgent: market provider failed', {
        requestId: metadata.requestId,
        code: err.code ?? 'UNKNOWN',
        commodity: commodity.canonicalName,
        location: resolvedLocation?.locationName,
      })

      const errorMessages = {
        MARKET_CONFIGURATION_ERROR: 'Market data service is not properly configured.',
        MARKET_AUTH_ERROR: 'There is an authentication issue with the market data service.',
        MARKET_TIMEOUT: 'The market data service took too long to respond. Please try again.',
        MARKET_RATE_LIMIT: 'The market data service is busy. Please try again in a few minutes.',
        MARKET_PROVIDER_UNAVAILABLE: 'The market data service is temporarily unavailable.',
        MARKET_NO_DATA: `No market data found for ${commodity.canonicalName}${resolvedLocation ? ' in ' + resolvedLocation.locationName : ''}.`,
        MARKET_RESPONSE_ERROR: "The market data service returned an unexpected response.",
      }
      const userMessage =
        errorMessages[err.code] ??
        `I couldn't retrieve verified market-price data for ${commodity.canonicalName} right now. Please try again shortly.`

      return normalizeAgentResult(
        createAgentResult({
          intent: INTENT.MARKET,
          status: RESULT_STATUS.FAILED,
          answer: userMessage,
          agentsUsed: ['MarketAgent'],
          sources: [],
          grounded: false,
          warnings: ['Market data retrieval failed.'],
          isDemo: config.providers.useMocks,
          provider: null,
        })
      )
    }
  }

  // ── Step 6: Handle no data ────────────────────────────────────────────
  const records = providerResult?.records ?? []
  const isDemo = providerResult?.isDemo === true
  const fetchedAt = providerResult?.fetchedAt ?? new Date().toISOString()

  if (records.length === 0) {
    logger.info('MarketAgent: no records found', {
      requestId: metadata.requestId,
      commodity: commodity.canonicalName,
      location: resolvedLocation?.locationName,
    })

    const noDataMsg = resolvedLocation
      ? `No market-price records were found for **${commodity.canonicalName}** in **${resolvedLocation.locationName}**. ` +
        `The commodity may not be traded at the specified location, or recent data may not be available. ` +
        `Please check agmarknet.gov.in or your local APMC portal for the latest prices.`
      : `No market-price records were found for **${commodity.canonicalName}**. ` +
        `Please check agmarknet.gov.in or your local APMC portal.`

    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.MARKET,
        status: RESULT_STATUS.SUCCESS,
        answer: noDataMsg,
        agentsUsed: ['MarketAgent', `Market Provider (${providerName})`],
        sources: [],
        grounded: false,
        warnings: ['No market records were available for this query.'],
        isDemo,
        provider: null,
        market: {
          commodity: commodity.canonicalName,
          records: [],
          statistics: {},
          trend: {},
          freshness: { category: 'unknown', latestDate: null, label: 'No data' },
        },
      })
    )
  }

  // ── Step 7: Freshness classification ─────────────────────────────────
  const freshness = classifyRecordsFreshness(records)

  // ── Step 8: Calculate price statistics ───────────────────────────────
  const statistics = calculatePriceStatistics(records)

  // ── Step 9: Calculate trend ───────────────────────────────────────────
  const trend = calculateTrend(records)

  // ── Step 10: Find best reported market (for BEST_REPORTED_MARKET type) 
  const bestMarket = findBestReportedMarket(records)

  logger.debug('MarketAgent: analytics complete', {
    requestId: metadata.requestId,
    recordsAnalyzed: statistics.recordsAnalyzed,
    marketsCompared: statistics.marketsCompared,
    trendStatus: trend.trendStatus,
    freshness: freshness.category,
    isDemo,
  })

  // ── Step 11: Call Granite for explanation ─────────────────────────────
  let aiResult
  try {
    aiResult = await callGraniteMarketAdvisory({
      message,
      records,
      statistics,
      trend,
      freshness,
      commodity,
      resolvedLocation,
      queryType,
      language,
      isDemo,
      memoryContext,
      metadata,
    })
  } catch (err) {
    logger.error('MarketAgent: Granite advisory failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })

    const fallbackAnswer = buildFallbackAnswer(records, statistics, freshness, commodity.canonicalName, resolvedLocation, isDemo)
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.MARKET,
        status: RESULT_STATUS.PARTIAL_SUCCESS,
        answer: fallbackAnswer,
        agentsUsed: ['MarketAgent', `Market Provider (${providerName})`, 'Market Analytics'],
        sources: buildMarketSources(records, providerName, fetchedAt, freshness, cacheUsed),
        grounded: true,
        warnings: [
          'AI explanation unavailable. Price data shown without advisory interpretation.',
          'Market prices may vary by quality, grade, and transaction conditions.',
        ],
        isDemo,
        provider: null,
        market: { commodity: commodity.canonicalName, records, statistics, trend, freshness },
      })
    )
  }

  const durationMs = Date.now() - start
  logger.info('MarketAgent: complete', {
    requestId: metadata.requestId,
    queryType,
    commodity: commodity.canonicalName,
    location: resolvedLocation?.locationName,
    recordCount: records.length,
    freshness: freshness.category,
    cacheUsed,
    isDemo,
    durationMs,
  })

  // ── Step 12: Build normalized result ─────────────────────────────────
  const agentsUsed = [
    'MarketAgent',
    `Market Provider (${providerResult.provider ?? providerName})`,
    'Market Analytics',
    aiResult.isDemo ? 'Mock AI' : 'IBM Granite',
  ]

  const warnings = [
    'Market prices may vary by quality grade, transaction conditions, and timing.',
  ]
  if (isDemo) {
    warnings.unshift('Demonstration data — not live mandi prices. Set USE_MOCK_PROVIDERS=false and configure MARKET_API_KEY for live data.')
  }
  if (freshness.category === FRESHNESS.STALE) {
    warnings.push(`Price data is ${freshness.ageInDays} days old. For current prices, check agmarknet.gov.in.`)
  }

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.MARKET,
      status: RESULT_STATUS.SUCCESS,
      answer: aiResult.content,
      agentsUsed,
      sources: buildMarketSources(records, providerName, fetchedAt, freshness, cacheUsed),
      grounded: true,
      missingInformation: [],
      warnings,
      provider: aiResult.provider ?? null,
      model: aiResult.model ?? null,
      isDemo,
      // Attach normalized market data for frontend rendering
      market: {
        commodity: commodity.canonicalName,
        records,
        statistics,
        trend,
        freshness,
        bestMarket: bestMarket ?? null,
      },
    })
  )
}
