import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

const CORE_COLORS = ['Black', 'Navy', 'Charcoal', 'Gray'];
const TREND_COLORS = ['Candy Pink', 'Lavender', 'Tarragon', 'Blood Red', 'Wine', 'Hot Pink', 'Royal Blue'];
const ALL_COLORS = [...CORE_COLORS, ...TREND_COLORS];

const COLOR_HEX = {
  'Black': '#1a1a1a', 'Navy': '#001f5c', 'Charcoal': '#36454f', 'Gray': '#808080',
  'Candy Pink': '#e4717a', 'Lavender': '#b57edc', 'Tarragon': '#8b9556',
  'Blood Red': '#8a0303', 'Wine': '#722f37', 'Hot Pink': '#ff69b4', 'Royal Blue': '#4169e1',
};

function fmt(n) { return n ? n.toLocaleString() : '-'; }

function ColorDot({ color }) {
  return <span style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
    background: COLOR_HEX[color] || '#ccc', marginRight: 6, verticalAlign: 'middle',
    border: color === 'Gray' || color === 'Candy Pink' ? '1px solid #aaa' : 'none',
  }} />;
}

export default function ScrubsInventory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('full'); // 'full' | 'victoria'
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [notesText, setNotesText] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await api.get('/scrubs');
      setData(res.data);
      setStatusText(res.data.deal?.status || '');
      setNotesText(res.data.deal?.notes || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDeal() {
    try {
      await api.put('/scrubs/deal', { status: statusText, notes: notesText });
      setEditingStatus(false);
      loadData();
    } catch (e) { alert('Failed to save: ' + e.message); }
  }

  // Victoria's purchase as a flat lookup: { "600288:Wine": 600 }
  const victoriaMap = useMemo(() => {
    const src = data?.victoria_purchase?.items || data?.victoria_selections?.items;
    if (!src) return {};
    const m = {};
    for (const [style, colors] of Object.entries(src)) {
      for (const [color, qty] of Object.entries(colors)) {
        m[`${style}:${color}`] = qty;
      }
    }
    return m;
  }, [data]);

  // Calculate deal value using PO pricing
  const dealValue = useMemo(() => {
    if (!data) return { purchaseUnits: 0, purchaseValue: 0 };
    const poPricing = data.victoria_purchase?.po_pricing || {};
    let purchaseUnits = 0, purchaseValue = 0;
    for (const [key, qty] of Object.entries(victoriaMap)) {
      const style = key.split(':')[0];
      const price = poPricing[style] || data.pricing[style]?.price || 0;
      purchaseUnits += qty;
      purchaseValue += qty * price;
    }
    return { purchaseUnits, purchaseValue };
  }, [data, victoriaMap]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading scrubs inventory...</div>;
  if (error) return <div style={{ padding: 40, color: '#c44' }}>Error: {error}</div>;
  if (!data) return null;

  const allRows = [...(data.inventory.bottoms || []), ...(data.inventory.tops || []), ...(data.inventory.plus || [])];
  const totals = data.inventory.totals || {};

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader title="Scrubs ATS" />
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -16, marginBottom: 20 }}>
        dd's DISCOUNTS Close-Out &mdash; Pro Forma Available to Sell
      </p>

      {/* Deal Status Card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Deal Status</div>
            {editingStatus ? (
              <div>
                <input value={statusText} onChange={e => setStatusText(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginBottom: 8 }} />
                <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={2}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, resize: 'vertical' }} />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={saveDeal} style={btnStyle('#2563eb')}>Save</button>
                  <button onClick={() => setEditingStatus(false)} style={btnStyle('#666')}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#059669', marginBottom: 4, cursor: 'pointer' }}
                  onClick={() => setEditingStatus(true)} title="Click to edit">
                  {data.deal.status}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{data.deal.notes}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <InfoCard label="Customer" value={data.deal.customer} />
            <InfoCard label="Buyer" value={data.deal.buyer} />
            <InfoCard label="Asst. Buyer" value={data.deal.assistant_buyer} />
          </div>
        </div>

        {/* Pricing Summary */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <StatCard label="Remaining ATS" value={fmt(totals.grand_total)} sub="units" />
          <StatCard label="Victoria Purchased" value={fmt(dealValue.purchaseUnits)} sub={`$${(dealValue.purchaseValue/1000).toFixed(1)}K`} color="#059669" />
        </div>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <ToggleBtn active={view === 'full'} onClick={() => setView('full')}>Full ATS Table</ToggleBtn>
        <ToggleBtn active={view === 'victoria'} onClick={() => setView('victoria')}>Victoria's Purchase — Apr 1</ToggleBtn>
      </div>

      {view === 'full' ? (
        <FullATSTable data={data} victoriaMap={victoriaMap} totals={totals} />
      ) : (
        <VictoriaTable data={data} victoriaMap={victoriaMap} />
      )}

      {/* Pricing Reference */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px 20px', marginTop: 24,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Agreed Pricing</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(data.pricing).map(([style, info]) => (
            <div key={style} style={{
              background: 'var(--bg)', borderRadius: 8, padding: '8px 14px',
              fontSize: 13, border: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 600 }}>{style}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>{info.type}</span>
              <span style={{ color: '#059669', fontWeight: 700 }}>${info.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FullATSTable({ data, victoriaMap, totals }) {
  const sections = [
    { label: 'Bottoms', rows: data.inventory.bottoms },
    { label: 'Tops', rows: data.inventory.tops },
    { label: 'Plus', rows: data.inventory.plus },
  ];

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={thStyle}>Style</th>
            <th style={thStyle}>Price</th>
            {CORE_COLORS.map(c => <th key={c} style={{ ...thStyle, background: '#f0f4f8' }}><ColorDot color={c} />{c}</th>)}
            {TREND_COLORS.map(c => <th key={c} style={{ ...thStyle, background: '#fdf2f8' }}><ColorDot color={c} />{c}</th>)}
            <th style={{ ...thStyle, fontWeight: 700 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(sec => (
            <React.Fragment key={sec.label}>
              <tr><td colSpan={ALL_COLORS.length + 3} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 13, background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>{sec.label}</td></tr>
              {sec.rows.map(row => {
                const rowTotal = ALL_COLORS.reduce((s, c) => s + (row[c] || 0), 0);
                const price = data.pricing[row.style]?.price;
                return (
                  <tr key={row.style} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.style}</td>
                    <td style={{ ...tdStyle, color: '#059669', fontWeight: 600 }}>{price ? `$${price.toFixed(2)}` : '-'}</td>
                    {ALL_COLORS.map(c => {
                      const v = row[c] || 0;
                      const isVictoria = victoriaMap[`${row.style}:${c}`] > 0;
                      return (
                        <td key={c} style={{
                          ...tdStyle, textAlign: 'right',
                          background: isVictoria ? '#dcfce7' : (v === 0 ? 'transparent' : undefined),
                          fontWeight: isVictoria ? 700 : 400,
                          color: v === 0 ? '#ccc' : undefined,
                          position: 'relative',
                        }}>
                          {fmt(v)}
                          {isVictoria && <span style={{ position: 'absolute', top: 2, right: 2, fontSize: 8, color: '#059669' }}>V</span>}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(rowTotal)}</td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
          <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--text)' }}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>TOTAL</td>
            <td style={tdStyle}></td>
            {ALL_COLORS.map(c => (
              <td key={c} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(totals[c])}</td>
            ))}
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmt(totals.grand_total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VictoriaTable({ data, victoriaMap }) {
  const purchase = data.victoria_purchase || data.victoria_selections;
  const styles = Object.keys(purchase.items);
  const poPricing = data.victoria_purchase?.po_pricing || {};
  const purchaseDate = data.victoria_purchase?.date || '';
  const formattedDate = purchaseDate ? new Date(purchaseDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div>
      <div style={{
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
        padding: '14px 20px', marginBottom: 16, fontSize: 13,
      }}>
        Victoria purchased <strong>4,960 units</strong> on <strong>{formattedDate}</strong>. Units have been deducted from ATS.
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              <th style={thStyle}>Style</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Cost</th>
              <th style={thStyle}>Color</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Units</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>ATS Remaining</th>
            </tr>
          </thead>
          <tbody>
            {styles.map(style => {
              const colors = purchase.items[style];
              const price = poPricing[style] || data.pricing[style]?.price || 0;
              const type = data.pricing[style]?.type || '';
              const entries = Object.entries(colors);
              return entries.map(([color, qty], i) => {
                // Find remaining ATS for this style/color (already deducted)
                let atsQty = 0;
                for (const cat of ['bottoms', 'tops', 'plus']) {
                  const row = (data.inventory[cat] || []).find(r => r.style === style);
                  if (row) { atsQty = row[color] || 0; break; }
                }
                return (
                  <tr key={`${style}-${color}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    {i === 0 ? <td rowSpan={entries.length} style={{ ...tdStyle, fontWeight: 600, verticalAlign: 'top', borderRight: '1px solid var(--border)' }}>{style}</td> : null}
                    {i === 0 ? <td rowSpan={entries.length} style={{ ...tdStyle, verticalAlign: 'top', borderRight: '1px solid var(--border)', color: 'var(--text-muted)' }}>{type}</td> : null}
                    {i === 0 ? <td rowSpan={entries.length} style={{ ...tdStyle, verticalAlign: 'top', borderRight: '1px solid var(--border)', color: '#059669', fontWeight: 600 }}>${price.toFixed(2)}</td> : null}
                    <td style={tdStyle}><ColorDot color={color} />{color}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(qty)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#059669' }}>${(qty * price).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(atsQty)}</td>
                  </tr>
                );
              });
            })}
            {(() => {
              let totalUnits = 0, totalValue = 0;
              for (const style of styles) {
                const colors = purchase.items[style];
                const price = poPricing[style] || data.pricing[style]?.price || 0;
                for (const [, qty] of Object.entries(colors)) {
                  totalUnits += qty;
                  totalValue += qty * price;
                }
              }
              return (
                <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--text)' }}>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, fontSize: 13 }}>TOTAL</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{fmt(totalUnits)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#059669' }}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td style={tdStyle}></td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 14px', minWidth: 120 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg)', borderRadius: 10, padding: '12px 18px', minWidth: 120,
      borderLeft: color ? `3px solid ${color}` : 'none',
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      border: '1px solid var(--border)',
      background: active ? 'var(--text)' : 'var(--surface)',
      color: active ? 'var(--bg)' : 'var(--text)',
      transition: 'all 0.15s',
    }}>{children}</button>
  );
}

function btnStyle(bg) {
  return {
    padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: 'none', background: bg, color: '#fff',
  };
}

const thStyle = {
  padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)',
  borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '8px 8px', whiteSpace: 'nowrap',
};
