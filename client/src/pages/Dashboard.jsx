import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CloudSun, Sprout, TrendingUp, AlertTriangle, ArrowRight,
  MessageSquare, BookOpen, Bug, Zap
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useFarmer } from '../context/FarmerContext.jsx'
import { getCurrentWeather, getForecast } from '../api/weather.api.js'
import { getPrices, getPriceTrend } from '../api/market.api.js'
import StatCard from '../components/common/StatCard.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import '../components/common/StatCard.css'
import './Dashboard.css'

const quickActions = [
  { label: 'Ask AgroGenie', icon: MessageSquare, path: '/chat', color: 'var(--color-primary)' },
  { label: 'Crop Suitability', icon: Sprout, path: '/crop-advisor', color: '#2d9d6e' },
  { label: 'Mandi Prices', icon: TrendingUp, path: '/market', color: '#f59e0b' },
  { label: 'Find a Scheme', icon: BookOpen, path: '/schemes', color: '#8b5cf6' },
  { label: 'Disease Check', icon: Bug, path: '/disease', color: '#ef4444' },
]

const mockRecommendations = [
  { id: 1, priority: 'high', title: 'Consider delaying sowing by 3–4 days', reason: 'Rainfall of 15–20mm expected mid-week. Soil moisture will be optimal after the rain.', evidence: 'Weather forecast + Soil data' },
  { id: 2, priority: 'medium', title: 'Reduce irrigation schedule by ~40%', reason: 'Upcoming rainfall will supplement irrigation needs significantly.', evidence: 'Weather forecast' },
  { id: 3, priority: 'low', title: 'Monitor for signs of downy mildew', reason: 'High humidity forecast increases risk of fungal infection in onion crop.', evidence: 'Weather data + Crop knowledge base' },
]

const mockSchemes = [
  { name: 'Pradhan Mantri Fasal Bima Yojana', authority: 'GoI', relevance: 'Crop insurance', category: 'Crop Insurance' },
  { name: 'PM Krishi Sinchayee Yojana', authority: 'GoI / NABARD', relevance: 'Drip irrigation subsidy', category: 'Irrigation' },
]

const mockConversations = [
  { id: 1, title: 'Kharif crop recommendation', agent: 'Crop Advisor', time: '2h ago' },
  { id: 2, title: 'Onion mandi price check', agent: 'Market Agent', time: '1d ago' },
  { id: 3, title: 'Rainfall sowing advisory', agent: 'Weather Agent', time: '2d ago' },
]

function PriorityDot({ priority }) {
  const map = { high: 'var(--color-danger)', medium: 'var(--color-warning)', low: 'var(--color-success)' }
  return (
    <span
      style={{ width: 8, height: 8, borderRadius: '50%', background: map[priority] ?? '#ccc', display: 'inline-block', flexShrink: 0, marginTop: 6 }}
      aria-hidden="true"
    />
  )
}

export default function Dashboard() {
  const { profile } = useFarmer()
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState([])
  const [prices, setPrices] = useState([])
  const [priceTrend, setPriceTrend] = useState([])
  const [loading, setLoading] = useState(true)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [w, f, p, pt] = await Promise.all([
          getCurrentWeather(19.847, 73.998),
          getForecast(19.847, 73.998),
          getPrices({ commodity: 'Onion', state: 'Maharashtra' }),
          getPriceTrend('Onion', 'Lasalgaon'),
        ])
        setWeather(w?.data ?? {})

        setForecast(
            Array.isArray(f?.data)
                ? f.data
                : f?.data?.forecast ?? []
        )

        setPrices(p?.data?.records ?? [])

        setPriceTrend(pt?.data?.trend ?? [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const topPrice = prices?.[0] ?? null
  const sowingDate = profile?.sowingDate
  ? new Date(profile.sowingDate)
  : null
  const daysSinceSowing = sowingDate ? Math.floor((Date.now() - sowingDate.getTime()) / 86400000) : null

  if (loading) return <LoadingSpinner fullPage text="Loading your farm intelligence..." />

  return (
    <div className="dashboard">
      {/* Greeting */}
      <div className="dash-greeting">
        <div>
          <h1>{greeting}, {profile?.name ?? 'Farmer'}!</h1>
          <p className="text-secondary">Here is your farm intelligence summary for today.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <DemoDataBadge />
          <span className="text-muted text-xs">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-4 dash-summary">
        <StatCard
          title="Weather Today"
          value={weather?.current?.temperatureC ?? "—"}
          unit="°C"
          icon={CloudSun}
          subtitle={`${weather?.current?.condition ?? "Unknown"} · Rain ${
            weather?.forecast?.[0]?.precipitationProbabilityPercent ?? 0
          }%`}
          color="var(--color-info)"
        />
        <StatCard
          title="Current Crop"
          value={profile?.currentCrop ?? '—'}
          icon={Sprout}
          subtitle={daysSinceSowing !== null ? `${daysSinceSowing} days since sowing` : 'Sowing date not set'}
          color="var(--color-primary)"
        />
        <StatCard
    title="Market Watch"
    value={topPrice ? `₹${(topPrice.modalPrice ?? 0).toLocaleString('en-IN')}` : '—'}
    unit="/quintal"
    icon={TrendingUp}
    subtitle={
        topPrice
            ? `${topPrice.commodity} • ${topPrice.market}`
            : 'No market data'
    }
    color="var(--color-accent-dark)"
/>
        <div className="alert-card card">
          <div className="card-body alert-card-inner">
            <div className="alert-icon">
              <AlertTriangle size={16} color="var(--color-warning)" aria-hidden="true" />
              <span>Farm Alert</span>
            </div>
            <p>Moderate rainfall expected in the next 48 hours. Plan field activities accordingly.</p>
            <Link to="/weather" className="text-primary text-sm font-semibold" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              View forecast <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="dash-main">
        {/* Left column */}
        <div className="dash-left">
          {/* Recommendations */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color="var(--color-primary)" aria-hidden="true" />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{"Today's Recommendations"}</h2>
              </div>
              <DemoDataBadge />
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {mockRecommendations.map((rec, i) => (
                <div key={rec.id} className={`rec-item ${i < mockRecommendations.length - 1 ? 'rec-item-border' : ''}`}>
                  <PriorityDot priority={rec.priority} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{rec.title}</p>
                    <p className="text-sm text-secondary">{rec.reason}</p>
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>Evidence: {rec.evidence}</p>
                  </div>
                  <span className={`badge ${rec.priority === 'high' ? 'badge-danger' : rec.priority === 'medium' ? 'badge-warning' : 'badge-success'}`} style={{ flexShrink: 0 }}>
                    {rec.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Market Price Trend */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="var(--color-accent-dark)" aria-hidden="true" />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Onion Price Trend — Lasalgaon</h2>
              </div>
              <DemoDataBadge />
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={priceTrend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} domain={['auto', 'auto']} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v) => [`₹${v}/qt`, 'Modal Price']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="price" stroke="var(--color-primary)" fill="url(#priceGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 7-Day Forecast */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudSun size={16} color="var(--color-info)" aria-hidden="true" />
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>7-Day Weather Overview</h2>
              </div>
              <DemoDataBadge />
            </div>
            <div className="card-body forecast-strip">
              {(forecast ?? []).map((day) => (
                <div key={day.date} className="forecast-day">
                  <span className="forecast-day-label">
                    {new Date(day.date).toLocaleDateString("en-IN", {
                      weekday: "short",
                    })}
                  </span>

                  <span className="forecast-icon">
                    {day.precipitationProbabilityPercent > 50
                      ? "🌧"
                      : day.precipitationProbabilityPercent > 25
                      ? "⛅"
                      : "☀️"}
                  </span>

                  <span className="forecast-hi">
                    {day.maxTemperatureC}°
                  </span>

                  <span className="forecast-lo">
                    {day.minTemperatureC}°
                  </span>

                  <span className="forecast-rain">
                    {day.precipitationProbabilityPercent}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="dash-right">
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Quick Actions</h2>
            </div>
            <div className="card-body quick-actions">
              {quickActions.map(qa => (
                <Link to={qa.path} key={qa.label} className="quick-action-btn">
                  <div className="quick-action-icon" style={{ background: `${qa.color}18`, color: qa.color }}>
                    <qa.icon size={16} aria-hidden="true" />
                  </div>
                  <span>{qa.label}</span>
                  <ArrowRight size={14} className="quick-action-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Conversations */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent AI Conversations</h2>
              <Link to="/chat" className="text-sm text-primary font-semibold">View all</Link>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {mockConversations.map((conv, i) => (
                <Link
                  to="/chat"
                  key={conv.id}
                  className={`conv-item ${i < mockConversations.length - 1 ? 'conv-item-border' : ''}`}
                >
                  <div className="conv-icon"><MessageSquare size={14} aria-hidden="true" /></div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{conv.title}</p>
                    <p className="text-xs text-muted">{conv.agent} · {conv.time}</p>
                  </div>
                  <ArrowRight size={14} color="var(--color-text-muted)" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* Relevant Schemes */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Relevant Schemes</h2>
              <Link to="/schemes" className="text-sm text-primary font-semibold">See all</Link>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {mockSchemes.map((sch, i) => (
                <Link
                  to="/schemes"
                  key={i}
                  className={`conv-item ${i < mockSchemes.length - 1 ? 'conv-item-border' : ''}`}
                >
                  <div className="conv-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                    <BookOpen size={14} aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{sch.name}</p>
                    <p className="text-xs text-muted">{sch.authority} · {sch.relevance}</p>
                  </div>
                  <ArrowRight size={14} color="var(--color-text-muted)" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
