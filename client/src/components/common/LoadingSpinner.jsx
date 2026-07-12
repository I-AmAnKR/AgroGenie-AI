import './LoadingSpinner.css'

export default function LoadingSpinner({ size = 'md', text = '', fullPage = false }) {
  const spinner = (
    <div className={`spinner spinner-${size}`} role="status" aria-label="Loading">
      <div className="spinner-ring" />
    </div>
  )

  if (fullPage) {
    return (
      <div className="spinner-full-page">
        {spinner}
        {text && <p className="spinner-text">{text}</p>}
      </div>
    )
  }

  return (
    <div className="spinner-inline">
      {spinner}
      {text && <span className="spinner-text">{text}</span>}
    </div>
  )
}
