import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

/* ─── palette ─── */
const TXT    = 'var(--text)';
const DIM    = 'var(--text-muted)';
const BG     = 'var(--surface)';
const BORDER = 'var(--border)';
const PINK   = '#d4748a';
const BLUE   = '#2D4A5A';
const R      = 12;

const STORAGE_KEY = 'ua_weekly_archive';

function loadArchive() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveArchive(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/* ─── date helpers ─── */
const toDateStr = (d) => d.toISOString().split('T')[0];
const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
};

/* ─── report HTML builder ─── */
function buildReportHTML({ periodLabel, dateStr, unrouted, routed, other, total }) {
  const statusColors = { 'routed': '#2D5A3D', 'not_routed': '#B58C3C', 'Routed': '#2D5A3D', 'Not Routed': '#B58C3C', 'In Warehouse': '#B58C3C' };
  const makeRows = (items) => items.map(o => {
    const po = o.po_number || o.po || '—';
    const store = o.store_name || o.warehouse || '—';
    const wh = o.warehouse_code || o.warehouse || '—';
    const status = o.routing_status || '—';
    const start = fmt(o.ship_window_start || o.start_date);
    const cancel = fmt(o.ship_window_end || o.cancel_date);
    return `<tr><td>${po}</td><td>${store}</td><td>${wh}</td><td><span class="badge" style="background:${statusColors[status]||'#888'};color:#fff">${status.replace('_',' ')}</span></td><td>${start}</td><td>${cancel}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Unlimited Avenues — Logistics Report</title>
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
    <div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">Two-Week Logistics Report &middot; ${periodLabel}</div></div><div class="date">Generated ${dateStr}</div></div>
    <div class="section"><div class="section-title">Summary</div>
      <div class="summary-row">
        <div class="summary-card"><div class="num" style="color:#B58C3C">${unrouted.length}</div><div class="lbl">Unrouted</div></div>
        <div class="summary-card"><div class="num" style="color:#2D5A3D">${routed.length}</div><div class="lbl">Routed</div></div>
        <div class="summary-card"><div class="num" style="color:#2A1F1A">${total}</div><div class="lbl">Total POs</div></div>
      </div>
    </div>
    <div class="section"><div class="section-title">Unrouted POs (${unrouted.length})</div>
      ${unrouted.length>0?`<table><thead><tr><th>PO</th><th>Store</th><th>WH</th><th>Status</th><th>Start</th><th>Cancel</th></tr></thead><tbody>${makeRows(unrouted)}</tbody></table>`:'<div style="padding:8px;text-align:center;color:#999;font-style:italic">All POs are routed!</div>'}
    </div>
    <div class="section"><div class="section-title">Routed POs (${routed.length})</div>
      ${routed.length>0?`<table><thead><tr><th>PO</th><th>Store</th><th>WH</th><th>Status</th><th>Start</th><th>Cancel</th></tr></thead><tbody>${makeRows(routed)}</tbody></table>`:'<div style="padding:8px;text-align:center;color:#999;font-style:italic">No routed POs in window.</div>'}
    </div>
    ${other.length>0?`<div class="section"><div class="section-title">Other (${other.length})</div><table><thead><tr><th>PO</th><th>Store</th><th>WH</th><th>Status</th><th>Start</th><th>Cancel</th></tr></thead><tbody>${makeRows(other)}</tbody></table></div>`:''}
    <div class="footer">Unlimited Avenues &middot; Logistics Report</div>
    </body></html>`;
}

/* ═══ MAIN COMPONENT ═══ */
export default function Weekly() {
  const [archive, setArchive] = useState(loadArchive);
  const [generating, setGenerating] = useState(false);

  const openReport = useCallback((html) => {
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
  }, []);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      /* Try agent two-week-report first */
      let reportData = null;
      try {
        const agentRes = await api.get('/agents/two-week-report');
        reportData = agentRes.data;
      } catch { /* fall through */ }

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now); monday.setDate(monday.getDate() - diff); monday.setHours(12,0,0,0);
      const twoWeekEnd = new Date(monday); twoWeekEnd.setDate(twoWeekEnd.getDate() + 13);
      const periodLabel = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${twoWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      let unrouted, routed, other, total;

      if (reportData && reportData.total_pos > 0) {
        const items = reportData.items || [];
        unrouted = items.filter(o => (o.routing_status||'').toLowerCase().includes('not') || (o.routing_status||'').toLowerCase().includes('warehouse'));
        routed = items.filter(o => (o.routing_status||'').toLowerCase() === 'routed');
        other = items.filter(o => !unrouted.includes(o) && !routed.includes(o));
        total = reportData.total_pos;
      } else {
        /* Fallback: warehouse-orders */
        const whRes = await api.get('/api/warehouse-orders?limit=500');
        const warehouseData = Array.isArray(whRes.data?.data) ? whRes.data.data : [];
        const mondayStr = toDateStr(monday);
        const twoWeekEndStr = toDateStr(twoWeekEnd);
        const twoWeekOrders = warehouseData.filter(o => {
          const ds = o.cancel_date ? String(o.cancel_date).split('T')[0] : '';
          return ds >= mondayStr && ds <= twoWeekEndStr;
        });
        unrouted = twoWeekOrders.filter(o => o.routing_status === 'not_routed');
        routed = twoWeekOrders.filter(o => o.routing_status === 'routed');
        other = twoWeekOrders.filter(o => o.routing_status !== 'not_routed' && o.routing_status !== 'routed');
        total = twoWeekOrders.length;
      }

      const html = buildReportHTML({ periodLabel, dateStr, unrouted, routed, other, total });
      openReport(html);

      /* Archive the entry */
      const entry = {
        id: Date.now(),
        date: dateStr,
        period: periodLabel,
        unrouted: unrouted.length,
        routed: routed.length,
        total,
      };
      const updated = [entry, ...archive].slice(0, 52); // Keep ~1 year of weeklies
      setArchive(updated);
      saveArchive(updated);
    } catch (err) {
      console.error('Weekly report error:', err);
    }
    setGenerating(false);
  }, [archive, openReport]);

  const removeEntry = (id) => {
    const updated = archive.filter(e => e.id !== id);
    setArchive(updated);
    saveArchive(updated);
  };

  return (
    <div className="fade-in">
      <PageHeader title="Weekly" subtitle="LOGISTICS REPORTS" />

      {/* ── Generate Button ── */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={generate}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 24px', borderRadius: 10, border: 'none',
            background: generating ? 'var(--border)' : `linear-gradient(135deg, ${PINK} 0%, #c46080 100%)`,
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
            transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(212,116,138,0.25)',
          }}
          onMouseEnter={e => { if (!generating) e.currentTarget.style.boxShadow = '0 6px 16px rgba(212,116,138,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(212,116,138,0.25)'; }}
        >
          <span style={{ fontSize: 18 }}>+</span>
          {generating ? 'Generating...' : 'Generate Weekly Report'}
        </button>
      </div>

      {/* ── Archive List ── */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          Report Archive
        </div>

        {archive.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: DIM, fontSize: 12 }}>
            No reports yet — generate your first weekly above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {archive.map(entry => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                border: `1px solid ${BORDER}`, borderRadius: 8,
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2, rgba(0,0,0,0.02))'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                {/* Pink calendar icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `linear-gradient(135deg, ${PINK} 0%, #c46080 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TXT }}>{entry.period}</div>
                  <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Generated {entry.date}</div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#B58C3C' }}>{entry.unrouted}</div>
                    <div style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.5 }}>Unrouted</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5A3D' }}>{entry.routed}</div>
                    <div style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.5 }}>Routed</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: BLUE }}>{entry.total}</div>
                    <div style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</div>
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeEntry(entry.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: DIM, opacity: 0.4, lineHeight: 1, padding: '4px 6px' }}
                  title="Remove from archive"
                >&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
