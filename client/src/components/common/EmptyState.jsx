import { Inbox } from 'lucide-react'

export default function EmptyState({ title = 'No results', message, action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state card card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <Icon size={36} color="var(--color-text-muted)" aria-hidden="true" style={{ margin: '0 auto 12px' }} />
      <p style={{ fontWeight: 600, marginBottom: 6 }}>{title}</p>
      {message && <p className="text-muted text-sm" style={{ marginBottom: 16 }}>{message}</p>}
      {action}
    </div>
  )
}
