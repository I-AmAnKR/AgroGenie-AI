import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Sprout, CloudSun,
  TrendingUp, BookOpen, Bug, User, Leaf, Zap, Database
} from 'lucide-react'
import './Sidebar.css'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'main' },
  { path: '/chat', label: 'AI Assistant', icon: MessageSquare, section: 'main', badge: 'AI' },
  { path: '/crop-advisor', label: 'Crop Advisor', icon: Sprout, section: 'tools' },
  { path: '/weather', label: 'Weather Intelligence', icon: CloudSun, section: 'tools' },
  { path: '/market', label: 'Mandi Market', icon: TrendingUp, section: 'tools' },
  { path: '/schemes', label: 'Gov. Schemes', icon: BookOpen, section: 'tools' },
  { path: '/disease', label: 'Disease Advisory', icon: Bug, section: 'tools' },
  { path: '/profile', label: 'Farmer Profile', icon: User, section: 'account' },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: Database, section: 'admin', badge: 'Admin' },
]

const sections = [
  { key: 'main', label: 'Overview' },
  { key: 'tools', label: 'Intelligence Tools' },
  { key: 'account', label: 'Account' },
  { key: 'admin', label: 'Admin' },
]

export default function Sidebar({ mobileOpen, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        aria-label="Application navigation"
      >
        {/* Logo area (mobile) */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Leaf size={18} aria-hidden="true" />
          </div>
          <span className="sidebar-brand-name">AgroGenie AI</span>
        </div>

        <nav className="sidebar-nav">
          {sections.map(section => {
            const items = navItems.filter(i => i.section === section.key)
            return (
              <div key={section.key} className="sidebar-section">
                <span className="sidebar-section-label">{section.label}</span>
                {items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                    aria-label={item.label}
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="sidebar-badge">{item.badge}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        {/* IBM Powered footer */}
        <div className="sidebar-footer">
          <div className="ibm-badge">
            <Zap size={13} aria-hidden="true" />
            <span>Powered by Llama</span>
          </div>
          <p className="sidebar-footer-note">Demo Mode — Mock Data</p>
        </div>
      </aside>
    </>
  )
}
