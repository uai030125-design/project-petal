import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitRow = (line) => {
    const result = []; let cur = ''; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map((l, i) => {
    const cells = splitRow(l);
    const obj = { _id: i };
    headers.forEach((h, j) => { obj[h] = cells[j] || ''; });
    return obj;
  });
  return { headers, rows };
}

/* ── ATS fixed columns ── */
const ATS_COLUMNS = [
  { key: 'style', label: 'Style #' },
  { key: 'color', label: 'Color' },
  { key: 'units', label: 'Units', width: 62 },
  { key: 'warehouse', label: 'WH' },
  { key: 'lot', label: 'Lot' },
  { key: 'vendor_inv', label: 'Vendor Inv', width: 90 },
  { key: 'ct', label: 'Cut Ticket' },
];

/* ── Warehouse badge color helper ── */
function whBadgeClass(wh) {
  if (!wh) return 'badge badge-blue';
  const upper = wh.toUpperCase();
  if (upper === 'CSM' || upper.includes('CSM')) return 'badge badge-green';
  return 'badge badge-blue';
}

/* ── Bundled Styles Popup ── */
function BundledStylesPopup({ styleNum, rows, onClose }) {
  if (!styleNum) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '28px 32px',
        minWidth: 420, maxWidth: 700, maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Style {styleNum} — Bundled Details</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
            color: 'var(--text-muted)', lineHeight: 1,
          }}>&times;</button>
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Color</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Units</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>WH</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Lot</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vendor Inv</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Cut Ticket</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 10px' }}>{r.color || '—'}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{r.units ? parseInt(r.units, 10).toLocaleString() : '—'}</td>
                <td style={{ padding: '6px 10px' }}><span className={whBadgeClass(r.warehouse)}>{r.warehouse || '—'}</span></td>
                <td style={{ padding: '6px 10px' }}>{r.lot || '—'}</td>
                <td style={{ padding: '6px 10px' }}>{r.vendor_inv || '—'}</td>
                <td style={{ padding: '6px 10px' }}>{r.ct || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
          {rows.length} variant{rows.length !== 1 ? 's' : ''} · {rows.reduce((s, r) => s + (parseInt(r.units, 10) || 0), 0).toLocaleString()} total units
        </div>
      </div>
    </div>
  );
}

function buildMapping(csvHeaders) {
  const map = {};
  const find = (candidates) => csvHeaders.find(h => {
    const low = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return candidates.some(c => low.includes(c));
  }) || null;
  map.style = find(['style', 'stylenumber', 'styleno', 'style#']);
  map.color = find(['color', 'colour', 'clr']);
  map.units = find(['unit', 'qty', 'quantity', 'ats', 'available']);
  map.warehouse = find(['warehouse', 'wh', 'whse', 'location']);
  map.lot = find(['lot', 'shipment', 'shiplot', 'shipmentlot']);
  map.vendor_inv = find(['vendor', 'invoice', 'vendorinv', 'vendorinvoice', 'vinv']);
  map.ct = find(['ct', 'cutticket', 'ctnumber', 'ticket', 'eta']);
  return map;
}

function mapRow(row, mapping) {
  const out = {};
  ATS_COLUMNS.forEach(c => {
    const srcHeader = mapping[c.key];
    out[c.key] = srcHeader ? (row[srcHeader] || '') : '';
  });
  out._id = row._id;
  return out;
}

function downloadCSV(headers, csvRows, filename) {
  const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── Filter out 0-unit rows only (no consolidation) ── */
function filterZeroUnits(rows) {
  return rows
    .filter(r => (parseInt(r.units, 10) || 0) > 0)
    .map((r, i) => ({ ...r, _id: i }));
}

const ATS_CACHE_KEY = 'ats_cached_data';

/* ══════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════ */
/* ══════════════════════════════════════
   SCRUBS PRO FORMA ATS DATA
   ══════════════════════════════════════ */
const SCRUBS_COLORS = {
  core: ['Black', 'Navy', 'Charcoal', 'Gray'],
  trend: ['Candy Pink', 'Lavender', 'Tarragon', 'Blood Red', 'Wine', 'Hot Pink', 'Royal Blue'],
};
const ALL_COLORS = [...SCRUBS_COLORS.core, ...SCRUBS_COLORS.trend];

const SCRUBS_DATA = [
  { section: 'Bottoms', styles: [
    { style: '600288', values: [4961, 734, 2468, 1464, 0, 0, 0, 0, 622, 0, 0] },
    { style: '600289', values: [3960, 952, 3100, 2465, 0, 0, 0, 0, 1140, 0, 540] },
    { style: '600388', values: [2284, 0, 2617, 0, 0, 0, 0, 0, 0, 0, 0] },
    { style: '600389', values: [1560, 1002, 0, 0, 0, 0, 540, 500, 1020, 0, 180] },
    { style: '600736', values: [0, 0, 392, 397, 0, 0, 0, 0, 0, 0, 0] },
  ]},
  { section: 'Tops', styles: [
    { style: '600529', values: [5480, 0, 1828, 2728, 0, 0, 600, 0, 0, 0, 0] },
    { style: '600629', values: [2778, 1140, 840, 1080, 0, 0, 0, 0, 1080, 1020, 1080] },
    { style: '600727', values: [8764, 0, 1103, 1939, 300, 0, 0, 0, 0, 0, 0] },
    { style: '600728', values: [6615, 0, 1182, 1821, 204, 600, 100, 600, 0, 0, 0] },
    { style: '600729', values: [3840, 1002, 2322, 1124, 800, 260, 380, 560, 0, 0, 0] },
    { style: '600734', values: [803, 0, 398, 401, 0, 0, 0, 0, 0, 0, 0] },
    { style: '600735', values: [322, 399, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  ]},
  { section: 'Plus', styles: [
    { style: '600731X', values: [0, 350, 350, 350, 0, 0, 0, 0, 0, 0, 0] },
    { style: '600732X', values: [750, 350, 350, 350, 350, 350, 350, 350, 0, 0, 0] },
  ]},
];

function ScrubsATS() {
  const colTotals = ALL_COLORS.map((_, ci) =>
    SCRUBS_DATA.reduce((sum, sec) => sum + sec.styles.reduce((s, row) => s + row.values[ci], 0), 0)
  );
  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  const cellStyle = (val) => ({
    padding: '4px 8px', textAlign: 'right', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    color: val > 0 ? 'var(--text)' : 'var(--text-muted)', fontWeight: val > 0 ? 600 : 400,
    borderBottom: '1px solid var(--border)', minWidth: 62,
  });

  const headerCell = {
    padding: '6px 8px', textAlign: 'center', fontSize: 10, fontWeight: 700,
    color: 'var(--text)', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)',
  };

  return (
    <div className="fade-in">
      <PageHeader title="ATS | Scrubs" />
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">Pro Forma ATS — Scrubs</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
          Total: {grandTotal.toLocaleString()} units
        </div>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, textAlign: 'left', minWidth: 90 }}></th>
              <th colSpan={4} style={{ ...headerCell, background: 'rgba(193,240,200,0.3)', borderLeft: '2px solid var(--border)', borderRight: '2px solid var(--border)' }}>Core Colors</th>
              <th colSpan={7} style={{ ...headerCell, background: 'rgba(219,200,240,0.25)', borderRight: '2px solid var(--border)' }}>Trend Colors</th>
              <th style={{ ...headerCell, background: 'var(--surface2)' }}>Total</th>
            </tr>
            <tr>
              <th style={{ ...headerCell, textAlign: 'left' }}>Style</th>
              {ALL_COLORS.map((c, i) => (
                <th key={c} style={{
                  ...headerCell,
                  background: i < 4 ? 'rgba(193,240,200,0.15)' : 'rgba(219,200,240,0.12)',
                  borderLeft: i === 0 ? '2px solid var(--border)' : i === 4 ? '2px solid var(--border)' : undefined,
                  borderRight: i === 10 ? '2px solid var(--border)' : undefined,
                }}>{c}</th>
              ))}
              <th style={{ ...headerCell, background: 'var(--surface2)' }}>Units</th>
            </tr>
          </thead>
          <tbody>
            {SCRUBS_DATA.map(sec => (
              <React.Fragment key={sec.section}>
                <tr>
                  <td colSpan={ALL_COLORS.length + 2} style={{
                    padding: '10px 8px 4px', fontSize: 11, fontWeight: 700,
                    textDecoration: 'underline', color: 'var(--text)', borderBottom: '1px solid var(--border)',
                  }}>{sec.section}</td>
                </tr>
                {sec.styles.map(row => {
                  const rowTotal = row.values.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={row.style} style={{ background: rowTotal > 5000 ? 'rgba(255,255,0,0.06)' : 'transparent' }}>
                      <td style={{
                        padding: '4px 8px', fontSize: 12, fontWeight: 700,
                        color: 'var(--text)', borderBottom: '1px solid var(--border)',
                      }}>{row.style}</td>
                      {row.values.map((v, i) => (
                        <td key={i} style={{
                          ...cellStyle(v),
                          borderLeft: i === 0 ? '2px solid var(--border)' : i === 4 ? '2px solid var(--border)' : undefined,
                          borderRight: i === 10 ? '2px solid var(--border)' : undefined,
                        }}>
                          {v > 0 ? v.toLocaleString() : '—'}
                        </td>
                      ))}
                      <td style={{
                        padding: '4px 8px', textAlign: 'right', fontSize: 12,
                        fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                        color: 'var(--text)', borderBottom: '1px solid var(--border)',
                        background: 'var(--surface2)',
                      }}>{rowTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            <tr style={{ background: 'var(--surface2)' }}>
              <td style={{ padding: '8px', fontSize: 12, fontWeight: 700, borderTop: '2px solid var(--border)' }}>Total</td>
              {colTotals.map((t, i) => (
                <td key={i} style={{
                  padding: '4px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)',
                  borderTop: '2px solid var(--border)',
                  borderLeft: i === 0 ? '2px solid var(--border)' : i === 4 ? '2px solid var(--border)' : undefined,
                  borderRight: i === 10 ? '2px solid var(--border)' : undefined,
                }}>{t > 0 ? t.toLocaleString() : '—'}</td>
              ))}
              <td style={{
                padding: '4px 8px', textAlign: 'right', fontSize: 13, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)',
                borderTop: '2px solid var(--border)',
              }}>{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ATS() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');

  if (category === 'scrubs') {
    return <ScrubsATS />;
  }

  return <ATSCore />;
}

function ATSCore() {
  const toast = useToast();
  const [atsRows, setAtsRows] = useState([]);
  const [atsDragOver, setAtsDragOver] = useState(false);
  const [atsSearch, setAtsSearch] = useState('');
  const [atsSort, setAtsSort] = useState({ col: null, dir: 'asc' });
  const [filterWh, setFilterWh] = useState('');
  const [hasCached, setHasCached] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [bundledStyle, setBundledStyle] = useState(null);
  const [filterContractor, setFilterContractor] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { rowId, key }
  const [editValue, setEditValue] = useState('');
  const [adjustRow, setAdjustRow] = useState(null); // rowId for +/- popup
  const [adjustAmt, setAdjustAmt] = useState('');

  /* Check for cached data on mount */
  useEffect(() => {
    try { setHasCached(!!localStorage.getItem(ATS_CACHE_KEY)); } catch { /* noop */ }
  }, []);

  /* Save to cache */
  const cacheData = (rows) => {
    try {
      localStorage.setItem(ATS_CACHE_KEY, JSON.stringify({ atsRows: rows, ts: Date.now() }));
      setHasCached(true);
    } catch { /* noop */ }
  };

  /* Load from cache */
  const loadCached = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(ATS_CACHE_KEY));
      if (stored && stored.atsRows && stored.atsRows.length) {
        setAtsRows(stored.atsRows);
        setSaveMsg('Loaded from cache');
        setTimeout(() => setSaveMsg(''), 1500);
      }
    } catch { toast.error('Could not load cached data.'); }
  };

  const [uploading, setUploading] = useState(false);

  /* File handler — supports .csv (client-side) and .xlsx (server-side) */
  const handleAtsFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = parseCSV(e.target.result);
        if (!parsed.headers.length) return;
        const m = buildMapping(parsed.headers);
        const mapped = parsed.rows.map(r => mapRow(r, m));
        const cleaned = filterZeroUnits(mapped);
        setAtsRows(cleaned);
        cacheData(cleaned);
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 1500);
      };
      reader.readAsText(file);
    } else {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/agents/ats/upload', fd);
        const items = res.data.items || [];
        if (items.length === 0) {
          setSaveMsg('No ATS records found');
          setTimeout(() => setSaveMsg(''), 2500);
          return;
        }
        const mapped = items.map((item, i) => ({
          _id: i,
          style: item.style || '',
          color: item.color || '',
          units: String(item.units || 0),
          warehouse: item.warehouse || '',
          lot: item.lot || '',
          vendor_inv: item.vendor_inv || '',
          ct: item.ct || item.eta || '',
          contractor: item.contractor || '',
          buyer: item.buyer || '',
        }));
        const cleaned = filterZeroUnits(mapped);
        setAtsRows(cleaned);
        cacheData(cleaned);
        setSaveMsg(`Imported ${cleaned.length} rows`);
        setTimeout(() => setSaveMsg(''), 2500);
      } catch (err) {
        setSaveMsg('Upload failed');
        setTimeout(() => setSaveMsg(''), 2500);
      } finally {
        setUploading(false);
      }
    }
  };

  /* Manual save */
  const saveData = () => {
    cacheData(atsRows);
    setSaveMsg('Saved');
    setTimeout(() => setSaveMsg(''), 1500);
  };

  /* ── Edit mode helpers ── */
  const updateRow = (rowId, key, value) => {
    setAtsRows(prev => prev.map(r => r._id === rowId ? { ...r, [key]: value } : r));
  };

  const startEdit = (rowId, key, currentVal) => {
    setEditingCell({ rowId, key });
    setEditValue(currentVal || '');
  };

  const commitEdit = () => {
    if (editingCell) {
      updateRow(editingCell.rowId, editingCell.key, editValue);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const adjustUnits = (rowId, delta) => {
    setAtsRows(prev => prev.map(r => {
      if (r._id !== rowId) return r;
      const cur = parseInt(r.units, 10) || 0;
      const next = Math.max(0, cur + delta);
      return { ...r, units: String(next) };
    }));
  };

  const deleteRow = (rowId) => {
    setAtsRows(prev => prev.filter(r => r._id !== rowId).map((r, i) => ({ ...r, _id: i })));
  };

  const addNewRow = () => {
    const newId = atsRows.length > 0 ? Math.max(...atsRows.map(r => r._id)) + 1 : 0;
    setAtsRows(prev => [...prev, {
      _id: newId, style: '', color: '', units: '0',
      warehouse: '', lot: '', vendor_inv: '', ct: '',
      contractor: '', buyer: '',
    }]);
    // Auto-start editing the style cell of the new row
    setTimeout(() => startEdit(newId, 'style', ''), 50);
  };

  const clearAllAts = () => {
    if (window.confirm('Clear all ATS data? This cannot be undone.')) {
      setAtsRows([]);
      try { localStorage.removeItem(ATS_CACHE_KEY); setHasCached(false); } catch { /* noop */ }
      setSaveMsg('ATS cleared');
      setTimeout(() => setSaveMsg(''), 1500);
    }
  };

  /* ── Derived data ── */
  const warehouses = useMemo(() => [...new Set(atsRows.map(r => r.warehouse).filter(Boolean))].sort(), [atsRows]);
  const totalUnits = useMemo(() => atsRows.reduce((s, r) => s + (parseInt(r.units, 10) || 0), 0), [atsRows]);
  const starUnits = useMemo(() => atsRows.filter(r => (r.warehouse || '').toUpperCase() === 'STAR').reduce((s, r) => s + (parseInt(r.units, 10) || 0), 0), [atsRows]);
  const csmUnits = useMemo(() => atsRows.filter(r => (r.warehouse || '').toUpperCase() === 'CSM').reduce((s, r) => s + (parseInt(r.units, 10) || 0), 0), [atsRows]);
  const sortedContractors = useMemo(() => {
    const counts = {};
    atsRows.forEach(r => { if (r.contractor) counts[r.contractor] = (counts[r.contractor] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [atsRows]);
  const contractors = useMemo(() => [...new Set(atsRows.map(r => r.contractor).filter(Boolean))].sort(), [atsRows]);
  const customers = useMemo(() => [...new Set(atsRows.map(r => r.buyer).filter(Boolean))].sort(), [atsRows]);

  const atsDisplay = useMemo(() => {
    let filtered = atsRows;
    if (atsSearch) {
      const q = atsSearch.toLowerCase();
      filtered = filtered.filter(r => ATS_COLUMNS.some(c => String(r[c.key]).toLowerCase().includes(q)));
    }
    if (filterWh) filtered = filtered.filter(r => r.warehouse === filterWh);
    if (filterContractor) filtered = filtered.filter(r => r.contractor === filterContractor);
    if (filterCustomer) filtered = filtered.filter(r => r.buyer === filterCustomer);
    if (atsSort.col) {
      filtered = [...filtered].sort((a, b) => {
        let av = a[atsSort.col] ?? ''; let bv = b[atsSort.col] ?? '';
        if (atsSort.col === 'units') { av = parseInt(av, 10) || 0; bv = parseInt(bv, 10) || 0; }
        if (av < bv) return atsSort.dir === 'asc' ? -1 : 1;
        if (av > bv) return atsSort.dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [atsRows, atsSearch, atsSort, filterWh, filterContractor, filterCustomer]);

  const filteredUnits = useMemo(() => atsDisplay.reduce((s, r) => s + (parseInt(r.units, 10) || 0), 0), [atsDisplay]);

  /* Group rows by style number for bundled popup */
  const styleBundleMap = useMemo(() => {
    const map = {};
    atsRows.forEach(r => {
      if (!r.style) return;
      if (!map[r.style]) map[r.style] = [];
      map[r.style].push(r);
    });
    return map;
  }, [atsRows]);

  const openBundle = useCallback((styleNum) => {
    setBundledStyle(styleNum);
  }, []);

  const exportAts = () => {
    if (!atsRows.length) return;
    const headers = ATS_COLUMNS.map(c => c.label);
    const csvRows = atsDisplay.map(r => {
      return ATS_COLUMNS.map(c => `"${String(r[c.key] || '').replace(/"/g, '""')}"`).join(',');
    });
    downloadCSV(headers, csvRows, `ats-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const toggleSort = (col) => {
    setAtsSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  const thStyle = { padding: '6px 6px', cursor: 'pointer', userSelect: 'none', fontSize: 12 };
  const compact = { whiteSpace: 'nowrap', fontSize: 12, padding: '6px 6px' };
  const hasAtsFilters = atsSearch || filterWh || filterContractor || filterCustomer;

  return (
    <div className="fade-in">
      <PageHeader title="ATS | Core" />
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">ATS | Core — Available To Sell</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasCached && atsRows.length === 0 && (
            <button className="btn btn-primary btn-sm" onClick={loadCached}>Generate ATS</button>
          )}
          {atsRows.length > 0 && (
            <button
              className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setEditMode(!editMode); setEditingCell(null); setAdjustRow(null); }}
              style={editMode ? { background: '#c45050', borderColor: '#c45050' } : {}}
            >
              {editMode ? '✎ Editing' : '✎ Edit'}
            </button>
          )}
          {atsRows.length > 0 && editMode && (
            <button className="btn btn-secondary btn-sm" onClick={addNewRow}>+ Add Row</button>
          )}
          {atsRows.length > 0 && editMode && (
            <button className="btn btn-secondary btn-sm" onClick={clearAllAts} style={{ color: 'var(--danger)' }}>Clear All</button>
          )}
          {atsRows.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={exportAts}
              style={{ fontSize: 12, padding: '6px 16px' }}>
              Generate
            </button>
          )}
          {atsRows.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={saveData}>Save</button>
          )}
          {saveMsg && (
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{saveMsg}</span>
          )}
          {/* Upload drop zone — compact square in header */}
          <div
            className={`drop-zone ${atsDragOver ? 'dragover' : ''}`}
            style={{
              width: 90, height: 56, padding: '8px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, borderRadius: 10,
            }}
            onDragOver={e => { e.preventDefault(); setAtsDragOver(true); }}
            onDragLeave={() => setAtsDragOver(false)}
            onDrop={e => { e.preventDefault(); setAtsDragOver(false); if (e.dataTransfer.files[0]) handleAtsFile(e.dataTransfer.files[0]); }}
            onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.xlsx,.xls'; i.onchange = e => handleAtsFile(e.target.files[0]); i.click(); }}
          >
            <div style={{ marginBottom: 1, display: 'flex', justifyContent: 'center' }}><BarChart3 size={14} strokeWidth={2} /></div>
            <div style={{ fontSize: 8, fontWeight: 700, textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2 }}>
              {uploading ? 'Uploading...' : 'Upload\nATS'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {atsRows.length > 0 && (
        <div className="stagger-in" style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'stretch' }}>
          <div className="stat-card" style={{ flex: 1, padding: 16 }}>
            <div className="stat-label">Total Styles</div>
            <div className="stat-value">{atsRows.length}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, padding: 16 }}>
            <div className="stat-label">Total Units</div>
            <div className="stat-value">{totalUnits.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, padding: 16 }}>
            <div className="stat-label">Units at STAR</div>
            <div className="stat-value">{starUnits.toLocaleString()}</div>
          </div>
          <div className="stat-card" style={{ flex: 1, padding: 16 }}>
            <div className="stat-label">Units at CSM</div>
            <div className="stat-value" style={{ color: '#5A7A3C' }}>{csmUnits.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Contractor CT counts */}
      {atsRows.length > 0 && sortedContractors.length > 0 && (
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>Cut Tickets:</span>
          {sortedContractors.map(([name, count]) => (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600 }}>{name}</span>
              <span style={{
                background: 'var(--accent)', color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center',
              }}>{count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Generate ATS prompt when no data and cache exists */}
      {atsRows.length === 0 && hasCached && (
        <div style={{
          textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          marginBottom: 20,
        }}>
          Previous ATS data is available. Click <strong>Generate ATS</strong> to load it.
        </div>
      )}

      {atsRows.length > 0 && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="search-input" style={{ maxWidth: 220 }} placeholder="Search style, color, lot..." value={atsSearch} onChange={e => setAtsSearch(e.target.value)} />
            {warehouses.length > 1 && (
              <select className="input" style={{ maxWidth: 140 }} value={filterWh} onChange={e => setFilterWh(e.target.value)}>
                <option value="">All Warehouses</option>
                {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            )}
            {contractors.length > 0 && (
              <select className="input" style={{ maxWidth: 160 }} value={filterContractor} onChange={e => setFilterContractor(e.target.value)}>
                <option value="">All Contractors</option>
                {contractors.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {customers.length > 0 && (
              <select className="input" style={{ maxWidth: 160 }} value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <button className="btn btn-secondary btn-sm" onClick={exportAts}>CSV</button>
            {hasAtsFilters && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setAtsSearch(''); setFilterWh(''); setFilterContractor(''); setFilterCustomer(''); }}>Clear</button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {atsDisplay.length} row{atsDisplay.length !== 1 ? 's' : ''} · {filteredUnits.toLocaleString()} units
            </span>
          </div>

          {/* Table */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ tableLayout: 'fixed', whiteSpace: 'nowrap' }}>
              <colgroup>
                {ATS_COLUMNS.map(c => (
                  <col key={c.key} style={c.width ? { width: c.width } : undefined} />
                ))}
                {editMode && <col style={{ width: 100 }} />}
              </colgroup>
              <thead>
                <tr>
                  {ATS_COLUMNS.map(c => (
                    <th key={c.key} style={thStyle} onClick={() => toggleSort(c.key)}>
                      {c.label} {atsSort.col === c.key ? (atsSort.dir === 'asc' ? '\u25B2' : '\u25BC') : <span style={{ opacity: 0.3 }}>{'\u2195'}</span>}
                    </th>
                  ))}
                  {editMode && <th style={{ ...thStyle, cursor: 'default', textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {atsDisplay.map(r => (
                  <tr key={r._id} style={editMode ? { background: 'rgba(45,74,52,0.02)' } : {}}>
                    {/* Style cell */}
                    <td style={{ ...compact, fontWeight: 600, color: 'var(--accent-dark)' }}
                      onDoubleClick={editMode ? () => startEdit(r._id, 'style', r.style) : undefined}
                    >
                      {editingCell?.rowId === r._id && editingCell?.key === 'style' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4, fontWeight: 600 }} />
                      ) : r.style ? (
                        !editMode && styleBundleMap[r.style] && styleBundleMap[r.style].length > 1 ? (
                          <span style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                            title={`View all ${styleBundleMap[r.style].length} entries for style ${r.style}`}
                            onClick={() => openBundle(r.style)}>
                            {r.style} <span style={{ fontSize: 10, opacity: 0.6 }}>({styleBundleMap[r.style].length})</span>
                          </span>
                        ) : r.style
                      ) : '—'}
                    </td>
                    {/* Color cell */}
                    <td style={compact} onDoubleClick={editMode ? () => startEdit(r._id, 'color', r.color) : undefined}>
                      {editingCell?.rowId === r._id && editingCell?.key === 'color' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4 }} />
                      ) : (r.color || '—')}
                    </td>
                    {/* Units cell — with +/- in edit mode */}
                    <td style={{ ...compact, textAlign: 'right', fontWeight: 600, fontFamily: 'Arial, sans-serif', maxWidth: editMode ? 130 : 62 }}>
                      {editMode ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                          <button onClick={() => adjustUnits(r._id, -1)} style={{ border: 'none', background: 'var(--surface2)', cursor: 'pointer', borderRadius: 4, width: 20, height: 20, fontSize: 12, lineHeight: 1, fontWeight: 700, color: 'var(--danger)' }}>−</button>
                          {editingCell?.rowId === r._id && editingCell?.key === 'units' ? (
                            <input value={editValue} onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                              autoFocus style={{ width: 55, fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4, textAlign: 'right', fontWeight: 600 }} />
                          ) : (
                            <span style={{ cursor: 'pointer', minWidth: 40, textAlign: 'right' }}
                              onDoubleClick={() => startEdit(r._id, 'units', r.units)}>
                              {r.units ? parseInt(r.units, 10).toLocaleString() : '0'}
                            </span>
                          )}
                          <button onClick={() => adjustUnits(r._id, 1)} style={{ border: 'none', background: 'var(--surface2)', cursor: 'pointer', borderRadius: 4, width: 20, height: 20, fontSize: 12, lineHeight: 1, fontWeight: 700, color: 'var(--success)' }}>+</button>
                          {/* Quick adjust button */}
                          <button onClick={() => { setAdjustRow(adjustRow === r._id ? null : r._id); setAdjustAmt(''); }}
                            style={{ border: 'none', background: adjustRow === r._id ? 'var(--accent)' : 'var(--surface2)', color: adjustRow === r._id ? '#fff' : 'var(--text-muted)', cursor: 'pointer', borderRadius: 4, width: 20, height: 20, fontSize: 10, lineHeight: 1, fontWeight: 700 }}>±</button>
                        </div>
                      ) : (
                        r.units ? parseInt(r.units, 10).toLocaleString() : '—'
                      )}
                      {/* Quick adjust popup */}
                      {editMode && adjustRow === r._id && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                          <input value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)} placeholder="qty"
                            autoFocus onKeyDown={e => { if (e.key === 'Enter') { const n = parseInt(adjustAmt, 10); if (n) { adjustUnits(r._id, n); setAdjustRow(null); } } }}
                            style={{ width: 50, fontSize: 11, padding: '2px 4px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right' }} />
                          <button onClick={() => { const n = parseInt(adjustAmt, 10); if (n) { adjustUnits(r._id, n); setAdjustRow(null); } }}
                            style={{ border: 'none', background: 'var(--success)', color: '#fff', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>+</button>
                          <button onClick={() => { const n = parseInt(adjustAmt, 10); if (n) { adjustUnits(r._id, -n); setAdjustRow(null); } }}
                            style={{ border: 'none', background: 'var(--danger)', color: '#fff', cursor: 'pointer', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>−</button>
                        </div>
                      )}
                    </td>
                    {/* WH cell */}
                    <td style={compact} onDoubleClick={editMode ? () => startEdit(r._id, 'warehouse', r.warehouse) : undefined}>
                      {editingCell?.rowId === r._id && editingCell?.key === 'warehouse' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4 }} />
                      ) : <span className={whBadgeClass(r.warehouse)}>{r.warehouse || '—'}</span>}
                    </td>
                    {/* Lot cell */}
                    <td style={compact} onDoubleClick={editMode ? () => startEdit(r._id, 'lot', r.lot) : undefined}>
                      {editingCell?.rowId === r._id && editingCell?.key === 'lot' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4 }} />
                      ) : (r.lot || '—')}
                    </td>
                    {/* Vendor Inv cell */}
                    <td style={{ ...compact, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}
                      onDoubleClick={editMode ? () => startEdit(r._id, 'vendor_inv', r.vendor_inv) : undefined}>
                      {editingCell?.rowId === r._id && editingCell?.key === 'vendor_inv' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4 }} />
                      ) : (r.vendor_inv || '—')}
                    </td>
                    {/* Cut Ticket cell */}
                    <td style={compact} onDoubleClick={editMode ? () => startEdit(r._id, 'ct', r.ct) : undefined}>
                      {editingCell?.rowId === r._id && editingCell?.key === 'ct' ? (
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          autoFocus style={{ width: '100%', fontSize: 12, padding: '2px 4px', border: '1px solid var(--accent)', borderRadius: 4 }} />
                      ) : (r.ct || '—')}
                    </td>
                    {/* Actions column (edit mode only) */}
                    {editMode && (
                      <td style={{ ...compact, textAlign: 'center' }}>
                        <button onClick={() => deleteRow(r._id)} title="Delete row"
                          style={{ border: 'none', background: 'rgba(196,80,80,0.1)', color: 'var(--danger)', cursor: 'pointer', borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
              Showing {atsDisplay.length} of {atsRows.length} rows
            </div>
          </div>
        </>
      )}

      {/* Bundled Styles Popup */}
      {bundledStyle && styleBundleMap[bundledStyle] && (
        <BundledStylesPopup
          styleNum={bundledStyle}
          rows={styleBundleMap[bundledStyle]}
          onClose={() => setBundledStyle(null)}
        />
      )}
    </div>
  );
}
