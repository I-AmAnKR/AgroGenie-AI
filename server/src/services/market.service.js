/**
 * Market price service — Phase 11.
 *
 * Delegates to the Market Provider via the provider factory.
 * Used by the market controller for the dedicated market REST endpoints.
 * The Market Agent uses the provider factory directly.
 */
import { getMarketProvider } from '../providers/market.provider.factory.js'

/**
 * Get mandi prices.
 * Returns the provider-neutral result shape: { isDemo, provider, fetchedAt, records }
 *
 * @param {object} filters - { commodity, state, district, market, fromDate, toDate }
 */
export async function getMarketPrices(filters = {}) {
  const provider = getMarketProvider()
  return provider.getPrices(filters)
}

/**
 * Get price trend for a commodity.
 * Returns the provider-neutral result shape: { isDemo, provider, fetchedAt, records }
 *
 * @param {string} commodity
 * @param {string|null} market
 */
export async function getMarketTrend(commodity, market) {
  const provider = getMarketProvider()
  if (typeof provider.getTrend === 'function') {
    return provider.getTrend({ commodity, market })
  }
  // Fallback for providers that don't have getTrend (use compareMarkets)
  return provider.compareMarkets({ commodity })
}
