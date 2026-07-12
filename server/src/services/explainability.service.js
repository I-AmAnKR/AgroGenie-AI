import { getAiProvider } from '../providers/ai.provider.factory.js'
import logger from '../utils/logger.js'

/**
 * Step 16 Phase C: Explainability Engine.
 * 
 * Extracts deterministic evidence from the router result and uses IBM Granite
 * to generate a human-readable explanation of why the AI made its decision.
 * Granite NEVER invents the structured evidence fields.
 *
 * @param {object} result - The normalized agent result from the Router.
 * @param {object} routing - Routing metadata (intent, confidence, etc.)
 * @param {string|null} memoryContext - The formatted memory injected into the agent.
 * @param {object} metadata - Request metadata.
 * @returns {Promise<object>} Structured explainability data.
 */
export async function generateExplainability(result, routing, memoryContext, metadata = {}) {
  const start = Date.now()

  // ── 1. Deterministic Evidence Collection ─────────────────────────────────

  const sourceAgent = result.agentsUsed?.[0] || 'AgentRouter'
  
  // Build RAG sources list
  const ragSources = result.sources 
    ? result.sources.map(s => (typeof s === 'string' ? s : (s.name || s.title || 'Unknown Source')))
    : []

  // Extract memory used
  let memoryUsed = []
  if (memoryContext) {
    const memoryLines = memoryContext
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'))
    if (memoryLines.length > 0 && !memoryLines[0].toLowerCase().includes('none')) {
      memoryUsed = memoryLines
    }
  }

  // Extract supporting evidence based on the intent
  const supportingEvidence = []
  const agentContributions = {}
  
  if (result.market) {
    supportingEvidence.push(`Market Data: ${result.market.commodity} in ${result.market.market}`)
    agentContributions['Market Service'] = 'Provided real-time mandi prices.'
  }
  if (result.weather) {
    supportingEvidence.push(`Weather Data: ${result.weather.current?.condition} at ${result.weather.current?.temperatureC}°C`)
    agentContributions['Weather Service'] = 'Provided local weather context.'
  }
  if (result.data?.confidence) {
    supportingEvidence.push(`Disease Confidence: ${result.data.confidenceLevel} (${(result.data.confidence * 100).toFixed(1)}%)`)
    agentContributions['Vision Provider'] = 'Extracted symptoms from image.'
    agentContributions['Disease Repository'] = 'Matched symptoms to known diseases.'
    agentContributions['Deterministic Scoring Engine'] = 'Calculated confidence levels.'
  }
  if (ragSources.length > 0) {
    agentContributions['RAG Service'] = 'Retrieved grounding knowledge from document repository.'
  }

  // Reason for confidence
  let confidenceReason = 'Standard response generation.'
  if (routing.confidenceCategory === 'high') {
    confidenceReason = 'Intent was clearly matched and data was available.'
  } else if (routing.confidenceCategory === 'low') {
    confidenceReason = 'Intent was ambiguous or required missing data.'
  }
  if (result.data?.confidenceLevel) {
    confidenceReason = `Disease diagnostic confidence is ${result.data.confidenceLevel}.`
  }

  // Decision Timeline
  const decisionTimeline = []
  decisionTimeline.push({ step: 'Memory', action: memoryUsed.length > 0 ? 'Retrieved historical context' : 'No historical context available' })
  if (result.weather) decisionTimeline.push({ step: 'Weather', action: 'Fetched local weather data' })
  if (result.market) decisionTimeline.push({ step: 'Market', action: 'Fetched current mandi prices' })
  if (result.data?.diseaseCandidates) decisionTimeline.push({ step: 'Repository', action: 'Matched image symptoms to diseases' })
  if (ragSources.length > 0) decisionTimeline.push({ step: 'RAG', action: 'Retrieved grounding documents' })
  decisionTimeline.push({ step: 'Granite', action: 'Generated human-readable response' })

  // ── 2. Granite Explanation Generation ────────────────────────────────────

  // We only ask Granite to write a human-readable "Why?" explanation,
  // preventing it from inventing the structured evidence.
  let explanation = 'The decision was made based on the provided inputs and deterministic rules.'
  
  try {
    const aiProvider = getAiProvider()
    const prompt = `You are AgroGenie AI's Explainability Engine.
Your task is to write a short, 1-2 sentence human-readable explanation of WHY the AI gave the answer it did.
DO NOT invent facts. Rely strictly on the evidence below.

Evidence:
- Intent: ${routing.intent}
- Agent: ${sourceAgent}
- Evidence: ${supportingEvidence.join(', ') || 'General agricultural knowledge'}
- Memory context used: ${memoryUsed.length > 0 ? 'Yes' : 'No'}
- Grounded in documents: ${result.grounded ? 'Yes' : 'No'}

Write ONLY the short explanation paragraph. Do not include JSON or formatting.`

    const aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an explainability service. Be concise and factual.',
      parameters: { max_tokens: 150, temperature: 0.1 },
      metadata
    })

    explanation = aiResult.content.trim()
  } catch (err) {
    logger.error('ExplainabilityService: Granite explanation failed', { error: err.message, requestId: metadata.requestId })
  }

  // ── 3. Construct Explainability Payload ──────────────────────────────────

  const explainability = {
    explanation,
    supportingEvidence,
    sourceAgent,
    confidenceReason,
    memoryUsed,
    ragSources,
    agentContributions,
    decisionTimeline
  }

  logger.debug('ExplainabilityService: Engine completed', { 
    requestId: metadata.requestId, 
    durationMs: Date.now() - start 
  })

  return explainability
}
