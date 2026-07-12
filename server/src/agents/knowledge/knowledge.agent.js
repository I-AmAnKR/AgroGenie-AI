/**
 * Knowledge Agent — Phase 9.
 *
 * Wraps the existing RAG service (rag.service.js) to fit the Agent Router
 * result contract.
 *
 * Architecture contract:
 *   - Does NOT duplicate embedding, similarity search, prompt construction,
 *     or source deduplication logic — all of that lives in rag.service.js.
 *   - Translates RAG service output into the normalized agent result shape.
 *   - Preserves actual source metadata from RAG — never invents sources.
 *   - grounded = true only when actual chunks were retrieved.
 *
 * The Agent Router selects this agent for KNOWLEDGE intent.
 * Controllers must not call this agent directly.
 */
import { askKnowledge } from '../../services/rag.service.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import logger from '../../utils/logger.js'

/**
 * Run the Knowledge Agent.
 *
 * @param {object} params
 * @param {string} params.message - User's question
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runKnowledgeAgent({
  message,
  language = 'en',
  farmerContext = {},
  memoryContext = null,
  metadata = {},
}) {
  const start = Date.now()
  logger.debug('KnowledgeAgent: starting RAG pipeline', { requestId: metadata.requestId })

  let ragResult
  try {
    ragResult = await askKnowledge({
      question: message,
      language,
      memoryContext,
      metadata,
    })
  } catch (err) {
    logger.error('KnowledgeAgent: RAG service failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    // Do not silently convert to ungrounded LLM call — surface the failure
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.KNOWLEDGE,
        status: RESULT_STATUS.FAILED,
        answer:
          'The knowledge retrieval service encountered an error. Please try again. ' +
          'If the problem persists, consult your local Krishi Vigyan Kendra (KVK).',
        agentsUsed: ['KnowledgeAgent'],
        sources: [],
        grounded: false,
        warnings: ['Knowledge retrieval failed — answer is not grounded.'],
      })
    )
  }

  const agentsUsed = ['KnowledgeAgent', 'Knowledge Retrieval']
  if (ragResult.provider && ragResult.provider !== 'none') {
    agentsUsed.push(ragResult.isDemo ? 'Mock AI' : 'LLM')
  }

  logger.info('KnowledgeAgent: complete', {
    requestId: metadata.requestId,
    grounded: ragResult.grounded,
    chunksRetrieved: ragResult.retrieval?.chunksRetrieved ?? 0,
    documentsUsed: ragResult.retrieval?.documentsUsed ?? 0,
    durationMs: Date.now() - start,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.KNOWLEDGE,
      status: RESULT_STATUS.SUCCESS,
      answer: ragResult.answer,
      agentsUsed,
      sources: ragResult.sources ?? [],
      grounded: ragResult.grounded,
      provider: ragResult.provider ?? null,
      model: ragResult.model ?? null,
      retrieval: ragResult.retrieval ?? null,
      isDemo: ragResult.isDemo,
    })
  )
}
