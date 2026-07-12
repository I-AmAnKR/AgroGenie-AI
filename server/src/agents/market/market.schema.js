/**
 * Market Agent schema — Phase 11.
 *
 * Defines the Market Agent result contract for documentation and testing.
 */
export const MARKET_AGENT_SCHEMA = {
  intent: 'MARKET',
  agentsUsed: ['MarketAgent', 'Market Provider', 'Market Analytics', 'IBM Granite'],
  supportedQueryTypes: [
    'CURRENT_PRICE',
    'LATEST_AVAILABLE_PRICE',
    'MARKET_COMPARISON',
    'PRICE_RANGE',
    'PRICE_TREND',
    'BEST_REPORTED_MARKET',
    'COMMODITY_SEARCH',
  ],
  recordShape: {
    commodity: 'string',
    variety: 'string|null',
    state: 'string',
    district: 'string',
    market: 'string',
    priceDate: 'YYYY-MM-DD',
    minPrice: 'number|null (INR per quintal)',
    maxPrice: 'number|null (INR per quintal)',
    modalPrice: 'number|null (INR per quintal)',
    unit: 'INR_PER_QUINTAL',
    arrivals: 'number|null',
    arrivalsUnit: 'string|null',
    metadata: {
      provider: 'string',
      fetchedAt: 'ISO8601',
      isDemo: 'boolean',
    },
  },
  sourceShape: {
    sourceType: 'market_api',
    provider: 'string',
    commodity: 'string',
    market: 'string',
    district: 'string',
    state: 'string',
    priceDate: 'YYYY-MM-DD',
    fetchedAt: 'ISO8601',
    isDemo: 'boolean',
    cacheHit: 'boolean',
  },
}
