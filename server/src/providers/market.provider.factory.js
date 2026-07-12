/**
 * Market Provider Factory — Phase 11.
 *
 * Single location for market provider selection.
 * No scattered process.env checks in agents or services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockMarketProvider (demo data, no network calls)
 *   USE_MOCK_PROVIDERS=false → RealMarketProvider (data.gov.in Agmarknet live API)
 *
 * No silent fallback: if real mode is configured, real mode is used.
 * If the real provider is missing configuration (MARKET_API_KEY not set),
 * getMarketProvider() throws MARKET_CONFIGURATION_ERROR instead of silently
 * falling back to mock data. This protects farmers from making selling decisions
 * based on demo prices that appear to be real.
 */
import config from '../config/env.js'
import { mockMarketProvider } from './mock/mock-market.provider.js'
import { realMarketProvider } from './market.provider.js'

/**
 * Return the configured market provider instance.
 *
 * @throws {Error} MARKET_CONFIGURATION_ERROR when real mode is selected without MARKET_API_KEY.
 * @returns {object} Active market provider implementing the market interface.
 */
export function getMarketProvider() {
  if (config.providers.useMocks) {
    return mockMarketProvider
  }

  // Real mode — validate required configuration
  const { apiKey, apiUrl, resourceId } = config.market
  if (!apiKey) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires MARKET_API_KEY. ' +
        'Obtain a key at https://data.gov.in/developers and set it in server/.env. ' +
        'Set USE_MOCK_PROVIDERS=true to use demo market data.'
    )
    err.code = 'MARKET_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  if (!apiUrl || !resourceId) {
    const err = new Error(
      'MARKET_API_URL and MARKET_API_RESOURCE_ID are required for real market data.'
    )
    err.code = 'MARKET_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return realMarketProvider
}

/**
 * Return the market health status without a live API call.
 *
 * @returns {'mock'|'connected'|'not-configured'}
 */
export function getMarketHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  const { apiKey, apiUrl } = config.market
  if (!apiKey || !apiUrl) return 'not-configured'
  return 'connected'
}
