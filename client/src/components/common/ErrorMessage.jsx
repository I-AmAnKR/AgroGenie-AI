import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div className="error-state card card-body" role="alert" style={{ textAlign: 'center', padding: '32px' }}>
      <AlertTriangle size={32} color="var(--color-warning)" aria-hidden="true" style={{ margin: '0 auto 12px' }} />
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Something went wrong</p>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>{message ?? 'Unable to load data. Please try again.'}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm" onClick={onRetry} style={{ margin: '0 auto' }}>
          <RefreshCw size={14} aria-hidden="true" />
          Try Again
        </button>
      )}
    </div>
  )
}
