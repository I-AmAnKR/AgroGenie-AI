import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, Sprout, CloudSun,
  TrendingUp, BookOpen, Bug, User, Menu, X, Leaf,
  Bell, Sun, Moon, Database, ChevronDown,
  CheckCheck, AlertTriangle, CloudRain, Zap,
  LogOut, Settings, UserCircle, ShieldCheck, Clock
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext.jsx'
import './Navbar.css'

/* ── Static mock data ───────────────────────────── */
const NOTIFICATIONS = [
  {
    id: 1,
    type: 'weather',
    icon: CloudRain,
    iconColor: '#3b82f6',
    iconBg: 'rgba(59,130,246,0.12)',
    title: 'Rain Alert — Next 48 Hours',
    body: 'Moderate rainfall (15–20mm) expected mid-week near Nashik. Delay sowing by 3–4 days.',
    time: '5 min ago',
    unread: true,
  },
  {
    id: 2,
    type: 'advisory',
    icon: AlertTriangle,
    iconColor: '#f59e0b',
    iconBg: 'rgba(245,158,11,0.12)',
    title: 'Downy Mildew Risk Elevated',
    body: 'High humidity forecast increases fungal infection risk for your onion crop. Apply fungicide as precaution.',
    time: '1 hr ago',
    unread: true,
  },
  {
    id: 3,
    type: 'market',
    icon: TrendingUp,
    iconColor: '#22c55e',
    iconBg: 'rgba(34,197,94,0.12)',
    title: 'Onion Prices Up 8% This Week',
    body: 'Modal price at Lasalgaon: ₹2,340/qt (+8.2%). Consider selling within 2–3 days for best margin.',
    time: '3 hr ago',
    unread: false,
  },
  {
    id: 4,
    type: 'scheme',
    icon: Zap,
    iconColor: '#8b5cf6',
    iconBg: 'rgba(139,92,246,0.12)',
    title: 'PM Fasal Bima — Deadline Approaching',
    body: 'Last date to enroll in PMFBY for Kharif season is 31 July. Apply via your nearest bank.',
    time: '1 day ago',
    unread: false,
  },
  {
    id: 5,
    type: 'ai',
    icon: MessageSquare,
    iconColor: '#4ade80',
    iconBg: 'rgba(74,222,128,0.12)',
    title: 'AI Crop Report Ready',
    body: 'Your weekly AgroGenie crop health report for Onion (Rabi) has been generated.',
    time: '2 days ago',
    unread: false,
  },
]

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/chat', label: 'AI Assistant', icon: MessageSquare, badge: 'AI' },
  { path: '/crop-advisor', label: 'Crop Advisor', icon: Sprout },
  { path: '/weather', label: 'Weather', icon: CloudSun },
  { path: '/market', label: 'Mandi Market', icon: TrendingUp },
  { path: '/schemes', label: 'Gov. Schemes', icon: BookOpen },
  { path: '/disease', label: 'Disease', icon: Bug },
]

const moreItems = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: Database },
]

/* ── useClickOutside hook ───────────────────────── */
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return
      handler(e)
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

/* ── NotificationPanel ──────────────────────────── */
function NotificationPanel({ onSelectNotif, selectedId }) {
  return (
    <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="notif-panel-header">
        <h3>Notifications</h3>
        <button className="notif-mark-all" title="Mark all as read">
          <CheckCheck size={15} />
          <span>Mark all read</span>
        </button>
      </div>
      <div className="notif-list">
        {NOTIFICATIONS.map(n => (
          <button
            key={n.id}
            className={`notif-item ${n.unread ? 'unread' : ''} ${selectedId === n.id ? 'selected' : ''}`}
            onClick={() => onSelectNotif(n)}
            aria-pressed={selectedId === n.id}
          >
            <div className="notif-item-icon" style={{ background: n.iconBg, color: n.iconColor }}>
              <n.icon size={16} aria-hidden="true" />
            </div>
            <div className="notif-item-body">
              <p className="notif-item-title">{n.title}</p>
              <p className="notif-item-preview">{n.body}</p>
              <span className="notif-item-time">
                <Clock size={11} aria-hidden="true" />
                {n.time}
              </span>
            </div>
            {n.unread && <span className="notif-unread-dot" aria-label="Unread" />}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── NotificationDetail ─────────────────────────── */
function NotificationDetail({ notif, onClose }) {
  if (!notif) return (
    <div className="notif-detail notif-detail-empty">
      <Bell size={36} style={{ opacity: 0.2 }} />
      <p>Select a notification to view details</p>
    </div>
  )
  return (
    <div className="notif-detail">
      <div className="notif-detail-header">
        <div className="notif-detail-icon" style={{ background: notif.iconBg, color: notif.iconColor }}>
          <notif.icon size={22} aria-hidden="true" />
        </div>
        <button className="notif-detail-close" onClick={onClose} aria-label="Close detail">
          <X size={16} />
        </button>
      </div>
      <h4 className="notif-detail-title">{notif.title}</h4>
      <span className="notif-detail-time">
        <Clock size={12} aria-hidden="true" />
        {notif.time}
      </span>
      <p className="notif-detail-body">{notif.body}</p>
      <div className="notif-detail-type-badge" style={{ background: notif.iconBg, color: notif.iconColor }}>
        <notif.icon size={12} />
        {notif.type.charAt(0).toUpperCase() + notif.type.slice(1)} Alert
      </div>
    </div>
  )
}

/* ── ProfilePanel ───────────────────────────────── */
function ProfilePanel({ onClose }) {
  return (
    <div className="profile-panel" role="dialog" aria-label="Profile menu">
      {/* Avatar + name */}
      <div className="profile-panel-hero">
        <div className="profile-panel-avatar">RK</div>
        <div>
          <p className="profile-panel-name">Rajesh Kumar</p>
          <p className="profile-panel-role">Farmer · Nashik, Maharashtra</p>
        </div>
      </div>

      <div className="profile-panel-divider" />

      {/* Farm info */}
      <div className="profile-panel-info">
        <div className="profile-info-row">
          <Sprout size={14} aria-hidden="true" />
          <span>Current Crop: <strong>Onion (Rabi)</strong></span>
        </div>
        <div className="profile-info-row">
          <ShieldCheck size={14} aria-hidden="true" />
          <span>Demo Mode Active</span>
        </div>
      </div>

      <div className="profile-panel-divider" />

      {/* Actions */}
      <nav className="profile-panel-nav">
        <Link to="/profile" className="profile-panel-item" onClick={onClose}>
          <UserCircle size={16} aria-hidden="true" />
          <span>My Profile</span>
        </Link>
        <Link to="/dashboard" className="profile-panel-item" onClick={onClose}>
          <LayoutDashboard size={16} aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
        <Link to="/knowledge-base" className="profile-panel-item" onClick={onClose}>
          <Database size={16} aria-hidden="true" />
          <span>Knowledge Base</span>
          <span className="profile-item-badge">Admin</span>
        </Link>
        <button className="profile-panel-item profile-panel-item-btn">
          <Settings size={16} aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>

      <div className="profile-panel-divider" />

      <button className="profile-panel-logout">
        <LogOut size={15} aria-hidden="true" />
        <span>Sign out</span>
      </button>

      <p className="profile-panel-version">AgroGenie AI · v0.1.0-beta</p>
    </div>
  )
}

/* ── Main Navbar ────────────────────────────────── */
export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState(null)
  const location = useLocation()

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  useClickOutside(notifRef, () => { setNotifOpen(false); setSelectedNotif(null) })
  useClickOutside(profileRef, () => setProfileOpen(false))

  const closeMobile = () => setMobileOpen(false)
  const unreadCount = NOTIFICATIONS.filter(n => n.unread).length

  const handleNotifOpen = () => {
    setNotifOpen(o => !o)
    setProfileOpen(false)
  }

  const handleProfileOpen = () => {
    setProfileOpen(o => !o)
    setNotifOpen(false)
    setSelectedNotif(null)
  }

  return (
    <>
      <header className="navbar" role="banner">
        <div className="navbar-inner">
          {/* Left: Hamburger + Logo */}
          <div className="navbar-left">
            <button
              id="mobile-menu-toggle"
              className="hamburger-btn"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <Link to="/" className="navbar-brand" aria-label="AgroGenie AI Home">
              <div className="navbar-logo">
                <Leaf size={20} aria-hidden="true" />
              </div>
              <div className="navbar-brand-text">
                <span className="brand-name">AgroGenie</span>
                <span className="brand-tag">AI</span>
              </div>
            </Link>
          </div>

          {/* Center: Desktop Nav Links */}
          <nav className="navbar-nav" aria-label="Main navigation">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon size={15} aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}

            {/* More dropdown */}
            <div className="nav-more-wrapper">
              <button
                className={`navbar-link navbar-more-btn ${moreItems.some(i => i.path === location.pathname) ? 'active' : ''}`}
                onClick={() => setMoreOpen(o => !o)}
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                <span>More</span>
                <ChevronDown size={13} className={`chevron ${moreOpen ? 'open' : ''}`} aria-hidden="true" />
              </button>
              {moreOpen && (
                <>
                  <div className="nav-more-overlay" onClick={() => setMoreOpen(false)} />
                  <div className="nav-more-dropdown" role="menu">
                    {moreItems.map(item => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `nav-more-item ${isActive ? 'active' : ''}`}
                        role="menuitem"
                        onClick={() => setMoreOpen(false)}
                      >
                        <item.icon size={15} aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Right: Theme toggle, Bell, Avatar */}
          <div className="navbar-right">
            {/* Theme Toggle */}
            <button
              id="theme-toggle"
              className="navbar-icon-btn theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notification Bell */}
            <div ref={notifRef} className="notif-wrapper">
              <button
                id="notif-btn"
                className={`navbar-icon-btn ${notifOpen ? 'active' : ''}`}
                onClick={handleNotifOpen}
                aria-label={`Notifications — ${unreadCount} unread`}
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="notif-count" aria-hidden="true">{unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className="notif-popup" role="presentation">
                  <NotificationPanel
                    onSelectNotif={setSelectedNotif}
                    selectedId={selectedNotif?.id}
                  />
                  <NotificationDetail
                    notif={selectedNotif}
                    onClose={() => setSelectedNotif(null)}
                  />
                </div>
              )}
            </div>

            {/* Avatar / Profile */}
            <div ref={profileRef} className="profile-wrapper">
              <button
                id="profile-btn"
                className={`navbar-avatar ${profileOpen ? 'active' : ''}`}
                onClick={handleProfileOpen}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                aria-haspopup="dialog"
              >
                RK
              </button>

              {profileOpen && (
                <ProfilePanel onClose={() => setProfileOpen(false)} />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={closeMobile} aria-hidden="true" />
      )}
      <nav
        className={`mobile-menu ${mobileOpen ? 'mobile-menu-open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!mobileOpen}
      >
        <div className="mobile-menu-header">
          <div className="navbar-logo">
            <Leaf size={18} aria-hidden="true" />
          </div>
          <span className="brand-name">AgroGenie AI</span>
        </div>
        <div className="mobile-nav-links">
          {[...navItems, ...moreItems].map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={closeMobile}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          ))}
        </div>
        <div className="mobile-menu-footer">
          <button className="mobile-theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
