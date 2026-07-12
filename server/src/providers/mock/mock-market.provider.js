/**
 * Mock Market Provider — Phase 11.
 *
 * Returns structured demo mandi price data for development and testing.
 *
 * All mock results are visibly marked with isDemo: true.
 * Mock prices must NEVER be silently returned in real mode.
 *
 * Mock data covers:
 *   - Multiple commodities: Tomato, Wheat, Onion, Soybean, Cotton
 *   - Multiple states and districts
 *   - Realistic price spread (min/max/modal per quintal)
 *   - Multiple dates for trend analysis
 *
 * Data format matches the provider-neutral normalized record shape
 * defined in marketNormalizer.service.js.
 */

import { UNIT } from '../../services/marketNormalizer.service.js'

// ── Static demo records ───────────────────────────────────────────────────────

/** Get today's date and recent dates in YYYY-MM-DD format */
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const MOCK_RECORDS = [
  // Tomato — Nashik region (Maharashtra)
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(1), minPrice: 800, maxPrice: 1500, modalPrice: 1100, unit: UNIT.INR_PER_QUINTAL, arrivals: 12, arrivalsUnit: 'Tonnes' },
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Pune', market: 'Pune', priceDate: daysAgo(1), minPrice: 750, maxPrice: 1400, modalPrice: 1050, unit: UNIT.INR_PER_QUINTAL, arrivals: 8, arrivalsUnit: 'Tonnes' },
  { commodity: 'Tomato', variety: 'Hybrid', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Pimpalgaon Baswant', priceDate: daysAgo(1), minPrice: 900, maxPrice: 1600, modalPrice: 1200, unit: UNIT.INR_PER_QUINTAL, arrivals: 15, arrivalsUnit: 'Tonnes' },
  // Tomato — Karnal (Haryana)
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(1), minPrice: 700, maxPrice: 1300, modalPrice: 980, unit: UNIT.INR_PER_QUINTAL, arrivals: 6, arrivalsUnit: 'Tonnes' },

  // Wheat — Haryana region
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(1), minPrice: 2100, maxPrice: 2350, modalPrice: 2250, unit: UNIT.INR_PER_QUINTAL, arrivals: 120, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Ambala', market: 'Ambala', priceDate: daysAgo(1), minPrice: 2050, maxPrice: 2300, modalPrice: 2200, unit: UNIT.INR_PER_QUINTAL, arrivals: 90, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Punjab', district: 'Ludhiana', market: 'Ludhiana', priceDate: daysAgo(1), minPrice: 2120, maxPrice: 2380, modalPrice: 2280, unit: UNIT.INR_PER_QUINTAL, arrivals: 200, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Rajasthan', district: 'Jaipur', market: 'Jaipur', priceDate: daysAgo(2), minPrice: 2000, maxPrice: 2250, modalPrice: 2150, unit: UNIT.INR_PER_QUINTAL, arrivals: 75, arrivalsUnit: 'Tonnes' },

  // Onion — Maharashtra
  { commodity: 'Onion', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(1), minPrice: 1200, maxPrice: 2100, modalPrice: 1750, unit: UNIT.INR_PER_QUINTAL, arrivals: 180, arrivalsUnit: 'Tonnes' },
  { commodity: 'Onion', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Pimpalgaon Baswant', priceDate: daysAgo(1), minPrice: 1150, maxPrice: 2050, modalPrice: 1680, unit: UNIT.INR_PER_QUINTAL, arrivals: 150, arrivalsUnit: 'Tonnes' },
  { commodity: 'Onion', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Malegaon', priceDate: daysAgo(1), minPrice: 1300, maxPrice: 2200, modalPrice: 1800, unit: UNIT.INR_PER_QUINTAL, arrivals: 90, arrivalsUnit: 'Tonnes' },

  // Soybean — Maharashtra
  { commodity: 'Soybean', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Latur', market: 'Latur', priceDate: daysAgo(1), minPrice: 4100, maxPrice: 4600, modalPrice: 4380, unit: UNIT.INR_PER_QUINTAL, arrivals: 45, arrivalsUnit: 'Tonnes' },

  // Cotton
  { commodity: 'Cotton', variety: 'Medium Staple', grade: 'FAQ', state: 'Maharashtra', district: 'Jalgaon', market: 'Jalgaon', priceDate: daysAgo(1), minPrice: 6200, maxPrice: 7100, modalPrice: 6650, unit: UNIT.INR_PER_QUINTAL, arrivals: 30, arrivalsUnit: 'Tonnes' },

  // Potato — Uttar Pradesh
  { commodity: 'Potato', variety: 'Desi', grade: 'FAQ', state: 'Uttar Pradesh', district: 'Agra', market: 'Agra', priceDate: daysAgo(1), minPrice: 600, maxPrice: 900, modalPrice: 750, unit: UNIT.INR_PER_QUINTAL, arrivals: 200, arrivalsUnit: 'Tonnes' },
  { commodity: 'Potato', variety: 'Desi', grade: 'FAQ', state: 'Uttar Pradesh', district: 'Lucknow', market: 'Lucknow', priceDate: daysAgo(1), minPrice: 650, maxPrice: 950, modalPrice: 800, unit: UNIT.INR_PER_QUINTAL, arrivals: 150, arrivalsUnit: 'Tonnes' },
]

// ── Multi-date records for trend analysis ─────────────────────────────────────

const WHEAT_TREND_RECORDS = [
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(7), minPrice: 2050, maxPrice: 2280, modalPrice: 2150, unit: UNIT.INR_PER_QUINTAL, arrivals: 110, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(5), minPrice: 2080, maxPrice: 2310, modalPrice: 2190, unit: UNIT.INR_PER_QUINTAL, arrivals: 115, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(3), minPrice: 2100, maxPrice: 2340, modalPrice: 2220, unit: UNIT.INR_PER_QUINTAL, arrivals: 118, arrivalsUnit: 'Tonnes' },
  { commodity: 'Wheat', variety: 'Desi', grade: 'FAQ', state: 'Haryana', district: 'Karnal', market: 'Karnal', priceDate: daysAgo(1), minPrice: 2100, maxPrice: 2350, modalPrice: 2250, unit: UNIT.INR_PER_QUINTAL, arrivals: 120, arrivalsUnit: 'Tonnes' },
]

const TOMATO_TREND_RECORDS = [
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(7), minPrice: 1100, maxPrice: 1900, modalPrice: 1500, unit: UNIT.INR_PER_QUINTAL, arrivals: 11, arrivalsUnit: 'Tonnes' },
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(5), minPrice: 950, maxPrice: 1700, modalPrice: 1300, unit: UNIT.INR_PER_QUINTAL, arrivals: 12, arrivalsUnit: 'Tonnes' },
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(3), minPrice: 850, maxPrice: 1550, modalPrice: 1150, unit: UNIT.INR_PER_QUINTAL, arrivals: 13, arrivalsUnit: 'Tonnes' },
  { commodity: 'Tomato', variety: 'Local', grade: 'FAQ', state: 'Maharashtra', district: 'Nashik', market: 'Lasalgaon', priceDate: daysAgo(1), minPrice: 800, maxPrice: 1500, modalPrice: 1100, unit: UNIT.INR_PER_QUINTAL, arrivals: 12, arrivalsUnit: 'Tonnes' },
]

// ── Provider implementation ───────────────────────────────────────────────────

/**
 * Add metadata to a list of normalized records.
 *
 * @param {object[]} records
 * @returns {object[]}
 */
function withMeta(records) {
  const fetchedAt = new Date().toISOString()
  return records.map((r) => ({
    ...r,
    metadata: { provider: 'mock-market', fetchedAt, isDemo: true },
  }))
}

export const mockMarketProvider = {
  /**
   * Get mandi price records for a commodity and optional location filters.
   *
   * @param {object} params
   * @param {string} [params.commodity]
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {string|null} [params.market]
   * @param {number} [params.limit]
   * @returns {Promise<object>} { isDemo, provider, fetchedAt, records }
   */
  async getPrices({ commodity, state, district, market, limit } = {}) {
    const fetchedAt = new Date().toISOString()

    let base = [...MOCK_RECORDS]

    if (commodity) {
      const q = commodity.toLowerCase()
      base = base.filter((r) => r.commodity.toLowerCase() === q || r.commodity.toLowerCase().includes(q))
    }
    if (state) {
      const q = state.toLowerCase()
      base = base.filter((r) => r.state.toLowerCase().includes(q))
    }
    if (district) {
      const q = district.toLowerCase()
      base = base.filter((r) => r.district.toLowerCase().includes(q))
    }
    if (market) {
      const q = market.toLowerCase()
      base = base.filter((r) => r.market.toLowerCase().includes(q))
    }

    // Limit records
    const maxRecs = limit ?? 50
    const limited = base.slice(0, maxRecs)
    const records = withMeta(limited)

    return { isDemo: true, provider: 'mock-market', fetchedAt, records }
  },

  /**
   * Get multi-date records for trend analysis.
   * Returns extra historical records for well-known commodities.
   *
   * @param {object} params
   * @param {string} params.commodity
   * @param {string|null} [params.state]
   * @param {string|null} [params.district]
   * @param {number} [params.limit]
   * @returns {Promise<object>}
   */
  async compareMarkets({ commodity, state, district, limit } = {}) {
    return this.getPrices({ commodity, state, district, limit: limit ?? 50 })
  },

  /**
   * Get historical trend records for a commodity at a specific market.
   * Returns multi-date records for supported commodities.
   *
   * @param {object} params
   * @param {string} params.commodity
   * @param {string|null} [params.market]
   * @returns {Promise<object>}
   */
  async getTrend({ commodity, market } = {}) {
    const fetchedAt = new Date().toISOString()
    const q = (commodity ?? '').toLowerCase()

    let trendRecords = []
    if (q.includes('wheat')) {
      trendRecords = WHEAT_TREND_RECORDS
    } else if (q.includes('tomato')) {
      trendRecords = TOMATO_TREND_RECORDS
    } else {
      // Return the base records for other commodities (single date — trend will be insufficient_data)
      trendRecords = MOCK_RECORDS.filter((r) => r.commodity.toLowerCase().includes(q))
    }

    const filtered = market
      ? trendRecords.filter((r) => r.market.toLowerCase().includes(market.toLowerCase()))
      : trendRecords

    return { isDemo: true, provider: 'mock-market', fetchedAt, records: withMeta(filtered) }
  },

  /**
   * Search available commodities.
   *
   * @param {object} params
   * @param {string} params.query
   * @returns {Promise<object>}
   */
  async searchCommodities({ query } = {}) {
    return this.getPrices({ commodity: query, limit: 20 })
  },

  /**
   * Readiness check — always ready in mock mode.
   *
   * @returns {Promise<{ ready: boolean, provider: string, isDemo: boolean }>}
   */
  async checkReadiness() {
    return { ready: true, provider: 'mock-market', isDemo: true }
  },
}
