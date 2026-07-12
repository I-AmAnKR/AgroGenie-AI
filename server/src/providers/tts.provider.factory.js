/**
 * TTS Provider Factory — Phase 14C.
 *
 * Single location for TTS provider selection — no scattered process.env checks.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockTTSProvider (silence audio, no network)
 *   USE_MOCK_PROVIDERS=false → IbmTtsProvider  (IBM Cloud Text to Speech REST)
 *
 * If real mode is selected but IBM_TTS_API_KEY is absent,
 * getTtsProvider() throws TTS_CONFIGURATION_ERROR — no silent fallback.
 */
import config from '../config/env.js'
import { mockTtsProvider } from './mock/mock-tts.provider.js'
import { ibmTtsProvider } from './tts.provider.js'

/**
 * Return the configured TTS provider instance.
 *
 * @throws {Error} TTS_CONFIGURATION_ERROR when real mode lacks credentials.
 * @returns {object} Active TTS provider implementing synthesize() interface.
 */
export function getTtsProvider() {
  if (config.providers.useMocks) {
    return mockTtsProvider
  }

  const { apiKey, serviceUrl } = config.tts
  if (!apiKey) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires IBM_TTS_API_KEY. ' +
        'Create an IBM Cloud Text to Speech instance and add the key to server/.env. ' +
        'Set USE_MOCK_PROVIDERS=true for demo voice output.'
    )
    err.code = 'TTS_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!serviceUrl) {
    const err = new Error(
      'IBM_TTS_URL is required for real text-to-speech. ' +
        'Set the service URL from your IBM Cloud Text to Speech credentials page.'
    )
    err.code = 'TTS_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return ibmTtsProvider
}

/**
 * Return the TTS health status without a live API call.
 *
 * @returns {'mock'|'connected'|'not-configured'}
 */
export function getTtsHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  const { apiKey, serviceUrl } = config.tts
  if (!apiKey || !serviceUrl) return 'not-configured'
  return 'connected'
}
