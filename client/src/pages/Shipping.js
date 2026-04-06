import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const SHIPPING_CACHE_KEY = 'ua_shipping_cache';
const loadCachedOrders = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(SHIPPING_CACHE_KEY));
    if (cached && Array.isArray(cached.data) && cached.ts > Date.now() - 24 * 60 * 60 * 1000) {
      return cached.data;
    }
  } catch { /* ignore */ }
  return [];
};
const saveCachedOrders = (data) => {
  try { localStorage.setItem(SHIPPING_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); }
  catch { /* ignore */ }
};

export default function Shipping() {
  const toast = useToast();
  const [orders, setOrders] = useState(() => loadCachedOrders());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState({ warehouse: '', status: '', search: '', store: '', pastDue: false });
  const [dateFilter, setDateFilter] = useState({ field: '', compare: 'on', date: '' });
  const [dragOver, setDragOver] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [sort, setSort] = useState({ col: null, dir: 'asc' });
  const [edits, setEdits] = useState({}); // { orderId: { field: value } }
  const [saving, setSaving] = useState({}); // { orderId: true/false }
  const [showAll, setShowAll] = useState(false);

  const updateField = async (orderId, field, value) => {
    setSaving(prev => ({ ...prev, [orderId]: true }));
    try {
      await api.put(`/warehouse-orders/${orderId}`, { [field]: value });
      // Update local orders state
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
      setEdits(prev => {
        const copy = { ...prev };
        if (copy[orderId]) { delete copy[orderId][field]; if (Object.keys(copy[orderId]).length === 0) delete copy[orderId]; }
        return copy;
      });
    } catch (err) {
      toast.error('Save failed: ' + (err.response?.data?.error || err.message));
    }
    setSaving(prev => ({ ...prev, [orderId]: false }));
  };

  const getEditValue = (order, field) => {
    if (edits[order.id] && edits[order.id][field] !== undefined) return edits[order.id][field];
    if (field === 'start_date' || field === 'cancel_date') return (order[field] || '').split('T')[0];
    return order[field] || '';
  };

  const setEditValue = (orderId, field, value) => {
    setEdits(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), [field]: value } }));
  };

  const handleFieldBlur = (order, field) => {
    const newVal = getEditValue(order, field);
    const origVal = field === 'start_date' || field === 'cancel_date'
      ? (order[field] || '').split('T')[0]
      : (order[field] || '');
    if (newVal !== origVal) {
      updateField(order.id, field, newVal);
    }
  };
  const NOTES_KEY = 'ua_routing_notes';
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(NOTES_KEY) || ''; } catch { return ''; }
  });
  const notesTimer = useRef(null);
  const handleNotesChange = (val) => {
    setNotes(val);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      try { localStorage.setItem(NOTES_KEY, val); } catch { /* ignore */ }
    }, 400);
  };

  const [larryUploading, setLarryUploading] = useState(false);
  const [larryResult, setLarryResult] = useState(null);
  const [gsheetUrl, setGsheetUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const larryFileRef = useRef();

  const LARRY_SHEET_ID = '1uiisYbU9PCkw3n6UuoO7VWkxPyaUDpAo0gI_XNAoGts';
  const LARRY_SHEET_URL = `https://docs.google.com/spreadsheets/d/${LARRY_SHEET_ID}/edit?gid=0#gid=0`;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/agents/larry/upload-url', { url: LARRY_SHEET_URL });
      const bd = res.data.status_breakdown || {};
      const parts = Object.entries(bd).map(([k,v]) => `${k}: ${v}`).join(', ');
      const failMsg = res.data.failed > 0 ? ` | ${res.data.failed} failed` : '';
      toast.success(`Synced ${res.data.imported} of ${res.data.total_parsed} parsed POs (${parts})${failMsg}`);
      loadOrders();
    } catch (err) {
      toast.error('Sync failed: ' + (err.response?.data?.error || err.response?.data?.details || err.message));
    }
    setSyncing(false);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 5000, ...filter };
      // Only apply the server-side shipping scope when NOT in showAll mode
      if (!showAll) params.scope = 'shipping';
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await api.get('/warehouse-orders', { params });
      const fresh = Array.isArray(res.data?.data) ? res.data.data : [];
      setOrders(fresh);
      saveCachedOrders(fresh);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [filter, showAll]);

  // Load on mount
  useEffect(() => {
    if (!initialLoaded) { loadOrders(); setInitialLoaded(true); }
  }, [initialLoaded, loadOrders]);

  // Reload when filters or showAll change (after initial load)
  useEffect(() => {
    if (initialLoaded) { loadOrders(); }
  }, [filter.warehouse, filter.status, showAll, initialLoaded, loadOrders]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/uploads/warehouse', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Uploaded! ${res.data.rowsInserted} rows imported.`);
      loadOrders();
    } catch (err) { toast.error('Upload failed: ' + (err.response?.data?.error || err.message)); }
    setUploading(false);
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); };

  /* ── For Larry's Eyes Only upload ── */
  const handleLarryUpload = async (file) => {
    if (!file) return;
    setLarryUploading(true);
    setLarryResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/agents/larry/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLarryResult({ success: true, ...res.data });
      loadOrders(); // refresh table
    } catch (err) {
      setLarryResult({ success: false, error: err.response?.data?.error || 'Upload failed' });
    }
    setLarryUploading(false);
  };

  const handleGSheetFetch = async () => {
    if (!gsheetUrl.trim()) return;
    setLarryUploading(true);
    setLarryResult(null);
    try {
      const res = await api.post('/agents/larry/upload-url', { url: gsheetUrl });
      setLarryResult({ success: true, ...res.data });
      setGsheetUrl('');
      loadOrders();
    } catch (err) {
      setLarryResult({ success: false, error: err.response?.data?.error || 'Failed to fetch Google Sheet' });
    }
    setLarryUploading(false);
  };

  const statusBadge = (status, order) => {
    // Check if past cancel date and not routed — but not when "Not Routed" filter is active
    if (order && order.routing_status === 'not_routed' && order.cancel_date && !filter.status.includes('not_routed')) {
      const cxlStr = String(order.cancel_date).split('T')[0];
      if (cxlStr && cxlStr < todayStr) {
        return <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10,
          fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap',
          background: 'rgba(239,68,68,0.15)', color: '#dc2626', border: '1px solid #ef4444',
        }}>Past CXL</span>;
      }
    }
    const map = {
      shipped: { cls: 'badge-success', label: 'Shipped' },
      routed: { cls: 'badge-success', label: 'Routed' },
      not_routed: { cls: 'badge-warning', label: 'Not Routed' },
      cancelled: { cls: 'badge-danger', label: 'Cancelled' },
      issue: { cls: 'badge-danger', label: 'Issue' },
    };
    const s = map[status] || { cls: 'badge-neutral', label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  /* ---- Clickable stat handler ---- */
  const handleStatClick = (warehouse, statusGroup) => {
    // If clicking the same filter that's already active, clear it
    if (filter.warehouse === warehouse && filter.status === statusGroup && !filter.pastDue) {
      setFilter(f => ({ ...f, warehouse: '', status: '', pastDue: false }));
      setDateFilter({ field: '', compare: 'on', date: '' });
    } else {
      // Scope to the same Monday-based 2-week window so counts match the summary cards
      setFilter(f => ({ ...f, warehouse, status: statusGroup, pastDue: false }));
      setDateFilter({ field: '', compare: 'on', date: '' }); // clear explicit filter → use default 2-week window
    }
  };

  const handlePastDueClick = () => {
    if (filter.pastDue) {
      setFilter(f => ({ ...f, pastDue: false, status: '', warehouse: '' }));
      setDateFilter({ field: '', compare: 'on', date: '' });
    } else {
      setFilter(f => ({ ...f, pastDue: true, status: '', warehouse: '' }));
      setDateFilter({ field: '', compare: 'on', date: '' });
    }
  };

  /* ---- Row color coding by routing status ---- */
  const rowBg = (order) => {
    // Past CXL: not routed and cancel date is in the past
    if (order.routing_status === 'not_routed' && order.cancel_date) {
      const cxlStr = String(order.cancel_date).split('T')[0];
      if (cxlStr && cxlStr < todayStr) return 'rgba(239,68,68,0.10)'; // light red
    }
    const status = order.routing_status;
    if (status === 'shipped') return 'rgba(22,163,74,0.18)';   // deeper green for shipped
    if (status === 'routed') return 'rgba(34,197,94,0.10)';   // light green
    if (status === 'not_routed') return 'rgba(196,154,64,0.09)'; // light amber/warning
    if (status === 'cancelled' || status === 'issue') return 'rgba(239,68,68,0.06)';
    return 'transparent';
  };

  /* ---- Sorting ---- */
  const lifecycleBadge = (lifecycle) => {
    if (!lifecycle) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
    const map = {
      'Shipped': { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '#16a34a' },
      'Routed': { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', border: '#2563eb' },
      'In Transit': { bg: 'rgba(168,85,247,0.12)', color: '#7c3aed', border: '#7c3aed' },
      'In Production': { bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: '#d97706' },
    };
    const s = map[lifecycle] || { bg: 'var(--surface2)', color: 'var(--text-muted)', border: 'var(--border)' };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10,
        fontWeight: 600, letterSpacing: 0.3, whiteSpace: 'nowrap',
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>{lifecycle}</span>
    );
  };

  const columns = [
    { key: 'po', label: 'PO' },
    { key: 'ticket_number', label: 'Ticket' },
    { key: 'store_name', label: 'Store' },
    { key: 'start_date', label: 'Start' },
    { key: 'cancel_date', label: 'Cancel' },
    { key: 'warehouse_code', label: 'WH' },
    { key: 'routing', label: 'Routing' },
    { key: 'routing_status', label: 'Status' },
    { key: 'lifecycle', label: 'Stage' },
    { key: 'shipment_info', label: 'Shipment Info' },
  ];

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    );
  };

  const sortedOrders = useMemo(() => {
    if (!sort.col) return orders;
    const sorted = [...orders].sort((a, b) => {
      const av = a[sort.col] ?? '';
      const bv = b[sort.col] ?? '';
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [orders, sort]);

  /* ---- Two-week window anchored to this Monday (resets each Monday) ---- */
  // Use YYYY-MM-DD strings for all date comparisons to avoid timezone issues
  // (PostgreSQL returns dates as UTC midnight; JS Date comparison shifts them in local TZ)
  const toDateStr = (d) => d.toISOString().split('T')[0]; // YYYY-MM-DD
  const today = useMemo(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); // noon to avoid DST edge cases
    return d;
  }, []);
  const todayStr = useMemo(() => toDateStr(today), [today]);
  const weekStart = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay(); // 0=Sun, 1=Mon
    // Go to THIS week's Monday (if today is Sun, go forward to tomorrow Mon)
    if (day === 0) {
      d.setDate(d.getDate() + 1); // Sunday → next day Monday
    } else if (day > 1) {
      d.setDate(d.getDate() - (day - 1)); // Tue-Sat → back to Monday
    }
    // day === 1 means today IS Monday, no change needed
    return d;
  }, [today]);
  const weekStartStr = useMemo(() => toDateStr(weekStart), [weekStart]);
  const twoWeekEnd = useMemo(() => {
    const c = new Date(weekStart);
    c.setDate(c.getDate() + 13); // Mon through Sun of the following week = 14 days
    return c;
  }, [weekStart]);
  const twoWeekEndStr = useMemo(() => toDateStr(twoWeekEnd), [twoWeekEnd]);

  /* ---- Store filter: extract unique stores ---- */
  const uniqueStores = useMemo(() => {
    const stores = new Set();
    orders.forEach(o => { if (o.store_name) stores.add(o.store_name); });
    return [...stores].sort();
  }, [orders]);

  /* ---- Date filter (client-side) ---- */
  /* Default: show only next-2-week orders. If user sets an explicit date filter, use that instead. */
  const displayOrders = useMemo(() => {
    // Helper: extract YYYY-MM-DD from a date value (handles ISO strings and Date objects)
    const dateStr = (raw) => {
      if (!raw) return '';
      return String(raw).split('T')[0]; // "2026-04-14T00:00:00.000Z" → "2026-04-14"
    };

    // Past-due mode: show all past-due not-routed orders
    if (filter.pastDue) {
      return sortedOrders.filter(o => {
        if (o.routing_status !== 'not_routed') return false;
        const ds = dateStr(o.cancel_date);
        if (!ds) return false;
        if (ds >= weekStartStr) return false; // not past due
        if (filter.store && o.store_name !== filter.store) return false;
        return true;
      });
    }

    let base = sortedOrders;

    // Store filter
    if (filter.store) {
      base = base.filter(o => o.store_name === filter.store);
    }

    if (dateFilter.field && dateFilter.date) {
      const target = dateFilter.date; // YYYY-MM-DD string
      return base.filter(o => {
        const raw = o[dateFilter.field];
        if (!raw) return false;
        const val = raw.split('T')[0]; // normalize to YYYY-MM-DD
        if (dateFilter.compare === 'on') return val === target;
        if (dateFilter.compare === 'before') return val < target;
        if (dateFilter.compare === 'after') return val > target;
        return true;
      });
    }
    // Show All mode: return everything (future only, skip shipped/cancelled)
    if (showAll) {
      return base.filter(o => {
        const raw = o.cancel_date;
        if (!raw) return true; // include rows with no date
        return true;
      });
    }
    // Default: scope to 2-week window (Monday–Sunday+1wk) by cancel_date
    // Uses string comparison (YYYY-MM-DD) to avoid timezone issues
    const filtered = base.filter(o => {
      const ds = dateStr(o.cancel_date);
      if (!ds) return false;
      return ds >= weekStartStr && ds <= twoWeekEndStr;
    });
    // If the 2-week window has very few results but we have more orders,
    // show all so the page isn't misleadingly sparse
    if (filtered.length < 5 && base.length > filtered.length) return base;
    return filtered;
  }, [sortedOrders, dateFilter, weekStartStr, twoWeekEndStr, filter.pastDue, filter.store, showAll]);

  /* ---- CSV Export ---- */
  const exportCSV = () => {
    if (!displayOrders.length) return;
    const headers = ['PO', 'Ticket', 'Store', 'Start Date', 'Cancel Date', 'Warehouse', 'Routing', 'Status', 'Stage', 'Shipment Info'];
    const rows = displayOrders.map(o => [
      o.po || '', o.ticket_number || '', o.store_name || '',
      o.start_date?.split('T')[0] || '', o.cancel_date?.split('T')[0] || '',
      o.warehouse_code || '', o.routing || '', o.routing_status || '', o.lifecycle || '', o.shipment_info || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sales-tracker-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- Styles ---- */
  const thStyle = { padding: '8px 8px', cursor: 'pointer', userSelect: 'none' };
  const compact = { whiteSpace: 'nowrap', fontSize: 12, padding: '8px 8px' };

  /* Is a stat card filter currently active? Helper for highlight */
  const isStatActive = (wh, statusGroup) => filter.warehouse === wh && filter.status === statusGroup;

  const twoWeekOrders = useMemo(() => {
    return orders.filter(o => {
      const ds = o.cancel_date ? String(o.cancel_date).split('T')[0] : '';
      if (!ds) return false;
      return ds >= weekStartStr && ds <= twoWeekEndStr;
    });
  }, [orders, weekStartStr, twoWeekEndStr]);

  /* ---- Summary by warehouse (computed from displayOrders so stats tie with the table) ---- */
  const summaryByWh = useMemo(() => {
    const map = {};
    displayOrders.forEach(o => {
      const wh = o.warehouse_code;
      if (!wh) return; // skip Unknown / blank warehouses
      if (!map[wh]) map[wh] = { routed: 0, not_routed: 0, shipped: 0, cancelled: 0, issue: 0 };
      const st = o.routing_status || 'not_routed';
      if (map[wh][st] !== undefined) map[wh][st]++;
      else map[wh][st] = 1;
    });
    return map;
  }, [displayOrders]);

  const totalOrders = displayOrders.length;
  const routedTotal = displayOrders.filter(o => o.routing_status === 'routed').length;
  const shippedTotal = displayOrders.filter(o => o.routing_status === 'shipped').length;
  const notRoutedInWarehouse = displayOrders.filter(o => o.routing_status === 'not_routed').length;

  /* ---- Past-due not-routed POs (cancel date in the past, within displayOrders) ---- */
  const pastDueNotRouted = useMemo(() => {
    return displayOrders.filter(o => {
      if (o.routing_status !== 'not_routed') return false;
      const ds = o.cancel_date ? String(o.cancel_date).split('T')[0] : '';
      if (!ds) return false;
      return ds < todayStr;
    });
  }, [displayOrders, today]);

  return (
    <div className="fade-in">
      <PageHeader title="Routing" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button
          onClick={() => setShowAll(!showAll)}
          className={showAll ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          style={{ fontSize: 12, padding: '6px 16px' }}
        >
          {showAll ? 'Show 2 Weeks' : 'Show All POs'}
        </button>
        {/* Actions — top right */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {displayOrders.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={exportCSV}
              style={{ fontSize: 12, padding: '6px 16px' }}>
              Generate
            </button>
          )}
          <input type="file" ref={larryFileRef} accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleLarryUpload(e.target.files[0]); e.target.value = ''; }} />
          <a
            href={LARRY_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, padding: '6px 16px', textDecoration: 'none' }}
          >
            <FileSpreadsheet size={12} strokeWidth={2} /> Open Sheet
          </a>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, padding: '6px 16px', opacity: syncing ? 0.6 : 1 }}
          >
            {syncing ? 'Syncing...' : '↻ Sync'}
          </button>
          {larryResult && (
            <span style={{
              fontSize: 10, fontWeight: 600, maxWidth: 160,
              color: larryResult.success ? '#2D5A3D' : '#B5443B',
            }}>
              {larryResult.success ? `${larryResult.imported} POs imported` : larryResult.error}
            </span>
          )}
        </div>
      </div>

      {/* ── Warehouse Summary Stats ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {displayOrders.length > 0 ? (
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', height: '100%', alignContent: 'flex-start',
            }}>
              {/* Overall summary card — next 2 weeks */}
              <div style={{ flex: '1 1 100%', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {showAll ? 'All POs' : (<>Next 2 Weeks &nbsp;&middot;&nbsp; {(() => {
                  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return `${fmt(weekStart)} — ${fmt(twoWeekEnd)}`;
                })()}</>)}
                &nbsp;&middot;&nbsp; {displayOrders.length} POs
              </div>
              <div style={{
                flex: '1 1 100%', display: 'flex', gap: 0,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                overflow: 'hidden', marginBottom: 4,
              }}>
                <div onClick={() => { setFilter(f => ({ ...f, warehouse: '', status: '' })); setDateFilter({ field: '', compare: 'on', date: '' }); }}
                  style={{ flex: 1, padding: '14px 16px', textAlign: 'center', borderRight: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{totalOrders}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Total POs</div>
                </div>
                <div onClick={() => handleStatClick('', 'routed')}
                  style={{ flex: 1, padding: '14px 16px', textAlign: 'center', borderRight: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                    background: filter.status === 'routed' && !filter.warehouse ? 'rgba(34,197,94,0.08)' : '' }}
                  onMouseEnter={e => { if (filter.status !== 'routed' || filter.warehouse) e.currentTarget.style.background = 'rgba(34,197,94,0.05)'; }}
                  onMouseLeave={e => { if (filter.status !== 'routed' || filter.warehouse) e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{routedTotal}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Routed</div>
                </div>
                <div onClick={() => handleStatClick('', 'shipped')}
                  style={{ flex: 1, padding: '14px 16px', textAlign: 'center', borderRight: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                    background: filter.status === 'shipped' && !filter.warehouse ? 'rgba(22,163,74,0.10)' : '' }}
                  onMouseEnter={e => { if (filter.status !== 'shipped' || filter.warehouse) e.currentTarget.style.background = 'rgba(22,163,74,0.06)'; }}
                  onMouseLeave={e => { if (filter.status !== 'shipped' || filter.warehouse) e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{shippedTotal}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Shipped</div>
                </div>
                <div onClick={() => handleStatClick('', 'not_routed')}
                  style={{ flex: 1, padding: '14px 16px', textAlign: 'center', borderRight: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s',
                    background: filter.status === 'not_routed' && !filter.warehouse ? 'rgba(234,179,8,0.08)' : '' }}
                  onMouseEnter={e => { if (filter.status !== 'not_routed' || filter.warehouse) e.currentTarget.style.background = 'rgba(234,179,8,0.05)'; }}
                  onMouseLeave={e => { if (filter.status !== 'not_routed' || filter.warehouse) e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{notRoutedInWarehouse}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Not Routed</div>
                </div>
                <div onClick={handlePastDueClick}
                  style={{ flex: 1, padding: '14px 16px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s',
                    background: filter.pastDue ? 'rgba(239,68,68,0.08)' : '' }}
                  onMouseEnter={e => { if (!filter.pastDue) e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                  onMouseLeave={e => { if (!filter.pastDue) e.currentTarget.style.background = ''; }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: pastDueNotRouted.length > 0 ? '#ef4444' : 'var(--text-muted)' }}>{pastDueNotRouted.length}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Past Due</div>
                </div>
              </div>

              {/* Per-warehouse cards */}
              {Object.entries(summaryByWh).map(([wh, statuses]) => {
                const whTotal = (statuses.routed || 0) + (statuses.shipped || 0) + (statuses.not_routed || 0) + (statuses.cancelled || 0) + (statuses.issue || 0);
                const routedPct = whTotal > 0 ? Math.round((((statuses.routed || 0) + (statuses.shipped || 0)) / whTotal) * 100) : 0;
                return (
                  <div key={wh} style={{
                    flex: '1 1 calc(50% - 8px)', minWidth: 200,
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    padding: '14px 18px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{wh}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{whTotal} orders</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', marginBottom: 12, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3, width: `${routedPct}%`,
                        background: 'linear-gradient(90deg, var(--success), #4ade80)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div
                        onClick={() => handleStatClick(wh, 'routed')}
                        style={{
                          flex: 1, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, textAlign: 'center',
                          transition: 'all 0.15s',
                          background: isStatActive(wh, 'routed') ? 'rgba(34,197,94,0.12)' : 'var(--surface2)',
                          border: isStatActive(wh, 'routed') ? '1.5px solid var(--success)' : '1.5px solid transparent',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{statuses.routed || 0}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Routed</div>
                      </div>
                      <div
                        onClick={() => handleStatClick(wh, 'shipped')}
                        style={{
                          flex: 1, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, textAlign: 'center',
                          transition: 'all 0.15s',
                          background: isStatActive(wh, 'shipped') ? 'rgba(22,163,74,0.14)' : 'var(--surface2)',
                          border: isStatActive(wh, 'shipped') ? '1.5px solid #16a34a' : '1.5px solid transparent',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{statuses.shipped || 0}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Shipped</div>
                      </div>
                      <div
                        onClick={() => handleStatClick(wh, 'not_routed')}
                        style={{
                          flex: 1, cursor: 'pointer', padding: '6px 8px', borderRadius: 8, textAlign: 'center',
                          transition: 'all 0.15s',
                          background: isStatActive(wh, 'not_routed') ? 'rgba(234,179,8,0.12)' : 'var(--surface2)',
                          border: isStatActive(wh, 'not_routed') ? '1.5px solid var(--warning)' : '1.5px solid transparent',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{statuses.not_routed || 0}</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Not Routed</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              padding: 24, color: 'var(--text-muted)', fontSize: 13,
            }}>
              Upload a warehouse tracker to see summary stats
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      <div style={{
        marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '14px 18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</span>
          {notes && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Auto-saved</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Add routing notes here..."
          style={{
            width: '100%', minHeight: 60, maxHeight: 200, resize: 'vertical',
            border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px',
            fontSize: 13, fontFamily: 'inherit', lineHeight: 1.6,
            background: 'var(--bg)', color: 'var(--text)', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="search-input"
          style={{ maxWidth: 240 }}
          placeholder="Search PO, ticket, style..."
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
        />
        <select className="input" style={{ maxWidth: 140 }} value={filter.warehouse} onChange={e => setFilter(f => ({ ...f, warehouse: e.target.value }))}>
          <option value="">All Warehouses</option>
          <option value="STAR">STAR</option>
          <option value="CSM">CSM</option>
        </select>
        <select className="input" style={{ maxWidth: 160 }} value={filter.store} onChange={e => setFilter(f => ({ ...f, store: e.target.value }))}>
          <option value="">All Stores</option>
          {uniqueStores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Status checkboxes */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          {[
            { value: 'routed', label: 'Routed', color: 'var(--success)' },
            { value: 'not_routed', label: 'Not Routed', color: 'var(--warning)' },
            { value: 'cancelled', label: 'Cancelled', color: 'var(--danger)' },
            { value: 'issue', label: 'Issue', color: 'var(--danger)' },
          ].map(st => {
            const statusArr = filter.status ? filter.status.split(',') : [];
            const isChecked = statusArr.includes(st.value);
            return (
              <label key={st.value} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600,
                color: isChecked ? st.color : 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
                padding: '4px 8px', borderRadius: 5, transition: 'all 0.15s',
                background: isChecked ? 'var(--surface2)' : 'transparent',
              }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    let arr = filter.status ? filter.status.split(',') : [];
                    if (isChecked) arr = arr.filter(s => s !== st.value);
                    else arr.push(st.value);
                    setFilter(f => ({ ...f, status: arr.join(','), pastDue: false }));
                  }}
                  style={{ accentColor: st.color, width: 14, height: 14 }}
                />
                {st.label}
              </label>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
          <select className="input" style={{ width: 120 }} value={dateFilter.field} onChange={e => setDateFilter(f => ({ ...f, field: e.target.value }))}>
            <option value="">Date Filter</option>
            <option value="start_date">Start Ship</option>
            <option value="cancel_date">Cancel Date</option>
          </select>
          {dateFilter.field && (
            <>
              <select className="input" style={{ width: 90 }} value={dateFilter.compare} onChange={e => setDateFilter(f => ({ ...f, compare: e.target.value }))}>
                <option value="before">Before</option>
                <option value="on">On</option>
                <option value="after">After</option>
              </select>
              <input
                className="input"
                type="date"
                style={{ width: 150 }}
                value={dateFilter.date}
                onChange={e => setDateFilter(f => ({ ...f, date: e.target.value }))}
              />
            </>
          )}
          {dateFilter.field && dateFilter.date && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setDateFilter({ field: '', compare: 'on', date: '' })}
              style={{ whiteSpace: 'nowrap' }}
            >&times;</button>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadOrders} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        {displayOrders.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} style={{ gap: 4, display: 'inline-flex', alignItems: 'center' }}>
            CSV
          </button>
        )}
        {(filter.warehouse || filter.status || filter.store || filter.pastDue || (dateFilter.field && dateFilter.date)) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setFilter(f => ({ ...f, warehouse: '', status: '', store: '', pastDue: false })); setDateFilter({ field: '', compare: 'on', date: '' }); }}
          >Clear filters</button>
        )}
      </div>

      {/* Table */}
      {displayOrders.length > 0 && (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ tableLayout: 'auto', whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                {columns.map(c => {
                  const colWidth = c.key === 'po' ? { minWidth: 140 } : c.key === 'store_name' ? { maxWidth: 100 } : {};
                  return (
                    <th
                      key={c.key}
                      style={{ ...thStyle, ...colWidth }}
                      onClick={() => toggleSort(c.key)}
                      dangerouslySetInnerHTML={{ __html: c.label + (sort.col === c.key ? (sort.dir === 'asc' ? ' &#9650;' : ' &#9660;') : ' <span style="opacity:0.3">&#8597;</span>') }}
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {displayOrders.map(o => {
                const cellInput = (field, opts = {}) => {
                  const { type = 'text', minW = 70, fw, mxW } = opts;
                  return (
                    <input
                      type={type}
                      value={getEditValue(o, field)}
                      onChange={e => setEditValue(o.id, field, e.target.value)}
                      onBlur={() => handleFieldBlur(o, field)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
                      style={{
                        width: '100%', minWidth: minW, maxWidth: mxW || undefined,
                        border: '1px solid transparent', borderRadius: 4,
                        padding: '4px 7px', fontSize: 11, fontFamily: 'inherit',
                        background: 'transparent', color: 'var(--text)', outline: 'none',
                        fontWeight: fw || 'normal',
                      }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                      disabled={saving[o.id]}
                    />
                  );
                };

                const statusSelect = () => (
                  <select
                    value={getEditValue(o, 'routing_status')}
                    onChange={e => { setEditValue(o.id, 'routing_status', e.target.value); updateField(o.id, 'routing_status', e.target.value); }}
                    style={{
                      border: '1px solid transparent', borderRadius: 4, padding: '3px 4px',
                      fontSize: 10, fontWeight: 600, fontFamily: 'inherit', background: 'transparent',
                      color: 'var(--text)', outline: 'none', cursor: 'pointer',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={e => { e.target.style.borderColor = 'transparent'; }}
                    disabled={saving[o.id]}
                  >
                    <option value="routed">Routed</option>
                    <option value="not_routed">Not Routed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="shipped">Shipped</option>
                  </select>
                );

                return (
                  <tr key={o.id} style={{ background: rowBg(o) }}>
                    <td style={{ padding: '2px 4px', minWidth: 140 }}>{cellInput('po', { fw: 600, minW: 130 })}</td>
                    <td style={{ padding: '2px 4px' }}>{cellInput('ticket_number', { minW: 60 })}</td>
                    <td style={{ padding: '2px 4px', maxWidth: 120 }}>{cellInput('store_name', { minW: 80, mxW: 120 })}</td>
                    <td style={{ padding: '2px 4px' }}>{cellInput('start_date', { type: 'date', minW: 110 })}</td>
                    <td style={{ padding: '2px 4px' }}>{cellInput('cancel_date', { type: 'date', minW: 110 })}</td>
                    <td style={{ padding: '2px 4px' }}>{cellInput('warehouse_code', { minW: 50 })}</td>
                    <td style={{ padding: '2px 4px' }}>{cellInput('routing', { minW: 70 })}</td>
                    <td style={{ padding: '2px 4px' }}>{statusSelect()}</td>
                    <td style={compact}>{lifecycleBadge(o.lifecycle)}</td>
                    <td style={{ padding: '2px 4px' }}>
                      <input
                        type="text"
                        value={getEditValue(o, 'shipment_info')}
                        onChange={e => setEditValue(o.id, 'shipment_info', e.target.value)}
                        onBlur={() => handleFieldBlur(o, 'shipment_info')}
                        onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
                        placeholder="Add note..."
                        style={{
                          width: '100%', minWidth: 130,
                          border: '1px solid transparent', borderRadius: 4,
                          padding: '4px 7px', fontSize: 11, fontFamily: 'inherit',
                          background: 'transparent', color: 'var(--text)', outline: 'none',
                        }}
                        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--surface)'; }}
                        disabled={saving[o.id]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
            Showing {displayOrders.length} orders
          </div>
        </div>
      )}
    </div>
  );
}