/**
 * MarketPriceCard — Phase 11.
 *
 * Displays a normalized market price record (one mandi row) in a compact card.
 * Used by the Chat message to render market data inline without showing raw JSON.
 *
 * Props:
 *   record    — Normalized market record (commodity, market, district, state, priceDate,
 *                minPrice, maxPrice, modalPrice, unit, arrivals, metadata)
 *   compact   — Boolean (default false). If true, show only commodity + modal + date.
 */
import { Calendar, MapPin, Package } from 'lucide-react'
import './MarketPriceCard.css'

/**
 * Format a price in INR with Indian number formatting.
 * @param {number|null} price
 * @returns {string}
 */
function formatINR(price) {
  if (price === null || price === undefined) return '—'
  return `₹${Math.round(price).toLocaleString('en-IN')}`
}

/**
 * Freshness badge color by category.
 */
const FRESHNESS_COLORS = {
  current: { bg: '#dcfce7', text: '#166534', label: 'Current' },
  recent: { bg: '#fef9c3', text: '#854d0e', label: 'Recent' },
  stale: { bg: '#fee2e2', text: '#991b1b', label: 'Stale' },
  unknown: { bg: '#f3f4f6', text: '#6b7280', label: 'Unknown' },
}

export default function MarketPriceCard({ record, compact = false }) {
  if (!record) return null

  const {
    commodity, variety, market, district, state,
    priceDate, minPrice, maxPrice, modalPrice,
    unit, arrivals, arrivalsUnit,
    metadata,
  } = record

  const isDemo = metadata?.isDemo === true
  const unitLabel = unit === 'INR_PER_QUINTAL' ? '/quintal' : '/kg'

  // Freshness is calculated from priceDate relative to today
  const getFreshnessCategory = (date) => {
    if (!date) return 'unknown'
    const d = new Date(date + 'T00:00:00+05:30')
    if (isNaN(d.getTime())) return 'unknown'
    const now = new Date()
    const diffMs = now - d
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 1) return 'current'
    if (diffDays <= 7) return 'recent'
    return 'stale'
  }

  const freshnessCategory = getFreshnessCategory(priceDate)
  const freshnessStyle = FRESHNESS_COLORS[freshnessCategory] ?? FRESHNESS_COLORS.unknown

  if (compact) {
    return (
      <div className="market-price-card market-price-card-compact">
        <div className="market-card-row">
          <span className="market-card-commodity">{commodity}</span>
          {modalPrice !== null && (
            <span className="market-card-modal">{formatINR(modalPrice)}<span className="market-card-unit">{unitLabel}</span></span>
          )}
        </div>
        <div className="market-card-row market-card-meta">
          <span><MapPin size={11} /> {market}</span>
          {priceDate && <span><Calendar size={11} /> {priceDate}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={`market-price-card${isDemo ? ' market-price-card-demo' : ''}`}>
      {isDemo && (
        <div className="market-demo-badge">Demo Data</div>
      )}

      <div className="market-card-header">
        <div className="market-card-commodity-block">
          <Package size={14} aria-hidden="true" />
          <span className="market-card-commodity">{commodity}</span>
          {variety && <span className="market-card-variety">({variety})</span>}
        </div>
        <span
          className="market-freshness-badge"
          style={{ background: freshnessStyle.bg, color: freshnessStyle.text }}
        >
          {freshnessStyle.label}
        </span>
      </div>

      <div className="market-card-location">
        <MapPin size={12} aria-hidden="true" />
        <span>{market}, {district}, {state}</span>
      </div>

      <div className="market-price-grid">
        {minPrice !== null && (
          <div className="market-price-cell">
            <span className="market-price-label">Min</span>
            <span className="market-price-value">{formatINR(minPrice)}</span>
          </div>
        )}
        {modalPrice !== null && (
          <div className="market-price-cell market-price-cell-modal">
            <span className="market-price-label">Modal</span>
            <span className="market-price-value">{formatINR(modalPrice)}</span>
          </div>
        )}
        {maxPrice !== null && (
          <div className="market-price-cell">
            <span className="market-price-label">Max</span>
            <span className="market-price-value">{formatINR(maxPrice)}</span>
          </div>
        )}
      </div>

      <div className="market-card-footer">
        <span className="market-card-unit-note">All prices in INR{unitLabel}</span>
        {priceDate && (
          <span className="market-card-date">
            <Calendar size={11} aria-hidden="true" /> {priceDate}
          </span>
        )}
        {arrivals !== null && arrivalsUnit && (
          <span className="market-card-arrivals">Arrivals: {arrivals} {arrivalsUnit}</span>
        )}
      </div>
    </div>
  )
}
