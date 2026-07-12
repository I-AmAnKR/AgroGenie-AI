import { useLocation } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import './Layout.css'

export default function Layout({ children }) {
  const location = useLocation()
  const isLandingPage = location.pathname === '/'

  if (isLandingPage) {
    return (
      <>
        <Navbar />
        <main>{children}</main>
      </>
    )
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <main className="page-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
