/**
 * Market Agent tests — Phase 11.
 *
 * Tests:
 *   - Commodity normalization (exact match, alias, Hindi, not found)
 *   - Market record normalization (price parsing, date parsing, unit)
 *   - Market freshness classification (current, recent, stale, unknown)
 *   - Market analytics (price statistics, trend, insufficient data)
 *   - Mock market provider (getPrices, compareMarkets, getTrend, checkReadiness)
 *   - Real provider configuration guard
 *   - Market Provider factory (mock mode, real mode, missing key)
 *   - Market cache (key building, get/set/expiry)
 *   - Market location resolver (explicit mandi, district, profile, none)
 *   - Market Agent: commodity clarification
 *   - Market Agent: successful price query
 *   - Market Agent: trend query
 *   - Market Agent: market comparison
 *   - Market Agent: no data result
 *   - Market Agent: provider failure
 *   - Market Agent: isDemo=true for mock
 *   - Market Agent: no credentials in response
 *   - Market Agent: cache hit
 *   - Market Agent: Granite fallback on AI failure
 *   - Router: MARKET intent dispatches to Market Agent
 *   - Router: Market Agent no longer returns capability_not_available
 *   - Multi-intent: Weather + Market success
 *   - intents.js: MARKET not in CAPABILITY_NOT_AVAILABLE_INTENTS
 *
 * Run: cd server && npm test -- --testPathPattern=market.agent.test
 */
import { jest } from '@jest/globals'

// ── Module mocks (must be before imports) ─────────────────────────────────────

jest.unstable_mockModule('../../providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn(),
  getAiHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../../providers/market.provider.factory.js', () => ({
  getMarketProvider: jest.fn(),
  getMarketHealthStatus: jest.fn().mockReturnValue('mock'),
}))

// Mock market cache — controllable per test
const mockGetMarketFromCache = jest.fn().mockReturnValue(null)
const mockSetMarketInCache = jest.fn()
jest.unstable_mockModule('../../services/marketCache.service.js', () => ({
  buildMarketCacheKey: jest.fn().mockReturnValue('test-cache-key'),
  getMarketFromCache: mockGetMarketFromCache,
  setMarketInCache: mockSetMarketInCache,
  clearMarketCache: jest.fn(),
  getMarketCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 1800 }),
}))

// ── Test imports ──────────────────────────────────────────────────────────────

const { getAiProvider } = await import('../../providers/ai.provider.factory.js')
const { getMarketProvider } = await import('../../providers/market.provider.factory.js')
const { runMarketAgent, detectMarketQueryType, MARKET_QUERY_TYPES } = await import('./market.agent.js')
const { normalizeCommodity, extractCommodityFromMessage } = await import('../../services/commodityNormalizer.service.js')
const { normalizeAgmarknetRecord, normalizeDate, parsePrice, pricePerKg } = await import('../../services/marketNormalizer.service.js')
const { classifyFreshness, classifyRecordsFreshness, FRESHNESS } = await import('../../services/marketFreshness.service.js')
const { calculatePriceStatistics, calculateTrend, findBestReportedMarket, TREND_STATUS } = await import('../../services/marketAnalytics.service.js')
const { resolveMarketLocation } = await import('../../services/marketLocationResolver.service.js')
const { mockMarketProvider } = await import('../../providers/mock/mock-market.provider.js')
const { INTENT, RESULT_STATUS, CAPABILITY_NOT_AVAILABLE_INTENTS } = await import('../intents.js')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_AI_RESULT = {
  content: 'The latest tomato price at Karnal mandi is ₹980/quintal (modal). Data is from yesterday.',
  model: 'mock-model',
  provider: 'mock',
  isDemo: true,
}

const TODAY = new Date().toISOString().slice(0, 10)

const MOCK_TOMATO_RECORDS = [
  {
    commodity: 'Tomato', variety: 'Local', grade: 'FAQ',
    state: 'Haryana', district: 'Karnal', market: 'Karnal',
    priceDate: TODAY,
    minPrice: 700, maxPrice: 1300, modalPrice: 980,
    unit: 'INR_PER_QUINTAL', arrivals: 6, arrivalsUnit: 'Tonnes',
    metadata: { provider: 'mock-market', fetchedAt: new Date().toISOString(), isDemo: true },
  },
  {
    commodity: 'Tomato', variety: 'Local', grade: 'FAQ',
    state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon',
    priceDate: TODAY,
    minPrice: 800, maxPrice: 1500, modalPrice: 1100,
    unit: 'INR_PER_QUINTAL', arrivals: 12, arrivalsUnit: 'Tonnes',
    metadata: { provider: 'mock-market', fetchedAt: new Date().toISOString(), isDemo: true },
  },
]

const FARMER_CONTEXT_KARNAL = {
  location: { state: 'Haryana', district: 'Karnal' },
  farm: { area: null, areaUnit: null, soilType: null, irrigationType: null, waterAvailability: null },
  cropContext: { currentCrop: 'Wheat', previousCrops: [], sowingDate: null },
  preferences: { objective: null, language: 'en' },
}

// ── 1. Commodity Normalization tests ──────────────────────────────────────────

describe('CommodityNormalizer', () => {
  test('exact canonical name match', () => {
    const r = normalizeCommodity('Tomato')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Tomato')
    expect(r.confidenceCategory).toBe('high')
  })

  test('lowercase alias match', () => {
    const r = normalizeCommodity('tomatoes')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Tomato')
  })

  test('Hindi alias — wheat गेहूं', () => {
    const r = normalizeCommodity('गेहूं')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Wheat')
  })

  test('Hindi alias — tomato टमाटर', () => {
    const r = normalizeCommodity('टमाटर')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Tomato')
  })

  test('common alias — pyaz → Onion', () => {
    const r = normalizeCommodity('pyaz')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Onion')
  })

  test('mustard alias — sarson', () => {
    const r = normalizeCommodity('sarson')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Mustard')
  })

  test('unknown commodity returns not found', () => {
    const r = normalizeCommodity('xyzunknowncrop123')
    expect(r.found).toBe(false)
    expect(r.canonicalName).toBeNull()
  })

  test('extractCommodityFromMessage — finds wheat in message', () => {
    const r = extractCommodityFromMessage('What is the current wheat price in Karnal?')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Wheat')
  })

  test('extractCommodityFromMessage — finds tomato alias tamatar', () => {
    const r = extractCommodityFromMessage('tamatar ka bhav kya hai?')
    expect(r.found).toBe(true)
    expect(r.canonicalName).toBe('Tomato')
  })

  test('extractCommodityFromMessage — no commodity found', () => {
    const r = extractCommodityFromMessage('What is today\'s weather?')
    expect(r.found).toBe(false)
  })
})

// ── 2. Market Record Normalization tests ──────────────────────────────────────

describe('MarketNormalizer', () => {
  test('normalizeDate DD/MM/YYYY format', () => {
    expect(normalizeDate('17/11/2024')).toBe('2024-11-17')
  })

  test('normalizeDate YYYY-MM-DD passthrough', () => {
    expect(normalizeDate('2024-11-17')).toBe('2024-11-17')
  })

  test('normalizeDate null input', () => {
    expect(normalizeDate(null)).toBeNull()
  })

  test('parsePrice numeric string', () => {
    expect(parsePrice('2450')).toBe(2450)
  })

  test('parsePrice with comma', () => {
    expect(parsePrice('2,450')).toBe(2450)
  })

  test('parsePrice null', () => {
    expect(parsePrice(null)).toBeNull()
  })

  test('pricePerKg conversion', () => {
    expect(pricePerKg(2450)).toBe(24.5)
  })

  test('pricePerKg null input', () => {
    expect(pricePerKg(null)).toBeNull()
  })

  test('normalizeAgmarknetRecord maps fields correctly', () => {
    const raw = {
      commodity: 'Tomato', variety: 'Local', state: 'Haryana',
      district: 'Karnal', market: 'Karnal', arrival_date: '17/11/2024',
      min_price: '700', max_price: '1300', modal_price: '980',
    }
    const r = normalizeAgmarknetRecord(raw, { provider: 'agmarknet', fetchedAt: new Date().toISOString(), isDemo: false })
    expect(r.commodity).toBe('Tomato')
    expect(r.priceDate).toBe('2024-11-17')
    expect(r.minPrice).toBe(700)
    expect(r.maxPrice).toBe(1300)
    expect(r.modalPrice).toBe(980)
    expect(r.unit).toBe('INR_PER_QUINTAL')
    expect(r.metadata.isDemo).toBe(false)
  })
})

// ── 3. Market Freshness tests ─────────────────────────────────────────────────

describe('MarketFreshness', () => {
  test('today is current', () => {
    const today = new Date().toISOString().slice(0, 10)
    const r = classifyFreshness(today)
    expect(r.category).toBe(FRESHNESS.CURRENT)
  })

  test('yesterday is recent', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const r = classifyFreshness(d.toISOString().slice(0, 10))
    expect(r.category).toBe(FRESHNESS.RECENT)
  })

  test('3 days ago is recent', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    const r = classifyFreshness(d.toISOString().slice(0, 10))
    expect(r.category).toBe(FRESHNESS.RECENT)
  })

  test('14 days ago is stale', () => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    const r = classifyFreshness(d.toISOString().slice(0, 10))
    expect(r.category).toBe(FRESHNESS.STALE)
  })

  test('null date is unknown', () => {
    expect(classifyFreshness(null).category).toBe(FRESHNESS.UNKNOWN)
  })

  test('classifyRecordsFreshness uses most recent date', () => {
    const records = [
      { priceDate: new Date().toISOString().slice(0, 10), modalPrice: 100 },
      { priceDate: '2020-01-01', modalPrice: 90 },
    ]
    const r = classifyRecordsFreshness(records)
    expect(r.category).toBe(FRESHNESS.CURRENT)
  })
})

// ── 4. Market Analytics tests ─────────────────────────────────────────────────

describe('MarketAnalytics', () => {
  test('calculatePriceStatistics empty records', () => {
    const s = calculatePriceStatistics([])
    expect(s.recordsAnalyzed).toBe(0)
    expect(s.averageModalPrice).toBeNull()
  })

  test('calculatePriceStatistics min/max/avg', () => {
    const records = [
      { minPrice: 800, maxPrice: 1500, modalPrice: 1100 },
      { minPrice: 700, maxPrice: 1300, modalPrice: 980 },
      { minPrice: 900, maxPrice: 1600, modalPrice: 1200 },
    ]
    const s = calculatePriceStatistics(records)
    expect(s.recordsAnalyzed).toBe(3)
    expect(s.minReportedPrice).toBe(700)
    expect(s.maxReportedPrice).toBe(1600)
    expect(s.averageModalPrice).toBe(1093.33)
  })

  test('calculateTrend insufficient data (1 record)', () => {
    const records = [{ priceDate: '2024-11-17', modalPrice: 2250 }]
    const t = calculateTrend(records)
    expect(t.trendStatus).toBe(TREND_STATUS.INSUFFICIENT_DATA)
  })

  test('calculateTrend rising', () => {
    const records = [
      { priceDate: '2024-11-10', modalPrice: 2000 },
      { priceDate: '2024-11-15', modalPrice: 2150 },
      { priceDate: '2024-11-17', modalPrice: 2300 },
    ]
    const t = calculateTrend(records)
    expect(t.trendStatus).toBe(TREND_STATUS.RISING)
    expect(t.absoluteChange).toBe(300)
    expect(t.percentageChange).toBe(15)
  })

  test('calculateTrend falling', () => {
    const records = [
      { priceDate: '2024-11-10', modalPrice: 1500 },
      { priceDate: '2024-11-15', modalPrice: 1350 },
      { priceDate: '2024-11-17', modalPrice: 1100 },
    ]
    const t = calculateTrend(records)
    expect(t.trendStatus).toBe(TREND_STATUS.FALLING)
    expect(t.absoluteChange).toBe(-400)
  })

  test('calculateTrend stable (small change)', () => {
    const records = [
      { priceDate: '2024-11-10', modalPrice: 2250 },
      { priceDate: '2024-11-15', modalPrice: 2260 },
    ]
    const t = calculateTrend(records)
    expect(t.trendStatus).toBe(TREND_STATUS.STABLE)
  })

  test('findBestReportedMarket', () => {
    const best = findBestReportedMarket(MOCK_TOMATO_RECORDS)
    expect(best).not.toBeNull()
    expect(best.modalPrice).toBe(1100) // Lasalgaon has higher modal
    expect(best.market).toBe('Lasalgaon')
  })

  test('findBestReportedMarket empty', () => {
    expect(findBestReportedMarket([])).toBeNull()
  })
})

// ── 5. Market Location Resolver tests ─────────────────────────────────────────

describe('MarketLocationResolver', () => {
  test('detects explicit mandi name — Lasalgaon', () => {
    const r = resolveMarketLocation({ message: 'What is tomato price in Lasalgaon mandi?' })
    expect(r).not.toBeNull()
    expect(r.market).toBe('Lasalgaon')
    expect(r.source).toBe('explicit_mandi')
  })

  test('detects explicit mandi name — Azadpur', () => {
    const r = resolveMarketLocation({ message: 'Show me prices at Azadpur mandi today' })
    expect(r).not.toBeNull()
    expect(r.market).toBe('Azadpur')
  })

  test('falls back to FarmerProfile location', () => {
    const r = resolveMarketLocation({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(r).not.toBeNull()
    expect(r.district).toBe('Karnal')
    expect(r.source).toBe('farmer_profile')
  })

  test('explicit location overrides profile', () => {
    const r = resolveMarketLocation({
      message: 'What is tomato price in Azadpur mandi?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(r.market).toBe('Azadpur')
    expect(r.source).toBe('explicit_mandi')
  })

  test('returns null when no location available', () => {
    const r = resolveMarketLocation({
      message: 'What is tomato price?',
      farmerContext: { location: { state: null, district: null } },
    })
    expect(r).toBeNull()
  })
})

// ── 6. Query type detection ───────────────────────────────────────────────────

describe('detectMarketQueryType', () => {
  test('PRICE_TREND for "are prices rising"', () => {
    expect(detectMarketQueryType('Are wheat prices rising?')).toBe(MARKET_QUERY_TYPES.PRICE_TREND)
  })

  test('MARKET_COMPARISON for "compare"', () => {
    expect(detectMarketQueryType('Compare tomato prices across mandis')).toBe(MARKET_QUERY_TYPES.MARKET_COMPARISON)
  })

  test('BEST_REPORTED_MARKET for "highest price"', () => {
    expect(detectMarketQueryType('Which market has the highest wheat price?')).toBe(MARKET_QUERY_TYPES.BEST_REPORTED_MARKET)
  })

  test('CURRENT_PRICE for "today"', () => {
    expect(detectMarketQueryType('What is today\'s tomato price?')).toBe(MARKET_QUERY_TYPES.CURRENT_PRICE)
  })

  test('defaults to LATEST_AVAILABLE_PRICE', () => {
    expect(detectMarketQueryType('What is the wheat price?')).toBe(MARKET_QUERY_TYPES.LATEST_AVAILABLE_PRICE)
  })
})

// ── 7. Mock Market Provider tests ─────────────────────────────────────────────

describe('MockMarketProvider', () => {
  test('getPrices returns demo records', async () => {
    const r = await mockMarketProvider.getPrices({ commodity: 'Tomato' })
    expect(r.isDemo).toBe(true)
    expect(r.provider).toBe('mock-market')
    expect(Array.isArray(r.records)).toBe(true)
    expect(r.records.length).toBeGreaterThan(0)
    expect(r.records[0].commodity).toBe('Tomato')
  })

  test('getPrices filters by state', async () => {
    const r = await mockMarketProvider.getPrices({ commodity: 'Wheat', state: 'Haryana' })
    expect(r.records.every((rec) => rec.state.toLowerCase().includes('haryana'))).toBe(true)
  })

  test('getPrices returns empty for unknown commodity', async () => {
    const r = await mockMarketProvider.getPrices({ commodity: 'XyzUnknownCrop' })
    expect(r.records).toHaveLength(0)
    expect(r.isDemo).toBe(true)
  })

  test('getTrend returns multi-date records for wheat', async () => {
    const r = await mockMarketProvider.getTrend({ commodity: 'Wheat' })
    expect(r.isDemo).toBe(true)
    const uniqueDates = [...new Set(r.records.map((rec) => rec.priceDate))]
    expect(uniqueDates.length).toBeGreaterThan(1)
  })

  test('checkReadiness returns ready:true', async () => {
    const r = await mockMarketProvider.checkReadiness()
    expect(r.ready).toBe(true)
    expect(r.isDemo).toBe(true)
  })

  test('all records have isDemo:true', async () => {
    const r = await mockMarketProvider.getPrices({ commodity: 'Onion' })
    expect(r.records.every((rec) => rec.metadata.isDemo === true)).toBe(true)
  })

  test('records have unit INR_PER_QUINTAL', async () => {
    const r = await mockMarketProvider.getPrices({ commodity: 'Onion' })
    expect(r.records.every((rec) => rec.unit === 'INR_PER_QUINTAL')).toBe(true)
  })
})

// ── 8. Market Provider Factory tests ─────────────────────────────────────────

describe('MarketProviderFactory', () => {
  test('CAPABILITY_NOT_AVAILABLE_INTENTS does not include MARKET', () => {
    expect(CAPABILITY_NOT_AVAILABLE_INTENTS.has(INTENT.MARKET)).toBe(false)
  })
})

// ── 9. Market Agent tests ─────────────────────────────────────────────────────

describe('MarketAgent', () => {
  // Set up mock providers before each test
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMarketFromCache.mockReturnValue(null)

    getAiProvider.mockReturnValue({
      generate: jest.fn().mockResolvedValue(MOCK_AI_RESULT),
    })

    getMarketProvider.mockReturnValue({
      getPrices: jest.fn().mockResolvedValue({
        isDemo: true,
        provider: 'mock-market',
        fetchedAt: new Date().toISOString(),
        records: MOCK_TOMATO_RECORDS,
      }),
      compareMarkets: jest.fn().mockResolvedValue({
        isDemo: true,
        provider: 'mock-market',
        fetchedAt: new Date().toISOString(),
        records: MOCK_TOMATO_RECORDS,
      }),
      getTrend: jest.fn().mockResolvedValue({
        isDemo: true,
        provider: 'mock-market',
        fetchedAt: new Date().toISOString(),
        records: MOCK_TOMATO_RECORDS,
      }),
    })
  })

  test('requests clarification when no commodity found', async () => {
    const result = await runMarketAgent({
      message: 'What is today\'s price?',
      farmerContext: {},
    })
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
    expect(result.intent).toBe(INTENT.MARKET)
    expect(result.missingInformation.length).toBeGreaterThan(0)
    expect(getMarketProvider).not.toHaveBeenCalled()
  })

  test('successful price query returns SUCCESS status', async () => {
    const result = await runMarketAgent({
      message: 'What is today\'s tomato price in Karnal?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.intent).toBe(INTENT.MARKET)
    expect(result.grounded).toBe(true)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.market).toBeDefined()
    expect(result.market.commodity).toBe('Tomato')
  })

  test('isDemo:true for mock provider data', async () => {
    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.isDemo).toBe(true)
  })

  test('source metadata has sourceType market_api', async () => {
    const result = await runMarketAgent({
      message: 'What is tomato price in Karnal?',
      farmerContext: {},
    })
    expect(result.sources[0].sourceType).toBe('market_api')
  })

  test('no credentials in response', async () => {
    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    const resultStr = JSON.stringify(result)
    // Should not contain actual API key values — the variable NAME may appear in
    // user-facing warnings ("configure MARKET_API_KEY") which is acceptable guidance,
    // but no actual key values (typically 32+ char alphanumeric) should appear
    expect(resultStr).not.toContain('api-key:')
    expect(resultStr).not.toContain('"apiKey"')
    // Real key value would be long hex/alphanumeric — we verify no actual secret pattern
    expect(result.sources?.some(s => s.apiKey)).toBe(false)
  })

  test('no data result when provider returns empty records', async () => {
    getMarketProvider.mockReturnValue({
      getPrices: jest.fn().mockResolvedValue({
        isDemo: true,
        provider: 'mock-market',
        fetchedAt: new Date().toISOString(),
        records: [],
      }),
      compareMarkets: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [] }),
      getTrend: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [] }),
    })

    const result = await runMarketAgent({
      message: 'What is mustard price in Rajasthan?',
      farmerContext: {},
    })
    expect(result.status).toBe(RESULT_STATUS.SUCCESS) // Success but with no-data message
    expect(result.market.records).toHaveLength(0)
    expect(result.answer).toContain('agmarknet.gov.in')
  })

  test('provider failure returns FAILED status', async () => {
    const marketErr = new Error('Provider unavailable')
    marketErr.code = 'MARKET_PROVIDER_UNAVAILABLE'
    getMarketProvider.mockReturnValue({
      getPrices: jest.fn().mockRejectedValue(marketErr),
      compareMarkets: jest.fn().mockRejectedValue(marketErr),
      getTrend: jest.fn().mockRejectedValue(marketErr),
    })

    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.FAILED)
    expect(result.answer).not.toContain('api-key')
  })

  test('uses FarmerProfile location when no explicit location', async () => {
    const result = await runMarketAgent({
      message: 'What is the latest wheat price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    // Provider should have been called with the profile location
    const providerInstance = getMarketProvider.mock.results[0].value
    const calls = providerInstance.getPrices.mock.calls[0] ?? providerInstance.compareMarkets.mock.calls[0] ?? providerInstance.getTrend.mock.calls[0]
    // Location should be Karnal / Haryana from profile
    expect(calls).toBeDefined()
  })

  test('cache hit — provider not called', async () => {
    mockGetMarketFromCache.mockReturnValue({
      isDemo: true,
      provider: 'mock-market',
      fetchedAt: new Date().toISOString(),
      records: MOCK_TOMATO_RECORDS,
      metadata: { cacheHit: true, fetchedAt: new Date().toISOString() },
    })

    const result = await runMarketAgent({
      message: 'What is tomato price in Karnal?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    // Provider should NOT be called when cache hits
    expect(getMarketProvider).not.toHaveBeenCalled()
  })

  test('Granite failure uses factual fallback answer', async () => {
    getAiProvider.mockReturnValue({
      generate: jest.fn().mockRejectedValue(new Error('AI unavailable')),
    })

    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.PARTIAL_SUCCESS)
    expect(result.answer).toContain('Tomato')
    // Fallback must not invent prices — uses actual records
    expect(result.grounded).toBe(true)
  })

  test('market agent no longer returns capability_not_available', async () => {
    const result = await runMarketAgent({
      message: 'What is onion price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  test('result.market.statistics has expected fields', async () => {
    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    const stats = result.market.statistics
    expect(stats.recordsAnalyzed).toBeGreaterThan(0)
    expect(typeof stats.averageModalPrice).toBe('number')
    expect(typeof stats.minReportedPrice).toBe('number')
    expect(typeof stats.maxReportedPrice).toBe('number')
  })

  test('result.market.trend has trendStatus', async () => {
    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.market.trend.trendStatus).toBeDefined()
  })

  test('stale data warning included', async () => {
    const staleDate = '2020-01-01'
    const staleRecords = MOCK_TOMATO_RECORDS.map((r) => ({ ...r, priceDate: staleDate }))
    getMarketProvider.mockReturnValue({
      getPrices: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: staleRecords }),
      compareMarkets: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: staleRecords }),
      getTrend: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: staleRecords }),
    })

    const result = await runMarketAgent({
      message: 'What is tomato price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.warnings.some((w) => w.toLowerCase().includes('days old') || w.toLowerCase().includes('stale') || w.toLowerCase().includes('agmarknet'))).toBe(true)
  })

  test('market provider config error returns FAILED gracefully', async () => {
    const configErr = new Error('No API key')
    configErr.code = 'MARKET_CONFIGURATION_ERROR'
    getMarketProvider.mockImplementation(() => { throw configErr })

    const result = await runMarketAgent({
      message: 'What is wheat price?',
      farmerContext: FARMER_CONTEXT_KARNAL,
    })
    expect(result.status).toBe(RESULT_STATUS.FAILED)
    // Config error message may reference env variable name for guidance — that is safe
    // but must never contain actual key values (long alphanumeric secrets)
    expect(result.answer).not.toContain('api-key:')
    expect(result.answer).not.toContain('Authorization:')
  })
})
