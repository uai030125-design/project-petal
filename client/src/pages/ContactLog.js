import React, { useState, useMemo, useEffect } from 'react';
import { BUYER_CARDS } from '../data/crmData';
import { useCRM } from '../context/CRMContext';
import PageHeader from '../components/shared/PageHeader';

const CATEGORY_COLORS = {
  'Scrubs': '#4A6FA5',        // Blue
  'Missy Dresses': '#8B4A6B', // Mauve/pink
  'Caftan': '#7B6B3E',        // Gold/brown
  'Girls Dresses': '#6B8F71', // Sage green
  'Plus': '#9B6B4A',          // Terracotta
  'Accessories': '#5B7B8F',   // Steel blue
};

/* ── Overlay backdrop ── */
const Overlay = ({ children, onClose }) => (
  <div onClick={onClose} style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '28px 32px',
      minWidth: 380, maxWidth: 560, maxHeight: '80vh', overflowY: 'auto',
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
    }}>
      {children}
    </div>
  </div>
);

/* ── Detail popup for email outreach ── */
const EmailPopup = ({ data, onClose }) => (
  <Overlay onClose={onClose}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Last Email Outreach</div>
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data.date || '—'}</span>
    </div>
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subject: </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data.subject || '—'}</span>
    </div>
    {data.summary ? (
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 14, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 6 }}>
        {data.summary}
      </div>
    ) : (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>No email outreach recorded yet.</div>
    )}
    <div style={{ marginTop: 18, textAlign: 'right' }}>
      <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
    </div>
  </Overlay>
);

/* ── Detail popup for showroom visit ── */
const ShowroomPopup = ({ data, onClose }) => (
  <Overlay onClose={onClose}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Last Showroom Visit</div>
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data.date || '—'}</span>
    </div>
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subject: </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data.subject || '—'}</span>
    </div>
    {data.summary ? (
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 14, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 6, whiteSpace: 'pre-line' }}>
        {data.summary}
      </div>
    ) : (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 14 }}>No showroom visits recorded yet.</div>
    )}
    <div style={{ marginTop: 18, textAlign: 'right' }}>
      <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
    </div>
  </Overlay>
);

/* ── Detail popup for last transaction (with editable reads) ── */
const TransactionPopup = ({ data, buyerCompany, readsData, onUpdateReads, onClose }) => {
  const getKey = (style) => `${buyerCompany}::${data.po}::${style}`;

  return (
    <Overlay onClose={onClose}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>Last Transaction</div>
      {data.po ? (
        <>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ship Date: </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{data.shipDate}</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>PO #: </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-dark)' }}>{data.po}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Styles &amp; Reads</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Style</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Qty</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Reads</th>
              </tr>
            </thead>
            <tbody>
              {data.styles.map((s, i) => {
                const key = getKey(s.style);
                const val = readsData[key] || '';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--surface3)' }}>
                    <td style={{ padding: '8px', fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)' }}>{s.style}</td>
                    <td style={{ padding: '8px', fontSize: 12 }}>{s.description}</td>
                    <td style={{ padding: '8px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{s.qty?.toLocaleString()}</td>
                    <td style={{ padding: '8px' }}>
                      <input
                        value={val}
                        onChange={e => onUpdateReads(key, e.target.value)}
                        placeholder="Add buyer feedback..."
                        style={{
                          width: '100%', minWidth: 140, border: '1px solid var(--border)',
                          borderRadius: 4, padding: '5px 8px', fontSize: 12,
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
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Click into the Reads field to add buyer feedback (e.g. sold well, poor, reorder)
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>No transactions on record yet.</div>
      )}
      <div style={{ marginTop: 18, textAlign: 'right' }}>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
    </Overlay>
  );
};

/* ── Detail popup for delivery comments ── */
const DeliveryPopup = ({ delivery, label, onClose }) => (
  <Overlay onClose={onClose}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>{label} Delivery Comments</div>
    <div style={{ marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date: </span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{delivery.date || '—'}</span>
    </div>
    {delivery.summary && (
      <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginTop: 8, marginBottom: 16, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 6 }}>
        {delivery.summary}
      </div>
    )}
    {delivery.styles && delivery.styles.length > 0 && (
      <>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>Styles</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Style</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Color</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Qty</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Cost</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {delivery.styles.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--surface3)' }}>
                <td style={{ padding: '8px', fontSize: 13, fontWeight: 600, color: 'var(--accent-dark)' }}>{s.style}</td>
                <td style={{ padding: '8px', fontSize: 12 }}>{s.color || '—'}</td>
                <td style={{ padding: '8px', fontSize: 12, textAlign: 'right', fontWeight: 600 }}>{s.qty?.toLocaleString()}</td>
                <td style={{ padding: '8px', fontSize: 12 }}>{s.cost || '—'}</td>
                <td style={{ padding: '8px', fontSize: 11, color: 'var(--text-dim)' }}>{s.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
    <div style={{ marginTop: 18, textAlign: 'right' }}>
      <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
    </div>
  </Overlay>
);

/* ── Buyer history panel (shown on card click) ── */
const BuyerHistory = ({ buyer, onOpenPopup }) => {
  const h = buyer.history;
  const linkStyle = {
    fontSize: 12, color: 'var(--accent-dark)', cursor: 'pointer', textDecoration: 'underline',
    fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4,
  };
  const labelStyle = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--surface3)' };

  const deliveryKeys = h.deliveryComments ? Object.keys(h.deliveryComments) : [];

  return (
    <div style={{
      background: 'var(--surface2)', borderRadius: 6, padding: '16px 20px', marginTop: 10,
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
        {buyer.company} ({buyer.division}) — History
      </div>

      {/* Last Email Outreach */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Last Email Outreach</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {h.lastEmail.date ? `${h.lastEmail.date} — ${h.lastEmail.subject}` : 'No outreach yet'}
          </div>
        </div>
        <span style={linkStyle} onClick={() => onOpenPopup('email', buyer)}>
          View &rarr;
        </span>
      </div>

      {/* Last Showroom Visit */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Last Showroom Visit</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {h.lastVisit.date ? `${h.lastVisit.date} — ${h.lastVisit.subject}` : 'No visits yet'}
          </div>
        </div>
        <span style={linkStyle} onClick={() => onOpenPopup('showroom', buyer)}>
          View &rarr;
        </span>
      </div>

      {/* Last Transaction */}
      <div style={rowStyle}>
        <div>
          <div style={labelStyle}>Last Transaction</div>
          {h.lastTransaction.po ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              Shipped {h.lastTransaction.shipDate} — PO <span style={{ fontWeight: 600, color: 'var(--accent-dark)' }}>#{h.lastTransaction.po}</span> ({h.lastTransaction.styles.length} style{h.lastTransaction.styles.length !== 1 ? 's' : ''})
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>No transactions yet</div>
          )}
        </div>
        {h.lastTransaction.po && (
          <span style={linkStyle} onClick={() => onOpenPopup('transaction', buyer)}>
            View &rarr;
          </span>
        )}
      </div>

      {/* Delivery Comments */}
      {deliveryKeys.length > 0 && (
        <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={labelStyle}>Delivery Comments</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {deliveryKeys.map(key => {
              const d = h.deliveryComments[key];
              return (
                <button key={key} onClick={() => onOpenPopup('delivery', buyer, key)}
                  style={{
                    padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-dark)' }}>{key}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.styles?.length || 0} styles</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{d.date}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Main component ── */
/* ── Parse pasted/dropped email text into contact log fields ── */
function parseEmailText(text) {
  const lines = text.split('\n').map(l => l.trim());
  let from = '', date = '', subject = '', body = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^from:/i.test(line)) from = line.replace(/^from:\s*/i, '').trim();
    else if (/^date:/i.test(line)) date = line.replace(/^date:\s*/i, '').trim();
    else if (/^sent:/i.test(line)) date = line.replace(/^sent:\s*/i, '').trim();
    else if (/^subject:/i.test(line)) subject = line.replace(/^subject:\s*/i, '').trim();
    else if (/^to:/i.test(line)) continue; // skip To:
    else if (line === '' && !body && (from || subject)) continue; // skip blank after headers
    else if (from || subject) body += (body ? '\n' : '') + line;
  }

  // If no headers found, treat the whole thing as notes
  if (!from && !subject) {
    body = text.trim();
  }

  // Try to extract a contact name from the From field
  const nameMatch = from.match(/^([^<]+)/);
  const contact = nameMatch ? nameMatch[1].trim() : from;

  // Try to parse date
  let parsedDate = '';
  if (date) {
    try {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString().split('T')[0];
      }
    } catch { /* ignore */ }
  }

  return { contact, date: parsedDate, subject, body: body.trim(), from };
}

export default function ContactLog() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ buyer: '', contact: '', date: '', type: 'Call', notes: '' });
  const [filterBuyer, setFilterBuyer] = useState('');
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' });
  const [expandedBuyer, setExpandedBuyer] = useState(null);
  const [popup, setPopup] = useState(null);
  const { readsData, updateReads } = useCRM();
  const [emailDropText, setEmailDropText] = useState('');
  const [emailParsed, setEmailParsed] = useState(null);

  // Additional buyers added by user this session
  const [customBuyers, setCustomBuyers] = useState([]);
  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ company: '', division: '', buyer: '', currentMonth: '' });

  // Edits overlay on top of static data keyed by cardKey
  const [buyerEdits, setBuyerEdits] = useState({});
  const [editingBuyer, setEditingBuyer] = useState(null); // { key, company, division, buyer, currentMonth }

  // Card filter state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [sortCards, setSortCards] = useState('company'); // 'company' | 'outreach'

  // All buyers = static + custom, with edits applied
  const allBuyers = useMemo(() => {
    const base = [...BUYER_CARDS, ...customBuyers];
    return base.map(b => {
      const key = `${b.company}::${b.division}`;
      const edits = buyerEdits[key];
      if (!edits) return b;
      return { ...b, ...edits };
    });
  }, [customBuyers, buyerEdits]);

  // Derive unique categories and companies
  const categories = useMemo(() => {
    const set = new Set(allBuyers.map(b => b.division));
    return [...set].sort();
  }, [allBuyers]);

  const companies = useMemo(() => {
    const set = new Set(allBuyers.map(b => b.company));
    return [...set].sort();
  }, [allBuyers]);

  const BUYER_NAMES = useMemo(() => {
    const set = new Set(allBuyers.map(b => b.company));
    return [...set].sort();
  }, [allBuyers]);

  // Filter & sort buyer cards
  const displayCards = useMemo(() => {
    let cards = allBuyers;
    if (filterCategory) cards = cards.filter(b => b.division === filterCategory);
    if (filterCompany) cards = cards.filter(b => b.company === filterCompany);

    if (sortCards === 'outreach') {
      cards = [...cards].sort((a, b) => {
        const da = a.history.lastEmail.date || '';
        const db = b.history.lastEmail.date || '';
        return db.localeCompare(da); // most recent first
      });
    } else {
      cards = [...cards].sort((a, b) => a.company.localeCompare(b.company));
    }
    return cards;
  }, [allBuyers, filterCategory, filterCompany, sortCards]);

  const hasActiveCardFilters = filterCategory || filterCompany;

  // Unique key for cards (company may repeat with different divisions)
  const cardKey = (b) => `${b.company}::${b.division}`;

  const handleCardClick = (b) => {
    const key = cardKey(b);
    if (expandedBuyer === key) {
      setExpandedBuyer(null);
    } else {
      setExpandedBuyer(key);
    }
    setFilterBuyer(prev => prev === b.company ? '' : b.company);
  };

  const openPopup = (type, buyer, deliveryKey) => setPopup({ type, buyer, deliveryKey });
  const closePopup = () => setPopup(null);

  const startEdit = (b, e) => {
    e.stopPropagation();
    const key = cardKey(b);
    setEditingBuyer({ key, company: b.company, division: b.division, buyer: b.buyer, currentMonth: b.currentMonth || '' });
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editingBuyer) return;
    setBuyerEdits(prev => ({
      ...prev,
      [editingBuyer.key]: {
        company: editingBuyer.company,
        division: editingBuyer.division,
        buyer: editingBuyer.buyer,
        currentMonth: editingBuyer.currentMonth,
      },
    }));
    setEditingBuyer(null);
  };

  const addEntry = (e) => {
    e.preventDefault();
    if (!form.buyer || !form.contact || !form.date) return;
    setEntries(prev => [...prev, { ...form, id: Date.now() }]);
    setForm({ buyer: '', contact: '', date: '', type: 'Call', notes: '' });
  };

  const deleteEntry = (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const addBuyer = (e) => {
    e.preventDefault();
    if (!newBuyer.company || !newBuyer.division) return;
    setCustomBuyers(prev => [...prev, {
      ...newBuyer,
      history: {
        lastEmail: { date: '', subject: '', summary: '' },
        lastVisit: { date: '', subject: '', summary: '' },
        lastTransaction: { shipDate: '', po: '', styles: [] },
      },
    }]);
    setNewBuyer({ company: '', division: '', buyer: '', currentMonth: '' });
    setShowAddBuyer(false);
  };

  const filtered = entries
    .filter(e => !filterBuyer || e.buyer === filterBuyer)
    .sort((a, b) => {
      const av = a[sort.col] || '';
      const bv = b[sort.col] || '';
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const toggleSort = (col) => {
    setSort(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' }
    );
  };

  const entryCount = (company) => entries.filter(e => e.buyer === company).length;

  const thStyle = { padding: '8px 10px', cursor: 'pointer', userSelect: 'none' };

  // Handle email drop/paste → parse and pre-fill a contact log entry
  const handleEmailDrop = (text) => {
    const parsed = parseEmailText(text);
    setEmailParsed(parsed);
    // Try to match buyer from known companies
    const matchedBuyer = BUYER_NAMES.find(b =>
      parsed.from.toLowerCase().includes(b.toLowerCase()) ||
      parsed.body.toLowerCase().includes(b.toLowerCase()) ||
      parsed.contact.toLowerCase().includes(b.toLowerCase())
    ) || '';
    setForm({
      buyer: matchedBuyer,
      contact: parsed.contact,
      date: parsed.date || new Date().toISOString().split('T')[0],
      type: 'Email',
      notes: parsed.subject ? `[${parsed.subject}] ${parsed.body}` : parsed.body,
    });
    setEmailDropText('');
  };

  /* ── Pull To-Do items tagged "Contact Log" from internal todo list ── */
  const [clTodos, setClTodos] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ua_internal_todos');
      if (raw) {
        const all = JSON.parse(raw);
        setClTodos(all.filter(t => t.page === 'Contact Log' && t.status !== 'Completed'));
      }
    } catch {}
  }, []);

  const toggleClTodo = (id) => {
    try {
      const raw = localStorage.getItem('ua_internal_todos');
      if (!raw) return;
      const all = JSON.parse(raw);
      const updated = all.map(t => t.id === id ? { ...t, status: 'Completed', done: true } : t);
      localStorage.setItem('ua_internal_todos', JSON.stringify(updated));
      setClTodos(updated.filter(t => t.page === 'Contact Log' && t.status !== 'Completed'));
    } catch {}
  };

  return (
    <div className="fade-in">
      <PageHeader title="Contact Log" />

      {/* ── Contact Log To-Dos (from Internal Todo) ── */}
      {clTodos.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            To-Do Items
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clTodos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleClTodo(t.id)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{t.title || t.text}</span>
                {t.done_by && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>Due: {t.done_by}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddBuyer(!showAddBuyer)}
        >{showAddBuyer ? 'Cancel' : '+ Add Buyer'}</button>
      </div>

      {/* Add Buyer form */}
      {showAddBuyer && (
        <form onSubmit={addBuyer} style={{
          display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end',
          padding: '16px 18px', background: 'var(--surface2)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Company *</div>
            <input className="input" style={{ width: 140 }} value={newBuyer.company} onChange={e => setNewBuyer(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Nordstrom" required />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Division / Category *</div>
            <input className="input" style={{ width: 160 }} value={newBuyer.division} onChange={e => setNewBuyer(f => ({ ...f, division: e.target.value }))} placeholder="e.g. Sleepwear" required />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Buyer Name</div>
            <input className="input" style={{ width: 160 }} value={newBuyer.buyer} onChange={e => setNewBuyer(f => ({ ...f, buyer: e.target.value }))} placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Current Month</div>
            <input className="input" style={{ width: 100 }} value={newBuyer.currentMonth} onChange={e => setNewBuyer(f => ({ ...f, currentMonth: e.target.value }))} placeholder="e.g. 6/30" />
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Add Buyer</button>
        </form>
      )}

      {/* Filter bar for cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('')}
            style={{
              padding: '4px 12px', borderRadius: 12, border: '1px solid var(--border)',
              background: !filterCategory ? 'var(--accent-dark)' : 'var(--surface)',
              color: !filterCategory ? '#fff' : 'var(--text-dim)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >All</button>
          {categories.map(c => {
            const color = CATEGORY_COLORS[c] || '#999';
            const active = filterCategory === c;
            return (
              <button key={c}
                onClick={() => setFilterCategory(active ? '' : c)}
                style={{
                  padding: '4px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${active ? color : color + '40'}`,
                  background: active ? color : color + '12',
                  color: active ? '#fff' : color,
                  fontSize: 11, fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >{c}</button>
            );
          })}
        </div>
        <select className="input" style={{ width: 150 }} value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
          <option value="">All Companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Sort:</span>
          <button
            className={`btn btn-sm ${sortCards === 'company' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSortCards('company')}
            style={{ fontSize: 11 }}
          >Company</button>
          <button
            className={`btn btn-sm ${sortCards === 'outreach' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSortCards('outreach')}
            style={{ fontSize: 11 }}
          >Last Outreach</button>
        </div>
        {hasActiveCardFilters && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setFilterCategory(''); setFilterCompany(''); }}
            style={{ fontSize: 11 }}
          >Clear</button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {displayCards.length} buyer{displayCards.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Buyer cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 8,
      }}>
        {displayCards.map(b => {
          const key = cardKey(b);
          const isExpanded = expandedBuyer === key;
          const count = entryCount(b.company);
          const lastOutreach = b.history.lastEmail.date;
          return (
            <div key={key}>
              <div
                onClick={() => handleCardClick(b)}
                style={{
                  background: isExpanded ? 'var(--accent-dim)' : 'var(--surface)',
                  border: isExpanded ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderLeft: `4px solid ${CATEGORY_COLORS[b.division] || '#999'}`,
                  borderRadius: 'var(--radius)',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{b.company}</div>
                  <button
                    onClick={(e) => startEdit(b, e)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit', opacity: 0.6,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
                    title="Edit buyer"
                  >&#9998;</button>
                </div>
                <div style={{ fontSize: 11, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 10,
                    background: (CATEGORY_COLORS[b.division] || '#999') + '1A',
                    color: CATEGORY_COLORS[b.division] || '#999',
                    fontWeight: 600, fontSize: 11, letterSpacing: 0.3,
                    border: `1px solid ${(CATEGORY_COLORS[b.division] || '#999')}40`,
                  }}>{b.division}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Buyer: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{b.buyer || 'TBD'}</span>
                </div>
                {b.currentMonth && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Current Month: <span style={{ color: 'var(--accent-dark)', fontWeight: 600 }}>{b.currentMonth}</span>
                  </div>
                )}
                {lastOutreach && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Last outreach: <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{lastOutreach}</span>
                  </div>
                )}
                {count > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--accent-dark)', fontWeight: 600, marginTop: 4 }}>
                    {count} log{count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded buyer history panel */}
      {expandedBuyer && (() => {
        const buyer = allBuyers.find(b => cardKey(b) === expandedBuyer);
        if (!buyer) return null;
        return (
          <div style={{ marginBottom: 24 }}>
            <BuyerHistory buyer={buyer} onOpenPopup={openPopup} />
          </div>
        );
      })()}

      {!expandedBuyer && <div style={{ marginBottom: 24 }} />}

      {/* Popup modals */}
      {popup && popup.type === 'email' && (
        <EmailPopup data={popup.buyer.history.lastEmail} onClose={closePopup} />
      )}
      {popup && popup.type === 'showroom' && (
        <ShowroomPopup data={popup.buyer.history.lastVisit} onClose={closePopup} />
      )}
      {popup && popup.type === 'transaction' && (
        <TransactionPopup
          data={popup.buyer.history.lastTransaction}
          buyerCompany={popup.buyer.company}
          readsData={readsData}
          onUpdateReads={(k, v) => updateReads(k, v)}
          onClose={closePopup}
        />
      )}
      {popup && popup.type === 'delivery' && popup.buyer.history.deliveryComments && (
        <DeliveryPopup
          delivery={popup.buyer.history.deliveryComments[popup.deliveryKey]}
          label={popup.deliveryKey}
          onClose={closePopup}
        />
      )}

      {/* Filter indicator */}
      {filterBuyer && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setFilterBuyer(''); setExpandedBuyer(null); }}
          >Clear filter</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Viewing: {filterBuyer}
          </span>
        </div>
      )}

      {/* Edit buyer modal */}
      {editingBuyer && (
        <Overlay onClose={() => setEditingBuyer(null)}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>Edit Buyer</div>
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Company</div>
              <input className="input" value={editingBuyer.company} onChange={e => setEditingBuyer(f => ({ ...f, company: e.target.value }))} required />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Division / Category</div>
              <input className="input" value={editingBuyer.division} onChange={e => setEditingBuyer(f => ({ ...f, division: e.target.value }))} required />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Buyer Name</div>
              <input className="input" value={editingBuyer.buyer} onChange={e => setEditingBuyer(f => ({ ...f, buyer: e.target.value }))} placeholder="e.g. Jane Smith" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Current Month</div>
              <input className="input" value={editingBuyer.currentMonth} onChange={e => setEditingBuyer(f => ({ ...f, currentMonth: e.target.value }))} placeholder="e.g. 6/30" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingBuyer(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
            </div>
          </form>
        </Overlay>
      )}
    </div>
  );
}
