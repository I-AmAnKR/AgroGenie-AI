import { useEffect, useState } from 'react'
import { CloudSun, Wind, Droplets, Eye, MapPin, RefreshCw, AlertTriangle, CheckCircle, XCircle, MinusCircle } from 'lucide-react'
import { getCurrentWeather, getForecast, getFarmingImpact } from '../api/weather.api.js'
import PageHeader from '../components/common/PageHeader.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import FreshnessIndicator from '../components/common/FreshnessIndicator.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import ErrorMessage from '../components/common/ErrorMessage.jsx'
import { useFarmer } from '../context/FarmerContext.jsx'
import './Weather.css'

const conditionIcons = { sunny: '☀️', 'partly-cloudy': '⛅', overcast: '☁️', rain: '🌧', showers: '🌦', cloudy: '☁️' }

const impactStatusIcon = { good: CheckCircle, caution: MinusCircle, poor: XCircle }
const impactStatusColor = { good: 'var(--color-success)', caution: 'var(--color-warning)', poor: 'var(--color-danger)' }

export default function Weather() {
  const { profile } = useFarmer()
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState([])
  const [impacts, setImpacts] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [location] = useState(profile?.location?.district ? `${profile.location.district}, ${profile.location.state}` : 'Nashik, Maharashtra')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const coords = profile?.location?.coordinates ?? { lat: 19.847, lon: 73.998 }
      const [w, f, i] = await Promise.all([
  getCurrentWeather(coords.lat, coords.lon),
  getForecast(coords.lat, coords.lon),
  getFarmingImpact(
    coords.lat,
    coords.lon,
    profile?.currentCrop
  )
])
      console.log("Weather Response:", w);
      console.log("Forecast Response:", f);
      console.log("Advice Response:", i);
      
      setWeather(w.data.current)
      setForecast(f.data.forecast)
      setImpacts(i.data.impacts)
      setAlerts(i.data.alerts)
    } catch {
      setError('Unable to load weather data.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  if (loading) return <LoadingSpinner fullPage text="Loading weather intelligence..." />
  if (error) return <ErrorMessage message={error} onRetry={load} />

  return (
    <div>
      <PageHeader title="Weather Intelligence" description="Local weather conditions translated into actionable farming guidance.">
        <button className="btn btn-secondary btn-sm" onClick={load} aria-label="Refresh weather">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      {/* Location & freshness */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={15} color="var(--color-primary)" aria-hidden="true" />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{location}</span>
          <DemoDataBadge />
        </div>
        <FreshnessIndicator
  timestamp={weather?.metadata?.fetchedAt ?? weather?.source?.fetchedAt}
  source={weather?.metadata?.provider ?? weather?.source?.provider}
/>
      </div>

      {/* Weather alerts */}
      {alerts.map(alert => (
        <div key={alert.id} className="weather-alert">
          <AlertTriangle size={16} color="var(--color-warning)" aria-hidden="true" />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alert.title}</p>
            <p className="text-sm text-secondary">{alert.message}</p>
            <p className="text-xs text-muted">Valid until: {alert.validUntil} · {alert.source}</p>
          </div>
        </div>
      ))}

      {/* Current conditions */}
      <div className="weather-current card">
        <div className="card-body weather-current-inner">
          <div className="weather-main">
            <span className="weather-big-icon" aria-hidden="true">
              {conditionIcons[weather?.condition?.toLowerCase()] ?? "🌤"}
            </span>
            <div>
              <div className="weather-temp">{weather?.temperatureC}°C</div>
              <p className="weather-condition">{weather?.condition}</p>
              <p className="text-muted text-sm">Feels like {weather?.feelsLikeC}°C</p>
            </div>
          </div>
          <div className="weather-grid">
            <div className="weather-metric">
              <Droplets size={18} color="var(--color-info)" aria-hidden="true" />
              <div>
                <p className="weather-metric-label">Humidity</p>
                <p className="weather-metric-value">{weather?.humidityPercent}%</p>
              </div>
            </div>
            <div className="weather-metric">
              <Wind size={18} color="var(--color-text-muted)" aria-hidden="true" />
              <div>
                <p className="weather-metric-label">Wind</p>
                <p className="weather-metric-value">{weather?.windSpeedKph} km/h {weather?.windDirection}</p>
              </div>
            </div>
            <div className="weather-metric">
              <CloudSun size={18} color="var(--color-warning)" aria-hidden="true" />
              <div>
                <p className="weather-metric-label">Rain Today</p>
                <p className="weather-metric-value">
                    {forecast?.[0]?.precipitationProbabilityPercent ?? 0}%
                </p>
              </div>
            </div>
            <div className="weather-metric">
              <Eye size={18} color="var(--color-text-muted)" aria-hidden="true" />
              <div>
                <p className="weather-metric-label">Rainfall</p>
                  <p className="weather-metric-value">
                    {weather?.precipitationMm ?? 0} mm
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>7-Day Forecast</h2>
          <DemoDataBadge />
        </div>
        <div className="card-body forecast-row">
          {forecast.map(day => (
            <div key={day.date} className={`forecast-card ${day.precipitationProbabilityPercent  > 60 ? 'forecast-card-rain' : ''}`}>
              <p className="forecast-card-day">{new Date(day.date).toLocaleDateString('en-IN', {
  weekday: 'short'
})}</p>
              <span className="forecast-card-icon" aria-hidden="true">{conditionIcons[day.conditionCode] ?? '🌤'}</span>
              <div className="forecast-card-temps">
                <span className="forecast-hi">{day.maxTemperatureC}°</span>
                <span className="forecast-lo">{day.minTemperatureC}°</span>
              </div>
              <p className="forecast-card-rain">{day.precipitationProbabilityPercent}% rain</p>
            </div>
          ))}
        </div>
      </div>

      {/* Farming Impact */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Farming Impact Analysis</h2>
          <DemoDataBadge label="AI Analysis (Demo)" />
        </div>
        <div className="card-body impact-grid">
          {impacts.map(impact => {
            const Icon = impactStatusIcon[impact.status] ?? MinusCircle
            const color = impactStatusColor[impact.status] ?? 'var(--color-text-muted)'
            return (
              <div key={impact.category} className="impact-card">
                <div className="impact-header">
                  <Icon size={18} color={color} aria-hidden="true" />
                  <span className="impact-category">{impact.category}</span>
                  <span className={`badge ${impact.status === 'good' ? 'badge-success' : impact.status === 'caution' ? 'badge-warning' : 'badge-danger'}`}>{impact.label}</span>
                </div>
                <p className="text-sm text-secondary impact-detail">{impact.detail}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
