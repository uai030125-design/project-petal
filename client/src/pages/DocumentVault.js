import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

// Document type icons and colors
const DOC_TYPE_CONFIG = {
  'Line Sheet': { icon: '📋', color: '#3b82f6' },
  'Purchase Order': { icon: '📄', color: '#8b5cf6' },
  'Routing Guide': { icon: '🗂️', color: '#ec4899' },
  'Compliance Guide': { icon: '✅', color: '#10b981' },
  'Invoice': { icon: '💰', color: '#f59e0b' },
  'Packing List': { icon: '📦', color: '#06b6d4' },
  'Sample Request': { icon: '🎁', color: '#6366f1' },
  'Other': { icon: '📌', color: '#6b7280' },
};

// Upload modal component
function UploadModal({ onClose, onUpload, uploading }) {
  const [formData, setFormData] = useState({
    file: null,
    buyer: '',
    type: '',
    season: '',
    tags: '',
  });

  const buyers = ['Burlington', 'Ross Missy', 'Ross Petite', 'Ross Plus', 'Bealls', 'General/All'];
  const types = Object.keys(DOC_TYPE_CONFIG);
  const seasons = ['Spring 2025', 'Summer 2025', 'Fall 2025', 'Holiday 2025', 'Spring 2026', 'Summer 2026'];

  const isValid = formData.file && formData.buyer && formData.type && formData.season;

  const handleSubmit = async () => {
    if (!isValid) return;

    const fd = new FormData();
    fd.append('file', formData.file);
    fd.append('buyer', formData.buyer);
    fd.append('type', formData.type);
    fd.append('season', formData.season);
    if (formData.tags) fd.append('tags', formData.tags);

    onUpload(fd);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.35)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '28px 32px',
        minWidth: 420, maxWidth: 560, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Upload Document</div>

        {/* File Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            File
          </label>
          <input
            type="file"
            onChange={e => setFormData(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          />
          {formData.file && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Selected: {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {/* Buyer */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Buyer
          </label>
          <select
            value={formData.buyer}
            onChange={e => setFormData(prev => ({ ...prev, buyer: e.target.value }))}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Select a buyer...</option>
            {buyers.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Document Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Document Type
          </label>
          <select
            value={formData.type}
            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Select a type...</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Season */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Season
          </label>
          <select
            value={formData.season}
            onChange={e => setFormData(prev => ({ ...prev, season: e.target.value }))}
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="">Select a season...</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tags (optional, comma-separated)
          </label>
          <input
            type="text"
            value={formData.tags}
            onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="e.g., urgent, updated, review"
            disabled={uploading}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!uploading) { e.target.style.background = 'var(--surface2)'; } }}
            onMouseLeave={e => { e.target.style.background = 'var(--surface)'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || uploading}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: isValid && !uploading ? 'var(--accent)' : 'var(--border)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isValid && !uploading ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (isValid && !uploading) { e.target.style.opacity = 0.9; } }}
            onMouseLeave={e => { e.target.style.opacity = 1; }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Document card component
function DocumentCard({ doc, onDelete }) {
  const config = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG['Other'];
  const uploadDate = new Date(doc.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 12,
      transition: 'all 0.15s', cursor: 'pointer',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Icon */}
      <div style={{
        fontSize: 32, flexShrink: 0, width: 48, height: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${config.color}15`, borderRadius: 8,
      }}>
        {config.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>
          {doc.name}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: `${config.color}20`, color: config.color,
          }}>
            {doc.type}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: 'var(--surface2)', color: 'var(--text-muted)',
          }}>
            {doc.buyer}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: 'var(--surface2)', color: 'var(--text-muted)',
          }}>
            {doc.season}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>📅 {uploadDate}</span>
          <span>👤 {doc.uploadedBy}</span>
        </div>

        {doc.tags && doc.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {doc.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: 'var(--bg)', color: 'var(--text-muted)',
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Delete "${doc.name}"?`)) {
            onDelete(doc.id);
          }
        }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, padding: '4px 8px',
          borderRadius: 4, transition: 'color 0.15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.target.style.color = 'var(--danger)'; }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; }}
        title="Delete document"
      >
        🗑️
      </button>
    </div>
  );
}

// Main Document Vault page
export default function DocumentVault() {
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filter state
  const [filters, setFilters] = useState({
    buyer: 'All',
    type: 'All',
    season: 'All',
    search: '',
  });

  // Load documents
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents');
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading documents:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Delete document
  const handleDelete = async (id) => {
    try {
      await api.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
    } catch (err) {
      console.error('Error deleting document:', err);
      toast.error('Failed to delete document');
    }
  };

  // Upload document
  const handleUpload = async (formData) => {
    try {
      setUploading(true);
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments(prev => [res.data, ...prev]);
      setShowUploadModal(false);
      toast.success('Document uploaded successfully');
    } catch (err) {
      console.error('Error uploading document:', err);
      toast.error(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Get unique filter options
  const buyers = useMemo(() => {
    const set = new Set(documents.map(d => d.buyer));
    return ['All', ...Array.from(set).sort()];
  }, [documents]);

  const types = useMemo(() => {
    const set = new Set(documents.map(d => d.type));
    return ['All', ...Array.from(set).sort()];
  }, [documents]);

  const seasons = useMemo(() => {
    const set = new Set(documents.map(d => d.season));
    return ['All', ...Array.from(set).sort()];
  }, [documents]);

  // Filter documents
  const filtered = useMemo(() => {
    let result = documents;

    if (filters.buyer !== 'All') {
      result = result.filter(d => d.buyer === filters.buyer);
    }

    if (filters.type !== 'All') {
      result = result.filter(d => d.type === filters.type);
    }

    if (filters.season !== 'All') {
      result = result.filter(d => d.season === filters.season);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.tags.some(tag => tag.toLowerCase().includes(q)) ||
        d.uploadedBy.toLowerCase().includes(q)
      );
    }

    return result;
  }, [documents, filters]);

  return (
    <div className="fade-in">
      <PageHeader title="Document Vault" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="section-title">Document Library</div>
        <button
          onClick={() => setShowUploadModal(true)}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.target.style.opacity = 0.9; }}
          onMouseLeave={e => { e.target.style.opacity = 1; }}
        >
          + Upload Document
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24,
        background: 'var(--surface)', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Buyer
          </label>
          <select
            value={filters.buyer}
            onChange={e => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            {buyers.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Type
          </label>
          <select
            value={filters.type}
            onChange={e => setFilters(prev => ({ ...prev, type: e.target.value }))}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Season
          </label>
          <select
            value={filters.season}
            onChange={e => setFilters(prev => ({ ...prev, season: e.target.value }))}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12, background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', outline: 'none',
            }}
          >
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ gridColumn: 'span 1' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Search
          </label>
          <input
            type="text"
            placeholder="Search name, tags, user..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            style={{
              width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
              fontSize: 12, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Clear filters button */}
      {(filters.buyer !== 'All' || filters.type !== 'All' || filters.season !== 'All' || filters.search) && (
        <div style={{ marginBottom: 16, textAlign: 'right' }}>
          <button
            onClick={() => setFilters({ buyer: 'All', type: 'All', season: 'All', search: '' })}
            style={{
              fontSize: 12, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)',
              padding: '6px 12px', borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Stats */}
      {!loading && documents.length > 0 && (
        <div style={{ marginBottom: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          Loading documents...
        </div>
      )}

      {/* Documents grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {filtered.map(doc => (
            <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && documents.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
          <div style={{ marginBottom: 12 }}>No documents yet</div>
          <button
            onClick={() => setShowUploadModal(true)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.opacity = 0.9; }}
            onMouseLeave={e => { e.target.style.opacity = 1; }}
          >
            Upload your first document
          </button>
        </div>
      )}

      {/* No results state */}
      {!loading && documents.length > 0 && filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          No documents match your filters
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => !uploading && setShowUploadModal(false)}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}
    </div>
  );
}
