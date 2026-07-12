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
You are given a pre-ranked list of crops with deterministic suitability scores calculated from verified agronomic data, along with supporting weather and market evidence. Your job is to produce ONE integrated, actionable recommendation that covers crop suitability, weather conditions, and market trends together.

## Strict Rules
1. DO NOT re-rank or change the provided scores. The scores are final and calculated by a verified engine.
2. DO NOT invent crop suitability data, prices, or weather values not in the input.
3. DO NOT claim guaranteed yields, profits, or outcomes.
4. DO NOT recommend more than 3 crops in your main answer.
5. ALWAYS acknowledge evidence gaps if confidence is 'low' or coverage < 65%.
6. Write in a warm, practical tone suitable for farmers — avoid jargon.
7. Produce ONE unified response — do NOT split into separate "Crop", "Weather", and "Market" sections.

## Output Format
Structure your response using these headings (all in one answer):

### 🌾 Top Recommendation
One paragraph explaining why the top crop was recommended, integrating its score, weather suitability, and market context.

### 📊 Suitability Scores
Brief table or list: Rank | Crop | Score | Key Reason

### 🌦️ Weather Impact
How the current and forecast weather affects the top recommendation (use actual temperature/rain values from input).

### 📈 Market Outlook
Current price trend and demand context for the top crop (use actual price values from input if available).

### ⚠️ Key Risks & Next Steps
What the farmer should watch out for, and 2-3 concrete next actions.

### 🌱 Alternatives
Brief mention of the 2nd and 3rd ranked crops and when they might be preferred.

Keep the total response under 450 words.`
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
  marketEvidenceMap = {},
  schemeEvidence,
  memoryContext = null,
  canonicalLocation = null,
}) {
  const farmerSection = formatFarmerContextForPrompt(farmerContext, season)
  const cropsSection = formatRankedCropsForPrompt(rankedCrops)

  // ── Weather section ──────────────────────────────────────────────────
  let weatherSection
  if (weatherEvidence?.available && weatherEvidence.current) {
    const cur = weatherEvidence.current
    const forecast3 = (weatherEvidence.forecast ?? []).slice(0, 3)
    const forecastLines = forecast3.map(
      (d) =>
        `  ${d.date}: ${d.minTemperatureC ?? '?'}–${d.maxTemperatureC ?? '?'}°C, ` +
        `Rain probability: ${d.precipitationProbabilityPercent ?? '?'}%, ` +
        `Condition: ${d.condition ?? '?'}`
    ).join('\n')

    weatherSection = `Location: ${canonicalLocation?.locationName ?? weatherEvidence.locationName ?? 'N/A'}
Current: ${cur.temperatureC ?? 'N/A'}°C, ${cur.condition ?? 'N/A'}, Humidity: ${cur.humidityPercent ?? 'N/A'}%, Wind: ${cur.windSpeedKph ?? 'N/A'} km/h
3-Day Forecast:
${forecastLines || '  Not available'}`
  } else {
    weatherSection = 'Weather data not available for this location.'
  }

  // ── Market section ───────────────────────────────────────────────────
  const marketLines = rankedCrops
    .map((crop) => {
      const me = marketEvidenceMap?.[crop.cropCode]
      if (!me?.available || !me.statistics) return `  ${crop.name}: Market data not available`
      const stats = me.statistics
      const trend = me.trend?.trendStatus ?? 'unknown'
      return (
        `  ${crop.name}: Modal ₹${stats.modalPrice ?? 'N/A'}/quintal ` +
        `(Min ₹${stats.minPrice ?? 'N/A'} – Max ₹${stats.maxPrice ?? 'N/A'}), ` +
        `Trend: ${trend}`
      )
    })
    .join('\n')

  const marketSection = marketLines || 'Market data not available.'

  // ── Scheme section (only if available) ──────────────────────────────
  const schemeSummary = schemeEvidence?.available && schemeEvidence.hasRelevantSchemes
    ? `Relevant government schemes: ${schemeEvidence.schemeNames.join(', ')}`
    : null

  const memorySection = memoryContext ? `\n## Historical Memory Context\n${memoryContext}\n` : ''

  return `## Farmer's Question
${originalMessage}

## Farmer Profile
${farmerSection}
${memorySection}
## Current Weather & Forecast
${weatherSection}

## Market Prices (INR/quintal)
${marketSection}
${schemeSummary ? `\n## Government Scheme Support\n${schemeSummary}\n` : ''}
## Pre-Ranked Crop Results (calculated by deterministic scoring engine)
${cropsSection}

## Your Task
Produce ONE integrated crop recommendation using the output format specified in your system prompt.
The farmer wants to know: which crop to grow, how the weather affects that choice, and what the market looks like.
All scores above are pre-calculated — do NOT change them. Use the weather and market data above to enrich your explanation.`
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
