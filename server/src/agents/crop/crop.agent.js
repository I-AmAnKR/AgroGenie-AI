/**
 * Crop Recommendation Agent — Phase 13.
 *
 * ORCHESTRATOR — replaces the Phase 9 placeholder.
 *
 * This agent does NOT ask the LLM "What crop should this farmer grow?"
 * It collects structured evidence, runs a deterministic scoring engine,
 * and then calls the configured watsonx.ai model ONLY to explain results.
 *
 * Flow:
 *   1. Validate farmer context — check for critical missing fields
 *   2. Resolve season from message or farmer profile
 *   3. Generate candidate crop list from verified CropProfile data
 *   4. Collect evidence in parallel:
 *        a. Weather data (WeatherProvider)
 *        b. Market data per crop (MarketProvider + analytics)
 *        c. RAG knowledge per crop (rag.service.js)
 *        d. Government schemes (schemes.service.js)
 *   5. Run deterministic scoring engine (CropScoringService)
 *   6. Apply hard disqualification rules
 *   7. Rank surviving candidates
 *   8. Call watsonx.ai model to explain ranked results
 *   9. Return normalized AgentResult with recommendation data
 *
 * Safety rules:
 *   - NEVER ask the LLM which crop to grow — scores are computed, not generated.
 *   - NEVER invent crop suitability, weather values, or market prices.
 *   - NEVER call the LLM if scoring fails — return partial_success with data.
 *   - If critical context is missing → return NEEDS_CLARIFICATION.
 *   - All recommendation data attached to result.recommendation for frontend.
 *
 * Architecture:
 *   Agent Router → runCropAgent() → CropEvidenceService → CropScoringService
 *                                → watsonx.ai explain call
 *   Controllers must not call this agent directly.
 */
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { findProfilesBySeason, getAllCropProfiles } from '../../data/seed/cropProfiles.seed.js'
import { collectAllEvidence } from '../../services/cropEvidence.service.js'
import { rankCandidates } from '../../services/cropScoring.service.js'
import {
  buildCropAgentSystemPrompt,
  buildCropAgentUserMessage,
  buildClarificationMessage,
} from './crop.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import config from '../../config/env.js'
import logger from '../../utils/logger.js'

// ── Season resolution ─────────────────────────────────────────────────────────

const KHARIF_PATTERNS = [
  /\bkharif\b/i,
  /\b(june|july|august|september|october)\b/i,
  /\b(monsoon|rainy season)\b/i,
  /\bjun|jul|aug|sep|oct\b/i,
]

const RABI_PATTERNS = [
  /\brabi\b/i,
  /\b(november|december|january|february|march)\b/i,
  /\bwinter (season|crop)\b/i,
  /\bnov|dec|jan|feb|mar\b/i,
]

const ZAID_PATTERNS = [
  /\bzaid\b/i,
  /\bsummer (season|crop)\b/i,
  /\b(april|may)\b/i,
]

/**
 * Resolve the intended growing season from message and context.
 *
 * @param {string} message - Farmer's query
 * @param {object} farmerContext - Normalized farmer context
 * @returns {string|null} Season string or null if unknown
 */
function resolveSeason(message, farmerContext) {
  const msg = message ?? ''

  if (KHARIF_PATTERNS.some((p) => p.test(msg))) return 'Kharif'
  if (RABI_PATTERNS.some((p) => p.test(msg))) return 'Rabi'
  if (ZAID_PATTERNS.some((p) => p.test(msg))) return 'Zaid'

  // Check farmer context (in case profile stores season preference)
  const ctxSeason = farmerContext?.cropContext?.season ?? farmerContext?.season
  if (ctxSeason) {
    if (/kharif/i.test(ctxSeason)) return 'Kharif'
    if (/rabi/i.test(ctxSeason)) return 'Rabi'
    if (/zaid/i.test(ctxSeason)) return 'Zaid'
  }

  return null
}

// ── Critical context validation ───────────────────────────────────────────────

/**
 * Identify critical missing fields needed for a meaningful recommendation.
 *
 * Missing fields that are already in FarmerProfile are NOT requested again.
 * Only truly absent fields are listed.
 *
 * @param {object} farmerContext - Normalized farmer context
 * @param {string|null} season - Resolved season
 * @returns {string[]} List of missing field keys
 */
function findMissingCriticalFields(farmerContext, season) {
  const missing = []

  if (!farmerContext?.location?.state && !farmerContext?.location?.district) {
    missing.push('location.state')
  }
  if (!farmerContext?.farm?.soilType) {
    missing.push('farm.soilType')
  }
  if (!farmerContext?.farm?.waterAvailability && !farmerContext?.farm?.irrigationType) {
    missing.push('farm.waterAvailability')
  }
  if (!season) {
    missing.push('season')
  }

  return missing
}

// ── Sources builder ───────────────────────────────────────────────────────────

/**
 * Build source cards for the agent result from evidence collected.
 *
 * @param {object[]} rankedCrops - Top ranked crops
 * @param {object} weatherEvidence
 * @param {object} knowledgeEvidenceMap
 * @returns {object[]}
 */
function buildRecommendationSources(rankedCrops, weatherEvidence, knowledgeEvidenceMap) {
  const sources = []

  // Crop profile sources (ICAR/ICRISAT)
  const seen = new Set()
  for (const crop of rankedCrops) {
    for (const src of crop.officialSources ?? []) {
      const key = src.title
      if (!seen.has(key)) {
        seen.add(key)
        sources.push({
          sourceType: 'crop_profile',
          title: src.title,
          url: src.url ?? null,
          year: src.year ?? null,
          isDemo: crop.isDemo,
        })
      }
    }
  }

  // Weather source
  if (weatherEvidence?.available) {
    sources.push({
      sourceType: 'weather_api',
      provider: weatherEvidence.provider,
      location: weatherEvidence.locationName ?? null,
      isDemo: weatherEvidence.isDemo,
    })
  }

  // RAG knowledge sources
  for (const crop of rankedCrops) {
    const ke = knowledgeEvidenceMap?.[crop.cropCode]
    if (ke?.available && ke.sources?.length > 0) {
      for (const src of ke.sources.slice(0, 2)) {
        if (src.title && !seen.has(src.title)) {
          seen.add(src.title)
          sources.push({
            sourceType: 'knowledge_base',
            title: src.title,
            organization: src.organization ?? null,
          })
        }
      }
    }
  }

  return sources
}

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run the Crop Recommendation Agent.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's crop question
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {string[]} [params.classifierMissingInfo=[]] - Missing info from classifier
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runCropAgent({
  message,
  farmerContext = {},
  classifierMissingInfo = [],
  memoryContext = null,
  language = 'en',
  metadata = {},
}) {
  const start = Date.now()
  logger.info('CropAgent: starting Phase 13 recommendation', { requestId: metadata.requestId })

  // ── Step 1: Resolve season ────────────────────────────────────────────
  const season = resolveSeason(message, farmerContext)

  // ── Step 2: Check for missing critical context ────────────────────────
  const missingFromContext = findMissingCriticalFields(farmerContext, season)
  const allMissing = [...new Set([...classifierMissingInfo, ...missingFromContext])]

  if (allMissing.length > 0) {
    logger.info('CropAgent: missing critical context — requesting clarification', {
      requestId: metadata.requestId,
      missingFields: allMissing,
    })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.CLARIFICATION,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer: buildClarificationMessage(allMissing),
        agentsUsed: ['CropAgent'],
        sources: [],
        grounded: false,
        missingInformation: allMissing,
        warnings: [],
        isDemo: config.providers.useMocks,
      })
    )
  }

  // ── Step 3: Generate candidate crops ──────────────────────────────────
  const candidateLimit = config.crop.candidateLimit
  let candidates = findProfilesBySeason(season)

  // Fallback: if no season-specific crops, use all active profiles
  if (candidates.length === 0) {
    candidates = getAllCropProfiles()
  }

  // Limit to candidateLimit for evidence collection
  candidates = candidates.slice(0, candidateLimit)

  logger.debug('CropAgent: candidate crops generated', {
    requestId: metadata.requestId,
    count: candidates.length,
    season,
  })

  // ── Step 4: Collect evidence in parallel ─────────────────────────────
  const { weatherEvidence, marketEvidenceMap, knowledgeEvidenceMap, schemeEvidence, collectionWarnings } =
    await collectAllEvidence({
      candidates,
      farmerContext: { ...farmerContext, season },
      season,
      metadata,
    })

  // ── Step 5: Score and rank candidates ────────────────────────────────
  const rankedAll = rankCandidates({
    candidates,
    farmerContext: { ...farmerContext, season },
    weatherEvidence,
    marketEvidenceMap,
    knowledgeEvidenceMap,
    schemeEvidence,
    weights: config.crop.weights,
  })

  if (rankedAll.length === 0) {
    logger.warn('CropAgent: all candidates disqualified', { requestId: metadata.requestId })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.CROP_RECOMMENDATION,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer:
          'Based on your current farm profile, none of the candidate crops fully matched your conditions. ' +
          'This may be due to a season mismatch or severe water incompatibility. ' +
          'Please verify your soil type, water availability, and target season, or consult your local Krishi Vigyan Kendra (KVK).',
        agentsUsed: ['CropAgent', 'CropScoringService'],
        sources: [],
        grounded: false,
        missingInformation: [],
        warnings: ['All candidate crops were disqualified by hard constraints', ...collectionWarnings],
        isDemo: config.providers.useMocks,
      })
    )
  }

  // Select top N for the recommendation
  const resultLimit = config.crop.resultLimit
  const topCrops = rankedAll.slice(0, resultLimit)

  logger.info('CropAgent: scoring complete', {
    requestId: metadata.requestId,
    topCrop: topCrops[0]?.name,
    topScore: topCrops[0]?.score,
    rankedCount: rankedAll.length,
  })

  // ── Step 6: Call LLM to explain the ranked results ────────────────────
  let aiResult
  const agentsUsed = ['CropAgent', 'CropScoringService']
  let answer = ''
  let status = RESULT_STATUS.SUCCESS

  try {
    const aiProvider = getAiProvider()
    const systemPrompt = buildCropAgentSystemPrompt(language)
    const userMessage = buildCropAgentUserMessage({
      originalMessage: message,
      farmerContext,
      season,
      rankedCrops: topCrops,
      weatherEvidence,
      schemeEvidence,
      memoryContext,
    })

    aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      parameters: {
        max_tokens: 900,
        temperature: 0.2,
        top_p: 0.9,
      },
      metadata,
    })

    answer = aiResult.content
    agentsUsed.push(aiResult.isDemo ? 'Mock AI' : `LLM (${config.watsonx.modelId})`)
    if (weatherEvidence?.available) agentsUsed.push(`Weather Provider (${weatherEvidence.provider})`)
    if (schemeEvidence?.available) agentsUsed.push('SchemeService')
  } catch (err) {
    // LLM failure — return scoring data without explanation
    logger.error('CropAgent: LLM explanation failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })

    status = RESULT_STATUS.PARTIAL_SUCCESS
    answer =
      `**Crop Recommendation Results** (AI explanation unavailable)\n\n` +
      topCrops
        .map(
          (c) =>
            `**#${c.rank} ${c.name}** — Score: ${c.score}/100 (${c.suitabilityLabel})\n` +
            `Evidence coverage: ${c.evidenceCoverage}% | Confidence: ${c.confidence}\n` +
            `Key risks: ${c.keyRisks.slice(0, 2).join('; ')}`
        )
        .join('\n\n')
  }

  // ── Step 7: Build warnings ────────────────────────────────────────────
  const warnings = [...collectionWarnings]

  if (topCrops[0]?.confidence === 'low') {
    warnings.push(
      'Recommendation confidence is low due to limited evidence. ' +
        'Please provide soil type, water availability, and season for a more precise recommendation.'
    )
  }
  if (topCrops.some((c) => c.isDemo)) {
    warnings.push(
      'Crop suitability data is sourced from ICAR/ICRISAT guidelines and may not reflect hyper-local conditions. ' +
        'Consult your local Krishi Vigyan Kendra (KVK) for area-specific advice.'
    )
  }
  if (!weatherEvidence?.available) {
    warnings.push('Weather data was unavailable — weather suitability not included in scoring.')
  }

  // ── Step 8: Build recommendation data for frontend ────────────────────
  const recommendationData = {
    season: season ?? 'Not specified',
    scoringVersion: config.crop.scoringVersion,
    candidatesEvaluated: rankedAll.length,
    topCrops: topCrops.map((c) => ({
      rank: c.rank,
      cropCode: c.cropCode,
      name: c.name,
      score: c.score,
      suitabilityLabel: c.suitabilityLabel,
      suitabilityColor: c.suitabilityColor,
      evidenceCoverage: c.evidenceCoverage,
      confidence: c.confidence,
      waterRequirementCategory: c.waterRequirementCategory,
      durationDays: c.durationDays,
      riskLevel: c.riskLevel,
      keyRisks: c.keyRisks,
      factorBreakdown: c.factorBreakdown,
    })),
    evidenceSummary: {
      weatherAvailable: weatherEvidence?.available === true,
      marketAvailable: Object.values(marketEvidenceMap).some((m) => m.available),
      knowledgeAvailable: Object.values(knowledgeEvidenceMap).some((k) => k.available),
      schemeAvailable: schemeEvidence?.available === true,
    },
    isDemo: config.providers.useMocks || topCrops.some((c) => c.isDemo),
  }

  const durationMs = Date.now() - start
  logger.info('CropAgent: complete', {
    requestId: metadata.requestId,
    topCrop: topCrops[0]?.name,
    topScore: topCrops[0]?.score,
    season,
    durationMs,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.CROP_RECOMMENDATION,
      status,
      answer,
      agentsUsed,
      sources: buildRecommendationSources(topCrops, weatherEvidence, knowledgeEvidenceMap),
      grounded: true,
      missingInformation: [],
      warnings,
      provider: aiResult?.provider ?? null,
      model: aiResult?.model ?? null,
      isDemo: recommendationData.isDemo,
      // Frontend data attachment
      recommendation: recommendationData,
    })
  )
}
