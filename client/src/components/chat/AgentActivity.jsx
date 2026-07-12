import { Activity } from 'lucide-react'

export default function AgentActivity({ chain = [], isLoading }) {
  if (!chain.length && !isLoading) return null

  return (
    <div className="agent-activity">
      <div className="agent-activity-row">
        <Activity size={13} className={isLoading ? 'spin-slow' : ''} color="var(--color-primary)" aria-hidden="true" />
        <span className="agent-activity-label">Agent activity</span>
      </div>
      <div className="agent-chain">
        {chain.map((agent, i) => (
          <span key={i} className="agent-chain-step">
            {agent}
            {i < chain.length - 1 && <span className="agent-chain-arrow">→</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
