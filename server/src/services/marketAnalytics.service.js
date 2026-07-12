/**
 * Market Analytics — Phase 11.
 *
 * Deterministic price statistics and trend analysis.
 *
 * ALL numerical calculations are performed here in application code.
 * Granite must NEVER be asked to calculate price statistics.
 *
 * Functions:
 *   calculatePriceStatistics(records)  → min, max, avg, median, count
 *   calculateTrend(records)            → trendStatus, absoluteChange, percentageChange
 *
 * Trend status values:
 *   'rising'           — last price > first price by > TREND_THRESHOLD %
 *   'falling'          — last price < first price by > TREND_THRESHOLD %
 *   'stable'           — price change <= TREND_THRESHOLD %
 *   'volatile'         — coefficient of variation > VOLATILE_THRESHOLD
 *   'insufficient_data' — fewer than MIN_TREND_RECORDS valid records
 *
 * Trend is calculated from modal prices sorted by priceDate ascending.
 * Trend rule is documented in the PROGRESS.md.
 */

/** Minimum number of date-distinct records required for trend analysis. */
const MIN_TREND_RECORDS = 2

/** Price change threshold (%) below which trend is classified as "stable". */
const TREND_THRESHOLD_PCT = 2

/** Coefficient of variation threshold (%) above which trend is "volatile". */
const VOLATILE_CV_PCT = 15

/**
 * Trend status constants.
 */
export const TREND_STATUS = {
  RISING: 'rising',
  FALLING: 'falling',
  STABLE: 'stable',
  VOLATILE: 'volatile',
  INSUFFICIENT_DATA: 'insufficient_data',
}

// ── Statistical helpers ───────────────────────────────────────────────────────

/**
 * Calculate the median of a numeric array.
 *
 * @param {number[]} values - Sorted ascending
 * @returns {number|null}
 */
function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    : sorted[mid]
}

/**
 * Calculate the arithmetic mean.
 *
 * @param {number[]} values
 * @returns {number|null}
 */
function mean(values) {
  if (!values.length) return null
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
}

/**
 * Calculate the coefficient of variation (std dev / mean * 100).
 *
 * @param {number[]} values
 * @returns {number|null} CV in percentage
 */
function coefficientOfVariation(values) {
  if (values.length < 2) return null
  const avg = mean(values)
  if (!avg || avg === 0) return null
  const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  return Math.round((stdDev / avg) * 100 * 100) / 100
}

// ── Main analytics functions ──────────────────────────────────────────────────

/**
 * Calculate price statistics for a set of normalized market records.
 *
 * @param {object[]} records - Normalized market records
 * @returns {{
 *   recordsAnalyzed: number,
 *   marketsCompared: number,
 *   minReportedPrice: number|null,
 *   maxReportedPrice: number|null,
 *   averageModalPrice: number|null,
 *   medianModalPrice: number|null,
 *   modalPrices: number[]
 * }}
 */
export function calculatePriceStatistics(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      recordsAnalyzed: 0,
      marketsCompared: 0,
      minReportedPrice: null,
      maxReportedPrice: null,
      averageModalPrice: null,
      medianModalPrice: null,
      modalPrices: [],
    }
  }

  const uniqueMarkets = new Set(records.map((r) => `${r.market}:${r.district}:${r.state}`))

  const allMinPrices = records.map((r) => r.minPrice).filter((p) => p !== null && p > 0)
  const allMaxPrices = records.map((r) => r.maxPrice).filter((p) => p !== null && p > 0)
  const allModalPrices = records.map((r) => r.modalPrice).filter((p) => p !== null && p > 0)

  // Global min across all min prices AND modal prices
  const allPrices = [...allMinPrices, ...allMaxPrices, ...allModalPrices]

  return {
    recordsAnalyzed: records.length,
    marketsCompared: uniqueMarkets.size,
    minReportedPrice: allMinPrices.length > 0 ? Math.min(...allMinPrices) : null,
    maxReportedPrice: allMaxPrices.length > 0 ? Math.max(...allMaxPrices) : null,
    averageModalPrice: mean(allModalPrices),
    medianModalPrice: median(allModalPrices),
    modalPrices: allModalPrices,
  }
}

/**
 * Calculate price trend from a time-ordered set of records.
 *
 * Uses modal prices sorted by priceDate ascending.
 * Trend rule:
 *   - Sort records by priceDate ascending.
 *   - Deduplicate to one representative record per date (average modal price).
 *   - Compute firstPrice (oldest date's avg modal) and lastPrice (newest date's avg modal).
 *   - percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100
 *   - rising:    percentageChange > TREND_THRESHOLD_PCT
 *   - falling:   percentageChange < -TREND_THRESHOLD_PCT
 *   - volatile:  coefficient of variation > VOLATILE_CV_PCT (checked before rising/falling)
 *   - stable:    |percentageChange| <= TREND_THRESHOLD_PCT
 *   - insufficient_data: fewer than MIN_TREND_RECORDS valid date-distinct records
 *
 * @param {object[]} records - Normalized market records (may span multiple dates)
 * @returns {{
 *   trendStatus: string,
 *   firstDate: string|null,
 *   lastDate: string|null,
 *   firstPrice: number|null,
 *   lastPrice: number|null,
 *   absoluteChange: number|null,
 *   percentageChange: number|null,
 *   dateCount: number,
 *   note: string|null
 * }}
 */
export function calculateTrend(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      trendStatus: TREND_STATUS.INSUFFICIENT_DATA,
      firstDate: null, lastDate: null,
      firstPrice: null, lastPrice: null,
      absoluteChange: null, percentageChange: null,
      dateCount: 0, note: 'No records supplied.',
    }
  }

  // Group records by priceDate and compute average modal price per date
  const byDate = {}
  for (const r of records) {
    if (!r.priceDate || r.modalPrice === null) continue
    if (!byDate[r.priceDate]) byDate[r.priceDate] = []
    byDate[r.priceDate].push(r.modalPrice)
  }

  const dateSorted = Object.keys(byDate).sort()

  if (dateSorted.length < MIN_TREND_RECORDS) {
    return {
      trendStatus: TREND_STATUS.INSUFFICIENT_DATA,
      firstDate: dateSorted[0] ?? null, lastDate: dateSorted[dateSorted.length - 1] ?? null,
      firstPrice: null, lastPrice: null,
      absoluteChange: null, percentageChange: null,
      dateCount: dateSorted.length,
      note: `Trend analysis requires at least ${MIN_TREND_RECORDS} distinct dates. Only ${dateSorted.length} found.`,
    }
  }

  // Average modal price per date
  const avgByDate = dateSorted.map((d) => ({
    date: d,
    price: mean(byDate[d]),
  })).filter((e) => e.price !== null)

  if (avgByDate.length < MIN_TREND_RECORDS) {
    return {
      trendStatus: TREND_STATUS.INSUFFICIENT_DATA,
      firstDate: dateSorted[0], lastDate: dateSorted[dateSorted.length - 1],
      firstPrice: null, lastPrice: null,
      absoluteChange: null, percentageChange: null,
      dateCount: dateSorted.length,
      note: 'Insufficient modal price data across dates.',
    }
  }

  const allPrices = avgByDate.map((e) => e.price)
  const firstPrice = avgByDate[0].price
  const lastPrice = avgByDate[avgByDate.length - 1].price
  const firstDate = avgByDate[0].date
  const lastDate = avgByDate[avgByDate.length - 1].date

  const absoluteChange = Math.round((lastPrice - firstPrice) * 100) / 100
  const percentageChange = Math.round(((lastPrice - firstPrice) / firstPrice) * 100 * 100) / 100

  // Check for volatility first
  const cv = coefficientOfVariation(allPrices)
  if (cv !== null && cv > VOLATILE_CV_PCT) {
    return {
      trendStatus: TREND_STATUS.VOLATILE,
      firstDate, lastDate, firstPrice, lastPrice,
      absoluteChange, percentageChange,
      dateCount: dateSorted.length,
      note: `High price variability detected (CV: ${cv}%). Prices are volatile over the observation window.`,
    }
  }

  let trendStatus
  if (percentageChange > TREND_THRESHOLD_PCT) {
    trendStatus = TREND_STATUS.RISING
  } else if (percentageChange < -TREND_THRESHOLD_PCT) {
    trendStatus = TREND_STATUS.FALLING
  } else {
    trendStatus = TREND_STATUS.STABLE
  }

  return {
    trendStatus,
    firstDate, lastDate, firstPrice, lastPrice,
    absoluteChange, percentageChange,
    dateCount: dateSorted.length,
    note: null,
  }
}

/**
 * Find the market (mandi) with the highest reported modal price.
 *
 * @param {object[]} records - Normalized market records
 * @returns {object|null} The record with the highest modal price, or null
 */
export function findBestReportedMarket(records) {
  if (!Array.isArray(records) || records.length === 0) return null
  const withModal = records.filter((r) => r.modalPrice !== null)
  if (withModal.length === 0) return null
  return withModal.reduce((best, r) => (r.modalPrice > best.modalPrice ? r : best))
}
