import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Database, Upload, ChevronDown, ChevronRight, Link2, Unlink, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const CACHE_KEY = 'ua_consolidated_cache';

export default function ConsolidatedDB() {
  const toast = useToast();

  // ─── State ───
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDragover, setUploadDragover] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ─── Load data on mount ───
  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/consolidated-db');
      if (res.data && Array.isArray(res.data)) {
        setRecords(res.data);
        cacheData(res.data);
      }
    } catch (err) {
      console.error('Load error:', err);
      // Fallback to cache
      const cached = getCachedData();
      if (cached && cached.length) {
        setRecords(cached);
        toast.warning('Showing cached data. Could not connect to server.');
      } else {
        toast.error('Could not load consolidated database.');
      }
    }
    setLoading(false);
  };

  const cacheData = (data) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    } catch { /* noop */ }
  };

  const getCachedData = () => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.data || [];
      }
    } catch { /* noop */ }
    return [];
  };

  // ─── Filtering and search ───
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Text search across multiple fields
      const searchTerm = searchQuery.toLowerCase();
      const matchesSearch = !searchTerm ||
        (r.po && r.po.toLowerCase().includes(searchTerm)) ||
        (r.style_number && r.style_number.toLowerCase().includes(searchTerm)) ||
        (r.so_number && r.so_number.toLowerCase().includes(searchTerm)) ||
        (r.ct_number && r.ct_number.toLowerCase().includes(searchTerm)) ||
        (r.buyer && r.buyer.toLowerCase().includes(searchTerm)) ||
        (r.description && r.description.toLowerCase().includes(searchTerm));

      // Status filter
      const matchesStatus = filterStatus === 'all' || r.link_status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, filterStatus]);

  // ─── Summary stats ───
  const stats = useMemo(() => {
    const total = records.length;
    const linked = records.filter(r => r.link_status === 'linked').length;
    const partial = records.filter(r => r.link_status === 'partial').length;
    const missing = records.filter(r => r.link_status === 'missing').length;
    return { total, linked, partial, missing };
  }, [records]);

  // ─── Status badge rendering ───
  const statusBadge = (status) => {
    const badges = {
      linked: { class: 'badge-success', icon: Link2, label: 'Linked' },
      partial: { class: 'badge-warning', icon: AlertTriangle, label: 'Partial' },
      missing: { class: 'badge-danger', icon: Unlink, label: 'Missing' },
    };
    const badge = badges[status] || { class: 'badge-neutral', icon: Database, label: status };
    const Icon = badge.icon;
    return (
      <span className={`badge ${badge.class}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} />
        {badge.label}
      </span>
    );
  };

  // ─── Upload handlers ───
  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setUploadDragover(true);
  };

  const handleDragLeave = () => {
    setUploadDragover(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setUploadDragover(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = async (files) => {
    const csvFile = files.find(f => f.name.endsWith('.csv'));
    if (!csvFile) {
      toast.error('Please upload a CSV file.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.post('/consolidated-db/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data) {
        setRecords(res.data);
        cacheData(res.data);
        setShowUploadModal(false);
        toast.success(`Imported ${res.data.length} records.`);
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to import CSV. Check format and try again.');
    }
    setUploading(false);
  };

  // ─── Row expansion ───
  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header with Upload Button */}
      <PageHeader
        title="Consolidated Database"
      >
        <button
          className="btn btn-primary"
          onClick={handleUploadClick}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Upload size={18} />
          Upload CSV
        </button>
      </PageHeader>

      {/* Search Bar */}
      <div className="search-bar" style={{ marginBottom: 28 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search by PO, Style, SO#, CT#, Buyer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ paddingLeft: 44 }}
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="filter-pills" style={{ marginBottom: 28 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'linked', label: 'Linked' },
          { key: 'partial', label: 'Partial' },
          { key: 'missing', label: 'Missing' },
        ].map(f => (
          <button
            key={f.key}
            className={`filter-pill ${filterStatus === f.key ? 'active' : ''}`}
            onClick={() => setFilterStatus(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{stats.total.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Linked</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.linked.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Partial</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.partial.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Missing</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.missing.toLocaleString()}</div>
        </div>
      </div>

      {/* Results Table */}
      {loading ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)',
        }}>
          <Database size={40} style={{ opacity: 0.5, marginBottom: 16, display: 'block' }} />
          Loading database...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)',
        }}>
          <Search size={40} style={{ opacity: 0.5, marginBottom: 16, display: 'block' }} />
          {searchQuery || filterStatus !== 'all' ? 'No records match your filters.' : 'No records found.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>PO</th>
                <th>Style</th>
                <th>SO#</th>
                <th>PT#</th>
                <th>CT#</th>
                <th>Buyer</th>
                <th>Status</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <React.Fragment key={record.id || `${record.po}-${record.style_number}`}>
                  {/* Main Row */}
                  <tr style={{ cursor: 'pointer' }}>
                    <td onClick={() => toggleExpand(record.id)} style={{ textAlign: 'center' }}>
                      {expandedId === record.id ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{record.po || '—'}</td>
                    <td>{record.style_number || '—'}</td>
                    <td>{record.so_number || '—'}</td>
                    <td>{record.pt_number || '—'}</td>
                    <td>{record.ct_number || '—'}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-dim)' }}>{record.buyer || '—'}</td>
                    <td>{statusBadge(record.link_status)}</td>
                    <td style={{ fontSize: 14, color: 'var(--text-dim)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {record.description || '—'}
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedId === record.id && (
                    <tr style={{ background: 'var(--surface2)' }}>
                      <td colSpan="9" style={{ padding: '20px 24px' }}>
                        <div className="card" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                            {/* Color */}
                            {record.color && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                                  Color
                                </div>
                                <div style={{ fontSize: 15, color: 'var(--text)' }}>
                                  <span style={{
                                    display: 'inline-block', width: 20, height: 20, borderRadius: 4,
                                    marginRight: 10, verticalAlign: 'middle', border: '1px solid var(--border)',
                                    backgroundColor: record.color === 'white' || record.color === 'cream' ? '#fafafa' : record.color,
                                  }} />
                                  {record.color}
                                </div>
                              </div>
                            )}

                            {/* Link Status Details */}
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                                Link Status
                              </div>
                              <div>{statusBadge(record.link_status)}</div>
                            </div>

                            {/* Related Orders */}
                            {(record.related_orders && record.related_orders.length > 0) && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                                  Related Orders
                                </div>
                                <div style={{ fontSize: 14 }}>
                                  {record.related_orders.map((ord, i) => (
                                    <div key={i} style={{ marginBottom: 6 }}>
                                      <span style={{ fontWeight: 600 }}>{ord.type}:</span> {ord.number}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Created Date */}
                            {record.created_at && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                                  Created
                                </div>
                                <div style={{ fontSize: 15, color: 'var(--text)' }}>
                                  {new Date(record.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            )}

                            {/* Updated Date */}
                            {record.updated_at && (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontWeight: 600 }}>
                                  Updated
                                </div>
                                <div style={{ fontSize: 15, color: 'var(--text)' }}>
                                  {new Date(record.updated_at).toLocaleDateString()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay active" style={{ display: 'flex' }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 700 }}>Import CSV</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
              Upload a CSV file to import consolidated database records. Expected columns: po, style_number, so_number, pt_number, ct_number, buyer, description, color, link_status.
            </p>

            {/* Drop Zone */}
            <div
              className={`drop-zone ${uploadDragover ? 'dragover' : ''} ${uploading ? '' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                opacity: uploading ? 0.6 : 1,
                pointerEvents: uploading ? 'none' : 'auto',
              }}
            >
              <div className="drop-zone-icon">
                <Upload size={24} />
              </div>
              <div className="drop-zone-title">Drop CSV file here</div>
              <div className="drop-zone-desc">or click to select</div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                disabled={uploading}
                style={{
                  position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                  pointerEvents: uploading ? 'none' : 'auto',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>

            {uploading && (
              <div style={{ marginTop: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                Importing... please wait.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
