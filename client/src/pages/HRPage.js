import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../utils/api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const TIME_OFF_TYPES = [
  { key: 'vacation', label: 'Vacation', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  { key: 'sick', label: 'Sick Day', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' },
  { key: 'personal', label: 'Personal', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  { key: 'holiday', label: 'Holiday', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  { key: 'bereavement', label: 'Bereavement', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { key: 'jury', label: 'Jury Duty', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
];

const typeMap = {};
TIME_OFF_TYPES.forEach(t => { typeMap[t.key] = t; });

export default function HRPage() {
  const [tab, setTab] = useState('timeoff');
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  // timeOff: { "memberId-monthIdx": { days: number, type: string } }
  const [timeOff, setTimeOff] = useState({});
  const [popup, setPopup] = useState(null); // { memberId, monthIdx, rect }
  const [popupDays, setPopupDays] = useState(1);
  const [popupType, setPopupType] = useState('vacation');
  const popupRef = useRef(null);

  // Current month index (0-based) to split historical vs anticipated
  const currentMonthIdx = new Date().getMonth(); // 0 = Jan, 11 = Dec

  useEffect(() => {
    api.get('/team')
      .then(res => {
        const seen = new Set();
        const unique = res.data.filter(m => {
          if (seen.has(m.full_name)) return false;
          seen.add(m.full_name);
          return true;
        });
        setTeam(unique);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Close popup on outside click
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) setPopup(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  const openPopup = (memberId, monthIdx, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const existing = timeOff[`${memberId}-${monthIdx}`];
    setPopupDays(existing ? existing.days : 1);
    setPopupType(existing ? existing.type : 'vacation');
    setPopup({ memberId, monthIdx, rect });
  };

  const savePopup = () => {
    if (!popup) return;
    const key = `${popup.memberId}-${popup.monthIdx}`;
    if (popupDays > 0) {
      setTimeOff(prev => ({ ...prev, [key]: { days: popupDays, type: popupType } }));
    } else {
      setTimeOff(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setPopup(null);
  };

  const clearPopup = () => {
    if (!popup) return;
    const key = `${popup.memberId}-${popup.monthIdx}`;
    setTimeOff(prev => { const n = { ...prev }; delete n[key]; return n; });
    setPopup(null);
  };

  const getVal = (memberId, monthIdx) => {
    return timeOff[`${memberId}-${monthIdx}`] || null; // { days, type } or null
  };

  const rowTotal = (memberId, start, end) => {
    let sum = 0;
    for (let m = start; m < end; m++) {
      const v = timeOff[`${memberId}-${m}`];
      if (v) sum += v.days || 0;
    }
    return sum;
  };

  const colTotal = (monthIdx) => {
    let sum = 0;
    team.forEach(t => {
      const v = timeOff[`${t.id}-${monthIdx}`];
      if (v) sum += v.days || 0;
    });
    return sum;
  };

  const grandTotal = useMemo(() => {
    let sum = 0;
    Object.values(timeOff).forEach(v => {
      if (v && v.days) sum += v.days;
    });
    return sum;
  }, [timeOff]);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>;

  const historicalMonths = MONTHS.slice(0, currentMonthIdx);
  const anticipatedMonths = MONTHS.slice(currentMonthIdx);

  const sectionHeaderStyle = (color) => ({
    padding: '6px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 1.2, color,
    borderBottom: '2px solid ' + color,
  });

  const inputCell = (memberId, monthIdx, isAnticipated) => {
    const val = getVal(memberId, monthIdx);
    const t = val ? typeMap[val.type] : null;
    return (
      <td key={MONTHS[monthIdx]} style={{ padding: '4px 3px', textAlign: 'center' }}>
        <div
          onClick={(e) => openPopup(memberId, monthIdx, e)}
          style={{
            width: 44, height: 34, margin: '0 auto', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)', borderRadius: 6,
            cursor: 'pointer', transition: 'all 0.15s', fontSize: 13, fontWeight: 600,
            background: val ? (t?.bg || 'var(--surface2)') : 'var(--surface)',
            color: val ? (t?.color || 'var(--text)') : 'var(--text-muted)',
            borderColor: val ? (t?.color || 'var(--border)') : 'var(--border)',
          }}
          title={val ? `${val.days}d ${t?.label || val.type}` : 'Click to add time off'}
        >
          {val ? val.days : '—'}
        </div>
      </td>
    );
  };

  return (
    <div className="fade-in">
      <div className="section-header">
        <div className="section-title">Time Off</div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 3, marginBottom: 24, width: 'fit-content' }}>
        <button
          onClick={() => setTab('timeoff')}
          style={{
            padding: '7px 18px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            background: tab === 'timeoff' ? 'var(--accent)' : 'transparent',
            color: tab === 'timeoff' ? '#fff' : 'var(--text-dim)',
          }}
        >Time Off Calculator</button>
      </div>

      {tab === 'timeoff' && (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', minWidth: 1000 }}>
            <thead>
              {/* Section labels row */}
              <tr>
                <th style={{ padding: '0', width: 160, position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 3, borderBottom: 'none' }} />
                {historicalMonths.length > 0 && (
                  <th colSpan={historicalMonths.length} style={{ ...sectionHeaderStyle('var(--text-muted)'), borderBottom: '2px solid var(--text-muted)' }}>
                    Historical
                  </th>
                )}
                <th style={{ width: 3, padding: 0, background: 'var(--surface2)', borderBottom: 'none' }} />
                <th colSpan={anticipatedMonths.length} style={{ ...sectionHeaderStyle('var(--blue)'), borderBottom: '2px solid var(--blue)' }}>
                  Anticipated
                </th>
                <th style={{ width: 56, padding: 0, background: 'var(--surface2)', borderBottom: 'none' }} />
                <th style={{ width: 56, padding: 0, background: 'var(--surface2)', borderBottom: 'none' }} />
                <th style={{ width: 64, padding: 0, background: 'var(--surface2)', borderBottom: 'none' }} />
              </tr>
              {/* Month headers row */}
              <tr>
                <th style={{ padding: '10px 12px', width: 160, position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 3 }}>Employee</th>
                {historicalMonths.map(m => (
                  <th key={m} style={{ padding: '10px 6px', textAlign: 'center', width: 56 }}>{m}</th>
                ))}
                <th style={{ width: 3, padding: 0, background: 'var(--border)' }} />
                {anticipatedMonths.map(m => (
                  <th key={m} style={{ padding: '10px 6px', textAlign: 'center', width: 56 }}>{m}</th>
                ))}
                <th style={{ padding: '10px 6px', textAlign: 'center', width: 56, fontSize: 10, color: 'var(--text-muted)' }}>Hist.</th>
                <th style={{ padding: '10px 6px', textAlign: 'center', width: 56, fontSize: 10, color: 'var(--blue)' }}>Ant.</th>
                <th style={{ padding: '10px 10px', textAlign: 'center', width: 64, fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {team.map(member => {
                const histTotal = rowTotal(member.id, 0, currentMonthIdx);
                const antTotal = rowTotal(member.id, currentMonthIdx, 12);
                const total = histTotal + antTotal;
                return (
                  <tr key={member.id}>
                    <td style={{
                      padding: '8px 12px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                      position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1,
                      borderRight: '1px solid var(--border)',
                    }}>
                      <div>{member.full_name}</div>
                      <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{member.title}</div>
                    </td>
                    {historicalMonths.map((_, idx) => inputCell(member.id, idx, false))}
                    <td style={{ width: 3, padding: 0, background: 'var(--border)' }} />
                    {anticipatedMonths.map((_, idx) => inputCell(member.id, currentMonthIdx + idx, true))}
                    <td style={{
                      padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 13,
                      color: histTotal > 0 ? 'var(--text-dim)' : 'var(--text-muted)',
                    }}>
                      {histTotal || '—'}
                    </td>
                    <td style={{
                      padding: '8px 6px', textAlign: 'center', fontWeight: 600, fontSize: 13,
                      color: antTotal > 0 ? 'var(--blue)' : 'var(--text-muted)',
                    }}>
                      {antTotal || '—'}
                    </td>
                    <td style={{
                      padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: 14,
                      color: total > 0 ? 'var(--accent-dark)' : 'var(--text-muted)',
                    }}>
                      {total || '—'}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td style={{
                  padding: '10px 12px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase',
                  letterSpacing: 1, color: 'var(--text-muted)',
                  position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 1,
                  borderRight: '1px solid var(--border)',
                }}>
                  Team Total
                </td>
                {historicalMonths.map((m, idx) => (
                  <td key={m} style={{
                    padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 13,
                    background: 'var(--surface2)',
                    color: colTotal(idx) > 0 ? 'var(--accent-dark)' : 'var(--text-muted)',
                  }}>
                    {colTotal(idx) || '—'}
                  </td>
                ))}
                <td style={{ width: 3, padding: 0, background: 'var(--border)' }} />
                {anticipatedMonths.map((m, idx) => (
                  <td key={m} style={{
                    padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 13,
                    background: 'var(--surface2)',
                    color: colTotal(currentMonthIdx + idx) > 0 ? 'var(--blue)' : 'var(--text-muted)',
                  }}>
                    {colTotal(currentMonthIdx + idx) || '—'}
                  </td>
                ))}
                <td style={{
                  padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 13,
                  background: 'var(--surface2)', color: 'var(--text-muted)',
                }}>
                  {(() => { let s = 0; for (let i = 0; i < currentMonthIdx; i++) s += colTotal(i); return s || '—'; })()}
                </td>
                <td style={{
                  padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontSize: 13,
                  background: 'var(--surface2)', color: 'var(--blue)',
                }}>
                  {(() => { let s = 0; for (let i = currentMonthIdx; i < 12; i++) s += colTotal(i); return s || '—'; })()}
                </td>
                <td style={{
                  padding: '10px 10px', textAlign: 'center', fontWeight: 700, fontSize: 14,
                  background: 'var(--surface2)',
                  color: grandTotal > 0 ? 'var(--accent-dark)' : 'var(--text-muted)',
                }}>
                  {grandTotal || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Time-Off Type Popup ── */}
      {popup && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.25)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div ref={popupRef} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '24px 28px', width: 320,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Add Time Off
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18 }}>
              {team.find(t => t.id === popup.memberId)?.full_name} — {MONTHS[popup.monthIdx]}
            </div>

            {/* Type selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Type
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TIME_OFF_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setPopupType(t.key)}
                    style={{
                      padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      border: popupType === t.key ? `2px solid ${t.color}` : '2px solid var(--border)',
                      background: popupType === t.key ? t.bg : 'var(--surface)',
                      color: popupType === t.key ? t.color : 'var(--text-dim)',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Days */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Number of Days
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => setPopupDays(d => Math.max(0, d - 1))}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface2)', cursor: 'pointer', fontSize: 16, fontWeight: 700,
                    color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >−</button>
                <input
                  type="number"
                  min="0" max="31"
                  value={popupDays}
                  onChange={e => setPopupDays(Math.max(0, Math.min(31, parseInt(e.target.value) || 0)))}
                  style={{
                    width: 56, padding: '6px 4px', textAlign: 'center', fontSize: 18, fontWeight: 700,
                    border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)',
                    color: 'var(--text)', fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button
                  onClick={() => setPopupDays(d => Math.min(31, d + 1))}
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--surface2)', cursor: 'pointer', fontSize: 16, fontWeight: 700,
                    color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >+</button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={savePopup}
                style={{
                  flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Save
              </button>
              <button
                onClick={clearPopup}
                style={{
                  padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'none', color: '#dc2626', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setPopup(null)}
                style={{
                  padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'none', color: 'var(--text-muted)', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
