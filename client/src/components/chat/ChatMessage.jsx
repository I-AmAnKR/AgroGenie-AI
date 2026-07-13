import { Leaf, AlertTriangle, Info, ShoppingCart, Landmark } from 'lucide-react'
import ConfidenceBadge from '../common/ConfidenceBadge.jsx'
import SourcePanel from '../common/SourcePanel.jsx'
import AgentActivity from './AgentActivity.jsx'
import MarketPriceCard from '../market/MarketPriceCard.jsx'
import SchemeCard from './SchemeCard.jsx'
import CropRecommendationPanel from './CropRecommendationCard.jsx'
import DiseaseAdvisoryCard from './DiseaseAdvisoryCard.jsx'
import SpeakButton from './SpeakButton.jsx'
import './ChatMessage.css'
import '../common/SourcePanel.css'
import '../chat/AgentActivity.css'
import '../market/MarketPriceCard.css'
import '../chat/SchemeCard.css'
import '../chat/CropRecommendationCard.css'

// Intent label map for per-message badge
const INTENT_LABEL = {
  GENERAL: 'General',
  KNOWLEDGE: 'Knowledge',
  WEATHER: 'Weather',
  MARKET: 'Market',
  SCHEME: 'Scheme',
  CROP_RECOMMENDATION: 'Crop Advisor',
  DISEASE: 'Plant Health',
  MULTI_INTENT: 'Multi-topic',
  CLARIFICATION: 'Clarification',
}

function MarkdownLike({ content }) {
  // Lightweight markdown renderer: bold + line breaks + numbered lists
  const lines = (content || '').split('\n')
  return (
    <span>
      {lines.map((line, lineIdx) => {
        // Render list items (lines starting with a digit and .)
        const listMatch = line.match(/^(\d+)\.\s+(.*)/)
        if (listMatch) {
          return (
            <span key={lineIdx} style={{ display: 'block', paddingLeft: 16 }}>
              <strong>{listMatch[1]}.</strong>{' '}
              {formatInline(listMatch[2])}
              {lineIdx < lines.length - 1 && <br />}
            </span>
          )
        }
        // Render section headers (lines starting with **)
        if (line.startsWith('**') && line.endsWith(':**')) {
          return (
            <span key={lineIdx} style={{ display: 'block', marginTop: 8 }}>
              <strong>{line.replace(/\*\*/g, '').replace(/:$/, '')}</strong>:
              {lineIdx < lines.length - 1 && <br />}
            </span>
          )
        }
        // Normal line with inline bold
        return (
          <span key={lineIdx}>
            {formatInline(line)}
            {lineIdx < lines.length - 1 && <br />}
          </span>
        )
      })}
    </span>
  )
}

function formatInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

/**
 * Warning pills for non-blocking agent warnings.
 */
function WarningPills({ warnings = [] }) {
  if (!warnings.length) return null
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {warnings.map((w, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '5px 8px',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 6,
            fontSize: '0.73rem',
            color: '#b45309',
          }}
        >
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{w}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Missing information pills — shown for CLARIFICATION intent.
 */
function MissingInfoPills({ missing = [] }) {
  if (!missing.length) return null
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          padding: '6px 8px',
          background: 'rgba(59, 130, 246, 0.07)',
          border: '1px solid rgba(59, 130, 246, 0.22)',
          borderRadius: 6,
          fontSize: '0.73rem',
          color: '#1d4ed8',
        }}
      >
        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Needed:</strong>{' '}
          {missing.join(' · ')}
        </span>
      </div>
    </div>
  )
}

/**
 * Market data panel — renders price cards for MARKET intent responses.
 * Only shown when the message has a market object with records.
 */
function MarketDataPanel({ market }) {
  if (!market) return null
  const { commodity, records, statistics, freshness } = market
  if (!records || records.length === 0) return null

  // Show up to 4 records in the panel
  const displayRecords = records.slice(0, 4)

  return (
    <div className="market-data-panel" style={{ marginTop: 8 }}>
      <div className="market-data-panel-header">
        <ShoppingCart size={13} aria-hidden="true" />
        <span>{commodity ?? 'Market'} Prices</span>
        {freshness?.latestDate && (
          <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '0.7rem', color: '#6b7280' }}>
            Data: {freshness.latestDate}
          </span>
        )}
      </div>
      <div className="market-data-panel-records">
        {displayRecords.map((r, i) => (
          <MarketPriceCard key={i} record={r} />
        ))}
      </div>
      {statistics && statistics.recordsAnalyzed > 1 && (
        <div className="market-stats-summary">
          {statistics.averageModalPrice !== null && (
            <span className="market-stat-item">Avg modal: <strong>₹{Math.round(statistics.averageModalPrice).toLocaleString('en-IN')}/quintal</strong></span>
          )}
          {statistics.minReportedPrice !== null && (
            <span className="market-stat-item">Min: <strong>₹{statistics.minReportedPrice.toLocaleString('en-IN')}/quintal</strong></span>
          )}
          {statistics.maxReportedPrice !== null && (
            <span className="market-stat-item">Max: <strong>₹{statistics.maxReportedPrice.toLocaleString('en-IN')}/quintal</strong></span>
          )}
          <span className="market-stat-item">{statistics.marketsCompared} mandi{statistics.marketsCompared !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Scheme data panel — renders scheme evaluation cards for SCHEME intent responses.
 * Only shown when the message has a scheme object with evaluated schemes.
 */
function SchemeDataPanel({ scheme }) {
  if (!scheme) return null
  const { schemes, schemesEvaluated } = scheme
  if (!schemes || schemes.length === 0) return null

  return (
    <div className="scheme-data-panel" style={{ marginTop: 8 }}>
      <div
        className="market-data-panel-header"
        style={{
          borderColor: 'rgba(5,150,105,0.2)',
          background: 'rgba(5,150,105,0.05)',
          color: '#065f46',
        }}
      >
        <Landmark size={13} aria-hidden="true" />
        <span>Government Schemes ({schemesEvaluated})</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 8,
          marginTop: 6,
        }}
      >
        {schemes.map((s, i) => (
          <SchemeCard key={i} schemeData={s} />
        ))}
      </div>
    </div>
  )
}

export default function ChatMessage({ message, ttsAvailable = false }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="chat-message chat-message-user">
        <div className="chat-bubble chat-bubble-user">
          {message.localImage && (
            <div className="chat-user-image">
              <img src={message.localImage} alt="Uploaded" />
            </div>
          )}
          <p>{message.content}</p>
          <span className="chat-time">
            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    )
  }

  const intentLabel = message.intent ? INTENT_LABEL[message.intent] : null

  return (
    <div className="chat-message chat-message-assistant">
      <div className="chat-avatar" aria-hidden="true">
        <Leaf size={15} />
      </div>
      <div className="chat-bubble-wrapper">
        <div className="chat-bubble chat-bubble-assistant">
          <div className="chat-content">
            <MarkdownLike content={message.content} />
          </div>
          <div className="chat-meta">
            {/* Intent badge */}
            {intentLabel && (
              <span
                className="chat-intent-badge"
                title={`Intent: ${message.intent}`}
              >
                {intentLabel}
              </span>
            )}
            {message.agent && (
              <span className="chat-agent-label">{message.agent}</span>
            )}
            {message.confidence && (
              <ConfidenceBadge confidence={message.confidence} />
            )}
            <span className="chat-time">
              {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {/* Phase 14C: speak button — only for assistant messages with text content */}
            {message.content && (
              <SpeakButton
                text={message.content}
                language="en"
                ttsAvailable={ttsAvailable}
                messageId={message.id}
              />
            )}
          </div>
        </div>

        {/* Agent activity, warnings, missing info, market data, sources */}
        <div style={{ marginTop: 4 }}>
          {message.agentChain?.length > 0 && (
            <AgentActivity chain={message.agentChain} />
          )}
          {message.warnings?.length > 0 && (
            <WarningPills warnings={message.warnings} />
          )}
          {message.missingInformation?.length > 0 && (
            <MissingInfoPills missing={message.missingInformation} />
          )}
          {/* Market data panel — only for MARKET intent with records */}
          {message.intent === 'MARKET' && message.market?.records?.length > 0 && (
            <MarketDataPanel market={message.market} />
          )}
          {/* Scheme data panel — only for SCHEME intent with evaluated schemes */}
          {message.intent === 'SCHEME' && message.scheme?.schemes?.length > 0 && (
            <SchemeDataPanel scheme={message.scheme} />
          )}
          {/* Crop recommendation panel — only for CROP_RECOMMENDATION intent with results */}
          {message.intent === 'CROP_RECOMMENDATION' && message.recommendation?.topCrops?.length > 0 && (
            <CropRecommendationPanel recommendation={message.recommendation} />
          )}
          {/* Disease Advisory panel — only for DISEASE intent with disease data */}
          {message.intent === 'DISEASE' && message.disease && (
            <DiseaseAdvisoryCard disease={message.disease} />
          )}
          <SourcePanel
            sources={message.sources ?? []}
            dataConsidered={message.dataConsidered ?? []}
          />
        </div>
      </div>
    </div>
  )
}
