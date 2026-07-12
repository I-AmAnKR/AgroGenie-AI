/**
 * SchemeCard — Phase 12.
 *
 * Displays a single evaluated government scheme record inline in the chat.
 * Used by the SchemeDataPanel in ChatMessage.jsx for SCHEME intent messages.
 *
 * Props:
 *   schemeData  — Single scheme object from result.scheme.schemes[]
 *                 { schemeCode, name, ministry, schemeLevel, status,
 *                   benefitsSummary, officialSourceUrl, applicationUrl,
 *                   applicationMode, requiredDocuments[], applicationSteps[],
 *                   eligibility: { status, matchedRules, unmatchedRules, missingInformation },
 *                   isDemo, stale, lastVerifiedAt }
 */
import { ExternalLink, CheckCircle, XCircle, AlertCircle, HelpCircle, FileText, List, Shield } from 'lucide-react'
import './SchemeCard.css'

// ── Eligibility status config ─────────────────────────────────────────────────

const ELIGIBILITY_CONFIG = {
  POTENTIALLY_ELIGIBLE: {
    icon: CheckCircle,
    label: 'Potentially Eligible',
    className: 'scheme-eligibility-eligible',
  },
  POTENTIALLY_NOT_ELIGIBLE: {
    icon: XCircle,
    label: 'Condition Not Met',
    className: 'scheme-eligibility-not-eligible',
  },
  MORE_INFORMATION_REQUIRED: {
    icon: HelpCircle,
    label: 'More Information Needed',
    className: 'scheme-eligibility-unknown',
  },
  RULES_NOT_MACHINE_VERIFIABLE: {
    icon: AlertCircle,
    label: 'Verify Manually',
    className: 'scheme-eligibility-manual',
  },
  SCHEME_STATUS_UNCERTAIN: {
    icon: AlertCircle,
    label: 'Status Uncertain',
    className: 'scheme-eligibility-uncertain',
  },
}

// ── Scheme level labels ───────────────────────────────────────────────────────

const LEVEL_LABELS = {
  CENTRAL: 'Central',
  STATE: 'State',
  DISTRICT: 'District',
  OTHER: 'Other',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SchemeCard({ schemeData }) {
  if (!schemeData) return null

  const {
    schemeCode,
    name,
    ministry,
    schemeLevel,
    benefitsSummary,
    officialSourceUrl,
    applicationUrl,
    eligibility,
    requiredDocuments = [],
    isDemo,
    stale,
    lastVerifiedAt,
  } = schemeData

  const eligibConfig = ELIGIBILITY_CONFIG[eligibility?.status] ?? ELIGIBILITY_CONFIG.RULES_NOT_MACHINE_VERIFIABLE
  const EligIcon = eligibConfig.icon
  const levelLabel = LEVEL_LABELS[schemeLevel] ?? schemeLevel

  // Format lastVerifiedAt as a readable date
  const verifiedDateStr = lastVerifiedAt
    ? new Date(lastVerifiedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })
    : null

  return (
    <div className={`scheme-card${isDemo ? ' scheme-card-demo' : ''}${stale ? ' scheme-card-stale' : ''}`}>
      {/* Header */}
      <div className="scheme-card-header">
        <div className="scheme-card-title-block">
          <Shield size={14} className="scheme-card-shield" aria-hidden="true" />
          <span className="scheme-card-name">{name}</span>
          <span className="scheme-card-level-badge">{levelLabel}</span>
        </div>
        {isDemo && <span className="scheme-card-demo-badge">Curated</span>}
      </div>

      {/* Ministry */}
      {ministry && (
        <div className="scheme-card-ministry">{ministry}</div>
      )}

      {/* Eligibility Status */}
      <div className={`scheme-card-eligibility ${eligibConfig.className}`}>
        <EligIcon size={13} aria-hidden="true" />
        <span className="scheme-eligibility-label">{eligibConfig.label}</span>
        {eligibility?.unmatchedRules?.length > 0 && (
          <span className="scheme-eligibility-note">
            {eligibility.unmatchedRules[0]?.explanation}
          </span>
        )}
        {eligibility?.missingInformation?.length > 0 && eligibility.status === 'MORE_INFORMATION_REQUIRED' && (
          <span className="scheme-eligibility-note">
            Needed: {eligibility.missingInformation.join(', ')}
          </span>
        )}
      </div>

      {/* Benefits */}
      {benefitsSummary && (
        <div className="scheme-card-benefits">
          <span className="scheme-card-section-label">Benefits:</span>
          <span className="scheme-card-benefits-text">{benefitsSummary}</span>
        </div>
      )}

      {/* Required documents (collapsed to first 3) */}
      {requiredDocuments.length > 0 && (
        <div className="scheme-card-docs">
          <div className="scheme-card-docs-header">
            <FileText size={12} aria-hidden="true" />
            <span className="scheme-card-section-label">Key Documents:</span>
          </div>
          <div className="scheme-card-docs-list">
            {requiredDocuments.slice(0, 3).map((doc, i) => (
              <span key={i} className="scheme-card-doc-chip">
                {doc.name}
                {doc.requiredStatus === 'conditional' && <span className="scheme-doc-optional">*</span>}
              </span>
            ))}
            {requiredDocuments.length > 3 && (
              <span className="scheme-card-doc-chip scheme-card-doc-more">
                +{requiredDocuments.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Verification date */}
      {verifiedDateStr && (
        <div className="scheme-card-verified">
          <List size={11} aria-hidden="true" />
          <span>
            Last verified: {verifiedDateStr}
            {stale && <span className="scheme-card-stale-label"> — may be outdated</span>}
          </span>
        </div>
      )}

      {/* Action links */}
      <div className="scheme-card-links">
        {officialSourceUrl && (
          <a
            id={`scheme-official-${schemeCode}`}
            href={officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="scheme-card-link scheme-card-link-primary"
          >
            <ExternalLink size={11} aria-hidden="true" />
            Official Portal
          </a>
        )}
        {applicationUrl && applicationUrl !== officialSourceUrl && (
          <a
            id={`scheme-apply-${schemeCode}`}
            href={applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="scheme-card-link"
          >
            <ExternalLink size={11} aria-hidden="true" />
            Apply
          </a>
        )}
      </div>

      {/* Disclaimer */}
      <div className="scheme-card-disclaimer">
        ⚠️ Eligibility shown is preliminary. Final determination by the competent authority only.
      </div>
    </div>
  )
}
