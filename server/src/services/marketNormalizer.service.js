/**
 * Market Record Normalization — Phase 11.
 *
 * Normalizes raw Agmarknet/data.gov.in API records to the provider-neutral
 * market record shape. Also provides unit conversion utilities.
 *
 * Provider-neutral record shape:
 * {
 *   commodity: string,
 *   variety: string|null,
 *   state: string,
 *   district: string,
 *   market: string,
 *   priceDate: string,          // YYYY-MM-DD
 *   minPrice: number|null,      // INR per quintal
 *   maxPrice: number|null,      // INR per quintal
 *   modalPrice: number|null,    // INR per quintal
 *   unit: 'INR_PER_QUINTAL',
 *   arrivals: number|null,
 *   arrivalsUnit: string|null,
 *   metadata: {
 *     provider: string,
 *     fetchedAt: string,
 *     isDemo: boolean
 *   }
 * }
 *
 * Unit rules:
 *   - Agmarknet API returns prices in INR per quintal (1 quintal = 100 kg).
 *   - We preserve this as the canonical unit (INR_PER_QUINTAL).
 *   - Optional per-kg conversion is available via pricePerKg() below.
 *   - Do NOT mix quintal and per-kg prices without explicit conversion.
 */

// ── Unit constants ────────────────────────────────────────────────────────────

export const UNIT = {
  INR_PER_QUINTAL: 'INR_PER_QUINTAL',
  INR_PER_KG: 'INR_PER_KG',
}

/** Kilograms per quintal (exact, deterministic) */
const KG_PER_QUINTAL = 100

// ── Unit conversion helpers ───────────────────────────────────────────────────

/**
 * Convert a price in INR/quintal to INR/kg.
 * Division is exact to 2 decimal places to avoid misleading precision.
 *
 * @param {number|null} pricePerQuintal
 * @returns {number|null}
 */
export function pricePerKg(pricePerQuintal) {
  if (pricePerQuintal === null || pricePerQuintal === undefined) return null
  return Math.round((pricePerQuintal / KG_PER_QUINTAL) * 100) / 100
}

/**
 * Convert a price in INR/kg to INR/quintal.
 *
 * @param {number|null} pricePerKgVal
 * @returns {number|null}
 */
export function pricePerQuintal(pricePerKgVal) {
  if (pricePerKgVal === null || pricePerKgVal === undefined) return null
  return Math.round(pricePerKgVal * KG_PER_QUINTAL * 100) / 100
}

// ── Date normalization ────────────────────────────────────────────────────────

/**
 * Normalize a raw date string from the API to YYYY-MM-DD format.
 * Agmarknet API returns dates as "DD/MM/YYYY" or "YYYY-MM-DD".
 *
 * @param {string|null} raw
 * @returns {string|null} YYYY-MM-DD or null if unparseable
 */
export function normalizeDate(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // DD/MM/YYYY format (Agmarknet)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // DD-MM-YYYY format
  const ddmmyyyyDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (ddmmyyyyDash) {
    const [, dd, mm, yyyy] = ddmmyyyyDash
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  return null
}

// ── Price parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a raw price value from the API to a number or null.
 * Handles string prices like "2100" or "2,100" or numeric values.
 *
 * @param {string|number|null} raw
 * @returns {number|null}
 */
export function parsePrice(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return isNaN(raw) ? null : raw
  // Remove commas and parse
  const cleaned = String(raw).replace(/,/g, '').trim()
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

// ── Record normalization ──────────────────────────────────────────────────────

/**
 * Normalize a single raw Agmarknet/data.gov.in record to the provider-neutral shape.
 *
 * data.gov.in Agmarknet resource fields:
 *   state, district, market, commodity, variety, grade,
 *   arrival_date, min_price, max_price, modal_price
 *
 * @param {object} raw - Raw record from data.gov.in API
 * @param {object} providerMeta - { provider, fetchedAt, isDemo }
 * @returns {object} Normalized market record
 */
export function normalizeAgmarknetRecord(raw, providerMeta = {}) {
  return {
    commodity: (raw.commodity ?? raw.Commodity ?? '').trim(),
    variety: (raw.variety ?? raw.Variety ?? null) ? (raw.variety ?? raw.Variety ?? '').trim() || null : null,
    grade: (raw.grade ?? raw.Grade ?? null) ? (raw.grade ?? raw.Grade ?? '').trim() || null : null,
    state: (raw.state ?? raw.State ?? '').trim(),
    district: (raw.district ?? raw.District ?? '').trim(),
    market: (raw.market ?? raw.Market ?? '').trim(),
    priceDate: normalizeDate(raw.arrival_date ?? raw['Arrival Date'] ?? raw.arrivalDate ?? null),
    minPrice: parsePrice(raw.min_price ?? raw['Min Price'] ?? raw.minPrice ?? null),
    maxPrice: parsePrice(raw.max_price ?? raw['Max Price'] ?? raw.maxPrice ?? null),
    modalPrice: parsePrice(raw.modal_price ?? raw['Modal Price'] ?? raw.modalPrice ?? null),
    unit: UNIT.INR_PER_QUINTAL, // Agmarknet always returns INR/quintal
    arrivals: parsePrice(raw.arrivals ?? null),
    arrivalsUnit: raw.arrivals != null ? 'Tonnes' : null,
    metadata: {
      provider: providerMeta.provider ?? 'agmarknet',
      fetchedAt: providerMeta.fetchedAt ?? new Date().toISOString(),
      isDemo: providerMeta.isDemo === true,
    },
  }
}

/**
 * Normalize an array of raw records.
 *
 * @param {object[]} rawRecords
 * @param {object} providerMeta
 * @returns {object[]} Array of normalized records
 */
export function normalizeAgmarknetRecords(rawRecords, providerMeta = {}) {
  if (!Array.isArray(rawRecords)) return []
  return rawRecords
    .map((r) => normalizeAgmarknetRecord(r, providerMeta))
    .filter((r) => r.commodity && r.market) // Filter records missing essential fields
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a price for display with unit label.
 * e.g. formatPriceDisplay(2450, 'INR_PER_QUINTAL') → "₹2,450/quintal"
 *
 * @param {number|null} price
 * @param {string} [unit='INR_PER_QUINTAL']
 * @returns {string}
 */
export function formatPriceDisplay(price, unit = UNIT.INR_PER_QUINTAL) {
  if (price === null || price === undefined) return 'N/A'
  const rounded = Math.round(price)
  const formatted = rounded.toLocaleString('en-IN')
  return unit === UNIT.INR_PER_KG ? `₹${formatted}/kg` : `₹${formatted}/quintal`
}
