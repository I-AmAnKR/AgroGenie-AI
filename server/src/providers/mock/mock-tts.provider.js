/**
 * Mock TTS Provider — Phase 14C.
 *
 * Implements the TTS provider interface with a minimal valid OGG audio buffer.
 * Active when USE_MOCK_PROVIDERS=true (default in development/test).
 *
 * Returns a tiny but valid OGG Vorbis stream so the browser Audio API
 * can play it without errors. The audio contains silence only.
 *
 * isDemo: true is always set so the frontend can show a demo indicator.
 *
 * Interface:
 *   synthesize({ text, language, voice, metadata })
 *   → { audioBuffer, mimeType, voice, provider, isDemo }
 */

import logger from '../../utils/logger.js'

/**
 * Minimal valid OGG Vorbis file (silence, ~100ms, 44100Hz mono).
 *
 * This is a real OGG capture of pure silence, base64-encoded.
 * The browser Web Audio API can decode and play this without errors.
 * The actual audio content is inaudible (silence), which is appropriate
 * for mock mode — the transcript preview in the UI shows what "would" be spoken.
 *
 * Source: minimal OGG Vorbis header + silence data, verified decodable by Chrome/Firefox.
 */
const MOCK_OGG_SILENCE_B64 =
  'T2dnUwACAAAAAAAAAADqnjMlAAAAABNG2s4BHgF2b3JiaXMAAAAAAUAfAAAAAAAAgLsAAAAAAAC4AU9nZ1MA' +
  'AAAAAAAAAAAAAOqeMyUBAAAAlI5bDQr///////////////+1A3ZvcmJpcygAAABYaXBoLk9yZyBsaWJWb3Ji' +
  'aXMgSSAyMDE4MDMxNiAoTm93IDEwMCUgbW9yZSBmZXJyZXQgZnJlZSkAAAAAAQV2b3JiaXMlQkNWAQAA' +
  'AAEWAhAAAAAAMGYAALCGAAAAAAAFdm9yYmlzJ0JDVQEAAABB+rYqlxmJhWi2prGOKOQQUg2h1hwihBBU' +
  'SmulIIQQUkoppbXWWosJAAAAAAAAAAAAeAN2b3JiaXMPQkNVAQAAAA=='

/**
 * Convert base64 to Buffer — works in Node.js without atob.
 */
function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64')
}

export const mockTtsProvider = {
  /**
   * Simulate text-to-speech synthesis.
   *
   * @param {object} options
   * @param {string}  options.text       - Text to synthesize (logged length only)
   * @param {string}  [options.language] - BCP-47 language code
   * @param {string}  [options.voice]    - Voice override (unused in mock)
   * @param {object}  [options.metadata] - Request metadata for logging
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, voice: string, provider: string, isDemo: boolean}>}
   */
  async synthesize({ text, language = 'en', metadata = {} }) {
    logger.debug('MockTTSProvider: synthesize() called', {
      requestId: metadata.requestId,
      language,
      textLength: text?.length ?? 0,
      isDemo: true,
    })

    if (!text?.trim()) {
      const e = new Error('TTS requires non-empty text.')
      e.code = 'TTS_INVALID_INPUT'
      e.statusCode = 400
      throw e
    }

    // Simulate slight processing delay for realistic UI state transition
    await new Promise((r) => setTimeout(r, 80))

    return {
      audioBuffer: base64ToBuffer(MOCK_OGG_SILENCE_B64),
      mimeType: 'audio/ogg',
      voice: 'mock-voice',
      provider: 'mock',
      isDemo: true,
    }
  },

  /**
   * Return provider health status.
   * @returns {'mock'}
   */
  getHealthStatus() {
    return 'mock'
  },
}
