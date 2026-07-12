/**
 * Mock Weather Provider — Phase 10.
 *
 * Returns clearly identified demo weather data conforming to the normalized
 * weather data contract. Used when USE_MOCK_PROVIDERS=true.
 *
 * All mock data is clearly tagged: isDemo=true, provider="mock-weather".
 * The mock never silently replaces real data — it is always explicit.
 *
 * Interface:
 *   getCurrentWeather({ latitude, longitude, locationName })
 *   getForecast({ latitude, longitude, locationName, days })
 *   getWeatherByLocation({ state, district })
 *   checkReadiness()
 */

import config from '../../config/env.js'

// ── Fixed demo coordinates for mock responses ────────────────────────────────

const DEMO_LOCATION = {
  name: 'Karnal, Haryana',
  district: 'Karnal',
  state: 'Haryana',
  latitude: 29.6857,
  longitude: 76.9905,
}

// ── Mock normalized current weather ─────────────────────────────────────────

function buildMockCurrentWeather(locationOverride) {
  const location = locationOverride ?? DEMO_LOCATION
  return {
    location: {
      name: location.name ?? `${location.district}, ${location.state}`,
      district: location.district ?? null,
      state: location.state ?? null,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    },
    current: {
      observedAt: new Date().toISOString(),
      temperatureC: 28,
      feelsLikeC: 30,
      humidityPercent: 65,
      windSpeedKph: 14,
      precipitationMm: 0,
      condition: 'Partly Cloudy',
    },
    forecast: buildMockForecastDays(config.weather.forecastDays),
    metadata: {
      provider: 'mock-weather',
      fetchedAt: new Date().toISOString(),
      isDemo: true,
    },
  }
}

function buildMockForecastDays(days) {
  const base = [
    { daysAhead: 0, minC: 24, maxC: 32, precipMm: 0,    precipPct: 5,  humidity: 60, wind: 12, condition: 'Sunny' },
    { daysAhead: 1, minC: 23, maxC: 30, precipMm: 2,    precipPct: 20, humidity: 65, wind: 14, condition: 'Partly Cloudy' },
    { daysAhead: 2, minC: 22, maxC: 28, precipMm: 8,    precipPct: 60, humidity: 78, wind: 18, condition: 'Light Rain' },
    { daysAhead: 3, minC: 21, maxC: 26, precipMm: 15,   precipPct: 80, humidity: 85, wind: 20, condition: 'Rain' },
    { daysAhead: 4, minC: 22, maxC: 27, precipMm: 5,    precipPct: 40, humidity: 75, wind: 16, condition: 'Overcast' },
    { daysAhead: 5, minC: 23, maxC: 29, precipMm: 1,    precipPct: 15, humidity: 68, wind: 13, condition: 'Partly Cloudy' },
    { daysAhead: 6, minC: 24, maxC: 31, precipMm: 0,    precipPct: 5,  humidity: 60, wind: 11, condition: 'Sunny' },
  ]
  const today = new Date()
  return base.slice(0, Math.max(1, Math.min(days ?? 7, 7))).map((d) => {
    const date = new Date(today)
    date.setDate(today.getDate() + d.daysAhead)
    return {
      date: date.toISOString().slice(0, 10),
      minTemperatureC: d.minC,
      maxTemperatureC: d.maxC,
      precipitationProbabilityPercent: d.precipPct,
      precipitationMm: d.precipMm,
      humidityPercent: d.humidity,
      windSpeedKph: d.wind,
      condition: d.condition,
    }
  })
}

// ── Mock geocoding lookup (returns fixed demo coords for any district) ────────

const KNOWN_LOCATIONS = {
  'karnal': { name: 'Karnal, Haryana', district: 'Karnal', state: 'Haryana', latitude: 29.6857, longitude: 76.9905 },
  'nashik': { name: 'Nashik, Maharashtra', district: 'Nashik', state: 'Maharashtra', latitude: 19.9975, longitude: 73.7898 },
  'jaipur': { name: 'Jaipur, Rajasthan', district: 'Jaipur', state: 'Rajasthan', latitude: 26.9124, longitude: 75.7873 },
  'ludhiana': { name: 'Ludhiana, Punjab', district: 'Ludhiana', state: 'Punjab', latitude: 30.9010, longitude: 75.8573 },
  'pune': { name: 'Pune, Maharashtra', district: 'Pune', state: 'Maharashtra', latitude: 18.5204, longitude: 73.8567 },
  'indore': { name: 'Indore, Madhya Pradesh', district: 'Indore', state: 'Madhya Pradesh', latitude: 22.7196, longitude: 75.8577 },
}

function resolveKnownLocation(district, state) {
  const key = (district ?? '').toLowerCase()
  return KNOWN_LOCATIONS[key] ?? {
    name: district ? `${district}${state ? ', ' + state : ''}` : 'Demo Location',
    district: district ?? 'Demo',
    state: state ?? null,
    latitude: DEMO_LOCATION.latitude,
    longitude: DEMO_LOCATION.longitude,
  }
}

// ── Provider export ──────────────────────────────────────────────────────────

export const mockWeatherProvider = {
  /**
   * Get current weather + forecast for a coordinate location.
   *
   * @param {object} params
   * @param {number} [params.latitude]
   * @param {number} [params.longitude]
   * @param {string} [params.locationName]
   * @returns {Promise<object>} Normalized weather data
   */
  async getCurrentWeather({ latitude, longitude, locationName } = {}) {
    const location = {
      name: locationName ?? DEMO_LOCATION.name,
      district: null,
      state: null,
      latitude: latitude ?? DEMO_LOCATION.latitude,
      longitude: longitude ?? DEMO_LOCATION.longitude,
    }
    return buildMockCurrentWeather(location)
  },

  /**
   * Get multi-day forecast for a coordinate location.
   *
   * @param {object} params
   * @param {number} [params.latitude]
   * @param {number} [params.longitude]
   * @param {string} [params.locationName]
   * @param {number} [params.days=7]
   * @returns {Promise<object>} Normalized weather data with forecast
   */
  async getForecast({ latitude, longitude, locationName, days = 7 } = {}) {
    const location = {
      name: locationName ?? DEMO_LOCATION.name,
      district: null,
      state: null,
      latitude: latitude ?? DEMO_LOCATION.latitude,
      longitude: longitude ?? DEMO_LOCATION.longitude,
    }
    const data = buildMockCurrentWeather(location)
    data.forecast = buildMockForecastDays(days)
    return data
  },

  /**
   * Get weather by Indian district/state name (mock geocoding + weather).
   *
   * @param {object} params
   * @param {string} [params.state]
   * @param {string} [params.district]
   * @param {number} [params.days=7]
   * @returns {Promise<object>} Normalized weather data
   */
  async getWeatherByLocation({ state, district, days = 7 } = {}) {
    const resolved = resolveKnownLocation(district, state)
    const data = buildMockCurrentWeather(resolved)
    data.forecast = buildMockForecastDays(days)
    return data
  },

  /**
   * Readiness check — always ready in mock mode.
   *
   * @returns {Promise<{ready: boolean, provider: string, isDemo: boolean}>}
   */
  async checkReadiness() {
    return { ready: true, provider: 'mock-weather', isDemo: true }
  },
}
