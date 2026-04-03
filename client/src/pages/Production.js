import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import api from '../utils/api';

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

/* ── Desired output columns ── */
const FIXED_COLUMNS = [
  { key: 'ct', label: 'CT', candidates: ['ct', 'cutticket', 'ctnumber', 'cut'] },
  { key: 'customer', label: 'Customer', candidates: ['customer', 'cust', 'buyer', 'store', 'account'] },
  { key: 'customer_po', label: 'Customer PO #', candidates: ['customerpo', 'custpo', 'po', 'ponumber', 'purchaseorder'] },
  { key: 'vendor', label: 'Contractor', candidates: ['vendor', 'supplier', 'factory', 'mill', 'contractor'] },
  { key: 'style', label: 'Style #', candidates: ['style', 'style#', 'styleno', 'stylenumber', 'vendorstyle', 'item', 'sku'] },
  { key: 'color', label: 'Color', candidates: ['color', 'colour', 'clr', 'colordesc', 'colorname'] },
  { key: 'units', label: 'Units', candidates: ['units', 'qty', 'quantity', 'totalunits', 'totalqty', 'pcs', 'pieces'] },
  { key: 'due_date', label: 'Due Date', candidates: ['due', 'duedate', 'delivery', 'deliverydate', 'ship', 'shipdate', 'date'] },
  { key: 'pick_ticket', label: 'Pick Ticket', candidates: ['pickticket', 'pick', 'picktkt', 'pickno', 'picknumber'] },
  { key: 'eta', label: 'ETA', candidates: ['eta', 'estimatedarrival', 'arrival', 'arrivaldate', 'etadate'] },
  { key: 'vendor_invoice', label: 'Vendor Invoice #', candidates: [], computed: true },
];

const STATUS_OPTIONS = [
  { key: 'inProduction', label: 'In Production', color: '#8B6B2E' },
  { key: 'packing',      label: 'Packing',       color: '#4A6FA5' },
  { key: 'shipped',      label: 'Shipped',        color: '#2D5A3D' },
  { key: 'inWarehouse',  label: 'In Warehouse',   color: '#B58C3C' },
];

/* Try to match a CSV header to one of the candidate strings */
function findHeader(csvHeaders, candidates) {
  return csvHeaders.find(h => {
    const low = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    return candidates.some(c => low.includes(c));
  }) || null;
}

const CACHE_KEY    = 'production_cached_data';
const STATUSES_KEY = 'production_statuses';

export default function Production() {
  const toast = useToast();

  /* Raw CSV data (always kept) */
  const [rawData, setRawData] = useState({ headers: [], rows: [] });
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ col: null, dir: 'asc' });
  const [statFilter, setStatFilter] = useState(null); // null = all, string = vendor name
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    // Default to the 1st of next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState('');

  const applyDatePreset = (days) => {
    const today = new Date();
    setDateFrom(today.toISOString().slice(0, 10));
    setDateTo(new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10));
  };
  const [comments, setComments]   = useState({});
  const [statuses, setStatuses]   = useState({});   // { [rowId]: { inProduction, packing, shipped, inWarehouse } }
  const [hasCached, setHasCached] = useState(false);
  const [cacheMsg, setCacheMsg]   = useState('');
  const [ctInvoiceMap, setCtInvoiceMap] = useState({});
  const isFirstMount = useRef(true);

  /* Load CT → Invoice mapping from containers */
  useEffect(() => {
    api.get('/containers/by-cut-ticket').then(res => {
      if (res.data) setCtInvoiceMap(res.data);
    }).catch(() => {});
  }, []);

  /* Auto-load: try DB first, then localStorage fallback */
  useEffect(() => {
    let loaded = false;
    api.get('/production').then(res => {
      if (res.data && res.data.length > 0) {
        const headers = ['ct', 'customer', 'customer_po', 'vendor', 'style', 'color', 'units', 'due_date', 'notes', 'pick_ticket', 'eta'];
        const rows = res.data.map((r, i) => ({
          _id: r.id || i,
          _dbId: r.id,
          ct: r.ct || '',
          customer: r.customer || '',
          customer_po: r.customer_po || '',
          vendor: r.vendor || '',
          style: r.style || '',
          color: r.color || '',
          units: r.units || '',
          due_date: r.due_date ? r.due_date.split('T')[0] : '',
          notes: r.notes || '',
          pick_ticket: r.pick_ticket || '',
          eta: r.eta ? r.eta.split('T')[0] : '',
        }));
        setRawData({ headers, rows });
        if (res.data.some(r => r.notes)) {
          const c = {};
          res.data.forEach((r, i) => { if (r.notes) c[r.id || i] = r.notes; });
          setComments(c);
        }
        loaded = true;
      }
    }).catch(() => {}).finally(() => {
      if (!loaded) {
        try {
          const stored = localStorage.getItem(CACHE_KEY);
          if (stored) {
            setHasCached(true);
            const parsed = JSON.parse(stored);
            if (parsed && parsed.rawData && parsed.rawData.headers && parsed.rawData.headers.length) {
              setRawData(parsed.rawData);
              if (parsed.comments) setComments(parsed.comments);
            }
          }
        } catch { /* noop */ }
      }
      // Always restore statuses
      try {
        const s = localStorage.getItem(STATUSES_KEY);
        if (s) setStatuses(JSON.parse(s));
      } catch { /* noop */ }
      isFirstMount.current = false;
    });
  }, []);

  /* Auto-cache rawData whenever it changes (skip the initial empty mount) */
  useEffect(() => {
    if (isFirstMount.current) return;
    if (!rawData.headers.length) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rawData, comments, ts: Date.now() }));
      setHasCached(true);
    } catch { /* quota exceeded */ }
  }, [rawData]); // eslint-disable-line

  /* Persist statuses to localStorage whenever they change */
  useEffect(() => {
    if (isFirstMount.current) return;
    try { localStorage.setItem(STATUSES_KEY, JSON.stringify(statuses)); } catch { /* noop */ }
  }, [statuses]);

  const [saving, setSaving] = useState(false);
  const [savingDate, setSavingDate] = useState(null);   // rowId being saved
  const [savingEta, setSavingEta] = useState(null);     // rowId being saved (eta)

  /* Inline due-date edit handler */
  const updateDueDate = useCallback(async (row, newDate) => {
    setRawData(prev => ({
      ...prev,
      rows: prev.rows.map(r => r._id === row._id ? { ...r, due_date: newDate } : r),
    }));
    const dbId = row._dbId || row._id;
    if (dbId) {
      setSavingDate(dbId);
      try {
        await api.put(`/production/${dbId}`, { ...row, due_date: newDate || null });
      } catch (err) {
        console.error('Due date save error:', err);
      }
      setSavingDate(null);
    }
  }, []);

  /* Inline ETA edit handler */
  const updateEta = useCallback(async (row, newEta) => {
    setRawData(prev => ({
      ...prev,
      rows: prev.rows.map(r => r._id === row._id ? { ...r, eta: newEta } : r),
    }));
    const dbId = row._dbId || row._id;
    if (dbId) {
      setSavingEta(dbId);
      try {
        await api.put(`/production/${dbId}`, { ...row, eta: newEta || null });
      } catch (err) {
        console.error('ETA save error:', err);
      }
      setSavingEta(null);
    }
  }, []);

  /* Build column mapping whenever rawData changes */
  const { useMapped, mapping, activeColumns } = useMemo(() => {
    if (!rawData.headers.length) return { useMapped: false, mapping: {}, activeColumns: [] };
    const m = {};
    let matchCount = 0;
    FIXED_COLUMNS.forEach(fc => {
      const found = findHeader(rawData.headers, fc.candidates);
      m[fc.key] = found;
      if (found) matchCount++;
    });
    if (matchCount >= 2) {
      return {
        useMapped: true, mapping: m,
        activeColumns: FIXED_COLUMNS.map(fc => ({ key: fc.key, label: fc.label, srcHeader: m[fc.key] })),
      };
    } else {
      return {
        useMapped: false, mapping: {},
        activeColumns: rawData.headers.map(h => ({ key: h, label: h, srcHeader: h })),
      };
    }
  }, [rawData.headers]);

  const getCellValue = (row, col) => {
    if (col.srcHeader) return row[col.srcHeader] || '';
    return '';
  };

  const saveToDb = useCallback(async () => {
    if (!rawData.rows.length) return;
    setSaving(true);
    try {
      const rows = rawData.rows.map(r => ({
        ct: r.ct || getCellValue(r, activeColumns.find(c => c.key === 'ct') || {}) || '',
        customer: r.customer || getCellValue(r, activeColumns.find(c => c.key === 'customer') || {}) || '',
        customer_po: r.customer_po || getCellValue(r, activeColumns.find(c => c.key === 'customer_po') || {}) || '',
        vendor: r.vendor || getCellValue(r, activeColumns.find(c => c.key === 'vendor') || {}) || '',
        style: r.style || getCellValue(r, activeColumns.find(c => c.key === 'style') || {}) || '',
        color: r.color || getCellValue(r, activeColumns.find(c => c.key === 'color') || {}) || '',
        units: r.units || getCellValue(r, activeColumns.find(c => c.key === 'units') || {}) || '',
        due_date: r.due_date || getCellValue(r, activeColumns.find(c => c.key === 'due_date') || {}) || null,
        notes: comments[r._id] || '',
        pick_ticket: r.pick_ticket || getCellValue(r, activeColumns.find(c => c.key === 'pick_ticket') || {}) || '',
        eta: r.eta || getCellValue(r, activeColumns.find(c => c.key === 'eta') || {}) || null,
      }));
      await api.post('/production/bulk', { rows });
      toast.success(`Saved ${rows.length} rows to database`);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save to database');
    }
    setSaving(false);
  }, [rawData.rows, activeColumns, comments, toast]);

  const cacheData = () => {
    if (!rawData.headers.length) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rawData, comments, ts: Date.now() }));
      setHasCached(true);
      setCacheMsg('Cached ✓');
      setTimeout(() => setCacheMsg(''), 1500);
    } catch { toast.error('Could not cache — data may be too large.'); }
  };

  /* Dynamically load SheetJS if not already present */
  const ensureXLSX = () => new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    const isExcel = /\.xls[xb]?$/i.test(file.name);

    if (isExcel) {
      const XLSX = await ensureXLSX();
      if (!XLSX) { setParsing(false); toast.error('Could not load Excel parser. Try a .csv file instead.'); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          let bestParsed = { headers: [], rows: [] };
          wb.SheetNames.forEach(name => {
            const ws = wb.Sheets[name];
            const csvText = XLSX.utils.sheet_to_csv(ws);
            const parsed = parseCSV(csvText);
            if (parsed.rows.length > bestParsed.rows.length) bestParsed = parsed;
          });
          if (bestParsed.headers.length) {
            setRawData(bestParsed);
            // Auto-cache on upload
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify({ rawData: bestParsed, comments: {}, ts: Date.now() }));
              setHasCached(true);
            } catch { /* noop */ }
          }
        } catch (err) {
          console.error('Excel parse error:', err);
          toast.error('Failed to parse Excel file.');
        }
        setParsing(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = parseCSV(e.target.result);
        if (parsed.headers.length) {
          setRawData(parsed);
          // Auto-cache on upload
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ rawData: parsed, comments: {}, ts: Date.now() }));
            setHasCached(true);
          } catch { /* noop */ }
        }
        setParsing(false);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };

  const toggleSort = (col) => {
    setSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  const filteredRows = useMemo(() => {
    const dueDateCol = activeColumns.find(c => c.key === 'due_date');
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;
    if (!dueDateCol || !dueDateCol.srcHeader || (!from && !to)) return rawData.rows;
    return rawData.rows.filter(r => {
      const val = r[dueDateCol.srcHeader] || r.due_date;
      if (!val) return true;
      const d = new Date(val);
      if (isNaN(d.getTime())) return true;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  }, [rawData.rows, activeColumns, dateFrom, dateTo]);

  const displayRows = useMemo(() => {
    let rows = filteredRows;
    // Apply stat card vendor filter
    if (statFilter) {
      const vendorCol = activeColumns.find(c => c.key === 'vendor');
      if (vendorCol) {
        rows = rows.filter(r => (getCellValue(r, vendorCol) || '').trim() === statFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        activeColumns.some(c => String(getCellValue(r, c)).toLowerCase().includes(q)) ||
        (comments[r._id] || '').toLowerCase().includes(q)
      );
    }
    if (sort.col) {
      const col = activeColumns.find(c => c.key === sort.col);
      if (col) {
        rows = [...rows].sort((a, b) => {
          const av = getCellValue(a, col); const bv = getCellValue(b, col);
          if (av < bv) return sort.dir === 'asc' ? -1 : 1;
          if (av > bv) return sort.dir === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
  }, [filteredRows, search, sort, activeColumns, comments, statFilter]);

  /* ── Top-4 vendors by cut ticket count ── */
  const topVendors = useMemo(() => {
    const vendorCol = activeColumns.find(c => c.key === 'vendor');
    if (!vendorCol) return [];
    const counts = {};
    filteredRows.forEach(r => {
      const v = (getCellValue(r, vendorCol) || '').trim();
      if (v) counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [filteredRows, activeColumns]);


  const toggleStatus = (rowId, statusKey) => {
    setStatuses(prev => {
      const cur = prev[rowId] || {};
      return { ...prev, [rowId]: { ...cur, [statusKey]: !cur[statusKey] } };
    });
  };

  const exportCSV = () => {
    if (!filteredRows.length) return;
    const headers = [...activeColumns.map(c => c.label), 'Status', 'Comments'];
    const csvRows = displayRows.map(r => {
      const vals = activeColumns.map(c => `"${String(getCellValue(r, c)).replace(/"/g, '""')}"`);
      const st = statuses[r._id] || {};
      const statusStr = STATUS_OPTIONS.filter(s => st[s.key]).map(s => s.label).join('; ');
      vals.push(`"${statusStr}"`);
      vals.push(`"${String(comments[r._id] || '').replace(/"/g, '""')}"`);
      return vals.join(',');
    });
    const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `production-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const thStyle = { padding: '8px 8px', cursor: 'pointer', userSelect: 'none' };
  const compact = { whiteSpace: 'nowrap', fontSize: 12, padding: '8px 8px' };

  return (
    <div className="fade-in">
      <PageHeader title="Production" />

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {rawData.rows.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={exportCSV}
              style={{ fontSize: 12, padding: '6px 16px' }}>
              Generate
            </button>
          )}
          {rawData.rows.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={saveToDb} disabled={saving}
              style={{ fontSize: 12, padding: '6px 16px' }}>{saving ? 'Saving...' : 'Save'}</button>
          )}
          {rawData.rows.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={cacheData}
              style={{ fontSize: 12, padding: '5px 14px' }}>Cache</button>
          )}
          {cacheMsg && (
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{cacheMsg}</span>
          )}
          {/* Upload drop zone */}
          <div
            className={`drop-zone ${dragOver ? 'dragover' : ''}`}
            style={{
              width: 90, height: 56, padding: '8px 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, borderRadius: 10,
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,.xlsx,.xls,.xlsb'; i.onchange = e => handleFile(e.target.files[0]); i.click(); }}
          >
            <div style={{ fontSize: 14, marginBottom: 1 }}>🧵</div>
            <div style={{ fontSize: 8, fontWeight: 700, textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1.2 }}>
              {parsing ? 'Parsing...' : 'Upload\nProduction'}
            </div>
          </div>
        </div>
      </div>

      {rawData.rows.length > 0 && (
        <>
          {/* Mapping indicator */}
          {useMapped && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, display: 'inline-block' }}>
              Mapped: {activeColumns.filter(c => c.srcHeader).map(c => c.label).join(', ')}
              {activeColumns.some(c => !c.srcHeader) && (
                <span style={{ color: 'var(--warning)' }}> — unmatched: {activeColumns.filter(c => !c.srcHeader).map(c => c.label).join(', ')}</span>
              )}
            </div>
          )}

          {/* ── Headline Stat Cards (clickable filters) ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Total Cut Tickets — resets filter */}
            <div className="stat-card" onClick={() => setStatFilter(null)} style={{
              flex: '1 1 120px', minWidth: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 12px',
              cursor: 'pointer', transition: 'all 0.15s',
              outline: !statFilter ? '2px solid var(--accent-dark)' : 'none',
              outlineOffset: -2,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                {statFilter ? 'All' : 'Cut Tickets'}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--accent-dark)' }}>{filteredRows.length}</div>
            </div>

            {/* Top 4 Vendors — click to filter */}
            {topVendors.length > 0 ? (
              topVendors.map(([vendor, count], idx) => {
                const isActive = statFilter === vendor;
                return (
                  <div key={vendor} className="stat-card" onClick={() => setStatFilter(isActive ? null : vendor)} style={{
                    flex: '1 1 140px', minWidth: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '14px 12px',
                    cursor: 'pointer', transition: 'all 0.15s',
                    outline: isActive ? '2px solid var(--accent-dark)' : 'none',
                    outlineOffset: -2,
                    background: isActive ? 'var(--surface2)' : undefined,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent-dark)' : (idx === 0 ? 'var(--accent-dark)' : 'var(--text)'), marginBottom: 4, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={vendor}>
                      {vendor}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: isActive ? 'var(--accent-dark)' : (idx === 0 ? 'var(--accent-dark)' : 'var(--text)') }}>{count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>cuts</div>
                  </div>
                );
              })
            ) : (
              <div className="stat-card" style={{ flex: '1 1 140px', minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No contractor data</span>
              </div>
            )}
          </div>

          {/* Search + Date filter toolbar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <input
              className="search-input"
              style={{ maxWidth: 180 }}
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Due Date</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {[['7d',7],['14d',14],['30d',30],['60d',60],['90d',90]].map(([lbl,d]) => (
                <button key={lbl} onClick={() => applyDatePreset(d)}
                  style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {lbl}
                </button>
              ))}
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  style={{ fontSize: 11, padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  All
                </button>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={exportCSV} style={{ marginLeft: 'auto' }}>CSV</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {displayRows.length} row{displayRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ tableLayout: 'auto', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {activeColumns.map(c => (
                    <th key={c.key} style={thStyle} onClick={() => toggleSort(c.key)}>
                      {c.label} {sort.col === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : <span style={{ opacity: 0.3 }}>⇅</span>}
                    </th>
                  ))}
                  <th style={{ ...thStyle, cursor: 'default', minWidth: 200, whiteSpace: 'normal' }}>Status</th>
                  <th style={{ ...thStyle, minWidth: 140, cursor: 'default' }}>Comments</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(r => {
                  const rowStatus = statuses[r._id] || {};
                  const checkedKeys = STATUS_OPTIONS.filter(s => rowStatus[s.key]);
                  return (
                    <tr key={r._id}>
                      {activeColumns.map((c, idx) => (
                        <td key={c.key} style={{
                          ...compact,
                          ...(idx === 0 ? { fontWeight: 600, color: 'var(--accent-dark)' } : {}),
                          ...(useMapped && c.key === 'customer_po' ? { fontWeight: 600 } : {}),
                        }}>
                          {c.key === 'due_date' ? (
                            <input
                              type="date"
                              value={getCellValue(r, c) || ''}
                              onChange={e => updateDueDate(r, e.target.value)}
                              style={{
                                fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)',
                                borderRadius: 4, background: savingDate === (r._dbId || r._id) ? 'var(--surface2)' : 'var(--surface)',
                                color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer',
                                width: 130, outline: 'none',
                              }}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                            />
                          ) : c.key === 'eta' ? (
                            <input
                              type="date"
                              value={getCellValue(r, c) || ''}
                              onChange={e => updateEta(r, e.target.value)}
                              style={{
                                fontSize: 12, padding: '3px 6px', border: '1px solid var(--border)',
                                borderRadius: 4, background: savingEta === (r._dbId || r._id) ? 'var(--surface2)' : 'var(--surface)',
                                color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer',
                                width: 130, outline: 'none',
                              }}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                            />
                          ) : c.key === 'vendor_invoice' ? (
                            (() => {
                              const ct = r.ct || getCellValue(r, activeColumns.find(col => col.key === 'ct') || {}) || '';
                              const info = ctInvoiceMap[ct];
                              return info ? (
                                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                                  {info.invoice || '—'}
                                </span>
                              ) : '—';
                            })()
                          ) : (
                            getCellValue(r, c) || '—'
                          )}
                        </td>
                      ))}
                      {/* Status checkboxes */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'normal' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
                          {STATUS_OPTIONS.map(s => (
                            <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={!!rowStatus[s.key]}
                                onChange={() => toggleStatus(r._id, s.key)}
                                style={{ accentColor: s.color, cursor: 'pointer', width: 13, height: 13 }}
                              />
                              <span style={{
                                fontSize: 11, fontWeight: rowStatus[s.key] ? 700 : 400,
                                color: rowStatus[s.key] ? s.color : 'var(--text-muted)',
                                transition: 'color 0.15s',
                              }}>
                                {s.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </td>
                      {/* Comment */}
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          value={comments[r._id] || ''}
                          onChange={e => setComments(prev => ({ ...prev, [r._id]: e.target.value }))}
                          placeholder="Add comment..."
                          style={{
                            width: '100%', minWidth: 130, border: '1px solid var(--border)',
                            borderRadius: 4, padding: '4px 7px', fontSize: 11,
                            fontFamily: 'inherit', background: 'var(--surface)',
                            color: 'var(--text)', outline: 'none',
                          }}
                          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 12, borderTop: '1px solid var(--border)' }}>
              Showing {displayRows.length} of {filteredRows.length} rows
            </div>
          </div>
        </>
      )}
    </div>
  );
}
