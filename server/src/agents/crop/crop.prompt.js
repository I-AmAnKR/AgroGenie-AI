/**
 * Crop Agent Prompts — Phase 13, updated Phase 14.
 *
 * Phase 14 changes:
 *   - Language instruction centralized via getLanguageInstruction().
 *   - Numbers-must-be-English-digits rule added (crop scores, ranks, dates).
 *   - Added hi-Latn (Hinglish) support.
 *
 * Model-neutral prompt builders for the Crop Recommendation Agent.
 * These prompts work with any instruction-following LLM
 * (Llama 3.3 70B, Granite, Mistral, etc.) via the configured watsonx.ai model.
 *
 * The LLM's role here is ONLY to explain pre-ranked results.
 * The LLM MUST NOT re-rank, re-score, or override the deterministic output.
 *
 * Prompt design principles:
 *   1. All numerical scores are supplied to the LLM as fact — it explains them.
 *   2. The LLM cannot invent crop suitability claims not in the input.
 *   3. Answers are farmer-friendly: practical, actionable, clear.
 *   4. Output is structured Markdown for frontend card rendering.
 *   5. Language is determined by the `language` parameter.
 */
import { getLanguageInstruction } from '../../services/language.service.js'

// ── Formatters ────────────────────────────────────────────────────────────────

/**
 * Format scored crop results for insertion into the LLM user message.
 *
 * @param {object[]} rankedCrops - Top ranked crops from the scoring engine
 * @returns {string}
 */
function formatRankedCropsForPrompt(rankedCrops) {
  return rankedCrops
    .map((crop, i) => {
      const factorLines = Object.entries(crop.factorBreakdown)
        .filter(([, f]) => f.available)
        .map(([key, f]) => `    - ${key}: ${f.score}/100 — ${f.notes?.[0] ?? ''}`)
        .join('\n')

      return `
Rank #${i + 1}: ${crop.name} (Score: ${crop.score}/100 — ${crop.suitabilityLabel})
  Evidence Coverage: ${crop.evidenceCoverage}% | Confidence: ${crop.confidence}
  Water Requirement: ${crop.waterRequirementCategory}
  Duration: ${crop.durationDays?.min ?? '?'}–${crop.durationDays?.max ?? '?'} days
  Risk Level: ${crop.riskLevel}
  Factor Scores:
${factorLines}
  Key Risks:
${crop.keyRisks.map((r) => `    - ${r}`).join('\n')}
  Data Sources: ${crop.officialSources.map((s) => s.title).join(', ') || 'ICAR/ICRISAT curated data'}`
    })
    .join('\n')
}

/**
 * Format farmer context for the prompt.
 *
 * @param {object} farmerContext
 * @param {string|null} season
 * @returns {string}
 */
function formatFarmerContextForPrompt(farmerContext, season) {
  const { location, farm, cropContext } = farmerContext
  const lines = []
  if (location?.state || location?.district) {
    lines.push(`Location: ${[location.district, location.state].filter(Boolean).join(', ')}`)
  }
  if (season) lines.push(`Target Season: ${season}`)
  if (farm?.soilType) lines.push(`Soil Type: ${farm.soilType}`)
  if (farm?.waterAvailability || farm?.irrigationType) {
    lines.push(`Irrigation/Water: ${farm.waterAvailability ?? farm.irrigationType}`)
  }
  if (farm?.area) lines.push(`Farm Area: ${farm.area} ${farm.areaUnit ?? 'hectares'}`)
  if (cropContext?.previousCrops?.[0] || cropContext?.currentCrop) {
    lines.push(`Previous/Current Crop: ${cropContext.previousCrops?.[0] ?? cropContext.currentCrop}`)
  }
  if (farmerContext.preferences?.objective) {
    lines.push(`Objective: ${farmerContext.preferences.objective}`)
  }
  return lines.join('\n')
}

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * Build the system prompt for the crop recommendation LLM call.
 *
 * @param {string} [language='en']
 * @returns {string}
 */
export function buildCropAgentSystemPrompt(language = 'en') {
  const langInstruction = getLanguageInstruction(language, { includeNumbersRule: true })

  return `You are AgroGenie's Crop Recommendation Advisor — an expert agricultural assistant helping Indian farmers choose crops.

${langInstruction}

## Your Role
You are given a pre-ranked list of crops with deterministic suitability scores calculated from verified agronomic data. Your job is to EXPLAIN these rankings to the farmer in simple, actionable language.

## Strict Rules
1. DO NOT re-rank or change the provided scores. The scores are final and calculated by a verified engine.
2. DO NOT invent crop suitability data, prices, or weather values not in the input.
3. DO NOT claim guaranteed yields, profits, or outcomes.
4. DO NOT recommend more than 3 crops in your main answer.
5. ALWAYS acknowledge evidence gaps if confidence is 'low' or coverage < 65%.
6. Write in a warm, practical tone suitable for farmers — avoid jargon.

## Output Format
Structure your response as:
1. A brief 2-sentence summary of the top recommendation
2. For each ranked crop (top 3): why it was recommended and what to watch out for
3. A practical next-step suggestion
4. If evidence is limited: an honest disclaimer about confidence

Keep the total response under 350 words.`
}

// ── User message builder ──────────────────────────────────────────────────────

/**
 * Build the user message for the crop recommendation LLM call.
 *
 * @param {object} params
 * @param {string} params.originalMessage - Farmer's original query
 * @param {object} params.farmerContext - Normalized farmer context
 * @param {string|null} params.season - Resolved season
 * @param {object[]} params.rankedCrops - Top N crops from scoring engine
 * @param {object} params.weatherEvidence - Collected weather data (for summary)
 * @param {object} params.schemeEvidence - Collected scheme evidence
 * @returns {string}
 */
export function buildCropAgentUserMessage({
  originalMessage,
  farmerContext,
  season,
  rankedCrops,
  weatherEvidence,
  schemeEvidence,
  memoryContext = null,
}) {
  const farmerSection = formatFarmerContextForPrompt(farmerContext, season)
  const cropsSection = formatRankedCropsForPrompt(rankedCrops)

  const weatherSummary = weatherEvidence?.available
    ? `Current temperature: ${weatherEvidence.current?.temperatureC ?? 'N/A'}°C, Condition: ${weatherEvidence.current?.condition ?? 'N/A'}`
    : 'Weather data: not available for this query'

  const schemeSummary = schemeEvidence?.available && schemeEvidence.hasRelevantSchemes
    ? `Relevant government schemes found: ${schemeEvidence.schemeNames.join(', ')}`
    : 'No specific government schemes identified for current profile'

  const memorySection = memoryContext ? `\n## Historical Memory Context\n${memoryContext}\n` : ''

  return `## Farmer's Question
${originalMessage}

## Farmer Profile
${farmerSection}
${memorySection}
## Weather Summary
${weatherSummary}

## Scheme Support
${schemeSummary}

## Pre-Ranked Crop Results (calculated by deterministic scoring engine)
${cropsSection}

## Your Task
Explain these rankings to the farmer. Help them understand why the top crop was recommended, what they need to watch out for, and what practical steps to take next.
Remember: these scores are pre-calculated — do NOT change them. Only explain and contextualize them.`
}

// ── Clarification prompt ──────────────────────────────────────────────────────

/**
 * Build a clarification message when critical farmer context is missing.
 *
 * @param {string[]} missingFields
 * @returns {string}
 */
export function buildClarificationMessage(missingFields) {
  const fieldLabels = {
    season: 'Which season are you planning to grow crops in? (Kharif — June to October, or Rabi — October to March)',
    'farm.soilType': 'What type of soil does your farm have? (e.g. black cotton soil, sandy loam, alluvial clay)',
    'location.state': 'Which state is your farm located in?',
    'location.district': 'Which district is your farm in?',
    'farm.waterAvailability': 'How is your farm irrigated? (e.g. canal irrigation, drip, rainfed)',
  }

  const questions = missingFields
    .map((f, i) => `${i + 1}. ${fieldLabels[f] ?? f}`)
    .join('\n')

  return (
    'To recommend the most suitable crops for your farm, I need a few details:\n\n' +
    questions +
    '\n\nPlease share these details and I will provide a personalized crop recommendation.'
  )
}
