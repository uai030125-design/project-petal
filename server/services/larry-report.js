// Larry Nightly Report Service
// Mirrors the Routing page — 2-week window, same columns & status logic
const db = require('../db');

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
}

async function generateReport() {
  const now = new Date();

  // Exact same query as the routing page (scope=shipping, 2-week window)
  const result = await db.query(`
    SELECT
      pt.id,
      pt.po_number AS po,
      pt.cut_ticket AS ticket_number,
      pt.buyer AS store_name,
      pt.ship_window_start AS start_date,
      pt.ship_window_end AS cancel_date,
      pt.warehouse AS warehouse_code,
      pt.routing_id AS routing,
      CASE
        WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'shipped'
        WHEN LOWER(pt.routing_status) = 'cancelled' THEN 'cancelled'
        WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN 'not_routed'
        WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'routed'
        WHEN LOWER(pt.routing_status) = 'routed' THEN 'routed'
        ELSE 'not_routed'
      END AS routing_status,
      CASE
        WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'Shipped'
        WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN NULL
        WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' AND pt.carrier IS NOT NULL AND pt.carrier != '' THEN 'In Transit'
        WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'Routed'
        WHEN LOWER(pt.routing_status) = 'routed' THEN 'Routed'
        ELSE NULL
      END AS lifecycle
    FROM po_tracking pt
    WHERE pt.ship_window_end >= CURRENT_DATE
      AND pt.ship_window_end <= CURRENT_DATE + INTERVAL '14 days'
      AND LOWER(COALESCE(pt.routing_status,'')) NOT IN ('shipped','cancelled')
      AND pt.date_shipped IS NULL
      AND (pt.buyer NOT ILIKE '%disregard%' OR pt.buyer IS NULL)
    ORDER BY pt.ship_window_end ASC, pt.po_number ASC
  `);

  const orders = result.rows;

  // Compute stats — exactly like the routing page
  const total = orders.length;
  const routed = orders.filter(o => o.routing_status === 'routed').length;
  const shipped = orders.filter(o => o.routing_status === 'shipped').length;
  const notRouted = orders.filter(o => o.routing_status === 'not_routed').length;

  // Past-due: unrouted with cancel date before today
  const pastDueResult = await db.query(`
    SELECT
      pt.po_number AS po, pt.cut_ticket AS ticket_number, pt.buyer AS store_name,
      pt.ship_window_start AS start_date, pt.ship_window_end AS cancel_date,
      pt.warehouse AS warehouse_code, pt.routing_id AS routing
    FROM po_tracking pt
    WHERE (pt.routing_id IS NULL OR pt.routing_id = '' OR LOWER(pt.routing_id) LIKE '%unable%')
      AND LOWER(COALESCE(pt.routing_status,'')) NOT IN ('shipped','cancelled','routed')
      AND pt.date_shipped IS NULL
      AND pt.ship_window_end < CURRENT_DATE
      AND pt.ship_window_end >= CURRENT_DATE - INTERVAL '30 days'
      AND (pt.buyer NOT ILIKE '%disregard%' OR pt.buyer IS NULL)
    ORDER BY pt.ship_window_end ASC
  `);
  const pastDue = pastDueResult.rows.length;

  // Warehouse breakdown
  const warehouses = {};
  orders.forEach(o => {
    const wh = o.warehouse_code || 'OTHER';
    if (!warehouses[wh]) warehouses[wh] = { total: 0, routed: 0, shipped: 0, not_routed: 0 };
    warehouses[wh].total++;
    warehouses[wh][o.routing_status] = (warehouses[wh][o.routing_status] || 0) + 1;
  });

  // Date range
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  return {
    generated_at: now.toISOString(),
    date_range: { start: startDate, end: endDate },
    stats: { total, routed, shipped, not_routed: notRouted, past_due: pastDue },
    warehouses,
    orders,
    past_due_orders: pastDueResult.rows
  };
}

function buildEmailHtml(data) {
  const date = new Date(data.generated_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const rangeStart = new Date(data.date_range.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  const rangeEnd = new Date(data.date_range.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  // Theme — matches Project Petal routing page
  const bg = '#FAF6F0';
  const surface = '#FFFFFF';
  const surface2 = '#F3EDE5';
  const border = '#E0D8CE';
  const text = '#2A2420';
  const textDim = '#6B5A4E';
  const textMuted = '#9A8B7E';
  const accent = '#3D2E24';
  const success = '#16a34a';
  const warn = '#C4873B';
  const danger = '#B5443B';

  const s = data.stats;

  // ── Stat card ──
  function statCard(value, label, color) {
    return `<td style="text-align:center;padding:10px 6px;border:1px solid ${border};background:${surface};">
      <div style="font-size:18px;font-weight:700;color:${color};line-height:1;">${value}</div>
      <div style="font-size:7px;font-weight:600;color:${textMuted};text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">${label}</div>
    </td>`;
  }

  // ── Warehouse card ──
  function warehouseCard(name, wh) {
    const pct = wh.total > 0 ? Math.round(((wh.routed + wh.shipped) / wh.total) * 100) : 0;
    return `<td style="vertical-align:top;padding:0 4px;width:50%;">
      <div style="border:1px solid ${border};border-radius:8px;padding:10px 12px;background:${surface};">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:10px;font-weight:700;color:${text};">${name}</span>
          <span style="font-size:8px;color:${textMuted};">${wh.total} orders</span>
        </div>
        <div style="height:4px;background:${surface2};border-radius:2px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${success},#4ade80);border-radius:2px;"></div>
        </div>
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="text-align:center;padding:4px;background:${surface2};border-radius:6px;">
            <div style="font-size:14px;font-weight:700;color:${success};">${wh.routed || 0}</div>
            <div style="font-size:7px;font-weight:600;color:${textMuted};text-transform:uppercase;">Routed</div>
          </td>
          <td style="width:6px;"></td>
          <td style="text-align:center;padding:4px;background:${surface2};border-radius:6px;">
            <div style="font-size:14px;font-weight:700;color:${success};">${wh.shipped || 0}</div>
            <div style="font-size:7px;font-weight:600;color:${textMuted};text-transform:uppercase;">Shipped</div>
          </td>
          <td style="width:6px;"></td>
          <td style="text-align:center;padding:4px;background:${surface2};border-radius:6px;">
            <div style="font-size:14px;font-weight:700;color:${warn};">${wh.not_routed || 0}</div>
            <div style="font-size:7px;font-weight:600;color:${textMuted};text-transform:uppercase;">Not Routed</div>
          </td>
        </tr></table>
      </div>
    </td>`;
  }

  // ── Status badge ──
  function badge(status) {
    const map = {
      routed: { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', label: 'Routed' },
      shipped: { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', label: 'Shipped' },
      not_routed: { bg: `${surface2}`, color: textMuted, label: 'Not Routed' },
    };
    const s = map[status] || map.not_routed;
    return `<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:8px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.color}30;">${s.label}</span>`;
  }

  // ── Table header cell ──
  const th = (label) => `<th style="background:${surface2};color:${textMuted};padding:5px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1.5px solid ${border};">${label}</th>`;
  const td = (val, i) => `<td style="padding:4px 6px;font-size:9px;color:${text};border-bottom:1px solid ${border};${i % 2 ? `background:${bg};` : ''}">${val || '—'}</td>`;

  // ── Build HTML ──
  let html = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:720px;margin:0 auto;background:${bg};padding:0;">
    <!-- Header -->
    <div style="background:${accent};padding:14px 20px;border-radius:10px 10px 0 0;">
      <div style="font-size:13px;font-weight:700;color:#FFF;letter-spacing:0.3px;">Routing</div>
      <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-top:2px;">NEXT 2 WEEKS · ${rangeStart} — ${rangeEnd}</div>
    </div>

    <div style="background:${surface};padding:16px 20px;border:1px solid ${border};border-top:none;border-radius:0 0 10px 10px;">

      <!-- Stats Row -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr>
        ${statCard(s.total, 'Total POs', text)}
        ${statCard(s.routed, 'Routed', accent)}
        ${statCard(s.shipped, 'Shipped', success)}
        ${statCard(s.not_routed, 'Not Routed', warn)}
        ${statCard(s.past_due, 'Past Due', danger)}
      </tr></table>

      <!-- Warehouse Breakdown -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;"><tr>
        ${Object.entries(data.warehouses).map(([name, wh]) => warehouseCard(name, wh)).join('')}
      </tr></table>`;

  // ── Past Due section ──
  if (data.past_due_orders && data.past_due_orders.length > 0) {
    html += `
      <div style="display:flex;align-items:center;gap:6px;margin:14px 0 6px;">
        <div style="width:3px;height:12px;background:${danger};border-radius:2px;"></div>
        <span style="font-size:9px;font-weight:700;color:${danger};text-transform:uppercase;letter-spacing:0.5px;">Past Due — Not Routed</span>
        <div style="flex:1;height:1px;background:${border};"></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${th('PO')}${th('Ticket')}${th('Store')}${th('Cancel')}${th('WH')}</tr></thead>
        <tbody>`;
    data.past_due_orders.forEach((o, i) => {
      html += `<tr>${td(o.po, i)}${td(o.ticket_number, i)}${td(o.store_name, i)}${td(fmt(o.cancel_date), i)}${td(o.warehouse_code, i)}</tr>`;
    });
    html += `</tbody></table>`;
  }

  // ── Main PO table — mirroring routing page columns ──
  html += `
      <div style="display:flex;align-items:center;gap:6px;margin:14px 0 6px;">
        <div style="width:3px;height:12px;background:${accent};border-radius:2px;"></div>
        <span style="font-size:9px;font-weight:700;color:${text};text-transform:uppercase;letter-spacing:0.5px;">All Orders</span>
        <span style="font-size:8px;color:${textMuted};margin-left:4px;">${data.orders.length} POs</span>
        <div style="flex:1;height:1px;background:${border};"></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${th('PO')}${th('Ticket')}${th('Store')}${th('Start')}${th('Cancel')}${th('WH')}${th('Routing')}${th('Status')}</tr></thead>
        <tbody>`;

  data.orders.forEach((o, i) => {
    html += `<tr>
      ${td(o.po, i)}
      ${td(o.ticket_number, i)}
      ${td(o.store_name, i)}
      ${td(fmt(o.start_date), i)}
      ${td(fmt(o.cancel_date), i)}
      ${td(o.warehouse_code, i)}
      ${td(o.routing, i)}
      <td style="padding:4px 6px;border-bottom:1px solid ${border};${i % 2 ? `background:${bg};` : ''}">${badge(o.routing_status)}</td>
    </tr>`;
  });

  html += `</tbody></table>

      <!-- Footer -->
      <div style="margin-top:14px;padding-top:8px;border-top:1px solid ${border};display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:7px;color:${textMuted};letter-spacing:0.3px;">Generated by Larry · Unlimited Avenues</span>
        <span style="font-size:7px;color:${textMuted};">Project Petal</span>
      </div>
    </div>
  </div>`;

  return html;
}

function buildPlainText(data) {
  const s = data.stats;
  let text = `ROUTING REPORT — NEXT 2 WEEKS\n`;
  text += `Generated: ${new Date(data.generated_at).toLocaleDateString('en-US')}\n`;
  text += `═══════════════════════════════════════\n\n`;
  text += `SUMMARY: ${s.total} Total | ${s.routed} Routed | ${s.shipped} Shipped | ${s.not_routed} Not Routed | ${s.past_due} Past Due\n\n`;

  for (const [wh, counts] of Object.entries(data.warehouses)) {
    text += `${wh}: ${counts.total} orders (${counts.routed} routed, ${counts.shipped} shipped, ${counts.not_routed} not routed)\n`;
  }
  text += '\n';

  if (data.past_due_orders && data.past_due_orders.length > 0) {
    text += `PAST DUE — NOT ROUTED:\n`;
    data.past_due_orders.forEach(r => text += `  ${r.po} | ${r.ticket_number || '—'} | ${r.store_name} | Cancel: ${fmt(r.cancel_date)} | ${r.warehouse_code}\n`);
    text += '\n';
  }

  text += `ALL ORDERS:\n`;
  data.orders.forEach(r => {
    const status = r.routing_status === 'routed' ? 'ROUTED' : r.routing_status === 'shipped' ? 'SHIPPED' : 'NOT ROUTED';
    text += `  ${r.po} | ${r.ticket_number || '—'} | ${r.store_name} | ${fmt(r.start_date)}-${fmt(r.cancel_date)} | ${r.warehouse_code} | ${r.routing || '—'} | ${status}\n`;
  });

  return text;
}

module.exports = { generateReport, buildEmailHtml, buildPlainText };
