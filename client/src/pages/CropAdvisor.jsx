import { useState } from 'react'
import { getCropRecommendations } from '../api/crop.api.js'
import { mockSoilTypes, mockSeasons, mockCrops, mockIrrigationTypes, mockObjectives } from '../mocks/crop.mock.js'
import PageHeader from '../components/common/PageHeader.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import { Sprout, ChevronDown, ChevronUp, Award, Droplets, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import './CropAdvisor.css'

const indianStates = ['Andhra Pradesh','Assam','Bihar','Gujarat','Haryana','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal']

const initialForm = {
  state: '',
  district: '',
  farmArea: '',
  areaUnit: 'acres',
  soilType: '',
  irrigation: '',
  season: '',
  sowingMonth: '',
  currentCrop: '',
  previousCrop: '',
  budget: '',
  waterAvailability: '',
  objective: 'balanced'
}

function RecommendationCard({ rec, expanded, onToggle }) {
  const badgeClass = { success: 'badge-success', info: 'badge-info', warning: 'badge-warning' }[rec.suitabilityColor] ?? 'badge-neutral'

  return (
    <div className="rec-card card">
      <div className="rec-card-header" onClick={onToggle} role="button" tabIndex={0} aria-expanded={expanded}
           onKeyDown={e => e.key === 'Enter' && onToggle()}>
        <div className="rec-rank">#{rec.rank}</div>
        <div className="rec-info">
          <div className="rec-title-row">
            <h3 className="rec-crop-name">{rec.crop}</h3>
            <span className={`badge ${badgeClass}`}>{rec.suitabilityLabel}</span>
          </div>
          <p className="text-sm text-muted">{rec.variety}</p>
        </div>
        <div className="rec-score">
          <div className="score-ring" style={{ '--pct': `${rec.suitabilityScore}%` }} aria-hidden="true">
            <span>{rec.suitabilityScore}</span>
          </div>
        </div>
        <div className="rec-toggle-icon">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>
      {expanded && (
        <div className="rec-card-body">
          <div className="rec-meta-row">
            <span className="rec-meta-item"><Droplets size={13} aria-hidden="true" /> Water: {rec.waterRequirement}</span>
            <span className="rec-meta-item"><Award size={13} aria-hidden="true" /> Duration: {rec.duration}</span>
            <span className="rec-meta-item"><Sprout size={13} aria-hidden="true" /> Rotation: {rec.rotationFit}</span>
          </div>
          <div className="rec-section">
            <p className="rec-section-label">Why this crop?</p>
            <ul className="rec-list">
              {(rec.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rec-section">
            <p className="rec-section-label rec-section-label-warning"><AlertTriangle size={12} aria-hidden="true" /> Key Risks</p>
            <ul className="rec-list rec-list-warning">
              {(rec.risks ?? []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="rec-section">
            <p className="rec-section-label"><TrendingUp size={12} aria-hidden="true" /> Market Observation</p>
            <p className="text-sm text-secondary">{rec.marketObservation}</p>
          </div>
          <div className="rec-sources">
            {(rec.evidenceSources ?? []).map((s, i) => (
              <span key={i} className="badge badge-neutral text-xs">{s}</span>
            ))}
          </div>
          <div className="disclaimer-note">
            <Info size={12} aria-hidden="true" />
            Recommendations are based on general agricultural knowledge and demo data. Always consult a local agronomist before finalising crop selection.
          </div>
        </div>
      )}
    </div>
  )
}

export default function CropAdvisor() {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.state) e.state = 'Please select a state'
    if (!form.soilType) e.soilType = 'Please select soil type'
    if (!form.season) e.season = 'Please select a season'
    if (!form.irrigation) e.irrigation = 'Please select irrigation type'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setResults(null)
    try {
      const res = await getCropRecommendations(form)
      setResults(res.data)
    } finally {
      setLoading(false)
    }
  }

  const [expanded, setExpanded] = useState(0)

  return (
    <div>
      <PageHeader title="Crop Advisor" description="Get evidence-based crop recommendations tailored to your farm conditions and objectives." />

      <div className="crop-layout">
        {/* Form */}
        <form className="crop-form card" onSubmit={handleSubmit} noValidate aria-label="Crop recommendation form">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sprout size={16} color="var(--color-primary)" aria-hidden="true" />
              <span style={{ fontWeight: 700 }}>Farm Details</span>
            </div>
            <DemoDataBadge />
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Location */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">Location</legend>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="state">State <span className="required">*</span></label>
                  <select id="state" className={`form-control ${errors.state ? 'error' : ''}`} value={form.state} onChange={e => set('state', e.target.value)}>
                    <option value="">Select state</option>
                    {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <span className="form-error">{errors.state}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="district">District</label>
                  <input id="district" className="form-control" value={form.district} onChange={e => set('district', e.target.value)} placeholder="e.g. Nashik" />
                </div>
              </div>
            </fieldset>

            {/* Farm */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">Farm</legend>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="soilType">Soil Type <span className="required">*</span></label>
                  <select id="soilType" className={`form-control ${errors.soilType ? 'error' : ''}`} value={form.soilType} onChange={e => set('soilType', e.target.value)}>
                    <option value="">Select soil type</option>
                    {mockSoilTypes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.soilType && <span className="form-error">{errors.soilType}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="irrigation">Irrigation <span className="required">*</span></label>
                  <select id="irrigation" className={`form-control ${errors.irrigation ? 'error' : ''}`} value={form.irrigation} onChange={e => set('irrigation', e.target.value)}>
                    <option value="">Select type</option>
                    {mockIrrigationTypes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.irrigation && <span className="form-error">{errors.irrigation}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="farmArea">Farm Area</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="farmArea" className="form-control" type="number" min="0" value={form.farmArea} onChange={e => set('farmArea', e.target.value)} placeholder="e.g. 4.5" style={{ flex: 2 }} />
                    <select className="form-control" value={form.areaUnit} onChange={e => set('areaUnit', e.target.value)} style={{ flex: 1 }}>
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                      <option value="bigha">Bigha</option>
                    </select>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Season */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">Season</legend>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="season">Season <span className="required">*</span></label>
                  <select id="season" className={`form-control ${errors.season ? 'error' : ''}`} value={form.season} onChange={e => set('season', e.target.value)}>
                    <option value="">Select season</option>
                    {mockSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.season && <span className="form-error">{errors.season}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="sowingMonth">Planned Sowing Month</label>
                  <select id="sowingMonth" className="form-control" value={form.sowingMonth} onChange={e => set('sowingMonth', e.target.value)}>
                    <option value="">Select month</option>
                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* History */}
            <fieldset className="form-fieldset">
              <legend className="form-legend">Crop History</legend>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="currentCrop">Current / Recent Crop</label>
                  <select id="currentCrop" className="form-control" value={form.currentCrop} onChange={e => set('currentCrop', e.target.value)}>
                    <option value="">Select crop</option>
                    {mockCrops.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="previousCrop">Previous Crop</label>
                  <select id="previousCrop" className="form-control" value={form.previousCrop} onChange={e => set('previousCrop', e.target.value)}>
                    <option value="">Select crop</option>
                    {mockCrops.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Objective */}
            <div className="form-group">
              <label className="form-label">Recommendation Objective</label>
              <div className="objective-grid">
                {mockObjectives.map(obj => (
                  <label key={obj.value} className={`objective-option ${form.objective === obj.value ? 'selected' : ''}`}>
                    <input type="radio" name="objective" value={obj.value} checked={form.objective === obj.value} onChange={e => set('objective', e.target.value)} />
                    {obj.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <><LoadingSpinner size="sm" /> Analysing...</> : <><Sprout size={16} /> Get Recommendations</>}
            </button>
          </div>
        </form>

        {/* Results */}
        <div className="crop-results">
          {!results && !loading && (
            <div className="card crop-results-empty">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <Sprout size={40} color="var(--color-text-muted)" aria-hidden="true" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ marginBottom: 8 }}>Fill in your farm details</h3>
                <p className="text-secondary text-sm">Your crop recommendations will appear here with suitability scores, evidence and risk analysis.</p>
              </div>
            </div>
          )}
          {loading && <LoadingSpinner fullPage text="Analysing your farm profile and crop suitability..." />}
          {results && (
            <>
              <div className="results-header">
                <h2>Recommendations for {form.state || 'your farm'}</h2>
                <DemoDataBadge />
              </div>
              {(results.recommendations ?? []).map((rec, i) => (
                <RecommendationCard
                  key={rec.rank ?? i}
                  rec={rec}
                  expanded={expanded === i}
                  onToggle={() => setExpanded(expanded === i ? null : i)}
                />
              ))}
              {/* Comparison table */}
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Crop Comparison</h3></div>
                <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Crop</th>
                        <th>Suitability</th>
                        <th>Water Need</th>
                        <th>Risk Level</th>
                        <th>Rotation Fit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(results.recommendations ?? []).map((rec, idx) => {
                        const risksLen = (rec.risks ?? []).length;
                        return (
                        <tr key={rec.crop ?? idx}>
                          <td style={{ fontWeight: 600 }}>{rec.crop}</td>
                          <td><span className={`badge ${rec.suitabilityColor === 'success' ? 'badge-success' : rec.suitabilityColor === 'info' ? 'badge-info' : 'badge-warning'}`}>{rec.suitabilityScore}/100</span></td>
                          <td>{rec.waterRequirement}</td>
                          <td>{risksLen <= 1 ? 'Low' : risksLen === 2 ? 'Moderate' : 'Higher'}</td>
                          <td>{rec.rotationFit}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
