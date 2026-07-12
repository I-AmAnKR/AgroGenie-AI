/**
 * VoiceInputButton — Phase 14B.
 *
 * Self-contained voice recorder component using the browser MediaRecorder API.
 * Records audio and sends it to the backend STT endpoint for transcription.
 *
 * States:
 *   idle         — mic button, ready to record
 *   recording    — animated pulsing ring, stop button
 *   transcribing — spinner, waiting for STT response
 *
 * On success: calls onTranscript(transcript, detectedLanguage).
 * On error:   calls onError(errorMessage) if provided, otherwise shows inline error.
 *
 * Props:
 *   onTranscript (required) — callback(transcript: string, lang: string)
 *   disabled     (optional) — disable while chat is loading
 *   language     (optional) — BCP-47 hint for STT model selection
 *   onError      (optional) — callback(message: string) for parent error handling
 *
 * Security:
 *   - Audio bytes are sent only to the backend — never to a third party.
 *   - IBM credentials are on the server only.
 *   - No audio is stored after the response is received.
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { transcribeAudio } from '../../api/voice.api.js'

// Maximum recording duration: 60 seconds (to avoid very large uploads)
const MAX_RECORDING_MS = 60_000

// Preferred MIME types in order of browser support
function getPreferredMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return 'audio/webm' // fallback — will be caught at recording time if unsupported
}

export default function VoiceInputButton({ onTranscript, disabled = false, language = 'en', onError }) {
  const [recordingState, setRecordingState] = useState('idle') // 'idle' | 'recording' | 'transcribing'
  const [errorMsg, setErrorMsg] = useState(null)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const autoStopTimerRef = useRef(null)
  const streamRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const clearError = useCallback(() => setErrorMsg(null), [])

  /**
   * Start recording from the microphone.
   */
  const startRecording = useCallback(async () => {
    clearError()

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = 'Your browser does not support voice input. Try Chrome or Firefox.'
      setErrorMsg(msg)
      onError?.(msg)
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      let msg = 'Microphone access denied. Please allow microphone access and try again.'
      if (err.name === 'NotFoundError') msg = 'No microphone found. Please connect a microphone.'
      if (err.name === 'NotAllowedError') msg = 'Microphone permission denied. Allow access in browser settings.'
      setErrorMsg(msg)
      onError?.(msg)
      return
    }

    streamRef.current = stream
    audioChunksRef.current = []

    const mimeType = getPreferredMimeType()
    let recorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch {
      // mimeType not supported — try without specifying
      recorder = new MediaRecorder(stream)
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all tracks to release microphone indicator
      stream.getTracks().forEach((t) => t.stop())

      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType })

      if (blob.size === 0) {
        setRecordingState('idle')
        const msg = 'No audio was recorded. Please try again.'
        setErrorMsg(msg)
        onError?.(msg)
        return
      }

      setRecordingState('transcribing')
      try {
        const result = await transcribeAudio(blob, language)
        const transcript = result?.data?.transcript ?? ''
        const detectedLang = result?.data?.detectedLanguage ?? language
        if (transcript) {
          onTranscript(transcript, detectedLang)
          setErrorMsg(null)
        } else {
          const msg = 'No speech detected. Please speak clearly and try again.'
          setErrorMsg(msg)
          onError?.(msg)
        }
      } catch (err) {
        const serverMsg =
          err?.response?.data?.message ??
          'Voice transcription failed. Please try again or type your message.'
        setErrorMsg(serverMsg)
        onError?.(serverMsg)
      } finally {
        setRecordingState('idle')
      }
    }

    recorder.start(250) // collect chunks every 250ms
    mediaRecorderRef.current = recorder
    setRecordingState('recording')

    // Auto-stop after MAX_RECORDING_MS
    autoStopTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }, MAX_RECORDING_MS)
  }, [language, onTranscript, onError, clearError])

  /**
   * Stop an active recording.
   */
  const stopRecording = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleClick = useCallback(() => {
    if (recordingState === 'idle') startRecording()
    else if (recordingState === 'recording') stopRecording()
    // 'transcribing' — button is disabled
  }, [recordingState, startRecording, stopRecording])

  // Button properties per state
  const isRecording = recordingState === 'recording'
  const isTranscribing = recordingState === 'transcribing'
  const buttonDisabled = disabled || isTranscribing

  const ariaLabel = isRecording
    ? 'Stop recording'
    : isTranscribing
      ? 'Transcribing...'
      : 'Start voice input'

  const title = isRecording
    ? 'Click to stop recording and transcribe'
    : isTranscribing
      ? 'Processing your audio...'
      : 'Click to speak your question'

  return (
    <div className="voice-input-wrapper" style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button
        id="voice-input-btn"
        type="button"
        className={`btn btn-ghost btn-icon voice-mic-btn ${isRecording ? 'voice-recording' : ''} ${isTranscribing ? 'voice-transcribing' : ''}`}
        onClick={handleClick}
        disabled={buttonDisabled}
        aria-label={ariaLabel}
        title={title}
        style={{
          position: 'relative',
          color: isRecording ? 'var(--color-error, #ef4444)' : isTranscribing ? 'var(--color-primary)' : undefined,
          transition: 'color 0.2s ease',
        }}
      >
        {isTranscribing ? (
          <Loader2 size={18} className="spin" aria-hidden="true" />
        ) : isRecording ? (
          <Square size={18} aria-hidden="true" fill="currentColor" />
        ) : (
          <Mic size={18} aria-hidden="true" />
        )}

        {/* Animated pulse ring during recording */}
        {isRecording && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '2px solid var(--color-error, #ef4444)',
              opacity: 0.7,
              animation: 'voice-pulse 1s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}
      </button>

      {/* Inline error message */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: '110%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-error, #ef4444)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: '0.75rem',
            color: 'var(--color-error, #ef4444)',
            maxWidth: 260,
            whiteSpace: 'normal',
            zIndex: 100,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {errorMsg}
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            style={{
              marginLeft: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-error, #ef4444)',
              fontWeight: 700,
              fontSize: '0.75rem',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
