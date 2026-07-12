/**
 * Disease Agent — Phase 15C.
 *
 * Architecture:
 *   1. Vision Provider extracts candidate symptoms from image metadata.
 *   2. Disease Repository matches candidates to known diseases.
 *   3. Weather Context from Weather Provider.
 *   4. FarmerProfile (crop) context.
 *   5. RAG for management data.
 *   6. Deterministic Confidence Engine scores matches.
 *   7. IBM Granite explains the diagnosis safely without inventing.
 *
 * If confidence is low, falls back to Needs Expert Review.
 */
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import logger from '../../utils/logger.js'
import { getVisionProvider } from '../../providers/vision.provider.factory.js'
import { getWeatherProvider } from '../../providers/weather.provider.factory.js'
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { getDiseaseKnowledge } from '../../services/disease.service.js'
import * as diseaseRepo from '../../repositories/disease.repository.js'
import { determineDiseaseAdvisory, CONFIDENCE_LEVELS } from '../../services/diseaseScoring.service.js'
import { buildDiseaseUserMessage, DISEASE_SYSTEM_PROMPT } from './disease.prompt.js'
import { resolveWeatherLocation } from '../../services/locationResolver.service.js'

export async function runDiseaseAgent({ message, language, farmerContext = {}, memoryContext = null, attachments = [], metadata = {} }) {
  const start = Date.now()
  const imageAttachment = attachments.find(a => a.type === 'image')

  if (!imageAttachment || !imageAttachment.objectKey) {
    logger.warn('DiseaseAgent called without image attachment', { requestId: metadata.requestId })
    return normalizeAgentResult(createAgentResult({
      intent: INTENT.DISEASE,
      status: RESULT_STATUS.NEEDS_CLARIFICATION,
      answer: 'Please provide a clear image of the affected plant part so I can assist with disease identification.',
      agentsUsed: ['DiseaseAgent'],
    }))
  }

  // Step 1: Vision Evidence
  const visionProvider = getVisionProvider()
  const candidateSymptoms = await visionProvider.analyzeImage(imageAttachment.objectKey, imageAttachment.mimeType)

  // Step 2: Disease Matching (broad search based on all symptoms)
  let candidateDiseases = []
  for (const sym of candidateSymptoms) {
    const matches = diseaseRepo.findBySymptom(sym)
    candidateDiseases.push(...matches)
  }
  // Deduplicate
  candidateDiseases = Array.from(new Set(candidateDiseases.map(d => d.diseaseCode)))
    .map(code => diseaseRepo.findByCode(code))

  // Step 3: Weather Context
  let weather = null
  try {
    const location = resolveWeatherLocation(farmerContext)
    if (location) {
      weather = await getWeatherProvider().getCurrentWeather(location.lat, location.lon)
    }
  } catch (err) {
    logger.warn('DiseaseAgent: Failed to fetch weather context', { error: err.message })
  }

  // Step 4 & 5: Deterministic Confidence Engine
  const { primaryDisease, alternatives } = determineDiseaseAdvisory(candidateDiseases, candidateSymptoms, weather, farmerContext?.crop)

  if (!primaryDisease) {
    return normalizeAgentResult(createAgentResult({
      intent: INTENT.DISEASE,
      status: RESULT_STATUS.CAPABILITY_NOT_AVAILABLE,
      answer: 'I could not find any matching diseases for the symptoms detected in the image. Please consult an agronomist.',
      agentsUsed: ['DiseaseAgent'],
    }))
  }

  // Step 6: RAG Grounding for the primary disease
  const knowledge = await getDiseaseKnowledge(primaryDisease.disease.crop, primaryDisease.disease.name, true)
  const ragContext = knowledge.ragContext

  // Step 7: Granite Explanation
  const aiProvider = getAiProvider()
  let explanationResponse
  try {
    const context = {
      primaryDisease,
      alternatives,
      weather,
      crop: farmerContext?.crop,
      imageSymptoms: candidateSymptoms,
      ragContext
    }

    const aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: buildDiseaseUserMessage(context, memoryContext) }],
      systemPrompt: DISEASE_SYSTEM_PROMPT,
      parameters: { max_tokens: 600, temperature: 0.1, top_p: 1.0 },
      metadata
    })

    // Parse JSON
    const cleaned = aiResult.content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    explanationResponse = JSON.parse(cleaned)
  } catch (err) {
    logger.error('DiseaseAgent: LLM explanation failed', { error: err.message })
    explanationResponse = {
      diseaseCandidates: [{ name: primaryDisease.disease.name, confidence: primaryDisease.confidenceLevel, supportingEvidence: primaryDisease.supportingEvidence }],
      confidenceLevel: primaryDisease.confidenceLevel,
      treatment: primaryDisease.disease.treatment || {},
      prevention: primaryDisease.disease.prevention || [],
      warnings: [primaryDisease.progressionRisk],
      explanation: "Unable to generate a detailed explanation at this time, but this is the most likely match based on symptoms."
    }
  }

  // Build final structured response
  const isExpertReview = primaryDisease.confidenceLevel === CONFIDENCE_LEVELS.NEEDS_EXPERT_REVIEW
  
  const sources = []
  if (ragContext && ragContext.length > 0) {
    sources.push(...ragContext.map(r => r.source))
  }
  sources.push({ type: 'repository', name: 'AgroGenie Verified Disease Repository' })

  return normalizeAgentResult(createAgentResult({
    intent: INTENT.DISEASE,
    status: isExpertReview ? RESULT_STATUS.NEEDS_CLARIFICATION : RESULT_STATUS.SUCCESS,
    answer: explanationResponse.explanation,
    data: {
      diseaseCandidates: explanationResponse.diseaseCandidates,
      confidence: primaryDisease.confidence,
      confidenceLevel: primaryDisease.confidenceLevel,
      supportingEvidence: primaryDisease.supportingEvidence,
      treatment: explanationResponse.treatment,
      prevention: explanationResponse.prevention,
      warnings: explanationResponse.warnings,
      progressionRisk: primaryDisease.progressionRisk
    },
    agentsUsed: ['DiseaseAgent', 'VisionProvider', 'WeatherProvider'],
    sources,
    grounded: true,
  }))
}
