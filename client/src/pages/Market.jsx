import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Search } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getPrices, getPriceTrend } from '../api/market.api.js'
import { mockCommodities, mockStates } from '../mocks/market.mock.js'
import PageHeader from '../components/common/PageHeader.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import FreshnessIndicator from '../components/common/FreshnessIndicator.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import './Market.css'

function TrendBadge({ trend, pct }) {
  if (trend === 'up') return <span className="trend-badge trend-up"><TrendingUp size={12} /> +{pct}%</span>
  if (trend === 'down') return <span className="trend-badge trend-down"><TrendingDown size={12} /> {pct}%</span>
  return <span className="trend-badge trend-stable"><Minus size={12} /> Stable</span>
}

export default function Market() {
  const [filters, setFilters] = useState({ commodity: 'Onion', state: 'Maharashtra', district: '', market: '' })
  const [prices, setPrices] = useState([])
  const [trend, setTrend] = useState([])
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [p, t] = await Promise.all([
        getPrices(filters),
        getPriceTrend(filters.commodity, filters.market || 'Lasalgaon')
      ])
      setPrices(p.data.prices)
      setFetchedAt(p.data.source?.lastUpdated ?? p.data.fetchedAt ?? null)
      // Backend returns records; frontend mock returned trend — support both
      setTrend(t.data.records ?? t.data.trend ?? [])
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const handleFilter = () => load()

  const setF = (field, value) => setFilters(prev => ({ ...prev, [field]: value }))

  const topPrice = prices[0]

  return (
    <div>
      <PageHeader title="Mandi Market Prices" description="Current wholesale prices from major APMC markets. For planning reference only.">
        <button className="btn btn-secondary btn-sm" onClick={load} aria-label="Refresh prices">
          <RefreshCw size={14} /> Refresh
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="card market-filters">
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" htmlFor="commodity">Commodity</label>
            <select id="commodity" className="form-control" value={filters.commodity} onChange={e => setF('commodity', e.target.value)}>
              {mockCommodities.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" htmlFor="mstate">State</label>
            <select id="mstate" className="form-control" value={filters.state} onChange={e => setF('state', e.target.value)}>
              <option value="">All States</option>
              {mockStates.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 140 }}>
            <label className="form-label" htmlFor="mdistrict">District</label>
            <input id="mdistrict" className="form-control" placeholder="All districts" value={filters.district} onChange={e => setF('district', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleFilter} disabled={loading}>
            <Search size={15} /> Search
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <DemoDataBadge />
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner fullPage text="Fetching market prices..." /> : (
        <>
          {/* Summary */}
          {topPrice && (
            <div className="market-summary">
              <div className="market-highlight card">
                <div className="card-body market-highlight-inner">
                  <div>
                    <p className="market-highlight-label">{filters.commodity} — {topPrice.market}</p>
                    <p className="market-highlight-value">₹{topPrice.modalPrice.toLocaleString('en-IN')}</p>
                    <p className="text-sm text-muted">{topPrice.unit}</p>
                  </div>
                  <div>
                    <TrendBadge trend={topPrice.trend} pct={topPrice.trendPct} />
                    <p className="text-xs text-muted" style={{ marginTop: 8 }}>vs last week</p>
                  </div>
                </div>
              </div>
              <div className="market-obs card">
                <div className="card-body">
                  <p style={{ fontWeight: 700, marginBottom: 6 }}>Market Observation</p>
                  <p className="text-sm text-secondary">
                    {filters.commodity} prices in {filters.state || 'Maharashtra'} have shown a moderate upward movement over the past week.
                    Prices remain within the seasonal range. This observation is based on available market data and does not constitute a trading recommendation.
                  </p>
                  {fetchedAt && <div style={{ marginTop: 10 }}><FreshnessIndicator timestamp={fetchedAt} source="Agmarknet (Demo)" /></div>}
                </div>
              </div>
            </div>
          )}

          {/* Price trend chart */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                {filters.commodity} Price Trend — Past 7 Days
              </h2>
              <DemoDataBadge />
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v) => [`₹${v}/qt`, 'Modal Price']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="url(#mktGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Price table */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Nearby Market Comparison</h2>
            </div>
            {prices.length === 0 ? (
              <EmptyState title="No prices found" message="Try adjusting your filters." />
            ) : (
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Market</th>
                      <th>District</th>
                      <th>Min (₹)</th>
                      <th>Max (₹)</th>
                      <th>Modal (₹)</th>
                      <th>Trend</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.market}</td>
                        <td>{p.district}</td>
                        <td>{p.minPrice.toLocaleString('en-IN')}</td>
                        <td>{p.maxPrice.toLocaleString('en-IN')}</td>
                        <td style={{ fontWeight: 700 }}>{p.modalPrice.toLocaleString('en-IN')}</td>
                        <td><TrendBadge trend={p.trend} pct={p.trendPct} /></td>
                        <td>{p.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-footer">
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                Price data shown is for planning reference only. Do not make financial decisions based solely on this demonstration data.
                Actual prices vary. Source: Agmarknet (Demo Mode).
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
