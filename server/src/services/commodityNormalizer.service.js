/**
 * Commodity Normalizer — Phase 11.
 *
 * Maps farmer-supplied commodity names (English, Hindi, aliases, common misspellings)
 * to provider-compatible canonical names used by the Agmarknet API.
 *
 * Design principles:
 *   - Uses explicit alias lookup only (no fuzzy matching that could silently
 *     map an ambiguous input to the wrong commodity).
 *   - Each entry has a confidenceCategory of 'high' (exact/known alias) or
 *     'low' (ambiguous — agent should request clarification).
 *   - If the commodity cannot be identified, returns { found: false }.
 *   - Canonical names match Agmarknet/data.gov.in commodity name conventions.
 *
 * Adding new commodities:
 *   Add a new entry to COMMODITY_ALIASES below with all known aliases.
 */

/**
 * Commodity alias table.
 * Key: canonical provider name (used in API queries)
 * Value: { aliases: string[], hindiAliases: string[], confidenceCategory: 'high'|'low' }
 */
const COMMODITY_MAP = {
  Tomato: {
    aliases: ['tomato', 'tomatoes', 'tamatar', 'tamoto', 'tamater'],
    hindiAliases: ['टमाटर'],
    confidenceCategory: 'high',
  },
  Onion: {
    aliases: ['onion', 'onions', 'pyaz', 'pyaaz', 'kanda', 'dungri'],
    hindiAliases: ['प्याज', 'प्याजा'],
    confidenceCategory: 'high',
  },
  Potato: {
    aliases: ['potato', 'potatoes', 'aloo', 'batata'],
    hindiAliases: ['आलू'],
    confidenceCategory: 'high',
  },
  Wheat: {
    aliases: ['wheat', 'gehu', 'gehun', 'gehoon', 'gahu'],
    hindiAliases: ['गेहूं', 'गेहूँ', 'गेहुं'],
    confidenceCategory: 'high',
  },
  Rice: {
    aliases: ['rice', 'paddy', 'dhan', 'chawal', 'arwa'],
    hindiAliases: ['धान', 'चावल'],
    confidenceCategory: 'high',
  },
  Maize: {
    aliases: ['maize', 'corn', 'makka', 'makkai', 'maka'],
    hindiAliases: ['मक्का', 'मकई'],
    confidenceCategory: 'high',
  },
  Soybean: {
    aliases: ['soybean', 'soya', 'soya bean', 'soyabean', 'soy'],
    hindiAliases: ['सोयाबीन'],
    confidenceCategory: 'high',
  },
  Cotton: {
    aliases: ['cotton', 'kapas', 'kapas seed', 'narma'],
    hindiAliases: ['कपास', 'कपाश'],
    confidenceCategory: 'high',
  },
  Mustard: {
    aliases: ['mustard', 'sarson', 'rapeseed', 'mustard seed', 'rai', 'sarson seed'],
    hindiAliases: ['सरसों', 'राई'],
    confidenceCategory: 'high',
  },
  Groundnut: {
    aliases: ['groundnut', 'peanut', 'mungfali', 'moongfali', 'chingri'],
    hindiAliases: ['मूंगफली'],
    confidenceCategory: 'high',
  },
  'Green Peas': {
    aliases: ['green peas', 'peas', 'matar', 'hara matar', 'fresh peas'],
    hindiAliases: ['मटर', 'हरा मटर'],
    confidenceCategory: 'high',
  },
  Garlic: {
    aliases: ['garlic', 'lahsun', 'lehsun'],
    hindiAliases: ['लहसुन'],
    confidenceCategory: 'high',
  },
  Ginger: {
    aliases: ['ginger', 'adrak', 'sonth', 'fresh ginger'],
    hindiAliases: ['अदरक'],
    confidenceCategory: 'high',
  },
  Cauliflower: {
    aliases: ['cauliflower', 'phool gobi', 'gobi', 'gobhi'],
    hindiAliases: ['फूलगोभी', 'गोभी'],
    confidenceCategory: 'high',
  },
  Cabbage: {
    aliases: ['cabbage', 'band gobi', 'bandh gobi', 'patta gobi'],
    hindiAliases: ['बन्दगोभी', 'पत्तागोभी'],
    confidenceCategory: 'high',
  },
  Brinjal: {
    aliases: ['brinjal', 'eggplant', 'aubergine', 'baingan', 'baingun'],
    hindiAliases: ['बैंगन'],
    confidenceCategory: 'high',
  },
  Okra: {
    aliases: ['okra', 'ladyfinger', 'lady finger', 'bhindi', 'bhendi'],
    hindiAliases: ['भिण्डी', 'भिंडी'],
    confidenceCategory: 'high',
  },
  'Bitter Gourd': {
    aliases: ['bitter gourd', 'karela', 'bittergourd', 'bitter melon'],
    hindiAliases: ['करेला'],
    confidenceCategory: 'high',
  },
  Cucumber: {
    aliases: ['cucumber', 'kheera', 'khira', 'kakdi'],
    hindiAliases: ['खीरा'],
    confidenceCategory: 'high',
  },
  Lemon: {
    aliases: ['lemon', 'nimbu', 'lime', 'neembu'],
    hindiAliases: ['नींबू'],
    confidenceCategory: 'high',
  },
  Banana: {
    aliases: ['banana', 'kela', 'kele', 'plantain'],
    hindiAliases: ['केला'],
    confidenceCategory: 'high',
  },
  Mango: {
    aliases: ['mango', 'aam', 'keri', 'ambi'],
    hindiAliases: ['आम'],
    confidenceCategory: 'high',
  },
  Arhar: {
    aliases: ['arhar', 'toor', 'tur', 'pigeon pea', 'red gram', 'toor dal'],
    hindiAliases: ['अरहर', 'तूर'],
    confidenceCategory: 'high',
  },
  Moong: {
    aliases: ['moong', 'mung', 'green gram', 'moong dal', 'green moong'],
    hindiAliases: ['मूंग'],
    confidenceCategory: 'high',
  },
  Urad: {
    aliases: ['urad', 'urad dal', 'black gram', 'black lentil', 'mash'],
    hindiAliases: ['उड़द', 'उड़द दाल'],
    confidenceCategory: 'high',
  },
  Chana: {
    aliases: ['chana', 'gram', 'chickpea', 'bengal gram', 'chick pea', 'kabuli chana', 'desi chana'],
    hindiAliases: ['चना', 'चनाबाई'],
    confidenceCategory: 'high',
  },
  Masur: {
    aliases: ['masur', 'lentil', 'masoor', 'masur dal', 'red lentil'],
    hindiAliases: ['मसूर'],
    confidenceCategory: 'high',
  },
  Bajra: {
    aliases: ['bajra', 'pearl millet', 'bajri', 'millet'],
    hindiAliases: ['बाजरा'],
    confidenceCategory: 'high',
  },
  Jowar: {
    aliases: ['jowar', 'sorghum', 'juwar', 'sorgum'],
    hindiAliases: ['ज्वार'],
    confidenceCategory: 'high',
  },
  Sugarcane: {
    aliases: ['sugarcane', 'ganna', 'sugar cane', 'ganne'],
    hindiAliases: ['गन्ना'],
    confidenceCategory: 'high',
  },
}

// ── Build reverse lookup map ──────────────────────────────────────────────────

/**
 * Reverse map from lowercase alias → canonical name.
 * Built once at module load for O(1) lookup.
 *
 * @type {Map<string, string>}
 */
const _aliasToCanonical = new Map()

for (const [canonicalName, entry] of Object.entries(COMMODITY_MAP)) {
  for (const alias of entry.aliases) {
    _aliasToCanonical.set(alias.toLowerCase(), canonicalName)
  }
  for (const alias of entry.hindiAliases) {
    _aliasToCanonical.set(alias, canonicalName)
  }
  // Also map the canonical name itself (case-insensitive)
  _aliasToCanonical.set(canonicalName.toLowerCase(), canonicalName)
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Normalize a user-supplied commodity name to its canonical provider form.
 *
 * @param {string} userInput - Raw commodity name from farmer message
 * @returns {{
 *   found: boolean,
 *   userInput: string,
 *   canonicalName: string|null,
 *   providerQueryName: string|null,
 *   confidenceCategory: 'high'|'low'|null
 * }}
 */
export function normalizeCommodity(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return { found: false, userInput: userInput ?? '', canonicalName: null, providerQueryName: null, confidenceCategory: null }
  }

  const cleaned = userInput.trim()
  const lower = cleaned.toLowerCase()

  // Exact alias lookup
  if (_aliasToCanonical.has(lower)) {
    const canonical = _aliasToCanonical.get(lower)
    const entry = COMMODITY_MAP[canonical]
    return {
      found: true,
      userInput: cleaned,
      canonicalName: canonical,
      providerQueryName: canonical,
      confidenceCategory: entry?.confidenceCategory ?? 'high',
    }
  }

  return { found: false, userInput: cleaned, canonicalName: null, providerQueryName: null, confidenceCategory: null }
}

/**
 * Extract a commodity name from a free-form farmer message.
 *
 * Scans for known commodity aliases within the message text.
 * Returns the first match found (longest alias wins to avoid partial matches on short names).
 *
 * @param {string} message
 * @returns {ReturnType<normalizeCommodity>}
 */
export function extractCommodityFromMessage(message) {
  if (!message) return { found: false, userInput: '', canonicalName: null, providerQueryName: null, confidenceCategory: null }

  const lower = message.toLowerCase()

  // Try from longest alias to shortest to avoid partial short-alias matches
  const sortedAliases = Array.from(_aliasToCanonical.entries())
    .sort((a, b) => b[0].length - a[0].length)

  for (const [alias, canonical] of sortedAliases) {
    if (alias.length < 3) continue // Skip trivially short aliases
    // Use word-boundary-like check to avoid "rice" matching inside "price"
    const escaped = alias.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
    const wordPattern = new RegExp(`(?:^|[\\s,()./!?])${escaped}(?:[\\s,()./!?]|$)`, 'i')
    if (wordPattern.test(lower) || lower === alias) {
      const entry = COMMODITY_MAP[canonical]
      return {
        found: true,
        userInput: alias,
        canonicalName: canonical,
        providerQueryName: canonical,
        confidenceCategory: entry?.confidenceCategory ?? 'high',
      }
    }
  }

  return { found: false, userInput: '', canonicalName: null, providerQueryName: null, confidenceCategory: null }
}

/**
 * Return the list of all supported canonical commodity names.
 * Useful for generating clarification messages.
 *
 * @returns {string[]}
 */
export function getSupportedCommodities() {
  return Object.keys(COMMODITY_MAP)
}
