import { useState, useEffect } from 'react'
import { User, Save, CheckCircle } from 'lucide-react'
import { updateProfile } from '../api/profile.api.js'
import { mockSoilTypes, mockIrrigationTypes, mockCrops, mockObjectives } from '../mocks/crop.mock.js'
import { useFarmer } from '../context/FarmerContext.jsx'
import PageHeader from '../components/common/PageHeader.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import './Profile.css'

const indianStates = ['Andhra Pradesh','Assam','Bihar','Gujarat','Haryana','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal']
const languages = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिंदी)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
  { value: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { value: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  { value: 'te', label: 'Telugu (తెలుగు)' },
  { value: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { value: 'ta', label: 'Tamil (தமிழ்)' },
]

export default function Profile() {
  const { profile: ctx, updateProfile: ctxUpdate } = useFarmer()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (ctx) {
      setForm({
        // Support both backend flat shape and legacy mock shape
        name: ctx.displayName ?? ctx.name ?? '',
        preferredLang: ctx.preferredLanguage ?? ctx.preferredLang ?? 'en',
        state: ctx.state ?? ctx.location?.state ?? '',
        district: ctx.district ?? ctx.location?.district ?? '',
        farmArea: ctx.farmArea ?? ctx.farm?.sizeAcres ?? '',
        areaUnit: ctx.farmAreaUnit ?? ctx.farm?.sizeUnit ?? 'acres',
        soilType: ctx.soilType ?? ctx.farm?.soilType ?? '',
        irrigationType: ctx.irrigationType ?? ctx.farm?.irrigationType ?? '',
        currentCrop: ctx.currentCrop ?? ctx.farm?.currentCrop ?? '',
        sowingDate: ctx.sowingDate ?? ctx.farm?.sowingDate ?? '',
        previousCrop: (ctx.previousCrops ?? [])[0] ?? ctx.farm?.previousCrop ?? '',
        objective: ctx.farmingObjective ?? ctx.objective ?? 'balanced',
      })
    }
  }, [ctx])

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
    setSaved(false)
  }

  const validate = () => {
    const e = {}
    if (!form.name?.trim()) e.name = 'Display name is required'
    return e
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      // Send flat shape matching backend profile structure
      const payload = {
        displayName: form.name,
        preferredLanguage: form.preferredLang,
        state: form.state,
        district: form.district,
        farmArea: parseFloat(form.farmArea) || null,
        farmAreaUnit: form.areaUnit,
        soilType: form.soilType,
        irrigationType: form.irrigationType,
        currentCrop: form.currentCrop,
        sowingDate: form.sowingDate,
        previousCrops: form.previousCrop ? [form.previousCrop] : [],
        farmingObjective: form.objective,
      }
      const res = await updateProfile(payload)
      ctxUpdate(res.data)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <LoadingSpinner fullPage text="Loading profile..." />

  return (
    <div>
      <PageHeader title="Farmer Profile" description="Your farm context helps AgroGenie provide more relevant recommendations." />

      {/* Context explanation */}
      <div className="profile-context-note card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <User size={18} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <p className="text-sm text-secondary">
            Your farm context helps AgroGenie provide more relevant crop recommendations, weather interpretation, and scheme matching.
            You can update or remove this information at any time. No data is transmitted to any external service in demo mode.
          </p>
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave} noValidate aria-label="Farmer profile form">
        <div className="profile-grid">
          {/* Personal */}
          <section className="card profile-section">
            <div className="card-header">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Personal Preferences</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pname">Display Name <span className="required">*</span></label>
                <input id="pname" className={`form-control ${errors.name ? 'error' : ''}`} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="plang">Preferred Language</label>
                <select id="plang" className="form-control" value={form.preferredLang} onChange={e => set('preferredLang', e.target.value)}>
                  {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <p className="form-hint">Multilingual responses will be available in a future phase.</p>
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="card profile-section">
            <div className="card-header">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Farm Location</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pstate">State</label>
                <select id="pstate" className="form-control" value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select state</option>
                  {indianStates.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pdistrict">District</label>
                <input id="pdistrict" className="form-control" value={form.district} onChange={e => set('district', e.target.value)} placeholder="e.g. Nashik" />
              </div>
            </div>
          </section>

          {/* Farm Info */}
          <section className="card profile-section">
            <div className="card-header">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Farm Information</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="parea">Farm Area</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="parea" type="number" min="0" step="0.1" className="form-control" value={form.farmArea} onChange={e => set('farmArea', e.target.value)} placeholder="e.g. 4.5" style={{ flex: 2 }} />
                  <select className="form-control" value={form.areaUnit} onChange={e => set('areaUnit', e.target.value)} style={{ flex: 1 }}>
                    <option value="acres">Acres</option>
                    <option value="hectares">Hectares</option>
                    <option value="bigha">Bigha</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="psoil">Soil Type</label>
                <select id="psoil" className="form-control" value={form.soilType} onChange={e => set('soilType', e.target.value)}>
                  <option value="">Select soil type</option>
                  {mockSoilTypes.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pirrigation">Irrigation Type</label>
                <select id="pirrigation" className="form-control" value={form.irrigationType} onChange={e => set('irrigationType', e.target.value)}>
                  <option value="">Select type</option>
                  {mockIrrigationTypes.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Crop Context */}
          <section className="card profile-section">
            <div className="card-header">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Crop Context</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pcurrentcrop">Current Crop</label>
                <select id="pcurrentcrop" className="form-control" value={form.currentCrop} onChange={e => set('currentCrop', e.target.value)}>
                  <option value="">Select crop</option>
                  {mockCrops.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="psowing">Sowing Date</label>
                <input id="psowing" type="date" className="form-control" value={form.sowingDate} onChange={e => set('sowingDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="pprev">Previous Crop</label>
                <select id="pprev" className="form-control" value={form.previousCrop} onChange={e => set('previousCrop', e.target.value)}>
                  <option value="">Select crop</option>
                  {mockCrops.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Objective */}
          <section className="card profile-section">
            <div className="card-header">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Farming Objective</h2>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mockObjectives.map(obj => (
                <label key={obj.value} className={`profile-obj-option ${form.objective === obj.value ? 'selected' : ''}`}>
                  <input type="radio" name="pobjective" value={obj.value} checked={form.objective === obj.value} onChange={e => set('objective', e.target.value)} />
                  <span>{obj.label}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Save */}
        <div className="profile-save-row">
          {saved && (
            <span className="profile-saved-msg">
              <CheckCircle size={15} color="var(--color-success)" aria-hidden="true" />
              Profile saved (demo mode — not persisted)
            </span>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><LoadingSpinner size="sm" /> Saving...</> : <><Save size={15} /> Save Profile</>}
          </button>
        </div>
      </form>
    </div>
  )
}
