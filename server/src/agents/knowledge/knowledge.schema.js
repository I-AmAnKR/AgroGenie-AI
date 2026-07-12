/**
 * Knowledge Agent schema — Phase 9.
 *
 * Defines the result contract for the Knowledge Agent.
 * Knowledge Agent wraps the existing RAG service — no logic duplication.
 */

/**
 * Expected Knowledge Agent result:
 * {
 *   intent: 'KNOWLEDGE',
 *   status: 'success' | 'failed',
 *   answer: string,
 *   agentsUsed: ['KnowledgeAgent', 'Knowledge Retrieval', 'LLM'],
 *   sources: object[],         — Real RAG source cards; never invented
 *   grounded: boolean,         — true only if retrieval returned results
 *   missingInformation: [],
 *   warnings: string[],
 *   provider: string,
 *   model: string,
 *   retrieval: {
 *     chunksRetrieved: number,
 *     documentsUsed: number
 *   },
 *   isDemo: boolean
 * }
 */
export const KNOWLEDGE_AGENT_SCHEMA = {
  intent: 'KNOWLEDGE',
  agentsUsed: ['KnowledgeAgent', 'Knowledge Retrieval', 'LLM'],
}
