import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import NeedleLogo from '../components/NeedleLogo';

/* ─── Portfolio Summary Widget for Home Page ─── */
const UA_MERRILL_POSITIONS = [
  { ticker: 'MDB', mark: 281.00, shares: 765 },
  { ticker: 'META', mark: 614.00, shares: 520 },
  { ticker: 'QQQ', mark: 570.00, shares: 87 },
  { ticker: 'SPOT', mark: 476.00, shares: 411 },
  { ticker: 'V', mark: 335.00, shares: 596 },
  { ticker: 'TJX', mark: 145.00, shares: 257 },
  { ticker: 'SPY', mark: 562.00, shares: 791 },
  { ticker: 'CASH', mark: 1.00, shares: 444508, isCash: true },
];
const YTD_BEGINNING = 2000000;

function PortfolioSummaryWidget({ dark }) {
  const [quotes, setQuotes] = useState({});
  const [spxQuote, setSpxQuote] = useState(null);

  useEffect(() => {
    const tickers = UA_MERRILL_POSITIONS.filter(p => !p.isCash).map(p => p.ticker).join(',');
    api.get('/api/quotes?tickers=' + tickers + ',SPY')
      .then(r => {
        const map = {};
        (r.data || []).forEach(q => { map[q.ticker] = q.close; });
        setQuotes(map);
        if (map['SPY']) setSpxQuote(map['SPY']);
      })
      .catch(() => {});
  }, []);

  const totalMV = UA_MERRILL_POSITIONS.reduce((sum, p) => {
    if (p.isCash) return sum + p.shares;
    const price = quotes[p.ticker] || p.mark;
    return sum + price * p.shares;
  }, 0);

  const ytdGrowth = YTD_BEGINNING > 0 ? ((totalMV - YTD_BEGINNING) / YTD_BEGINNING) * 100 : 0;
  const ytdColor = ytdGrowth >= 0 ? '#16a34a' : '#dc2626';

  // SPX YTD: assume SPX started year at ~4770 (approx S&P 500 start 2026)
  const spxStart = 5881;
  const spxCurrent = spxQuote ? spxQuote * 10.08 : 5342; // SPY * ~10 = SPX approximation
  const spxYtd = spxStart > 0 ? ((spxCurrent - spxStart) / spxStart) * 100 : 0;
  const spxColor = spxYtd >= 0 ? '#16a34a' : '#dc2626';

  const cardBg = dark ? 'rgba(164,120,100,0.25)' : 'var(--surface)';
  const cardBorder = dark ? 'transparent' : '1px solid var(--border)';
  const labelColor = dark ? 'var(--lib-dim)' : 'var(--text-muted)';
  const valueColor = dark ? 'var(--lib-text)' : 'var(--text)';

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
      <Link to="/internal/portfolio" style={{
        flex: 1, textDecoration: 'none', background: cardBg, border: cardBorder,
        borderRadius: 10, padding: '14px 12px', display: 'block', transition: 'all 0.15s', textAlign: 'center',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(164,120,100,0.35)' : 'var(--surface)'; if (!dark) e.currentTarget.style.borderColor = 'var(--accent-dark)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = cardBg; if (!dark) e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        <div style={{ fontSize: 9, fontWeight: 600, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Market Value</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, lineHeight: 1.1 }}>
          ${totalMV >= 1e6 ? (totalMV / 1e6).toFixed(2) + 'M' : totalMV.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: ytdColor, marginTop: 3 }}>
          {ytdGrowth >= 0 ? '+' : ''}{ytdGrowth.toFixed(2)}% YTD
        </div>
      </Link>
      <div style={{
        flex: 1, background: cardBg, border: cardBorder,
        borderRadius: 10, padding: '14px 12px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: labelColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>S&P 500</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, lineHeight: 1.1 }}>
          {spxCurrent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: spxColor, marginTop: 3 }}>
          {spxYtd >= 0 ? '+' : ''}{spxYtd.toFixed(2)}% YTD
        </div>
      </div>
    </div>
  );
}

/* ─── library palette — uses CSS variables for theme support ─── */
const LIB_BG       = 'var(--lib-bg)';
const LIB_TEXT     = 'var(--lib-text)';
const LIB_DIM      = 'var(--lib-dim)';
const LIB_BORDER   = 'var(--lib-border)';
const LIB_HOVER    = 'var(--lib-hover)';
/* Report accent — matches --accent-dark */
const REPORT_ACCENT = '#2A1F1A';

/* ─── Two-Week Report (NO ATS) ─── */
function generateReportHTML(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const twoWeekEnd = new Date(now.getTime() + 14 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const periodLabel = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${twoWeekEnd}`;
  const fmt = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  const rs = data.routing?.summary || {};
  const routingOrders = data.routing?.orders || [];
  const cutTickets = data.cut_tickets || [];
  const shipments = data.shipments || [];

  const routingRows = routingOrders.map(o => `
    <tr>
      <td>${o.po || '—'}</td><td>${o.store_name || '—'}</td>
      <td>${o.warehouse_code || '—'}</td>
      <td><span class="badge ${o.routing_status}">${(o.routing_status || '').replace('_', ' ')}</span></td>
      <td>${fmt(o.start_date)}</td><td>${fmt(o.cancel_date)}</td>
    </tr>`).join('');

  const ctRows = cutTickets.map(c => `
    <tr>
      <td>${c.ct_number || '—'}</td><td>${c.po || '—'}</td>
      <td><span class="badge ct-${(c.status || '').toLowerCase().replace(/\s/g,'')}">${c.status || '—'}</span></td>
      <td>${fmt(c.due_date)}</td>
    </tr>`).join('');

  const vesselRows = shipments.map(s => `
    <tr>
      <td>${s.po || '—'}</td><td>${s.store_name || '—'}</td><td>${s.carrier || '—'}</td>
      <td>${s.load_id_number || '—'}</td><td>${fmt(s.load_id_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Unlimited Avenues — Two-Week Report</title>
<style>
  @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',-apple-system,sans-serif;color:#1a1a2e;font-size:9.5px;line-height:1.4}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:8px;margin-bottom:14px}
  .header h1{font-size:18px;font-weight:700;color:${REPORT_ACCENT};letter-spacing:-.3px}
  .header .subtitle{font-size:10px;color:#666}.header .date{font-size:10px;color:#888;text-align:right}
  .section{margin-bottom:14px}
  .section-title{font-size:11px;font-weight:700;color:${REPORT_ACCENT};text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
  .summary-row{display:flex;gap:10px;margin-bottom:10px}
  .summary-card{flex:1;background:#f8f9fa;border-radius:6px;padding:8px 12px;text-align:center;border:1px solid #e8e8e8}
  .summary-card .num{font-size:20px;font-weight:700}.summary-card .lbl{font-size:8px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-top:2px}
  .num.green{color:#16a34a}.num.red{color:#dc2626}.num.yellow{color:#ca8a04}.num.gray{color:#666}
  table{width:100%;border-collapse:collapse;font-size:8.5px}
  th{background:${REPORT_ACCENT};color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:4px 6px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
  .badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:7.5px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}
  .badge.routed{background:#dcfce7;color:#166534}.badge.not_routed{background:#fee2e2;color:#991b1b}
  .badge.cancelled{background:#f3f4f6;color:#6b7280}.badge.issue{background:#fef3c7;color:#92400e}
  .badge.ct-pending{background:#e0e7ff;color:#3730a3}.badge.ct-fabricin{background:#fef3c7;color:#92400e}
  .badge.ct-cutting{background:#fed7aa;color:#9a3412}.badge.ct-sewing{background:#d1fae5;color:#065f46}
  .badge.ct-finishing{background:#a7f3d0;color:#064e3b}.badge.ct-complete{background:#bbf7d0;color:#166534}
  .badge.ct-delayed{background:#fee2e2;color:#991b1b}
  .empty-note{padding:12px;text-align:center;color:#999;font-style:italic;font-size:9px}
  .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">Two-Week Operations Report &middot; ${periodLabel}</div></div><div class="date">Generated ${dateStr}</div></div>
<div class="section"><div class="section-title">Shipment Routing Status</div>
  <div class="summary-row">
    <div class="summary-card"><div class="num green">${rs.routed||0}</div><div class="lbl">Routed</div></div>
    <div class="summary-card"><div class="num red">${rs.not_routed||0}</div><div class="lbl">Not Routed</div></div>
    <div class="summary-card"><div class="num yellow">${rs.issue||0}</div><div class="lbl">Issues</div></div>
    <div class="summary-card"><div class="num gray">${rs.cancelled||0}</div><div class="lbl">Cancelled</div></div>
    <div class="summary-card"><div class="num" style="color:${REPORT_ACCENT}">${(rs.routed||0)+(rs.not_routed||0)+(rs.issue||0)+(rs.cancelled||0)}</div><div class="lbl">Total</div></div>
  </div>
  ${routingOrders.length>0?`<table><thead><tr><th>PO</th><th>Store</th><th>WH</th><th>Status</th><th>Ship Start</th><th>Cancel</th></tr></thead><tbody>${routingRows}</tbody></table>`:'<div class="empty-note">No shipments with cancel dates in the next 2 weeks.</div>'}
</div>
<div class="section"><div class="section-title">Cut Tickets — Due Next 2 Weeks</div>
  ${cutTickets.length>0?`<table><thead><tr><th>CT #</th><th>PO</th><th>Status</th><th>Due Date</th></tr></thead><tbody>${ctRows}</tbody></table>`:'<div class="empty-note">No cut tickets with due dates in the next 2 weeks.</div>'}
</div>
<div class="section"><div class="section-title">Vessels &amp; Containers Arriving</div>
  ${shipments.length>0?`<table><thead><tr><th>PO</th><th>Store</th><th>Carrier</th><th>Load ID</th><th>Load Date</th></tr></thead><tbody>${vesselRows}</tbody></table>`:'<div class="empty-note">No vessel/container arrivals with load dates in the next 2 weeks.</div>'}
</div>
<div class="footer">Unlimited Avenues &middot; Operations Report</div>
</body></html>`;
}

/* ─── ATS Report (standalone) ─── */
function generateATSReportHTML(data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ats = data.ats || [];
  const totalATS = ats.reduce((sum, a) => sum + (a.ats_units || 0), 0);

  const atsRows = ats.map(a => `
    <tr>
      <td>${a.style_number||'—'}</td><td>${a.category||'—'}</td><td>${a.color||'—'}</td>
      <td style="text-align:right">${(a.ats_units||0).toLocaleString()}</td>
      <td>${a.warehouse||'—'}</td><td>${a.lot||'—'}</td>
      <td>${a.vendor_inv||'—'}</td><td>${a.ct_number||'—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Unlimited Avenues — ATS Report</title>
<style>
  @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',-apple-system,sans-serif;color:#1a1a2e;font-size:9.5px;line-height:1.4}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:8px;margin-bottom:14px}
  .header h1{font-size:18px;font-weight:700;color:${REPORT_ACCENT};letter-spacing:-.3px}
  .header .subtitle{font-size:10px;color:#666}.header .date{font-size:10px;color:#888;text-align:right}
  .section{margin-bottom:14px}
  .section-title{font-size:11px;font-weight:700;color:${REPORT_ACCENT};text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
  table{width:100%;border-collapse:collapse;font-size:8.5px}
  th{background:${REPORT_ACCENT};color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:4px 6px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
  .empty-note{padding:12px;text-align:center;color:#999;font-style:italic;font-size:9px}
  .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">ATS Inventory Report</div></div><div class="date">Generated ${dateStr} &middot; ${totalATS.toLocaleString()} total units</div></div>
<div class="section"><div class="section-title">Available to Sell (ATS)</div>
  ${ats.length>0?`<table><thead><tr><th>Style #</th><th>Category</th><th>Color</th><th style="text-align:right">Units</th><th>Warehouse</th><th>Lot</th><th>Vendor Inv</th><th>CT</th></tr></thead><tbody>${atsRows}</tbody></table>`:'<div class="empty-note">No ATS inventory data available. Upload ATS data through the ATS Tracker page.</div>'}
</div>
<div class="footer">Unlimited Avenues &middot; ATS Report</div>
</body></html>`;
}

/* ─── Line Sheet Report ─── */
function generateLineSheetHTML(category, data) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Filter styles by category keyword
  const keyword = category.toLowerCase();
  const styles = (data.styles || []).filter(s => {
    const cat = (s.category || '').toLowerCase();
    const desc = (s.style_number || '').toLowerCase();
    return cat.includes(keyword) || desc.includes(keyword);
  });
  // If no category match, show all styles
  const display = styles.length > 0 ? styles : (data.styles || []);

  const rows = display.map(s => `
    <tr>
      <td style="font-weight:600">${s.style_number||'—'}</td>
      <td>${s.category||'—'}</td>
      <td>${s.colors||'—'}</td>
      <td style="text-align:center">${s.color_count||0}</td>
      <td style="text-align:right">${(s.total_ats||0).toLocaleString()}</td>
      <td>${s.origin||'—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Unlimited Avenues — ${category} Line Sheet</title>
<style>
  @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',-apple-system,sans-serif;color:#1a1a2e;font-size:10px;line-height:1.4}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:8px;margin-bottom:16px}
  .header h1{font-size:18px;font-weight:700;color:${REPORT_ACCENT};letter-spacing:-.3px}
  .header .subtitle{font-size:11px;color:#666;margin-top:2px}.header .date{font-size:10px;color:#888;text-align:right}
  .section{margin-bottom:14px}
  .section-title{font-size:11px;font-weight:700;color:${REPORT_ACCENT};text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
  table{width:100%;border-collapse:collapse;font-size:9px}
  th{background:${REPORT_ACCENT};color:#fff;padding:6px 8px;text-align:left;font-weight:600;font-size:8.5px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
  .empty-note{padding:20px;text-align:center;color:#999;font-style:italic;font-size:10px}
  .count{text-align:right;font-size:9px;color:#888;margin-bottom:8px}
  .footer{text-align:center;font-size:8px;color:#aaa;margin-top:14px;padding-top:6px;border-top:1px solid #eee}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">${category} Line Sheet</div></div><div class="date">Generated ${dateStr}</div></div>
<div class="section"><div class="section-title">${category}</div>
  <div class="count">${display.length} style${display.length!==1?'s':''}</div>
  ${display.length>0?`<table><thead><tr><th>Style #</th><th>Category</th><th>Colors</th><th style="text-align:center">Color Count</th><th style="text-align:right">ATS Units</th><th>Origin</th></tr></thead><tbody>${rows}</tbody></table>`:`<div class="empty-note">No styles found for "${category}". Add styles through the Showroom page.</div>`}
</div>
<div class="footer">Unlimited Avenues &middot; ${category} Line Sheet</div>
</body></html>`;
}

/* ─── Shared button style helper (clean & minimal) ─── */
const libBtn = (loading) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  padding: '8px 0', background: 'transparent', border: 'none',
  color: LIB_TEXT, fontSize: 13, fontWeight: 400, cursor: loading ? 'wait' : 'pointer',
  fontFamily: 'inherit', textAlign: 'left', transition: 'color 0.15s',
  letterSpacing: 0.2, opacity: loading ? 0.5 : 1,
});

export default function Home() {
  const [dashData, setDashData] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [allOrders, setAllOrders] = useState([]);
  const [loadingReport, setLoadingReport] = useState(null);
  const [shortcutDetail, setShortcutDetail] = useState(null);
  const [containers, setContainers] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary').catch(() => null),
      api.get('/dashboard/alerts').catch(() => null),
      api.get('/warehouse-orders?scope=shipping&limit=2000').catch(() => null),
      api.get('/containers').catch(() => null),
    ]).then(([sumRes, alertRes, ordersRes, contRes]) => {
      if (sumRes) setDashData(sumRes.data);
      if (alertRes) setAlerts(alertRes.data);
      if (ordersRes) setAllOrders(ordersRes.data?.data || []);
      if (contRes) setContainers(Array.isArray(contRes.data) ? contRes.data : (contRes.data?.data || []));
    });
  }, []);

  // Rolling 2-week window — starts this Monday (forward-looking on Sun)
  // Uses YYYY-MM-DD string comparison to avoid timezone issues
  const toDateStr = (d) => d.toISOString().split('T')[0];
  const weekStart = useMemo(() => {
    const now = new Date(); now.setHours(12, 0, 0, 0);
    const day = now.getDay(); // 0=Sun, 1=Mon
    if (day === 0) {
      now.setDate(now.getDate() + 1); // Sunday → next day Monday
    } else if (day > 1) {
      now.setDate(now.getDate() - (day - 1)); // Tue-Sat → back to Monday
    }
    return now;
  }, []);
  const weekStartStr = useMemo(() => toDateStr(weekStart), [weekStart]);

  const twoWeekOrders = useMemo(() => {
    const cutoff = new Date(weekStart); cutoff.setDate(cutoff.getDate() + 13);
    const cutoffStr = toDateStr(cutoff);
    return allOrders.filter(o => {
      const ds = o.cancel_date ? String(o.cancel_date).split('T')[0] : '';
      if (!ds) return false;
      return ds >= weekStartStr && ds <= cutoffStr;
    });
  }, [allOrders, weekStart, weekStartStr]);

  const unroutedOrders = useMemo(() => twoWeekOrders.filter(o => o.routing_status === 'not_routed'), [twoWeekOrders]);
  const inWarehouseOrders = useMemo(() => twoWeekOrders.filter(o => o.routing_status === 'routed'), [twoWeekOrders]);

  // Containers arriving this week (Mon–Sun)
  const containersThisWeek = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = toDateStr(weekEnd);
    return containers.filter(c => {
      const ds = c.eta ? String(c.eta).split('T')[0] : '';
      if (!ds) return false;
      return ds >= weekStartStr && ds <= weekEndStr;
    });
  }, [containers, weekStart, weekStartStr]);

  // Date range label for routing (moved above handleChat so it can reference it)
  const twoWeekEnd = new Date(weekStart); twoWeekEnd.setDate(twoWeekEnd.getDate() + 13);
  const routingDateRange = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${twoWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Chat handler — supports async API lookups (ATS, styles) alongside local data
  const handleChat = useCallback(async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');

    const lower = userMsg.toLowerCase();
    const totalPOs = twoWeekOrders.length;
    const routedPct = totalPOs > 0 ? Math.round((inWarehouseOrders.length / totalPOs) * 100) : 0;
    let reply = null;

    // ── Scrubs inventory (separate dataset from core ATS) ──
    if (lower.includes('scrub')) {
      try {
        const res = await api.get('/scrubs');
        const d = res.data || {};
        const inv = d.inventory || {};
        const totals = inv.totals || {};
        const grandTotal = totals.grand_total || 0;
        const deal = d.deal || {};
        const bottoms = inv.bottoms || [];
        const tops = inv.tops || [];
        const allStyles = [...bottoms, ...tops];

        if (grandTotal > 0) {
          // Top colors by units
          const colorEntries = Object.entries(totals).filter(([k]) => k !== 'grand_total').sort((a, b) => b[1] - a[1]);
          const topColors = colorEntries.slice(0, 4).map(([c, u]) => `${c}: ${u.toLocaleString()}`).join(', ');
          const styleCount = allStyles.length;
          reply = `Scrubs ATS: ${grandTotal.toLocaleString()} total units across ${styleCount} styles (${bottoms.length} bottoms, ${tops.length} tops). Top colors: ${topColors}.`;
          if (deal.status) reply += ` Deal status: ${deal.status}.`;
        } else {
          reply = 'No scrubs inventory data available. Check the Scrubs Closeout page for details.';
        }
      } catch (err) {
        reply = 'Couldn\'t fetch scrubs data right now. Try the Scrubs Closeout page directly.';
      }
    }
    // ── Core ATS / general inventory queries ──
    else if (lower.includes('ats') || lower.includes('inventory') || lower.includes('available to sell') || lower.includes('caftan') || lower.includes('style') || lower.includes('units')) {
      try {
        const isCaftan = lower.includes('caftan');
        const res = await api.get('/agents/ats');
        const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        // Client-side filter for caftan if needed
        const filtered = isCaftan ? items.filter(i => {
          const s = (i.style || i.style_number || '').toLowerCase();
          const c = (i.category || '').toLowerCase();
          return s.includes('caftan') || s.includes('sk') || c.includes('caftan');
        }) : items;
        const display = filtered.length > 0 ? filtered : items;
        const totalUnits = display.reduce((sum, i) => sum + (i.units || i.adj_units || i.ats_units || 0), 0);
        const label = isCaftan ? 'Caftan' : 'Core';

        if (display.length > 0) {
          const topStyles = display.slice(0, 5).map(i =>
            `${i.style || i.style_number || '?'} — ${(i.units || i.adj_units || i.ats_units || 0).toLocaleString()} units`
          ).join('; ');
          reply = `${label} ATS: ${display.length} SKUs, ${totalUnits.toLocaleString()} total units. Top styles: ${topStyles}.${display.length > 5 ? ` ...and ${display.length - 5} more.` : ''}`;
        } else {
          reply = `No ${label.toLowerCase()} ATS inventory found. You can import data through the ATS Tracker page.`;
        }
      } catch (err) {
        reply = 'Couldn\'t fetch ATS data right now. Try the ATS Inventory report in the Library.';
      }
    }
    // ── Local data responses ──
    else if (lower.includes('routed') || lower.includes('routing') || lower.includes('route')) {
      if (lower.includes('unrouted') || lower.includes('not routed')) {
        reply = unroutedOrders.length > 0
          ? `There are ${unroutedOrders.length} unrouted POs out of ${totalPOs} total (${100 - routedPct}% unrouted) in the next 2 weeks.`
          : 'All POs are routed for the next 2 weeks!';
      } else {
        reply = `${routedPct}% routed — ${inWarehouseOrders.length} of ${totalPOs} POs are routed in the next 2 weeks. ${unroutedOrders.length} remain unrouted.`;
      }
    } else if (lower.includes('po') || lower.includes('order') || lower.includes('shipping')) {
      reply = `There are ${totalPOs} POs in the next 2-week window (${routingDateRange}). ${inWarehouseOrders.length} routed, ${unroutedOrders.length} unrouted.`;
    } else if (lower.includes('container')) {
      reply = containersThisWeek.length > 0
        ? `${containersThisWeek.length} container(s) arriving this week: ${containersThisWeek.map(c => c.container || c.lot || 'N/A').join(', ')}`
        : 'No containers arriving this week.';
    } else if (lower.includes('revenue') || lower.includes('sales') || lower.includes('financial') || lower.includes('money')) {
      reply = 'YTD Revenue is $9.42M (+19.5% Y/Y). Check the Financial section in Snapshots or visit the Finance page for more detail.';
    } else if (lower.includes('profit') || lower.includes('margin') || lower.includes('gp')) {
      reply = 'YTD Gross Profit is ($1.84M) for Q1 2026. Visit the Finance page or P&L Model for the full breakdown.';
    } else if (lower.includes('portfolio') || lower.includes('merrill') || lower.includes('market') || lower.includes('stock')) {
      reply = 'Check the UA | Merrill section in Snapshots for live market value and S&P 500 tracking, or visit the Portfolio page for full details.';
    } else if (lower.includes('report') || lower.includes('briefing')) {
      reply = 'You can generate reports from the Library on the left, or check Monica\'s Daily Briefing for the latest summary.';
    } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      reply = 'Hey Jazzy! What can I help you look into?';
    } else if (lower.includes('%') || lower.includes('percent') || lower.includes('how many')) {
      reply = `Here's a quick snapshot: ${routedPct}% routed (${inWarehouseOrders.length}/${totalPOs} POs), ${unroutedOrders.length} unrouted, ${containersThisWeek.length} containers arriving this week.`;
    }

    if (!reply) {
      reply = "I'm Petal's assistant. Try asking about routing, ATS, scrubs, caftans, POs, containers, revenue, profit, or reports.";
    }
    setChatMessages(prev => [...prev, { role: 'petal', text: reply }]);
  }, [chatInput, unroutedOrders, inWarehouseOrders, twoWeekOrders, containersThisWeek, routingDateRange]);

  const openReport = useCallback((html) => {
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
  }, []);

  const generateTwoWeek = useCallback(async () => {
    setLoadingReport('twoweek');
    try {
      // Try agent two-week-report first (For Larry's Eyes Only data)
      let reportData;
      try {
        const agentRes = await api.get('/agents/two-week-report');
        reportData = agentRes.data;
      } catch { reportData = null; }

      if (reportData && reportData.total_pos > 0) {
        // Build HTML from agent data
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const periodLabel = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${new Date(reportData.window_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        const fmt = (d) => {
          if (!d) return '—';
          const dt = new Date(d);
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          const yy = String(dt.getFullYear()).slice(-2);
          return `${mm}/${dd}/${yy}`;
        };

        const statusColors = { 'In Warehouse': '#B58C3C', 'Routed': '#2D5A3D', 'In Transit': '#4A6FA5', 'In Production': '#8B6B2E' };
        const statusCards = Object.entries(reportData.by_status || {}).map(([s, c]) =>
          `<div class="summary-card"><div class="num" style="color:${statusColors[s] || '#666'}">${c}</div><div class="lbl">${s}</div></div>`
        ).join('');

        // Group items by warehouse
        const byWh = {};
        (reportData.items || []).forEach(po => {
          const wh = po.warehouse || 'Unknown';
          if (!byWh[wh]) byWh[wh] = [];
          byWh[wh].push(po);
        });

        const whSections = Object.entries(byWh).map(([wh, items]) => {
          const rows = items.map(o => `<tr>
            <td>${o.po_number||'—'}</td>
            <td><span class="badge" style="background:${statusColors[o.routing_status]||'#888'};color:#fff">${o.routing_status||'—'}</span></td>
            <td>${o.lot||'—'}</td>
            <td>${fmt(o.ship_window_start)}</td><td>${fmt(o.ship_window_end)}</td>
            <td>${o.routing_id||'—'}</td>
          </tr>`).join('');
          return `<div class="section"><div class="section-title">${wh} Warehouse — ${items.length} POs</div>
            <table><thead><tr><th>PO</th><th>Status</th><th>Lot</th><th>Ship Start</th><th>Cancel</th><th>Routing ID</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`;
        }).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
          <title>Unlimited Avenues — Two-Week Report</title>
          <style>
            @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
            body{font-family:'Segoe UI',-apple-system,sans-serif;color:#1a1a2e;font-size:9.5px;line-height:1.4}
            .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #2A1F1A;padding-bottom:8px;margin-bottom:14px}
            .header h1{font-size:18px;font-weight:700;color:#2A1F1A;letter-spacing:-.3px}
            .header .subtitle{font-size:10px;color:#666}.header .date{font-size:10px;color:#888;text-align:right}
            .section{margin-bottom:14px}
            .section-title{font-size:11px;font-weight:700;color:#2A1F1A;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
            .summary-row{display:flex;gap:10px;margin-bottom:10px}
            .summary-card{flex:1;background:#f8f9fa;border-radius:6px;padding:8px 12px;text-align:center;border:1px solid #e8e8e8}
            .summary-card .num{font-size:20px;font-weight:700}.summary-card .lbl{font-size:8px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-top:2px}
            table{width:100%;border-collapse:collapse;font-size:8.5px}
            th{background:#2A1F1A;color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
            td{padding:4px 6px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
            .badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:7.5px;font-weight:600}
            .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
            @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
          </style></head><body>
          <div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">Two-Week Shipping Report &middot; ${periodLabel}</div></div><div class="date">Generated ${dateStr}</div></div>
          <div class="section"><div class="section-title">Summary</div>
            <div class="summary-row">
              <div class="summary-card"><div class="num" style="color:#2A1F1A">${reportData.total_pos}</div><div class="lbl">Total POs</div></div>
              ${statusCards}
            </div>
          </div>
          ${whSections}
          <div class="footer">Unlimited Avenues &middot; Two-Week Shipping Report</div>
          </body></html>`;

        openReport(html);
      } else {
        // Fall back to warehouse-orders data (mirrors Shipping page)
        try {
          const whRes = await api.get('/api/warehouse-orders?limit=500');
          const warehouseData = Array.isArray(whRes.data?.data) ? whRes.data.data : [];

          // Calculate two-week window (Monday-based) using string comparison
          const now = new Date(); now.setHours(12, 0, 0, 0);
          const day = now.getDay();
          const diff = day === 0 ? 6 : day - 1;
          const monday = new Date(now);
          monday.setDate(monday.getDate() - diff);
          const twoWeekEndD = new Date(monday);
          twoWeekEndD.setDate(twoWeekEndD.getDate() + 13);
          const mondayStr = toDateStr(monday);
          const twoWeekEndStr = toDateStr(twoWeekEndD);

          // Filter to 2-week window (string comparison avoids TZ issues)
          const twoWeekOrders = warehouseData.filter(o => {
            const ds = o.cancel_date ? String(o.cancel_date).split('T')[0] : '';
            if (!ds) return false;
            return ds >= mondayStr && ds <= twoWeekEndStr;
          });

          // Group by warehouse
          const byWarehouse = {};
          twoWeekOrders.forEach(o => {
            const wh = o.warehouse_code || 'Unknown';
            if (!byWarehouse[wh]) byWarehouse[wh] = [];
            byWarehouse[wh].push(o);
          });

          // Build status summary
          const statusSummary = {};
          twoWeekOrders.forEach(o => {
            const status = o.routing_status || 'unknown';
            statusSummary[status] = (statusSummary[status] || 0) + 1;
          });

          // Format helper
          const fmt = (d) => {
            if (!d) return '—';
            const dt = new Date(d);
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            const yy = String(dt.getFullYear()).slice(-2);
            return `${mm}/${dd}/${yy}`;
          };

          const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const periodLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${twoWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

          const statusColors = { 'routed': '#2D5A3D', 'not_routed': '#B58C3C', 'cancelled': '#666', 'issue': '#8B0000' };

          // Build warehouse sections
          const whSections = Object.entries(byWarehouse).map(([wh, items]) => {
            const rows = items.map(o => `<tr>
              <td>${o.po||'—'}</td>
              <td>${o.store_name||'—'}</td>
              <td><span class="badge" style="background:${statusColors[o.routing_status]||'#888'};color:#fff">${(o.routing_status||'').replace('_',' ')}</span></td>
              <td>${fmt(o.start_date)}</td>
              <td>${fmt(o.cancel_date)}</td>
              <td>${o.routing||'—'}</td>
            </tr>`).join('');
            return `<div class="section"><div class="section-title">${wh} Warehouse — ${items.length} POs</div>
              <table><thead><tr><th>PO</th><th>Store</th><th>Status</th><th>Start Date</th><th>Cancel Date</th><th>Routing</th></tr></thead>
              <tbody>${rows}</tbody></table></div>`;
          }).join('');

          const statusCards = Object.entries(statusSummary).map(([s, c]) =>
            `<div class="summary-card"><div class="num" style="color:${statusColors[s] || '#666'}">${c}</div><div class="lbl">${s.replace('_',' ')}</div></div>`
          ).join('');

          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <title>Unlimited Avenues — Two-Week Report</title>
            <style>
              @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
              body{font-family:'Segoe UI',-apple-system,sans-serif;color:#1a1a2e;font-size:9.5px;line-height:1.4}
              .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #2A1F1A;padding-bottom:8px;margin-bottom:14px}
              .header h1{font-size:18px;font-weight:700;color:#2A1F1A;letter-spacing:-.3px}
              .header .subtitle{font-size:10px;color:#666}.header .date{font-size:10px;color:#888;text-align:right}
              .section{margin-bottom:14px}
              .section-title{font-size:11px;font-weight:700;color:#2A1F1A;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
              .summary-row{display:flex;gap:10px;margin-bottom:10px}
              .summary-card{flex:1;background:#f8f9fa;border-radius:6px;padding:8px 12px;text-align:center;border:1px solid #e8e8e8}
              .summary-card .num{font-size:20px;font-weight:700}.summary-card .lbl{font-size:8px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-top:2px}
              table{width:100%;border-collapse:collapse;font-size:8.5px}
              th{background:#2A1F1A;color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
              td{padding:4px 6px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
              .badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:7.5px;font-weight:600;color:#fff}
              .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
              @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
            </style></head><body>
            <div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">Two-Week Shipping Report &middot; ${periodLabel}</div></div><div class="date">Generated ${dateStr}</div></div>
            <div class="section"><div class="section-title">Summary</div>
              <div class="summary-row">
                <div class="summary-card"><div class="num" style="color:#2A1F1A">${twoWeekOrders.length}</div><div class="lbl">Total POs</div></div>
                ${statusCards}
              </div>
            </div>
            ${whSections}
            <div class="footer">Unlimited Avenues &middot; Two-Week Shipping Report</div>
            </body></html>`;

          openReport(html);
        } catch (err) {
          // Fall back to original dashboard report
          const res = await api.get('/dashboard/report');
          openReport(generateReportHTML(res.data));
        }
      }
    } catch (err) {
      console.error('Report error:', err);
      console.error('Failed to generate two-week report.');
    }
    setLoadingReport(null);
  }, [openReport]);

  const generateATS = useCallback(async () => {
    setLoadingReport('ats');
    try {
      const res = await api.get('/dashboard/report');
      openReport(generateATSReportHTML(res.data));
    } catch (err) {
      console.error('ATS report error:', err);
      console.error('Failed to generate ATS report.');
    }
    setLoadingReport(null);
  }, [openReport]);

  const loadHtml2Pdf = useCallback(() => {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = () => resolve(window.html2pdf);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }, []);

  const generateATSPDF = useCallback(async (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    setLoadingReport('ats-pdf');
    // Open window synchronously (before await) so popup blocker won't block it
    const win = window.open('', '_blank');
    try {
      const res = await api.get('/dashboard/report');
      const html = generateATSReportHTML(res.data);
      if (win) {
        win.document.write(html);
        win.document.close();
        // Auto-trigger print dialog after a short delay
        setTimeout(() => { try { win.print(); } catch(ex) {} }, 800);
      }
    } catch (err) {
      console.error('ATS PDF error:', err);
      if (win) win.close();
    }
    setLoadingReport(null);
  }, []);

  const generateTrendScoutPDF = useCallback(async () => {
    setLoadingReport('trend-pdf');
    try {
      const res = await api.get('/agents/jazzy/report/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Trend_Scout_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Trend Scout PDF error:', err);
    }
    setLoadingReport(null);
  }, []);

  const generateLarryPDF = useCallback(async () => {
    setLoadingReport('larry-pdf');
    try {
      const res = await api.get('/agents/larry/report/pdf', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Logistics_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Larry PDF error, falling back to HTML:', err);
      try {
        const res = await api.get('/agents/larry/report/html');
        const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Logistics_Report_${new Date().toISOString().slice(0, 10)}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (htmlErr) {
        console.error('HTML fallback also failed:', htmlErr);
      }
    }
    setLoadingReport(null);
  }, []);

  const loadXLSX = useCallback(() => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }, []);

  const loadExcelJS = useCallback(() => {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.onload = () => resolve(window.ExcelJS);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }, []);

  /* Image map for caftan styles */
  const caftanImageMap = {
    'SKO/18740/25': '/images/caftan_SKO-18740-25.png',
    'SKO/18759/25': '/images/caftan_SKO-18759-25.png',
    'SK 69': '/images/caftan_SK-69.png',
    'SKO-040': '/images/caftan_SKO-040.png',
    'SKO-042': '/images/caftan_SKO-042.png',
    'SK 49': '/images/caftan_SK-49.png',
    'SK 89': '/images/caftan_SK-89.png',
    'SKO/18796/25': '/images/caftan_SKO-18796-25.png',
    'SKO/18798/25': '/images/caftan_SKO-18798-25.png',
    'SKO/18709/25': '/images/caftan_SKO-18709-25.png',
  };

  const toBase64 = async (url) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      const resp = await fetch(fullUrl);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
        reader.onerror = () => resolve(null);
      });
    } catch { return null; }
  };

  const generateLineSheet = useCallback(async (category) => {
    const key = 'ls-' + category;
    setLoadingReport(key);
    try {
      const ExcelJS = await loadExcelJS();
      const res = await api.get('/styles', { params: { limit: 500 } }).catch(() => ({ data: { data: [] } }));
      const allStyles = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const keyword = category.toLowerCase();
      const filtered = allStyles.filter(s => {
        const cat = (s.category || '').toLowerCase();
        const sn = (s.style_number || '').toLowerCase();
        return cat.includes(keyword) || sn.includes(keyword);
      });
      const display = filtered.length > 0 ? filtered : allStyles;

      /* Convert all images to base64 */
      const imagePromises = display.map(async (s) => {
        const imgUrl = s.image_url || caftanImageMap[s.style_number];
        if (!imgUrl) return null;
        return toBase64(imgUrl);
      });
      const images = await Promise.all(imagePromises);

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      /* Build real .xlsx with ExcelJS — images properly embedded */
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Unlimited Avenues';
      const ws = wb.addWorksheet(category, { properties: { defaultRowHeight: 18 } });

      /* Header rows */
      ws.mergeCells('A1:F1');
      const titleCell = ws.getCell('A1');
      titleCell.value = `UNLIMITED AVENUES`;
      titleCell.font = { size: 9, color: { argb: 'FF888888' }, bold: true };
      titleCell.alignment = { horizontal: 'left' };

      ws.mergeCells('A2:F2');
      const catCell = ws.getCell('A2');
      catCell.value = category;
      catCell.font = { size: 18, color: { argb: 'FF1B3221' }, bold: true };
      catCell.alignment = { horizontal: 'left' };

      ws.mergeCells('A3:F3');
      const dateCell = ws.getCell('A3');
      dateCell.value = `${dateStr}  ·  ${display.length} styles`;
      dateCell.font = { size: 9, color: { argb: 'FFAAAAAA' } };

      /* Divider row */
      ws.getRow(4).height = 6;

      /* 3-column grid layout: each style gets Image row + Info row */
      const COLS = 3;
      const IMG_HEIGHT = 180;
      const IMG_WIDTH = 140;
      const colWidths = [26, 26, 26];
      colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      let currentRow = 5;

      for (let i = 0; i < display.length; i += COLS) {
        /* Image row — tall */
        const imgRowNum = currentRow;
        const imgRow = ws.getRow(imgRowNum);
        imgRow.height = IMG_HEIGHT * 0.75;

        for (let c = 0; c < COLS; c++) {
          const idx = i + c;
          if (idx >= display.length) continue;

          const b64 = images[idx];
          if (b64) {
            /* Strip data URI prefix to get raw base64 */
            const raw = b64.replace(/^data:image\/\w+;base64,/, '');
            const ext = b64.includes('image/png') ? 'png' : 'jpeg';
            const imageId = wb.addImage({ base64: raw, extension: ext });
            ws.addImage(imageId, {
              tl: { col: c, row: imgRowNum - 1 },
              ext: { width: IMG_WIDTH, height: IMG_HEIGHT },
            });
          } else {
            const cell = ws.getCell(imgRowNum, c + 1);
            cell.value = 'No Image';
            cell.font = { size: 9, color: { argb: 'FFAAAAAA' }, italic: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F0E8' } };
          }
        }

        /* Info row — Style #, Color, Price */
        currentRow++;
        const infoRowNum = currentRow;
        for (let c = 0; c < COLS; c++) {
          const idx = i + c;
          if (idx >= display.length) continue;
          const s = display[idx];
          const cell = ws.getCell(infoRowNum, c + 1);
          cell.value = { richText: [
            { text: `Style #${s.style_number || '—'}`, font: { bold: true, size: 10, color: { argb: 'FF1B3221' } } },
            { text: `\n${s.colors || '—'}`, font: { size: 9, color: { argb: 'FF555555' } } },
            { text: `\nPrice: TBD`, font: { size: 9, color: { argb: 'FF888888' } } },
          ]};
          cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
        }
        ws.getRow(infoRowNum).height = 42;

        /* Spacer row */
        currentRow++;
        ws.getRow(currentRow).height = 10;
        currentRow++;
      }

      /* Export */
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category.replace(/\s+/g, '_')}_Line_Sheet.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Line sheet error:', err);
      console.error(`Failed to generate ${category} line sheet.`);
    }
    setLoadingReport(null);
  }, [loadExcelJS]);

  // This week label for containers
  const weekEndDate = new Date(weekStart); weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div className="fade-in" style={{ display: 'flex', gap: 0, minHeight: '100%' }}>

      {/* ── LEFT: Library Panel ── */}
      <div style={{
        width: 220, flexShrink: 0, padding: '60px 0 40px 0',
      }}>
        <div style={{
          background: LIB_BG, borderRadius: 14, padding: '24px 20px 20px',
        }}>
          {/* Library label */}
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: LIB_TEXT, letterSpacing: 0.5 }}>Library</span>
          </div>

          {/* Reports sub-section */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 500, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Reports</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={generateLarryPDF}
                disabled={loadingReport === 'larry-pdf'}
                style={libBtn(loadingReport === 'larry-pdf')}
                onMouseEnter={e => { if (loadingReport !== 'larry-pdf') e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.color = LIB_TEXT; }}
              >
                <span>{loadingReport === 'larry-pdf' ? 'Generating…' : 'Logistics Report'}</span>
                <span style={{ fontSize: 11, opacity: 0.4 }}>{'\u2193'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); generateATSPDF(e); }}
                disabled={loadingReport === 'ats-pdf'}
                style={libBtn(loadingReport === 'ats-pdf')}
                onMouseEnter={e => { if (loadingReport !== 'ats-pdf') e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.color = LIB_TEXT; }}
              >
                <span>{loadingReport === 'ats-pdf' ? 'Generating…' : 'ATS Inventory'}</span>
                <span style={{ fontSize: 11, opacity: 0.4 }}>{'\u2193'}</span>
              </button>
            </div>
          </div>

          {/* Line Sheets sub-section */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 500, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Line Sheets</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { label: 'Scrubs', category: 'Scrubs' },
                { label: 'Caftan', category: 'Caftan' },
              ].map(ls => (
                <button
                  key={ls.label}
                  onClick={() => generateLineSheet(ls.category)}
                  disabled={loadingReport === 'ls-' + ls.category}
                  style={libBtn(loadingReport === 'ls-' + ls.category)}
                  onMouseEnter={e => { if (loadingReport !== 'ls-' + ls.category) e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = LIB_TEXT; }}
                >
                  <span>{loadingReport === 'ls-' + ls.category ? 'Generating…' : ls.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.4 }}>{'\u2193'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Monica Briefing shortcut ── */}
        <div style={{ marginTop: 16 }}>
          <Link to="/internal/monica" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10, textDecoration: 'none',
            background: 'linear-gradient(135deg, #2D4A5A 0%, #4a7a8f 100%)',
            border: '1px solid rgba(45,74,90,0.3)',
            transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(45,74,90,0.15)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(45,74,90,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(45,74,90,0.15)'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff',
            }}>M</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Monica</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Daily Briefing</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>→</span>
          </Link>
        </div>

        {/* ── Woodcock / Trend Scout Briefing shortcut (sage green) ── */}
        <div style={{ marginTop: 8 }}>
          <Link to="/showroom/jazzy" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10, textDecoration: 'none',
            background: 'linear-gradient(135deg, #5F7A5E 0%, #7A9E79 100%)',
            border: '1px solid rgba(95,122,94,0.3)',
            transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(95,122,94,0.15)',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(95,122,94,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(95,122,94,0.15)'; }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff',
            }}>W</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Woodcock</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>Trend Scout</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>→</span>
          </Link>
        </div>
      </div>

      {/* ── CENTER: Petal + Chat ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Hero */}
        <div style={{ padding: '60px 0 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: 52, fontWeight: 300, letterSpacing: -1.5, lineHeight: 1.15, color: 'var(--text)', marginBottom: 24 }}>
            <strong style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>Petal</strong>
          </h1>
          <div style={{ opacity: 0.8 }}>
            <NeedleLogo size={120} color="var(--accent)" />
          </div>
        </div>

        {/* Chat */}
        <div style={{ width: '100%', maxWidth: 520, padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Chat messages */}
          <div style={{
            flex: 1, minHeight: 120, maxHeight: 340, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0',
          }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', fontStyle: 'italic' }}>
                Ask me about POs, containers, reports, or anything in the dashboard.
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'var(--accent-dark)' : 'var(--surface)',
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: 13, lineHeight: 1.5,
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
              }}>
                {msg.text}
              </div>
            ))}
          </div>

          {/* Chat input */}
          <form onSubmit={handleChat} style={{
            display: 'flex', gap: 8, padding: '12px 0 40px',
          }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask Petal..."
              className="input"
              style={{ flex: 1, padding: '12px 16px', borderRadius: 12, fontSize: 13 }}
            />
            <button type="submit" className="btn btn-primary" style={{
              padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            }}>
              Send
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT: Shortcuts Panel ── */}
      <div style={{ width: 240, flexShrink: 0, padding: '60px 0 40px 0' }}>
        <div style={{ background: LIB_BG, borderRadius: 14, padding: '24px 20px 20px' }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: LIB_TEXT, letterSpacing: 0.5 }}>Snapshot</span>
          </div>

          {/* ── Routing Status ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Routing Status <span style={{ fontWeight: 400, fontSize: 9, letterSpacing: 0 }}>[{routingDateRange}]</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {/* Routed % */}
              <button
                onClick={() => setShortcutDetail(shortcutDetail === 'inwarehouse' ? null : 'inwarehouse')}
                style={{ flex: 1, background: 'rgba(164,120,100,0.25)', borderRadius: 10, padding: '14px 12px', border: 'none', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(164,120,100,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(164,120,100,0.25)'}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80', lineHeight: 1.1 }}>
                  {twoWeekOrders.length > 0 ? Math.round((inWarehouseOrders.length / twoWeekOrders.length) * 100) : 0}%
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Routed</div>
                <div style={{ fontSize: 10, color: LIB_DIM, marginTop: 2 }}>{inWarehouseOrders.length} / {twoWeekOrders.length}</div>
              </button>
              {/* Unrouted */}
              <button
                onClick={() => setShortcutDetail(shortcutDetail === 'unrouted' ? null : 'unrouted')}
                style={{ flex: 1, background: 'rgba(164,120,100,0.25)', borderRadius: 10, padding: '14px 12px', border: 'none', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(164,120,100,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(164,120,100,0.25)'}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: unroutedOrders.length > 0 ? '#f87171' : '#4ade80', lineHeight: 1.1 }}>
                  {unroutedOrders.length}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}># Unrouted</div>
              </button>
            </div>
            {shortcutDetail === 'unrouted' && (
              <div style={{ background: 'rgba(250,246,240,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 11, color: LIB_TEXT, lineHeight: 1.6 }}>
                {unroutedOrders.length > 0 ? (
                  unroutedOrders.slice(0, 8).map((o, i) => (
                    <div key={i} style={{ borderBottom: i < Math.min(unroutedOrders.length, 8) - 1 ? `1px solid ${LIB_BORDER}` : 'none', paddingBottom: 4, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>PO {o.po}</span> — {o.store_name || 'N/A'}
                      <br /><span style={{ color: LIB_DIM, fontSize: 10 }}>Style {o.style || o.style_number || '?'} · cancel {o.cancel_date?.split('T')[0]} · {o.warehouse_code || '?'}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: LIB_DIM, fontStyle: 'italic' }}>All clear — no unrouted orders</span>
                )}
                {unroutedOrders.length > 8 && (
                  <div style={{ color: LIB_DIM, fontSize: 10, marginTop: 4 }}>...and {unroutedOrders.length - 8} more</div>
                )}
              </div>
            )}
            {shortcutDetail === 'inwarehouse' && (
              <div style={{ background: 'rgba(250,246,240,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 11, color: LIB_TEXT, lineHeight: 1.6 }}>
                {inWarehouseOrders.length > 0 ? (
                  inWarehouseOrders.slice(0, 8).map((o, i) => (
                    <div key={i} style={{ borderBottom: i < Math.min(inWarehouseOrders.length, 8) - 1 ? `1px solid ${LIB_BORDER}` : 'none', paddingBottom: 4, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>PO {o.po}</span> — {o.store_name || 'N/A'}
                      <br /><span style={{ color: LIB_DIM, fontSize: 10 }}>Style {o.style || o.style_number || '?'} · cancel {o.cancel_date?.split('T')[0]} · {o.warehouse_code || '?'} · {(o.units || 0).toLocaleString()} units</span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: LIB_DIM, fontStyle: 'italic' }}>No POs currently in warehouse</span>
                )}
                {inWarehouseOrders.length > 8 && (
                  <div style={{ color: LIB_DIM, fontSize: 10, marginTop: 4 }}>...and {inWarehouseOrders.length - 8} more</div>
                )}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: LIB_BORDER, margin: '0 0 16px 0' }}></div>

          {/* ── Containers This Week ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Containers This Week</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => setShortcutDetail(shortcutDetail === 'containers' ? null : 'containers')}
                style={{ flex: 1, background: 'rgba(164,120,100,0.25)', borderRadius: 10, padding: '14px 12px', border: 'none', cursor: 'pointer', transition: 'background 0.15s', textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(164,120,100,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(164,120,100,0.25)'}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: containersThisWeek.length > 0 ? '#d4a0a0' : LIB_DIM, lineHeight: 1.1 }}>
                  {containersThisWeek.length}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Arriving</div>
              </button>
            </div>
            {shortcutDetail === 'containers' && (
              <div style={{ background: 'rgba(250,246,240,0.08)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 11, color: LIB_TEXT, lineHeight: 1.6 }}>
                {containersThisWeek.length > 0 ? (
                  containersThisWeek.slice(0, 8).map((c, i) => (
                    <div key={i} style={{ borderBottom: i < Math.min(containersThisWeek.length, 8) - 1 ? `1px solid ${LIB_BORDER}` : 'none', paddingBottom: 4, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.container || c.lot || 'N/A'}</span>
                      <br /><span style={{ color: LIB_DIM, fontSize: 10 }}>
                        {c.folder || '—'} · ETA {c.eta?.split('T')[0] || '—'}{c.method ? ` · ${c.method}` : ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <span style={{ color: LIB_DIM, fontStyle: 'italic' }}>No containers arriving this week</span>
                )}
                {containersThisWeek.length > 8 && (
                  <div style={{ color: LIB_DIM, fontSize: 10, marginTop: 4 }}>...and {containersThisWeek.length - 8} more</div>
                )}
              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: LIB_BORDER, margin: '0 0 16px 0' }}></div>

          {/* ── Financial [YTD Thru March '26] ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>
              Financial <span style={{ fontWeight: 400, fontSize: 9, letterSpacing: 0 }}>[YTD Thru March '26]</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/model" style={{ flex: 1, textDecoration: 'none', background: 'rgba(164,120,100,0.25)', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', transition: 'background 0.15s', display: 'block', textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(164,120,100,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(164,120,100,0.25)'}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Revenue</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: LIB_TEXT, lineHeight: 1.1 }}>$9.42M</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: '#16a34a', marginTop: 3 }}>+19.5% Y/Y</div>
              </Link>
              <Link to="/model" style={{ flex: 1, textDecoration: 'none', background: 'rgba(164,120,100,0.25)', borderRadius: 10, padding: '14px 12px', cursor: 'pointer', transition: 'background 0.15s', display: 'block', textAlign: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(164,120,100,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(164,120,100,0.25)'}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Gross Profit</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', lineHeight: 1.1 }}>($1.84M)</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--lib-dim)', marginTop: 3 }}>Q1 2026</div>
              </Link>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ height: 1, background: LIB_BORDER, margin: '0 0 16px 0' }}></div>

          {/* ── UA | Merrill ── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: LIB_DIM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>UA | Merrill</div>
            <PortfolioSummaryWidget dark />
          </div>

        </div>
      </div>

    </div>
  );
}
