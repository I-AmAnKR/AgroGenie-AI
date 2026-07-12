/**
 * Real Market Provider — Phase 11.
 *
 * Uses the data.gov.in Open Government Data (OGD) Platform API to fetch
 * Agmarknet (Agricultural Marketing) price records for Indian mandis.
 *
 * Data source:
 *   Name:        Agmarknet Daily Commodity Prices
 *   URL:         https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi
 *   Resource ID: 9ef84268-d588-465a-a308-a864a43d0070 (configurable via env)
 *   Auth:        API key in Authorization header (required for real mode)
 *
 * API documentation:
 *   Base URL:    https://api.data.gov.in/resource/{resource-id}
 *   Parameters:  api-version=2.0, format=json, limit, offset, filters[]
 *   Filter format: filters[field]=value
 *   Response:    { records: [...], total, count, offset }
 *   Date field:  arrival_date (DD/MM/YYYY)
 *   Price unit:  INR per quintal (all Agmarknet records)
 *
 * Authentication:
 *   Header: api-key: {MARKET_API_KEY}
 *   OR: query param api-key={MARKET_API_KEY}
 *   Obtain key at: https://data.gov.in/developers
 *
 * Normalization:
 *   All raw API records are normalized via marketNormalizer.service.js before
 *   leaving this provider. No raw API objects are ever passed to agents.
 *
 * Error handling:
 *   All HTTP errors mapped to typed MARKET_* errors.
 *   No raw API error objects or credentials propagated.
 *
 * No silent mock fallback: if real mode fails, a typed error is thrown.
 *
 * Interface:
 *   getPrices({ commodity, state, district, market, fromDate, toDate, limit })
 *   searchCommodities({ query })
 *   compareMarkets({ commodity, state, district, dateRange })
 *   checkReadiness()
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'
import { normalizeAgmarknetRecords, normalizeDate } from '../services/marketNormalizer.service.js'

// ── HTTP fetch helper ────────────────────────────────────────────────────────

/**
 * Fetch a URL with configurable timeout using AbortController.
 *
 * @param {string} url
 * @param {object} options - fetch options
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────────

/**
 * Map a fetch/HTTP error to a typed application-level MARKET_* error.
 * Never exposes raw response bodies or credentials.
 *
 * @param {Error|object} err
 * @returns {Error}
 */
function mapMarketError(err) {
  const appErr = new Error()
  const msg = (err.message ?? '').toLowerCase()
  const status = err._httpStatus ?? 0

  if (msg.includes('abort') || msg.includes('timeout')) {
    appErr.code = 'MARKET_TIMEOUT'
    appErr.statusCode = 504
    appErr.message = 'Market data provider request timed out. Please try again.'
    return appErr
  }
  if (status === 401 || status === 403) {
    appErr.code = 'MARKET_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Market data provider authentication failed. Check MARKET_API_KEY.'
    return appErr
  }
  if (status === 404) {
    appErr.code = 'MARKET_NO_DATA'
    appErr.statusCode = 404
    appErr.message = 'No market data found for the specified query.'
    return appErr
  }
  if (status === 429) {
    appErr.code = 'MARKET_RATE_LIMIT'
    appErr.statusCode = 429
    appErr.message = 'Market data provider rate limit reached. Please wait and try again.'
    return appErr
  }
  if (status >= 500) {
    appErr.code = 'MARKET_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Market data provider is temporarily unavailable.'
    return appErr
  }
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
    appErr.code = 'MARKET_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Cannot reach market data provider. Check internet connection.'
    return appErr
  }

  appErr.code = 'MARKET_PROVIDER_UNAVAILABLE'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred while fetching market data.'
  return appErr
}

// ── API request helper ────────────────────────────────────────────────────────

/**
 * Build the data.gov.in OGD API URL and fetch records.
 *
 * @param {object} params
 * @param {string} params.commodity
 * @param {string|null} [params.state]
 * @param {string|null} [params.district]
 * @param {string|null} [params.market]
 * @param {string|null} [params.fromDate]   - YYYY-MM-DD
 * @param {string|null} [params.toDate]     - YYYY-MM-DD
 * @param {number} [params.limit]
 * @returns {Promise<object[]>} Raw record array from API
 */
async function fetchAgmarknetRecords({ commodity, state, district, market, fromDate, toDate, limit }) {
  const { apiUrl, apiKey, resourceId, requestTimeoutMs, maxRecords } = config.market

  if (!apiKey) {
    const err = new Error('MARKET_API_KEY is required for real market data provider.')
    err.code = 'MARKET_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  const requestLimit = Math.min(limit ?? maxRecords, maxRecords)

  // Build query params
  const params = new URLSearchParams({
    'api-version': '2.0',
    format: 'json',
    limit: String(requestLimit),
    offset: '0',
  })

  // Add field filters — data.gov.in uses filters[field_name]=value
  if (commodity) params.append('filters[commodity]', commodity)
  if (state) params.append('filters[state]', state)
  if (district) params.append('filters[district]', district)
  if (market) params.append('filters[market]', market)

  // Date range — Agmarknet uses arrival_date in DD/MM/YYYY format
  // We accept YYYY-MM-DD internally and convert for the API
  if (fromDate) {
    const parts = fromDate.split('-')
    if (parts.length === 3) {
      params.append('filters[arrival_date]', `${parts[2]}/${parts[1]}/${parts[0]}`)
    }
  }

  const url = `${apiUrl}/${resourceId}?${params.toString()}`

  logger.debug('MarketProvider: fetching data.gov.in Agmarknet', {
    commodity, state, district, market, limit: requestLimit,
    // Never log the API key
  })

  let response
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          'api-key': apiKey,
          Accept: 'application/json',
        },
      },
      requestTimeoutMs
    )
  } catch (err) {
    throw mapMarketError(err)
  }

  if (!response.ok) {
    const httpErr = new Error(`data.gov.in HTTP ${response.status}`)
    httpErr._httpStatus = response.status
    throw mapMarketError(httpErr)
  }

  let json
  try {
    json = await response.json()
  } catch {
    const parseErr = new Error('Failed to parse market data provider response')
    parseErr.code = 'MARKET_RESPONSE_ERROR'
    parseErr.statusCode = 502
    throw parseErr
  }

  const records = json.records ?? json.data ?? json.result ?? []
  if (!Array.isArray(records)) {
    logger.warn('MarketProvider: unexpected response shape', {
      responseKeys: Object.keys(json).join(', '),
    })
    return []
  }

  logger.info('MarketProvider: records received', {
    commodity, state, district,
    total: json.total ?? json.count,
    returned: records.length,
    isDemo: false,
  })

  return records
}

// ── Provider export ──────────────────────────────────────────────────────────

export const realMarketProvider = {
  /**
   * Get mandi price records for a commodity and location.
   *
   * @param {object} params
   * @param {string} params.commodity - Canonical commodity name
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {string|null} [params.market] - Specific mandi name
   * @param {string|null} [params.fromDate] - YYYY-MM-DD
   * @param {string|null} [params.toDate] - YYYY-MM-DD
   * @param {number} [params.limit]
   * @returns {Promise<object>} { isDemo, provider, fetchedAt, records }
   */
  async getPrices({ commodity, state, district, market, fromDate, toDate, limit } = {}) {
    const fetchedAt = new Date().toISOString()
    const rawRecords = await fetchAgmarknetRecords({ commodity, state, district, market, fromDate, toDate, limit })

    const providerMeta = { provider: 'agmarknet-datagov', fetchedAt, isDemo: false }
    const records = normalizeAgmarknetRecords(rawRecords, providerMeta)

    return {
      isDemo: false,
      provider: 'agmarknet-datagov',
      fetchedAt,
      records,
    }
  },

  /**
   * Search for records matching a commodity query.
   *
   * @param {object} params
   * @param {string} params.query - Commodity search term
   * @returns {Promise<object>}
   */
  async searchCommodities({ query } = {}) {
    return this.getPrices({ commodity: query, limit: 20 })
  },

  /**
   * Compare prices for a commodity across markets in a state/district.
   *
   * @param {object} params
   * @param {string} params.commodity
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {number} [params.limit]
   * @returns {Promise<object>}
   */
  async compareMarkets({ commodity, state, district, limit } = {}) {
    return this.getPrices({ commodity, state, district, limit: limit ?? config.market.maxRecords })
  },

  /**
   * Readiness check — validates configuration without a live API call.
   *
   * @returns {Promise<{ ready: boolean, provider: string, isDemo: boolean, reason?: string }>}
   */
  async checkReadiness() {
    const { apiUrl, apiKey, resourceId } = config.market
    if (!apiUrl) return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_URL not configured' }
    if (!apiKey) return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_KEY not configured' }
    if (!resourceId) return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_RESOURCE_ID not configured' }
    return { ready: true, provider: 'agmarknet-datagov', isDemo: false }
  },
}
