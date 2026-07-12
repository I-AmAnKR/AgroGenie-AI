/**
 * Mock STT Provider — Phase 14B.
 *
 * Implements the STT provider interface with deterministic canned responses.
 * Active when USE_MOCK_PROVIDERS=true (default in development/test).
 *
 * Simulates IBM Cloud Speech to Text without making any network calls.
 * isDemo: true is always set so the frontend can show a demo indicator.
 *
 * Interface:
 *   transcribe({ audioBuffer, mimeType, language, metadata })
 *   → { transcript, language, confidence, isDemo, provider, model }
 */

import logger from '../../utils/logger.js'

// Canned transcripts keyed by a mock "language" hint.
// In real IBM STT, the transcript reflects what was actually spoken.
const MOCK_TRANSCRIPTS = {
  hi: 'मुझे अपनी फसल के लिए सबसे अच्छी सलाह दीजिए।',
  'hi-Latn': 'Meri fasal ke liye kya uchit hai is mausam mein?',
  pa: 'ਮੇਰੀ ਫ਼ਸਲ ਲਈ ਕਿਹੜੀ ਖਾਦ ਵਧੀਆ ਹੈ?',
  en: 'What is the best crop for the Kharif season in Rajasthan?',
}

const DEFAULT_TRANSCRIPT = MOCK_TRANSCRIPTS.en

/**
 * Mock STT provider object — implements the STT provider interface.
 */
export const mockSttProvider = {
  /**
   * Simulate audio transcription.
   *
   * @param {object} options
   * @param {Buffer}  options.audioBuffer - Audio file bytes (not used in mock)
   * @param {string}  options.mimeType    - Audio MIME type (not used in mock)
   * @param {string}  [options.language]  - Hint language for selecting canned response
   * @param {object}  [options.metadata]  - Request metadata for logging
   * @returns {Promise<{transcript: string, language: string, confidence: number, isDemo: boolean, provider: string, model: string}>}
   */
  async transcribe({ audioBuffer: _buf, mimeType: _mime, language = 'en', metadata = {} }) {
    logger.debug('MockSTTProvider: transcribe() called', {
      requestId: metadata.requestId,
      language,
      isDemo: true,
    })

    // Simulate a tiny delay so UI recording → transcribing state transition is visible
    await new Promise((r) => setTimeout(r, 120))

    const transcript = MOCK_TRANSCRIPTS[language] ?? DEFAULT_TRANSCRIPT

    return {
      transcript,
      language: language === 'en' ? 'en' : language,
      confidence: 0.97,
      isDemo: true,
      provider: 'mock',
      model: 'mock-stt',
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
