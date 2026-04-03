import React, { useState, useMemo, useCallback, useEffect } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

/* ── Column definitions ── */
const TEXT_COLS = [
  { key: 'folder', label: 'Folder #' },
  { key: 'lot', label: 'Lot' },
  { key: 'container', label: 'Container #' },
  { key: 'invoice', label: 'Invoice' },
];
const METHOD_OPTIONS = ['Air', 'Ship'];
const CHECK_COLS = [
  { key: 'received', label: 'Received' },
  { key: 'pts_issued', label: 'PTs Issued' },
  { key: 'ats_remaining', label: 'ATS Remaining' },
  { key: 'qb', label: 'QB' },
];

const emptyRow = () => ({
  _id: Date.now() + Math.random(),
  folder: '', lot: '', method: '', container: '', invoice: '',
  eta: '', notes: '', cut_tickets: '',
  received: false, pts_issued: false, ats_remaining: false, qb: false,
});

const isComplete = (r) => CHECK_COLS.every(c => r[c.key]);

const CONTAINERS_CACHE_KEY = 'containers_cached_data';

/* ── Cut Ticket Picker Popup ── */
function CutTicketPicker({ value, onChange, availableCTs }) {
  const [open, setOpen] = useState(false);
  const [ctSearch, setCTSearch] = useState('');
  const ref = React.useRef(null);
  const triggerRef = React.useRef(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const selected = useMemo(() => {
    return (value || '').split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  const filtered = useMemo(() => {
    if (!ctSearch) return availableCTs;
    const q = ctSearch.toLowerCase();
    return availableCTs.filter(ct => ct.toLowerCase().includes(q));
  }, [availableCTs, ctSearch]);

  const toggle = (ct) => {
    const newSet = new Set(selected);
    if (newSet.has(ct)) newSet.delete(ct);
    else newSet.add(ct);
    onChange([...newSet].join(', '));
  };

  // Calculate dropdown position when opening
  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropH = 420;
      // Open upward if not enough space below
      if (spaceBelow < dropH && rect.top > spaceBelow) {
        setDropPos({ top: rect.top - Math.min(dropH, rect.top - 8), left: rect.left });
      } else {
        setDropPos({ top: rect.bottom + 2, left: rect.left });
      }
    }
    setOpen(!open);
  };

  // Close on outside click — use the popup ref
  const popupRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on scroll so dropdown doesn't float away
  React.useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        ref={triggerRef}
        onClick={handleOpen}
        style={{
          minWidth: 120, minHeight: 28, padding: '3px 8px', cursor: 'pointer',
          border: '1px solid var(--border)', borderRadius: 4, fontSize: 11,
          background: 'var(--surface)', color: 'var(--text)',
          display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center',
        }}
      >
        {selected.length > 0 ? selected.map(ct => (
          <span key={ct} style={{
            background: 'var(--accent)', color: '#fff', borderRadius: 4,
            padding: '1px 6px', fontSize: 10, fontWeight: 600,
          }}>{ct}</span>
        )) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Select CTs...</span>
        )}
      </div>
      {open && (
        <div ref={popupRef} style={{
          position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          width: 240, maxHeight: 420, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <input
              placeholder="Search CTs..."
              value={ctSearch}
              onChange={e => setCTSearch(e.target.value)}
              style={{
                width: '100%', border: '1px solid var(--border)', borderRadius: 4,
                padding: '4px 8px', fontSize: 11, background: 'var(--bg)', color: 'var(--text)', outline: 'none',
              }}
              autoFocus
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 360, padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>No cut tickets found</div>
            )}
            {filtered.map(ct => (
              <div
                key={ct}
                onClick={() => toggle(ct)}
                style={{
                  padding: '5px 12px', cursor: 'pointer', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: selected.includes(ct) ? 'rgba(107,127,94,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (!selected.includes(ct)) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (!selected.includes(ct)) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                  border: selected.includes(ct) ? '2px solid var(--success)' : '2px solid var(--border)',
                  background: selected.includes(ct) ? 'var(--success)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected.includes(ct) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontWeight: selected.includes(ct) ? 600 : 400 }}>{ct}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Containers() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ col: null, dir: 'asc' });
  const [saveMsg, setSaveMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [availableCTs, setAvailableCTs] = useState([]);

  /* Cache helpers — persist to localStorage as backup */
  const cacheRows = useCallback((data) => {
    try { localStorage.setItem(CONTAINERS_CACHE_KEY, JSON.stringify({ rows: data, ts: Date.now() })); } catch { /* noop */ }
  }, []);

  /* Load available cut tickets from po_tracking */
  useEffect(() => {
    api.get('/warehouse-orders?limit=5000&scope=shipping').then(res => {
      const data = res.data?.data || res.data || [];
      const cts = [...new Set(data.map(o => o.ticket_number).filter(Boolean))].sort();
      setAvailableCTs(cts);
    }).catch(() => {});
  }, []);

  /* Load from database on mount, fall back to localStorage cache */
  useEffect(() => {
    api.get('/containers').then(res => {
      if (res.data && res.data.length) {
        const loaded = res.data.map(r => ({
          ...r,
          _id: r.id,
          eta: r.eta ? r.eta.split('T')[0] : '',
        }));
        setRows(loaded);
        cacheRows(loaded); // keep cache in sync
      } else {
        // DB empty — try localStorage cache
        try {
          const stored = JSON.parse(localStorage.getItem(CONTAINERS_CACHE_KEY));
          if (stored && stored.rows && stored.rows.length) setRows(stored.rows);
        } catch { /* noop */ }
      }
    }).catch(() => {
      // API down — load from cache
      try {
        const stored = JSON.parse(localStorage.getItem(CONTAINERS_CACHE_KEY));
        if (stored && stored.rows && stored.rows.length) setRows(stored.rows);
      } catch { /* noop */ }
    });
  }, [cacheRows]);

  const saveData = async () => {
    setSaving(true);
    try {
      const payload = rows.map(r => ({
        id: typeof r._id === 'number' && r.id ? r.id : undefined,
        folder: r.folder, lot: r.lot, container: r.container, invoice: r.invoice,
        method: r.method, eta: r.eta || null, notes: r.notes, cut_tickets: r.cut_tickets || '',
        received: r.received, pts_issued: r.pts_issued,
        ats_remaining: r.ats_remaining, qb: r.qb,
      }));
      const res = await api.post('/containers/bulk', { rows: payload });
      // Update rows with server IDs
      const saved = res.data.map(r => ({
        ...r,
        _id: r.id,
        eta: r.eta ? r.eta.split('T')[0] : '',
      }));
      setRows(saved);
      cacheRows(saved); // persist to localStorage backup
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 1500);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Could not save to database.');
    }
    setSaving(false);
  };

  /* Auto-cache whenever rows change */
  useEffect(() => {
    if (rows.length > 0) cacheRows(rows);
  }, [rows, cacheRows]);

  /* ── Row CRUD ── */
  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const updateCell = useCallback((id, key, value) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, [key]: value } : r));
  }, []);

  const deleteRow = useCallback((id) => {
    setRows(prev => prev.filter(r => r._id !== id));
  }, []);

  /* ── Split active vs completed ── */
  const activeRows = useMemo(() => rows.filter(r => !isComplete(r)), [rows]);
  const completedRows = useMemo(() => rows.filter(r => isComplete(r)), [rows]);

  /* ── Search + sort (active only) ── */
  const displayRows = useMemo(() => {
    let filtered = activeRows;
    if (search) {
      const q = search.toLowerCase();
      filtered = activeRows.filter(r =>
        TEXT_COLS.some(c => (r[c.key] || '').toLowerCase().includes(q)) ||
        (r.method || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    if (sort.col) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sort.col] ?? '';
        const bv = b[sort.col] ?? '';
        if (av < bv) return sort.dir === 'asc' ? -1 : 1;
        if (av > bv) return sort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [activeRows, search, sort]);

  const toggleSort = (col) => {
    setSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  /* ── CSV Export ── */
  const exportCSV = () => {
    if (!rows.length) return;
    const allCols = [...TEXT_COLS.map(c => c.key), 'cut_tickets', 'method', 'eta', ...CHECK_COLS.map(c => c.key), 'notes'];
    const labels = [...TEXT_COLS.map(c => c.label), 'Cut Tickets', 'Method', 'ETA', ...CHECK_COLS.map(c => c.label), 'Notes'];
    const csvRows = rows.map(r => allCols.map(k => {
      const v = r[k];
      if (typeof v === 'boolean') return v ? '"Yes"' : '"No"';
      return `"${String(v || '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [labels.map(l => `"${l}"`).join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `containers-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Styles ── */
  const thStyle = { padding: '8px 8px', cursor: 'pointer', userSelect: 'none', fontSize: 11 };
  const cellInput = {
    width: '100%', border: '1px solid var(--border)', borderRadius: 4,
    padding: '5px 8px', fontSize: 12, fontFamily: 'inherit',
    background: 'var(--surface)', color: 'var(--text)', outline: 'none',
  };
  const checkboxWrap = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%',
  };
  const checkboxStyle = (checked) => ({
    width: 20, height: 20, borderRadius: 5, cursor: 'pointer',
    border: checked ? '2px solid var(--success)' : '2px solid var(--border)',
    background: checked ? 'var(--success)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', flexShrink: 0,
  });

  /* ── Summary stats ── */
  const totalContainers = rows.length;
  const airCount = rows.filter(r => r.method === 'Air').length;
  const shipCount = rows.filter(r => r.method === 'Ship').length;
  const recComplete = rows.filter(r => r.received).length;
  const ptsComplete = rows.filter(r => r.pts_issued).length;
  const atsComplete = rows.filter(r => r.ats_remaining).length;
  const qbComplete = rows.filter(r => r.qb).length;

  const sortArrow = (col) => sort.col === col
    ? (sort.dir === 'asc' ? ' \u25B2' : ' \u25BC')
    : '';

  /* ── Shared table renderer ── */
  const renderTable = (rowList, options = {}) => {
    const { readOnly, dimmed } = options;
    return (
      <div className="table-wrap" style={{ overflowX: 'auto', ...(dimmed ? { opacity: 0.85 } : {}) }}>
        <table style={{ tableLayout: 'auto', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              {TEXT_COLS.map(c => (
                <th key={c.key} style={thStyle} onClick={readOnly ? undefined : () => toggleSort(c.key)}>
                  {c.label}{readOnly ? '' : sortArrow(c.key)}
                </th>
              ))}
              <th style={{ ...thStyle, minWidth: 140 }}>Cut Tickets</th>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>ETA</th>
              {CHECK_COLS.map(c => (
                <th key={c.key} style={{ ...thStyle, textAlign: 'center', minWidth: 90 }}>
                  {c.label}
                </th>
              ))}
              <th style={{ ...thStyle, minWidth: 140, cursor: 'default' }}>Notes</th>
              <th style={{ ...thStyle, width: 40, cursor: 'default', textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {rowList.map(r => (
              <tr key={r._id} style={dimmed ? { background: 'rgba(34,197,94,0.04)' } : {}}>
                {/* Text inputs */}
                {TEXT_COLS.map(c => (
                  <td key={c.key} style={{ padding: '4px 5px' }}>
                    <input
                      value={r[c.key] || ''}
                      onChange={e => updateCell(r._id, c.key, e.target.value)}
                      placeholder={c.label}
                      style={{
                        ...cellInput,
                        ...(c.key === 'folder' ? { fontWeight: 600, minWidth: 80 } : {}),
                        ...(c.key === 'container' ? { minWidth: 110 } : {}),
                        ...(c.key === 'invoice' ? { minWidth: 90 } : {}),
                        ...(c.key === 'lot' ? { minWidth: 70 } : {}),
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                    />
                  </td>
                ))}

                {/* Cut Tickets picker */}
                <td style={{ padding: '4px 5px' }}>
                  <CutTicketPicker
                    value={r.cut_tickets || ''}
                    onChange={val => updateCell(r._id, 'cut_tickets', val)}
                    availableCTs={availableCTs}
                  />
                </td>

                {/* Method dropdown */}
                <td style={{ padding: '4px 5px' }}>
                  <select
                    value={r.method || ''}
                    onChange={e => updateCell(r._id, 'method', e.target.value)}
                    style={{
                      ...cellInput, cursor: 'pointer', minWidth: 70,
                      color: r.method ? 'var(--text)' : 'var(--text-muted)',
                    }}
                  >
                    <option value="">—</option>
                    {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>

                {/* ETA date */}
                <td style={{ padding: '4px 5px' }}>
                  <input
                    type="date"
                    value={r.eta || ''}
                    onChange={e => updateCell(r._id, 'eta', e.target.value)}
                    style={{ ...cellInput, minWidth: 120, cursor: 'pointer' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                  />
                </td>

                {/* Checkbox cells */}
                {CHECK_COLS.map(c => (
                  <td key={c.key} style={{ padding: '4px 5px' }}>
                    <div style={checkboxWrap}>
                      <div
                        onClick={() => updateCell(r._id, c.key, !r[c.key])}
                        style={checkboxStyle(r[c.key])}
                      >
                        {r[c.key] && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </td>
                ))}

                {/* Notes */}
                <td style={{ padding: '4px 5px' }}>
                  <input
                    value={r.notes || ''}
                    onChange={e => updateCell(r._id, 'notes', e.target.value)}
                    placeholder="Add note..."
                    style={{ ...cellInput, minWidth: 130 }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                  />
                </td>

                {/* Delete */}
                <td style={{ padding: '4px 5px', textAlign: 'center' }}>
                  <button
                    onClick={() => deleteRow(r._id)}
                    title="Remove row"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 14, fontFamily: 'inherit',
                      padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { e.target.style.color = 'var(--danger)'; }}
                    onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; }}
                  >&#10005;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <PageHeader title="Containers" />
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">Containers</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {rows.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={exportCSV}
              style={{ fontSize: 12, padding: '6px 16px' }}>
              Generate
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Row</button>
          {rows.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={saveData} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          )}
          {saveMsg && (
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{saveMsg}</span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex', gap: 0, marginBottom: 20,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          {[
            { label: 'Total', value: totalContainers, color: 'var(--text)' },
            { label: 'Air', value: airCount, color: 'var(--accent)' },
            { label: 'Ship', value: shipCount, color: 'var(--blue, #3b82f6)' },
            { label: 'Received', value: `${recComplete}/${totalContainers}`, color: recComplete === totalContainers && totalContainers > 0 ? 'var(--success)' : 'var(--warning)' },
            { label: 'PTs Issued', value: `${ptsComplete}/${totalContainers}`, color: ptsComplete === totalContainers && totalContainers > 0 ? 'var(--success)' : 'var(--warning)' },
            { label: 'ATS Rem.', value: `${atsComplete}/${totalContainers}`, color: atsComplete === totalContainers && totalContainers > 0 ? 'var(--success)' : 'var(--warning)' },
            { label: 'QB', value: `${qbComplete}/${totalContainers}`, color: qbComplete === totalContainers && totalContainers > 0 ? 'var(--success)' : 'var(--warning)' },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, padding: '12px 14px', textAlign: 'center',
              borderRight: i < 6 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input
            className="search-input"
            style={{ maxWidth: 240 }}
            placeholder="Search containers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear</button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {displayRows.length} active{displayRows.length !== 1 ? '' : ''} &middot; {completedRows.length} completed
          </span>
        </div>
      )}

      {/* Active Table */}
      {displayRows.length > 0 && (
        <>
          {renderTable(displayRows)}
          <div style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: 12 }}>
            {displayRows.length} active container{displayRows.length !== 1 ? 's' : ''}
          </div>
        </>
      )}

      {/* Empty state */}
      {rows.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 48, color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        }}>
          No containers yet. Click <strong>+ Add Row</strong> to start tracking.
        </div>
      )}

      {rows.length > 0 && displayRows.length === 0 && completedRows.length > 0 && !search && (
        <div style={{
          textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16,
        }}>
          All containers have been completed.
        </div>
      )}

      {/* Completed Shipments */}
      {completedRows.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--success)',
            }} />
            <span style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text)',
              letterSpacing: 0.2,
            }}>Completed Shipments</span>
            <span style={{
              fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
              background: 'var(--surface2)', padding: '2px 8px', borderRadius: 10,
            }}>{completedRows.length}</span>
          </div>
          {renderTable(completedRows, { readOnly: true, dimmed: true })}
        </div>
      )}
    </div>
  );
}
