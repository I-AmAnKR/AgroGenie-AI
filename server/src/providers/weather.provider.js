/**
 * Real Weather Provider — Phase 10.
 *
 * Uses Open-Meteo (https://open-meteo.com) — a free, open-source weather API.
 * No API key or authentication is required.
 * Supports current conditions, hourly data, and up to 16-day forecasts.
 *
 * Credential safety:
 *   - No secrets or credentials are used by this provider.
 *   - The API URL is configurable via env but defaults to the public endpoint.
 *
 * Normalization:
 *   - All external Open-Meteo response structures are converted to the
 *     provider-neutral normalized weather shape before leaving this module.
 *   - No raw API response objects are ever passed to agents or services.
 *
 * Error handling:
 *   - HTTP errors are mapped to typed application-level errors.
 *   - Timeouts use AbortController (no external fetch library needed).
 *   - Raw API error objects are never propagated.
 *
 * Interface:
 *   getCurrentWeather({ latitude, longitude, locationName })
 *   getForecast({ latitude, longitude, locationName, days })
 *   getWeatherByLocation({ state, district, days })
 *   checkReadiness()
 *
 * Open-Meteo current-weather variables used:
 *   temperature_2m, apparent_temperature, relative_humidity_2m,
 *   precipitation, wind_speed_10m, weather_code
 *
 * Open-Meteo daily forecast variables used:
 *   temperature_2m_max, temperature_2m_min, precipitation_sum,
 *   precipitation_probability_max, wind_speed_10m_max,
 *   relative_humidity_2m_max, weather_code
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── WMO Weather Interpretation Code → human-readable condition ───────────────

/**
 * Map Open-Meteo WMO weather interpretation codes to human-readable strings.
 * https://open-meteo.com/en/docs#weathervariables
 *
 * @param {number|null} code
 * @returns {string}
 */
function wmoCodeToCondition(code) {
  if (code === null || code === undefined) return 'Unknown'
  if (code === 0) return 'Clear Sky'
  if (code <= 2) return 'Partly Cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 84) return 'Snow Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

// ── HTTP fetch helper with timeout ──────────────────────────────────────────

/**
 * Fetch a URL with a configurable timeout.
 * Uses the native Node fetch (Node 18+) with AbortController.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────

/**
 * Map a fetch/HTTP error to a typed application-level error.
 * Never exposes raw response bodies or internal SDK objects.
 *
 * @param {Error|object} err
 * @returns {Error}
 */
function mapWeatherError(err) {
  const appErr = new Error()
  const msg = err.message ?? ''
  const status = err._httpStatus ?? 0

  if (msg.includes('abort') || msg.toLowerCase().includes('timeout')) {
    appErr.code = 'WEATHER_TIMEOUT'
    appErr.statusCode = 504
    appErr.message = 'Weather provider request timed out. Please try again.'
    return appErr
  }
  if (status === 401 || status === 403) {
    appErr.code = 'WEATHER_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Weather provider authentication error.'
    return appErr
  }
  if (status === 404) {
    appErr.code = 'WEATHER_LOCATION_NOT_FOUND'
    appErr.statusCode = 404
    appErr.message = 'Weather data not found for the specified location.'
    return appErr
  }
  if (status === 429) {
    appErr.code = 'WEATHER_RATE_LIMIT'
    appErr.statusCode = 429
    appErr.message = 'Weather provider rate limit reached. Please wait and try again.'
    return appErr
  }
  if (status >= 500) {
    appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Weather provider is temporarily unavailable.'
    return appErr
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('network')) {
    appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Cannot reach weather provider. Check your internet connection.'
    return appErr
  }

  appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred while fetching weather data.'
  return appErr
}

// ── Open-Meteo API helpers ────────────────────────────────────────────────

/**
 * Fetch current weather and daily forecast from Open-Meteo.
 *
 * Open-Meteo documentation: https://open-meteo.com/en/docs
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} days
 * @returns {Promise<object>} Raw Open-Meteo JSON response
 */
async function fetchOpenMeteo(latitude, longitude, days) {
  const { apiUrl, requestTimeoutMs } = config.weather

  const currentVars = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'precipitation',
    'wind_speed_10m',
    'weather_code',
  ].join(',')

  const dailyVars = [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
    'relative_humidity_2m_max',
    'weather_code',
  ].join(',')

  const url =
    `${apiUrl}/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=${currentVars}` +
    `&daily=${dailyVars}` +
    `&forecast_days=${days}` +
    `&wind_speed_unit=kmh` +
    `&timezone=Asia%2FKolkata`

  logger.debug('WeatherProvider: fetching Open-Meteo', {
    latitude,
    longitude,
    forecastDays: days,
    // Never log API key — Open-Meteo has none, but keep the discipline
  })

  let response
  try {
    response = await fetchWithTimeout(url, requestTimeoutMs)
  } catch (err) {
    throw mapWeatherError(err)
  }

  if (!response.ok) {
    const httpErr = new Error(`Open-Meteo HTTP ${response.status}`)
    httpErr._httpStatus = response.status
    throw mapWeatherError(httpErr)
  }

  let json
  try {
    json = await response.json()
  } catch {
    const parseErr = new Error('Failed to parse weather provider response')
    parseErr.code = 'WEATHER_RESPONSE_ERROR'
    parseErr.statusCode = 502
    throw parseErr
  }

  return json
}

/**
 * Geocode a city/district name using Open-Meteo Geocoding API.
 * Returns the first matching result's coordinates.
 *
 * @param {string} locationName - City or district name
 * @returns {Promise<{latitude, longitude, name, country}|null>}
 */
async function geocodeLocation(locationName) {
  const { geocodingUrl, requestTimeoutMs } = config.weather

  // Clean the location string
  const cleanedLocation = locationName.trim()

  const query = encodeURIComponent(cleanedLocation)

  const url =
    `${geocodingUrl}/search` +
    `?name=${query}` +
    `&count=5` +
    `&language=en` +
    `&format=json`

  logger.info('WeatherProvider: Geocoding Request', {
    location: cleanedLocation,
    url,
  })

  let response

  try {
    response = await fetchWithTimeout(url, requestTimeoutMs)
  } catch (err) {
    logger.error('WeatherProvider: Geocoding fetch failed', {
      location: cleanedLocation,
      error: err.message,
    })
    return null
  }

  if (!response.ok) {
    logger.error('WeatherProvider: Geocoding HTTP Error', {
      status: response.status,
      location: cleanedLocation,
    })
    return null
  }

  let json

  try {
    json = await response.json()
  } catch (err) {
    logger.error('WeatherProvider: Invalid geocoding JSON', {
      error: err.message,
    })
    return null
  }

  logger.info('WeatherProvider: Geocoding Response', json)

  if (!json.results || json.results.length === 0) {
    logger.error('WeatherProvider: No locations returned', {
      location: cleanedLocation,
    })
    return null
  }

  // Prefer an India result
  const indiaResult =
    json.results.find(
      r =>
        r.country_code === 'IN' ||
        r.country === 'India'
    ) || json.results[0]

  logger.info('WeatherProvider: Selected Location', {
    name: indiaResult.name,
    state: indiaResult.admin1,
    country: indiaResult.country,
    latitude: indiaResult.latitude,
    longitude: indiaResult.longitude,
  })

  return {
    latitude: indiaResult.latitude,
    longitude: indiaResult.longitude,
    name: indiaResult.name,
    admin1: indiaResult.admin1 ?? null,
    country: indiaResult.country ?? null,
  }
}
// ── Response normalization ────────────────────────────────────────────────

/**
 * Normalize an Open-Meteo API response to the provider-neutral weather shape.
 *
 * @param {object} raw - Raw Open-Meteo response
 * @param {object} locationMeta - Location metadata (name, district, state, lat, lon)
 * @returns {object} Normalized weather data
 */
function normalizeOpenMeteoResponse(raw, locationMeta) {
  const cur = raw.current ?? {}
  const daily = raw.daily ?? {}

  // ── Current weather ───────────────────────────────────────────────────
  const current = {
    observedAt: cur.time ? new Date(cur.time).toISOString() : new Date().toISOString(),
    temperatureC: cur.temperature_2m ?? null,
    feelsLikeC: cur.apparent_temperature ?? null,
    humidityPercent: cur.relative_humidity_2m ?? null,
    windSpeedKph: cur.wind_speed_10m ?? null,
    precipitationMm: cur.precipitation ?? null,
    condition: wmoCodeToCondition(cur.weather_code),
  }

  // ── Daily forecast ────────────────────────────────────────────────────
  const dates = daily.time ?? []
  const forecast = dates.map((date, i) => ({
    date,
    minTemperatureC: daily.temperature_2m_min?.[i] ?? null,
    maxTemperatureC: daily.temperature_2m_max?.[i] ?? null,
    precipitationProbabilityPercent: daily.precipitation_probability_max?.[i] ?? null,
    precipitationMm: daily.precipitation_sum?.[i] ?? null,
    humidityPercent: daily.relative_humidity_2m_max?.[i] ?? null,
    windSpeedKph: daily.wind_speed_10m_max?.[i] ?? null,
    condition: wmoCodeToCondition(daily.weather_code?.[i]),
  }))

  return {
    location: {
      name: locationMeta.name,
      district: locationMeta.district ?? null,
      state: locationMeta.state ?? null,
      latitude: locationMeta.latitude ?? raw.latitude ?? null,
      longitude: locationMeta.longitude ?? raw.longitude ?? null,
    },
    current,
    forecast,
    metadata: {
      provider: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      isDemo: false,
    },
  }
}

// ── Provider export ──────────────────────────────────────────────────────────

export const realWeatherProvider = {
  /**
   * Get current weather and forecast for a known coordinate pair.
   *
   * @param {object} params
   * @param {number} params.latitude
   * @param {number} params.longitude
   * @param {string} [params.locationName]
   * @returns {Promise<object>} Normalized weather data
   */
  async getCurrentWeather({ latitude, longitude, locationName } = {}) {
    const { forecastDays } = config.weather
    const raw = await fetchOpenMeteo(latitude, longitude, forecastDays)
    return normalizeOpenMeteoResponse(raw, {
      name: locationName ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      district: null,
      state: null,
      latitude,
      longitude,
    })
  },

  /**
   * Get multi-day forecast for a coordinate location.
   *
   * @param {object} params
   * @param {number} params.latitude
   * @param {number} params.longitude
   * @param {string} [params.locationName]
   * @param {number} [params.days]
   * @returns {Promise<object>} Normalized weather data with forecast
   */
  async getForecast({ latitude, longitude, locationName, days } = {}) {
    const requestDays = days ?? config.weather.forecastDays
    const raw = await fetchOpenMeteo(latitude, longitude, requestDays)
    return normalizeOpenMeteoResponse(raw, {
      name: locationName ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      district: null,
      state: null,
      latitude,
      longitude,
    })
  },

  /**
   * Get weather by Indian district or state name.
   * Geocodes the name to coordinates first, then fetches weather.
   *
   * @param {object} params
   * @param {string} [params.state]
   * @param {string} [params.district]
   * @param {number} [params.days]
   * @returns {Promise<object>} Normalized weather data
   */
  async getWeatherByLocation({ state, district, days } = {}) {
    const requestDays = days ?? config.weather.forecastDays

    // Build geocoding query — prefer "district, state" for accuracy
    const query = district
      ? state
        ? `${district}, ${state}, India`
        : `${district}, India`
      : state
        ? `${state}, India`
        : null

    if (!query) {
      const err = new Error('No location provided for weather lookup.')
      err.code = 'WEATHER_LOCATION_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    logger.info('WeatherProvider: Weather lookup', {
      district,
      state,
      query,
    })

    const geo = await geocodeLocation(query)

    if (!geo) {
      logger.error('WeatherProvider: Geocoding failed', {
      district,
      state,
      query,
    })

  const err = new Error(`Could not find geographic coordinates for "${query}".`)
  err.code = 'WEATHER_LOCATION_NOT_FOUND'
  err.statusCode = 404
  throw err
}
    logger.debug('WeatherProvider: geocoded location', {
      query,
      latitude: geo.latitude,
      longitude: geo.longitude,
    })

    const raw = await fetchOpenMeteo(geo.latitude, geo.longitude, requestDays)

    const locationName = district
      ? `${district}${state ? ', ' + state : ''}`
      : geo.name ?? query

    return normalizeOpenMeteoResponse(raw, {
      name: locationName,
      district: district ?? null,
      state: state ?? geo.admin1 ?? null,
      latitude: geo.latitude,
      longitude: geo.longitude,
    })
  },

  /**
   * Readiness check — validates configuration without a live API call.
   *
   * @returns {Promise<{ready: boolean, provider: string, isDemo: boolean}>}
   */
  async checkReadiness() {
    const { apiUrl } = config.weather
    if (!apiUrl) {
      return { ready: false, provider: 'open-meteo', isDemo: false, reason: 'WEATHER_API_URL not configured' }
    }
    return { ready: true, provider: 'open-meteo', isDemo: false }
  },
}
