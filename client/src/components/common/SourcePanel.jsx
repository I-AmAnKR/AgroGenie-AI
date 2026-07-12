import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import SourceCard from './SourceCard.jsx'

export default function SourcePanel({ sources = [], dataConsidered = [] }) {
  const [open, setOpen] = useState(false)

  if (!sources.length && !dataConsidered.length) return null

  return (
    <div className="source-panel">
      <button
        className="source-panel-toggle"
        onClick={() => setOpen(p => !p)}
        aria-expanded={open}
      >
        <BookOpen size={14} aria-hidden="true" />
        <span>Why this recommendation?</span>
        {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {open && (
        <div className="source-panel-body">
          {dataConsidered.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p className="source-section-label">Data considered</p>
              <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dataConsidered.map((d, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', listStyle: 'disc' }}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {sources.length > 0 && (
            <div>
              <p className="source-section-label">Sources</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sources.map((s, i) => <SourceCard key={i} source={s} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
