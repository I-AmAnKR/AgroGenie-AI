/**
 * STT Provider Factory — Phase 14B.
 *
 * Single location for STT provider selection — no scattered process.env
 * checks in controllers or services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockSTTProvider (demo transcripts, no network)
 *   USE_MOCK_PROVIDERS=false → IbmSttProvider  (IBM Cloud Speech to Text REST)
 *
 * If real mode is selected but credentials are absent, getSttProvider()
 * throws STT_CONFIGURATION_ERROR instead of silently falling back.
 * Silent fallback would give farmers incorrect "transcriptions" from a mock.
 */
import config from '../config/env.js'
import { mockSttProvider } from './mock/mock-stt.provider.js'
import { ibmSttProvider } from './stt.provider.js'

/**
 * Return the configured STT provider instance.
 *
 * @throws {Error} STT_CONFIGURATION_ERROR when real mode is selected without credentials.
 * @returns {object} Active STT provider implementing transcribe() interface.
 */
export function getSttProvider() {
  if (config.providers.useMocks) {
    return mockSttProvider
  }

  // Real mode — validate required configuration before returning
  const { apiKey, serviceUrl } = config.stt
  if (!apiKey) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires IBM_STT_API_KEY. ' +
        'Create an IBM Cloud Speech to Text instance and add the key to server/.env. ' +
        'Set USE_MOCK_PROVIDERS=true for demo voice transcription.'
    )
    err.code = 'STT_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!serviceUrl) {
    const err = new Error(
      'IBM_STT_URL is required for real speech-to-text. ' +
        'Set the service URL from your IBM Cloud Speech to Text credentials page.'
    )
    err.code = 'STT_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return ibmSttProvider
}

/**
 * Return the STT health status without a live API call.
 *
 * @returns {'mock'|'connected'|'not-configured'}
 */
export function getSttHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  const { apiKey, serviceUrl } = config.stt
  if (!apiKey || !serviceUrl) return 'not-configured'
  return 'connected'
}
