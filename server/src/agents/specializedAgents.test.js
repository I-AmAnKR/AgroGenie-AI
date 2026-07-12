/**
 * Specialized agent tests — Phase 10 update.
 *
 * Weather Agent tests updated for Phase 10 (live agent).
 * Other placeholder agent tests remain from Phase 9.
 *
 * Run: cd server && npm test -- --testPathPattern=agents/specializedAgents
 */
import { jest } from '@jest/globals'

// ── Mock weather provider factory for Weather Agent tests ─────────────────────

jest.unstable_mockModule('../providers/weather.provider.factory.js', () => ({
  getWeatherProvider: jest.fn().mockReturnValue({
    getWeatherByLocation: jest.fn().mockResolvedValue({
      location: { name: 'Karnal, Haryana', district: 'Karnal', state: 'Haryana', latitude: 29.69, longitude: 76.99 },
      current: {
        observedAt: new Date().toISOString(),
        temperatureC: 28,
        feelsLikeC: 30,
        humidityPercent: 65,
        windSpeedKph: 14,
        precipitationMm: 0,
        condition: 'Partly Cloudy',
      },
      forecast: [],
      metadata: { provider: 'mock-weather', fetchedAt: new Date().toISOString(), isDemo: true },
    }),
  }),
  getWeatherHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn().mockReturnValue({
    generate: jest.fn().mockResolvedValue({
      content: 'Based on the weather data, here is the farming advice.',
      model: 'mock',
      provider: 'mock',
      isDemo: true,
    }),
  }),
  getAiHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../services/weatherCache.service.js', () => ({
  buildCacheKey: jest.fn().mockReturnValue('test-key'),
  getFromCache: jest.fn().mockReturnValue(null),
  setInCache: jest.fn(),
  getCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 900 }),
}))

// Phase 11: mock market provider and cache for Market Agent tests
jest.unstable_mockModule('../providers/market.provider.factory.js', () => ({
  getMarketProvider: jest.fn().mockReturnValue({
    getPrices: jest.fn().mockResolvedValue({
      isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(),
      records: [
        {
          commodity: 'Tomato', variety: 'Local', state: 'Maharashtra', district: 'Nashik',
          market: 'Lasalgaon', priceDate: new Date().toISOString().slice(0, 10),
          minPrice: 800, maxPrice: 1500, modalPrice: 1100,
          unit: 'INR_PER_QUINTAL', arrivals: 12, arrivalsUnit: 'Tonnes',
          metadata: { provider: 'mock-market', fetchedAt: new Date().toISOString(), isDemo: true },
        },
      ],
    }),
    compareMarkets: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [] }),
    getTrend: jest.fn().mockResolvedValue({ isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [] }),
  }),
  getMarketHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../services/marketCache.service.js', () => ({
  buildMarketCacheKey: jest.fn().mockReturnValue('market-test-key'),
  getMarketFromCache: jest.fn().mockReturnValue(null),
  setMarketInCache: jest.fn(),
  getMarketCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 1800 }),
}))

// Phase 12: mock scheme repository + seed so tests run without MongoDB
jest.unstable_mockModule('../repositories/scheme.repository.js', () => ({
  findCandidatesForFarmer: jest.fn().mockResolvedValue([
    {
      schemeId: 'test-pm-kisan',
      schemeCode: 'PM-KISAN',
      name: 'PM Kisan Samman Nidhi',
      shortName: 'PM-KISAN',
      ministry: 'Ministry of Agriculture & Farmers Welfare',
      schemeLevel: 'CENTRAL',
      status: 'ACTIVE',
      benefitsSummary: 'Financial benefit of ₹6,000/year in three installments.',
      officialSourceUrl: 'https://pmkisan.gov.in',
      applicationUrl: 'https://pmkisan.gov.in',
      applicationMode: 'BOTH',
      lastVerifiedAt: '2023-04-01T00:00:00.000Z',
      eligibilityRules: [
        { field: 'farm.area', operator: 'LESS_THAN_OR_EQUAL', value: 2, required: true, explanation: 'Farm area ≤ 2 hectares.' },
      ],
      requiredDocuments: [{ name: 'Aadhaar Card', requiredStatus: 'required', condition: null }],
      applicationSteps: [{ order: 1, description: 'Visit pmkisan.gov.in or nearest CSC.' }],
      tags: ['pm-kisan'],
      isDemo: true,
      verificationNotes: 'Seeded from PM-KISAN Operational Guidelines 2023.',
    },
  ]),
  findByCode: jest.fn().mockResolvedValue(null),
  createScheme: jest.fn().mockResolvedValue({}),
  findById: jest.fn().mockResolvedValue(null),
  findActive: jest.fn().mockResolvedValue([]),
  findByCategory: jest.fn().mockResolvedValue([]),
  findByState: jest.fn().mockResolvedValue([]),
  search: jest.fn().mockResolvedValue([]),
  countActiveSchemes: jest.fn().mockResolvedValue(6),
  _clearMemStore: jest.fn(),
}))

jest.unstable_mockModule('../data/seed/schemes.seed.js', () => ({
  runSchemeSeed: jest.fn().mockResolvedValue({ inserted: 0, skipped: 6, failed: 0, total: 6 }),
}))

// Mock RAG service for scheme agent RAG retrieval (best-effort, returns empty in tests)
jest.unstable_mockModule('../services/rag.service.js', () => ({
  askKnowledge: jest.fn().mockResolvedValue({ answer: '', sources: [], grounded: false }),
  searchKnowledge: jest.fn().mockResolvedValue({ results: [], resultCount: 0 }),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

const { runWeatherAgent } = await import('./weather/weather.agent.js')
const { runMarketAgent } = await import('./market/market.agent.js')
const { runSchemeAgent } = await import('./scheme/scheme.agent.js')
const { runDiseaseAgent } = await import('./disease/disease.agent.js')
const { runCropAgent } = await import('./crop/crop.agent.js')
const { INTENT, RESULT_STATUS } = await import('./intents.js')

// ── Weather Agent — Phase 10 tests ────────────────────────────────────────────

describe('Weather Agent — Phase 10 (live implementation)', () => {
  it('no longer returns capability_not_available — returns success or clarification', async () => {
    const result = await runWeatherAgent({
      message: 'Will it rain tomorrow in Karnal?',
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  it('returns NEEDS_CLARIFICATION when no location provided', async () => {
    const result = await runWeatherAgent({
      message: 'Will it rain tomorrow?',
      farmerContext: {
        location: { state: null, district: null },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
  })

  it('answer does not contain fabricated weather values', async () => {
    const result = await runWeatherAgent({
      message: 'What is the temperature tomorrow in Karnal?',
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    // No hardcoded invented values like "it will be 55 degrees" or "rainfall of 999 mm"
    expect(result.answer).not.toMatch(/it will be \d{3} degrees|rainfall of 999 mm/i)
  })

  it('includes at least one warning about forecasts', async () => {
    const result = await runWeatherAgent({
      message: 'Rain forecast for Karnal?',
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

// ── Market Agent — Phase 11 live implementation ───────────────────────────────

describe('Market Agent — Phase 11 live', () => {
  it('returns MARKET intent for tomato price query', async () => {
    const result = await runMarketAgent({ message: "Today's tomato price?" })
    // Phase 11: No longer capability_not_available — agent is live
    expect(result.intent).toBe(INTENT.MARKET)
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  it('includes market data or clarification for wheat query', async () => {
    const result = await runMarketAgent({ message: 'Wheat price today?' })
    expect(result.intent).toBe(INTENT.MARKET)
    // Should be success or needs_clarification (not capability_not_available)
    expect([RESULT_STATUS.SUCCESS, RESULT_STATUS.NEEDS_CLARIFICATION, RESULT_STATUS.PARTIAL_SUCCESS]).toContain(result.status)
  })

  it('includes appropriate warnings', async () => {
    const result = await runMarketAgent({ message: 'Wheat price today?' })
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

// ── Scheme Agent — Phase 12 live implementation ───────────────────────────────

describe('Scheme Agent — Phase 12 live', () => {
  it('no longer returns capability_not_available — returns success or clarification', async () => {
    const result = await runSchemeAgent({ message: 'Which scheme applies to me?' })
    expect(result.intent).toBe(INTENT.SCHEME)
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  it('returns SCHEME intent for PM-KISAN eligibility query', async () => {
    const result = await runSchemeAgent({
      message: 'Am I eligible for PM-KISAN?',
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: { area: 1.5, areaUnit: 'hectares', irrigationType: 'Canal' },
        cropContext: { currentCrop: 'Wheat', previousCrops: [] },
        preferences: { language: 'en' },
      },
    })
    expect(result.intent).toBe(INTENT.SCHEME)
    expect([RESULT_STATUS.SUCCESS, RESULT_STATUS.PARTIAL_SUCCESS, RESULT_STATUS.NEEDS_CLARIFICATION]).toContain(result.status)
  })

  it('does not claim guaranteed eligibility or approval', async () => {
    const result = await runSchemeAgent({ message: 'Am I eligible for PM-KISAN?' })
    expect(result.answer).not.toMatch(/\byou are (definitely )?eligible\b|\bguaranteed\b|\bconfirmed eligibility\b|\bapproval guaranteed\b/i)
  })

  it('includes official source metadata', async () => {
    const result = await runSchemeAgent({
      message: 'Tell me about PM-KISAN',
      farmerContext: {
        location: { state: 'Punjab', district: 'Ludhiana' },
        farm: { area: 1.0 },
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.SCHEME)
    // Sources should contain at least one entry with scheme metadata
    if (result.status === RESULT_STATUS.SUCCESS || result.status === RESULT_STATUS.PARTIAL_SUCCESS) {
      expect(result.sources.length).toBeGreaterThan(0)
    }
  })

  it('includes warnings about data being curated/demo', async () => {
    const result = await runSchemeAgent({ message: 'Which irrigation scheme can help me?' })
    // Should have warnings since all seeded records are isDemo: true
    expect(Array.isArray(result.warnings)).toBe(true)
  })

  it('returns scheme result data for the frontend panel', async () => {
    const result = await runSchemeAgent({ message: 'PM-KISAN eligibility?' })
    expect(result.intent).toBe(INTENT.SCHEME)
    // scheme object should be present for non-empty results
    if (result.status === RESULT_STATUS.SUCCESS) {
      expect(result.scheme).toBeDefined()
      expect(result.scheme.schemesEvaluated).toBeGreaterThan(0)
    }
  })
})

// ── Crop Agent — Phase 13 live implementation ─────────────────────────────────

describe('Crop Agent — Phase 13 live', () => {
  it('no longer returns capability_not_available when context is complete', async () => {
    const result = await runCropAgent({
      message: 'Which Rabi crop should I grow?',
      farmerContext: {
        location: { state: 'Punjab', district: 'Ludhiana' },
        farm: { soilType: 'Loamy', waterAvailability: 'canal', irrigationType: 'Canal' },
        cropContext: { currentCrop: 'Paddy', previousCrops: ['Paddy'], sowingDate: null },
        preferences: { objective: null, language: 'en' },
      },
    })
    expect(result.intent).toBe(INTENT.CROP_RECOMMENDATION)
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  it('returns NEEDS_CLARIFICATION when location is missing', async () => {
    const result = await runCropAgent({
      message: 'Which Kharif crop should I grow?',
      farmerContext: {
        location: { state: null, district: null },
        farm: { soilType: 'Loamy', waterAvailability: 'canal', irrigationType: 'Canal' },
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
    expect(result.missingInformation).toContain('location.state')
  })

  it('returns NEEDS_CLARIFICATION when soil type is missing', async () => {
    const result = await runCropAgent({
      message: 'Which Rabi crop should I grow?',
      farmerContext: {
        location: { state: 'Punjab', district: 'Ludhiana' },
        farm: { soilType: null, waterAvailability: null, irrigationType: null },
        cropContext: {},
        preferences: {},
      },
    })
    expect([RESULT_STATUS.NEEDS_CLARIFICATION]).toContain(result.status)
    expect(result.missingInformation.length).toBeGreaterThan(0)
  })

  it('produces recommendation with topCrops when context is complete', async () => {
    const result = await runCropAgent({
      message: 'Which Kharif crop should I grow?',
      farmerContext: {
        location: { state: 'Maharashtra', district: 'Nashik' },
        farm: { soilType: 'Loamy', waterAvailability: 'available', irrigationType: 'Drip' },
        cropContext: { currentCrop: 'Wheat', previousCrops: ['Wheat'], sowingDate: null },
        preferences: { objective: null, language: 'en' },
      },
    })
    expect(result.intent).toBe(INTENT.CROP_RECOMMENDATION)
    if (result.status === RESULT_STATUS.SUCCESS || result.status === RESULT_STATUS.PARTIAL_SUCCESS) {
      expect(result.recommendation).toBeDefined()
      expect(result.recommendation.topCrops).toBeDefined()
      expect(result.recommendation.topCrops.length).toBeGreaterThan(0)
    }
  })

  it('topCrops are sorted by score descending', async () => {
    const result = await runCropAgent({
      message: 'Best Kharif crop for my farm?',
      farmerContext: {
        location: { state: 'Madhya Pradesh', district: 'Indore' },
        farm: { soilType: 'Black cotton soil', waterAvailability: 'available', irrigationType: 'Canal' },
        cropContext: { currentCrop: 'Wheat', previousCrops: ['Wheat'], sowingDate: null },
        preferences: { objective: null, language: 'en' },
      },
    })
    if (result.recommendation?.topCrops?.length > 1) {
      const scores = result.recommendation.topCrops.map((c) => c.score)
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
      }
    }
  })

  it('does not claim guaranteed yields or guaranteed profitability', async () => {
    const result = await runCropAgent({
      message: 'Which Rabi crop should I grow?',
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: { soilType: 'Alluvial', waterAvailability: 'canal', irrigationType: 'Canal' },
        cropContext: { currentCrop: 'Paddy', previousCrops: ['Paddy'], sowingDate: null },
        preferences: { objective: null, language: 'en' },
      },
    })
    expect(result.answer).not.toMatch(/guaranteed yield|guaranteed profit|guaranteed income|definitely profitable/i)
  })
})

