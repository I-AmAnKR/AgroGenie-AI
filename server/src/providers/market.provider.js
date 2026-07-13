/**
 * Real Market Provider — Phase 11 (rev 2).
 *
 * Uses the data.gov.in Open Government Data (OGD) Platform API to fetch
 * Agmarknet (Agricultural Marketing) price records for Indian mandis.
 *
 * Root-cause fixes applied in this revision:
 *
 *   Fix 1 — API key must be a QUERY PARAMETER, not a header.
 *     The data.gov.in OGD API v2.0 authenticates via `?api-key=<value>` in
 *     the URL.  Sending it as a custom HTTP header (`api-key: <value>`) is
 *     silently ignored by the gateway; the response arrives as HTTP 200 with
 *     a JSON error payload: `{ "message": "Invalid api_key" }`.  Because the
 *     status is 200, response.ok is true, the body is not an error record
 *     array, json.records is undefined, normalizeAgmarknetRecords returns [],
 *     and the agent sees zero records.  On Render's proxied egress to
 *     api.data.gov.in the gateway also returns HTTP 403 or a TLS reset,
 *     which maps to MARKET_PROVIDER_UNAVAILABLE.
 *
 *   Fix 2 — Filter brackets must be LITERAL, not percent-encoded.
 *     `new URLSearchParams()` encodes `[` → `%5B` and `]` → `%5D`.
 *     data.gov.in requires literal brackets:  `filters[commodity]=Tomato`.
 *     When the brackets are encoded the API treats the entire key as an
 *     unknown parameter and applies no filter, returning all 100 records
 *     across all commodities and states.  After normalization these records
 *     are filtered by normalizeAgmarknetRecords (commodity must be present)
 *     resulting in mismatched or zero records for the requested commodity.
 *     Fix: build the query string manually as a plain string concatenation
 *     so brackets are never encoded.
 *
 *   Fix 3 — Granular error codes.
 *     data.gov.in returns HTTP 200 with a JSON error body for auth failures,
 *     unknown resource IDs, and rate limits.  The previous code only checked
 *     response.ok and threw a generic MARKET_PROVIDER_UNAVAILABLE.  Fix:
 *     inspect the parsed JSON body for known error message strings and map
 *     them to specific codes: MARKET_API_KEY_INVALID, MARKET_RESOURCE_NOT_FOUND,
 *     MARKET_RATE_LIMIT, MARKET_NO_DATA, MARKET_RESPONSE_PARSE_ERROR,
 *     MARKET_NETWORK_ERROR.
 *
 *   Fix 4 — Production-grade logging at every network boundary.
 *     Added: full request URL (key redacted), response HTTP status, raw
 *     response body, parsed JSON structure, and error stack on every path.
 *
 * Data source:
 *   Name:        Agmarknet Daily Commodity Prices
 *   URL:         https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi
 *   Resource ID: 9ef84268-d588-465a-a308-a864a43d0070 (configurable via env)
 *   Auth:        api-key query parameter (required for real mode)
 *
 * API documentation:
 *   Base URL:    https://api.data.gov.in/resource/{resource-id}
 *   Parameters:  api-version=2.0, format=json, limit, offset, filters[field]=value
 *   Filter format: filters[field_name]=value  (LITERAL brackets, not encoded)
 *   Response:    { records: [...], total, count, offset }
 *   Date field:  arrival_date (DD/MM/YYYY)
 *   Price unit:  INR per quintal (all Agmarknet records)
 *
 * Authentication:
 *   Query param: ?api-key={MARKET_API_KEY}
 *   Obtain key at: https://data.gov.in/developers
 *
 * Interface (unchanged):
 *   getPrices({ commodity, state, district, market, fromDate, toDate, limit })
 *   searchCommodities({ query })
 *   compareMarkets({ commodity, state, district, limit })
 *   checkReadiness()
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'
import { normalizeAgmarknetRecords } from '../services/marketNormalizer.service.js'

// ── HTTP fetch helper ────────────────────────────────────────────────────────

/**
 * Fetch a URL with configurable timeout using AbortController.
 *
 * @param {string} url
 * @param {object} options - fetch options (headers, method, etc.)
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
 * Granular codes returned:
 *   MARKET_API_KEY_INVALID       — API key rejected by data.gov.in
 *   MARKET_RESOURCE_NOT_FOUND    — Resource ID does not exist
 *   MARKET_RATE_LIMIT            — Too many requests
 *   MARKET_TIMEOUT               — Request timed out
 *   MARKET_NETWORK_ERROR         — DNS / connection refused / TLS failure
 *   MARKET_RESPONSE_PARSE_ERROR  — Response body was not valid JSON
 *   MARKET_NO_DATA               — 404 / empty result set
 *   MARKET_PROVIDER_UNAVAILABLE  — 5xx or any other unclassified failure
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

  // Network-level failures (no HTTP response received)
  if (
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('ssl') ||
    msg.includes('certificate')
  ) {
    appErr.code = 'MARKET_NETWORK_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Cannot reach market data provider. Check network connectivity.'
    return appErr
  }

  if (status === 401) {
    appErr.code = 'MARKET_API_KEY_INVALID'
    appErr.statusCode = 401
    appErr.message = 'Market data provider rejected the API key. Check MARKET_API_KEY.'
    return appErr
  }

  if (status === 403) {
    appErr.code = 'MARKET_API_KEY_INVALID'
    appErr.statusCode = 403
    appErr.message = 'Market data provider denied access. Check MARKET_API_KEY permissions.'
    return appErr
  }

  if (status === 404) {
    appErr.code = 'MARKET_RESOURCE_NOT_FOUND'
    appErr.statusCode = 404
    appErr.message = 'Market data resource not found. Check MARKET_API_RESOURCE_ID.'
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

  appErr.code = 'MARKET_PROVIDER_UNAVAILABLE'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred while fetching market data.'
  return appErr
}

// ── Query string builder ─────────────────────────────────────────────────────

/**
 * Build the data.gov.in OGD API query string manually.
 *
 * WHY NOT URLSearchParams:
 *   URLSearchParams percent-encodes bracket characters:
 *     filters[commodity] → filters%5Bcommodity%5D
 *   data.gov.in requires LITERAL brackets in the query string.
 *   When brackets are encoded the API silently ignores all filters and
 *   returns up to `limit` records for every commodity and state.
 *
 *   We build the query string as a plain string concatenation so brackets
 *   are never encoded.  Only the VALUE of each parameter is encoded.
 *
 * @param {object} p
 * @param {string} p.apiKey
 * @param {string} p.resourceId   — used only in the path, not here
 * @param {number} p.limit
 * @param {string|null} p.commodity
 * @param {string|null} p.state
 * @param {string|null} p.district
 * @param {string|null} p.market
 * @param {string|null} p.fromDate  — YYYY-MM-DD; converted to DD/MM/YYYY for API
 * @returns {string}  e.g. "api-version=2.0&format=json&limit=100&api-key=...&filters[commodity]=Tomato"
 */
function buildQueryString({ apiKey, limit, commodity, state, district, market, fromDate }) {
  const parts = [
    `api-version=2.0`,
    `format=json`,
    `limit=${encodeURIComponent(String(limit))}`,
    `offset=0`,
    // API key as query parameter — this is the ONLY supported auth mechanism
    // for data.gov.in OGD v2.0.  Never send it in a header.
    `api-key=${encodeURIComponent(apiKey)}`,
  ]

  // Filters — literal brackets, value-only encoding
  if (commodity) parts.push(`filters[commodity]=${encodeURIComponent(commodity)}`)
  if (state)     parts.push(`filters[state]=${encodeURIComponent(state)}`)
  if (district)  parts.push(`filters[district]=${encodeURIComponent(district)}`)
  if (market)    parts.push(`filters[market]=${encodeURIComponent(market)}`)

  // Date filter — Agmarknet uses DD/MM/YYYY
  if (fromDate) {
    const parts2 = fromDate.split('-')
    if (parts2.length === 3) {
      const [yyyy, mm, dd] = parts2
      parts.push(`filters[arrival_date]=${encodeURIComponent(`${dd}/${mm}/${yyyy}`)}`)
    }
  }

  return parts.join('&')
}

// ── JSON error body inspector ─────────────────────────────────────────────────

/**
 * data.gov.in returns HTTP 200 for many error conditions with a JSON body
 * like `{ "message": "Invalid api_key" }` or `{ "message": "Resource not found" }`.
 *
 * This function inspects the parsed response body and throws a typed error
 * if it detects a known API-level error.  Returns silently if the body looks
 * like a normal successful response.
 *
 * @param {object} json     — already-parsed response body
 * @param {string} logContext — logging context string (commodity/state)
 * @throws {Error} Typed MARKET_* error when an API-level error is detected
 */
function assertNoApiLevelError(json, logContext) {
  // data.gov.in error envelopes never have a "records" array
  if (Array.isArray(json.records) || Array.isArray(json.data)) return

  const message = (json.message ?? json.error ?? json.msg ?? '').toLowerCase()

  if (!message) return // no error message — treat as empty result

  logger.error('MarketProvider: API-level error in response body', {
    context: logContext,
    message: json.message ?? json.error ?? json.msg,
    responseKeys: Object.keys(json).join(', '),
  })

  if (
    message.includes('invalid api') ||
    message.includes('api_key') ||
    message.includes('invalid key') ||
    message.includes('unauthorized') ||
    message.includes('authentication')
  ) {
    const err = new Error('data.gov.in rejected the API key.')
    err.code = 'MARKET_API_KEY_INVALID'
    err.statusCode = 401
    throw err
  }

  if (
    message.includes('resource not found') ||
    message.includes('not found') ||
    message.includes('invalid resource')
  ) {
    const err = new Error('data.gov.in resource ID not found.')
    err.code = 'MARKET_RESOURCE_NOT_FOUND'
    err.statusCode = 404
    throw err
  }

  if (message.includes('rate limit') || message.includes('too many request') || message.includes('quota')) {
    const err = new Error('data.gov.in rate limit exceeded.')
    err.code = 'MARKET_RATE_LIMIT'
    err.statusCode = 429
    throw err
  }

  // Unknown error message — surface it as MARKET_NO_DATA so the agent
  // reports "no data found" rather than a generic provider failure
  const err = new Error(`data.gov.in returned an error: ${json.message ?? json.error ?? 'unknown'}`)
  err.code = 'MARKET_NO_DATA'
  err.statusCode = 404
  throw err
}

// ── API request helper ────────────────────────────────────────────────────────

/**
 * Build the data.gov.in OGD API URL and fetch Agmarknet records.
 *
 * Production-grade logging: every network boundary is logged.
 * The API key is NEVER written to logs — it is redacted in all log entries.
 *
 * @param {object} params
 * @param {string}      params.commodity
 * @param {string|null} [params.state]
 * @param {string|null} [params.district]
 * @param {string|null} [params.market]
 * @param {string|null} [params.fromDate]   — YYYY-MM-DD
 * @param {string|null} [params.toDate]     — YYYY-MM-DD (currently informational only)
 * @param {number}      [params.limit]
 * @returns {Promise<object[]>} Raw record array from API
 */
async function fetchAgmarknetRecords({ commodity, state, district, market, fromDate, toDate, limit }) {
  const { apiUrl, apiKey, resourceId, requestTimeoutMs, maxRecords } = config.market

  // ── Pre-flight validation ─────────────────────────────────────────────
  if (!apiKey) {
    const err = new Error('MARKET_API_KEY is required for real market data provider.')
    err.code = 'MARKET_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  const requestLimit = Math.min(limit ?? maxRecords, maxRecords)

  // ── Build URL ────────────────────────────────────────────────────────
  const qs = buildQueryString({ apiKey, limit: requestLimit, commodity, state, district, market, fromDate })
//  const qs =`api-version=2.0&format=json&limit=5&offset=0&api-key=${encodeURIComponent(apiKey)}` 
  const url = `${apiUrl}/${resourceId}?${qs}`

  // Log the full URL with the API key redacted for security
  const redactedUrl = url.replace(
    /api-key=[^&]+/,
    'api-key=REDACTED'
  )

  logger.info('MarketProvider: request', {
    url: redactedUrl,
    commodity,
    state,
    district,
    market,
    fromDate,
    limit: requestLimit,
  })

  // ── Fetch ────────────────────────────────────────────────────────────
  let response
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AgroGenieAI/1.0 (market-provider; +https://agrogenie.ai)',
        },
      },
      requestTimeoutMs
    )
  } catch (err) {
    logger.error('MarketProvider: fetch threw (network/timeout)', {
      url: redactedUrl,
      commodity,
      errorMessage: err.message,
      errorStack: err.stack,
    })
    throw mapMarketError(err)
  }

  // ── HTTP status ──────────────────────────────────────────────────────
  logger.info('MarketProvider: response status', {
    status: response.status,
    statusText: response.statusText,
    url: redactedUrl,
  })

  if (!response.ok) {
    logger.error('MarketProvider: HTTP error', {
      status: response.status,
      url: redactedUrl,
      commodity,
      state,
      district,
    })
    const httpErr = new Error(`data.gov.in HTTP ${response.status}`)
    httpErr._httpStatus = response.status
    throw mapMarketError(httpErr)
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let rawText
  try {
    rawText = await response.text()
  } catch (err) {
    logger.error('MarketProvider: failed to read response body', {
      errorMessage: err.message,
      errorStack: err.stack,
    })
    const readErr = new Error('Failed to read market data provider response body.')
    readErr.code = 'MARKET_RESPONSE_PARSE_ERROR'
    readErr.statusCode = 502
    throw readErr
  }

  logger.info('MarketProvider: raw response body', {
    bodyLength: rawText.length,
    // Log first 500 chars to avoid flooding logs with huge payloads
    bodyPreview: rawText.length > 500 ? rawText.slice(0, 500) + '…' : rawText,
  })

  let json
  try {
    json = JSON.parse(rawText)
  } catch (err) {
    logger.error('MarketProvider: JSON parse error', {
      errorMessage: err.message,
      rawTextPreview: rawText.slice(0, 200),
    })
    const parseErr = new Error('Failed to parse market data provider JSON response.')
    parseErr.code = 'MARKET_RESPONSE_PARSE_ERROR'
    parseErr.statusCode = 502
    throw parseErr
  }

  logger.info('MarketProvider: parsed JSON envelope', {
    responseKeys: Object.keys(json).join(', '),
    total: json.total,
    count: json.count,
    recordsIsArray: Array.isArray(json.records),
    recordCount: Array.isArray(json.records) ? json.records.length : 'n/a',
  })

  // ── API-level error detection ─────────────────────────────────────────
  // data.gov.in returns HTTP 200 for auth failures and unknown resource IDs.
  // We must inspect the body to detect them.
  const logContext = `commodity=${commodity ?? 'any'} state=${state ?? 'any'} district=${district ?? 'any'}`
  assertNoApiLevelError(json, logContext)

  // ── Extract records ───────────────────────────────────────────────────
  const records = json.records ?? json.data ?? json.result ?? []

  logger.info("DEBUG: First 5 commodities returned", {
  commodities: records.slice(0, 5).map(r => ({
    commodity: r.commodity,
    market: r.market,
    district: r.district,
    state: r.state,
  })),
});

  if (!Array.isArray(records)) {
    logger.warn('MarketProvider: unexpected response shape — no records array', {
      responseKeys: Object.keys(json).join(', '),
      commodity,
    })
    return []
  }

  // Log a sample record for field-name diagnostics
  if (records.length > 0) {
    logger.info('MarketProvider: sample record[0] field names', {
      fields: Object.keys(records[0]).join(', '),
      sample: JSON.stringify(records[0]).slice(0, 300),
    })
  }

  logger.info('MarketProvider: records received', {
    commodity,
    state,
    district,
    total: json.total ?? json.count,
    returned: records.length,
  })

  // ── Market-filter retry ───────────────────────────────────────────────
  // The Agmarknet dataset stores mandi names inconsistently
  // ("Karnal", "Karnal Mandi", "KARNAL", etc.).  When a market filter
  // was applied and returned zero records, retry without it so the farmer
  // at least gets district-level prices rather than an empty response.
  if (records.length === 0 && market) {
    logger.info('MarketProvider: zero results with market filter — retrying without market filter', {
      commodity, state, district, market,
    })
    return fetchAgmarknetRecords({ commodity, state, district, market: null, fromDate, toDate, limit })
  }

  return records
}

// ── Provider export ──────────────────────────────────────────────────────────

export const realMarketProvider = {
  /**
   * Get mandi price records for a commodity and location.
   *
   * @param {object} params
   * @param {string}      params.commodity  — Canonical commodity name
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {string|null} [params.market]   — Specific mandi name
   * @param {string|null} [params.fromDate] — YYYY-MM-DD
   * @param {string|null} [params.toDate]   — YYYY-MM-DD
   * @param {number}      [params.limit]
   * @returns {Promise<{ isDemo, provider, fetchedAt, records }>}
   */
  async getPrices({ commodity, state, district, market, fromDate, toDate, limit } = {}) {
    const fetchedAt = new Date().toISOString()
    let rawRecords = await fetchAgmarknetRecords({
      commodity, state, district, market, fromDate, toDate, limit,
    })

    // Retry 1: remove district filter
    if (rawRecords.length === 0 && district) {
      logger.info("Retrying without district filter");

      rawRecords = await fetchAgmarknetRecords({
      commodity,
      state,
      market,
      fromDate,
      toDate,
      limit,
    });
    }

  // Retry 2: remove state filter
    if (rawRecords.length === 0 && state) {
      logger.info("Retrying with commodity only");

    rawRecords = await fetchAgmarknetRecords({
      commodity,
      fromDate,
      toDate,
      limit,
    });
  }

    const providerMeta = { provider: 'agmarknet-datagov', fetchedAt, isDemo: false }
    const records = normalizeAgmarknetRecords(rawRecords, providerMeta)

    logger.info('MarketProvider: normalized records', {
      rawCount: rawRecords.length,
      normalizedCount: records.length,
      commodity,
    })

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
   * @param {string} params.query — Commodity search term
   * @returns {Promise<object>}
   */
  async searchCommodities({ query } = {}) {
    return this.getPrices({ commodity: query, limit: 20 })
  },

  /**
   * Compare prices for a commodity across markets in a state/district.
   *
   * @param {object} params
   * @param {string}      params.commodity
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {number}      [params.limit]
   * @returns {Promise<object>}
   */
  async compareMarkets({ commodity, state, district, limit } = {}) {
    return this.getPrices({
      commodity,
      state,
      district,
      limit: limit ?? config.market.maxRecords,
    })
  },

  /**
   * Readiness check — validates configuration without a live API call.
   *
   * @returns {Promise<{ ready: boolean, provider: string, isDemo: boolean, reason?: string }>}
   */
  async checkReadiness() {
    const { apiUrl, apiKey, resourceId } = config.market
    if (!apiUrl)     return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_URL not configured' }
    if (!apiKey)     return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_KEY not configured' }
    if (!resourceId) return { ready: false, provider: 'agmarknet-datagov', isDemo: false, reason: 'MARKET_API_RESOURCE_ID not configured' }
    return { ready: true, provider: 'agmarknet-datagov', isDemo: false }
  },
}
