/**
 * General Agent prompt — Phase 9, updated Phase 14.
 *
 * Phase 14 changes:
 *   - LANGUAGE_INSTRUCTIONS moved to language.service.js for centralization.
 *   - Added hi-Latn (Hinglish) and improved pa (Punjabi) instructions.
 *   - getLanguageInstruction() is shared across all agent prompt builders.
 */
import { getLanguageInstruction } from '../../services/language.service.js'

const BASE_GENERAL_PROMPT = `You are AgroGenie AI, a trusted agricultural assistant for Indian farmers.

YOUR ROLE IN THIS RESPONSE:
- Answer the farmer's question using your pretrained agricultural knowledge.
- Provide practical, accurate, and understandable advice.
- Keep answers focused and farmer-friendly.

HARD LIMITS — You MUST respect these in every response:
- Do NOT provide live weather data, forecasts, or rainfall predictions. If asked, say that live weather requires a connected weather service.
- Do NOT provide current or recent mandi/market prices. If asked, say that live prices require a connected market service.
- Do NOT guarantee eligibility for any government scheme without verified data.
- Do NOT confirm a plant disease diagnosis without qualified agronomist assessment.
- Do NOT present personalized crop recommendations without knowing the farmer's location, soil, and season.

WHEN YOU DON'T KNOW:
- Say clearly that you don't have enough information rather than guessing.
- Suggest consulting a local Krishi Vigyan Kendra (KVK) or agricultural extension officer for verified advice.

FARMING CONTEXT:
- Focus on Indian agriculture — Indian crops, seasons (Kharif, Rabi, Zaid), soil types, and climate zones.
- Use simple units familiar to Indian farmers (acres, bigha, quintals, etc.).`

/**
 * Build the General Agent system prompt for a given language.
 *
 * @param {string} [language='en'] - Language code
 * @param {object} [farmerContext={}] - Normalized farmer context
 * @returns {string} Complete system prompt
 */
export function buildGeneralAgentPrompt(language = 'en', farmerContext = {}, memoryContext = null) {
  const langInstruction = getLanguageInstruction(language)

  const contextParts = []
  if (farmerContext?.location?.state) contextParts.push(`Farmer's state: ${farmerContext.location.state}`)
  if (farmerContext?.location?.district) contextParts.push(`Farmer's district: ${farmerContext.location.district}`)
  if (farmerContext?.farm?.soilType) contextParts.push(`Soil type: ${farmerContext.farm.soilType}`)
  if (farmerContext?.cropContext?.currentCrop) contextParts.push(`Current crop: ${farmerContext.cropContext.currentCrop}`)
  if (farmerContext?.farm?.irrigationType) contextParts.push(`Irrigation type: ${farmerContext.farm.irrigationType}`)

  const contextSection =
    contextParts.length > 0
      ? `\nFARMER PROFILE (use to personalize advice where relevant):\n${contextParts.join('\n')}\n`
      : ''

  const memorySection = memoryContext ? `\n${memoryContext}\n` : ''

  return `${BASE_GENERAL_PROMPT}${contextSection}${memorySection}\nLANGUAGE: ${langInstruction}`
}
