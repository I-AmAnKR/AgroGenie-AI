import { useState, useRef } from 'react'
import { Upload, X, Camera, Microscope, AlertTriangle, CheckCircle, Phone } from 'lucide-react'
import { analyzeDisease } from '../api/disease.api.js'
import { mockCropsForDisease, mockPlantParts } from '../mocks/disease.mock.js'
import PageHeader from '../components/common/PageHeader.jsx'
import DemoDataBadge from '../components/common/DemoDataBadge.jsx'
import LoadingSpinner from '../components/common/LoadingSpinner.jsx'
import ConfidenceBadge from '../components/common/ConfidenceBadge.jsx'
import SourceCard from '../components/common/SourceCard.jsx'
import '../components/common/SourcePanel.css'
import './Disease.css'

export default function Disease() {
  // eslint-disable-next-line no-unused-vars
  const [image, setImage] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [crop, setCrop] = useState('')
  const [plantPart, setPlantPart] = useState('')
  const [symptoms, setSymptoms] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImage(file)
    setImageUrl(URL.createObjectURL(file))
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleAnalyze = async () => {
    if (!crop) return
    setLoading(true)
    setResult(null)
    try {
      const res = await analyzeDisease({
        crop,
        plantPart,
        symptomDescription: symptoms,
      })
      setResult(res.data)
    } finally {
      setLoading(false)
    }
  }

  const clearImage = () => {
    setImage(null)
    setImageUrl(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <PageHeader title="Plant Disease Advisory" description="Upload a plant photo for symptom identification and general prevention guidance." />

      <div className="disease-layout">
        {/* Upload panel */}
        <div className="disease-upload-panel">
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Camera size={16} color="var(--color-primary)" aria-hidden="true" />
                <span style={{ fontWeight: 700 }}>Image Upload</span>
              </div>
              <DemoDataBadge />
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                className={`upload-zone ${dragging ? 'upload-zone-drag' : ''} ${imageUrl ? 'upload-zone-filled' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !imageUrl && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={imageUrl ? 'Image uploaded' : 'Click or drag to upload image'}
                onKeyDown={e => e.key === 'Enter' && !imageUrl && fileInputRef.current?.click()}
              >
                {imageUrl ? (
                  <div className="upload-preview">
                    <img src={imageUrl} alt="Uploaded plant photo" className="upload-img" />
                    <button
                      className="upload-clear btn btn-danger btn-sm"
                      onClick={e => { e.stopPropagation(); clearImage() }}
                      aria-label="Remove image"
                    >
                      <X size={13} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="upload-empty">
                    <Upload size={28} color="var(--color-text-muted)" aria-hidden="true" />
                    <p style={{ fontWeight: 600 }}>Drag & drop or click to upload</p>
                    <p className="text-sm text-muted">JPEG, PNG, WebP — max 10MB</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} aria-hidden="true" />

              <div className="form-group">
                <label className="form-label" htmlFor="dis-crop">Crop <span className="required">*</span></label>
                <select id="dis-crop" className="form-control" value={crop} onChange={e => setCrop(e.target.value)}>
                  <option value="">Select crop</option>
                  {mockCropsForDisease.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="plant-part">Affected Plant Part</label>
                <select id="plant-part" className="form-control" value={plantPart} onChange={e => setPlantPart(e.target.value)}>
                  <option value="">Select part</option>
                  {mockPlantParts.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="symptoms">Describe visible symptoms</label>
                <textarea id="symptoms" className="form-control" value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="e.g. Yellow patches on leaves, white fuzzy growth on underside, wilting..." rows={3} />
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={handleAnalyze}
                disabled={!crop || loading}
              >
                {loading ? <><LoadingSpinner size="sm" /> Analysing Image...</> : <><Microscope size={16} /> Analyse Plant</>}
              </button>

              <div className="disease-warning">
                <AlertTriangle size={13} color="var(--color-warning)" aria-hidden="true" />
                <p className="text-xs text-muted">
                  This tool provides general information only. Do not apply pesticides based solely on this output.
                  Always consult a licensed agronomist.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Result panel */}
        <div className="disease-result-panel">
          {!result && !loading && (
            <div className="card" style={{ height: '100%', minHeight: 300 }}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '48px 24px' }}>
                <Microscope size={40} color="var(--color-text-muted)" aria-hidden="true" style={{ marginBottom: 12 }} />
                <h3 style={{ marginBottom: 8 }}>Upload a plant photo</h3>
                <p className="text-sm text-secondary">Select a clear, well-lit photo of the affected plant part and click Analyse Plant to get a diagnostic overview.</p>
              </div>
            </div>
          )}

          {loading && <LoadingSpinner fullPage text="Analysing plant symptoms..." />}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Condition */}
              <div className="card">
                <div className="card-body disease-condition-row">
                  <div>
                    <p className="text-xs text-muted" style={{ marginBottom: 4 }}>Possible Condition</p>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8 }}>{result.condition}</h2>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <ConfidenceBadge confidence={result.confidence} />
                      <DemoDataBadge label="Demo Analysis" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Symptoms */}
              <div className="card">
                <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Observed Symptom Patterns</h3></div>
                <div className="card-body">
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.observedSymptoms.map((s, i) => (
                      <li key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', listStyle: 'disc' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Checks */}
              <div className="card">
                <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Recommended Next Checks</h3></div>
                <div className="card-body">
                  {result.recommendedChecks.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < result.recommendedChecks.length - 1 ? 10 : 0 }}>
                      <CheckCircle size={15} color="var(--color-info)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                      <p className="text-sm text-secondary">{c}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention */}
              <div className="card">
                <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.9375rem' }}>General Prevention Guidance</h3></div>
                <div className="card-body">
                  <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.generalPrevention.map((p, i) => (
                      <li key={i} style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', listStyle: 'disc' }}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Expert contact */}
              <div className="card disease-expert-card">
                <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <Phone size={16} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>When to Contact an Agriculture Expert</p>
                    <p className="text-sm text-secondary">{result.whenToContactExpert}</p>
                  </div>
                </div>
              </div>

              {/* Sources */}
              <div className="card">
                <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.9375rem' }}>Information Sources</h3></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.sources.map((s, i) => <SourceCard key={i} source={s} />)}
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ background: 'var(--color-warning-bg)', border: '1px solid #fcd34d', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={15} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                <p style={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>{result.disclaimer}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
