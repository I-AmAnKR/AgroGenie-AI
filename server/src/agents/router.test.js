/**
 * Agent Router tests — Phase 9.
 *
 * Tests routing decisions, agent selection, placeholder behavior,
 * and multi-intent orchestration.
 * All watsonx.ai calls are mocked via Jest.
 *
 * Run: cd server && npm test -- --testPathPattern=agents/router.test
 */
import { jest } from '@jest/globals'

// Mock the AI provider factory before any imports
jest.unstable_mockModule('../providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn(),
  getAiHealthStatus: jest.fn().mockReturnValue('mock'),
}))

// Mock the RAG service
jest.unstable_mockModule('../services/rag.service.js', () => ({
  askKnowledge: jest.fn(),
  searchKnowledge: jest.fn().mockResolvedValue({ results: [], resultCount: 0 }),
}))

// Mock scheme repository (Phase 12)
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
      eligibilityRules: [],
      requiredDocuments: [{ name: 'Aadhaar Card', requiredStatus: 'required', condition: null }],
      applicationSteps: [{ order: 1, description: 'Visit pmkisan.gov.in.' }],
      tags: ['pm-kisan'],
      isDemo: true,
      verificationNotes: 'Seeded from PM-KISAN guidelines.',
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

// Mock scheme seed (Phase 12)
jest.unstable_mockModule('../data/seed/schemes.seed.js', () => ({
  runSchemeSeed: jest.fn().mockResolvedValue({ inserted: 0, skipped: 6, failed: 0, total: 6 }),
}))

// Mock profile service
jest.unstable_mockModule('../services/profile.service.js', () => ({
  getProfile: jest.fn().mockResolvedValue({
    userId: 'test-user',
    state: 'Maharashtra',
    district: 'Nashik',
    soilType: 'Loamy',
    irrigationType: 'Drip',
    currentCrop: 'Onion',
    preferredLanguage: 'en',
  }),
}))

// Mock the weather provider factory to use mock weather provider
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
      forecast: [
        {
          date: new Date().toISOString().slice(0, 10),
          minTemperatureC: 24,
          maxTemperatureC: 32,
          precipitationProbabilityPercent: 5,
          precipitationMm: 0,
          humidityPercent: 60,
          windSpeedKph: 12,
          condition: 'Sunny',
        },
      ],
      metadata: { provider: 'mock-weather', fetchedAt: new Date().toISOString(), isDemo: true },
    }),
  }),
  getWeatherHealthStatus: jest.fn().mockReturnValue('mock'),
}))

// Mock weather cache (bypass cache in tests)
jest.unstable_mockModule('../services/weatherCache.service.js', () => ({
  buildCacheKey: jest.fn().mockReturnValue('test-cache-key'),
  getFromCache: jest.fn().mockReturnValue(null), // always cache miss in tests
  setInCache: jest.fn(),
  getCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 900 }),
}))

// Mock market cache (bypass in tests)
jest.unstable_mockModule('../services/marketCache.service.js', () => ({
  buildMarketCacheKey: jest.fn().mockReturnValue('market-test-key'),
  getMarketFromCache: jest.fn().mockReturnValue(null),
  setMarketInCache: jest.fn(),
  getMarketCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 1800 }),
}))

// Mock market provider factory
jest.unstable_mockModule('../providers/market.provider.factory.js', () => ({
  getMarketProvider: jest.fn().mockReturnValue({
    getPrices: jest.fn().mockResolvedValue({
      isDemo: true,
      provider: 'mock-market',
      fetchedAt: new Date().toISOString(),
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
    compareMarkets: jest.fn().mockResolvedValue({
      isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [],
    }),
    getTrend: jest.fn().mockResolvedValue({
      isDemo: true, provider: 'mock-market', fetchedAt: new Date().toISOString(), records: [],
    }),
  }),
  getMarketHealthStatus: jest.fn().mockReturnValue('mock'),
}))

const { getAiProvider } = await import('../providers/ai.provider.factory.js')
const { getWeatherProvider } = await import('../providers/weather.provider.factory.js')
const { getFromCache, setInCache } = await import('../services/weatherCache.service.js')
const { askKnowledge } = await import('../services/rag.service.js')
const { route } = await import('./router.js')
const { INTENT, RESULT_STATUS } = await import('./intents.js')

function makeGenerateResponse(content) {
  return Promise.resolve({
    content,
    model: 'mock-granite',
    provider: 'mock',
    isDemo: true,
  })
}

function classifierResponse(intent) {
  return makeGenerateResponse(
    JSON.stringify({
      primaryIntent: intent,
      secondaryIntents: [],
      confidenceCategory: 'high',
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: intent === INTENT.KNOWLEDGE,
    })
  )
}

describe('Agent Router — GENERAL routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({
      generate: jest.fn()
        .mockImplementationOnce(() => classifierResponse(INTENT.GENERAL))
        .mockResolvedValue({
          content: 'Crop rotation is the practice of growing different crops in sequence.',
          model: 'mock-granite',
          provider: 'mock',
          isDemo: true,
        }),
    })
  })

  it('routes general farming question to GENERAL', async () => {
    const { result } = await route({
      message: 'What is crop rotation?',
      metadata: { requestId: 'test-1' },
    })
    expect(result.intent).toBe(INTENT.GENERAL)
    expect(result.sources).toEqual([])
    expect(result.grounded).toBe(false)
  })

  it('GENERAL result has empty sources (not grounded)', async () => {
    const { result } = await route({
      message: 'Explain drip irrigation.',
      metadata: { requestId: 'test-2' },
    })
    expect(result.sources).toEqual([])
    expect(result.grounded).toBe(false)
  })

  it('GENERAL result agentsUsed includes GeneralAgent', async () => {
    const { result } = await route({
      message: 'What is mulching?',
      metadata: { requestId: 'test-3' },
    })
    expect(result.agentsUsed.some((a) => a.includes('GeneralAgent'))).toBe(true)
  })
})

describe('Agent Router — WEATHER routing (deterministic)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock both the weather provider factory and AI provider
    getAiProvider.mockReturnValue({
      generate: jest.fn().mockResolvedValue({
        content: 'Based on the weather data for Karnal, rain is expected tomorrow.',
        model: 'mock-granite',
        provider: 'mock',
        isDemo: true,
      }),
    })
  })

  it('routes weather query to WEATHER intent with success status', async () => {
    const { result } = await route({
      message: 'Will it rain tomorrow in Karnal?',
      metadata: { requestId: 'test-weather' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    // Phase 10: WEATHER agent is now live — not capability_not_available
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
    expect(result.agentsUsed.some((a) => a.includes('WeatherAgent'))).toBe(true)
    expect(result.grounded).toBe(true)
  })

  it('Weather Agent no longer returns placeholder response', async () => {
    const { result } = await route({
      message: 'Will it rain tomorrow in Karnal?',
      metadata: { requestId: 'test-weather-3' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.answer).not.toMatch(/capability will be connected|Phase 10|not yet connected/i)
  })

  it('Weather Agent returns clarification when no location available', async () => {
    const { result } = await route({
      message: 'Will it rain tomorrow?',
      metadata: { requestId: 'test-weather-noloc' },
      farmerContext: {
        location: { state: null, district: null },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
    expect(result.missingInformation.length).toBeGreaterThan(0)
  })

  it('Weather Agent response does not fabricate weather values', async () => {
    const { result } = await route({
      message: 'Should I irrigate today?',
      metadata: { requestId: 'test-weather-2' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    // Fabricated weather values must not appear in answer
    expect(result.answer).not.toMatch(/^\s*it is currently \d+ degrees/i)
  })

  it('Weather Agent has weather source metadata on success', async () => {
    const { result } = await route({
      message: 'What is the weather in Karnal?',
      metadata: { requestId: 'test-weather-sources' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    if (result.status === RESULT_STATUS.SUCCESS) {
      expect(result.sources.length).toBeGreaterThan(0)
      expect(result.sources[0].sourceType).toBe('weather_api')
    }
  })
})

describe('Agent Router — MARKET routing (Phase 11)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({
      generate: jest.fn().mockResolvedValue({
        content: 'Tomato price at Karnal is approximately ₹980/quintal.',
        model: 'mock-model',
        provider: 'mock',
        isDemo: true,
      }),
    })
  })

  it('routes market price query to MARKET intent', async () => {
    const { result } = await route({
      message: "What is today's tomato price in Karnal mandi?",
      metadata: { requestId: 'test-market' },
    })
    expect(result.intent).toBe(INTENT.MARKET)
    // Phase 11: Market Agent is live — no longer capability_not_available
    expect(result.status).not.toBe(RESULT_STATUS.CAPABILITY_NOT_AVAILABLE)
  })

  it('Market Agent includes appropriate market warnings', async () => {
    const { result } = await route({
      message: 'Current onion mandi price?',
      metadata: { requestId: 'test-market-2' },
    })
    expect(result.intent).toBe(INTENT.MARKET)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('Agent Router — KNOWLEDGE routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    askKnowledge.mockResolvedValue({
      answer: 'Based on the knowledge base, soil health can be improved by...',
      provider: 'watsonx',
      model: 'granite',
      grounded: true,
      sources: [{ documentId: 'doc-1', title: 'Soil Health Guide', organization: 'ICAR' }],
      retrieval: { chunksRetrieved: 3, documentsUsed: 1 },
      isDemo: false,
    })
    getAiProvider.mockReturnValue({
      generate: jest.fn().mockImplementation(() =>
        classifierResponse(INTENT.KNOWLEDGE)
      ),
    })
  })

  it('Knowledge Agent preserves real RAG sources', async () => {
    const { result } = await route({
      message: 'According to the documents, how do I improve soil health?',
      metadata: { requestId: 'test-knowledge' },
    })
    expect(result.intent).toBe(INTENT.KNOWLEDGE)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources[0].documentId).toBe('doc-1')
    expect(result.grounded).toBe(true)
    expect(result.agentsUsed).toContain('KnowledgeAgent')
  })

  it('Knowledge Agent does not invent sources when RAG returns none', async () => {
    askKnowledge.mockResolvedValue({
      answer: 'The knowledge base does not contain enough information...',
      provider: 'none',
      model: null,
      grounded: false,
      sources: [],
      retrieval: { chunksRetrieved: 0, documentsUsed: 0 },
      isDemo: false,
    })
    const { result } = await route({
      message: 'According to the documents, what is quantum computing?',
      metadata: { requestId: 'test-knowledge-empty' },
    })
    expect(result.intent).toBe(INTENT.KNOWLEDGE)
    expect(result.sources).toEqual([])
    expect(result.grounded).toBe(false)
  })
})

describe('Agent Router — MULTI_INTENT routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({
      generate: jest.fn().mockResolvedValue({
        content: 'Rain is expected tomorrow based on the forecast.',
        model: 'mock-granite',
        provider: 'mock',
        isDemo: true,
      }),
    })
  })

  it('routes weather+market query to MULTI_INTENT with both sub-agents', async () => {
    const { result } = await route({
      message: "Will it rain tomorrow in Karnal and what is today's wheat price?",
      metadata: { requestId: 'test-multi' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.MULTI_INTENT)
    // Phase 10: Weather succeeds; Market is still unavailable → partial_success
    const agents = result.agentsUsed.join(' ')
    expect(agents).toContain('WeatherAgent')
    expect(agents).toContain('MarketAgent')
  })

  it('MULTI_INTENT: warnings present when market is unavailable', async () => {
    const { result } = await route({
      message: "Will it rain tomorrow in Karnal and what is today's wheat price?",
      metadata: { requestId: 'test-multi-partial' },
      farmerContext: {
        location: { state: 'Haryana', district: 'Karnal' },
        farm: {},
        cropContext: {},
        preferences: {},
      },
    })
    expect(result.intent).toBe(INTENT.MULTI_INTENT)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('Agent Router — empty message handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({ generate: jest.fn() })
  })

  it('handles empty message with CLARIFICATION', async () => {
    const { result } = await route({
      message: '',
      metadata: { requestId: 'test-empty' },
    })
    expect(result.intent).toBe(INTENT.CLARIFICATION)
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
  })
})

describe('Agent Router — response safety invariants', () => {
  it('GENERAL result has empty sources array (not grounded)', async () => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({
      generate: jest.fn()
        .mockImplementationOnce(() => classifierResponse(INTENT.GENERAL))
        .mockResolvedValue({
          content: 'Mulching is the practice of covering soil...',
          model: 'mock-granite',
          provider: 'mock',
          isDemo: true,
        }),
    })
    const { result } = await route({
      message: 'What is mulching?',
      metadata: { requestId: 'test-sources' },
    })
    expect(result.sources).toEqual([])
  })

  it('routing metadata does not contain hidden chain-of-thought', async () => {
    jest.clearAllMocks()
    getAiProvider.mockReturnValue({
      generate: jest.fn()
        .mockImplementationOnce(() => classifierResponse(INTENT.GENERAL))
        .mockResolvedValue({
          content: 'Answer text',
          model: 'mock-granite',
          provider: 'mock',
          isDemo: true,
        }),
    })
    const { result, routing } = await route({
      message: 'Explain legume benefits.',
      metadata: { requestId: 'test-cot' },
    })
    expect(routing).not.toHaveProperty('classifierReasoning')
    expect(routing).not.toHaveProperty('classifierPrompt')
    expect(result).not.toHaveProperty('classifierOutput')
  })
})
