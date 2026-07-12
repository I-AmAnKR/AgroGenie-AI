/**
 * Crop Scoring Service — Phase 13.
 *
 * Deterministic scoring engine for crop recommendation.
 * ALL numerical calculations are performed here in application code.
 * The LLM is NEVER asked to score, rank, or compare crops.
 *
 * Scoring formula:
 *   weightedScore = Σ(factorScore_i × weight_i) / Σ(weight_i for available factors)
 *   evidenceCoverage = Σ(weight_i for available factors) / Σ(all weights) × 100
 *
 * Factor score scale: 0–100 (higher = better fit)
 *   0–19  — very poor fit (potential disqualifier)
 *   20–49 — poor/uncertain fit
 *   50–69 — moderate fit
 *   70–84 — good fit
 *   85–100 — excellent fit
 *
 * Hard disqualification rules:
 *   1. seasonFit.score < 20 — season mismatch
 *   2. waterFit.score < 15 AND waterRequirementCategory = HIGH AND
 *      waterAvailability in { null, 'rainfed', 'scarce' } — verified incompatibility
 *
 * All pure functions — no external calls, no I/O.
 */
import config from '../config/env.js'
import { WATER_REQ, SOIL_COMPAT, normalizeSoilTypeKey } from '../models/cropProfile.schema.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const WATER_AVAILABILITY_MAP = {
  // String values that indicate good water availability
  available: 'HIGH',
  canal: 'HIGH',
  'canal irrigation': 'HIGH',
  'tube well': 'HIGH',
  'borewell': 'HIGH',
  'drip': 'MEDIUM',
  'sprinkler': 'MEDIUM',
  'drip irrigation': 'MEDIUM',
  'sprinkler irrigation': 'MEDIUM',
  'supplemental': 'MEDIUM',
  rainfed: 'LOW',
  'rain fed': 'LOW',
  scarce: 'VERY_LOW',
  'no irrigation': 'VERY_LOW',
  limited: 'VERY_LOW',
}

const SOIL_COMPAT_SCORES = {
  [SOIL_COMPAT.PREFERRED]: 100,
  [SOIL_COMPAT.SUITABLE]: 75,
  [SOIL_COMPAT.MARGINAL]: 35,
  [SOIL_COMPAT.UNSUITABLE]: 0,
}

const WATER_REQUIREMENT_MISMATCH = {
  // cropWaterReq × availableWaterLevel → score
  [WATER_REQ.HIGH]: { HIGH: 95, MEDIUM: 50, LOW: 15, VERY_LOW: 0 },
  [WATER_REQ.MEDIUM]: { HIGH: 100, MEDIUM: 90, LOW: 50, VERY_LOW: 20 },
  [WATER_REQ.LOW]: { HIGH: 100, MEDIUM: 100, LOW: 85, VERY_LOW: 65 },
  [WATER_REQ.VERY_LOW]: { HIGH: 100, MEDIUM: 100, LOW: 100, VERY_LOW: 90 },
}

// ── Weather risk thresholds ───────────────────────────────────────────────────

const HEAT_STRESS_THRESHOLD_C = 38 // °C max temp above which heat stress degrades score
const COLD_RISK_THRESHOLD_C = 5    // °C min temp below which cold risk degrades score
const LOW_RAIN_THRESHOLD_MM = 50   // mm/week below which water-stress crops suffer
const HIGH_RAIN_THRESHOLD_MM = 180 // mm/week above which waterlogging-sensitive crops suffer

// ── Label formatters ──────────────────────────────────────────────────────────

/**
 * Convert a 0–100 numeric score to a human-readable label.
 *
 * @param {number} score
 * @returns {{ label: string, color: string }}
 */
export function scoreSuitabilityLabel(score) {
  if (score >= 85) return { label: 'Highly Suitable', color: 'success' }
  if (score >= 70) return { label: 'Suitable', color: 'info' }
  if (score >= 55) return { label: 'Moderately Suitable', color: 'warning' }
  if (score >= 40) return { label: 'Conditionally Suitable', color: 'warning' }
  return { label: 'Not Recommended', color: 'danger' }
}

/**
 * Convert an evidence coverage percentage to a confidence category.
 *
 * @param {number} coverage - 0–100
 * @returns {'high'|'medium'|'low'}
 */
export function coverageToConfidence(coverage) {
  if (coverage >= 85) return 'high'
  if (coverage >= 65) return 'medium'
  return 'low'
}

// ── Factor scorers ────────────────────────────────────────────────────────────

/**
 * Score season fit.
 * Returns null if season info is not available.
 *
 * @param {object} cropProfile
 * @param {string|null} season - Farmer's intended season
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreSeasonFit(cropProfile, season) {
  if (!season) {
    return { score: 0, notes: ['Season not specified — season fit not evaluated'], available: false }
  }
  const norm = season.trim()
  const matches = cropProfile.seasons.some((s) => s.toLowerCase() === norm.toLowerCase())
  if (matches) {
    return {
      score: 100,
      notes: [`${cropProfile.name} is a verified ${norm} crop`],
      available: true,
    }
  }

  // Check if it can grow but sub-optimally (Perennial / multi-season crops)
  if (cropProfile.seasons.includes('Perennial')) {
    return {
      score: 70,
      notes: [`${cropProfile.name} is perennial and can be grown across seasons`],
      available: true,
    }
  }

  return {
    score: 10,
    notes: [
      `${cropProfile.name} is typically grown in ${cropProfile.seasons.join('/')} — not ${norm}`,
      'Season mismatch significantly reduces suitability',
    ],
    available: true,
  }
}

/**
 * Score soil fit.
 *
 * @param {object} cropProfile
 * @param {string|null} soilType
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreSoilFit(cropProfile, soilType) {
  if (!soilType) {
    return { score: 0, notes: ['Soil type not specified — soil fit not evaluated'], available: false }
  }
  const key = normalizeSoilTypeKey(soilType)
  const compat = cropProfile.soilCompatibility[key]
  if (!compat) {
    // Not in the map — partial credit for unknown soil
    return {
      score: 55,
      notes: [`Soil type "${soilType}" not in verified profile — assumed marginal compatibility`],
      available: true,
    }
  }
  const score = SOIL_COMPAT_SCORES[compat] ?? 55
  const notes = []
  if (compat === SOIL_COMPAT.PREFERRED) notes.push(`${soilType} soil is ideal for ${cropProfile.name}`)
  if (compat === SOIL_COMPAT.SUITABLE) notes.push(`${soilType} soil is suitable for ${cropProfile.name}`)
  if (compat === SOIL_COMPAT.MARGINAL)
    notes.push(`${soilType} soil provides marginal conditions — soil improvement recommended`)
  if (compat === SOIL_COMPAT.UNSUITABLE)
    notes.push(`${soilType} soil is incompatible with ${cropProfile.name} — not recommended`)
  return { score, notes, available: true }
}

/**
 * Score water / irrigation fit.
 *
 * @param {object} cropProfile
 * @param {object} farm - { waterAvailability, irrigationType }
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreWaterFit(cropProfile, farm) {
  const rawWater = (farm?.waterAvailability ?? farm?.irrigationType ?? '').toLowerCase().trim()
  if (!rawWater) {
    return { score: 0, notes: ['Water availability not specified — water fit not evaluated'], available: false }
  }

  // Map raw water string to availability level
  let availLevel = null
  for (const [key, level] of Object.entries(WATER_AVAILABILITY_MAP)) {
    if (rawWater.includes(key)) {
      availLevel = level
      break
    }
  }
  if (!availLevel) availLevel = 'MEDIUM' // assume medium if unrecognized

  const cropWaterReq = cropProfile.waterRequirementCategory
  const scoreMap = WATER_REQUIREMENT_MISMATCH[cropWaterReq]
  const score = scoreMap?.[availLevel] ?? 50

  const notes = []
  if (score >= 85) {
    notes.push(`Water availability matches ${cropProfile.name}'s ${cropWaterReq.toLowerCase()} requirement`)
  } else if (score >= 50) {
    notes.push(`Water availability partially matches — ${cropProfile.name} requires ${cropWaterReq.toLowerCase()} water`)
  } else {
    notes.push(
      `Water mismatch: ${cropProfile.name} requires ${cropWaterReq.toLowerCase()} water availability ` +
        `but farm shows ${availLevel.toLowerCase()} availability`
    )
  }
  return { score, notes, available: true }
}

/**
 * Score location fit (state-level).
 *
 * @param {object} cropProfile
 * @param {object} location - { state, district }
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreLocationFit(cropProfile, location) {
  const state = location?.state
  if (!state) {
    return { score: 0, notes: ['Location not specified — location fit not evaluated'], available: false }
  }
  if (!cropProfile.suitableStates) {
    // null means pan-India
    return {
      score: 80,
      notes: [`${cropProfile.name} is grown across India including ${state}`],
      available: true,
    }
  }
  const matches = cropProfile.suitableStates.some(
    (s) => s.toLowerCase() === state.toLowerCase()
  )
  if (matches) {
    return {
      score: 95,
      notes: [
        `${state} is a verified production state for ${cropProfile.name}`,
      ],
      available: true,
    }
  }
  return {
    score: 40,
    notes: [
      `${cropProfile.name} is not commonly grown in ${state} — check local agronomy extension advice`,
    ],
    available: true,
  }
}

/**
 * Score crop rotation fit.
 *
 * @param {object} cropProfile
 * @param {string|null} previousCrop
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreRotationFit(cropProfile, previousCrop) {
  if (!previousCrop) {
    return { score: 0, notes: ['Previous crop not specified — rotation fit not evaluated'], available: false }
  }
  const prev = previousCrop.toLowerCase()
  const goodAfterNorm = cropProfile.rotationCompatibility.goodAfter.map((c) => c.toLowerCase())
  const poorAfterNorm = cropProfile.rotationCompatibility.poorAfter.map((c) => c.toLowerCase())

  const isGood = goodAfterNorm.some((c) => prev.includes(c) || c.includes(prev))
  const isPoor = poorAfterNorm.some((c) => prev.includes(c) || c.includes(prev))

  if (isGood) {
    return {
      score: 95,
      notes: [`Good crop rotation: ${cropProfile.name} after ${previousCrop}`],
      available: true,
    }
  }
  if (isPoor) {
    return {
      score: 25,
      notes: [
        `Poor rotation: ${cropProfile.name} after ${previousCrop} risks disease carryover and soil depletion`,
      ],
      available: true,
    }
  }
  return {
    score: 65,
    notes: [`Neutral rotation: ${previousCrop} before ${cropProfile.name} — no known benefit or harm`],
    available: true,
  }
}

/**
 * Score weather fit from weather provider data.
 * Uses verified crop temperature thresholds — not LLM guesses.
 *
 * @param {object} cropProfile
 * @param {object|null} weatherEvidence - { current, forecast } from weather provider
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreWeatherFit(cropProfile, weatherEvidence) {
  if (!weatherEvidence?.current) {
    return { score: 0, notes: ['Weather data not available — weather fit not evaluated'], available: false }
  }

  const { current, forecast = [] } = weatherEvidence
  const temp = current.temperatureC
  const notes = []
  let score = 75 // start at moderate fit

  const { min, optimalMin, optimalMax, max } = cropProfile.temperatureRangeC

  if (temp !== null) {
    if (temp >= optimalMin && temp <= optimalMax) {
      score = Math.min(score + 20, 100)
      notes.push(`Current temperature ${temp}°C is in optimal range for ${cropProfile.name} (${optimalMin}–${optimalMax}°C)`)
    } else if (temp < min || temp > max) {
      score = Math.max(score - 40, 10)
      notes.push(`Current temperature ${temp}°C is outside ${cropProfile.name}'s tolerance (${min}–${max}°C)`)
    } else if (temp > HEAT_STRESS_THRESHOLD_C && cropProfile.commonWeatherRisks?.includes('HEAT_STRESS')) {
      score = Math.max(score - 20, 20)
      notes.push(`Temperature ${temp}°C may cause heat stress for ${cropProfile.name}`)
    } else if (temp < COLD_RISK_THRESHOLD_C && cropProfile.commonWeatherRisks?.includes('COLD_RISK')) {
      score = Math.max(score - 20, 20)
      notes.push(`Temperature ${temp}°C may cause cold stress for ${cropProfile.name}`)
    }
  }

  // Check rainfall from 7-day forecast
  const weeklyRainMm = forecast.slice(0, 7).reduce((sum, d) => sum + (d.precipitationMm ?? 0), 0)
  if (weeklyRainMm > 0) {
    const isWaterStressCrop = cropProfile.commonWeatherRisks?.includes('WATER_STRESS')
    const isExcessRainRisk = cropProfile.commonWeatherRisks?.includes('EXCESS_RAIN_RISK')

    if (weeklyRainMm < LOW_RAIN_THRESHOLD_MM && isWaterStressCrop && cropProfile.waterRequirementCategory === WATER_REQ.HIGH) {
      score = Math.max(score - 15, 20)
      notes.push(`Low rainfall forecast (${weeklyRainMm.toFixed(0)} mm/week) — ${cropProfile.name} needs more water`)
    }
    if (weeklyRainMm > HIGH_RAIN_THRESHOLD_MM && isExcessRainRisk) {
      score = Math.max(score - 15, 20)
      notes.push(`Heavy rainfall forecast (${weeklyRainMm.toFixed(0)} mm/week) increases disease risk for ${cropProfile.name}`)
    }
    if (!notes.find((n) => n.includes('mm/week'))) {
      notes.push(`7-day rainfall forecast: ${weeklyRainMm.toFixed(0)} mm`)
    }
  }

  return { score, notes, available: true }
}

/**
 * Score market evidence for this crop.
 * Uses pre-computed statistics — never computes prices here.
 *
 * @param {object} cropProfile
 * @param {object|null} marketEvidence - { statistics, trend, available }
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreMarketEvidence(cropProfile, marketEvidence) {
  if (!marketEvidence || !marketEvidence.available) {
    return { score: 0, notes: ['Market data not available'], available: false }
  }
  const { statistics, trend } = marketEvidence
  const notes = []
  let score = 65 // neutral market score by default

  if (statistics?.modalPrice) {
    const price = statistics.modalPrice
    notes.push(`Modal price: ₹${price}/quintal (from ${statistics.count ?? 1} market report(s))`)

    // Score adjusts based on price trend, not absolute price
    if (trend?.trendStatus === 'rising') {
      score = 80
      notes.push('Market trend: rising — positive signal for this crop')
    } else if (trend?.trendStatus === 'falling') {
      score = 45
      notes.push('Market trend: falling — consider risk of lower returns')
    } else if (trend?.trendStatus === 'stable') {
      score = 70
      notes.push('Market trend: stable — predictable returns')
    } else if (trend?.trendStatus === 'volatile') {
      score = 50
      notes.push('Market trend: volatile — higher risk in pricing')
    }
  } else {
    notes.push('No recent mandi price data found for this crop in your region')
    score = 55
  }

  return { score, notes, available: true }
}

/**
 * Score RAG knowledge fit.
 * Uses retrieved agronomic chunks — not LLM-generated claims.
 *
 * @param {object} cropProfile
 * @param {object|null} knowledgeEvidence - { retrieved: boolean, relevantChunkCount, contextSummary }
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreKnowledgeFit(cropProfile, knowledgeEvidence) {
  if (!knowledgeEvidence || !knowledgeEvidence.available) {
    return { score: 0, notes: ['Agronomic knowledge base retrieval not available'], available: false }
  }
  const { retrieved, relevantChunkCount = 0 } = knowledgeEvidence
  if (!retrieved || relevantChunkCount === 0) {
    return {
      score: 55,
      notes: ['No specific knowledge base documents found for this crop — using profile data only'],
      available: true,
    }
  }
  const score = Math.min(60 + relevantChunkCount * 8, 90) // up to 90 for 4+ chunks
  return {
    score,
    notes: [
      `${relevantChunkCount} agronomic knowledge document(s) support this recommendation`,
    ],
    available: true,
  }
}

/**
 * Score scheme support bonus.
 * Checks whether relevant schemes exist for this crop.
 *
 * @param {object} cropProfile
 * @param {object|null} schemeEvidence - { hasRelevantSchemes: boolean, schemeCount: number }
 * @returns {{ score: number, notes: string[], available: boolean }}
 */
export function scoreSchemeSupport(cropProfile, schemeEvidence) {
  if (!schemeEvidence || !schemeEvidence.available) {
    return { score: 0, notes: ['Scheme data not evaluated'], available: false }
  }
  if (schemeEvidence.hasRelevantSchemes) {
    return {
      score: 90,
      notes: [
        `${schemeEvidence.schemeCount ?? 'Some'} government scheme(s) may apply to this crop`,
      ],
      available: true,
    }
  }
  return {
    score: 50,
    notes: ['No specific government scheme found for this crop in your area'],
    available: true,
  }
}

// ── Weighted aggregate scorer ─────────────────────────────────────────────────

/**
 * Compute the weighted aggregate suitability score for a crop.
 *
 * @param {object} factors - { seasonFit, soilFit, waterFit, locationFit, weatherFit,
 *                            rotationFit, marketEvidence, knowledgeFit, schemeSupport }
 * @param {object} [weights] - Optional weight overrides (from config.crop.weights)
 * @returns {{
 *   score: number,              — 0–100 weighted aggregate
 *   evidenceCoverage: number,  — % of max weight that was available
 *   confidence: string,        — 'high'|'medium'|'low'
 *   factorBreakdown: object    — factor-by-factor scores and notes
 * }}
 */
export function computeWeightedScore(factors, weights) {
  const w = weights ?? config.crop.weights

  const factorKeys = [
    { key: 'seasonFit', weight: w.seasonFit },
    { key: 'soilFit', weight: w.soilFit },
    { key: 'waterFit', weight: w.waterFit },
    { key: 'locationFit', weight: w.locationFit },
    { key: 'weatherFit', weight: w.weatherFit },
    { key: 'rotationFit', weight: w.rotationFit },
    { key: 'marketEvidence', weight: w.marketEvidence },
    { key: 'knowledgeFit', weight: w.knowledgeFit },
    { key: 'schemeSupport', weight: w.schemeSupport },
  ]

  let weightedSum = 0
  let totalWeight = factorKeys.reduce((s, f) => s + f.weight, 0)
  let availableWeight = 0

  const factorBreakdown = {}

  for (const { key, weight } of factorKeys) {
    const factor = factors[key]
    factorBreakdown[key] = factor ?? { score: 0, notes: [], available: false }
    if (factor?.available) {
      weightedSum += factor.score * weight
      availableWeight += weight
    }
  }

  // Normalize by available weight (not total) to avoid penalizing missing evidence
  const score = availableWeight > 0 ? Math.round(weightedSum / availableWeight) : 0
  const evidenceCoverage = Math.round((availableWeight / totalWeight) * 100)
  const confidence = coverageToConfidence(evidenceCoverage)

  return { score, evidenceCoverage, confidence, factorBreakdown }
}

// ── Disqualification check ────────────────────────────────────────────────────

/**
 * Check if a crop should be disqualified based on hard constraints.
 *
 * @param {object} cropProfile
 * @param {object} factorScores - Output of individual factor scorers
 * @returns {{ disqualified: boolean, reason: string|null }}
 */
export function checkDisqualification(cropProfile, factorScores) {
  // Rule 1: season mismatch
  if (factorScores.seasonFit?.available && factorScores.seasonFit.score < 20) {
    return {
      disqualified: true,
      reason: `Season mismatch: ${cropProfile.name} is not suitable for the intended season`,
    }
  }

  // Rule 2: water incompatibility
  if (
    factorScores.waterFit?.available &&
    factorScores.waterFit.score < 15 &&
    cropProfile.waterRequirementCategory === WATER_REQ.HIGH
  ) {
    return {
      disqualified: true,
      reason: `Water incompatibility: ${cropProfile.name} requires high water availability, which is not available on this farm`,
    }
  }

  return { disqualified: false, reason: null }
}

// ── Risk builder ──────────────────────────────────────────────────────────────

/**
 * Build the risk analysis for a scored crop.
 * Combines verified profile risks with evidence-based observations.
 *
 * @param {object} cropProfile
 * @param {object} factorScores
 * @param {object} weatherEvidence
 * @returns {{ riskLevel: string, keyRisks: string[] }}
 */
export function buildRiskAnalysis(cropProfile, factorScores, weatherEvidence) {
  const keyRisks = [...cropProfile.riskFactors]

  // Add evidence-based risks
  if (factorScores.soilFit?.score < 40 && factorScores.soilFit?.available) {
    keyRisks.push('Soil compatibility is marginal — amendments required before planting')
  }
  if (factorScores.waterFit?.score < 50 && factorScores.waterFit?.available) {
    keyRisks.push('Water availability is lower than ideal — monitor crop stress')
  }
  if (factorScores.marketEvidence?.score < 50 && factorScores.marketEvidence?.available) {
    keyRisks.push('Market price trend is unfavorable — consider alternate market channels')
  }
  if (weatherEvidence?.current?.temperatureC > HEAT_STRESS_THRESHOLD_C) {
    keyRisks.push(`Heat stress risk: current temperature ${weatherEvidence.current.temperatureC}°C`)
  }

  const riskLevel =
    keyRisks.length >= 4 ? 'high' : keyRisks.length >= 2 ? 'medium' : 'low'

  return { riskLevel, keyRisks: keyRisks.slice(0, 5) }
}

// ── Main entry: rank all candidates ──────────────────────────────────────────

/**
 * Score and rank all candidate crop profiles.
 * Returns sorted array (highest score first) with disqualified crops excluded.
 *
 * @param {object} params
 * @param {object[]} params.candidates - CropProfile objects
 * @param {object} params.farmerContext - Normalized farmer context
 * @param {object|null} params.weatherEvidence - Collected weather evidence
 * @param {object} params.marketEvidenceMap - { cropCode: marketEvidence }
 * @param {object} params.knowledgeEvidenceMap - { cropCode: knowledgeEvidence }
 * @param {object} params.schemeEvidence - Shared scheme evidence (not per-crop)
 * @param {object} [params.weights] - Optional weight overrides
 * @returns {object[]} Ranked crop results
 */
export function rankCandidates({
  candidates,
  farmerContext,
  weatherEvidence,
  marketEvidenceMap,
  knowledgeEvidenceMap,
  schemeEvidence,
  weights,
}) {
  const { location, farm, cropContext } = farmerContext
  const season = farmerContext.season ?? farmerContext.cropContext?.season ?? null
  const previousCrop = cropContext?.previousCrops?.[0] ?? cropContext?.currentCrop ?? null

  const results = []

  for (const crop of candidates) {
    // Score individual factors
    const factorScores = {
      seasonFit: scoreSeasonFit(crop, season),
      soilFit: scoreSoilFit(crop, farm?.soilType),
      waterFit: scoreWaterFit(crop, farm),
      locationFit: scoreLocationFit(crop, location),
      weatherFit: scoreWeatherFit(crop, weatherEvidence),
      rotationFit: scoreRotationFit(crop, previousCrop),
      marketEvidence: scoreMarketEvidence(crop, marketEvidenceMap?.[crop.cropCode] ?? null),
      knowledgeFit: scoreKnowledgeFit(crop, knowledgeEvidenceMap?.[crop.cropCode] ?? null),
      schemeSupport: scoreSchemeSupport(crop, schemeEvidence),
    }

    // Disqualification check
    const { disqualified, reason } = checkDisqualification(crop, factorScores)
    if (disqualified) continue

    // Weighted aggregate
    const { score, evidenceCoverage, confidence, factorBreakdown } = computeWeightedScore(
      factorScores,
      weights
    )

    // Risk analysis
    const { riskLevel, keyRisks } = buildRiskAnalysis(crop, factorScores, weatherEvidence)

    // Suitability label
    const { label: suitabilityLabel, color: suitabilityColor } = scoreSuitabilityLabel(score)

    results.push({
      cropCode: crop.cropCode,
      name: crop.name,
      localNames: crop.localNames,
      cropType: crop.cropType,
      seasons: crop.seasons,
      score,
      suitabilityLabel,
      suitabilityColor,
      evidenceCoverage,
      confidence,
      waterRequirementCategory: crop.waterRequirementCategory,
      durationDays: crop.durationDays,
      riskLevel,
      keyRisks,
      factorBreakdown,
      officialSources: crop.officialSources,
      isDemo: crop.isDemo,
    })
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  // Add rank
  return results.map((r, i) => ({ ...r, rank: i + 1 }))
}
