import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

/* ─── palette ─── */
const TXT    = 'var(--text)';
const DIM    = 'var(--text-muted)';
const BG     = 'var(--surface)';
const BORDER = 'var(--border)';
const GREEN  = '#16a34a';
const RED    = '#dc2626';
const BLUE   = '#2D4A5A';
const R      = 12;

const pct  = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

/* ─── Financial Models ─── */
const INITIAL_MODELS = [
  { ticker: 'META',  name: 'Meta Platforms, Inc.',          file: 'META_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 44 },
  { ticker: 'GOOGL', name: 'Alphabet Inc.',                 file: 'GOOGL_Financial_Model.xlsx', updated: 'Q4 2025', quarters: 44 },
  { ticker: 'AMZN',  name: 'Amazon.com, Inc.',              file: 'AMZN_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 44 },
  { ticker: 'PINS',  name: 'Pinterest, Inc.',               file: 'PINS_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 32 },
  { ticker: 'SNAP',  name: 'Snap Inc.',                     file: 'SNAP_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 28 },
  { ticker: 'RDDT',  name: 'Reddit, Inc.',                  file: 'RDDT_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 4 },
  { ticker: 'SHOP',  name: 'Shopify Inc.',                  file: 'SHOP_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 32 },
  { ticker: 'SPOT',  name: 'Spotify Technology S.A.',       file: 'SPOT_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 24 },
  { ticker: 'LYV',   name: 'Live Nation Entertainment',     file: 'LYV_Financial_Model.xlsx',   updated: 'Q4 2025', quarters: 40 },
  { ticker: 'WMG',   name: 'Warner Music Group Corp.',      file: 'WMG_Financial_Model.xlsx',   updated: 'Q4 2025', quarters: 20 },
  { ticker: 'NFLX',  name: 'Netflix, Inc.',                 file: 'NFLX_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 44 },
  { ticker: 'DIS',   name: 'The Walt Disney Company',       file: 'DIS_Financial_Model.xlsx',   updated: 'Q4 2025', quarters: 44 },
  { ticker: 'UBER',  name: 'Uber Technologies, Inc.',       file: 'UBER_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 24 },
  { ticker: 'DASH',  name: 'DoorDash, Inc.',                file: 'DASH_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 16 },
  { ticker: 'LYFT',  name: 'Lyft, Inc.',                    file: 'LYFT_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 24 },
  { ticker: 'CART',  name: 'Instacart (Maplebear Inc.)',    file: 'CART_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 8 },
  { ticker: 'ETSY',  name: 'Etsy, Inc.',                    file: 'ETSY_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 32 },
  { ticker: 'W',     name: 'Wayfair Inc.',                  file: 'W_Financial_Model.xlsx',     updated: 'Q4 2025', quarters: 32 },
  { ticker: 'WSM',   name: 'Williams-Sonoma, Inc.',         file: 'WSM_Financial_Model.xlsx',   updated: 'Q4 2025', quarters: 40 },
  { ticker: 'ROST',  name: 'Ross Stores, Inc.',             file: 'ROST_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 44 },
  { ticker: 'BURL',  name: 'Burlington Stores, Inc.',       file: 'BURL_Financial_Model.xlsx',  updated: 'Q4 2025', quarters: 32 },
  { ticker: 'TJX',   name: 'The TJX Companies, Inc.',       file: 'TJX_Financial_Model.xlsx',   updated: 'Q4 2025', quarters: 44 },
];

/* ─── Idea Backlog ─── */
const IDEA_STORAGE = 'ua_idea_backlog';
function IdeaBacklog() {
  const [ideas, setIdeas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(IDEA_STORAGE) || '[]'); } catch { return []; }
  });
  const [draft, setDraft] = useState({ ticker: '', date: '', thesis: '' });

  const save = (next) => { setIdeas(next); localStorage.setItem(IDEA_STORAGE, JSON.stringify(next)); };

  const addIdea = () => {
    if (!draft.ticker.trim()) return;
    const next = [{ ...draft, id: Date.now(), ticker: draft.ticker.toUpperCase().trim(), date: draft.date || new Date().toISOString().split('T')[0], thesis: draft.thesis.trim() }, ...ideas];
    save(next);
    setDraft({ ticker: '', date: '', thesis: '' });
  };

  const removeIdea = (id) => save(ideas.filter(i => i.id !== id));

  return (
    <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Idea Backlog</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        <input
          value={draft.ticker}
          onChange={e => setDraft(d => ({ ...d, ticker: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && addIdea()}
          placeholder="Ticker"
          style={{
            width: 80, padding: '7px 10px', fontSize: 12, fontWeight: 700,
            border: `1px solid ${BORDER}`, borderRadius: 6, background: 'transparent',
            color: BLUE, textTransform: 'uppercase', letterSpacing: 0.5,
          }}
        />
        <input
          type="date"
          value={draft.date}
          onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
          style={{
            width: 140, padding: '7px 10px', fontSize: 11,
            border: `1px solid ${BORDER}`, borderRadius: 6, background: 'transparent',
            color: TXT,
          }}
        />
        <input
          value={draft.thesis}
          onChange={e => setDraft(d => ({ ...d, thesis: e.target.value }))}
          onKeyDown={e => e.key === 'Enter' && addIdea()}
          placeholder="One-liner thesis..."
          style={{
            flex: 1, padding: '7px 10px', fontSize: 12,
            border: `1px solid ${BORDER}`, borderRadius: 6, background: 'transparent',
            color: TXT,
          }}
        />
        <button
          onClick={addIdea}
          style={{
            padding: '7px 16px', fontSize: 11, fontWeight: 600,
            border: 'none', borderRadius: 6, background: BLUE, color: '#fff',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >Add</button>
      </div>

      {ideas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: DIM }}>No ideas yet — add your first ticker above</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: DIM, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, width: 70 }}>Ticker</th>
              <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: DIM, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5, width: 100 }}>Date</th>
              <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: DIM, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thesis</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {ideas.map(idea => (
              <tr key={idea.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: '8px 8px', fontSize: 13, fontWeight: 700, color: BLUE }}>{idea.ticker}</td>
                <td style={{ padding: '8px 8px', fontSize: 11, color: DIM }}>{idea.date}</td>
                <td style={{ padding: '8px 8px', fontSize: 12, color: TXT }}>{idea.thesis}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                  <button onClick={() => removeIdea(idea.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: DIM, lineHeight: 1, opacity: 0.5 }} title="Remove">&times;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export default function Thesis() {
  const [models, setModels] = useState(INITIAL_MODELS);
  const [quotes, setQuotes] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef(null);

  // Fetch quotes for model tickers
  useEffect(() => {
    const tickers = INITIAL_MODELS.map(m => m.ticker).join(',');
    api.get(`/api/quotes?tickers=${tickers}`).then(r => {
      if (Array.isArray(r.data)) setQuotes(r.data);
    }).catch(() => {});
  }, []);

  // File upload handlers
  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setUploadStatus('error');
      setUploadMsg('Only .xlsx, .xls, and .csv files are supported');
      return;
    }
    setUploadStatus('uploading');
    setUploadMsg(`Uploading ${file.name}...`);

    const formData = new FormData();
    formData.append('model', file);
    try {
      const res = await api.post('/agents/francisco/models/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.model) {
        setModels(prev => [res.data.model, ...prev.filter(m => m.ticker !== res.data.model.ticker)]);
      }
      setUploadStatus('success');
      setUploadMsg(`${file.name} uploaded successfully`);
    } catch (e) {
      setUploadStatus('error');
      setUploadMsg(e.response?.data?.error || 'Upload failed');
    }
    setTimeout(() => { setUploadStatus(null); setUploadMsg(''); }, 4000);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleUpload(file);
  };

  const onFileSelect = (e) => {
    const file = e.target.files?.[0];
    handleUpload(file);
    e.target.value = '';
  };

  return (
    <div className="fade-in">
      <PageHeader title="Thesis" subtitle="PORTFOLIO MANAGEMENT" />

      {/* ═══ Idea Backlog ═══ */}
      <IdeaBacklog />

      {/* ═══ Financial Models Database ═══ */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1 }}>Financial Models</div>
          <span style={{ fontSize: 10, color: DIM }}>{models.length} model{models.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Models grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8, marginBottom: 16 }}>
          {models.map((m, i) => {
            const q = quotes.find(q2 => q2.ticker === m.ticker);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onClick={() => window.open(`/api/agents/francisco/models/${m.file}`, '_blank')}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 6, background: '#217346',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>XL</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BLUE }}>{m.ticker}</span>
                    {q && <span style={{ fontSize: 10, fontWeight: 600, color: q.changePct >= 0 ? GREEN : RED }}>{pct(q.changePct)}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: DIM }}>{m.updated}</div>
                  <div style={{ fontSize: 9, color: DIM }}>{m.quarters}Q</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Upload drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? BLUE : 'var(--border)'}`,
            borderRadius: 10, padding: '24px 20px', textAlign: 'center',
            cursor: 'pointer', transition: 'all 0.15s',
            background: dragOver ? 'rgba(45,74,90,0.04)' : 'transparent',
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFileSelect} />
          {uploadStatus === 'uploading' ? (
            <div style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>{uploadMsg}</div>
          ) : uploadStatus === 'success' ? (
            <div style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>{uploadMsg}</div>
          ) : uploadStatus === 'error' ? (
            <div style={{ fontSize: 12, color: RED, fontWeight: 600 }}>{uploadMsg}</div>
          ) : (
            <>
              <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.4 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TXT, marginBottom: 2 }}>Drop your financial model here</div>
              <div style={{ fontSize: 10, color: DIM }}>Upload .xlsx and Francisco will update it through the most current quarter</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
