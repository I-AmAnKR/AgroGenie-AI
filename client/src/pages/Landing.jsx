import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare, Sprout, CloudSun, TrendingUp, BookOpen, Bug,
  ArrowRight, Zap, ChevronRight, Leaf, CheckCircle, Shield,
  LayoutDashboard, User, Menu, X
} from 'lucide-react'
import './Landing.css'

const capabilities = [
  { icon: MessageSquare, title: 'AI Farming Assistant', desc: 'Conversational advisor with agricultural knowledge, crop guidance, and market awareness.', color: 'var(--color-primary)', path: '/chat' },
  { icon: Sprout, title: 'Smart Crop Recommendation', desc: 'Soil, season, location, and objective-aware crop recommendations with evidence.', color: '#2d9d6e', path: '/crop-advisor' },
  { icon: CloudSun, title: 'Weather Intelligence', desc: 'Local forecasts translated into actionable farming impact guidance.', color: '#3b82f6', path: '/weather' },
  { icon: TrendingUp, title: 'Mandi Market Insights', desc: 'Current prices from major mandis to support selling and planning decisions.', color: '#f59e0b', path: '/market' },
  { icon: BookOpen, title: 'Government Scheme Discovery', desc: 'Relevant central and state schemes matched to your farm profile.', color: '#8b5cf6', path: '/schemes' },
  { icon: Bug, title: 'Plant Disease Advisory', desc: 'Photo-based identification with symptom analysis and prevention guidance.', color: '#ef4444', path: '/disease' },
]

const trustPoints = [
  'Which data was used to generate this recommendation',
  'Which AI agents were involved',
  'Which documents or sources were consulted',
  'How fresh the live information is',
  'What information is missing or uncertain',
]

const processSteps = [
  { label: 'Your Question', desc: 'Natural language or structured input', icon: MessageSquare },
  { label: 'AI Agent Router', desc: 'Intent classification and agent selection', icon: Zap },
  { label: 'Specialist Tools', desc: 'Weather, Market, Knowledge Base, Crop Data', icon: Shield },
  { label: 'Llama Reasoning', desc: 'Evidence-based synthesis and explanation', icon: Leaf },
  { label: 'Your Recommendation', desc: 'With sources, confidence, and evidence', icon: CheckCircle },
]

const drawerNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { path: '/chat', label: 'AI Assistant', icon: MessageSquare, section: 'overview', badge: 'AI' },
  { path: '/crop-advisor', label: 'Crop Advisor', icon: Sprout, section: 'tools' },
  { path: '/weather', label: 'Weather Intelligence', icon: CloudSun, section: 'tools' },
  { path: '/market', label: 'Mandi Market', icon: TrendingUp, section: 'tools' },
  { path: '/schemes', label: 'Gov. Schemes', icon: BookOpen, section: 'tools' },
  { path: '/disease', label: 'Disease Advisory', icon: Bug, section: 'tools' },
  { path: '/profile', label: 'Farmer Profile', icon: User, section: 'account' },
]

const drawerSections = [
  { key: 'overview', label: 'Overview' },
  { key: 'tools', label: 'Intelligence Tools' },
  { key: 'account', label: 'Account' },
]

export default function Landing() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="landing">

      {/* Features Drawer */}
      {drawerOpen && (
        <div
          className="landing-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`landing-drawer ${drawerOpen ? 'landing-drawer-open' : ''}`} aria-label="Features navigation">
        <div className="landing-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo"><Leaf size={16} /></div>
            <span className="landing-drawer-brand">AgroGenie AI</span>
          </div>
          <button className="landing-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <nav className="landing-drawer-nav">
          {drawerSections.map(section => (
            <div key={section.key} className="landing-drawer-section">
              <span className="landing-drawer-section-label">{section.label}</span>
              {drawerNavItems.filter(i => i.section === section.key).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="landing-drawer-item"
                  onClick={() => setDrawerOpen(false)}
                >
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge && <span className="landing-drawer-badge">{item.badge}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="landing-drawer-footer">
          <div className="ibm-badge">
            <Zap size={13} aria-hidden="true" />
            <span>Powered by Llama</span>
          </div>
          <p className="sidebar-footer-note">Demo Mode — Mock Data</p>
        </div>
      </aside>

      {/* Menu button */}
      <button
        className="landing-menu-btn"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open features menu"
        aria-expanded={drawerOpen}
      >
        <Menu size={22} />
      </button>

      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-content">
            <span className="hero-eyebrow">
              <Zap size={13} aria-hidden="true" />
              Llama · Agentic AI · Smart Agriculture
            </span>
            <h1 className="hero-title">
              Smarter Farming Decisions,<br />
              <span className="hero-title-accent">Powered by AI</span>
            </h1>
            <p className="hero-subtitle">
              AgroGenie AI combines agricultural knowledge, local weather intelligence, market information
              and personalised recommendations to support better farming decisions — explained with evidence.
            </p>
            <div className="hero-actions">
              <Link to="/chat" className="btn btn-primary btn-lg hero-cta-primary">
                Ask AgroGenie
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-lg">
                Explore Dashboard
              </Link>
            </div>
            <div className="hero-trust">
              <span className="ibm-badge-hero">
                <Zap size={12} />
                Powered by Llama
              </span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-card-stack">
              <div className="hcard hcard-1">
                <div className="hcard-icon"><Sprout size={18} /></div>
                <div>
                  <p className="hcard-label">Top Recommendation</p>
                  <p className="hcard-value">Onion (Rabi)</p>
                  <p className="hcard-sub">Suitability: 92/100</p>
                </div>
              </div>
              <div className="hcard hcard-2">
                <div className="hcard-icon hcard-icon-blue"><CloudSun size={18} /></div>
                <div>
                  <p className="hcard-label">Weather Today</p>
                  <p className="hcard-value">24°C · Partly Cloudy</p>
                  <p className="hcard-sub">Rain probability: 30%</p>
                </div>
              </div>
              <div className="hcard hcard-3">
                <div className="hcard-icon hcard-icon-amber"><TrendingUp size={18} /></div>
                <div>
                  <p className="hcard-label">Onion — Lasalgaon</p>
                  <p className="hcard-value">₹1,750/quintal</p>
                  <p className="hcard-sub">↑ 8% from last week</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="section section-light">
        <div className="section-inner">
          <div className="section-header">
            <h2>Comprehensive Farming Intelligence</h2>
            <p>Six specialised AI tools working together, each backed by agricultural knowledge and live data.</p>
          </div>
          <div className="capability-grid">
            {capabilities.map(cap => (
              <Link to={cap.path} key={cap.title} className="cap-card">
                <div className="cap-icon" style={{ background: `${cap.color}18` }}>
                  <cap.icon size={22} color={cap.color} aria-hidden="true" />
                </div>
                <h3 className="cap-title">{cap.title}</h3>
                <p className="cap-desc">{cap.desc}</p>
                <span className="cap-link">
                  Learn more <ChevronRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <div className="section-inner">
          <div className="section-header">
            <h2>How AgroGenie Works</h2>
            <p>Your question triggers a chain of specialised AI agents — each contributing expert knowledge.</p>
          </div>
          <div className="process-flow">
            {processSteps.map((step, i) => (
              <div key={i} className="process-step-wrapper">
                <div className="process-step">
                  <div className="process-step-icon">
                    <step.icon size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="process-step-label">{step.label}</p>
                    <p className="process-step-desc">{step.desc}</p>
                  </div>
                </div>
                {i < processSteps.length - 1 && (
                  <div className="process-arrow" aria-hidden="true">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Explainability */}
      <section className="section section-light">
        <div className="section-inner">
          <div className="trust-row">
            <div className="trust-text">
              <span className="section-eyebrow">Transparent by Design</span>
              <h2>Every recommendation explains itself</h2>
              <p>
                AgroGenie does not give you a black-box answer. Every response can show you exactly:
              </p>
              <ul className="trust-list">
                {trustPoints.map((pt, i) => (
                  <li key={i}>
                    <CheckCircle size={16} color="var(--color-success)" aria-hidden="true" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className="trust-demo card">
              <div className="card-header">
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Why this recommendation?</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p className="trust-demo-label">Agents used</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {['Agent Router', 'Crop Advisor', 'Weather Agent', 'Knowledge Retrieval'].map(a => (
                      <span key={a} style={{ fontSize: '0.75rem', background: 'var(--color-primary-100)', color: 'var(--color-primary-dark)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{a}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="trust-demo-label">Data considered</p>
                  <ul style={{ paddingLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {['Loamy soil, Nashik, 4.5 acres', 'Drip irrigation available', 'Rabi season window', 'Current modal price ₹1,750/qt'].map((d, i) => (
                      <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', listStyle: 'disc' }}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="trust-demo-label">Sources</p>
                  <div style={{ background: 'var(--color-surface-2)', borderRadius: 6, padding: '8px 10px', fontSize: '0.8125rem' }}>
                    ICAR Kharif Crop Production Guide 2023 · Maharashtra Agri Dept.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="section-inner cta-inner">
          <h2>Ready to make better farming decisions?</h2>
          <p>Start by asking a question about your crops, weather, mandi prices or available government schemes.</p>
          <div className="cta-actions">
            <Link to="/chat" className="btn btn-accent btn-lg">
              Ask AgroGenie
              <ArrowRight size={18} />
            </Link>
            <Link to="/dashboard" className="btn btn-secondary btn-lg">
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="section-inner footer-inner">
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="sidebar-logo"><Leaf size={16} /></div>
              <span style={{ fontWeight: 700 }}>AgroGenie AI</span>
            </div>
            <p>IBM SkillsBuild AICTE 2026 · Agentic AI Smart Farming Advisor</p>
          </div>
          <p className="footer-disclaimer">
            Demo mode — all data is simulated for development. No real agricultural, financial or medical advice is being provided.
            Always consult qualified agronomists, extension officers, or the responsible government authority for actual decisions.
          </p>
        </div>
      </footer>
    </div>
  )
}
