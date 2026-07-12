import { Link } from 'react-router-dom'
import { Leaf, Home, ArrowLeft } from 'lucide-react'
import './NotFound.css'

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-icon" aria-hidden="true">
        <Leaf size={40} />
      </div>
      <h1 className="not-found-code">404</h1>
      <h2 className="not-found-title">Page not found</h2>
      <p className="not-found-desc">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="not-found-actions">
        <Link to="/dashboard" className="btn btn-primary">
          <Home size={16} aria-hidden="true" />
          Go to Dashboard
        </Link>
        <button className="btn btn-secondary" onClick={() => window.history.back()}>
          <ArrowLeft size={16} aria-hidden="true" />
          Go Back
        </button>
      </div>
    </div>
  )
}
