/**
 * Voice API client — Phase 14B + 14C.
 *
 * Phase 14B: transcribeAudio() — STT (voice → text)
 * Phase 14C: synthesizeText() — TTS (text → audio)
 *            checkTtsReady()  — TTS availability probe
 *
 * Credentials: IBM STT and TTS credentials are on the server only.
 * The frontend never sees API keys or bearer tokens.
 */
import axiosClient from './axiosClient.js'

/**
 * Transcribe an audio blob via the backend STT endpoint.
 *
 * @param {Blob}   audioBlob  - Audio blob from MediaRecorder
 * @param {string} [language] - BCP-47 language hint (default 'en')
 * @returns {Promise<{transcript, detectedLanguage, confidence, provider, isDemo}>}
 */
export async function transcribeAudio(audioBlob, language = 'en') {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'recording.webm')
  if (language) {
    formData.append('language', language)
  }

  const response = await axiosClient.post('/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 45_000,
  })

  return response.data
}

/**
 * Synthesize text to speech via the backend TTS endpoint.
 * Returns an audio Blob that can be played via the Web Audio API.
 *
 * Only call this when the user explicitly presses Play — never auto-synthesize.
 *
 * @param {string} text      - Text to speak (plain text, markdown will be stripped server-side)
 * @param {string} [language] - BCP-47 language hint (default 'en')
 * @returns {Promise<Blob>}  - audio/ogg blob
 * @throws {Error}           - On server error (400/413/500/502)
 */
export async function synthesizeText(text, language = 'en') {
  const response = await axiosClient.post(
    '/voice/synthesize',
    { text, language },
    {
      responseType: 'arraybuffer', // receive raw binary audio bytes
      timeout: 35_000,             // allow for TTS processing
      headers: { 'Content-Type': 'application/json' },
    }
  )

  // Convert ArrayBuffer → Blob so the browser can play it
  const contentType = response.headers['content-type'] ?? 'audio/ogg'
  return new Blob([response.data], { type: contentType })
}

/**
 * Check TTS availability without synthesizing audio.
 * Call once on Chat page mount to decide whether to show the Play button.
 *
 * @returns {Promise<{available: boolean, provider: string, isDemo: boolean, status: string}>}
 */
export async function checkTtsReady() {
  const response = await axiosClient.get('/voice/tts-ready', { timeout: 5_000 })
  return response.data?.data ?? { available: false, provider: 'none', isDemo: false }
}

