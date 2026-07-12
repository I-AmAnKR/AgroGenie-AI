/**
 * Market Location Resolver — Phase 11.
 *
 * Resolves the most appropriate location for a market price query.
 * Reuses the existing district/state location extraction from the Weather
 * location resolver but adds mandi-specific detection patterns.
 *
 * Location priority:
 *   1. Explicit mandi/market name in message
 *   2. Explicit district/state in message
 *   3. FarmerProfile district/state
 *   4. Returns null (agent should request clarification)
 *
 * Mandi detection:
 *   Scans for well-known mandi names (Lasalgaon, Azadpur, etc.) that may appear
 *   in messages like "What is tomato price in Azadpur mandi?"
 */

import { resolveWeatherLocation } from './locationResolver.service.js'
import logger from '../utils/logger.js'

// ── Known mandi names ─────────────────────────────────────────────────────────

/**
 * Common major Indian mandi names with their district/state.
 * Key: lowercase mandi name
 * Value: { market, district, state }
 */
const KNOWN_MANDIS = {
  // Maharashtra — Nashik (Onion/Tomato hub)
  lasalgaon: { market: 'Lasalgaon', district: 'Nashik', state: 'Maharashtra' },
  'pimpalgaon baswant': { market: 'Pimpalgaon Baswant', district: 'Nashik', state: 'Maharashtra' },
  malegaon: { market: 'Malegaon', district: 'Nashik', state: 'Maharashtra' },
  // Maharashtra
  pune: { market: 'Pune', district: 'Pune', state: 'Maharashtra' },
  nagpur: { market: 'Nagpur', district: 'Nagpur', state: 'Maharashtra' },
  latur: { market: 'Latur', district: 'Latur', state: 'Maharashtra' },
  jalgaon: { market: 'Jalgaon', district: 'Jalgaon', state: 'Maharashtra' },
  solapur: { market: 'Solapur', district: 'Solapur', state: 'Maharashtra' },
  // Delhi
  azadpur: { market: 'Azadpur', district: 'Delhi', state: 'Delhi' },
  okhla: { market: 'Okhla', district: 'Delhi', state: 'Delhi' },
  // Haryana
  karnal: { market: 'Karnal', district: 'Karnal', state: 'Haryana' },
  ambala: { market: 'Ambala', district: 'Ambala', state: 'Haryana' },
  hisar: { market: 'Hisar', district: 'Hisar', state: 'Haryana' },
  // Punjab
  ludhiana: { market: 'Ludhiana', district: 'Ludhiana', state: 'Punjab' },
  amritsar: { market: 'Amritsar', district: 'Amritsar', state: 'Punjab' },
  bathinda: { market: 'Bathinda', district: 'Bathinda', state: 'Punjab' },
  // Rajasthan
  jaipur: { market: 'Jaipur', district: 'Jaipur', state: 'Rajasthan' },
  kota: { market: 'Kota', district: 'Kota', state: 'Rajasthan' },
  // UP
  agra: { market: 'Agra', district: 'Agra', state: 'Uttar Pradesh' },
  lucknow: { market: 'Lucknow', district: 'Lucknow', state: 'Uttar Pradesh' },
  // Karnataka
  bangalore: { market: 'Bangalore', district: 'Bangalore', state: 'Karnataka' },
  bengaluru: { market: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka' },
  // Andhra/Telangana
  hyderabad: { market: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' },
  // MP
  indore: { market: 'Indore', district: 'Indore', state: 'Madhya Pradesh' },
}

// ── Mandi preposition patterns ────────────────────────────────────────────────

const MANDI_PATTERNS = [
  /\bin\s+([A-Za-z][A-Za-z\s]+?)\s+mandi\b/gi,
  /\bat\s+([A-Za-z][A-Za-z\s]+?)\s+mandi\b/gi,
  /\b([A-Za-z][A-Za-z\s]+?)\s+mandi\b/gi,
]

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Resolve the best available location for a market price query.
 *
 * Priority:
 *   1. Explicit mandi name in message (e.g. "Azadpur mandi")
 *   2. Explicit district/city in message (reused from Weather location resolver)
 *   3. FarmerProfile district/state
 *   4. Not found → null
 *
 * @param {object} params
 * @param {string} params.message
 * @param {object} [params.farmerContext={}]
 * @param {object} [params.metadata={}]
 * @returns {{ locationName, district, state, market, source }|null}
 */
export function resolveMarketLocation({ message, farmerContext = {}, metadata = {} }) {
  if (!message || typeof message !== 'string') {
    return resolveFromProfile(farmerContext, metadata)
  }

  const lower = message.toLowerCase()

  // ── Priority 1: Explicit mandi name ───────────────────────────────────
  // Check mandi name patterns first
  for (const pattern of MANDI_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(message)) !== null) {
      const candidate = match[1].trim().toLowerCase()
      if (KNOWN_MANDIS[candidate]) {
        const mandi = KNOWN_MANDIS[candidate]
        logger.debug('MarketLocationResolver: found explicit mandi in message', {
          requestId: metadata.requestId,
          market: mandi.market,
          district: mandi.district,
        })
        return {
          locationName: `${mandi.market}, ${mandi.district}, ${mandi.state}`,
          district: mandi.district,
          state: mandi.state,
          market: mandi.market,
          source: 'explicit_mandi',
        }
      }
    }
  }

  // Also check direct mandi name occurrence (longest first to avoid partial matches)
  const mandisSorted = Object.entries(KNOWN_MANDIS).sort((a, b) => b[0].length - a[0].length)
  for (const [key, mandi] of mandisSorted) {
    if (key.length >= 4 && lower.includes(key)) {
      logger.debug('MarketLocationResolver: found known mandi name in message', {
        requestId: metadata.requestId,
        market: mandi.market,
      })
      return {
        locationName: `${mandi.market}, ${mandi.district}, ${mandi.state}`,
        district: mandi.district,
        state: mandi.state,
        market: mandi.market,
        source: 'explicit_mandi',
      }
    }
  }

  // ── Priority 2: Reuse weather location resolver (district/state) ───────
  const fromWeatherResolver = resolveWeatherLocation({ message, farmerContext, metadata })
  if (fromWeatherResolver) {
    return {
      ...fromWeatherResolver,
      market: null,
      source: fromWeatherResolver.source,
    }
  }

  // ── Priority 3: FarmerProfile location ────────────────────────────────
  return resolveFromProfile(farmerContext, metadata)
}

/**
 * Extract location from FarmerProfile only.
 */
function resolveFromProfile(farmerContext, metadata) {
  const district = farmerContext?.location?.district ?? null
  const state = farmerContext?.location?.state ?? null

  if (!district && !state) {
    logger.debug('MarketLocationResolver: no location found', { requestId: metadata?.requestId })
    return null
  }

  const locationName = district
    ? state ? `${district}, ${state}` : district
    : state

  logger.debug('MarketLocationResolver: using FarmerProfile location', {
    requestId: metadata?.requestId,
    location: locationName,
  })

  return {
    locationName,
    district,
    state,
    market: null,
    source: 'farmer_profile',
  }
}
