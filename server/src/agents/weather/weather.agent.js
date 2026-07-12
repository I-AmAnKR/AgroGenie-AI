/**
 * Weather Agent — Phase 10.
 *
 * Replaces the Phase 9 placeholder with a real implementation.
 *
 * Flow:
 *   1. Receive farmer message + FarmerProfile context
 *   2. Resolve location (explicit message → FarmerProfile → clarification)
 *   3. Check weather cache
 *   4. Fetch weather data from Weather Provider (real or mock)
 *   5. Detect weather query type (current/forecast/irrigation/spraying/etc.)
 *   6. Call IBM Granite for practical agricultural interpretation
 *   7. Return normalized Agent Result with weather data and source metadata
 *
 * Safety rules:
 *   - NEVER call Granite if weather data retrieval fails.
 *   - NEVER let Granite invent weather values.
 *   - NEVER silently fall back to mock data in real mode.
 *   - NEVER fabricate weather if no location is available — request clarification.
 *   - All weather values in the answer must come from provider data.
 *
 * The Agent Router selects this agent for WEATHER intent.
 * Controllers must not call this agent directly.
 */
import { getWeatherProvider } from '../../providers/weather.provider.factory.js'
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { resolveWeatherLocation } from '../../services/locationResolver.service.js'
import { buildCacheKey, getFromCache, setInCache } from '../../services/weatherCache.service.js'
import { buildWeatherAgentSystemPrompt, buildWeatherAgentUserMessage } from './weather.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import config from '../../config/env.js'
import logger from '../../utils/logger.js'

// ── Query type detection ──────────────────────────────────────────────────────

/**
 * Supported weather query types with their deterministic detection patterns.
 */
const QUERY_TYPES = {
  CURRENT_WEATHER: {
    label: 'CURRENT_WEATHER',
    patterns: [
      /\b(what is|what's|how is|how's)\b.*\bweather\b/i,
      /\bweather (now|today|current|right now)\b/i,
      /\bcurrent (weather|temperature|temp|conditions?)\b/i,
      /\bhow (hot|cold|warm|cool) (is it|today)\b/i,
    ],
  },
  RAIN_FORECAST: {
    label: 'RAIN_FORECAST',
    patterns: [
      /\b(will|is it going to|chance of|probability of|expect)\b.*\brain\b/i,
      /\brain.*\b(today|tomorrow|this week|next week)\b/i,
      /\b(today|tomorrow|this week).*\brain\b/i,
      /\brainfall (forecast|expected|coming)\b/i,
      /\bkya.*baarish\b/i,
    ],
  },
  IRRIGATION_ADVISORY: {
    label: 'IRRIGATION_ADVISORY',
    patterns: [
      /\b(should i|can i|do i need to)\b.*\b(irrigat|water)\b/i,
      /\b(irrigat|watering|water).*(today|tomorrow|now)\b/i,
      /\birrigation.*advice\b/i,
      /\bwhen.*irrigat\b/i,
    ],
  },
  SPRAYING_ADVISORY: {
    label: 'SPRAYING_ADVISORY',
    patterns: [
      /\b(can i|should i|is it.*safe.*to|suitable.*for)\b.*\b(spray|pesticide|fungicide|herbicide|insecticide)\b/i,
      /\bspray.*(today|tomorrow|this week)\b/i,
      /\b(pesticide|fungicide|herbicide|insecticide).*spray/i,
      /\bspraying.*condition/i,
    ],
  },
  SOWING_WINDOW: {
    label: 'SOWING_WINDOW',
    patterns: [
      /\b(sow|sowing|planting|plant)\b.*(suitable|good|right|safe|ok|okay)\b/i,
      /\b(suitable|right|good|safe)\b.*\b(sow|sowing|planting|plant)\b/i,
      /\bsowing (window|time|date|period)\b/i,
      /\bwhen (to sow|to plant|should i sow|should i plant)\b/i,
    ],
  },
  HARVEST_ADVISORY: {
    label: 'HARVEST_ADVISORY',
    patterns: [
      /\b(harvest|harvesting)\b.*(before|after|rain|safe|suitable)\b/i,
      /\bwhen.*harvest\b/i,
      /\bharvest.*rain\b/i,
      /\bshould.*harvest\b/i,
    ],
  },
  HEAT_STRESS: {
    label: 'HEAT_STRESS',
    patterns: [
      /\b(heat|hot|temperature|high temp)\b.*(crop|plant|stress|affect|damage)\b/i,
      /\bheat stress\b/i,
      /\b(too hot|extreme heat|heat wave)\b/i,
    ],
  },
  WIND_RISK: {
    label: 'WIND_RISK',
    patterns: [
      /\b(wind|windy|storm)\b.*(spray|crop|harvest|sow|plant)\b/i,
      /\bwind (speed|risk|too strong|safe)\b/i,
      /\bstronger? wind\b/i,
    ],
  },
  GENERAL_FORECAST: {
    label: 'GENERAL_FORECAST',
    patterns: [], // fallback — all other queries
  },
}

/**
 * Detect the weather query type from the farmer's message.
 *
 * @param {string} message
 * @returns {string} Query type label
 */
function detectQueryType(message) {
  for (const [, qtype] of Object.entries(QUERY_TYPES)) {
    if (qtype.patterns.length === 0) continue // skip GENERAL_FORECAST here
    if (qtype.patterns.some((p) => p.test(message))) {
      return qtype.label
    }
  }
  return 'GENERAL_FORECAST'
}

// ── Granite advisory call ─────────────────────────────────────────────────────

/**
 * Call IBM Granite to generate agricultural interpretation of the weather data.
 * Only called after successful weather data retrieval.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's original question
 * @param {object} params.weatherData - Normalized weather data
 * @param {object} params.farmerContext - FarmerProfile context
 * @param {string} params.queryType - Detected query type
 * @param {string} [params.language='en'] - Language code
 * @param {object} [params.metadata={}] - Request metadata
 * @returns {Promise<{content, model, provider, isDemo}>}
 */
async function callGraniteAdvisory({ message, weatherData, farmerContext, memoryContext = null, queryType, language = 'en', metadata = {} }) {
  const aiProvider = getAiProvider()
  const systemPrompt = buildWeatherAgentSystemPrompt(language)
  const userMessage = buildWeatherAgentUserMessage({
    message,
    weatherData,
    farmerContext,
    memoryContext,
    queryType,
  })

  return aiProvider.generate({
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt,
    parameters: {
      max_tokens: 700,
      temperature: 0.2,
      top_p: 0.9,
    },
    metadata,
  })
}

// ── Weather source metadata ───────────────────────────────────────────────────

/**
 * Build the sources array for the agent result from normalized weather data.
 *
 * @param {object} weatherData - Normalized weather data
 * @param {object} resolvedLocation - Location resolution result
 * @returns {object[]}
 */
function buildWeatherSources(weatherData, resolvedLocation) {
  return [
    {
      sourceType: 'weather_api',
      provider: weatherData.metadata?.provider ?? 'unknown',
      location: weatherData.location?.name ?? resolvedLocation?.locationName ?? 'unknown',
      observedAt: weatherData.current?.observedAt ?? null,
      fetchedAt: weatherData.metadata?.fetchedAt ?? null,
      originalFetchedAt: weatherData.metadata?.originalFetchedAt ?? null,
      cacheHit: weatherData.metadata?.cacheHit === true,
      isDemo: weatherData.metadata?.isDemo === true,
    },
  ]
}

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run the Weather Agent.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's weather question
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {object} [params.memoryContext=null] - Conversation memory context
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runWeatherAgent({ message, farmerContext = {}, memoryContext = null, language = 'en', metadata = {} }) {
  const start = Date.now()
  logger.info('WeatherAgent: starting', { requestId: metadata.requestId })

  // ── Step 1: Resolve location ──────────────────────────────────────────
  const resolvedLocation = resolveWeatherLocation({ message, farmerContext, metadata })

  if (!resolvedLocation) {
    logger.info('WeatherAgent: no location found — requesting clarification', {
      requestId: metadata.requestId,
    })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.WEATHER,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer:
          'To provide weather information, I need to know your location. ' +
          'Which district or city should I check the weather for? ' +
          'For example: "Karnal", "Nashik", or "Jaipur".',
        agentsUsed: ['WeatherAgent'],
        sources: [],
        grounded: false,
        missingInformation: ['Location (district or city name)'],
        warnings: [],
        isDemo: config.providers.useMocks,
        provider: null,
      })
    )
  }

  // ── Step 2: Detect query type ─────────────────────────────────────────
  const queryType = detectQueryType(message)
  logger.debug('WeatherAgent: detected query type', {
    requestId: metadata.requestId,
    queryType,
    location: resolvedLocation.locationName,
  })

  // ── Step 3: Check weather cache ───────────────────────────────────────
  const weatherProvider = getWeatherProvider()
  const providerName = config.providers.useMocks ? 'mock-weather' : 'open-meteo'
  const cacheKey = buildCacheKey({
    provider: providerName,
    location: resolvedLocation.locationName,
    days: config.weather.forecastDays,
  })

  let weatherData = getFromCache(cacheKey)
  let cacheUsed = false

  if (weatherData) {
    cacheUsed = true
    logger.info('WeatherAgent: serving from cache', {
      requestId: metadata.requestId,
      cacheKey,
    })
  } else {
    // ── Step 4: Fetch weather data ─────────────────────────────────────
    try {
      weatherData = await weatherProvider.getWeatherByLocation({
        district: resolvedLocation.district,
        state: resolvedLocation.state,
        days: config.weather.forecastDays,
      })
      setInCache(cacheKey, weatherData)

      logger.info('WeatherAgent: weather data fetched', {
        requestId: metadata.requestId,
        provider: providerName,
        location: weatherData.location?.name,
        isDemo: weatherData.metadata?.isDemo,
      })
    } catch (err) {
      // SAFETY: Do NOT call Granite if weather data retrieval failed.
      logger.error('WeatherAgent: weather provider failed', {
        requestId: metadata.requestId,
        code: err.code ?? 'UNKNOWN',
        location: resolvedLocation.locationName,
      })

      // Map error code to user-friendly message
      const errorMessages = {
        WEATHER_LOCATION_NOT_FOUND: `I couldn't find weather data for "${resolvedLocation.locationName}". Please check the location name and try again.`,
        WEATHER_TIMEOUT: `The weather service took too long to respond for "${resolvedLocation.locationName}". Please try again in a moment.`,
        WEATHER_RATE_LIMIT: 'The weather service is currently busy. Please try again in a few minutes.',
        WEATHER_PROVIDER_UNAVAILABLE: 'The weather service is temporarily unavailable. Please try again shortly.',
        WEATHER_AUTH_ERROR: 'There is a configuration issue with the weather service. Please contact support.',
      }
      const userMessage =
        errorMessages[err.code] ??
        `I couldn't retrieve current weather information for "${resolvedLocation.locationName}" right now. Please try again shortly.`

      return normalizeAgentResult(
        createAgentResult({
          intent: INTENT.WEATHER,
          status: RESULT_STATUS.FAILED,
          answer: userMessage,
          agentsUsed: ['WeatherAgent'],
          sources: [],
          grounded: false,
          warnings: ['Weather data retrieval failed.'],
          isDemo: config.providers.useMocks,
          provider: null,
        })
      )
    }
  }

  // ── Step 5: Call Granite for agricultural interpretation ──────────────
  let aiResult
  try {
    aiResult = await callGraniteAdvisory({
      message,
      weatherData,
      farmerContext,
      memoryContext,
      queryType,
      language,
      metadata,
    })
  } catch (err) {
    // If Granite fails, return weather data with a fallback summary (no fabrication)
    logger.error('WeatherAgent: Granite advisory failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })

    const fallbackAnswer = buildFallbackAnswer(weatherData, resolvedLocation)
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.WEATHER,
        status: RESULT_STATUS.PARTIAL_SUCCESS,
        answer: fallbackAnswer,
        agentsUsed: ['WeatherAgent', `Weather Provider (${providerName})`],
        sources: buildWeatherSources(weatherData, resolvedLocation),
        grounded: true,
        warnings: [
          'AI advisory generation failed. Weather data shown without detailed interpretation.',
          'Weather forecasts may change. Check imd.gov.in for official forecasts.',
        ],
        isDemo: weatherData.metadata?.isDemo === true,
        provider: null,
        weather: {
          current: weatherData.current,
          forecast: weatherData.forecast,
        },
      })
    )
  }

  const durationMs = Date.now() - start
  logger.info('WeatherAgent: complete', {
    requestId: metadata.requestId,
    queryType,
    location: resolvedLocation.locationName,
    locationSource: resolvedLocation.source,
    provider: providerName,
    cacheUsed,
    isDemo: weatherData.metadata?.isDemo,
    durationMs,
  })

  // ── Step 6: Build normalized result ──────────────────────────────────
  const agentsUsed = [
    'WeatherAgent',
    `Weather Provider (${providerName})`,
    aiResult.isDemo ? 'Mock AI' : 'IBM Granite',
  ]

  const warnings = [
    'Weather forecasts may change. Check imd.gov.in for official forecasts.',
  ]
  if (weatherData.metadata?.isDemo) {
    warnings.unshift('Demonstration data — not live weather. Set USE_MOCK_PROVIDERS=false for live data.')
  }

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.WEATHER,
      status: RESULT_STATUS.SUCCESS,
      answer: aiResult.content,
      agentsUsed,
      sources: buildWeatherSources(weatherData, resolvedLocation),
      grounded: true,
      missingInformation: [],
      warnings,
      provider: aiResult.provider ?? null,
      model: aiResult.model ?? null,
      isDemo: weatherData.metadata?.isDemo === true,
      // Attach normalized weather data for frontend rendering
      weather: {
        current: weatherData.current,
        forecast: weatherData.forecast,
      },
    })
  )
}

// ── Fallback answer builder ───────────────────────────────────────────────────

/**
 * Build a factual-only answer when Granite is unavailable.
 * Only uses values from the normalized weather data — never fabricates.
 *
 * @param {object} weatherData
 * @param {object} resolvedLocation
 * @returns {string}
 */
function buildFallbackAnswer(weatherData, resolvedLocation) {
  const { location, current, forecast } = weatherData
  const lines = []

  lines.push(`**Current weather for ${location?.name ?? resolvedLocation?.locationName ?? 'your location'}:**`)

  if (current) {
    if (current.temperatureC !== null) lines.push(`- Temperature: ${current.temperatureC}°C`)
    if (current.feelsLikeC !== null) lines.push(`- Feels like: ${current.feelsLikeC}°C`)
    if (current.humidityPercent !== null) lines.push(`- Humidity: ${current.humidityPercent}%`)
    if (current.windSpeedKph !== null) lines.push(`- Wind speed: ${current.windSpeedKph} km/h`)
    if (current.precipitationMm !== null) lines.push(`- Current precipitation: ${current.precipitationMm} mm`)
    if (current.condition) lines.push(`- Condition: ${current.condition}`)
  }

  if (forecast && forecast.length > 0) {
    lines.push('')
    lines.push('**Upcoming forecast (AI interpretation unavailable):**')
    for (const day of forecast.slice(0, 3)) {
      const parts = [day.date]
      if (day.minTemperatureC !== null && day.maxTemperatureC !== null) {
        parts.push(`${day.minTemperatureC}–${day.maxTemperatureC}°C`)
      }
      if (day.precipitationProbabilityPercent !== null) {
        parts.push(`Rain: ${day.precipitationProbabilityPercent}%`)
      }
      if (day.condition) parts.push(day.condition)
      lines.push(`- ${parts.join(' | ')}`)
    }
  }

  lines.push('')
  lines.push('For detailed agricultural advice, please try again in a moment.')

  return lines.join('\n')
}
