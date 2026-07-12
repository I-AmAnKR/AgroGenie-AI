import { FlaskConical } from 'lucide-react'

export default function DemoDataBadge({ label = 'Demo Data' }) {
  return (
    <span className="badge badge-demo" title="This is demonstration data, not live information">
      <FlaskConical size={11} aria-hidden="true" />
      {label}
    </span>
  )
}
