/**
 * CropRecommendationCard — Phase 13.
 *
 * Renders a ranked crop recommendation result card.
 * Displays suitability score, factor breakdown, key risks, and evidence sources.
 *
 * Data contract (from recommendation.topCrops[]):
 *   rank, cropCode, name, score, suitabilityLabel, suitabilityColor,
 *   evidenceCoverage, confidence, waterRequirementCategory, durationDays,
 *   riskLevel, keyRisks, factorBreakdown, officialSources, isDemo
 *
 * CropRecommendationPanel — wraps the list of cards with a header.
 */
import { Sprout, Droplets, Shield, TrendingUp, AlertTriangle, CheckCircle, Info, Award } from 'lucide-react'
import './CropRecommendationCard.css'

// ── Factor display config ──────────────────────────────────────────────────────

const FACTOR_LABELS = {
  seasonFit: 'Season Fit',
  soilFit: 'Soil Fit',
  waterFit: 'Water Fit',
  locationFit: 'Location Fit',
  weatherFit: 'Weather Fit',
  rotationFit: 'Crop Rotation',
  marketEvidence: 'Market Signal',
  knowledgeFit: 'Knowledge Base',
  schemeSupport: 'Govt. Schemes',
}

const FACTOR_ICONS = {
  seasonFit: '🗓️',
  soilFit: '🌱',
  waterFit: '💧',
  locationFit: '📍',
  weatherFit: '☀️',
  rotationFit: '🔄',
  marketEvidence: '📈',
  knowledgeFit: '📚',
  schemeSupport: '🏛️',
}

const WATER_REQ_LABELS = {
  HIGH: { label: 'High Water', color: '#0ea5e9' },
  MEDIUM: { label: 'Medium Water', color: '#10b981' },
  LOW: { label: 'Low Water', color: '#f59e0b' },
  VERY_LOW: { label: 'Very Low Water', color: '#6b7280' },
}

const RISK_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
}

// ── Score arc SVG ──────────────────────────────────────────────────────────────

function ScoreArc({ score, color }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - score / 100)

  const finalColor = color === 'success' ? '#22c55e' : color === 'info' ? '#3b82f6' : color === 'warning' ? '#f59e0b' : '#ef4444'


  return (
    <div className="crop-score-arc" aria-label={`Suitability score: ${score} out of 100`}>
      <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={finalColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="crop-score-center">
        <span className="crop-score-number">{score}</span>
        <span className="crop-score-denom">/100</span>
      </div>
    </div>
  )
}

// ── Factor bar ────────────────────────────────────────────────────────────────

function FactorBar({ name, factor }) {
  if (!factor?.available) return null
  const score = factor.score ?? 0
  const barColor = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="crop-factor-row" title={factor.notes?.[0] ?? ''}>
      <span className="crop-factor-icon">{FACTOR_ICONS[name] ?? '•'}</span>
      <span className="crop-factor-label">{FACTOR_LABELS[name] ?? name}</span>
      <div className="crop-factor-bar-track">
        <div
          className="crop-factor-bar-fill"
          style={{ width: `${score}%`, background: barColor }}
        />
      </div>
      <span className="crop-factor-score">{score}</span>
    </div>
  )
}

// ── Individual crop card ──────────────────────────────────────────────────────

function CropCard({ crop }) {
  const waterInfo = WATER_REQ_LABELS[crop.waterRequirementCategory] ?? WATER_REQ_LABELS.MEDIUM
  const riskColor = RISK_COLORS[crop.riskLevel] ?? '#6b7280'

  const availableFactors = Object.entries(crop.factorBreakdown ?? {}).filter(([, f]) => f.available)
  const hasFactors = availableFactors.length > 0

  return (
    <div className={`crop-card crop-card-rank-${crop.rank}`} id={`crop-card-${crop.cropCode}`}>
      {/* Header */}
      <div className="crop-card-header">
        <div className="crop-card-rank-badge">#{crop.rank}</div>
        <div className="crop-card-title-section">
          <h3 className="crop-card-name">{crop.name}</h3>
          <span className={`crop-suitability-badge crop-suitability-${crop.suitabilityColor}`}>
            {crop.suitabilityLabel}
          </span>
        </div>
        <ScoreArc score={crop.score} color={crop.suitabilityColor} />
      </div>

      {/* Meta chips */}
      <div className="crop-meta-chips">
        <span className="crop-chip" style={{ color: waterInfo.color, borderColor: waterInfo.color + '40' }}>
          <Droplets size={11} /> {waterInfo.label}
        </span>
        <span className="crop-chip">
          <Sprout size={11} /> {crop.durationDays?.min ?? '?'}–{crop.durationDays?.max ?? '?'} days
        </span>
        <span className="crop-chip" style={{ color: riskColor, borderColor: riskColor + '40' }}>
          <Shield size={11} /> Risk: {crop.riskLevel}
        </span>
        <span className="crop-chip">
          <TrendingUp size={11} /> Coverage: {crop.evidenceCoverage}%
        </span>
        <span className={`crop-confidence-badge crop-confidence-${crop.confidence}`}>
          {crop.confidence === 'high' ? <CheckCircle size={10} /> : <Info size={10} />}
          {crop.confidence} confidence
        </span>
      </div>

      {/* Factor breakdown */}
      {hasFactors && (
        <div className="crop-factor-breakdown">
          <div className="crop-section-title">Suitability Factors</div>
          {availableFactors.map(([key, factor]) => (
            <FactorBar key={key} name={key} factor={factor} />
          ))}
        </div>
      )}

      {/* Key risks */}
      {crop.keyRisks?.length > 0 && (
        <div className="crop-risks-section">
          <div className="crop-section-title">
            <AlertTriangle size={11} /> Key Risks
          </div>
          <ul className="crop-risk-list">
            {crop.keyRisks.slice(0, 3).map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Panel header ──────────────────────────────────────────────────────────────

function EvidenceBadge({ evidenceSummary }) {
  const available = Object.values(evidenceSummary ?? {}).filter(Boolean).length
  const total = Object.keys(evidenceSummary ?? {}).length
  return (
    <span className="crop-evidence-badge">
      {available}/{total} data sources
    </span>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

/**
 * CropRecommendationPanel
 *
 * @param {{ recommendation: object }} props
 */
export default function CropRecommendationPanel({ recommendation }) {
  if (!recommendation) return null
  const { topCrops = [], season, candidatesEvaluated = 0, evidenceSummary, isDemo } = recommendation

  if (topCrops.length === 0) return null

  return (
    <div className="crop-panel" id="crop-recommendation-panel" aria-label="Crop Recommendation Results">
      {/* Panel header */}
      <div className="crop-panel-header">
        <Award size={14} className="crop-panel-icon" aria-hidden="true" />
        <span className="crop-panel-title">
          Crop Recommendation
          {season ? ` — ${season}` : ''}
        </span>
        <div className="crop-panel-meta">
          {candidatesEvaluated > 0 && (
            <span className="crop-candidates-count">{candidatesEvaluated} crops evaluated</span>
          )}
          {evidenceSummary && <EvidenceBadge evidenceSummary={evidenceSummary} />}
          {isDemo && <span className="crop-demo-badge">Demo Data</span>}
        </div>
      </div>

      {/* Cards grid */}
      <div className="crop-cards-grid">
        {topCrops.map((crop) => (
          <CropCard key={crop.cropCode} crop={crop} />
        ))}
      </div>
    </div>
  )
}
