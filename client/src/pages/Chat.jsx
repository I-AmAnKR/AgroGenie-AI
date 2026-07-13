import { useEffect, useRef, useState } from 'react'
import {
  Send, Plus, MessageSquare, Leaf, Loader2, ChevronRight, Cpu, ImagePlus, X
} from 'lucide-react'
import { sendMessage, getSessions } from '../api/chat.api.js'
import { checkTtsReady } from '../api/voice.api.js'
import { uploadImage } from '../api/disease.api.js'
import { mockSuggestedQuestions } from '../mocks/chat.mock.js'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import VoiceInputButton from '../components/chat/VoiceInputButton.jsx'
import './Chat.css'

// Intent badge configuration — label and colour per intent
const INTENT_BADGE = {
  GENERAL: { label: 'General', color: '#6b7280' },
  KNOWLEDGE: { label: 'Knowledge', color: '#3b82f6' },
  WEATHER: { label: 'Weather', color: '#0ea5e9' },
  MARKET: { label: 'Market', color: '#f59e0b' },
  SCHEME: { label: 'Scheme', color: '#8b5cf6' },
  CROP_RECOMMENDATION: { label: 'Crop Advisor', color: '#22c55e' },
  DISEASE: { label: 'Plant Health', color: '#ef4444' },
  MULTI_INTENT: { label: 'Multi-topic', color: '#ec4899' },
  CLARIFICATION: { label: 'Clarification', color: '#94a3b8' },
}

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  content: 'Namaste! I am AgroGenie AI.\n\nAsk me about crops, soil health, irrigation, government schemes, or plant health. I will tell you clearly when live data (weather, mandi prices) or additional information is needed.',
  timestamp: new Date().toISOString(),
  agent: null,
  sources: [],
  dataConsidered: [],
  agentChain: [],
  intent: null,
  grounded: false,
  warnings: [],
}

export default function Chat() {
  const [sessions, setSessions] = useState([])
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lastProvider, setLastProvider] = useState(null)
  const [lastIsDemo, setLastIsDemo] = useState(null)
  const [lastIntent, setLastIntent] = useState(null)
  const [ttsAvailable, setTtsAvailable] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachmentPreview, setAttachmentPreview] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getSessions().then(res => {
      setSessions(res.data ?? [])
      setSessionsLoading(false)
    }).catch(() => {
      setSessions([])
      setSessionsLoading(false)
    })

    // Phase 14C: Check TTS availability on mount
    checkTtsReady().then(res => {
      setTtsAvailable(res.available)
    }).catch(() => {
      setTtsAvailable(false)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text) => {
    const content = (text ?? input).trim()
    const currentAttachment = attachment
    const currentPreview = attachmentPreview

    if (!content && !currentAttachment) return
    if (loading) return

    setInput('')
    setAttachment(null)
    setAttachmentPreview(null)

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      localImage: currentPreview,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      let attachmentsPayload = []

      // Upload image if present
      if (currentAttachment) {
        const uploadRes = await uploadImage(currentAttachment)
        if (uploadRes?.data?.objectKey) {
          attachmentsPayload.push({
            type: 'image',
            objectKey: uploadRes.data.objectKey,
            mimeType: currentAttachment.type
          })
        }
      }

      const res = await sendMessage({
        message: content,
        conversationId: activeSession,
        attachments: attachmentsPayload,
      })
      const data = res.data

      // Track provider, demo state, and intent for indicator bar
      if (data.provider) setLastProvider(data.provider)
      if (typeof data.isDemo === 'boolean') setLastIsDemo(data.isDemo)
      if (data.routing?.intent) setLastIntent(data.routing.intent)
      if (data.conversationId && !activeSession) setActiveSession(data.conversationId)

      // Merge agent metadata into message for display
      const assistantMsg = {
        id: data.message?.id ?? `a-${Date.now()}`,
        role: data.message?.role ?? 'assistant',
        content: data.message?.content ?? '',
        timestamp: data.message?.timestamp ?? new Date().toISOString(),
        sources: data.sources ?? [],
        provider: data.provider,
        isDemo: data.isDemo,
        // Phase 9: agent routing metadata
        agentChain: data.agentActivity ?? [],
        intent: data.routing?.intent ?? null,
        grounded: data.grounded ?? false,
        warnings: data.warnings ?? [],
        missingInformation: data.missingInformation ?? [],
        // Phase 11: market data for inline price card rendering
        market: data.market ?? null,
        // Phase 12: scheme data for inline scheme card rendering
        scheme: data.scheme ?? null,
        // Phase 13: crop recommendation data
        recommendation: data.recommendation ?? null,
        // Phase 15: disease advisory data
        disease: data.disease ?? null,
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      // Use the backend error message if available, otherwise fallback to generic message
      const errorMsg = err?.error?.message || err?.message || 'Sorry, I was unable to process your request. Please try again.'
      
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString(),
        sources: [],
        agentChain: [],
        warnings: [],
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
      if (currentPreview) {
        // Revoke blob URL after message completes to free memory
        setTimeout(() => URL.revokeObjectURL(currentPreview), 10000)
      }
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }

    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    
    setAttachment(file)
    setAttachmentPreview(URL.createObjectURL(file))
    
    // reset input so same file can be selected again if removed
    e.target.value = null
  }

  const removeAttachment = () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview)
    setAttachment(null)
    setAttachmentPreview(null)
  }

  const handleNewConversation = () => {
    setMessages([WELCOME_MSG])
    setActiveSession(null)
    setLastProvider(null)
    setLastIsDemo(null)
    setLastIntent(null)
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  /**
   * Called by VoiceInputButton when STT returns a transcript.
   * Injects the transcript into the input and auto-submits.
   * The transcript goes through the normal chat flow:
   *   VoiceInputButton → transcript → handleSend → Chat Service → Agent Router → agents.
   */
  const handleVoiceTranscript = (transcript, _detectedLang) => {
    if (!transcript?.trim() || loading) return
    // Populate input for user review (so they can see what was heard)
    setInput(transcript.trim())
    // Auto-submit after a short delay so the user can see the text first
    setTimeout(() => {
      handleSend(transcript.trim())
    }, 400)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Build the provider label shown in the top bar
  const providerLabel = lastProvider === 'watsonx'
    ? 'Powered by IBM Granite'
    : lastProvider === 'mock'
      ? 'Demo mode · No real AI active'
      : 'IBM Granite · Agricultural AI'

  // Disclaimer shown below the input
  const inputDisclaimer = lastIsDemo === false
    ? 'Connected to IBM Granite — responses are AI-generated. Live weather via Open-Meteo. Live mandi prices via Agmarknet / data.gov.in.'
    : 'Demo mode — responses use demo data. Set USE_MOCK_PROVIDERS=false for live weather, IBM Granite, and Agmarknet mandi prices.'

  // Intent badge for current session
  const intentBadge = lastIntent ? INTENT_BADGE[lastIntent] : null

  return (
    <div className="chat-page">
      {/* Sidebar toggle for mobile */}
      <button
        className="chat-sidebar-toggle"
        onClick={() => setSidebarOpen(p => !p)}
        aria-label="Toggle conversation history"
      >
        <MessageSquare size={16} /> History
      </button>

      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div className="chat-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
      <aside className={`chat-sidebar ${sidebarOpen ? 'chat-sidebar-open' : ''}`} aria-label="Conversation history">
        <div className="chat-sidebar-header">
          <h2>Conversations</h2>
          <button className="btn btn-primary btn-sm" onClick={handleNewConversation}>
            <Plus size={14} aria-hidden="true" /> New
          </button>
        </div>
        <div className="chat-sidebar-list">
          {sessionsLoading ? (
            <LoadingSpinner size="sm" text="Loading..." />
          ) : sessions.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '16px 12px' }}>No past conversations</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                className={`chat-session-item ${activeSession === s.id ? 'active' : ''}`}
                onClick={() => { setActiveSession(s.id); setSidebarOpen(false) }}
              >
                <MessageSquare size={14} aria-hidden="true" />
                <span className="truncate">{s.title}</span>
                <span className="chat-session-time">{new Date(s.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="chat-main">
        <div className="chat-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="chat-avatar-top"><Leaf size={15} /></div>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>AgroGenie AI Assistant</p>
              <p className="text-muted text-xs">{providerLabel}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Intent badge */}
            {intentBadge && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  background: `${intentBadge.color}18`,
                  border: `1px solid ${intentBadge.color}55`,
                  borderRadius: 20,
                  fontSize: '0.70rem',
                  color: intentBadge.color,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                title={`Last intent: ${lastIntent}`}
              >
                {intentBadge.label}
              </div>
            )}
            {/* Provider indicator badge */}
            {lastProvider === 'watsonx' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  background: 'rgba(52, 211, 153, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  borderRadius: 20,
                  fontSize: '0.72rem',
                  color: '#34d399',
                  fontWeight: 600,
                }}
                title="Connected to IBM watsonx.ai"
              >
                <Cpu size={11} /> IBM Granite
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} ttsAvailable={ttsAvailable} />
          ))}
          {loading && (
            <div className="chat-typing">
              <div className="chat-avatar-top"><Leaf size={14} /></div>
              <div className="typing-bubble">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested questions — shown when only welcome message */}
        {messages.length === 1 && (
          <div className="suggested-questions">
            <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Suggested questions</p>
            <div className="suggested-grid">
              {mockSuggestedQuestions.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  className="suggested-btn"
                  onClick={() => handleSend(q)}
                  disabled={loading}
                >
                  <ChevronRight size={13} aria-hidden="true" />
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input composer */}
        <div className="chat-input-area">
          {attachmentPreview && (
            <div className="chat-attachment-preview">
              <img src={attachmentPreview} alt="Preview" />
              <button className="chat-attachment-remove" onClick={removeAttachment} aria-label="Remove image">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="chat-input-wrapper">
            <input
              type="file"
              accept="image/jpeg, image/png, image/webp"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="Attach image"
              title="Upload image for disease analysis"
            >
              <ImagePlus size={18} />
            </button>
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Ask about crops, weather, mandi prices, government schemes..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
              aria-label="Message input"
            />
            <div className="chat-input-actions">
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                disabled={loading}
                language="en"
              />
              <button
                className="btn btn-primary btn-icon chat-send-btn"
                onClick={() => handleSend()}
                disabled={loading || (!input.trim() && !attachment)}
                aria-label="Send message"
              >
                {loading ? <Loader2 size={17} className="spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <p className="chat-disclaimer">
            {inputDisclaimer}
          </p>
        </div>
      </div>
    </div>
  )
}
