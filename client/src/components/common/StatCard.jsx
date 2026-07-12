import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

export default function StatCard({ title, value, unit, icon: Icon, trend, trendLabel, color, subtitle }) {
  const trendIcon = trend === 'up' ? <ArrowUp size={13} /> : trend === 'down' ? <ArrowDown size={13} /> : <Minus size={13} />
  const trendClass = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-muted'

  return (
    <div className="stat-card card">
      <div className="card-body stat-card-inner">
        <div className="stat-card-label">
          {Icon && <Icon size={15} color={color ?? 'var(--color-primary)'} aria-hidden="true" />}
          <span>{title}</span>
        </div>
        <div className="stat-card-value">
          <span style={{ color: color }}>{value}</span>
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
        {subtitle && <p className="stat-subtitle">{subtitle}</p>}
        {trend && trendLabel && (
          <div className={`stat-trend ${trendClass}`}>
            {trendIcon}
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}
