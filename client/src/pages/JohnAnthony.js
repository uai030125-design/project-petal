import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { BUYER_CARDS } from '../data/crmData';

/* ── Colors & Constants ── */
const ACCENT = '#3C1A00';
const ACCENT_LIGHT = '#F5F0E8';
const CARD_BG = 'var(--surface)';
const BORDER = 'var(--border)';

/* ── Helpers ── */
const fmt = d => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const dayDiff = d => {
  if (!d) return Infinity;
  const dt = new Date(d);
  if (isNaN(dt)) return Infinity;
  return Math.ceil((dt - new Date()) / 86400000);
};

/* ── Section Card Wrapper ── */
function QuadCard({ title, subtitle, icon, children, action }) {
  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: `1px solid ${BORDER}`,
        background: '#5C3D2E',
        borderRadius: 'var(--radius) var(--radius) 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 16px' }}>
        {children}
      </div>
    </div>
  );
}

/* ── Row Item ── */
function ListRow({ left, right, sub, highlight, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 0',
        borderBottom: `1px solid ${BORDER}`,
        cursor: onClick ? 'pointer' : 'default',
        background: hovered && onClick ? 'rgba(60,26,0,0.03)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: highlight ? '#c00' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{left}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {right && <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 12 }}>{right}</div>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {text}
    </div>
  );
}

/* ─── QUADRANT A: TO-DO LIST ─── */
function TodoQuadrant() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');

  /* Load from localStorage */
  useEffect(() => {
    const saved = localStorage.getItem('ja_weekly_todos');
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch (e) {
        setTodos([]);
      }
    }
  }, []);

  /* Persist to localStorage */
  useEffect(() => {
    localStorage.setItem('ja_weekly_todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = useCallback(() => {
    if (inputValue.trim()) {
      setTodos(prev => [...prev, {
        id: Date.now(),
        text: inputValue.trim(),
        status: 'To Do', // 'To Do' | 'In Progress' | 'Complete'
      }]);
      setInputValue('');
    }
  }, [inputValue]);

  const updateTodo = useCallback((id, status) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, []);

  const deleteTodo = useCallback((id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const completedCount = useMemo(() => todos.filter(t => t.status === 'Complete').length, [todos]);
  const progressPct = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  const getStatusColor = (status) => {
    if (status === 'Complete') return '#ccc';
    if (status === 'In Progress') return '#ffc107';
    return 'var(--text)';
  };

  return (
    <QuadCard
      title="Agent"
      subtitle={`${todos.length} tasks`}
      icon="✓"
    >
      {/* Progress Bar */}
      {todos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Progress</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progressPct}%</span>
          </div>
          <div style={{
            height: 6,
            background: 'var(--border)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: '#4caf50',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Add Task Input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Add a task..."
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && addTodo()}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: 12,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={addTodo}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>

      {/* Task List */}
      {todos.length === 0 ? (
        <EmptyState text="No tasks yet. Add one to get started!" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todos.map(todo => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: 6,
                opacity: todo.status === 'Complete' ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={todo.status === 'Complete'}
                onChange={e => updateTodo(todo.id, e.target.checked ? 'Complete' : 'To Do')}
                style={{ cursor: 'pointer', width: 16, height: 16 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  color: getStatusColor(todo.status),
                  textDecoration: todo.status === 'Complete' ? 'line-through' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {todo.text}
                </div>
              </div>
              <select
                value={todo.status}
                onChange={e => updateTodo(todo.id, e.target.value)}
                style={{
                  fontSize: 11,
                  padding: '4px 6px',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Complete">Complete</option>
              </select>
              <button
                onClick={() => deleteTodo(todo.id)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  background: 'transparent',
                  color: '#999',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </QuadCard>
  );
}

/* ─── QUADRANT B: OUTREACH ─── */
function OutreachQuadrant() {
  const [outreach, setOutreach] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    company: '',
    buyer: '',
    type: 'Call',
    notes: '',
  });

  /* Load from localStorage */
  useEffect(() => {
    const saved = localStorage.getItem('ja_weekly_outreach');
    if (saved) {
      try {
        setOutreach(JSON.parse(saved));
      } catch (e) {
        setOutreach([]);
      }
    }
  }, []);

  /* Persist to localStorage */
  useEffect(() => {
    localStorage.setItem('ja_weekly_outreach', JSON.stringify(outreach));
  }, [outreach]);

  const addOutreach = useCallback(() => {
    if (formData.company.trim() && formData.buyer.trim()) {
      setOutreach(prev => [...prev, {
        id: Date.now(),
        company: formData.company.trim(),
        buyer: formData.buyer.trim(),
        date: new Date().toISOString().split('T')[0],
        type: formData.type,
        notes: formData.notes.trim(),
      }]);
      setFormData({ company: '', buyer: '', type: 'Call', notes: '' });
      setShowForm(false);
    }
  }, [formData]);

  const filtered = outreach;

  return (
    <QuadCard
      title="Outreach"
      subtitle={`${outreach.length} contacts`}
      icon="📨"
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 600,
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      }
    >
      {/* Add Form */}
      {showForm && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 6,
          marginBottom: 12,
        }}>
          <input
            type="text"
            placeholder="Company"
            value={formData.company}
            onChange={e => setFormData({ ...formData, company: e.target.value })}
            style={{
              padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
              borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <input
            type="text"
            placeholder="Buyer Name"
            value={formData.buyer}
            onChange={e => setFormData({ ...formData, buyer: e.target.value })}
            style={{
              padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
              borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <select
            value={formData.type}
            onChange={e => setFormData({ ...formData, type: e.target.value })}
            style={{
              padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
              borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
            }}
          >
            <option value="Call">Call</option>
            <option value="Email">Email</option>
            <option value="Visit">Visit</option>
          </select>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            style={{
              padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
              borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={addOutreach}
              style={{
                flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                background: 'transparent', color: ACCENT, border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState text="No contacts this week" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(o => (
            <div
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {o.company} — {o.buyer}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {o.type} • {fmt(o.date)} {o.notes && `• ${o.notes}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </QuadCard>
  );
}

/* ─── QUADRANT C: LINE SHEETS ─── */
function LineSheetsQuadrant() {
  const lineSheets = useMemo(() => {
    // Mock data for line sheet categories
    return [
      { id: 1, category: 'Scrubs', styleCount: 12, lastUpdated: '2026-03-24' },
      { id: 2, category: 'Caftans', styleCount: 8, lastUpdated: '2026-03-22' },
    ];
  }, []);

  return (
    <QuadCard
      title="Showroom"
      subtitle={`${lineSheets.length} categories`}
      icon="📋"
      action={
        <Link to="/crm/line-sheets" style={{
          fontSize: 11, color: ACCENT, textDecoration: 'none', fontWeight: 600,
        }}>View All →</Link>
      }
    >
      {lineSheets.length === 0 ? (
        <EmptyState text="No active line sheets" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineSheets.map(ls => (
            <div
              key={ls.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {ls.category}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {ls.styleCount} styles • Updated {fmt(ls.lastUpdated)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{
                    padding: '4px 8px', fontSize: 10, fontWeight: 600,
                    background: ACCENT, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  View PDF
                </button>
                <button
                  style={{
                    padding: '4px 8px', fontSize: 10, fontWeight: 600,
                    background: 'transparent', color: ACCENT, border: `1px solid ${BORDER}`, borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </QuadCard>
  );
}

/* ─── QUADRANT D: OPEN ORDERS ─── */
function OpenOrdersQuadrant() {
  const orders = useMemo(() => {
    // Derive open orders from BUYER_CARDS
    const items = [];
    for (const card of BUYER_CARDS) {
      const tx = card.history.lastTransaction;
      if (!tx || !tx.po) continue;
      items.push({
        id: `${card.company}-${tx.po}`,
        po: tx.po,
        customer: card.company,
        shipDate: tx.shipDate,
        styleCount: tx.styles.length,
        totalUnits: tx.styles.reduce((s, st) => s + (st.qty || 0), 0),
        status: dayDiff(tx.shipDate) <= 14 ? 'Urgent' : 'On Track',
      });
    }
    return items.sort((a, b) => new Date(a.shipDate) - new Date(b.shipDate));
  }, []);

  const totalUnits = useMemo(() => orders.reduce((s, o) => s + o.totalUnits, 0), [orders]);
  const urgentCount = useMemo(() => orders.filter(o => o.status === 'Urgent').length, [orders]);

  return (
    <QuadCard
      title="Agent"
      subtitle={`${orders.length} orders`}
      icon="📦"
    >
      {/* Summary */}
      {orders.length > 0 && urgentCount > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 12,
          padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 6,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Urgent (≤14d)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#c00', marginTop: 4 }}>
              {urgentCount}
            </div>
          </div>
        </div>
      )}

      {/* Order List */}
      {orders.length === 0 ? (
        <EmptyState text="No open orders" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orders.map(o => (
            <div
              key={o.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6,
                borderLeft: `3px solid ${o.status === 'Urgent' ? '#c00' : '#4caf50'}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {o.po} — {o.customer}
                </div>
                <div style={{
                  fontSize: 11, color: o.status === 'Urgent' ? '#c00' : 'var(--text-muted)', marginTop: 2,
                }}>
                  {o.styleCount} styles • Ship {fmt(o.shipDate)}
                </div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px',
                background: o.status === 'Urgent' ? '#ffebee' : '#e8f5e9',
                color: o.status === 'Urgent' ? '#c00' : '#4caf50', borderRadius: 3,
              }}>
                {o.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </QuadCard>
  );
}

/* ─── QUADRANT E: ATS (AVAILABLE TO SELL) ─── */
function ATSQuadrant() {
  const [atsItems, setAtsItems] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('ja_ats_items');
    if (saved) {
      try { setAtsItems(JSON.parse(saved)); } catch { setAtsItems([]); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ja_ats_items', JSON.stringify(atsItems));
  }, [atsItems]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ style: '', units: '', warehouse: '' });

  const addItem = useCallback(() => {
    if (formData.style.trim() && formData.units) {
      setAtsItems(prev => [...prev, {
        id: Date.now(),
        style: formData.style.trim(),
        units: parseInt(formData.units) || 0,
        warehouse: formData.warehouse.trim() || '—',
        addedDate: new Date().toISOString().split('T')[0],
      }]);
      setFormData({ style: '', units: '', warehouse: '' });
      setShowForm(false);
    }
  }, [formData]);

  const removeItem = useCallback((id) => {
    setAtsItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const totalUnits = useMemo(() => atsItems.reduce((s, i) => s + i.units, 0), [atsItems]);

  return (
    <QuadCard
      title="ATS"
      subtitle={`${atsItems.length} styles · ${totalUnits.toLocaleString()} units`}
      icon="📊"
      action={
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
          }}
        >
          + Add
        </button>
      }
    >
      {showForm && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 12, background: 'rgba(0,0,0,0.02)', borderRadius: 6, marginBottom: 12,
        }}>
          <input type="text" placeholder="Style #" value={formData.style}
            onChange={e => setFormData({ ...formData, style: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <input type="number" placeholder="Units Available" value={formData.units}
            onChange={e => setFormData({ ...formData, units: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <input type="text" placeholder="Warehouse (optional)" value={formData.warehouse}
            onChange={e => setFormData({ ...formData, warehouse: e.target.value })}
            style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addItem} style={{ flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 600, background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: 600, background: 'transparent', color: ACCENT, border: `1px solid ${BORDER}`, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {atsItems.length === 0 ? (
        <EmptyState text="No ATS inventory yet" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {atsItems.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: 6,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.style}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {item.units.toLocaleString()} units · {item.warehouse} · Added {fmt(item.addedDate)}
                </div>
              </div>
              <button onClick={() => removeItem(item.id)} style={{
                padding: '2px 8px', fontSize: 11, background: 'transparent', color: '#999',
                border: 'none', cursor: 'pointer', fontWeight: 600,
              }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </QuadCard>
  );
}

/* ═══════════════════════════════════════════════
   JOHN ANTHONY — CRM Agent Dashboard
   ═══════════════════════════════════════════════ */
export default function JohnAnthony() {
  const now = new Date();
  const weekLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ padding: '28px 32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Arial, Helvetica, sans-serif', color: ACCENT, margin: 0 }}>John Anthony</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Week of {weekLabel}</div>
        </div>
        <Link to="/crm/contact-log" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 18px', borderRadius: 8,
          background: ACCENT, color: '#fff', fontSize: 12, fontWeight: 600,
          textDecoration: 'none', transition: 'opacity 0.15s',
        }}>
          Open Contact Log
          <span style={{ fontSize: 14 }}>{'\u2192'}</span>
        </Link>
      </div>

      {/* ── Sales Section ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, color: ACCENT, textTransform: 'uppercase',
          letterSpacing: 1.5, marginBottom: 14, paddingBottom: 8,
          borderBottom: `2px solid ${ACCENT}`,
        }}>
          Sales
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
        }}>
          <TodoQuadrant />
          <OutreachQuadrant />
        </div>
      </div>

      {/* ── Showroom Section ── */}
      <div>
        <div style={{
          fontSize: 16, fontWeight: 700, color: ACCENT, textTransform: 'uppercase',
          letterSpacing: 1.5, marginBottom: 14, paddingBottom: 8,
          borderBottom: `2px solid ${ACCENT}`,
        }}>
          Showroom
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 20,
        }}>
          <OpenOrdersQuadrant />
          <LineSheetsQuadrant />
          <ATSQuadrant />
        </div>
      </div>
    </div>
  );
}
