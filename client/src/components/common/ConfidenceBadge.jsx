export default function ConfidenceBadge({ confidence }) {
  const map = {
    'High': 'badge-success',
    'Moderate': 'badge-warning',
    'Low': 'badge-danger',
  }
  const cls = map[confidence] ?? 'badge-neutral'
  return <span className={`badge ${cls}`}>{confidence} Confidence</span>
}
