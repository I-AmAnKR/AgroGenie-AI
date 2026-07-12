import { Clock } from 'lucide-react'

export default function FreshnessIndicator({ timestamp, source }) {
  const formatted = timestamp
    ? new Date(timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    : 'Unknown'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
      <Clock size={12} aria-hidden="true" />
      <span>Updated: {formatted}</span>
      {source && <span>· {source}</span>}
    </div>
  )
}
