import React, { useState, useMemo } from 'react';
import {
  Mail,
  MailOpen,
  Star,
  Send,
  Search,
  Clock,
  ChevronDown,
  ChevronRight,
  Paperclip,
  AlertCircle,
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import { useToast } from '../components/shared/Toast';

// Email data — populated by Gmail integration
const SAMPLE_EMAILS = [];

const FILTERS = ['All', 'Buyers', 'Vendors', 'Internal', 'Follow-up Required'];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tagColor(tag) {
  if (tag === 'Buyer' || tag === 'Payment') return 'badge-success';
  if (tag === 'Vendor' || tag === 'Production' || tag === 'ETA') return 'badge-blue';
  if (tag === 'Follow-up Required' || tag === 'Issue') return 'badge-warning';
  if (tag === 'Internal' || tag === 'Finance') return 'badge-neutral';
  return 'badge-neutral';
}

export default function EmailHub() {
  const toast = useToast();
  const [emails, setEmails] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ua_email_state'));
      if (saved) {
        return SAMPLE_EMAILS.map(e => ({
          ...e,
          starred: saved.starred?.includes(e.id) || false,
          unread: saved.read?.includes(e.id) ? false : e.unread,
        }));
      }
    } catch { /* ignore */ }
    return SAMPLE_EMAILS;
  });
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' });

  // Persist state
  const saveState = (updated) => {
    try {
      localStorage.setItem('ua_email_state', JSON.stringify({
        starred: updated.filter(e => e.starred).map(e => e.id),
        read: updated.filter(e => !e.unread).map(e => e.id),
      }));
    } catch { /* ignore */ }
  };

  const toggleStar = (id) => {
    const updated = emails.map(e => e.id === id ? { ...e, starred: !e.starred } : e);
    setEmails(updated);
    saveState(updated);
  };

  const markRead = (id) => {
    const updated = emails.map(e => e.id === id ? { ...e, unread: false } : e);
    setEmails(updated);
    saveState(updated);
  };

  const handleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      markRead(id);
    }
  };

  const filteredEmails = useMemo(() => {
    let list = emails;
    if (filter === 'Buyers') list = list.filter(e => e.type === 'buyer');
    else if (filter === 'Vendors') list = list.filter(e => e.type === 'vendor');
    else if (filter === 'Internal') list = list.filter(e => e.type === 'internal');
    else if (filter === 'Follow-up Required') list = list.filter(e => e.tags.includes('Follow-up Required'));
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(e =>
        e.sender.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [emails, filter, searchTerm]);

  // Stats
  const unreadCount = emails.filter(e => e.unread).length;
  const followUpCount = emails.filter(e => e.tags.includes('Follow-up Required')).length;
  const buyerCount = emails.filter(e => e.type === 'buyer').length;
  const vendorCount = emails.filter(e => e.type === 'vendor').length;

  return (
    <div className="fade-in">
      <PageHeader title="John Anthony">
        <button className="btn btn-primary btn-sm" onClick={() => setComposing(!composing)}>
          <Send size={14} /> Compose
        </button>
      </PageHeader>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }} className="stagger-in">
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <div className="stat-label">Total Threads</div>
          <div className="stat-value">{emails.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <div className="stat-label">Unread</div>
          <div className="stat-value" style={{ color: unreadCount > 0 ? 'var(--danger)' : 'var(--text)' }}>{unreadCount}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <div className="stat-label">Follow-ups Due</div>
          <div className="stat-value" style={{ color: followUpCount > 0 ? 'var(--warning)' : 'var(--text)' }}>{followUpCount}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <div className="stat-label">Buyers / Vendors</div>
          <div className="stat-value">{buyerCount} / {vendorCount}</div>
        </div>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 36, width: '100%' }}
            placeholder="Search emails..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-pills">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-pill ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      {composing && (
        <div className="card" style={{ marginBottom: 24, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={16} /> New Email
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="input"
              placeholder="To"
              value={draft.to}
              onChange={e => setDraft(d => ({ ...d, to: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Subject"
              value={draft.subject}
              onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
            />
            <textarea
              className="input"
              style={{ minHeight: 100, resize: 'vertical' }}
              placeholder="Write your message..."
              value={draft.body}
              onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setComposing(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                toast.success('Draft saved');
                setComposing(false);
                setDraft({ to: '', subject: '', body: '' });
              }}>
                <Paperclip size={14} /> Save Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredEmails.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Mail size={32} strokeWidth={1.5} style={{ margin: '0 auto 12px' }} />
            <div>{emails.length === 0 ? 'Nothing available.' : 'No emails match your filter.'}</div>
          </div>
        ) : (
          filteredEmails.map(email => (
            <div key={email.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              transition: 'all 0.15s',
              marginBottom: 4,
            }}>
              {/* Thread row */}
              <div
                onClick={() => handleExpand(email.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer',
                  background: email.unread ? 'var(--accent-dim)' : 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!email.unread) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (!email.unread) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Star */}
                <button
                  onClick={e => { e.stopPropagation(); toggleStar(email.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: email.starred ? '#f59e0b' : 'var(--border)', transition: 'color 0.15s' }}
                >
                  <Star size={16} fill={email.starred ? '#f59e0b' : 'none'} />
                </button>

                {/* Unread dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: email.unread ? 'var(--accent)' : 'transparent' }} />

                {/* Icon */}
                {email.unread ? <Mail size={16} color="var(--accent)" /> : <MailOpen size={16} color="var(--text-muted)" />}

                {/* Sender */}
                <div style={{ width: 140, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: email.unread ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.sender}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.email}
                  </div>
                </div>

                {/* Subject + preview */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: email.unread ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {email.subject}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email.preview}
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {email.tags.slice(0, 2).map(tag => (
                    <span key={tag} className={`badge ${tagColor(tag)}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Date */}
                <div style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(email.date)}</span>
                </div>

                {/* Expand icon */}
                {expandedId === email.id ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
              </div>

              {/* Expanded content */}
              {expandedId === email.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{email.sender}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>&lt;{email.email}&gt;</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(email.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {email.tags.includes('Follow-up Required') && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
                        background: 'rgba(196,154,64,0.08)', border: '1px solid rgba(196,154,64,0.2)',
                      }}>
                        <AlertCircle size={14} color="var(--warning)" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Follow-up required</span>
                      </div>
                    )}
                    <div style={{
                      fontSize: 14, color: 'var(--text)', lineHeight: 1.7,
                      whiteSpace: 'pre-wrap', padding: '12px 16px',
                      background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
                    }}>
                      {email.body}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                      {email.tags.map(tag => (
                        <span key={tag} className={`badge ${tagColor(tag)}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>
        Showing {filteredEmails.length} of {emails.length} threads
      </div>
    </div>
  );
}
