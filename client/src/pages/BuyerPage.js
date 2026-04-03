import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardList, ShoppingBag } from 'lucide-react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

const LS_PREFIX = 'ua_buyer_orders_';
const SHIPPING_CACHE_KEY = 'ua_shipping_cache';

/* ── Buyer helpers ── */
const isRossVariant = (b) => ['ross', 'ross-missy', 'ross-petite', 'ross-plus'].includes(b);
/* All buyers that get CT + PT sync, Match CTs button, and ticket columns */
const hasCtSync = (b) => isRossVariant(b) || b === 'burlington' || b === 'bealls';
const ROSS_TAB_MAP = {
  'ross': null,           // first tab (legacy)
  'ross-missy': null,     // first tab (Missy = default)
  'ross-petite': 'Petite',
  'ross-plus': 'Plus',
};
const buyerDisplayLabel = (b) => {
  if (b === 'ross-missy') return 'Ross Missy';
  if (b === 'ross-petite') return 'Ross Petite';
  if (b === 'ross-plus') return 'Ross Plus';
  if (b === 'bealls') return 'Bealls';
  return null;
};

/* ── helpers ── */
const parseDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  // Handle Excel serial dates
  if (/^\d{5}$/.test(s)) {
    const d = new Date((parseInt(s) - 25569) * 86400000);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // Handle MM/DD/YYYY or M/D/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const yr = slashMatch[3].length === 2 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3]);
    const d = new Date(yr, parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // ISO or other
  const d = new Date(s);
  if (!isNaN(d)) { d.setHours(0, 0, 0, 0); return d; }
  return null;
};

const fmtDate = (d) => {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* Get header by Excel column letter (A=0, B=1, ...) */
const colLetterToHeader = (headers, letter) => {
  const idx = letter.toUpperCase().split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  return headers[idx] || null;
};

/* Fuzzy header matching */
const findHeader = (headers, candidates) => {
  const lc = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lc.findIndex(h => h.includes(c.toLowerCase()));
    if (idx >= 0) return headers[idx];
  }
  return null;
};

/* Parse Burlington column Q → { style, color }
   Format is always: "{STYLE_CODE} {COLOR DESCRIPTION}"
   Style = everything before the first space (may contain dashes: "1134600X-21-293")
   Color = everything after the first space (may contain slashes: "IVORY/RUST 19")

   Examples:
     "9644601X WHITE EYELET 18"       → { style: "9644601X",        color: "WHITE EYELET 18" }
     "1134600X-21-293 IVORY/RUST 19"  → { style: "1134600X-21-293", color: "IVORY/RUST 19" }
     "9224600X-GS2528 CROCUS/IVOR 20" → { style: "9224600X-GS2528", color: "CROCUS/IVOR 20" }
     "7314610P WHITE 23"              → { style: "7314610P",         color: "WHITE 23" }
*/
const parseBurlStyleColor = (raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return { style: '', color: '' };
  const spaceIdx = s.indexOf(' ');
  if (spaceIdx === -1) return { style: s, color: '' };  // no space → whole value is style
  return { style: s.slice(0, spaceIdx).trim(), color: s.slice(spaceIdx + 1).trim() };
};

/* ── CT Matching ── */
const PROD_CACHE_KEY = 'production_cached_data';
const BURL_CT_MAP_KEY = 'ua_burlington_ct_map'; // { [lpo]: ctNumber } — legacy key
const CT_MAP_KEY = (buyer) => `ua_${buyer}_ct_map`; // per-buyer CT map

const normalize = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Normalize style for matching: strip trailing suffix letters (X, P, J, G, M, E, etc.) → base digits */
const normalizeStyle = (s) => String(s || '').trim().replace(/[A-Z]+$/i, '').replace(/[-_]/g, '').toLowerCase();

/* Normalize color for matching: strip trailing numbers/size codes so "WHITE EYELET 18" → "white eyelet" */
const normalizeColor = (s) => String(s || '').trim().toLowerCase().replace(/\s+\d+$/, '').trim();

/* Extract style/color/units from a production row.
   Actual column names in the production export: style_header, color_header, total, cutno, custpo */
const extractProdStyleColor = (row) => {
  const style = String(row.style_header || row.style || row.Style || '').trim();
  const color = String(row.color_header || row.color || row.Color || '').trim();
  const units = String(row.total || row.units || row.qty || '').trim();
  return { style, color, units };
};

/* Get Monday of the current week */
const getMonday = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
};

/* ── Main Component ── */
export default function BuyerPage() {
  const { buyer } = useParams();
  const toast = useToast();
  const buyerLabel = buyerDisplayLabel(buyer) || (buyer?.charAt(0).toUpperCase() + buyer?.slice(1));
  const fileRef = useRef();

  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [shippingOrders, setShippingOrders] = useState([]);
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`ua_buyer_notes_${buyer}`) || '{}'); } catch { return {}; }
  });

  const [ctMap, setCtMap] = useState(() => {
    try {
      // Try per-buyer key first, then legacy Burlington key
      const data = localStorage.getItem(CT_MAP_KEY(buyer)) || (buyer === 'burlington' ? localStorage.getItem(BURL_CT_MAP_KEY) : null);
      return JSON.parse(data || '{}');
    } catch { return {}; }
  });
  const [ptMap, setPtMap] = useState({}); // { [lpo]: pick_ticket }
  const [ctMatches, setCtMatches] = useState(null); // null = modal closed, [] = open

  const handleNoteChange = (po, val) => {
    const updated = { ...notes, [po]: val };
    setNotes(updated);
    try { localStorage.setItem(`ua_buyer_notes_${buyer}`, JSON.stringify(updated)); } catch { /* noop */ }
  };

  /* ── Run CT matching against Production API ── */
  const [ctLoading, setCtLoading] = useState(false);
  const runCtMatch = useCallback(async () => {
    setCtLoading(true);
    try {
      // Fetch production data from server API
      const res = await api.get('/production');
      const prodRows = Array.isArray(res.data) ? res.data : [];

      if (!prodRows.length) {
        alert('No Production data found — add data in the Production page first');
        setCtLoading(false);
        return;
      }

      // Get production rows matching this buyer with CTs
      const buyerUpper = isRossVariant(buyer) ? 'ROSS' : buyer.toUpperCase();
      const buyerProdRows = prodRows
        .filter(r => String(r.customer || '').toUpperCase().includes(buyerUpper))
        .filter(r => String(r.ct || '').trim());

      if (!buyerProdRows.length) {
        alert(`No ${buyer.charAt(0).toUpperCase() + buyer.slice(1)} rows with Cut Tickets found in Production data`);
        setCtLoading(false);
        return;
      }

      // Build list of all CTs with their info
      const seen = new Set();
      const matches = [];
      buyerProdRows.forEach(prodRow => {
        const ct = String(prodRow.ct || '').trim();
        if (!ct || seen.has(ct)) return;
        seen.add(ct);
        const custPo = String(prodRow.customer_po || '').trim();
        const vendor = String(prodRow.vendor || '').trim();
        const dueDate = prodRow.due_date ? new Date(prodRow.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '';
        const assignedLpo = Object.entries(ctMap).find(([lpo, c]) => c === ct)?.[0] || '';
        matches.push({
          ct,
          lpo: assignedLpo,
          style: vendor,
          color: dueDate,
          burlUnits: '',
          prodUnits: '',
          currentPo: custPo,
          unitsMatch: null,
          selected: !assignedLpo,
        });
      });

      matches.sort((a, b) => Number(a.ct) - Number(b.ct));
      setCtMatches(matches);
    } catch (err) {
      alert('Failed to load production data: ' + (err.message || 'unknown error'));
    }
    setCtLoading(false);
  }, [buyer, ctMap]);

  const applyCtMatches = useCallback((matches) => {
    // Save to per-buyer CT map
    const newMap = { ...ctMap };
    matches.filter(m => m.selected && m.lpo).forEach(m => { newMap[m.lpo] = m.ct; });
    setCtMap(newMap);
    try { localStorage.setItem(CT_MAP_KEY(buyer), JSON.stringify(newMap)); } catch { /* noop */ }

    // Also update Production cache: write customer_po back to matched prod rows
    try {
      const prod = JSON.parse(localStorage.getItem(PROD_CACHE_KEY) || '{}');
      const prodRows = prod?.rawData?.rows || [];
      matches.filter(m => m.selected).forEach(m => {
        const row = prodRows.find(r => String(r.ct || r.CT || '').trim() === m.ct);
        if (row && !row.customer_po) row.customer_po = m.lpo;
      });
      if (prod?.rawData) {
        prod.rawData.rows = prodRows;
        localStorage.setItem(PROD_CACHE_KEY, JSON.stringify(prod));
      }
    } catch { /* noop */ }

    toast.success(`Applied ${matches.filter(m => m.selected).length} CT matches`);
    setCtMatches(null);
  }, [ctMap, toast]);

  const [colFilters, setColFilters] = useState({ po: '', style: '', color: '', units: '', cancelDate: '' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Quick-range presets
  const applyPreset = (days) => {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + days * 86400000).toISOString().slice(0, 10);
    setDateFrom(from);
    setDateTo(to);
  };

  /* ── Full CT + PT sync ── */
  /* Fetches pick tickets, STAR sheet CTs, and production CTs in one shot.
     Called automatically after upload and on mount — no extra clicks needed. */
  const STAR_SHEET_ID = '1uiisYbU9PCkw3n6UuoO7VWkxPyaUDpAo0gI_XNAoGts';
  const STAR_CT_CACHE_KEY = 'ua_star_ticket_ct_map';

  const syncCtPt = useCallback(async (rows, hdrs) => {
    if (!hasCtSync(buyer)) return;
    if (!rows.length) return;

    try {
      const poH = buyer === 'burlington'
        ? findHeader(hdrs, ['lpo', 'l po', 'lpo #', 'lpo number', 'po', 'po #', 'po number', 'purchase order'])
        : findHeader(hdrs, ['po', 'po#', 'po number', 'purchase order']);
      if (!poH) return;

      const newCtMap = {};

      /* ── Step 1: Fetch Pick Tickets from warehouse-orders ── */
      let freshPtMap = {};
      try {
        const apiBuyer = isRossVariant(buyer) ? 'ROSS' : buyer.toUpperCase();
        const ptRes = await api.get('/warehouse-orders', { params: { buyer: apiBuyer, limit: 5000 } });
        const ptData = Array.isArray(ptRes.data?.data) ? ptRes.data.data : [];
        ptData.forEach(r => {
          if (r.po && r.ticket_number) freshPtMap[r.po] = r.ticket_number;
        });
        setPtMap(freshPtMap);
      } catch (e) {
        freshPtMap = { ...ptMap };
      }

      /* ── Step 2: Fetch Google Sheet STAR tab → ticket→CT map ── */
      let ticketToCt = {};
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${STAR_SHEET_ID}/export?format=csv&gid=0`;
        const csvRes = await fetch(csvUrl);
        const csvText = await csvRes.text();
        const parseCSV = (csv) => {
          const csvRows = []; let row = []; let field = ''; let inQ = false;
          for (let i = 0; i < csv.length; i++) {
            const ch = csv[i];
            if (inQ) { if (ch === '"' && csv[i+1] === '"') { field += '"'; i++; } else if (ch === '"') inQ = false; else field += ch; }
            else { if (ch === '"') inQ = true; else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\n' || (ch === '\r' && csv[i+1] === '\n')) { row.push(field); field = ''; if (row.length > 1) csvRows.push(row); row = []; if (ch === '\r') i++; } else field += ch; }
          }
          if (field || row.length) { row.push(field); csvRows.push(row); }
          return csvRows;
        };
        const csvRows = parseCSV(csvText);
        const csvH = csvRows[0] || [];
        const tIdx = csvH.indexOf('Ticket #');
        const lIdx = csvH.indexOf('Lot');
        if (tIdx >= 0 && lIdx >= 0) {
          csvRows.slice(1).forEach(r => {
            const ticket = String(r[tIdx] || '').trim().replace(/-.*/, '');
            const lotMatch = String(r[lIdx] || '').match(/(?:CUT|CT)\s*(\d+)/i);
            if (ticket && lotMatch) ticketToCt[ticket] = lotMatch[1];
          });
        }
        try { localStorage.setItem(STAR_CT_CACHE_KEY, JSON.stringify(ticketToCt)); } catch (e) { /* noop */ }
      } catch (e) {
        try { ticketToCt = JSON.parse(localStorage.getItem(STAR_CT_CACHE_KEY) || '{}'); } catch (e2) { /* noop */ }
      }

      /* ── Step 3: Map POs → CTs via pick ticket lookup ── */
      rows.forEach(row => {
        const po = String(row[poH] || row['PO'] || '').trim();
        if (!po) return;
        const pt = freshPtMap[po];
        if (!pt) return;
        const ptBase = String(pt).replace(/-.*/, '');
        if (ticketToCt[ptBase]) {
          newCtMap[po] = ticketToCt[ptBase];
        }
      });

      /* ── Step 4: Fallback — production style matching for remaining POs ── */
      try {
        const res = await api.get('/production');
        const prodRows = Array.isArray(res.data) ? res.data : [];
        const customerMatch = buyer === 'burlington' ? 'BURLINGTON' : buyer === 'bealls' ? 'BEALLS' : 'ROSS';
        const buyerProdRows = prodRows
          .filter(r => String(r.customer || '').toUpperCase().includes(customerMatch))
          .filter(r => String(r.ct || '').trim());

        if (buyerProdRows.length) {
          const baseStyle = (s) => { const m = String(s || '').trim().match(/^(\d+)/); return m ? m[1] : ''; };
          const prodByStyle = {};
          buyerProdRows.forEach(r => {
            const base = baseStyle(r.style);
            if (!base) return;
            if (!prodByStyle[base]) prodByStyle[base] = [];
            prodByStyle[base].push({ ct: String(r.ct).trim(), color: String(r.color || '').toUpperCase(), units: Number(r.units) || 0 });
          });

          const styleColH = buyer === 'burlington'
            ? (colLetterToHeader(hdrs, 'Q') || findHeader(hdrs, ['burl style', 'style', 'style #', 'vendor style']))
            : findHeader(hdrs, ['vendor style', 'vendor_style', 'vendorstyle']);
          const unitsH = findHeader(hdrs, ['units', 'qty', 'quantity', 'order qty', 'total units', 'inbound u', 'inbound']);
          const itemStyleH = findHeader(hdrs, ['item style', 'item_style', 'description', 'desc']);
          const assigned = new Set(Object.values(newCtMap));

          const sorted = [...rows].sort((a, b) => Number(a[poH] || a['PO'] || 0) - Number(b[poH] || b['PO'] || 0));
          sorted.forEach(row => {
            const po = String(row[poH] || row['PO'] || '').trim();
            if (!po || newCtMap[po]) return;
            let vs, colorDesc;
            if (buyer === 'burlington' && styleColH) {
              const parsed = parseBurlStyleColor(row[styleColH]);
              vs = parsed.style;
              colorDesc = parsed.color.toUpperCase();
            } else {
              vs = String(row[styleColH] || '').trim();
              colorDesc = String(row[itemStyleH] || '').toUpperCase();
            }
            const base = baseStyle(vs);
            if (!base || !prodByStyle[base]) return;
            const units = Number(row[unitsH] || 0);
            const candidates = prodByStyle[base].filter(p => !assigned.has(p.ct));
            if (!candidates.length) return;
            let best = null;
            for (const c of candidates) { const cw = c.color.split(/[-\/\s]/)[0].trim(); if (c.units === units && cw && colorDesc.includes(cw)) { best = c; break; } }
            if (!best) { for (const c of candidates) { if (c.units === units) { best = c; break; } } }
            if (!best) best = candidates[0];
            assigned.add(best.ct);
            newCtMap[po] = best.ct;
          });
        }
      } catch (e) { /* production fallback failed */ }

      /* ── Apply results ── */
      const ctCount = Object.keys(newCtMap).length;
      const ptCount = Object.keys(freshPtMap).length;
      if (ctCount) {
        setCtMap(newCtMap);
        try { localStorage.setItem(CT_MAP_KEY(buyer), JSON.stringify(newCtMap)); } catch (e) { /* noop */ }
      }
      if (ptCount || ctCount) {
        toast.success(`Synced ${ctCount} Cut Ticket${ctCount !== 1 ? 's' : ''} · ${ptCount} Pick Ticket${ptCount !== 1 ? 's' : ''}`);
      }
    } catch (e) { /* silently fail */ }
  }, [buyer, ptMap, toast]);

  // Load cached data on mount and auto-sync CT/PT
  useEffect(() => {
    let cachedRows = null;
    let cachedHeaders = null;
    try {
      const cached = JSON.parse(localStorage.getItem(LS_PREFIX + buyer));
      if (cached && cached.rows) {
        cachedRows = cached.rows;
        cachedHeaders = cached.headers || [];
        setRawRows(cachedRows);
        setHeaders(cachedHeaders);
      }
    } catch { /* ignore */ }

    // Load shipping data from cache for cross-reference
    try {
      const sc = JSON.parse(localStorage.getItem(SHIPPING_CACHE_KEY));
      if (sc && Array.isArray(sc.data)) setShippingOrders(sc.data);
    } catch { /* ignore */ }

    // Also try fresh from API
    api.get('/warehouse-orders', { params: { limit: 2000, scope: 'shipping' } })
      .then(res => {
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        setShippingOrders(data);
      })
      .catch(() => { /* use cached */ });

    // Auto-sync CT/PT on mount if we have cached order data
    if (cachedRows && cachedRows.length && cachedHeaders) {
      syncCtPt(cachedRows, cachedHeaders);
    }
  }, [buyer, syncCtPt]);

  /* ── File upload via SheetJS (loaded dynamically) ── */
  const ensureXLSX = () => new Promise((resolve) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const XLSX = await ensureXLSX();
      if (!XLSX) { toast.error('Failed to load XLSX parser'); setUploading(false); return; }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Ross Petite / Plus read from the named tab; others read first tab
      const targetTab = ROSS_TAB_MAP[buyer] || null;
      let wsName = wb.SheetNames[0];
      if (targetTab) {
        const found = wb.SheetNames.find(n => n.toLowerCase().trim() === targetTab.toLowerCase());
        if (found) {
          wsName = found;
        } else {
          toast.error(`Tab "${targetTab}" not found in file. Available tabs: ${wb.SheetNames.join(', ')}`);
          setUploading(false);
          return;
        }
      }
      const ws = wb.Sheets[wsName];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!json.length) { toast.error('No data found in file'); setUploading(false); return; }

      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRawRows(json);

      // Cache
      try {
        localStorage.setItem(LS_PREFIX + buyer, JSON.stringify({ headers: hdrs, rows: json, ts: Date.now() }));
      } catch { /* too large */ }

      toast.success(`Uploaded ${json.length} rows — syncing CTs & PTs…`);

      // Auto-sync Cut Tickets + Pick Tickets immediately
      await syncCtPt(json, hdrs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse file: ' + err.message);
    }
    setUploading(false);
  }, [buyer, toast, syncCtPt]);


  /* ── Column mapping ── */
  const colMap = useMemo(() => {
    if (!headers.length) return {};
    return {
      po: findHeader(headers, (buyer === 'burlington' || buyer === 'hahna')
        ? ['lpo', 'l po', 'lpo #', 'lpo number', 'po', 'po #', 'po number', 'purchase order']
        : ['po', 'po #', 'po number', 'purchase order']),
      styleColor: (buyer === 'burlington' || buyer === 'hahna')
        ? (colLetterToHeader(headers, 'Q') || findHeader(headers, ['burl style', 'style', 'style #', 'vendor style']))
        : null,
      style: (buyer === 'burlington' || buyer === 'hahna')
        ? null
        : findHeader(headers, ['style', 'style #', 'style number', 'vendor style']),
      description: findHeader(headers, ['description', 'desc', 'style desc', 'item style']),
      color: (buyer === 'burlington' || buyer === 'hahna')
        ? null
        : findHeader(headers, ['color', 'clr', 'color desc']),
      cancelDate: findHeader(headers, ['cancel', 'cancel date', 'po cancel date', 'cxl', 'cxl date', 'cancel dt']),
      shipDate: findHeader(headers, ['ship', 'ship date', 'start ship', 'ship start', 'po start date', 'start date']),
      units: findHeader(headers, ['units', 'qty', 'quantity', 'order qty', 'total units', 'inbound u', 'inbound']),
      buyer: findHeader(headers, ['buyer', 'buyer name', 'agent', 'planner']),
      status: findHeader(headers, ['status', 'order status', 'po status']),
      cost: findHeader(headers, ['cost', 'unit cost', 'fob']),
    };
  }, [headers]);

  /* Diagnostic: what is in col Q for the first row? */
  const colQDebug = useMemo(() => {
    if (!headers.length || !rawRows.length) return null;
    const qHdr = colLetterToHeader(headers, 'Q');
    const sample = rawRows.slice(0, 3).map(r => r[qHdr]);
    return { header: qHdr, samples: sample };
  }, [headers, rawRows]);

  const getVal = (row, key) => {
    // Burlington / Hahna: parse style + color out of combined column Q
    if ((buyer === 'burlington' || buyer === 'hahna') && colMap.styleColor && (key === 'style' || key === 'color')) {
      const raw = row[colMap.styleColor];
      const parsed = parseBurlStyleColor(raw);
      return key === 'style' ? parsed.style : parsed.color;
    }
    const hdr = colMap[key];
    return hdr ? row[hdr] : undefined;
  };

  /* ── Next-week window (Monday-based, same as Shipping) ── */
  const monday = useMemo(() => getMonday(), []);
  const nextWeekStart = useMemo(() => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    return d;
  }, [monday]);
  const nextWeekEnd = useMemo(() => {
    const d = new Date(nextWeekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [nextWeekStart]);

  /* ── Build shipping PO lookup for cross-reference ── */
  const shippingByPo = useMemo(() => {
    const map = {};
    shippingOrders.forEach(o => {
      if (o.po) map[String(o.po).trim().toUpperCase()] = o;
    });
    return map;
  }, [shippingOrders]);

  /* ── All future orders mapped (replaces next-week-only filter) ── */
  const nextWeekOrders = useMemo(() => {
    if (!rawRows.length || !colMap.cancelDate) return [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const filterFrom = dateFrom ? new Date(dateFrom + 'T00:00:00') : today;
    const filterTo   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;

    return rawRows.filter(row => {
      const cxl = parseDate(getVal(row, 'cancelDate'));
      if (!cxl || cxl < today) return false;
      const units = parseFloat(getVal(row, 'units')) || 0;
      if (units <= 0) return false;
      if (cxl < filterFrom) return false;
      if (filterTo && cxl > filterTo) return false;
      return true;
    }).map(row => {
      const po = String(getVal(row, 'po') || '').trim();
      const poKey = po.toUpperCase();
      const shipped = shippingByPo[poKey];
      const cxl = parseDate(getVal(row, 'cancelDate'));
      const daysUntil = cxl ? Math.ceil((cxl - new Date().setHours(0,0,0,0)) / 86400000) : 999;
      return {
        ...row,
        _po: po,
        _cancelDate: cxl,
        _daysUntil: daysUntil,
        _buyer: String(getVal(row, 'buyer') || 'Unassigned').trim(),
        _routingStatus: shipped?.routing_status || null,
        _routing: shipped?.routing || null,
        _lifecycle: shipped?.lifecycle || null,
      };
    }).sort((a, b) => a._cancelDate - b._cancelDate);
  }, [rawRows, colMap, shippingByPo, dateFrom, dateTo]);

  /* Group by buyer */
  const groupedByBuyer = useMemo(() => {
    const map = {};
    nextWeekOrders.forEach(o => {
      const b = o._buyer || 'Unassigned';
      if (!map[b]) map[b] = [];
      map[b].push(o);
    });
    // Sort buyers alphabetically
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [nextWeekOrders]);

  /* ── All future outstanding = same as nextWeekOrders now ── */
  const allFutureOrders = nextWeekOrders;

  /* ── Bar chart: PO count by cancel date ── */
  const cancelByDate = useMemo(() => {
    const map = {};
    nextWeekOrders.forEach(o => {
      if (!o._cancelDate) return;
      const key = o._cancelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [nextWeekOrders]);

  const routedCount = nextWeekOrders.filter(o => o._routingStatus === 'routed').length;
  const notRoutedCount = nextWeekOrders.filter(o => o._routingStatus !== 'routed').length;

  /* ── Routing badge ── */
  const routingBadge = (status) => {
    if (status === 'routed') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>Routed</span>;
    if (status === 'not_routed') return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: 'rgba(234,179,8,0.12)', color: '#8B7028', border: '1px solid rgba(234,179,8,0.3)' }}>Not Routed</span>;
    return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>No Match</span>;
  };

  const compact = { whiteSpace: 'nowrap', fontSize: 12, padding: '8px 8px' };

  return (
    <div className="fade-in">
      <PageHeader title={buyerLabel} />

      {/* Actions row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {rawRows.length > 0 && `${rawRows.length} total rows loaded`}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 12, padding: '6px 16px' }}
          >
            {uploading ? 'Uploading...' : 'Upload Outstanding Orders'}
          </button>
          {(hasCtSync(buyer)) && rawRows.length > 0 && (
            <button
              onClick={runCtMatch}
              disabled={ctLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, padding: '6px 16px', background: '#5C3317', color: '#fff', border: 'none', opacity: ctLoading ? 0.6 : 1 }}
            >
              {ctLoading ? '⏳ Loading...' : '🔗 Match CTs'}
            </button>
          )}
          {rawRows.length > 0 && (
            <button
              onClick={() => { setRawRows([]); setHeaders([]); localStorage.removeItem(LS_PREFIX + buyer); }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, padding: '6px 16px' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {rawRows.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 180px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{allFutureOrders.length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Future Outstanding</div>
          </div>
          <div style={{ flex: '1 1 180px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{allFutureOrders.filter(o => o._daysUntil <= 7).length}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Canceling ≤ 7 Days</div>
          </div>
          <div style={{ flex: '1 1 180px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{routedCount}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Routed</div>
          </div>
          <div style={{ flex: '1 1 180px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{notRoutedCount}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Not Routed / No Match</div>
          </div>
        </div>
      )}

      {/* Col Q debug strip — Burlington only */}
      {buyer === 'burlington' && colQDebug && (
        <div style={{ marginBottom: 10, padding: '8px 14px', background: 'rgba(92,51,23,0.08)', border: '1px solid rgba(92,51,23,0.2)', borderRadius: 7, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><b>Col Q header:</b> "{colQDebug.header || '(none)'}"</span>
          {colQDebug.samples.map((s, i) => (
            <span key={i}><b>Row {i+1}:</b> "{String(s ?? '')}"</span>
          ))}
        </div>
      )}

      {/* Date filter bar */}
      {rawRows.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>Cancel Date</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {[['7d', 7], ['14d', 14], ['30d', 30], ['60d', 60], ['90d', 90]].map(([label, days]) => (
              <button key={label} onClick={() => applyPreset(days)}
                style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            ))}
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {allFutureOrders.length} orders shown
          </span>
        </div>
      )}

      {/* Grouped by buyer */}
      {groupedByBuyer.length > 0 ? (
        groupedByBuyer.map(([buyerName, orders]) => (
          <div key={buyerName} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: '#fff',
              padding: '10px 16px', background: '#5C3317',
              borderRadius: '10px 10px 0 0', border: '1px solid #3e2310',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{buyerName}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{orders.length} orders</span>
            </div>
            <div className="table-wrap" style={{ overflowX: 'auto', borderRadius: '0 0 10px 10px', marginTop: 0 }}>
              <table style={{ tableLayout: 'auto', whiteSpace: 'nowrap', borderTop: 'none' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 8px' }}>PO</th>
                    <th style={{ padding: '8px 8px' }}>Style #</th>
                    {!isRossVariant(buyer) && <th style={{ padding: '8px 8px' }}>Color</th>}
                    <th style={{ padding: '8px 8px' }}>Units</th>
                    <th style={{ padding: '8px 8px' }}>Cancel Date</th>
                    {(hasCtSync(buyer)) && <th style={{ padding: '8px 8px' }}>Cut Ticket</th>}
                    {(hasCtSync(buyer)) && <th style={{ padding: '8px 8px' }}>Pick Ticket</th>}
                    <th style={{ padding: '8px 8px' }}>Status</th>
                    <th style={{ padding: '8px 8px' }}>Notes</th>
                  </tr>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {(isRossVariant(buyer) ? ['po','style','units','cancelDate'] : ['po','style','color','units','cancelDate']).map(key => (
                      <th key={key} style={{ padding: '4px 6px' }}>
                        <input
                          type="text"
                          value={colFilters[key] || ''}
                          onChange={e => setColFilters(f => ({ ...f, [key]: e.target.value }))}
                          placeholder="Filter…"
                          style={{
                            width: '100%', minWidth: 60, fontSize: 10, padding: '3px 6px',
                            border: '1px solid var(--border)', borderRadius: 4,
                            background: 'var(--surface)', color: 'var(--text)',
                            fontFamily: 'inherit', outline: 'none', fontWeight: 400,
                          }}
                        />
                      </th>
                    ))}
                    {(hasCtSync(buyer)) && <th style={{ padding: '4px 6px' }} />}
                    {(hasCtSync(buyer)) && <th style={{ padding: '4px 6px' }} />}
                    <th style={{ padding: '4px 6px' }} />
                    <th style={{ padding: '4px 6px' }} />
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o => {
                    const f = colFilters;
                    if (f.po && !String(o._po).toLowerCase().includes(f.po.toLowerCase())) return false;
                    if (f.style && !String(getVal(o,'style')||'').toLowerCase().includes(f.style.toLowerCase())) return false;
                    if (f.color && !String(getVal(o,'color')||'').toLowerCase().includes(f.color.toLowerCase())) return false;
                    if (f.units && !String(getVal(o,'units')||'').toLowerCase().includes(f.units.toLowerCase())) return false;
                    if (f.cancelDate && !fmtDate(o._cancelDate).toLowerCase().includes(f.cancelDate.toLowerCase())) return false;
                    return true;
                  }).map((o, i) => (
                    <tr key={i} style={{
                      background: o._daysUntil <= 7 ? 'rgba(239,68,68,0.10)'
                        : o._daysUntil <= 14 ? 'rgba(234,179,8,0.08)'
                        : o._routingStatus === 'routed' ? 'rgba(34,197,94,0.06)'
                        : 'transparent',
                    }}>
                      <td style={{ ...compact, fontWeight: 600 }}>{o._po || '—'}</td>
                      <td style={compact}>{getVal(o, 'style') || '—'}</td>
                      {!isRossVariant(buyer) && <td style={compact}>{getVal(o, 'color') || '—'}</td>}
                      <td style={compact}>{getVal(o, 'units') || '—'}</td>
                      <td style={compact}>{fmtDate(o._cancelDate)}</td>
                      {(hasCtSync(buyer)) && (
                        <td style={compact}>
                          {ctMap[o._po]
                            ? <span style={{ fontWeight: 700, color: 'var(--accent-dark)', fontSize: 12 }}>{ctMap[o._po]}</span>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                        </td>
                      )}
                      {(hasCtSync(buyer)) && (
                        <td style={compact}>
                          {ptMap[o._po]
                            ? <span style={{ fontWeight: 700, color: '#2563eb', fontSize: 12 }}>{ptMap[o._po]}</span>
                            : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                        </td>
                      )}
                      <td style={{ ...compact, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                          {o._routing && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o._routing}</span>}
                          {routingBadge(o._routingStatus)}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="text"
                          value={notes[o._po] || ''}
                          onChange={e => handleNoteChange(o._po, e.target.value)}
                          placeholder="Add note…"
                          style={{
                            width: 160, fontSize: 11, padding: '4px 8px',
                            border: '1px solid var(--border)', borderRadius: 5,
                            background: 'var(--surface2)', color: 'var(--text)',
                            fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : rawRows.length > 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ClipboardList size={32} strokeWidth={1.5} color="var(--text-muted)" /></div>
          <div>No future outstanding orders found (all have 0 units or are past cancel date).</div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><ShoppingBag size={32} strokeWidth={1.5} color="var(--text-muted)" /></div>
          <div>Upload {buyerLabel} Outstanding Orders to get started.</div>
        </div>
      )}

      {/* ── Cancel Date Bar Chart ── */}
      {cancelByDate.length > 0 && (
        <div style={{ marginTop: 32, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>POs Cancelling by Date</div>
          {(() => {
            const max = Math.max(...cancelByDate.map(([,c]) => c));
            const today = new Date(); today.setHours(0,0,0,0);
            return cancelByDate.map(([date, count]) => {
              const dt = new Date(date);
              const daysOut = Math.ceil((dt - today) / 86400000);
              const barColor = daysOut <= 7 ? '#ef4444' : daysOut <= 14 ? '#f59e0b' : '#5C3317';
              const pct = Math.max(4, Math.round((count / max) * 100));
              return (
                <div key={date} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 90, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{date}</div>
                  <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', height: 20 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.3s', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{count}</span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> ≤ 7 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> ≤ 14 days</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#5C3317', display: 'inline-block' }} /> 14+ days</span>
          </div>
        </div>
      )}

      {/* ── CT Match Modal ── */}
      {ctMatches !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={() => setCtMatches(null)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 12, padding: 24, maxWidth: 760, width: '100%',
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>CT Matches Found</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ctMatches.length} Production CTs for {buyer.charAt(0).toUpperCase() + buyer.slice(1)}
                </div>
              </div>
              <button onClick={() => setCtMatches(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>

            {ctMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No matches found</div>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 12px', background: 'rgba(92,51,23,0.05)', borderRadius: 6 }}>
                  Enter a PO for each CT you want to assign, then click Apply. Previously assigned CTs show their current LPO.
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>✓</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>CT #</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Vendor</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Due Date</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Cust PO</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Assign to LPO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctMatches.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: m.lpo ? 'rgba(34,197,94,0.06)' : i % 2 === 0 ? 'transparent' : 'var(--surface2)' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <input type="checkbox" checked={m.selected}
                            onChange={() => setCtMatches(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} />
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#5C3317' }}>{m.ct}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11 }}>{m.style || '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11 }}>{m.color || '—'}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{m.currentPo || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="text"
                            value={m.lpo}
                            placeholder="Enter LPO..."
                            onChange={e => setCtMatches(prev => prev.map((x, j) => j === i ? { ...x, lpo: e.target.value } : x))}
                            style={{ width: 130, padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {ctMatches.filter(m => m.lpo && m.selected).length} of {ctMatches.length} CTs assigned
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setCtMatches(null)} style={{ fontSize: 12 }}>Cancel</button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => applyCtMatches(ctMatches)}
                      style={{ fontSize: 12, background: '#5C3317', border: 'none' }}
                    >
                      Apply {ctMatches.filter(m => m.selected && m.lpo).length} Matches
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
