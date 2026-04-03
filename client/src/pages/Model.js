import React, { useState, useCallback, useEffect, useRef } from 'react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

/* ── Format currency ── */
const fmt = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (isNaN(n)) return v;
  if (n === 0) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1 ? abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${s})` : s;
};
const pct = (v) => {
  if (v === null || v === undefined) return '—';
  return (v * 100).toFixed(1) + '%';
};
const sumArr = (arr) => arr.reduce((a, b) => a + b, 0);
const qSum = (arr, qi) => arr[qi * 3] + arr[qi * 3 + 1] + arr[qi * 3 + 2];

/* ═══════════════════════════════════════════
   P&L DATA — FY 2025 (monthly Jan–Dec)
   ═══════════════════════════════════════════ */
const FY25_SALES       = [2023605.92, 2416216.78, 3460822.50, 3393738.05, 3591720.20, 2430962.30, 1321329.30, 891851.66, 439477.85, 770004.60, 540455.35, 2536059.70];
const FY25_CHARGEBACKS = [-5365.10, -3078.60, -5436.29, -11412.02, -16591.75, -15571.01, -54775.78, -6525.06, -9394.40, -77776.00, -2624.35, -17480.82];

const FY25_COGS = [
  { label: 'Purchases – Import',       m: [3585991.09, 1417400.35, 2052107.20, 1637691.34, 816984.14, 1275733.91, 652435.01, 700175.38, 606006.41, 1562496.59, 1228848.83, 1775334.43] },
  { label: 'Purchase Local',            m: [0, 0, 0, 0, 0, 50400, 3744, 0, 0, 0, 0, 0] },
  { label: 'Purchase Discount',         m: [-2883.04, -10481.58, -21960.85, -75728.10, -5112.86, -3307.50, -5946.47, -2745.23, -1982.21, -2425.45, -7567.06, -3031.39] },
  { label: 'Sample / Design / Dev',     m: [22715.18, 21670.26, 14590.81, 13147.80, 19911.10, 17677.08, 13372.23, 43506.40, 50824.39, 48138.32, 14871.07, 7229.34] },
  { label: 'Custom Duty',               m: [252690.57, 364580.10, 279323.78, 694117.89, 158506.48, 42983.24, 77607.32, 53229.28, 891.25, 0, 0, 0] },
  { label: 'Freight In',                m: [6806.65, 7283, 9963, 5495, 0, 1186, 0, 885, 0, 155, 0, 0] },
  { label: 'Ocean Freight & Handling',   m: [50338.78, 73515.61, 82201.79, 59807.64, -6269.10, 6777.30, 37378.83, 32488.59, 0, 0, 3908, 16600] },
  { label: 'Warehouse Expenses',         m: [38092.82, 43059.49, 94428.53, 80235.19, 18915.68, 58534.48, 88394.53, 15767.29, 8202.15, 11703.14, 10620.07, 42235.83] },
];

const FY25_OPEX = [
  { label: 'Sales Commissions',         m: [0, 2500, 6504.67, 0, 5000, 9480.10, 5498, 0, 0, 15655.94, 0, 0] },
  { label: 'Discount/Concession',       m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -511.08] },
  { label: 'Donations',                 m: [151, 151, 151, 151, 151, 151, 151, 2651, 151, 151, 5151, 151] },
  { label: 'Factor Commission & Fees',  m: [6461.02, 8121.25, 12020.60, 12120.67, 10297.80, 10894.76, 4813.87, 3349.92, 1171.45, 2791.58, 1519.60, 5517.20] },
  { label: 'Factor Interest',           m: [5938.24, 7107.25, 9155.44, 17190.35, 22236.32, 26324.80, 19258.36, 10084.10, 3691.43, -160.16, -1374, 5305.17] },
  { label: 'Finance Charges',           m: [5977.79, 3419.40, 2297.93, 2633.08, 1593.65, 4590.82, 332.24, 25.20, 0, 569.99, 46.85, 2013.88] },
  { label: 'Gift / Xmas',               m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3500] },
  { label: 'Health Insurance',          m: [3556.36, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44, 3788.44] },
  { label: 'Inspection of Goods',       m: [0, 0, 0, 25000, 0, 0, 0, 0, 17234.22, 0, 0, 0] },
  { label: 'Factor Misc Charges',       m: [535, 575, 675, 575, 750, 600, 700, 555, 650, 575, 425, 425] },
  { label: 'Modelling Services',        m: [540, 270, 0, 0, 0, 0, 0, 0, 330, 330, 330, 0] },
  { label: 'Payroll Processing Fees',   m: [673.50, 43.50, 43.50, 110.70, 43.50, 43.50, 43.50, 43.50, 43.50, 52.61, 43.50, 43.50] },
  { label: 'Penalty / Lawsuit',         m: [0, 0, 0, 0, 0, 18000, 0, 0, 0, 0, 0, 0] },
  { label: 'Sales Promotion',           m: [0, 0, 8628.34, 0, 100, 0, 0, 8000, 0, 2320, 0, 0] },
  { label: 'Showroom Expenses',         m: [0, 258.08, 46.63, 606.63, 108.81, 108.81, 23.94, 263.32, 4196.63, 143.63, 143.63, 196.25] },
  { label: 'Statement Charges',         m: [495, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 0] },
  { label: 'Subscription Fee',          m: [0, 0, 0, 0, 0, 4572.75, 0, 0, 0, 0, 125, 0] },
  { label: 'Support & Maintenance',     m: [300, 1620, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300] },
  { label: 'Temporary Help',            m: [0, 143, 91, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Auto & Truck Expenses',     m: [1960.01, 1960.01, 11699.41, 4190.01, 1960.01, 6420.01, 4210.01, 4210.01, 4210.01, 4210.01, 6410.01, 5750] },
  { label: 'Courier Charges',           m: [1080.84, 534.21, 264, 628.21, 1049.36, 500.22, 321.16, 3383.45, 1142, 3651.03, 978.79, 1209.24] },
  { label: 'Bank Service Charges',      m: [186.12, 517.25, 469.39, 607.59, 691.34, 703, 502.38, -8.06, 333.50, 467.73, 452.67, 584.47] },
  { label: 'Computer & Internet',       m: [340, 340, 0, 340, 680, 0, 340, 680, 0, 680, 0, 680] },
  { label: 'Freight Out',               m: [1806.75, 2697.12, 2709.79, 1183.90, 2230.79, 994.45, 2690.70, 1870.80, 603.22, 626.19, 102.75, 1161] },
  { label: 'Insurance Expense',         m: [611.59, 20496, 2400, 0, 0, 1760, 1761.98, 700.69, 0, 19209.89, 1562.09, 2901] },
  { label: 'Insurance Disability',      m: [-298.19, -239.72, -239.73, -239.72, -299.64, -185.56, -122.21, -181.88, 2701.36, 0, 0, 0] },
  { label: 'Janitorial Expense',        m: [266.02, 516.02, 66.02, 266.02, 316.02, 266.02, 266.02, 316.02, 266.02, 266.02, 516.02, 66.02] },
  { label: 'Legal Fees',                m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 495, 0, 0] },
  { label: 'Office Supplies',           m: [0, 707.69, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { label: 'Payroll Expenses',          m: [78382.41, 62356.79, 62779.68, 61849.21, 77311.47, 61849.21, 61849.17, 97290.41, 69528.40, 0, 0, 0] },
  { label: 'Professional Fees',         m: [0, 0, 0, 0, 0, 0, 0, 0, 6570, 0, 0, 0] },
  { label: 'Rent Expense',              m: [7301.22, 8828.40, 7301.22, 8508.93, 7301.22, 9758, 9515, 16715, 19273, 19273, 0, 0] },
  { label: 'Travel Expense',            m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1500, 0, 0] },
];

const FY25_OTHER = [];

/* ═══════════════════════════════════════════
   P&L DATA — Q1 2026 (monthly Jan–Mar)
   ═══════════════════════════════════════════ */
const Q126_SALES       = [2850138.70, 2996715.65, 3590403.95];
const Q126_CHARGEBACKS = [-3004.64, -5735.18, -3750.42];

const Q126_COGS = [
  { label: 'Purchases – Import',       m: [3697794.42, 4209512.62, 3105996.78] },
  { label: 'Purchase Discount',         m: [-2197.49, 14275.52, -1100.10] },
  { label: 'Sample / Design / Dev',     m: [40942.48, 11302.85, 33832.47] },
  { label: 'Custom Duty',               m: [0, 2658.83, 7621.49] },
  { label: 'Freight In',                m: [0, 160, 0] },
  { label: 'Ocean Freight & Handling',   m: [37619, 5817.52, 4681] },
  { label: 'Warehouse Expenses',         m: [43768.88, 43162.82, 7436.70] },
];

const Q126_OPEX = [
  { label: 'Sales Commissions',         m: [4120.35, 0, 0] },
  { label: 'Donations',                 m: [151, 151, 151] },
  { label: 'Factor Commission & Fees',  m: [6931.22, 8915.10, 0] },
  { label: 'Factor Interest',           m: [6474.03, 17569.10, 0] },
  { label: 'Finance Charges',           m: [11005.90, 6673.24, 2615.30] },
  { label: 'Health Insurance',          m: [5991.91, 4363.60, 2181.80] },
  { label: 'Inspection of Goods',       m: [0, 22498.21, 0] },
  { label: 'Factor Misc Charges',       m: [350, 475, 0] },
  { label: 'Modelling Services',        m: [0, 330, 330] },
  { label: 'Sales Promotion',           m: [223, 0, 0] },
  { label: 'Showroom Expenses',         m: [151.25, 374.36, 211.25] },
  { label: 'Statement Charges',         m: [95, 95, 95] },
  { label: 'Stationery & Printing',     m: [0, 0, 81.64] },
  { label: 'Support & Maintenance',     m: [300, 300, 300] },
  { label: 'Auto & Truck Expenses',     m: [3200, 1696.78, 6176.18] },
  { label: 'Courier Charges',           m: [2530, 657.06, 0] },
  { label: 'Bank Service Charges',      m: [608.88, 600.17, 10] },
  { label: 'Computer & Internet',       m: [340, 340, 0] },
  { label: 'Freight Out',               m: [1065.22, 2503.32, 2177.55] },
  { label: 'Insurance Expense',         m: [0, 25259, 0] },
  { label: 'Janitorial Expense',        m: [266.02, 316.02, 266.02] },
  { label: 'Payroll Expenses',          m: [50.48, 43.50, 43.50] },
  { label: 'Rent Expense',              m: [0, 9515, 0] },
];

const Q126_OTHER = [
  { label: 'Refund on Credit Card',     m: [0, 558, 0] },
];

/* ═══════════════════════════════════════════
   PERIOD COMPUTATION HELPERS
   ═══════════════════════════════════════════ */
function buildQuarterly(salesM, cbM, cogsItems, opexItems, otherItems) {
  const qs = [0, 1, 2, 3];
  const cols = qs.map(q => 'Q' + (q + 1));
  const sales = qs.map(q => qSum(salesM, q));
  const cb = qs.map(q => qSum(cbM, q));
  const netRev = sales.map((s, i) => s + cb[i]);
  const cogs = cogsItems.map(c => ({ label: c.label, values: qs.map(q => qSum(c.m, q)) }));
  const totalCogs = qs.map((_, i) => cogs.reduce((s, c) => s + c.values[i], 0));
  const gp = netRev.map((r, i) => r - totalCogs[i]);
  const opex = opexItems.map(c => ({ label: c.label, values: qs.map(q => qSum(c.m, q)) }));
  const totalOpex = qs.map((_, i) => opex.reduce((s, c) => s + c.values[i], 0));
  const netOp = gp.map((g, i) => g - totalOpex[i]);
  const other = otherItems.map(c => ({ label: c.label, values: qs.map(q => qSum(c.m, q)) }));
  const totalOther = qs.map((_, i) => other.reduce((s, c) => s + c.values[i], 0));
  const ni = netOp.map((o, i) => o + totalOther[i]);
  return { cols, sales, cb, netRev, cogs, totalCogs, gp, opex, totalOpex, netOp, other, totalOther, ni };
}

function buildMonthly(salesM, cbM, cogsItems, opexItems, otherItems, labels) {
  const n = salesM.length;
  const cols = labels;
  const sales = salesM;
  const cb = cbM;
  const netRev = sales.map((s, i) => s + cb[i]);
  const cogs = cogsItems.map(c => ({ label: c.label, values: c.m }));
  const totalCogs = Array.from({ length: n }, (_, i) => cogs.reduce((s, c) => s + c.values[i], 0));
  const gp = netRev.map((r, i) => r - totalCogs[i]);
  const opex = opexItems.map(c => ({ label: c.label, values: c.m }));
  const totalOpex = Array.from({ length: n }, (_, i) => opex.reduce((s, c) => s + c.values[i], 0));
  const netOp = gp.map((g, i) => g - totalOpex[i]);
  const other = otherItems.map(c => ({ label: c.label, values: c.m }));
  const totalOther = Array.from({ length: n }, (_, i) => other.reduce((s, c) => s + c.values[i], 0));
  const ni = netOp.map((o, i) => o + totalOther[i]);
  return { cols, sales, cb, netRev, cogs, totalCogs, gp, opex, totalOpex, netOp, other, totalOther, ni };
}

/* Pre-computed periods */
const FY25 = buildQuarterly(FY25_SALES, FY25_CHARGEBACKS, FY25_COGS, FY25_OPEX, FY25_OTHER);
const Q126 = buildMonthly(Q126_SALES, Q126_CHARGEBACKS, Q126_COGS, Q126_OPEX, Q126_OTHER, ['Jan-26', 'Feb-26', 'Mar-26']);

/* ── Excel export ── */
function downloadExcel(period, data, periodLabel, totalLabel) {
  if (!window.XLSX) return;
  const wb = window.XLSX.utils.book_new();
  const n = data.cols.length;

  const rows = [
    ['Unlimited Avenues'],
    [`Profit & Loss Statement — ${periodLabel}`],
    [],
    ['', ...data.cols, totalLabel],
    [],
    ['REVENUE'],
    ['  Gross Sales', ...data.sales, sumArr(data.sales)],
    ['  Chargebacks', ...data.cb, sumArr(data.cb)],
    ['Net Revenue', ...data.netRev, sumArr(data.netRev)],
    [],
    ['COST OF GOODS SOLD'],
    ...data.cogs.map(c => ['  ' + c.label, ...c.values, sumArr(c.values)]),
    ['Total COGS', ...data.totalCogs, sumArr(data.totalCogs)],
    [],
    ['GROSS PROFIT', ...data.gp, sumArr(data.gp)],
    ['  Gross Margin %', ...data.gp.map((g, i) => data.netRev[i] ? g / data.netRev[i] : 0), sumArr(data.gp) / sumArr(data.netRev)],
    [],
    ['OPERATING EXPENSES'],
    ...data.opex.map(c => ['  ' + c.label, ...c.values, sumArr(c.values)]),
    ['Total Operating Expenses', ...data.totalOpex, sumArr(data.totalOpex)],
    ['  OpEx % of Revenue', ...data.totalOpex.map((o, i) => data.netRev[i] ? o / data.netRev[i] : 0), sumArr(data.totalOpex) / sumArr(data.netRev)],
    [],
    ['NET OPERATING INCOME', ...data.netOp, sumArr(data.netOp)],
    ['  Operating Margin %', ...data.netOp.map((o, i) => data.netRev[i] ? o / data.netRev[i] : 0), sumArr(data.netOp) / sumArr(data.netRev)],
    [],
    ['OTHER INCOME / (EXPENSE)'],
    ...data.other.map(c => ['  ' + c.label, ...c.values, sumArr(c.values)]),
    ['Total Other Income', ...data.totalOther, sumArr(data.totalOther)],
    [],
    ['NET INCOME', ...data.ni, sumArr(data.ni)],
    ['  Net Margin %', ...data.ni.map((x, i) => data.netRev[i] ? x / data.netRev[i] : 0), sumArr(data.ni) / sumArr(data.netRev)],
  ];

  const ws = window.XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, ...data.cols.map(() => ({ wch: 16 })), { wch: 16 }];
  window.XLSX.utils.book_append_sheet(wb, ws, 'P&L Summary');
  window.XLSX.writeFile(wb, `UA_PL_${period}.xlsx`);
}

/* ═══════════════════════════════════════════
   P&L TABLE COMPONENTS
   ═══════════════════════════════════════════ */
const cellBase = { padding: '6px 14px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' };
const labelBase = { padding: '6px 14px', fontSize: 13, textAlign: 'left' };

function SectionHeader({ label, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{
        ...labelBase, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: 'var(--text-muted)', paddingTop: 18, paddingBottom: 6,
        borderBottom: '2px solid var(--border)',
      }}>{label}</td>
    </tr>
  );
}

function DataRow({ label, values, total, indent = true, bold = false }) {
  const color = (v) => v < 0 ? '#dc2626' : 'var(--text)';
  return (
    <tr style={{ borderBottom: '1px solid var(--surface3)' }}>
      <td style={{ ...labelBase, paddingLeft: indent ? 28 : 14, fontWeight: bold ? 700 : 400, color: 'var(--text)' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...cellBase, fontWeight: bold ? 700 : 400, color: color(v) }}>{fmt(v)}</td>
      ))}
      <td style={{ ...cellBase, fontWeight: bold ? 700 : 500, color: color(total), background: bold ? 'rgba(0,0,0,0.02)' : 'transparent' }}>{fmt(total)}</td>
    </tr>
  );
}

function SubtotalRow({ label, values, total }) {
  const color = (v) => v < 0 ? '#dc2626' : 'var(--text)';
  return (
    <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
      <td style={{ ...labelBase, fontWeight: 700, color: 'var(--text)' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...cellBase, fontWeight: 700, color: color(v) }}>{fmt(v)}</td>
      ))}
      <td style={{ ...cellBase, fontWeight: 700, color: color(total), background: 'rgba(0,0,0,0.03)' }}>{fmt(total)}</td>
    </tr>
  );
}

function MarginRow({ label, values, total }) {
  return (
    <tr>
      <td style={{ ...labelBase, paddingLeft: 28, fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...cellBase, fontSize: 11, fontStyle: 'italic', color: v < 0 ? '#dc2626' : 'var(--text-muted)' }}>{pct(v)}</td>
      ))}
      <td style={{ ...cellBase, fontSize: 11, fontStyle: 'italic', color: total < 0 ? '#dc2626' : 'var(--text-muted)', background: 'rgba(0,0,0,0.02)' }}>{pct(total)}</td>
    </tr>
  );
}

function TotalRow({ label, values, total, double = false }) {
  const color = (v) => v < 0 ? '#dc2626' : 'var(--text)';
  return (
    <tr style={{
      background: 'var(--surface)',
      borderTop: '2px solid var(--border)',
      borderBottom: double ? '4px double var(--border)' : '2px solid var(--border)',
    }}>
      <td style={{ ...labelBase, fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} style={{ ...cellBase, fontWeight: 800, fontSize: 13, color: color(v) }}>{fmt(v)}</td>
      ))}
      <td style={{ ...cellBase, fontWeight: 800, fontSize: 13, color: color(total), background: 'rgba(0,0,0,0.04)' }}>{fmt(total)}</td>
    </tr>
  );
}

function SpacerRow({ colSpan }) {
  return <tr><td colSpan={colSpan} style={{ padding: '4px 0' }}></td></tr>;
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function Model() {
  const [period, setPeriod] = useState('q1_2026');

  const isQ1 = period === 'q1_2026';
  const data = isQ1 ? Q126 : FY25;
  const periodLabel = isQ1 ? 'Q1 2026 · January – March' : 'FY 2025 · January – December (Quarterly)';
  const totalLabel = isQ1 ? 'Q1 Total' : 'FY Total';
  const colCount = data.cols.length + 2; // label + cols + total

  const handleDownload = () => {
    downloadExcel(
      isQ1 ? 'Q1_2026' : 'FY_2025',
      data,
      isQ1 ? 'Q1 2026' : 'FY 2025',
      totalLabel
    );
  };

  return (
    <div className="fade-in">
      <PageHeader title="Financial Model" />

      {/* Header bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Profit & Loss Statement</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{periodLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Period toggle */}
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {[
              { key: 'fy_2025', label: 'FY 2025' },
              { key: 'q1_2026', label: 'Q1 2026' },
            ].map(t => (
              <button key={t.key} onClick={() => setPeriod(t.key)} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: period === t.key ? 700 : 400,
                background: period === t.key ? '#A47864' : 'transparent',
                color: period === t.key ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>{t.label}</button>
            ))}
          </div>
          <button
            onClick={handleDownload}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <span style={{ fontSize: 14 }}>&#8681;</span> Download Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Net Revenue', value: sumArr(data.netRev), sub: totalLabel },
          { label: 'Gross Profit', value: sumArr(data.gp), sub: pct(sumArr(data.gp) / sumArr(data.netRev)) + ' margin' },
          { label: 'Total OpEx', value: sumArr(data.totalOpex), sub: pct(sumArr(data.totalOpex) / sumArr(data.netRev)) + ' of rev' },
          { label: 'Net Income', value: sumArr(data.ni), sub: pct(sumArr(data.ni) / sumArr(data.netRev)) + ' margin' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px 18px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
            <div style={{
              fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              color: k.value < 0 ? '#dc2626' : 'var(--text)',
            }}>${fmt(k.value)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* P&L Table */}
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
          <thead>
            <tr>
              <th style={{ ...labelBase, fontWeight: 700, fontSize: 11, color: '#fff', background: '#2D4A5A', minWidth: 240 }}></th>
              {data.cols.map(m => (
                <th key={m} style={{ ...cellBase, fontWeight: 700, fontSize: 11, color: '#fff', background: '#2D4A5A', minWidth: 120 }}>{m}</th>
              ))}
              <th style={{ ...cellBase, fontWeight: 700, fontSize: 11, color: '#fff', background: '#1a3340', minWidth: 130 }}>{totalLabel}</th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <SectionHeader label="Revenue" colSpan={colCount} />
            <DataRow label="Gross Sales" values={data.sales} total={sumArr(data.sales)} />
            <DataRow label="Chargebacks" values={data.cb} total={sumArr(data.cb)} />
            <SubtotalRow label="Net Revenue" values={data.netRev} total={sumArr(data.netRev)} />

            <SpacerRow colSpan={colCount} />

            {/* COGS */}
            <SectionHeader label="Cost of Goods Sold" colSpan={colCount} />
            {data.cogs.map(c => (
              <DataRow key={c.label} label={c.label} values={c.values} total={sumArr(c.values)} />
            ))}
            <SubtotalRow label="Total COGS" values={data.totalCogs} total={sumArr(data.totalCogs)} />

            <SpacerRow colSpan={colCount} />

            {/* Gross Profit */}
            <TotalRow label="Gross Profit" values={data.gp} total={sumArr(data.gp)} />
            <MarginRow label="Gross Margin %" values={data.gp.map((g, i) => data.netRev[i] ? g / data.netRev[i] : 0)} total={sumArr(data.gp) / sumArr(data.netRev)} />

            <SpacerRow colSpan={colCount} />

            {/* OpEx */}
            <SectionHeader label="Operating Expenses" colSpan={colCount} />
            {data.opex.map(c => (
              <DataRow key={c.label} label={c.label} values={c.values} total={sumArr(c.values)} />
            ))}
            <SubtotalRow label="Total Operating Expenses" values={data.totalOpex} total={sumArr(data.totalOpex)} />
            <MarginRow label="OpEx % of Revenue" values={data.totalOpex.map((o, i) => data.netRev[i] ? o / data.netRev[i] : 0)} total={sumArr(data.totalOpex) / sumArr(data.netRev)} />

            <SpacerRow colSpan={colCount} />

            {/* Net Operating Income */}
            <TotalRow label="Net Operating Income" values={data.netOp} total={sumArr(data.netOp)} />
            <MarginRow label="Operating Margin %" values={data.netOp.map((o, i) => data.netRev[i] ? o / data.netRev[i] : 0)} total={sumArr(data.netOp) / sumArr(data.netRev)} />

            <SpacerRow colSpan={colCount} />

            {/* Other Income */}
            <SectionHeader label="Other Income / (Expense)" colSpan={colCount} />
            {data.other.length > 0 ? data.other.map(c => (
              <DataRow key={c.label} label={c.label} values={c.values} total={sumArr(c.values)} />
            )) : (
              <DataRow label="(None)" values={data.cols.map(() => 0)} total={0} />
            )}
            <SubtotalRow label="Total Other Income" values={data.totalOther} total={sumArr(data.totalOther)} />

            <SpacerRow colSpan={colCount} />

            {/* Net Income */}
            <TotalRow label="Net Income" values={data.ni} total={sumArr(data.ni)} double />
            <MarginRow label="Net Margin %" values={data.ni.map((x, i) => data.netRev[i] ? x / data.netRev[i] : 0)} total={sumArr(data.ni) / sumArr(data.netRev)} />
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Source: QuickBooks P&L Export · {isQ1 ? 'Q1 2026 (Jan 1 – Mar 27)' : 'FY 2025 (Jan 1 – Dec 31)'}
      </div>
    </div>
  );
}
