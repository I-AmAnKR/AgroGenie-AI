import { useState, useEffect } from 'react'
import { Search, BookOpen, ExternalLink, ChevronDown, ChevronUp, Info, FileText } from 'lucide-react'
import { searchSchemes } from '../api/schemes.api.js'
import { mockSchemeCategories } from '../mocks/schemes.mock.js'
import PageHeader from '../components/common/PageHeader.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import './Schemes.css'

const relevanceClass = { high: 'badge-success', medium: 'badge-info', low: 'badge-neutral' }

function SchemeCard({ scheme }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="scheme-card card">
      <div className="scheme-card-header" onClick={() => setOpen(p => !p)} role="button" tabIndex={0} aria-expanded={open}
           onKeyDown={e => e.key === 'Enter' && setOpen(p => !p)}>
        <div className="scheme-icon-wrap">
          <BookOpen size={18} color="var(--color-ibm)" aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>{scheme.name}</h3>
            <span className={`badge ${relevanceClass[scheme.relevance] ?? 'badge-neutral'}`}>{scheme.relevanceLabel}</span>
            <span className="badge badge-neutral">{scheme.category}</span>
          </div>
          <p className="text-sm text-secondary">{scheme.authority}</p>
        </div>
        <div className="scheme-toggle">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {open && (
        <div className="scheme-card-body">
          <div className="scheme-section">
            <p className="scheme-section-label">Purpose</p>
            <p className="text-sm">{scheme.purpose}</p>
          </div>
          <div className="scheme-section">
            <p className="scheme-section-label">Benefit</p>
            <p className="text-sm" style={{ fontWeight: 500, color: 'var(--color-primary-dark)' }}>{scheme.benefits}</p>
          </div>
          <div className="scheme-section">
            <p className="scheme-section-label">Key Eligibility Conditions</p>
            <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {scheme.eligibility.map((e, i) => (
                <li key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', listStyle: 'disc' }}>
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <div className="scheme-section">
            <p className="scheme-section-label">Required Documents</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scheme.documents.map((d, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '3px 10px', fontSize: '0.8125rem' }}>
                  <FileText size={11} aria-hidden="true" />
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="scheme-footer-row">
            <div>
              <p className="text-xs text-muted">Source: {scheme.sourceDoc} · {scheme.sourceDate}</p>
              <DemoDataBadge />
            </div>
            <a href={scheme.applyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
              <ExternalLink size={13} /> Application Portal
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Schemes() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async (q, cat) => {
    setLoading(true)
    try {
      const res = await searchSchemes(q, cat)
      setSchemes(res.data.schemes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('', 'All') }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    load(query, category)
  }

  return (
    <div>
      <PageHeader title="Government Schemes" description="Find central and state government schemes potentially relevant to your farm profile." />

      {/* Search */}
      <form className="schemes-search card" onSubmit={handleSearch} role="search">
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              className="form-control"
              style={{ paddingLeft: 36 }}
              type="search"
              placeholder="What support are you looking for? (e.g. irrigation subsidy, crop insurance)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search schemes"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={15} /> Search
          </button>
        </div>
      </form>

      {/* Category filters */}
      <div className="scheme-cats" role="group" aria-label="Filter by category">
        {mockSchemeCategories.map(cat => (
          <button
            key={cat}
            className={`scheme-cat-btn ${category === cat ? 'active' : ''}`}
            onClick={() => { setCategory(cat); load(query, cat) }}
            aria-pressed={category === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="schemes-disclaimer">
        <Info size={14} color="var(--color-info)" aria-hidden="true" />
        <p className="text-sm text-secondary">
          AgroGenie helps identify potentially relevant schemes. Final eligibility is determined by the responsible government authority.
          Always verify details on the official application portal before applying.
        </p>
      </div>

      {/* Results */}
      {loading ? <LoadingSpinner fullPage text="Searching schemes..." /> : (
        schemes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No matching schemes"
            message="Try different search terms or change the category filter."
          />
        ) : (
          <div className="schemes-list">
            <p className="text-sm text-muted" style={{ marginBottom: 10 }}>{schemes.length} scheme(s) found · Demo data</p>
            {schemes.map(s => <SchemeCard key={s.id} scheme={s} />)}
          </div>
        )
      )}
    </div>
  )
}
