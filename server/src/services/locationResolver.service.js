/**
 * Location Resolver — Phase 10.
 *
 * Resolves the most appropriate location for a weather query using a
 * priority-based strategy:
 *
 *   1. Explicit location extracted from the current farmer message
 *   2. FarmerProfile district and state
 *   3. Returns null if no usable location found (→ needs_clarification)
 *
 * The resolver returns a normalized location object consumed by the Weather
 * Agent. It never guesses or invents a location.
 *
 * Location result shape:
 * {
 *   locationName: string,
 *   district: string|null,
 *   state: string|null,
 *   latitude: null,    // will be resolved by geocoding in the provider
 *   longitude: null,
 *   source: 'explicit_message'|'farmer_profile'|'not_found'
 * }
 *
 * District-level resolution is sufficient for agricultural weather advice.
 * Sub-district or farm-level precision is not required.
 */

import logger from '../utils/logger.js'

// ── Known Indian state name variants ─────────────────────────────────────────

/**
 * Common Indian states and union territories that may appear in messages.
 * Used for heuristic message location extraction — not a complete database.
 */
const INDIAN_STATES = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
  'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
  'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
  'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
  'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
  'andaman and nicobar', 'chandigarh', 'dadra and nagar haveli', 'daman and diu',
  'delhi', 'jammu and kashmir', 'ladakh', 'lakshadweep', 'puducherry',
  'up', 'mp', 'hp', 'uk', // common abbreviations
])

/**
 * Common Indian city and district names that may appear in messages.
 * Key = lowercase name, value = canonical form.
 * This list covers high-frequency agricultural districts; it is not exhaustive.
 */
const KNOWN_DISTRICTS = {
  // Haryana
  karnal: { district: 'Karnal', state: 'Haryana' },
  kurukshetra: { district: 'Kurukshetra', state: 'Haryana' },
  ambala: { district: 'Ambala', state: 'Haryana' },
  hisar: { district: 'Hisar', state: 'Haryana' },
  rohtak: { district: 'Rohtak', state: 'Haryana' },
  sirsa: { district: 'Sirsa', state: 'Haryana' },
  // Punjab
  ludhiana: { district: 'Ludhiana', state: 'Punjab' },
  amritsar: { district: 'Amritsar', state: 'Punjab' },
  jalandhar: { district: 'Jalandhar', state: 'Punjab' },
  patiala: { district: 'Patiala', state: 'Punjab' },
  bathinda: { district: 'Bathinda', state: 'Punjab' },
  // Rajasthan
  jaipur: { district: 'Jaipur', state: 'Rajasthan' },
  jodhpur: { district: 'Jodhpur', state: 'Rajasthan' },
  kota: { district: 'Kota', state: 'Rajasthan' },
  udaipur: { district: 'Udaipur', state: 'Rajasthan' },
  bikaner: { district: 'Bikaner', state: 'Rajasthan' },
  // Maharashtra
  nashik: { district: 'Nashik', state: 'Maharashtra' },
  pune: { district: 'Pune', state: 'Maharashtra' },
  nagpur: { district: 'Nagpur', state: 'Maharashtra' },
  aurangabad: { district: 'Aurangabad', state: 'Maharashtra' },
  solapur: { district: 'Solapur', state: 'Maharashtra' },
  kolhapur: { district: 'Kolhapur', state: 'Maharashtra' },
  // Madhya Pradesh
  indore: { district: 'Indore', state: 'Madhya Pradesh' },
  bhopal: { district: 'Bhopal', state: 'Madhya Pradesh' },
  jabalpur: { district: 'Jabalpur', state: 'Madhya Pradesh' },
  sagar: { district: 'Sagar', state: 'Madhya Pradesh' },
  ujjain: { district: 'Ujjain', state: 'Madhya Pradesh' },
  // Gujarat
  ahmedabad: { district: 'Ahmedabad', state: 'Gujarat' },
  surat: { district: 'Surat', state: 'Gujarat' },
  rajkot: { district: 'Rajkot', state: 'Gujarat' },
  junagadh: { district: 'Junagadh', state: 'Gujarat' },
  anand: { district: 'Anand', state: 'Gujarat' },
  // Uttar Pradesh
  lucknow: { district: 'Lucknow', state: 'Uttar Pradesh' },
  agra: { district: 'Agra', state: 'Uttar Pradesh' },
  varanasi: { district: 'Varanasi', state: 'Uttar Pradesh' },
  allahabad: { district: 'Prayagraj', state: 'Uttar Pradesh' },
  prayagraj: { district: 'Prayagraj', state: 'Uttar Pradesh' },
  gorakhpur: { district: 'Gorakhpur', state: 'Uttar Pradesh' },
  meerut: { district: 'Meerut', state: 'Uttar Pradesh' },
  // Bihar
  patna: { district: 'Patna', state: 'Bihar' },
  gaya: { district: 'Gaya', state: 'Bihar' },
  muzaffarpur: { district: 'Muzaffarpur', state: 'Bihar' },
  // West Bengal
  kolkata: { district: 'Kolkata', state: 'West Bengal' },
  burdwan: { district: 'Burdwan', state: 'West Bengal' },
  // Tamil Nadu
  chennai: { district: 'Chennai', state: 'Tamil Nadu' },
  coimbatore: { district: 'Coimbatore', state: 'Tamil Nadu' },
  madurai: { district: 'Madurai', state: 'Tamil Nadu' },
  // Karnataka
  bangalore: { district: 'Bangalore', state: 'Karnataka' },
  bengaluru: { district: 'Bengaluru', state: 'Karnataka' },
  mysuru: { district: 'Mysuru', state: 'Karnataka' },
  hubli: { district: 'Hubli', state: 'Karnataka' },
  // Andhra Pradesh / Telangana
  hyderabad: { district: 'Hyderabad', state: 'Telangana' },
  vijayawada: { district: 'Vijayawada', state: 'Andhra Pradesh' },
  guntur: { district: 'Guntur', state: 'Andhra Pradesh' },
  // Odisha
  bhubaneswar: { district: 'Bhubaneswar', state: 'Odisha' },
  cuttack: { district: 'Cuttack', state: 'Odisha' },
  // Delhi
  delhi: { district: 'Delhi', state: 'Delhi' },
  // Uttarakhand
  dehradun: { district: 'Dehradun', state: 'Uttarakhand' },
  haridwar: { district: 'Haridwar', state: 'Uttarakhand' },
}

// ── Preposition patterns that precede a location name in common queries ────────

const LOCATION_PREP_PATTERNS = [
  /\bin\s+([A-Za-z][A-Za-z\s,]+?)(?:\s*[.?!,]|$)/gi,
  /\bfor\s+([A-Za-z][A-Za-z\s,]+?)(?:\s*[.?!,]|$)/gi,
  /\bat\s+([A-Za-z][A-Za-z\s,]+?)(?:\s*[.?!,]|$)/gi,
  /\bnear\s+([A-Za-z][A-Za-z\s,]+?)(?:\s*[.?!,]|$)/gi,
]

// ── Location extraction ──────────────────────────────────────────────────────

/**
 * Attempt to extract an explicit location from the message text.
 * Searches the known district list and also for "in <location>" patterns.
 *
 * @param {string} message
 * @returns {{ district: string, state: string|null, locationName: string }|null}
 */
function extractLocationFromMessage(message) {
  if (!message || typeof message !== 'string') return null

  const lower = message.toLowerCase()

  // 1. Check known districts directly
  for (const [key, loc] of Object.entries(KNOWN_DISTRICTS)) {
    // Use word boundary-like check: preceded/followed by space/punctuation/start/end
    const pattern = new RegExp(`(?:^|[\\s,])${key}(?:[\\s,.]|$)`, 'i')
    if (pattern.test(lower)) {
      return {
        district: loc.district,
        state: loc.state,
        locationName: `${loc.district}, ${loc.state}`,
      }
    }
  }

  // 2. Scan for preposition patterns like "weather in Jaipur"
  for (const pattern of LOCATION_PREP_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(message)) !== null) {
      const candidate = match[1].trim().replace(/[,.]$/, '')
      const candidateLower = candidate.toLowerCase().split(/\s*,\s*/)[0].trim()
      if (KNOWN_DISTRICTS[candidateLower]) {
        const loc = KNOWN_DISTRICTS[candidateLower]
        return {
          district: loc.district,
          state: loc.state,
          locationName: `${loc.district}, ${loc.state}`,
        }
      }
      // If candidate looks like a proper city name (not a stop word), use as-is
      if (
        candidate.length > 2 &&
        candidate.length < 50 &&
        !['today', 'tomorrow', 'week', 'crops', 'now', 'here'].includes(candidate.toLowerCase())
      ) {
        return {
          district: candidate,
          state: null,
          locationName: candidate,
        }
      }
    }
  }

  return null
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve the best available location for a weather query.
 *
 * Priority:
 *   1. Explicit location in farmer message
 *   2. FarmerProfile district / state
 *   3. Not found → null (agent should request clarification)
 *
 * @param {object} params
 * @param {string} params.message - Current farmer message
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {object|null} Resolved location or null
 */
export function resolveWeatherLocation({ message, farmerContext = {}, metadata = {} }) {
  // ── Priority 1: Explicit location in message ───────────────────────────
  const fromMessage = extractLocationFromMessage(message)
  if (fromMessage) {
    logger.debug('LocationResolver: found explicit location in message', {
      requestId: metadata.requestId,
      location: fromMessage.locationName,
    })
    return {
      locationName: fromMessage.locationName,
      district: fromMessage.district,
      state: fromMessage.state,
      latitude: null,
      longitude: null,
      source: 'explicit_message',
    }
  }

  // ── Priority 2: FarmerProfile location ────────────────────────────────
  const profileDistrict = farmerContext?.location?.district ?? null
  const profileState = farmerContext?.location?.state ?? null

  if (profileDistrict || profileState) {
    const locationName = profileDistrict
      ? profileState
        ? `${profileDistrict}, ${profileState}`
        : profileDistrict
      : profileState

    logger.debug('LocationResolver: using FarmerProfile location', {
      requestId: metadata.requestId,
      location: locationName,
    })

    return {
      locationName,
      district: profileDistrict,
      state: profileState,
      latitude: null,
      longitude: null,
      source: 'farmer_profile',
    }
  }

  // ── Not found ─────────────────────────────────────────────────────────
  logger.debug('LocationResolver: no location found', { requestId: metadata.requestId })
  return null
}
