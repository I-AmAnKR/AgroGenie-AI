import { BookOpen } from 'lucide-react'

export default function SourceCard({ source }) {
  return (
    <div className="source-card">
      <BookOpen size={13} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <p style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{source.title}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {source.organization}
          {source.date && ` · ${source.date}`}
        </p>
      </div>
    </div>
  )
}
