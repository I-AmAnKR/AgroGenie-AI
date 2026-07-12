/**
 * General Agent — Phase 9.
 *
 * Handles general agricultural education and conversation using the configured LLM.
 *
 * Scope:
 *   - Explain farming concepts (crop rotation, soil health, irrigation, etc.)
 *   - Answer general questions using the model's pretrained knowledge
 *   - Personalize with FarmerProfile context where relevant
 *
 * Out of scope (enforced in prompt):
 *   - Live weather data → WEATHER intent
 *   - Live market prices → MARKET intent
 *   - Verified scheme eligibility → SCHEME intent
 *   - Personalized crop suitability → CROP_RECOMMENDATION intent
 *   - Disease diagnosis → DISEASE intent
 *
 * The Agent Router selects this agent for GENERAL intent only.
 * Controllers must not call this agent directly.
 */
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { buildGeneralAgentPrompt } from './general.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import logger from '../../utils/logger.js'

/**
 * Run the General Agent.
 *
 * @param {object} params
 * @param {string} params.message - User's message
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {Array<{role, content}>} [params.conversationHistory=[]] - Prior turns
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runGeneralAgent({
  message,
  language = 'en',
  farmerContext = {},
  memoryContext = null,
  conversationHistory = [],
  metadata = {},
}) {
  const start = Date.now()
  logger.debug('GeneralAgent: starting', { requestId: metadata.requestId })

  const provider = getAiProvider()
  const systemPrompt = buildGeneralAgentPrompt(language, farmerContext, memoryContext)

  // Build messages: bounded history + current user turn
  const messages = [
    ...conversationHistory.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  let aiResult
  try {
    aiResult = await provider.generate({
        messages,
        systemPrompt,
        parameters: {
          max_tokens: 800,
          temperature: 0.3,
          top_p: 0.85,
        },
        metadata,
      })
  } catch (err) {
    logger.error('GeneralAgent: provider failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    throw err
  }

  logger.info('GeneralAgent: complete', {
    requestId: metadata.requestId,
    provider: aiResult.provider,
    isDemo: aiResult.isDemo,
    durationMs: Date.now() - start,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.GENERAL,
      status: RESULT_STATUS.SUCCESS,
      answer: aiResult.content,
      agentsUsed: ['GeneralAgent', aiResult.isDemo ? 'Mock AI' : 'LLM'],
      sources: [],
      grounded: false,
      provider: aiResult.provider,
      model: aiResult.model,
      isDemo: aiResult.isDemo,
    })
  )
}
