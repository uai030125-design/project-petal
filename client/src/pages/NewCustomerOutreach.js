import React, { useState, useEffect } from 'react';
import PageHeader from '../components/shared/PageHeader';

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

export default function NewCustomerOutreach() {
  const [prospects, setProspects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    company: '',
    contactName: '',
    email: '',
    phone: '',
    category: '',
    lastOutreachDate: '',
    status: 'New',
    notes: '',
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('newCustomerProspects');
    if (saved) {
      try {
        setProspects(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to load prospects:', err);
      }
    }
  }, []);

  // Save to localStorage whenever prospects change
  useEffect(() => {
    localStorage.setItem('newCustomerProspects', JSON.stringify(prospects));
  }, [prospects]);

  const handleAddProspect = (e) => {
    e.preventDefault();
    if (!form.company || !form.contactName || !form.category) {
      alert('Please fill in Company, Contact Name, and Category');
      return;
    }
    const newProspect = {
      ...form,
      id: Date.now(),
    };
    setProspects(prev => [...prev, newProspect]);
    setForm({
      company: '',
      contactName: '',
      email: '',
      phone: '',
      category: '',
      lastOutreachDate: '',
      status: 'New',
      notes: '',
    });
    setShowModal(false);
  };

  const handleDeleteProspect = (id) => {
    setProspects(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdateProspect = (id, field, value) => {
    setProspects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const statusColors = {
    'New': '#4A6FA5',         // Blue
    'Contacted': '#7B6B3E',   // Gold/brown
    'Following Up': '#8B4A6B', // Mauve/pink
    'Closed': '#6B8F71',      // Sage green
  };

  return (
    <div className="fade-in">
      <PageHeader title="New Customer Outreach" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowModal(!showModal)}
        >+ Add Prospect</button>
      </div>

      {/* Empty state */}
      {prospects.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300,
          background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
          flexDirection: 'column', gap: 16,
        }}>
          <div style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>No prospects yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Click + Add Prospect to get started.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
          }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Company</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Contact Name</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Email</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Phone</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Category</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Last Outreach</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Notes</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((prospect, idx) => (
                <tr key={prospect.id} style={{ borderBottom: idx !== prospects.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{prospect.company}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-dim)' }}>{prospect.contactName}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>
                    <a href={`mailto:${prospect.email}`} style={{ color: 'var(--accent-dark)', textDecoration: 'none' }}>
                      {prospect.email || '—'}
                    </a>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>
                    <a href={`tel:${prospect.phone}`} style={{ color: 'var(--accent-dark)', textDecoration: 'none' }}>
                      {prospect.phone || '—'}
                    </a>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>{prospect.category}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>{prospect.lastOutreachDate || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                      background: statusColors[prospect.status] || '#999', color: '#fff', borderRadius: 4,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
                      {prospect.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-dim)' }}>{prospect.notes ? prospect.notes.substring(0, 30) + (prospect.notes.length > 30 ? '...' : '') : '—'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteProspect(prospect.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                        fontSize: 14, fontFamily: 'inherit', opacity: 0.6, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
                      title="Delete prospect"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Prospect Modal */}
      {showModal && (
        <Overlay onClose={() => setShowModal(false)}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>Add New Prospect</div>
          <form onSubmit={handleAddProspect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Company *</div>
              <input
                className="input"
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="e.g. Nordstrom"
                required
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Contact Name *</div>
              <input
                className="input"
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="e.g. Jane Smith"
                required
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Email</div>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Phone</div>
              <input
                className="input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Category *</div>
              <input
                className="input"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Scrubs"
                required
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Last Outreach Date</div>
              <input
                className="input"
                type="date"
                value={form.lastOutreachDate}
                onChange={e => setForm(f => ({ ...f, lastOutreachDate: e.target.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Status</div>
              <select
                className="input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Following Up">Following Up</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>Notes</div>
              <textarea
                className="input"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Add any relevant notes..."
                style={{ minHeight: 80, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm">Add Prospect</button>
            </div>
          </form>
        </Overlay>
      )}
    </div>
  );
}
