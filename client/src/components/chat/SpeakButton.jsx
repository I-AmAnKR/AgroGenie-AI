/**
 * SpeakButton — Phase 14C.
 *
 * Play button that synthesizes an assistant message via IBM TTS.
 * Appears on each assistant message bubble (hidden for user messages).
 *
 * Design rules:
 *  1. Text response always visible — audio is purely additive.
 *  2. Synthesis only triggered by explicit click — NEVER auto-triggered.
 *  3. Audio plays in browser using Web Audio API / HTMLAudioElement.
 *  4. IBM credentials never exposed to frontend.
 *  5. Structured data (prices, scores) read naturally because server
 *     strips markdown and numbers remain as ASCII digits.
 *
 * States:
 *   idle         — speaker icon, ready
 *   loading      — spinner, waiting for TTS synthesis
 *   playing      — pause/stop icon, audio playing
 *   error        — error icon + tooltip
 *
 * Props:
 *   text        {string} — assistant message text to synthesize
 *   language    {string} — BCP-47 language code (default 'en')
 *   ttsAvailable {bool}  — whether TTS endpoint responded as available
 *   messageId   {string} — for aria-label uniqueness
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Volume2, VolumeX, Loader2, Square } from 'lucide-react'
import { synthesizeText } from '../../api/voice.api.js'

export default function SpeakButton({ text, language = 'en', ttsAvailable = true, messageId }) {
  const [speakState, setSpeakState] = useState('idle') // 'idle' | 'loading' | 'playing' | 'error'
  const [errorMsg, setErrorMsg] = useState(null)
  const audioRef = useRef(null)
  const audioBlobUrlRef = useRef(null)

  // Cleanup blob URL and audio on unmount or text change
  useEffect(() => {
    return () => {
      _cleanup()
    }
  }, [text])

  function _cleanup() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (audioBlobUrlRef.current) {
      URL.revokeObjectURL(audioBlobUrlRef.current)
      audioBlobUrlRef.current = null
    }
  }

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setSpeakState('idle')
  }, [])

  const handleClick = useCallback(async () => {
    // If currently playing — stop
    if (speakState === 'playing') {
      stopPlayback()
      return
    }

    // If loading — ignore (debounce)
    if (speakState === 'loading') return

    setErrorMsg(null)
    setSpeakState('loading')

    let audioBlob
    try {
      audioBlob = await synthesizeText(text, language)
    } catch (err) {
      // Parse server error from axios response
      let msg = 'Voice playback unavailable. Please try again.'
      if (err?.response?.status === 413) msg = 'Message too long for voice playback.'
      if (err?.response?.status === 400) msg = 'Cannot synthesize this message.'
      if (err?.response?.status >= 500) msg = 'Voice service temporarily unavailable.'
      setErrorMsg(msg)
      setSpeakState('error')
      // Auto-clear error after 4 seconds
      setTimeout(() => setSpeakState('idle'), 4000)
      return
    }

    // Create blob URL for playback
    _cleanup() // release any previous audio

    const blobUrl = URL.createObjectURL(audioBlob)
    audioBlobUrlRef.current = blobUrl

    const audio = new Audio(blobUrl)
    audioRef.current = audio

    audio.onended = () => {
      setSpeakState('idle')
      _cleanup()
    }
    audio.onerror = () => {
      setSpeakState('error')
      setErrorMsg('Audio playback error — format may be unsupported in this browser.')
      _cleanup()
      setTimeout(() => setSpeakState('idle'), 4000)
    }

    try {
      await audio.play()
      setSpeakState('playing')
    } catch {
      setSpeakState('error')
      setErrorMsg('Playback blocked — click to allow audio in your browser.')
      _cleanup()
      setTimeout(() => setSpeakState('idle'), 4000)
    }
  }, [speakState, text, language, stopPlayback])

  // Don't render if TTS is not available
  if (!ttsAvailable) return null

  const isLoading = speakState === 'loading'
  const isPlaying = speakState === 'playing'
  const isError = speakState === 'error'

  const ariaLabel = isPlaying
    ? 'Stop voice playback'
    : isLoading
      ? 'Synthesizing speech...'
      : 'Listen to this response'

  const titleText = isError && errorMsg
    ? errorMsg
    : isPlaying
      ? 'Click to stop'
      : isLoading
        ? 'Please wait...'
        : 'Click to listen'

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        id={`speak-btn-${messageId}`}
        type="button"
        className={`speak-btn ${isPlaying ? 'speak-btn-playing' : ''} ${isError ? 'speak-btn-error' : ''}`}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={ariaLabel}
        title={titleText}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          cursor: isLoading ? 'wait' : 'pointer',
          color: isError
            ? 'var(--color-error, #ef4444)'
            : isPlaying
              ? 'var(--color-primary)'
              : 'var(--color-text-muted)',
          transition: 'color 0.15s ease, background 0.15s ease',
          padding: 0,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isError && !isLoading) e.currentTarget.style.background = 'var(--color-border)'
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {isLoading ? (
          <Loader2 size={13} className="spin" aria-hidden="true" />
        ) : isPlaying ? (
          <Square size={13} fill="currentColor" aria-hidden="true" />
        ) : isError ? (
          <VolumeX size={13} aria-hidden="true" />
        ) : (
          <Volume2 size={13} aria-hidden="true" />
        )}
      </button>

      {/* Error tooltip */}
      {isError && errorMsg && (
        <span
          role="alert"
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface, #1e293b)',
            border: '1px solid var(--color-error, #ef4444)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: '0.7rem',
            color: 'var(--color-error, #ef4444)',
            whiteSpace: 'nowrap',
            zIndex: 50,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        >
          {errorMsg}
        </span>
      )}
    </span>
  )
}
