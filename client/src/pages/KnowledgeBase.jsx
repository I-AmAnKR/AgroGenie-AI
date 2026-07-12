/**
 * Knowledge Base Management page — Phase 7 + Phase 8.
 *
 * Phase 7: Upload, list, view, delete documents.
 * Phase 8: Process, reprocess, RAG search, RAG ask with Granite.
 *
 * Sections:
 *   1. Upload panel — file picker + metadata form
 *   2. Document table — list with filters, Process/Reprocess/Delete actions
 *   3. Document detail panel — full metadata including processing stats
 *   4. RAG Test Console tab — search and ask via Granite (development tool)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  uploadKnowledgeDocument,
  listKnowledgeDocuments,
  getKnowledgeDocument,
  getDocumentContentUrl,
  deleteKnowledgeDocument,
  processKnowledgeDocument,
  reprocessKnowledgeDocument,
  searchKnowledge,
  askKnowledge,
} from '../api/knowledge.api.js'
import './KnowledgeBase.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'knowledge/crop-guides', label: 'Crop Guides' },
  { value: 'knowledge/pest-management', label: 'Pest Management' },
  { value: 'knowledge/soil-management', label: 'Soil Management' },
  { value: 'knowledge/irrigation', label: 'Irrigation' },
  { value: 'knowledge/government-schemes', label: 'Government Schemes' },
  { value: 'knowledge/general', label: 'General' },
]

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'kn', label: 'Kannada' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'bn', label: 'Bengali' },
]

const PROCESSING_STATUS_LABELS = {
  uploaded: { label: 'Uploaded', cls: 'status-uploaded' },
  pending_processing: { label: 'Pending', cls: 'status-pending' },
  processing: { label: 'Processing…', cls: 'status-processing' },
  processed: { label: 'Processed', cls: 'status-processed' },
  failed: { label: 'Failed', cls: 'status-failed' },
}

// ── Helper components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const info = PROCESSING_STATUS_LABELS[status] ?? { label: status, cls: 'status-uploaded' }
  return <span className={`status-badge ${info.cls}`}>{info.label}</span>
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function getCategoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

// ── Upload Form ───────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  category: 'knowledge/general',
  title: '',
  organization: '',
  documentDate: '',
  language: 'en',
  tags: '',
  sourceUrl: '',
}

function UploadPanel({ onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const fileInputRef = useRef()

  function handleField(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleFileDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  function handleFileSelect(e) {
    setFile(e.target.files[0] ?? null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setUploadError('')
    setUploadSuccess('')
    setProgress(0)

    if (!file) return setUploadError('Please select a file to upload.')
    if (!form.title.trim()) return setUploadError('Title is required.')
    if (!form.organization.trim()) return setUploadError('Organization is required.')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', form.category)
    fd.append('title', form.title.trim())
    fd.append('organization', form.organization.trim())
    if (form.documentDate) fd.append('documentDate', form.documentDate)
    fd.append('language', form.language)
    if (form.tags.trim()) fd.append('tags', form.tags.trim())
    if (form.sourceUrl.trim()) fd.append('sourceUrl', form.sourceUrl.trim())

    setUploading(true)
    try {
      const res = await uploadKnowledgeDocument(fd, setProgress)
      setUploadSuccess(`"${res.data.document.title}" uploaded successfully!`)
      setForm(INITIAL_FORM)
      setFile(null)
      setProgress(0)
      onSuccess()
    } catch (err) {
      setUploadError(err?.error?.message ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="kb-upload-panel">
      <div className="kb-panel-header">
        <div className="kb-panel-icon">📄</div>
        <div>
          <h2 className="kb-panel-title">Upload Document</h2>
          <p className="kb-panel-subtitle">PDF and plain text files supported (max 20 MB)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="kb-upload-form" id="kb-upload-form">
        {/* File drop zone */}
        <div
          className={`kb-dropzone${dragOver ? ' kb-dropzone--active' : ''}${file ? ' kb-dropzone--has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          id="kb-dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="kb-file-input"
          />
          {file ? (
            <div className="kb-file-selected">
              <span className="kb-file-icon">{file.type === 'application/pdf' ? '📕' : '📝'}</span>
              <span className="kb-file-name">{file.name}</span>
              <span className="kb-file-size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="kb-file-remove"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                id="kb-remove-file-btn"
              >✕</button>
            </div>
          ) : (
            <div className="kb-dropzone-prompt">
              <span className="kb-dropzone-icon">☁️</span>
              <span className="kb-dropzone-text">Drop file here or <strong>click to browse</strong></span>
              <span className="kb-dropzone-hint">PDF, TXT • Max 20 MB</span>
            </div>
          )}
        </div>

        {/* Metadata fields */}
        <div className="kb-form-grid">
          <div className="kb-field kb-field--full">
            <label className="kb-label" htmlFor="kb-title">Document Title <span className="kb-required">*</span></label>
            <input id="kb-title" name="title" value={form.title} onChange={handleField}
              className="kb-input" placeholder="e.g., Wheat Cultivation Guide 2024" required />
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="kb-category">Category <span className="kb-required">*</span></label>
            <select id="kb-category" name="category" value={form.category} onChange={handleField} className="kb-select">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="kb-language">Language</label>
            <select id="kb-language" name="language" value={form.language} onChange={handleField} className="kb-select">
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="kb-organization">Organization <span className="kb-required">*</span></label>
            <input id="kb-organization" name="organization" value={form.organization} onChange={handleField}
              className="kb-input" placeholder="e.g., ICAR, State Agri Dept" required />
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="kb-document-date">Document Date</label>
            <input id="kb-document-date" name="documentDate" type="date" value={form.documentDate}
              onChange={handleField} className="kb-input" />
          </div>

          <div className="kb-field kb-field--full">
            <label className="kb-label" htmlFor="kb-tags">Tags <span className="kb-hint">(comma-separated)</span></label>
            <input id="kb-tags" name="tags" value={form.tags} onChange={handleField}
              className="kb-input" placeholder="e.g., wheat, kharif, irrigation" />
          </div>

          <div className="kb-field kb-field--full">
            <label className="kb-label" htmlFor="kb-source-url">Source URL</label>
            <input id="kb-source-url" name="sourceUrl" type="url" value={form.sourceUrl} onChange={handleField}
              className="kb-input" placeholder="https://..." />
          </div>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="kb-progress-wrap">
            <div className="kb-progress-bar" style={{ width: `${progress}%` }} />
            <span className="kb-progress-label">{progress}%</span>
          </div>
        )}

        {uploadError && <div className="kb-alert kb-alert--error" id="kb-upload-error">{uploadError}</div>}
        {uploadSuccess && <div className="kb-alert kb-alert--success" id="kb-upload-success">{uploadSuccess}</div>}

        <div className="kb-form-actions">
          <button
            type="submit"
            className="kb-btn kb-btn--primary"
            disabled={uploading || !file}
            id="kb-upload-btn"
          >
            {uploading ? `Uploading… ${progress}%` : '⬆ Upload Document'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange }) {
  return (
    <div className="kb-filter-bar">
      <select
        className="kb-select kb-filter-select"
        value={filters.category ?? ''}
        onChange={(e) => onChange({ ...filters, category: e.target.value || undefined })}
        id="kb-filter-category"
      >
        <option value="">All Categories</option>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <select
        className="kb-select kb-filter-select"
        value={filters.processingStatus ?? ''}
        onChange={(e) => onChange({ ...filters, processingStatus: e.target.value || undefined })}
        id="kb-filter-status"
      >
        <option value="">All Statuses</option>
        <option value="uploaded">Uploaded</option>
        <option value="pending_processing">Pending</option>
        <option value="processing">Processing</option>
        <option value="processed">Processed</option>
        <option value="failed">Failed</option>
      </select>
      <select
        className="kb-select kb-filter-select"
        value={filters.language ?? ''}
        onChange={(e) => onChange({ ...filters, language: e.target.value || undefined })}
        id="kb-filter-language"
      >
        <option value="">All Languages</option>
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      <button
        className="kb-btn kb-btn--ghost"
        onClick={() => onChange({})}
        id="kb-filter-clear-btn"
      >
        Clear Filters
      </button>
    </div>
  )
}

// ── Document Detail Panel ─────────────────────────────────────────────────────

function DocumentDetail({ documentId, onClose, onDelete, onProcessed }) {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processMsg, setProcessMsg] = useState('')

  useEffect(() => {
    if (!documentId) return
    setLoading(true)
    setErr('')
    getKnowledgeDocument(documentId)
      .then((res) => setDoc(res.data.document))
      .catch(() => setErr('Failed to load document details.'))
      .finally(() => setLoading(false))
  }, [documentId])

  async function handleDelete() {
    if (!window.confirm(`Delete "${doc?.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteKnowledgeDocument(documentId)
      onDelete(documentId)
    } catch {
      setErr('Deletion failed. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleProcess(isReprocess = false) {
    setProcessing(true)
    setProcessMsg('')
    setErr('')
    try {
      const fn = isReprocess ? reprocessKnowledgeDocument : processKnowledgeDocument
      const res = await fn(documentId)
      const summary = res.data.processing
      setProcessMsg(`Processed: ${summary.chunkCount} chunks · Model: ${summary.embeddingModelId}`)
      setDoc((prev) => prev ? { ...prev, processingStatus: 'processed', chunkCount: summary.chunkCount } : prev)
      if (onProcessed) onProcessed(documentId)
    } catch (e) {
      setErr(e?.error?.message ?? 'Processing failed. Check server logs.')
    } finally {
      setProcessing(false)
    }
  }

  if (!documentId) return null

  const canProcess = doc && ['uploaded', 'pending_processing', 'failed'].includes(doc.processingStatus)
  const canReprocess = doc && doc.processingStatus === 'processed'

  return (
    <div className="kb-detail-overlay" onClick={onClose}>
      <div className="kb-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kb-detail-header">
          <h3 className="kb-detail-title">Document Details</h3>
          <button className="kb-detail-close" onClick={onClose} id="kb-detail-close-btn">✕</button>
        </div>

        {loading && <div className="kb-detail-loading">Loading…</div>}
        {err && <div className="kb-alert kb-alert--error">{err}</div>}
        {processMsg && <div className="kb-alert kb-alert--success">{processMsg}</div>}

        {doc && (
          <>
            <div className="kb-detail-body">
              <div className="kb-meta-row"><span className="kb-meta-key">Title</span><span className="kb-meta-val">{doc.title}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Category</span><span className="kb-meta-val">{getCategoryLabel(doc.category)}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Organization</span><span className="kb-meta-val">{doc.organization || '—'}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Language</span><span className="kb-meta-val">{doc.language}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">File</span><span className="kb-meta-val">{doc.originalName}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Size</span><span className="kb-meta-val">{formatBytes(doc.sizeBytes)}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">MIME Type</span><span className="kb-meta-val">{doc.mimeType}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Storage</span><span className="kb-meta-val">{doc.storageProvider}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Status</span><span className="kb-meta-val">{doc.status}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Processing</span><span className="kb-meta-val"><StatusBadge status={doc.processingStatus} /></span></div>
              {doc.chunkCount != null && (
                <div className="kb-meta-row"><span className="kb-meta-key">Chunks</span><span className="kb-meta-val">{doc.chunkCount}</span></div>
              )}
              {doc.embeddingModelId && (
                <div className="kb-meta-row"><span className="kb-meta-key">Embedding Model</span><span className="kb-meta-val kb-monospace">{doc.embeddingModelId}</span></div>
              )}
              {doc.processingVersion && (
                <div className="kb-meta-row"><span className="kb-meta-key">RAG Version</span><span className="kb-meta-val">{doc.processingVersion}</span></div>
              )}
              {doc.processedAt && (
                <div className="kb-meta-row"><span className="kb-meta-key">Processed At</span><span className="kb-meta-val">{formatDate(doc.processedAt)}</span></div>
              )}
              {doc.processingError && (
                <div className="kb-meta-row"><span className="kb-meta-key">Error</span><span className="kb-meta-val kb-error-text">{doc.processingError}</span></div>
              )}
              {doc.documentDate && <div className="kb-meta-row"><span className="kb-meta-key">Doc Date</span><span className="kb-meta-val">{doc.documentDate}</span></div>}
              {doc.tags?.length > 0 && (
                <div className="kb-meta-row"><span className="kb-meta-key">Tags</span>
                  <span className="kb-meta-val kb-tags">{doc.tags.map((t) => <span key={t} className="kb-tag">{t}</span>)}</span>
                </div>
              )}
              {doc.sourceUrl && (
                <div className="kb-meta-row"><span className="kb-meta-key">Source</span>
                  <span className="kb-meta-val"><a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="kb-link">{doc.sourceUrl}</a></span>
                </div>
              )}
              <div className="kb-meta-row"><span className="kb-meta-key">Uploaded</span><span className="kb-meta-val">{formatDate(doc.createdAt)}</span></div>
              <div className="kb-meta-row"><span className="kb-meta-key">Document ID</span><span className="kb-meta-val kb-monospace">{doc.documentId}</span></div>
            </div>

            <div className="kb-detail-actions">
              <a
                href={getDocumentContentUrl(doc.documentId)}
                target="_blank"
                rel="noopener noreferrer"
                className="kb-btn kb-btn--secondary"
                id="kb-view-content-btn"
              >
                ⬇ View / Download
              </a>
              {canProcess && (
                <button
                  className="kb-btn kb-btn--process"
                  onClick={() => handleProcess(false)}
                  disabled={processing}
                  id="kb-process-doc-btn"
                >
                  {processing ? 'Processing…' : '⚙ Process'}
                </button>
              )}
              {canReprocess && (
                <button
                  className="kb-btn kb-btn--secondary"
                  onClick={() => handleProcess(true)}
                  disabled={processing}
                  id="kb-reprocess-doc-btn"
                >
                  {processing ? 'Re-processing…' : '↻ Reprocess'}
                </button>
              )}
              <button
                className="kb-btn kb-btn--danger"
                onClick={handleDelete}
                disabled={deleting || processing}
                id="kb-delete-doc-btn"
              >
                {deleting ? 'Deleting…' : '🗑 Delete'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Document Table ────────────────────────────────────────────────────────────

function DocumentTable({ documents, pagination, onPageChange, onRowClick, onDeleteInline, onProcessInline }) {
  if (documents.length === 0) {
    return (
      <div className="kb-empty-state">
        <div className="kb-empty-icon">📭</div>
        <div className="kb-empty-text">No documents found</div>
        <div className="kb-empty-hint">Upload your first document using the panel above.</div>
      </div>
    )
  }

  return (
    <div className="kb-table-wrap">
      <table className="kb-table" id="kb-documents-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Language</th>
            <th>Size</th>
            <th>Processing</th>
            <th>Chunks</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.documentId} className="kb-table-row" onClick={() => onRowClick(doc.documentId)}>
              <td className="kb-td-title">
                <span className="kb-doc-icon">{doc.mimeType === 'application/pdf' ? '📕' : '📝'}</span>
                <span className="kb-doc-title">{doc.title}</span>
              </td>
              <td>{getCategoryLabel(doc.category)}</td>
              <td>{doc.language}</td>
              <td>{formatBytes(doc.sizeBytes)}</td>
              <td><StatusBadge status={doc.processingStatus} /></td>
              <td>{doc.chunkCount ?? '—'}</td>
              <td>{formatDate(doc.createdAt)}</td>
              <td onClick={(e) => e.stopPropagation()} className="kb-td-actions">
                <a
                  href={getDocumentContentUrl(doc.documentId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kb-action-btn kb-action-view"
                  title="View"
                >⬇</a>
                {['uploaded', 'pending_processing', 'failed'].includes(doc.processingStatus) && (
                  <button
                    className="kb-action-btn kb-action-process"
                    title="Process"
                    onClick={async () => {
                      try {
                        const res = await processKnowledgeDocument(doc.documentId)
                        onProcessInline(doc.documentId, res.data.processing)
                      } catch {
                        alert('Processing failed. Check server logs.')
                      }
                    }}
                  >⚙</button>
                )}
                {doc.processingStatus === 'processed' && (
                  <button
                    className="kb-action-btn kb-action-reprocess"
                    title="Reprocess"
                    onClick={async () => {
                      try {
                        const res = await reprocessKnowledgeDocument(doc.documentId)
                        onProcessInline(doc.documentId, res.data.processing)
                      } catch {
                        alert('Reprocessing failed. Check server logs.')
                      }
                    }}
                  >↻</button>
                )}
                <button
                  className="kb-action-btn kb-action-delete"
                  title="Delete"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${doc.title}"?`)) return
                    try {
                      await deleteKnowledgeDocument(doc.documentId)
                      onDeleteInline(doc.documentId)
                    } catch {
                      alert('Deletion failed. Please try again.')
                    }
                  }}
                >🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pagination.pages > 1 && (
        <div className="kb-pagination">
          <button
            className="kb-btn kb-btn--ghost kb-page-btn"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            id="kb-prev-page-btn"
          >← Prev</button>
          <span className="kb-page-info">Page {pagination.page} of {pagination.pages} ({pagination.total} docs)</span>
          <button
            className="kb-btn kb-btn--ghost kb-page-btn"
            disabled={pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            id="kb-next-page-btn"
          >Next →</button>
        </div>
      )}
    </div>
  )
}

// ── RAG Test Console ──────────────────────────────────────────────────────────

function RagTestConsole() {
  const [mode, setMode] = useState('ask') // 'search' | 'ask'
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [category, setCategory] = useState('')
  const [language, setLanguage] = useState('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [askResult, setAskResult] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setSearchResults(null)
    setAskResult(null)

    try {
      if (mode === 'search') {
        const res = await searchKnowledge({
          query: query.trim(),
          topK,
          filters: category ? { category } : {},
        })
        setSearchResults(res.data)
      } else {
        const res = await askKnowledge({
          question: query.trim(),
          language,
          topK,
          filters: category ? { category } : {},
        })
        setAskResult(res.data)
      }
    } catch (err) {
      setError(err?.error?.message ?? 'Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rag-console">
      <div className="kb-panel-header">
        <div className="kb-panel-icon">🔍</div>
        <div>
          <h2 className="kb-panel-title">RAG Test Console</h2>
          <p className="kb-panel-subtitle">Test knowledge retrieval and Granite-grounded answers. Development use only.</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="rag-mode-tabs">
        <button
          className={`rag-mode-tab${mode === 'search' ? ' rag-mode-tab--active' : ''}`}
          onClick={() => setMode('search')}
        >
          Search Only
        </button>
        <button
          className={`rag-mode-tab${mode === 'ask' ? ' rag-mode-tab--active' : ''}`}
          onClick={() => setMode('ask')}
        >
          Ask with Granite
        </button>
      </div>

      <form onSubmit={handleSearch} className="rag-form">
        <div className="kb-form-grid">
          <div className="kb-field kb-field--full">
            <label className="kb-label" htmlFor="rag-query">
              {mode === 'ask' ? 'Question' : 'Search Query'}
            </label>
            <textarea
              id="rag-query"
              className="kb-input rag-textarea"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'ask'
                ? 'e.g., What is the best time to sow wheat in Punjab?'
                : 'e.g., crop rotation soil health'}
              rows={3}
            />
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="rag-topk">Top K Results</label>
            <select id="rag-topk" className="kb-select" value={topK} onChange={(e) => setTopK(Number(e.target.value))}>
              {[1, 3, 5, 8, 10].map((k) => (
                <option key={k} value={k}>{k} chunks</option>
              ))}
            </select>
          </div>

          <div className="kb-field">
            <label className="kb-label" htmlFor="rag-category">Category Filter</label>
            <select id="rag-category" className="kb-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {mode === 'ask' && (
            <div className="kb-field">
              <label className="kb-label" htmlFor="rag-language">Response Language</label>
              <select id="rag-language" className="kb-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <div className="kb-alert kb-alert--error">{error}</div>}

        <div className="kb-form-actions">
          <button type="submit" className="kb-btn kb-btn--primary" disabled={loading || !query.trim()}>
            {loading ? 'Searching…' : mode === 'search' ? '🔍 Search' : '⚡ Ask Granite'}
          </button>
        </div>
      </form>

      {/* Search results */}
      {searchResults && (
        <div className="rag-results">
          <div className="rag-results-header">
            <h3 className="rag-results-title">Search Results</h3>
            <span className="rag-results-meta">{searchResults.resultCount} result(s) · topK={searchResults.topK} · minScore={searchResults.minScore}</span>
          </div>
          {searchResults.results.length === 0 ? (
            <div className="kb-alert kb-alert--info">No chunks above the relevance threshold. Try a different query or lower the threshold in server config.</div>
          ) : (
            searchResults.results.map((r, i) => (
              <div key={r.chunkId} className="rag-chunk-card">
                <div className="rag-chunk-header">
                  <span className="rag-chunk-num">#{i + 1}</span>
                  <span className="rag-chunk-score">Score: {r.score.toFixed(4)}</span>
                  <span className="rag-chunk-source">{r.source.title} — {r.source.organization}</span>
                  {r.source.pageNumber && <span className="rag-chunk-page">p.{r.source.pageNumber}</span>}
                </div>
                <p className="rag-chunk-text">{r.textPreview}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Ask result */}
      {askResult && (
        <div className="rag-results">
          <div className="rag-ask-header">
            <h3 className="rag-results-title">Granite Answer</h3>
            <div className="rag-ask-meta">
              <span className={`rag-grounded-badge ${askResult.grounded ? 'rag-grounded' : 'rag-not-grounded'}`}>
                {askResult.grounded ? '✓ Grounded' : '⚠ Not Grounded'}
              </span>
              <span className="rag-results-meta">
                {askResult.retrieval.chunksRetrieved} chunks · {askResult.retrieval.documentsUsed} doc(s) · {askResult.provider ?? 'none'}
              </span>
            </div>
          </div>
          <div className="rag-answer-box">
            {askResult.answer}
          </div>
          {askResult.sources.length > 0 && (
            <div className="rag-sources">
              <h4 className="rag-sources-title">Sources</h4>
              {askResult.sources.map((s) => (
                <div key={s.documentId} className="rag-source-card">
                  <span className="rag-source-title">{s.title}</span>
                  <span className="rag-source-org">{s.organization}</span>
                  {s.documentDate && <span className="rag-source-date">{s.documentDate}</span>}
                  {s.pageNumbers?.length > 0 && (
                    <span className="rag-source-pages">Pages: {s.pageNumbers.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState('documents') // 'documents' | 'rag-test'
  const [documents, setDocuments] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })
  const [filters, setFilters] = useState({})
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [selectedDocId, setSelectedDocId] = useState(null)

  const fetchDocuments = useCallback(async (f = filters, p = 1) => {
    setLoading(true)
    setListError('')
    try {
      const res = await listKnowledgeDocuments(f, { page: p, limit: 20 })
      setDocuments(res.data.documents ?? [])
      setPagination(res.data.pagination ?? { page: 1, limit: 20, total: 0, pages: 0 })
    } catch (err) {
      setListError(err?.error?.message ?? 'Failed to load documents.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchDocuments({}, 1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(newFilters) {
    setFilters(newFilters)
    fetchDocuments(newFilters, 1)
  }

  function handlePageChange(page) {
    fetchDocuments(filters, page)
  }

  function handleDeleteInline(documentId) {
    setDocuments((prev) => prev.filter((d) => d.documentId !== documentId))
  }

  function handleProcessInline(documentId, summary) {
    setDocuments((prev) =>
      prev.map((d) =>
        d.documentId === documentId
          ? { ...d, processingStatus: 'processed', chunkCount: summary.chunkCount }
          : d
      )
    )
  }

  function handleDetailDelete(documentId) {
    setSelectedDocId(null)
    handleDeleteInline(documentId)
  }

  return (
    <div className="kb-page">
      {/* Page Header */}
      <div className="kb-page-header">
        <div className="kb-page-header-left">
          <div className="kb-page-badge">ADMIN</div>
          <h1 className="kb-page-title">Knowledge Base Management</h1>
          <p className="kb-page-desc">
            Upload and manage documents for the AgroGenie AI knowledge base.
            Use the RAG Test Console to verify retrieval quality.
          </p>
        </div>
        <div className="kb-page-stats">
          <div className="kb-stat-card">
            <span className="kb-stat-num">{pagination.total}</span>
            <span className="kb-stat-label">Total Documents</span>
          </div>
          <div className="kb-stat-card">
            <span className="kb-stat-num">{documents.filter((d) => d.processingStatus === 'processed').length}</span>
            <span className="kb-stat-label">Processed</span>
          </div>
          <div className="kb-stat-card">
            <span className="kb-stat-num">{documents.filter((d) => d.processingStatus === 'pending_processing').length}</span>
            <span className="kb-stat-label">Pending</span>
          </div>
          <div className="kb-stat-card">
            <span className="kb-stat-num">{documents.reduce((s, d) => s + (d.chunkCount ?? 0), 0)}</span>
            <span className="kb-stat-label">Indexed Chunks</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="kb-tabs">
        <button
          className={`kb-tab${activeTab === 'documents' ? ' kb-tab--active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          📁 Documents
        </button>
        <button
          className={`kb-tab${activeTab === 'rag-test' ? ' kb-tab--active' : ''}`}
          onClick={() => setActiveTab('rag-test')}
        >
          🔍 RAG Test Console
        </button>
      </div>

      {activeTab === 'documents' && (
        <>
          {/* Upload Panel */}
          <UploadPanel onSuccess={() => fetchDocuments(filters, 1)} />

          {/* Documents Section */}
          <div className="kb-list-section">
            <div className="kb-list-header">
              <h2 className="kb-list-title">Uploaded Documents</h2>
              <button
                className="kb-btn kb-btn--ghost"
                onClick={() => fetchDocuments(filters, 1)}
                disabled={loading}
                id="kb-refresh-btn"
              >
                {loading ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            <FilterBar filters={filters} onChange={handleFilterChange} />

            {listError && <div className="kb-alert kb-alert--error">{listError}</div>}

            {loading ? (
              <div className="kb-loading-state">
                <div className="kb-spinner" />
                <span>Loading documents…</span>
              </div>
            ) : (
              <DocumentTable
                documents={documents}
                pagination={pagination}
                onPageChange={handlePageChange}
                onRowClick={setSelectedDocId}
                onDeleteInline={handleDeleteInline}
                onProcessInline={handleProcessInline}
              />
            )}
          </div>
        </>
      )}

      {activeTab === 'rag-test' && (
        <RagTestConsole />
      )}

      {/* Detail panel overlay */}
      {selectedDocId && (
        <DocumentDetail
          documentId={selectedDocId}
          onClose={() => setSelectedDocId(null)}
          onDelete={handleDetailDelete}
          onProcessed={() => {
            // Re-fetch to get updated chunkCount and processingStatus
            fetchDocuments(filters, pagination.page)
          }}
        />
      )}
    </div>
  )
}
