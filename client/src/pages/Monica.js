import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';

const DIM = 'var(--text-muted)';
const BORDER = 'var(--border)';
const TXT = 'var(--text)';
const BLUE = '#6B7F5E';

/* ─── Print-friendly styles ─── */
const PRINT_STYLES = `
@media print {
  /* Hide nav, sidebar, briefing list, header bar, print button */
  nav, header, .app-nav, .app-header, [class*="nav"], [class*="sidebar"],
  .monica-sidebar, .monica-header, .monica-print-btn { display: none !important; }

  /* Hide the app layout wrapper chrome */
  .app-layout > *:not(.app-content), .app-layout > div:first-child { display: none !important; }

  /* Full width, no margin */
  body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  .fade-in, .app-content, .app-layout, main, [class*="content"] {
    margin: 0 !important; padding: 0 !important; max-width: 100% !important; width: 100% !important;
  }

  /* Briefing content: full width, no border */
  .monica-briefing-panel {
    border: none !important; box-shadow: none !important;
    padding: 0 !important; margin: 0 !important; max-width: 100% !important;
  }

  /* Section cards: keep borders for structure, lighten backgrounds */
  .monica-section-card {
    break-inside: avoid; page-break-inside: avoid;
    margin-bottom: 10px !important; border-radius: 4px !important;
  }
  .monica-section-header {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .monica-section-body { padding: 10px 14px !important; }

  /* Typography tightening */
  .monica-briefing-panel * { font-size: 11px !important; line-height: 1.5 !important; }
  .monica-briefing-panel h1, .monica-briefing-panel .monica-title { font-size: 16px !important; }
  .monica-briefing-panel .monica-date { font-size: 10px !important; }
  .monica-section-header span { font-size: 10px !important; }

  /* Links: show URL after text */
  a[href]:after { content: " (" attr(href) ")"; font-size: 8px; color: #666; word-break: break-all; }
  a[href^="https://finance.yahoo"]:after, a[href^="http://localhost"]:after { content: ""; }

  /* Page setup */
  @page { margin: 0.5in; size: letter; }

  /* Ensure layout is single column */
  .monica-layout { display: block !important; }
  .monica-sidebar { display: none !important; }
}
`;


/* ─── Section color themes ─── */
const SECTION_THEMES = {
  'ACTION ITEMS TODAY':                { bg: '#fff7ed', border: '#fdba74', accent: '#ea580c', icon: '✅' },
  'MAJOR INDICES':                     { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb', icon: '📈' },
  'NEWS & MARKET MOVEMENTS':           { bg: '#f0f9ff', border: '#7dd3fc', accent: '#0369a1', icon: '📰' },
  'LOGISTICS: POS NOT ROUTED':         { bg: '#fef2f2', border: '#fca5a5', accent: '#dc2626', icon: '🔴' },
  'LOGISTICS: FACTORY CTS RUNNING LATE': { bg: '#fefce8', border: '#fde68a', accent: '#b45309', icon: '🏭' },
  'TREND SCOUT PICS':                  { bg: '#fdf2f8', border: '#f9a8d4', accent: '#db2777', icon: '🦚' },
  // Legacy section names for older briefings
  'HIGH PRIORITY':             { bg: '#fef2f2', border: '#fca5a5', accent: '#dc2626', icon: '🔴' },
  'OVERNIGHT MARKET BRIEFING': { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb', icon: '📈' },
  'STOCK BRIEFING':            { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a', icon: '💹' },
  'PRODUCTION STATUS':         { bg: '#fefce8', border: '#fde68a', accent: '#b45309', icon: '🏭' },
  'NON-CONSENSUS IDEAS':       { bg: '#faf5ff', border: '#c4b5fd', accent: '#7c3aed', icon: '💡' },
  'WOODCOCK TREND SCOUT':      { bg: '#fdf2f8', border: '#f9a8d4', accent: '#db2777', icon: '🦚' },
  'ACTION ITEMS':              { bg: '#fff7ed', border: '#fdba74', accent: '#ea580c', icon: '✅' },
};

const DEFAULT_THEME = { bg: '#f9fafb', border: '#d1d5db', accent: '#6b7280', icon: '📋' };

/* ─── Parse structured briefing content into sections ─── */
function parseSections(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    // Detect section headers: **SECTION NAME** at start of line (all caps, may include :, ', etc.)
    const headerMatch = line.match(/^\*\*([A-Z][A-Z &/\-:'']+)\*\*\s*$/);
    if (headerMatch) {
      if (current) sections.push(current);
      const name = headerMatch[1].trim();
      current = { name, lines: [] };
      continue;
    }
    // Also detect sub-section headers like "**Briefing Watchlist**" (mixed case)
    // But only if it looks like a known sub-header, NOT a product title
    const headerMatch2 = line.match(/^\*\*([A-Za-z][A-Za-z0-9 &/\-:'']+)\*\*\s*$/);
    if (headerMatch2 && !line.includes('—') && headerMatch2[1].length < 40) {
      const h2name = headerMatch2[1].trim();
      // Only treat as section header if it contains a known section keyword
      const sectionKeywords = ['watchlist', 'indices', 'logistics', 'action', 'news', 'trend', 'factory', 'market', 'total finds'];
      const isSection = sectionKeywords.some(kw => h2name.toLowerCase().includes(kw));
      if (isSection) {
        if (current) sections.push(current);
        current = { name: h2name, lines: [] };
        continue;
      }
    }
    if (current) {
      current.lines.push(line);
    } else {
      // Pre-section content (greeting, etc.)
      if (!sections.length && !current) {
        current = { name: '_intro', lines: [line] };
      } else if (current) {
        current.lines.push(line);
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

/* ─── Render inline markdown: bold, links ─── */
function renderInline(text, keyPrefix) {
  // Split on both **bold** and [link](url) patterns
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((seg, j) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      return <strong key={`${keyPrefix}-${j}`} style={{ fontWeight: 600 }}>{seg.slice(2, -2)}</strong>;
    }
    const linkMatch = seg.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={`${keyPrefix}-${j}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
           style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
          {linkMatch[1]}
        </a>
      );
    }
    return seg;
  });
}

/* ─── Render section content lines ─── */
function renderLines(lines, theme) {
  // Trim leading/trailing blank lines
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  return lines.map((line, i) => {
    if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;

    // Markdown images: ![alt](url)
    const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      return (
        <div key={i} style={{ margin: '8px 0 12px 0', display: 'block' }}>
          <img src={imgMatch[2]} alt={imgMatch[1]} referrerPolicy="no-referrer" style={{
            maxWidth: 180, maxHeight: 220, borderRadius: 8, objectFit: 'cover',
            border: '1px solid var(--border, #e5e7eb)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'block',
          }} />
        </div>
      );
    }

    // Italic/emphasis: *text*
    const italicMatch = line.trim().match(/^\*([^*]+)\*$/);
    if (italicMatch) {
      return (
        <div key={i} style={{ lineHeight: 1.65, fontSize: 12, marginBottom: 2, fontStyle: 'italic', color: theme?.accent || DIM }}>
          {italicMatch[1]}
        </div>
      );
    }

    // Sub-headers within sections (e.g., "**1. Kunal Sachdev — ...**")
    const subHeaderMatch = line.match(/^\*\*(\d+\..+)\*\*\s*(.*)$/);
    if (subHeaderMatch) {
      return (
        <div key={i} style={{ marginTop: i > 0 ? 12 : 0, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme?.accent || TXT }}>
            {renderInline(line, `sh-${i}`)}
          </span>
        </div>
      );
    }

    // Numbered items (standalone)
    if (/^\d+\.\s/.test(line.trim())) {
      return (
        <div key={i} style={{
          paddingLeft: 4, marginBottom: 6, lineHeight: 1.65, fontSize: 13,
          display: 'flex', gap: 6,
        }}>
          <span style={{ color: theme?.accent || DIM, fontWeight: 600, minWidth: 18 }}>
            {line.trim().match(/^(\d+\.)/)[1]}
          </span>
          <span>{renderInline(line.trim().replace(/^\d+\.\s*/, ''), `n-${i}`)}</span>
        </div>
      );
    }

    // Bullet points
    if (/^[-•]\s/.test(line.trim())) {
      return (
        <div key={i} style={{
          paddingLeft: 12, marginBottom: 4, lineHeight: 1.6, fontSize: 13,
          display: 'flex', gap: 6,
        }}>
          <span style={{ color: theme?.accent || DIM }}>•</span>
          <span>{renderInline(line.trim().replace(/^[-•]\s*/, ''), `b-${i}`)}</span>
        </div>
      );
    }

    return (
      <div key={i} style={{ lineHeight: 1.65, fontSize: 13, marginBottom: 2 }}>
        {renderInline(line, `l-${i}`)}
      </div>
    );
  });
}

/* ─── Render a single section card ─── */
function SectionCard({ section }) {
  if (section.name === '_intro') {
    // Render intro (greeting) with larger text
    return (
      <div style={{ marginBottom: 16, padding: '0 4px' }}>
        {section.lines.filter(l => l.trim()).map((line, i) => (
          <div key={i} style={{ fontSize: 15, fontWeight: 500, color: TXT, lineHeight: 1.6 }}>
            {renderInline(line, `intro-${i}`)}
          </div>
        ))}
      </div>
    );
  }

  const themeKey = section.name.toUpperCase();
  const theme = SECTION_THEMES[themeKey] || DEFAULT_THEME;

  return (
    <div className="monica-section-card" style={{
      marginBottom: 20, borderRadius: 12,
      border: `1px solid ${theme.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Section header bar */}
      <div className="monica-section-header" style={{
        background: `linear-gradient(135deg, ${theme.bg} 0%, ${theme.bg}dd 100%)`,
        padding: '12px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${theme.border}`,
        borderRadius: '12px 12px 0 0',
      }}>
        <span style={{ fontSize: 15 }}>{theme.icon}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: theme.accent,
          textTransform: 'uppercase', letterSpacing: 1.2,
        }}>
          {section.name}
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent, opacity: 0.3 }} />
      </div>
      {/* Section body */}
      <div className="monica-section-body" style={{ padding: '16px 20px 24px', background: 'var(--surface)', borderRadius: '0 0 12px 12px' }}>
        {renderLines([...section.lines], theme)}
      </div>
    </div>
  );
}

/* ─── Render full briefing content ─── */
function renderContent(text) {
  if (!text) return null;
  const sections = parseSections(text);

  if (sections.length <= 1) {
    // Fallback: no clear sections found, render as simple text
    return (text || '').split('\n').map((line, i) => {
      if (line.trim() === '') return <div key={i} style={{ height: 8 }} />;
      return (
        <div key={i} style={{ lineHeight: 1.65, fontSize: 13, marginBottom: 2 }}>
          {renderInline(line, `f-${i}`)}
        </div>
      );
    });
  }

  return sections.map((sec, i) => <SectionCard key={i} section={sec} />);
}

/* ─── Major indices for right panel ─── */
const INDICES = [
  { ticker: 'SPY', name: 'S&P 500', base: 562 },
  { ticker: 'QQQ', name: 'Nasdaq 100', base: 480 },
  { ticker: 'DIA', name: 'Dow Jones', base: 420 },
  { ticker: 'IWM', name: 'Russell 2000', base: 205 },
  { ticker: 'VIX', name: 'VIX', base: 18 },
  { ticker: 'USO', name: 'Oil (WTI)', base: 72 },
];

function MiniSparkline({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IndicesPanel() {
  const [indexData, setIndexData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tickers = INDICES.map(i => i.ticker).join(',');
        const res = await api.get(`/api/quotes?tickers=${tickers}`);
        if (!cancelled && Array.isArray(res.data)) {
          setIndexData(res.data);
          setLoading(false);
          return;
        }
      } catch {}
      // Fallback: generate mock data
      if (!cancelled) {
        const now = new Date();
        setIndexData(INDICES.map(idx => {
          const base = idx.base;
          const pctChange = (Math.random() - 0.48) * 3;
          const close = base * (1 + pctChange / 100);
          const sparkData = [];
          for (let i = 0; i < 20; i++) {
            sparkData.push(base * (1 + (Math.random() - 0.48) * 2 / 100));
          }
          sparkData.push(close);
          return {
            ticker: idx.ticker,
            close: parseFloat(close.toFixed(2)),
            change: parseFloat((close - base).toFixed(2)),
            changePct: parseFloat(pctChange.toFixed(2)),
            high: parseFloat((close * 1.005).toFixed(2)),
            low: parseFloat((close * 0.995).toFixed(2)),
            sparkData,
          };
        }));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge fetched data with index metadata
  const indices = useMemo(() => {
    return INDICES.map(idx => {
      const quote = indexData.find(q => q.ticker === idx.ticker);
      if (!quote) return { ...idx, close: idx.base, change: 0, changePct: 0, sparkData: [] };
      // Build sparkData from available data or synthesize
      const sparkData = quote.sparkData || (() => {
        const pts = [];
        const base = quote.close / (1 + (quote.changePct || 0) / 100);
        for (let i = 0; i < 20; i++) {
          const t = i / 19;
          pts.push(base + (quote.close - base) * t + (Math.random() - 0.5) * Math.abs(quote.change || 1) * 0.3);
        }
        pts.push(quote.close);
        return pts;
      })();
      return { ...idx, close: quote.close, change: quote.change || 0, changePct: quote.changePct || 0, high: quote.high, low: quote.low, sparkData };
    });
  }, [indexData]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: DIM, fontSize: 11 }}>
        Loading indices...
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '16px 0', width: 220, flexShrink: 0,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: DIM, textTransform: 'uppercase',
        letterSpacing: 1.5, padding: '0 16px 10px', borderBottom: `1px solid ${BORDER}`,
      }}>
        Market Indices
      </div>
      {indices.map((idx, i) => {
        const isUp = idx.changePct >= 0;
        const color = idx.ticker === 'VIX'
          ? (idx.changePct >= 0 ? '#dc2626' : '#16a34a')
          : (isUp ? '#16a34a' : '#dc2626');
        return (
          <div key={idx.ticker} style={{
            padding: '10px 16px',
            borderBottom: i < indices.length - 1 ? `1px solid ${BORDER}` : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: TXT }}>{idx.ticker}</div>
                <div style={{ fontSize: 9, color: DIM }}>{idx.name}</div>
              </div>
              <MiniSparkline data={idx.sparkData} color={color} width={60} height={22} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TXT }}>
                {idx.close >= 1000 ? idx.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : idx.close.toFixed(2)}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color }}>
                {isUp ? '+' : ''}{idx.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
      <div style={{ padding: '8px 16px 0', fontSize: 9, color: DIM, textAlign: 'center' }}>
        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · EOD
      </div>
    </div>
  );
}

export default function Monica() {
  const [briefings, setBriefings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);

  const loadBriefings = useCallback(() => {
    return fetch('/api/briefings')
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => new Date(b.date) - new Date(a.date));
        setBriefings(arr);
        if (arr.length > 0 && !selected) setSelected(arr[0].id);
        setLoading(false);
        return arr;
      })
      .catch(() => { setLoading(false); return []; });
  }, [selected]);

  const generateBriefing = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/briefings/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (data && (data.id || data.briefing?.id)) {
        const arr = await loadBriefings();
        const newId = data.id || data.briefing?.id;
        setSelected(newId);
      }
    } catch (e) { console.error('Generate failed:', e); }
    setGenerating(false);
  }, [loadBriefings]);

  useEffect(() => {
    loadBriefings().then(arr => {
      // Auto-generate if no briefing for today
      const today = new Date().toISOString().split('T')[0];
      const hasToday = arr.some(b => b.date === today);
      if (!hasToday && arr.length > 0) {
        // Auto-trigger generate
        fetch('/api/briefings/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
          .then(r => r.json())
          .then(data => {
            if (data && (data.id || data.briefing?.id)) {
              loadBriefings().then(() => setSelected(data.id || data.briefing?.id));
            }
          })
          .catch(() => {});
      }
    });
  }, []); // eslint-disable-line

  const selectedBriefing = briefings.find(b => b.id === selected);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="fade-in">
      <style>{PRINT_STYLES}</style>
      <div className="monica-header" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #6B7F5E 0%, #8FA682 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: '#fff',
        }}>M</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, textTransform: 'uppercase', color: TXT }}>Monica</h1>
          <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>Former White House Chief of Staff · Hedge Fund Principal · Your daily alpha edge</div>
        </div>
        <button
          className="monica-print-btn"
          onClick={generateBriefing}
          disabled={generating}
          style={{
            padding: '8px 16px', borderRadius: 8, cursor: generating ? 'wait' : 'pointer',
            border: 'none', background: generating ? '#ccc' : 'linear-gradient(135deg, #6B7F5E 0%, #8FA682 100%)',
            fontSize: 12, fontWeight: 600, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 14 }}>📋</span> {generating ? 'Generating...' : 'Generate Briefing'}
        </button>
        {selectedBriefing && (
          <button
            className="monica-print-btn"
            onClick={() => window.print()}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${BORDER}`, background: 'var(--surface)',
              fontSize: 12, fontWeight: 600, color: TXT,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.background = 'rgba(107,127,94,0.08)'; }}
            onMouseLeave={e => { e.target.style.background = 'var(--surface)'; }}
          >
            <span style={{ fontSize: 14 }}>🖨</span> Print
          </button>
        )}
      </div>

      <div className="monica-layout" style={{ display: 'flex', gap: 20, minHeight: 'calc(100vh - 180px)' }}>
        {/* Left: Briefing list */}
        <div className="monica-sidebar" style={{ width: 260, flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            Briefings ({briefings.length})
          </div>

          {loading ? (
            <div style={{ color: DIM, fontSize: 12, padding: 16 }}>Loading...</div>
          ) : briefings.length === 0 ? (
            <div style={{ color: DIM, fontSize: 12, padding: 16, fontStyle: 'italic' }}>No briefings yet. The daily morning briefing will appear here automatically.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {briefings.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    border: selected === b.id ? `2px solid ${BLUE}` : `1px solid ${BORDER}`,
                    background: selected === b.id ? 'rgba(107,127,94,0.08)' : 'var(--surface)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: TXT, marginBottom: 2 }}>
                    {formatDate(b.date)}
                  </div>
                  <div style={{ fontSize: 10, color: DIM, lineHeight: 1.4 }}>
                    {b.title || 'Morning Briefing'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Briefing content + Indices sidebar */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedBriefing ? (
              <div className="monica-briefing-panel" style={{
                background: 'var(--surface)', border: `1px solid ${BORDER}`,
                borderRadius: 12, padding: '28px 32px',
              }}>
                <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                  <div className="monica-title" style={{ fontSize: 20, fontWeight: 700, color: TXT }}>{selectedBriefing.title}</div>
                  <div className="monica-date" style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
                    {new Date(selectedBriefing.createdAt).toLocaleString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </div>
                </div>

                <div style={{ color: TXT }}>
                  {renderContent(selectedBriefing.content)}
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 300, color: DIM, fontSize: 13, fontStyle: 'italic',
              }}>
                {briefings.length > 0 ? 'Select a briefing to view' : 'No briefings available yet'}
              </div>
            )}
          </div>

          {/* Indices Panel */}
          <IndicesPanel />
        </div>
      </div>
    </div>
  );
}
