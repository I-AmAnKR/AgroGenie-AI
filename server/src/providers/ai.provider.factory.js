/**
 * AI Provider Factory.
 *
 * Single location for provider selection — no scattered process.env checks
 * in controllers or services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockAIProvider
 *   USE_MOCK_PROVIDERS=false → WatsonxProvider
 *
 * If real mode is selected but the required watsonx configuration is absent,
 * this throws AI_CONFIGURATION_ERROR rather than silently falling back to mock.
 * Silent fallback would hide misconfiguration bugs in production.
 */
import config from '../config/env.js'
import { mockAiProvider } from './mock/mock-ai.provider.js'
import { watsonxProvider } from './watsonx.provider.js'

/**
 * Return the configured AI provider instance.
 *
 * @throws {Error} AI_CONFIGURATION_ERROR when real mode is selected without valid config.
 * @returns {object} The active AI provider implementing the generate() interface.
 */
export function getAiProvider() {
  if (config.providers.useMocks) {
    return mockAiProvider
  }

  // Real mode — validate required config before returning the provider.
  // The provider itself also validates on first use, but we fail fast here
  // so services receive a clear error with a useful message.
  const { apiKey, projectId } = config.watsonx
  if (!apiKey || !projectId) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires WATSONX_API_KEY and WATSONX_PROJECT_ID. ' +
        'Set them in server/.env or set USE_MOCK_PROVIDERS=true for demo mode.'
    )
    err.code = 'AI_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return watsonxProvider
}

/**
 * Return the AI health status without making a live inference call.
 *
 * @returns {'mock'|'connected'|'not-configured'|'error'}
 */
export function getAiHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  return watsonxProvider.getHealthStatus()
}
