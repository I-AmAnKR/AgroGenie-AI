/**
 * Market Freshness — Phase 11.
 *
 * Deterministic freshness classification for market price records.
 *
 * Freshness categories:
 *   'current'  — priceDate is today (or within currentWindowDays)
 *   'recent'   — priceDate is within recentWindowDays (default 7 days)
 *   'stale'    — priceDate is older than recentWindowDays
 *   'unknown'  — priceDate is null or unparseable
 *
 * Rules applied at Asia/Kolkata timezone awareness:
 *   Indian agricultural market data typically reflects the current trading day.
 *   "Current" means the record is from today's session or yesterday's close.
 *
 * Important:
 *   - NEVER call Granite to evaluate data freshness.
 *   - NEVER describe stale data as today's prices.
 *   - All freshness decisions are deterministic code.
 */

/** Days within which data is considered "current" (today or day 0). */
const CURRENT_WINDOW_DAYS = 0

/** Days within which data is considered "recent". */
const RECENT_WINDOW_DAYS = 7

/**
 * Freshness category constants.
 */
export const FRESHNESS = {
  CURRENT: 'current',
  RECENT: 'recent',
  STALE: 'stale',
  UNKNOWN: 'unknown',
}

/**
 * Classify the freshness of a price record given its priceDate.
 * Uses UTC date arithmetic to avoid timezone-dependent test failures.
 *
 * @param {string|null} priceDate - ISO date string "YYYY-MM-DD"
 * @returns {{ category: string, ageInDays: number|null, label: string }}
 */
export function classifyFreshness(priceDate) {
  if (!priceDate) {
    return { category: FRESHNESS.UNKNOWN, ageInDays: null, label: 'Date unknown' }
  }

  // Parse as UTC midnight to avoid DST and timezone shifts
  const recordDate = new Date(priceDate + 'T00:00:00.000Z')
  if (isNaN(recordDate.getTime())) {
    return { category: FRESHNESS.UNKNOWN, ageInDays: null, label: 'Date unknown' }
  }

  // Build today's date string in UTC to compare apples-to-apples
  const now = new Date()
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  const todayDate = new Date(todayStr + 'T00:00:00.000Z')

  const ageInDays = Math.round((todayDate - recordDate) / (1000 * 60 * 60 * 24))

  if (ageInDays < 0) {
    // Future-dated records — treat as recent (market may run ahead by a day)
    return { category: FRESHNESS.RECENT, ageInDays: 0, label: `Latest available` }
  }

  if (ageInDays <= CURRENT_WINDOW_DAYS) {
    return { category: FRESHNESS.CURRENT, ageInDays, label: 'Today' }
  }

  if (ageInDays <= RECENT_WINDOW_DAYS) {
    return { category: FRESHNESS.RECENT, ageInDays, label: `${ageInDays} day${ageInDays !== 1 ? 's' : ''} ago` }
  }

  return { category: FRESHNESS.STALE, ageInDays, label: `${ageInDays} days ago (${priceDate})` }
}

/**
 * Classify freshness of a set of records and return an overall summary.
 * The most recent record's date determines the overall freshness.
 *
 * @param {object[]} records - Normalized market records
 * @returns {{ category: string, latestDate: string|null, ageInDays: number|null, label: string }}
 */
export function classifyRecordsFreshness(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return { category: FRESHNESS.UNKNOWN, latestDate: null, ageInDays: null, label: 'No data' }
  }

  // Find the most recent priceDate
  const dates = records
    .map((r) => r.priceDate)
    .filter(Boolean)
    .sort()
    .reverse()

  if (dates.length === 0) {
    return { category: FRESHNESS.UNKNOWN, latestDate: null, ageInDays: null, label: 'No dates available' }
  }

  const latestDate = dates[0]
  const freshness = classifyFreshness(latestDate)
  return { ...freshness, latestDate }
}
