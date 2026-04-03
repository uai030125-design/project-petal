import React, { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';
import api from '../utils/api';
import {
  FileText,
  Truck,
  ShoppingBag,
  Package,
  BarChart3,
  Users,
  Palette,
  Container,
  Clock,
  Download,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

const REPORT_ACCENT = '#2A1F1A';

// ─── Report Definitions ───
const REPORTS = [
  {
    id: 'two-week-logistics',
    title: 'Two-Week Logistics Report',
    description: 'Routing status, cut tickets, and shipments for the next 14 days.',
    category: 'Logistics',
    icon: Truck,
    apiCall: () => api.get('/dashboard/report'),
    generateHTML: generateTwoWeekReportHTML,
  },
  {
    id: 'shipping-summary',
    title: 'Shipping Summary',
    description: 'Current shipping status by warehouse and buyer.',
    category: 'Logistics',
    icon: Package,
    apiCall: () => api.get('/warehouse-orders/summary'),
    generateHTML: generateShippingSummaryHTML,
  },
  {
    id: 'monthly-sales',
    title: 'Monthly Sales by Buyer',
    description: 'PO breakdown by buyer for the current month.',
    category: 'Sales',
    icon: BarChart3,
    apiCall: () => api.get('/warehouse-orders', { params: { limit: 5000 } }),
    generateHTML: generateMonthlySalesHTML,
  },
  {
    id: 'ats-report',
    title: 'ATS Inventory Report',
    description: 'Available-to-sell by style and warehouse.',
    category: 'Inventory',
    icon: Package,
    apiCall: () => {
      const cached = localStorage.getItem('ats_cached_data');
      return Promise.resolve({ data: cached ? JSON.parse(cached) : [] });
    },
    generateHTML: generateATSReportHTML,
  },
  {
    id: 'production-status',
    title: 'Production Status Report',
    description: 'Cut ticket status summary.',
    category: 'Logistics',
    icon: Truck,
    apiCall: () => api.get('/production'),
    generateHTML: generateProductionStatusHTML,
  },
  {
    id: 'buyer-order-history',
    title: 'Buyer Order History',
    description: 'Historical orders by buyer.',
    category: 'Sales',
    icon: Users,
    apiCall: () => api.get('/buyers/orders'),
    generateHTML: generateBuyerOrderHistoryHTML,
  },
  {
    id: 'style-catalog',
    title: 'Style Catalog Export',
    description: 'Full product catalog with images.',
    category: 'Sales',
    icon: Palette,
    apiCall: () => api.get('/styles', { params: { limit: 1000 } }),
    generateHTML: generateStyleCatalogHTML,
  },
  {
    id: 'container-tracking',
    title: 'Container Tracking Report',
    description: 'Active container status and ETAs.',
    category: 'Logistics',
    icon: Container,
    apiCall: () => api.get('/containers'),
    generateHTML: generateContainerTrackingHTML,
  },
];

// ─── Report HTML Generators ───
function generateTwoWeekReportHTML(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - diff);
  const twoWeekEnd = new Date(weekStart);
  twoWeekEnd.setDate(twoWeekEnd.getDate() + 13);

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const periodLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${twoWeekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const fmt = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  const isWithinWindow = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d >= weekStart && d <= twoWeekEnd;
  };

  const rs = data.routing?.summary || {};
  const allRoutingOrders = data.routing?.orders || [];
  const routingOrders = allRoutingOrders.filter((o) => isWithinWindow(o.start_date));
  const allCutTickets = data.cut_tickets || [];
  const cutTickets = allCutTickets.filter((c) => isWithinWindow(c.due_date));
  const allShipments = data.shipments || [];
  const shipments = allShipments.filter((s) => isWithinWindow(s.load_id_date));

  const routingRows = routingOrders.map((o) => `
    <tr>
      <td>${o.po || '—'}</td><td>${o.store_name || '—'}</td>
      <td>${o.warehouse_code || '—'}</td><td><span class="badge">${(o.routing_status || '').replace('_', ' ')}</span></td>
      <td>${fmt(o.start_date)}</td><td>${fmt(o.cancel_date)}</td>
    </tr>`).join('');

  const ctRows = cutTickets.map((c) => `
    <tr>
      <td>${c.ct_number || '—'}</td><td>${c.po || '—'}</td>
      <td><span class="badge">${c.status || '—'}</span></td>
      <td>${fmt(c.due_date)}</td>
    </tr>`).join('');

  const vesselRows = shipments.map((s) => `
    <tr>
      <td>${s.po || '—'}</td><td>${s.store_name || '—'}</td><td>${s.carrier || '—'}</td>
      <td>${s.load_id_number || '—'}</td><td>${fmt(s.load_id_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Unlimited Avenues — Two-Week Report</title>
<style>
  @page{size:letter;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;font-size:9.5px;line-height:1.4}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:8px;margin-bottom:14px}
  .header h1{font-size:18px;font-weight:700;color:${REPORT_ACCENT};letter-spacing:-.3px}
  .header .subtitle{font-size:10px;color:#666}.header .date{font-size:10px;color:#888;text-align:right}
  .section{margin-bottom:14px}.section-title{font-size:11px;font-weight:700;color:${REPORT_ACCENT};text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e0e0e0}
  .summary-row{display:flex;gap:10px;margin-bottom:10px}.summary-card{flex:1;background:#f8f9fa;border-radius:6px;padding:8px 12px;text-align:center;border:1px solid #e8e8e8}
  .summary-card .num{font-size:20px;font-weight:700}.summary-card .lbl{font-size:8px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:8.5px}
  th{background:${REPORT_ACCENT};color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:4px 6px;border-bottom:1px solid #eee}tr:nth-child(even){background:#fafafa}
  .badge{display:inline-block;padding:1px 6px;border-radius:8px;font-size:7.5px;font-weight:600;background:#f0f0f0;color:#333}
  .empty-note{padding:12px;text-align:center;color:#999;font-style:italic;font-size:9px}
  .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
</style></head><body>
<div class="header"><div><h1>Unlimited Avenues</h1><div class="subtitle">Two-Week Operations Report • ${periodLabel}</div></div><div class="date">Generated ${dateStr}</div></div>
<div class="section"><div class="section-title">Shipment Routing</div>
  <div class="summary-row">
    <div class="summary-card"><div class="num">${rs.routed || 0}</div><div class="lbl">Routed</div></div>
    <div class="summary-card"><div class="num">${rs.not_routed || 0}</div><div class="lbl">Not Routed</div></div>
    <div class="summary-card"><div class="num">${rs.issue || 0}</div><div class="lbl">Issues</div></div>
  </div>
  ${routingOrders.length > 0 ? `<table><thead><tr><th>PO</th><th>Store</th><th>WH</th><th>Status</th><th>Start</th><th>Cancel</th></tr></thead><tbody>${routingRows}</tbody></table>` : '<div class="empty-note">No shipments found.</div>'}
</div>
<div class="section"><div class="section-title">Cut Tickets Due Next 2 Weeks</div>
  ${cutTickets.length > 0 ? `<table><thead><tr><th>CT</th><th>PO</th><th>Status</th><th>Due</th></tr></thead><tbody>${ctRows}</tbody></table>` : '<div class="empty-note">No cut tickets found.</div>'}
</div>
<div class="section"><div class="section-title">Vessel Arrivals</div>
  ${shipments.length > 0 ? `<table><thead><tr><th>PO</th><th>Store</th><th>Carrier</th><th>Load ID</th><th>Date</th></tr></thead><tbody>${vesselRows}</tbody></table>` : '<div class="empty-note">No shipments found.</div>'}
</div>
<div class="footer">Unlimited Avenues • Operations Report</div>
</body></html>`;
}

function generateShippingSummaryHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const summary = data || {};
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Shipping Summary</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  .date{color:#888;font-size:12px}
  .content{white-space:pre-wrap;font-family:monospace;font-size:12px;max-width:800px}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Shipping Summary Report</h1><div class="date">Generated ${now}</div></div>
<div class="content">${JSON.stringify(summary, null, 2) || 'No shipping data available'}</div>
<div class="footer">Unlimited Avenues • Shipping Report</div>
</body></html>`;
}

function generateMonthlySalesHTML(data) {
  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const orders = Array.isArray(data) ? data : (data.data || []);
  const byBuyer = {};
  orders.forEach((o) => {
    const buyer = o.buyer_name || 'Unknown';
    if (!byBuyer[buyer]) byBuyer[buyer] = { count: 0, pos: [], total_amount: 0 };
    byBuyer[buyer].count += 1;
    byBuyer[buyer].pos.push(o.po || '—');
    byBuyer[buyer].total_amount += o.total_amount || 0;
  });

  const rows = Object.entries(byBuyer).map(
    ([buyer, info]) => `<tr><td>${buyer}</td><td>${info.count}</td><td>${info.pos.slice(0, 3).join(', ')}</td><td>$${info.total_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Monthly Sales Report</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px;font-size:11px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  .date{color:#888;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:${REPORT_ACCENT};color:#fff;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Monthly Sales by Buyer</h1><div class="subtitle">For ${month}</div><div class="date">Generated ${dateStr}</div></div>
<table><thead><tr><th>Buyer</th><th>Order Count</th><th>Sample POs</th><th>Total Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">No sales data available</td></tr>'}</tbody></table>
<div class="footer">Unlimited Avenues • Sales Report</div>
</body></html>`;
}

function generateATSReportHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ats = Array.isArray(data) ? data : [];

  // Calculate summary stats
  const uniqueStyles = new Set(ats.map((a) => a.style_number).filter(Boolean));
  const totalStyles = uniqueStyles.size;
  const totalUnits = ats.reduce((sum, a) => sum + (a.ats_units || 0), 0);

  // Group by style to find styles below 50 units
  const styleAggregates = {};
  ats.forEach((a) => {
    const style = a.style_number || 'Unknown';
    if (!styleAggregates[style]) styleAggregates[style] = 0;
    styleAggregates[style] += a.ats_units || 0;
  });
  const stylesBelowFifty = Object.values(styleAggregates).filter((units) => units < 50).length;

  const rows = ats.map(
    (a) => `<tr>
      <td>${a.style_number || '—'}</td>
      <td>${a.category || '—'}</td>
      <td>${a.color || '—'}</td>
      <td style="text-align:right">${(a.ats_units || 0).toLocaleString()}</td>
      <td>${a.warehouse || '—'}</td>
      <td>${a.lot || '—'}</td>
      <td>${a.vendor_inventory || '—'}</td>
      <td>${a.eta ? new Date(a.eta).toLocaleDateString() : '—'}</td>
      <td>${a.cut_ticket || '—'}</td>
      <td>${a.buyer || '—'}</td>
      <td>${a.remarks || '—'}</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>ATS Inventory Report</title>
<style>
  @page{size:letter landscape;margin:.5in .6in}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;font-size:9px;line-height:1.3}
  .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:8px;margin-bottom:14px}
  .header h1{font-size:18px;font-weight:700;color:${REPORT_ACCENT};letter-spacing:-.3px}
  .header .date{font-size:10px;color:#888;text-align:right}
  .summary{display:flex;gap:10px;margin-bottom:14px}
  .summary-card{flex:1;background:#f8f9fa;border-radius:6px;padding:8px 12px;text-align:center;border:1px solid #e8e8e8}
  .summary-card .num{font-size:18px;font-weight:700;color:${REPORT_ACCENT}}
  .summary-card .lbl{font-size:8px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:8px}
  th{background:${REPORT_ACCENT};color:#fff;padding:5px 6px;text-align:left;font-weight:600;font-size:8px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:4px 6px;border-bottom:1px solid #eee;white-space:nowrap}
  tr:nth-child(even){background:#fafafa}
  .empty-note{padding:12px;text-align:center;color:#999;font-style:italic;font-size:9px}
  .footer{text-align:center;font-size:8px;color:#aaa;margin-top:10px;padding-top:6px;border-top:1px solid #eee}
</style></head><body>
<div class="header"><div><h1>Unlimited Avenues</h1><div style="font-size:10px;color:#666">ATS Inventory Report</div></div><div class="date">Generated ${now}</div></div>
<div class="summary">
  <div class="summary-card"><div class="num">${totalStyles}</div><div class="lbl">Total Styles</div></div>
  <div class="summary-card"><div class="num">${totalUnits.toLocaleString()}</div><div class="lbl">Total Units</div></div>
  <div class="summary-card"><div class="num">${stylesBelowFifty}</div><div class="lbl">Styles Below 50</div></div>
</div>
${ats.length > 0 ? `<table><thead><tr><th>Style</th><th>Category</th><th>Color</th><th style="text-align:right">ATS Units</th><th>Warehouse</th><th>Lot</th><th>Vendor Inv</th><th>ETA</th><th>CT#</th><th>Buyer</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty-note">No ATS data available</div>'}
<div class="footer">Unlimited Avenues • ATS Inventory Report</div>
</body></html>`;
}

function generateProductionStatusHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const production = Array.isArray(data) ? data : [];

  const rows = production.slice(0, 50).map(
    (p) => `<tr><td>${p.ct || '—'}</td><td>${p.customer || '—'}</td><td>${p.customer_po || '—'}</td><td>${p.vendor || '—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Production Status</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px;font-size:11px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:${REPORT_ACCENT};color:#fff;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Production Status Report</h1><div style="color:#888;font-size:12px">Generated ${now}</div></div>
<table><thead><tr><th>CT</th><th>Customer</th><th>PO</th><th>Vendor</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">No production data available</td></tr>'}</tbody></table>
<div class="footer">Unlimited Avenues • Production Report</div>
</body></html>`;
}

function generateBuyerOrderHistoryHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const orders = Array.isArray(data) ? data : (data.data || []);

  const rows = orders.slice(0, 100).map(
    (o) => `<tr><td>${o.buyer_name || '—'}</td><td>${o.po || '—'}</td><td>${o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Buyer Order History</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px;font-size:11px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:${REPORT_ACCENT};color:#fff;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Buyer Order History</h1><div style="color:#888;font-size:12px">Generated ${now}</div></div>
<table><thead><tr><th>Buyer</th><th>PO</th><th>Order Date</th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:#999">No order data available</td></tr>'}</tbody></table>
<div class="footer">Unlimited Avenues • Sales Report</div>
</body></html>`;
}

function generateStyleCatalogHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const styles = Array.isArray(data) ? data : (data.data || []);

  const rows = styles.slice(0, 100).map(
    (s) => `<tr><td>${s.style_number || '—'}</td><td>${s.name || '—'}</td><td>${s.category || '—'}</td><td>${s.color || '—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Style Catalog</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px;font-size:11px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:${REPORT_ACCENT};color:#fff;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Style Catalog Export</h1><div style="color:#888;font-size:12px">Generated ${now}</div></div>
<table><thead><tr><th>Style #</th><th>Name</th><th>Category</th><th>Color</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999">No style data available</td></tr>'}</tbody></table>
<div class="footer">Unlimited Avenues • Product Catalog</div>
</body></html>`;
}

function generateContainerTrackingHTML(data) {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const containers = Array.isArray(data) ? data : (data.data || []);

  const rows = containers.slice(0, 100).map(
    (c) => `<tr><td>${c.container_id || '—'}</td><td>${c.status || '—'}</td><td>${c.origin || '—'}</td><td>${c.destination || '—'}</td><td>${c.eta ? new Date(c.eta).toLocaleDateString() : '—'}</td></tr>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Container Tracking</title>
<style>
  body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a2e;padding:20px;font-size:11px}
  .header{border-bottom:2.5px solid ${REPORT_ACCENT};padding-bottom:10px;margin-bottom:20px}
  h1{color:${REPORT_ACCENT};font-size:24px}
  table{width:100%;border-collapse:collapse;margin-top:15px}
  th{background:${REPORT_ACCENT};color:#fff;padding:8px;text-align:left;font-weight:600;text-transform:uppercase;font-size:10px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  tr:nth-child(even){background:#fafafa}
  .footer{margin-top:30px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa}
</style></head><body>
<div class="header"><h1>Container Tracking Report</h1><div style="color:#888;font-size:12px">Generated ${now}</div></div>
<table><thead><tr><th>Container</th><th>Status</th><th>Origin</th><th>Destination</th><th>ETA</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999">No container data available</td></tr>'}</tbody></table>
<div class="footer">Unlimited Avenues • Logistics Report</div>
</body></html>`;
}

// ─── Component ───
export default function Reports() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('All');
  const [loadingReports, setLoadingReports] = useState({});
  const [recentReports, setRecentReports] = useState([]);

  // Load recent reports from localStorage on mount
  useEffect(() => {
    try {
      const recent = localStorage.getItem('recent_reports');
      if (recent) setRecentReports(JSON.parse(recent));
    } catch (e) {
      console.error('Failed to load recent reports:', e);
    }
  }, []);

  const filteredReports =
    activeTab === 'All'
      ? REPORTS
      : REPORTS.filter((r) => r.category === activeTab);

  const categories = ['All', ...new Set(REPORTS.map((r) => r.category))];

  const handleGenerateReport = async (report) => {
    setLoadingReports((prev) => ({ ...prev, [report.id]: true }));
    try {
      const data = await report.apiCall();
      const html = report.generateHTML(data.data || data);

      // Use blob download approach to avoid popup blockers
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Try window.open first, fall back to link click
      const win = window.open(url, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        // Popup was blocked — use download link fallback
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
      }

      // Clean up after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      // Store in localStorage
      const timestamp = new Date().toLocaleString();
      const updated = [
        { id: report.id, title: report.title, timestamp },
        ...recentReports.filter((r) => r.id !== report.id),
      ].slice(0, 5);
      setRecentReports(updated);
      localStorage.setItem('recent_reports', JSON.stringify(updated));
      localStorage.setItem(`report_timestamp_${report.id}`, timestamp);

      toast.success(`${report.title} generated successfully!`);
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error(`Failed to generate ${report.title}`);
    } finally {
      setLoadingReports((prev) => ({ ...prev, [report.id]: false }));
    }
  };

  const getReportTimestamp = (reportId) => {
    return localStorage.getItem(`report_timestamp_${reportId}`) || null;
  };

  const getStatus = (reportId) => {
    if (loadingReports[reportId]) return 'Generating...';
    const timestamp = getReportTimestamp(reportId);
    return timestamp ? 'Generated' : 'Ready';
  };

  const getStatusBadge = (reportId) => {
    const status = getStatus(reportId);
    if (status === 'Generated')
      return <span className="badge badge-success">✓ Generated</span>;
    if (status === 'Generating...')
      return <span className="badge badge-blue">⟳ Generating...</span>;
    return <span className="badge badge-neutral">● Ready</span>;
  };

  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <PageHeader
        title="Reports & Exports"
      />

      {/* Recent Reports Section */}
      {recentReports.length > 0 && (
        <div className="card stagger-in" style={{ marginBottom: '30px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px', fontWeight: 600 }}>
              Recent Reports
            </h3>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {recentReports.map((r) => (
              <div
                key={r.id}
                style={{
                  padding: '12px',
                  background: 'var(--surface2)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13px', marginBottom: '4px' }}>
                  {r.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{r.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', overflowX: 'auto' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            style={{
              padding: '8px 16px',
              background: activeTab === cat ? 'var(--accent)' : 'transparent',
              color: activeTab === cat ? '#fff' : 'var(--text-dim)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== cat) e.currentTarget.style.background = 'var(--surface2)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== cat) e.currentTarget.style.background = 'transparent';
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Report Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {filteredReports.map((report, idx) => {
          const Icon = report.icon;
          const timestamp = getReportTimestamp(report.id);
          const isLoading = loadingReports[report.id];

          return (
            <div
              key={report.id}
              className="card stagger-in"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                animationDelay: `${idx * 50}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <Icon size={28} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                {getStatusBadge(report.id)}
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px 0' }}>
                {report.title}
              </h3>

              <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: '0 0 12px 0', flex: 1 }}>
                {report.description}
              </p>

              {timestamp && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Last generated: {timestamp}
                </div>
              )}

              <button
                onClick={() => handleGenerateReport(report)}
                disabled={isLoading}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'default' : 'pointer',
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .stagger-in {
          animation: slideUp 0.4s ease-out forwards;
          opacity: 0;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
