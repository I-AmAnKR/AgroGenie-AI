/**
 * Weather Provider Factory — Phase 10.
 *
 * Single location for weather provider selection.
 * No scattered process.env checks in agents or services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockWeatherProvider (demo data, no network calls)
 *   USE_MOCK_PROVIDERS=false → RealWeatherProvider (Open-Meteo live API)
 *
 * Open-Meteo requires no authentication, so there is no credential validation
 * here. The real provider will fail gracefully if the API is unreachable.
 *
 * No silent fallback: if real mode is configured, real mode is used.
 * If the real provider fails, a typed WEATHER_* error is thrown.
 */
import config from '../config/env.js'
import { mockWeatherProvider } from './mock/mock-weather.provider.js'
import { realWeatherProvider } from './weather.provider.js'

/**
 * Return the configured weather provider instance.
 *
 * @returns {object} Active weather provider implementing the weather interface.
 */
export function getWeatherProvider() {
  if (config.providers.useMocks) {
    return mockWeatherProvider
  }
  return realWeatherProvider
}

/**
 * Return the weather health status without a live API call.
 *
 * @returns {'mock'|'connected'|'not-configured'}
 */
export function getWeatherHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  const { apiUrl } = config.weather
  if (!apiUrl) return 'not-configured'
  return 'connected'
}
