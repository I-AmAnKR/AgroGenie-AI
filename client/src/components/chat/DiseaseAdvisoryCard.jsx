import { ShieldAlert, Info, FileText, CloudRain, AlertTriangle, ShieldCheck } from 'lucide-react'
import './DiseaseAdvisoryCard.css'

export default function DiseaseAdvisoryCard({ disease }) {
  if (!disease) return null

  // Ensure we have the primary disease data extracted correctly
  // The structure from backend could be nested under primaryDisease if not unwrapped
  const data = disease.primaryDisease ? disease.primaryDisease : disease

  // the backend provides disease object inside data.disease
  const diseaseInfo = data.disease || data

  const confidenceLevel = data.confidenceLevel || 'Needs Expert Review'
  const progressionRisk = data.progressionRisk

  return (
    <div className="disease-advisory-card">
      <div className="disease-card-header">
        <div className="disease-card-title-area">
          <h3>
            <ShieldAlert size={16} />
            {diseaseInfo.name || 'Unknown Condition'}
          </h3>
          {diseaseInfo.diseaseCode && (
            <p className="disease-subtitle">Code: {diseaseInfo.diseaseCode}</p>
          )}
        </div>
      </div>

      {progressionRisk === 'HIGH' && (
        <div className="weather-risk-banner">
          <CloudRain size={16} />
          High Risk: Current weather conditions strongly favor disease spread.
        </div>
      )}

      {confidenceLevel === 'Needs Expert Review' && (
        <div className="weather-risk-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertTriangle size={16} />
          Low confidence in automated analysis. Please consult a local expert or agriculture extension worker.
        </div>
      )}

      <div className="disease-card-body">
        {diseaseInfo.treatment && (
          <div className="disease-section">
            <h4><ShieldCheck size={14} /> Treatment Actions</h4>
            <div className="treatment-grid">
              {diseaseInfo.treatment.immediateActions && (
                <div className="treatment-box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <h5 style={{ color: '#ef4444' }}>Immediate</h5>
                  <p>{diseaseInfo.treatment.immediateActions}</p>
                </div>
              )}
              {diseaseInfo.treatment.organicTreatment && (
                <div className="treatment-box" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
                  <h5 style={{ color: '#22c55e' }}>Organic</h5>
                  <p>{diseaseInfo.treatment.organicTreatment}</p>
                </div>
              )}
              {diseaseInfo.treatment.chemicalTreatment && (
                <div className="treatment-box" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                  <h5 style={{ color: '#3b82f6' }}>Chemical</h5>
                  <p>{diseaseInfo.treatment.chemicalTreatment}</p>
                </div>
              )}
              {diseaseInfo.treatment.culturalPractices && (
                <div className="treatment-box">
                  <h5 style={{ color: 'var(--text-secondary)' }}>Cultural Practices</h5>
                  <p>{diseaseInfo.treatment.culturalPractices}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {diseaseInfo.prevention && diseaseInfo.prevention.length > 0 && (
          <div className="disease-section">
            <h4><Info size={14} /> Prevention</h4>
            <ul className="disease-list">
              {diseaseInfo.prevention.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {data.supportingEvidence && data.supportingEvidence.length > 0 && (
          <div className="disease-section" style={{ marginTop: 8 }}>
            <h4><FileText size={14} /> Evidence</h4>
            <ul className="disease-list">
              {data.supportingEvidence.map((item, idx) => (
                <li key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
