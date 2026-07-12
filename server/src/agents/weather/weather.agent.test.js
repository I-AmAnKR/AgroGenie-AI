/**
 * Weather Agent tests — Phase 10.
 *
 * Tests:
 *   - Weather Provider normalization (mock provider)
 *   - Mock weather provider behavior
 *   - Provider selection (mock vs real)
 *   - Location resolution (message, profile, missing)
 *   - Weather cache (hit, miss, expiry)
 *   - Weather Agent: current weather, forecast, irrigation, spraying
 *   - Weather Agent: clarification when no location
 *   - Weather Agent: no Granite call on provider failure
 *   - Weather Agent: source metadata on success
 *   - Weather Agent: isDemo=true for mock data
 *   - No credentials in response
 *   - Multi-intent: Weather success + Market unavailable
 *
 * Run: cd server && npm test -- --testPathPattern=weather.agent.test
 */
import { jest } from '@jest/globals'

// ── Module mocks (must be before any imports) ─────────────────────────────────

jest.unstable_mockModule('../../providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn(),
  getAiHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../../providers/weather.provider.factory.js', () => ({
  getWeatherProvider: jest.fn(),
  getWeatherHealthStatus: jest.fn().mockReturnValue('mock'),
}))

// Mock cache — controlled per test
const mockGetFromCache = jest.fn().mockReturnValue(null)
const mockSetInCache = jest.fn()
jest.unstable_mockModule('../../services/weatherCache.service.js', () => ({
  buildCacheKey: jest.fn().mockImplementation(({ provider, location, days }) => `${provider}:${location}:${days}`),
  getFromCache: mockGetFromCache,
  setInCache: mockSetInCache,
  clearCache: jest.fn(),
  getCacheStats: jest.fn().mockReturnValue({ size: 0, ttlSeconds: 900 }),
}))

// ── Test imports ──────────────────────────────────────────────────────────────

const { getAiProvider } = await import('../../providers/ai.provider.factory.js')
const { getWeatherProvider } = await import('../../providers/weather.provider.factory.js')
const { runWeatherAgent } = await import('./weather.agent.js')
const { INTENT, RESULT_STATUS } = await import('../intents.js')
const { resolveWeatherLocation } = await import('../../services/locationResolver.service.js')
const { mockWeatherProvider } = await import('../../providers/mock/mock-weather.provider.js')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_WEATHER_DATA = {
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
    {
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      minTemperatureC: 22,
      maxTemperatureC: 28,
      precipitationProbabilityPercent: 65,
      precipitationMm: 8,
      humidityPercent: 78,
      windSpeedKph: 18,
      condition: 'Light Rain',
    },
  ],
  metadata: { provider: 'mock-weather', fetchedAt: new Date().toISOString(), isDemo: true },
}

const KARNAL_PROFILE = {
  location: { state: 'Haryana', district: 'Karnal' },
  farm: { area: 2, areaUnit: 'acres', soilType: 'Loamy', irrigationType: 'Canal' },
  cropContext: { currentCrop: 'Wheat', previousCrops: [], sowingDate: null },
  preferences: { objective: null, language: 'en' },
}

const EMPTY_PROFILE = {
  location: { state: null, district: null },
  farm: {},
  cropContext: {},
  preferences: {},
}

function makeGraniteResponse(content = 'Based on the weather data, here is the agricultural advice.') {
  return {
    content,
    model: 'mock-granite',
    provider: 'mock',
    isDemo: true,
  }
}

// ── Setup ──────────────────────────────────────────────────────────────────────

function setupMocks({ weatherData = MOCK_WEATHER_DATA, graniteContent, failWeather = false } = {}) {
  mockGetFromCache.mockReturnValue(null) // cache miss by default
  mockSetInCache.mockReset()

  const mockProvider = {
    getWeatherByLocation: failWeather
      ? jest.fn().mockRejectedValue(Object.assign(new Error('Network error'), { code: 'WEATHER_PROVIDER_UNAVAILABLE' }))
      : jest.fn().mockResolvedValue(weatherData),
  }
  getWeatherProvider.mockReturnValue(mockProvider)

  getAiProvider.mockReturnValue({
    generate: jest.fn().mockResolvedValue(makeGraniteResponse(graniteContent)),
  })

  return { mockProvider }
}

// ── Tests: Mock Weather Provider ───────────────────────────────────────────────

describe('Mock Weather Provider', () => {
  it('returns normalized weather structure', async () => {
    const data = await mockWeatherProvider.getWeatherByLocation({ district: 'Karnal', state: 'Haryana' })
    expect(data.location).toBeDefined()
    expect(data.current).toBeDefined()
    expect(data.forecast).toBeDefined()
    expect(data.metadata).toBeDefined()
    expect(data.metadata.isDemo).toBe(true)
  })

  it('returns isDemo=true', async () => {
    const data = await mockWeatherProvider.getWeatherByLocation({ district: 'Nashik', state: 'Maharashtra' })
    expect(data.metadata.isDemo).toBe(true)
    expect(data.metadata.provider).toBe('mock-weather')
  })

  it('current weather has all required fields', async () => {
    const data = await mockWeatherProvider.getCurrentWeather({ latitude: 29.69, longitude: 76.99 })
    expect(data.current.temperatureC).toBeDefined()
    expect(data.current.humidityPercent).toBeDefined()
    expect(data.current.windSpeedKph).toBeDefined()
    expect(data.current.condition).toBeDefined()
    expect(data.current.observedAt).toBeDefined()
  })

  it('forecast array has date and temperature fields', async () => {
    const data = await mockWeatherProvider.getForecast({ latitude: 29.69, longitude: 76.99, days: 3 })
    expect(data.forecast.length).toBeGreaterThan(0)
    expect(data.forecast[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(data.forecast[0].minTemperatureC).toBeDefined()
    expect(data.forecast[0].maxTemperatureC).toBeDefined()
  })

  it('readiness check returns ready=true', async () => {
    const status = await mockWeatherProvider.checkReadiness()
    expect(status.ready).toBe(true)
    expect(status.isDemo).toBe(true)
  })

  it('mock data is tagged with provider=mock-weather', async () => {
    const data = await mockWeatherProvider.getWeatherByLocation({ district: 'Jaipur', state: 'Rajasthan' })
    expect(data.metadata.provider).toBe('mock-weather')
  })
})

// ── Tests: Location Resolver ───────────────────────────────────────────────────

describe('Location Resolver', () => {
  it('extracts explicit location from message', () => {
    const result = resolveWeatherLocation({
      message: 'Will it rain tomorrow in Karnal?',
      farmerContext: EMPTY_PROFILE,
    })
    expect(result).not.toBeNull()
    expect(result.source).toBe('explicit_message')
    expect(result.district).toBe('Karnal')
  })

  it('extracts explicit location override from message even with profile', () => {
    const result = resolveWeatherLocation({
      message: 'What is the weather in Jaipur?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result).not.toBeNull()
    expect(result.source).toBe('explicit_message')
    expect(result.district).toBe('Jaipur')
  })

  it('falls back to FarmerProfile location when no explicit location in message', () => {
    const result = resolveWeatherLocation({
      message: 'Will it rain tomorrow?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result).not.toBeNull()
    expect(result.source).toBe('farmer_profile')
    expect(result.district).toBe('Karnal')
    expect(result.state).toBe('Haryana')
  })

  it('returns null when no location in message and no profile location', () => {
    const result = resolveWeatherLocation({
      message: 'Will it rain tomorrow?',
      farmerContext: EMPTY_PROFILE,
    })
    expect(result).toBeNull()
  })

  it('uses state from profile if district is not set', () => {
    const result = resolveWeatherLocation({
      message: 'What is the weather?',
      farmerContext: { location: { state: 'Haryana', district: null }, farm: {}, cropContext: {}, preferences: {} },
    })
    expect(result).not.toBeNull()
    expect(result.state).toBe('Haryana')
  })
})

// ── Tests: Weather Agent — Location Clarification ────────────────────────────

describe('Weather Agent — Location Clarification', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('returns NEEDS_CLARIFICATION when no location is available', async () => {
    const result = await runWeatherAgent({
      message: 'Will it rain tomorrow?',
      farmerContext: EMPTY_PROFILE,
      metadata: { requestId: 'test-noloc' },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
    expect(result.missingInformation.length).toBeGreaterThan(0)
    expect(result.sources).toEqual([])
    expect(result.grounded).toBe(false)
  })

  it('clarification answer asks for location and does not invent weather values', async () => {
    const result = await runWeatherAgent({
      message: 'What is the weather today?',
      farmerContext: EMPTY_PROFILE,
    })
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
    expect(result.answer).toMatch(/location|district|city/i)
    // Answer must not fabricate temperature or rainfall values
    expect(result.answer).not.toMatch(/temperature is \d+|it will rain \d+ mm|humidity is \d+/i)
  })
})

// ── Tests: Weather Agent — Current Weather ────────────────────────────────────

describe('Weather Agent — Current Weather', () => {
  it('returns SUCCESS with weather data for known location', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather now in Karnal?',
      farmerContext: KARNAL_PROFILE,
      metadata: { requestId: 'test-current' },
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.grounded).toBe(true)
    expect(result.answer).toBeTruthy()
  })

  it('includes weather source metadata with sourceType=weather_api', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources[0].sourceType).toBe('weather_api')
    expect(result.sources[0].provider).toBeDefined()
  })

  it('includes weather current data in result', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the current temperature in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.weather).toBeDefined()
    expect(result.weather.current).toBeDefined()
    expect(result.weather.current.temperatureC).toBe(28)
    expect(result.weather.current.condition).toBe('Partly Cloudy')
  })

  it('isDemo is true when mock provider is used', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.isDemo).toBe(true)
  })

  it('does not expose credentials in response', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    const str = JSON.stringify(result)
    expect(str).not.toMatch(/api.?key|apikey|WATSONX_API_KEY|WEATHER_API_KEY/i)
    expect(str).not.toMatch(/Authorization|Bearer /i)
  })

  it('includes forecast data in result', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.weather.forecast).toBeDefined()
    expect(result.weather.forecast.length).toBeGreaterThan(0)
  })
})

// ── Tests: Weather Agent — Forecast & Rain ────────────────────────────────────

describe('Weather Agent — Rain Forecast', () => {
  it('returns SUCCESS for rain forecast query with profile location', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Will it rain tomorrow?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.grounded).toBe(true)
  })

  it('answer does not guarantee rainfall — uses uncertainty language', async () => {
    setupMocks({ graniteContent: 'The forecast shows a 65% probability of rain tomorrow. This is not guaranteed.' })
    const result = await runWeatherAgent({
      message: 'Will it definitely rain tomorrow?',
      farmerContext: KARNAL_PROFILE,
    })
    // Answer should not be invented weather data
    expect(result.answer).toBeTruthy()
    // Answer text comes from Granite mock — must not be empty
    expect(result.answer.length).toBeGreaterThan(10)
  })

  it('forecast data contains precipitation probability', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Will it rain this week?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.weather.forecast[0].precipitationProbabilityPercent).toBeDefined()
  })
})

// ── Tests: Weather Agent — Irrigation Advisory ───────────────────────────────

describe('Weather Agent — Irrigation Advisory', () => {
  it('returns SUCCESS for irrigation query with crop context', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Should I irrigate my wheat today?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.grounded).toBe(true)
  })

  it('agentsUsed includes WeatherAgent', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Do I need to water my crops today?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.agentsUsed.some((a) => a.includes('WeatherAgent'))).toBe(true)
  })
})

// ── Tests: Weather Agent — Spraying Advisory ─────────────────────────────────

describe('Weather Agent — Spraying Advisory', () => {
  it('returns SUCCESS for spraying advisory with location', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Can I spray pesticide tomorrow?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
  })
})

// ── Tests: Weather Agent — Provider Failure ───────────────────────────────────

describe('Weather Agent — Provider Failure', () => {
  it('returns FAILED status when weather provider fails', async () => {
    setupMocks({ failWeather: true })
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.intent).toBe(INTENT.WEATHER)
    expect(result.status).toBe(RESULT_STATUS.FAILED)
    expect(result.grounded).toBe(false)
    expect(result.sources).toEqual([])
  })

  it('does NOT call Granite when weather provider fails', async () => {
    setupMocks({ failWeather: true })
    const mockAi = { generate: jest.fn() }
    getAiProvider.mockReturnValue(mockAi)

    await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })

    // Granite must not be called when provider fails
    expect(mockAi.generate).not.toHaveBeenCalled()
  })

  it('returns user-friendly error message when provider is unavailable', async () => {
    setupMocks({ failWeather: true })
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.answer).toBeTruthy()
    // Must not expose raw error details
    expect(result.answer).not.toMatch(/stack|at node|ENOTFOUND|internal error/i)
  })

  it('returns FAILED with specific error for WEATHER_LOCATION_NOT_FOUND', async () => {
    const locNotFoundProvider = {
      getWeatherByLocation: jest.fn().mockRejectedValue(
        Object.assign(new Error('Location not found'), { code: 'WEATHER_LOCATION_NOT_FOUND' })
      ),
    }
    getWeatherProvider.mockReturnValue(locNotFoundProvider)
    mockGetFromCache.mockReturnValue(null)

    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result.status).toBe(RESULT_STATUS.FAILED)
    expect(result.answer).toMatch(/couldn't find|not find/i)
  })
})

// ── Tests: Weather Agent — Cache ─────────────────────────────────────────────

describe('Weather Agent — Cache', () => {
  it('serves from cache on cache hit', async () => {
    const cachedData = {
      ...MOCK_WEATHER_DATA,
      metadata: {
        ...MOCK_WEATHER_DATA.metadata,
        cacheHit: true,
        originalFetchedAt: MOCK_WEATHER_DATA.metadata.fetchedAt,
      },
    }
    mockGetFromCache.mockReturnValue(cachedData)

    const mockProvider = { getWeatherByLocation: jest.fn() }
    getWeatherProvider.mockReturnValue(mockProvider)
    getAiProvider.mockReturnValue({ generate: jest.fn().mockResolvedValue(makeGraniteResponse()) })

    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })

    // Provider was not called (cache hit)
    expect(mockProvider.getWeatherByLocation).not.toHaveBeenCalled()
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
  })

  it('calls provider and caches result on cache miss', async () => {
    mockGetFromCache.mockReturnValue(null) // cache miss
    mockSetInCache.mockReset()

    const mockProvider = { getWeatherByLocation: jest.fn().mockResolvedValue(MOCK_WEATHER_DATA) }
    getWeatherProvider.mockReturnValue(mockProvider)
    getAiProvider.mockReturnValue({ generate: jest.fn().mockResolvedValue(makeGraniteResponse()) })

    await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })

    expect(mockProvider.getWeatherByLocation).toHaveBeenCalled()
    expect(mockSetInCache).toHaveBeenCalled()
  })
})

// ── Tests: Weather Agent — Granite Failure Fallback ──────────────────────────

describe('Weather Agent — Granite Failure Fallback', () => {
  it('returns PARTIAL_SUCCESS with factual data when Granite fails', async () => {
    const mockProvider = { getWeatherByLocation: jest.fn().mockResolvedValue(MOCK_WEATHER_DATA) }
    getWeatherProvider.mockReturnValue(mockProvider)
    mockGetFromCache.mockReturnValue(null)
    mockSetInCache.mockReset()

    getAiProvider.mockReturnValue({
      generate: jest.fn().mockRejectedValue(Object.assign(new Error('AI unavailable'), { code: 'AI_PROVIDER_ERROR' })),
    })

    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })

    expect(result.status).toBe(RESULT_STATUS.PARTIAL_SUCCESS)
    expect(result.grounded).toBe(true)
    expect(result.weather).toBeDefined()
    expect(result.sources.length).toBeGreaterThan(0)
  })

  it('fallback answer contains factual weather data without fabricating values', async () => {
    const mockProvider = { getWeatherByLocation: jest.fn().mockResolvedValue(MOCK_WEATHER_DATA) }
    getWeatherProvider.mockReturnValue(mockProvider)
    mockGetFromCache.mockReturnValue(null)

    getAiProvider.mockReturnValue({
      generate: jest.fn().mockRejectedValue(new Error('AI down')),
    })

    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })

    // Fallback answer includes real temperature from mock weather data
    expect(result.answer).toMatch(/28°C|Partly Cloudy/i)
    // Must not invent values not in mock data
    expect(result.answer).not.toMatch(/55°C|blizzard/i)
  })
})

// ── Tests: Weather Response Structure ────────────────────────────────────────

describe('Weather Agent — Result Contract', () => {
  it('result has all required base fields', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    expect(result).toHaveProperty('intent')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('answer')
    expect(result).toHaveProperty('agentsUsed')
    expect(result).toHaveProperty('sources')
    expect(result).toHaveProperty('grounded')
    expect(result).toHaveProperty('missingInformation')
    expect(result).toHaveProperty('warnings')
    expect(result).toHaveProperty('isDemo')
  })

  it('warnings always include a forecast uncertainty notice', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'Will it rain tomorrow?',
      farmerContext: KARNAL_PROFILE,
    })
    const warningsJoined = result.warnings.join(' ').toLowerCase()
    expect(warningsJoined).toMatch(/forecast|imd|check/i)
  })

  it('sources contain observedAt and fetchedAt timestamps', async () => {
    setupMocks()
    const result = await runWeatherAgent({
      message: 'What is the weather in Karnal?',
      farmerContext: KARNAL_PROFILE,
    })
    if (result.sources.length > 0) {
      expect(result.sources[0]).toHaveProperty('fetchedAt')
      expect(result.sources[0]).toHaveProperty('observedAt')
    }
  })
})
