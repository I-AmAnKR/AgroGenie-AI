/**
 * General Agent schema — Phase 9.
 *
 * Defines the result contract for the General Agent.
 * General Agent uses the configured LLM pretrained agricultural knowledge only.
 * No RAG, no live tools.
 */

/**
 * Expected General Agent result:
 * {
 *   intent: 'GENERAL',
 *   status: 'success',
 *   answer: string,
 *   agentsUsed: ['GeneralAgent', 'LLM'],
 *   sources: [],              — always empty; General does not use RAG
 *   grounded: false,          — never marked grounded (no retrieval)
 *   missingInformation: [],
 *   warnings: [],
 *   provider: 'watsonx' | 'mock',
 *   model: string,
 *   retrieval: null,
 *   isDemo: boolean
 * }
 */
export const GENERAL_AGENT_SCHEMA = {
  intent: 'GENERAL',
  agentsUsed: ['GeneralAgent', 'LLM'],
  sources: [],
  grounded: false,
  retrieval: null,
}
