/**
 * Language Detection and Localization Service — Phase 14.
 *
 * Provides:
 *   1. detectLanguage(text, options) — 3-tier language detection:
 *        Tier 1: Unicode script detection (synchronous, deterministic)
 *        Tier 2: Hinglish heuristic (synchronous, deterministic)
 *        Tier 3: LLM fallback (async, only when heuristics are uncertain)
 *
 *   2. getLocalizedString(key, language) — fixed template strings in supported languages
 *        (clarification, error, not-found messages etc.)
 *
 *   3. SUPPORTED_LANGUAGES — the canonical set of valid language codes
 *
 * Design invariants:
 *   - Tier 1 and 2 are synchronous and never call external services.
 *   - Tier 3 uses the existing getAiProvider() — no new credentials required.
 *   - On any detection failure, safe default is 'en'.
 *   - This service never modifies structured data fields — it only informs
 *     which language code to pass to prompt builders.
 *
 * Language codes:
 *   'en'      — English (default)
 *   'hi'      — Hindi (Devanagari script)
 *   'hi-Latn' — Hinglish (Hindi words in Roman/Latin script)
 *   'pa'      — Punjabi (Gurmukhi script)
 */
import { getAiProvider } from '../providers/ai.provider.factory.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Supported language codes ──────────────────────────────────────────────────

/**
 * Canonical set of supported language codes.
 * This is the authoritative source — chat.service.js imports from here.
 */
export const SUPPORTED_LANGUAGES = new Set(['en', 'hi', 'hi-Latn', 'pa'])

// ── Tier 1: Unicode script detection ─────────────────────────────────────────

/**
 * Unicode character range checks for Indian scripts.
 * These ranges cover the core characters used in each script.
 */
const SCRIPT_RANGES = {
  devanagari: { start: 0x0900, end: 0x097f }, // Hindi
  gurmukhi: { start: 0x0a00, end: 0x0a7f },   // Punjabi
}

/**
 * Check whether a string contains characters from a given Unicode range.
 *
 * @param {string} text
 * @param {{ start: number, end: number }} range
 * @returns {boolean}
 */
function containsScriptRange(text, range) {
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)
    if (cp >= range.start && cp <= range.end) return true
  }
  return false
}

/**
 * Tier 1: Detect language from Unicode script content.
 *
 * @param {string} text
 * @returns {{ language: string, confidence: 'high' } | null} Match or null
 */
function detectByScript(text) {
  if (containsScriptRange(text, SCRIPT_RANGES.devanagari)) {
    return { language: 'hi', confidence: 'high' }
  }
  if (containsScriptRange(text, SCRIPT_RANGES.gurmukhi)) {
    return { language: 'pa', confidence: 'high' }
  }
  return null
}

// ── Tier 2: Hinglish heuristic ────────────────────────────────────────────────

/**
 * Small, high-precision set of Hinglish function words and agricultural terms.
 *
 * These words are:
 *   a) Commonly used in Indian agricultural Hinglish contexts
 *   b) Unambiguously Hindi origin (not also common English words)
 *   c) Low false-positive risk for English-only text
 *
 * Deliberately kept small to avoid the maintenance burden of a large vocab list.
 * The LLM fallback (Tier 3) handles edge cases.
 */
const HINGLISH_KEYWORDS = new Set([
  // Core function words
  'kya', 'hai', 'hain', 'nahi', 'aur', 'mera', 'meri', 'mein',
  'toh', 'agar', 'abhi', 'aaj', 'kal', 'woh',
  // Agricultural terms
  'fasal', 'kharif', 'rabi', 'zaid', 'kisan', 'kheti', 'zameen',
  'sinchai', 'baarish', 'barish', 'mandi', 'bhav', 'daam',
  // Question words
  'kitna', 'kitni', 'kaisa', 'kaisi', 'kaise', 'konsa', 'konsi',
  'kahan', 'kab', 'batao', 'bataye', 'milega', 'milegi',
  // Imperative / advisory
  'lagao', 'lagaye', 'karo', 'karein', 'chahiye', 'lagana',
])

/**
 * Tier 2: Detect Hinglish using the heuristic keyword set.
 *
 * @param {string} text
 * @returns {{ language: 'hi-Latn', confidence: 'medium' } | null}
 */
function detectHinglish(text) {
  const threshold = config.language.hinglishThreshold
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // keep only lowercase ASCII letters
    .split(/\s+/)
    .filter(Boolean)

  let matchCount = 0
  for (const token of tokens) {
    if (HINGLISH_KEYWORDS.has(token)) {
      matchCount++
      if (matchCount >= threshold) {
        return { language: 'hi-Latn', confidence: 'medium' }
      }
    }
  }
  return null
}

// ── Tier 3: LLM fallback ──────────────────────────────────────────────────────

const LLM_DETECT_SYSTEM_PROMPT = `You are a language detection assistant.
Given a short text message, respond with ONLY a JSON object:
{ "language": "<code>" }
where <code> is one of: "en", "hi", "hi-Latn", "pa"
- "en"      = English
- "hi"      = Hindi written in Devanagari script
- "hi-Latn" = Hindi/Hinglish written in Roman/Latin script
- "pa"      = Punjabi written in Gurmukhi script
Do not add any explanation. Respond only with the JSON object.`

/**
 * Tier 3: LLM-assisted language detection.
 * Only called when heuristic confidence is not high.
 *
 * @param {string} text
 * @param {object} [metadata={}] - Request metadata for logging
 * @returns {Promise<string>} Detected language code, defaults to 'en' on failure
 */
async function detectViaLlm(text, metadata = {}) {
  if (!config.language.useLlmFallback) return 'en'

  try {
    const provider = getAiProvider()
    const aiResult = await provider.generate({
      messages: [{ role: 'user', content: `Detect the language of this text:\n"${text.slice(0, 200)}"` }],
      systemPrompt: LLM_DETECT_SYSTEM_PROMPT,
      parameters: {
        max_tokens: 30,
        temperature: 0.0,
      },
      metadata,
    })

    // Parse the JSON response
    const cleaned = aiResult.content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)
    const lang = parsed?.language
    if (SUPPORTED_LANGUAGES.has(lang)) return lang

    logger.warn('LanguageService: LLM returned unrecognized language code', {
      requestId: metadata.requestId,
      rawCode: lang,
    })
    return 'en'
  } catch (err) {
    logger.warn('LanguageService: LLM fallback failed — defaulting to en', {
      requestId: metadata.requestId,
      code: err.code ?? err.message ?? 'UNKNOWN',
    })
    return 'en'
  }
}

// ── Public detection API ──────────────────────────────────────────────────────

/**
 * Detect the language of a message using the 3-tier strategy.
 *
 * @param {string} text - The message text to detect
 * @param {object} [options={}]
 * @param {object} [options.metadata={}] - Request metadata for logging
 * @param {string|null} [options.hint=null] - Preferred language hint (from FarmerProfile)
 * @returns {Promise<{ language: string, confidence: 'high'|'medium'|'low', method: string }>}
 */
export async function detectLanguage(text, { metadata = {}, hint = null } = {}) {
  if (!text || typeof text !== 'string') {
    return { language: 'en', confidence: 'low', method: 'default' }
  }

  // ── Tier 1: Unicode script ────────────────────────────────────────────────
  const scriptResult = detectByScript(text)
  if (scriptResult) {
    logger.debug('LanguageService: detected via unicode script', {
      requestId: metadata.requestId,
      language: scriptResult.language,
    })
    return { ...scriptResult, method: 'unicode' }
  }

  // ── Tier 2: Hinglish heuristic ────────────────────────────────────────────
  const hinglishResult = detectHinglish(text)
  if (hinglishResult) {
    logger.debug('LanguageService: detected via Hinglish heuristic', {
      requestId: metadata.requestId,
      language: hinglishResult.language,
    })
    return { ...hinglishResult, method: 'heuristic' }
  }

  // Profile hint is available and message is short/ambiguous — trust the profile
  if (hint && SUPPORTED_LANGUAGES.has(hint) && hint !== 'en') {
    logger.debug('LanguageService: using profile language hint', {
      requestId: metadata.requestId,
      language: hint,
    })
    return { language: hint, confidence: 'medium', method: 'profile-hint' }
  }

  // ── Tier 3: LLM fallback (only for longer, ambiguous messages) ────────────
  if (text.trim().split(/\s+/).length > 4) {
    const llmLang = await detectViaLlm(text, metadata)
    if (llmLang !== 'en') {
      logger.debug('LanguageService: detected via LLM fallback', {
        requestId: metadata.requestId,
        language: llmLang,
      })
      return { language: llmLang, confidence: 'medium', method: 'llm' }
    }
  }

  return { language: 'en', confidence: 'medium', method: 'default' }
}

/**
 * Normalize and validate a language code.
 * Unsupported codes default to 'en'.
 *
 * @param {string} [language='en']
 * @returns {string}
 */
export function normalizeLanguage(language) {
  if (!language || typeof language !== 'string') return 'en'
  const lower = language.toLowerCase().trim()
  // Handle common aliases
  if (lower === 'hinglish') return 'hi-Latn'
  if (lower === 'hindi') return 'hi'
  if (lower === 'punjabi') return 'pa'
  if (lower === 'english') return 'en'
  // Standard codes — case-insensitive match
  for (const code of SUPPORTED_LANGUAGES) {
    if (code.toLowerCase() === lower) return code
  }
  return 'en'
}

// ── Template localization ─────────────────────────────────────────────────────

/**
 * Fixed template strings for system-generated messages.
 * These are not AI-generated — they are pre-translated fixed strings
 * for clarification requests, error messages, and warnings.
 *
 * Keys:
 *   - clarification     : Used when agent needs more info
 *   - error             : Used when agent processing fails
 *   - no_location       : Used when location is needed but missing
 *   - live_data_needed  : Used when live data is unavailable
 *   - kvk_suggestion    : Standard suggestion to contact KVK
 */
const LOCALIZED_STRINGS = {
  clarification: {
    en: "I'd like to help, but I need a bit more information to understand what you're asking.",
    hi: 'मैं आपकी मदद करना चाहता हूँ, लेकिन मुझे आपके प्रश्न को समझने के लिए थोड़ी और जानकारी चाहिए।',
    'hi-Latn': 'Main aapki madad karna chahta hoon, lekin mujhe aapka sawaal samajhne ke liye thodi aur jaankari chahiye.',
    pa: 'ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ, ਪਰ ਮੈਨੂੰ ਤੁਹਾਡੇ ਸਵਾਲ ਨੂੰ ਸਮਝਣ ਲਈ ਥੋੜੀ ਹੋਰ ਜਾਣਕਾਰੀ ਚਾਹੀਦੀ ਹੈ।',
  },
  error: {
    en: 'I encountered an error while processing your request. Please try again.',
    hi: 'आपके अनुरोध को संसाधित करने में एक त्रुटि हुई। कृपया दोबारा कोशिश करें।',
    'hi-Latn': 'Aapki request process karte waqt kuch error aaya. Kripaya dobara try karein.',
    pa: 'ਤੁਹਾਡੀ ਬੇਨਤੀ ਨੂੰ ਪ੍ਰੋਸੈਸ ਕਰਨ ਵੇਲੇ ਇੱਕ ਗਲਤੀ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  },
  no_location: {
    en: 'Please share your district or state so I can provide location-specific information.',
    hi: 'कृपया अपना जिला या राज्य बताएं ताकि मैं आपको स्थान-विशिष्ट जानकारी दे सकूं।',
    'hi-Latn': 'Kripaya apna district ya state batayein taaki main aapko location ke hisab se jaankari de sakoon.',
    pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਜ਼ਿਲ੍ਹਾ ਜਾਂ ਰਾਜ ਦੱਸੋ ਤਾਂ ਜੋ ਮੈਂ ਤੁਹਾਨੂੰ ਸਥਾਨ-ਵਿਸ਼ੇਸ਼ ਜਾਣਕਾਰੀ ਦੇ ਸਕਾਂ।',
  },
  live_data_needed: {
    en: 'Live data is currently unavailable. Please try again later.',
    hi: 'अभी लाइव डेटा उपलब्ध नहीं है। कृपया बाद में कोशिश करें।',
    'hi-Latn': 'Abhi live data available nahi hai. Baad mein try karein.',
    pa: 'ਹੁਣ ਲਾਈਵ ਡੇਟਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਬਾਅਦ ਵਿੱਚ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  },
  kvk_suggestion: {
    en: 'For verified advice, consult your local Krishi Vigyan Kendra (KVK) or agricultural extension officer.',
    hi: 'सत्यापित सलाह के लिए, अपने स्थानीय कृषि विज्ञान केंद्र (KVK) या कृषि विस्तार अधिकारी से संपर्क करें।',
    'hi-Latn': 'Pakki jaankari ke liye apne nazdiki Krishi Vigyan Kendra (KVK) ya agricultural officer se milein.',
    pa: 'ਪੱਕੀ ਸਲਾਹ ਲਈ, ਆਪਣੇ ਨੇੜੇ ਦੇ ਕ੍ਰਿਸ਼ੀ ਵਿਗਿਆਨ ਕੇਂਦਰ (KVK) ਜਾਂ ਖੇਤੀਬਾੜੀ ਵਿਸਤਾਰ ਅਧਿਕਾਰੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।',
  },
}

/**
 * Get a pre-translated template string for the given language.
 *
 * @param {string} key - Template key (e.g. 'clarification', 'error')
 * @param {string} [language='en'] - Target language code
 * @returns {string} Translated string, falls back to English if not found
 */
export function getLocalizedString(key, language = 'en') {
  const template = LOCALIZED_STRINGS[key]
  if (!template) {
    logger.warn('LanguageService: unknown localization key', { key })
    return ''
  }
  return template[language] ?? template.en ?? ''
}

/**
 * Get the language instruction string for prompt builders.
 * Shared across all agent prompt builders to ensure consistency.
 *
 * @param {string} [language='en']
 * @param {object} [options={}]
 * @param {boolean} [options.includeNumbersRule=false] - Add explicit numbers-must-be-English-digits rule
 * @returns {string}
 */
export function getLanguageInstruction(language = 'en', { includeNumbersRule = false } = {}) {
  const LANG_TEXT = {
    en: 'Respond in clear, simple English suitable for Indian farmers.',
    hi: 'Saral aur spasht Hindi mein jawab dein (Devanagari lipi mein).',
    'hi-Latn': 'Roman script mein Hinglish mein jawab dein (jo Hindi bolne wale Roman script mein likhte hain).',
    pa: 'Saral Punjabi mein jawab dein (Gurmukhi lipi mein).',
  }

  const langText = LANG_TEXT[language] ?? LANG_TEXT.en

  if (!includeNumbersRule) return langText

  return (
    langText +
    '\nNUMBERS RULE: ALL numerical values — temperatures (°C/°F), prices (₹), scores (/100), ' +
    'percentages (%), durations (days), rainfall (mm), wind speed (km/h) — ' +
    'MUST be written as English/Arabic digits (0–9) only. ' +
    'Never convert numbers to Devanagari digits or spelled-out Hindi words.'
  )
}
