import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import PageHeader from '../components/shared/PageHeader';

/* ─── minimal palette ─── */
const TXT      = 'var(--text)';
const DIM      = 'var(--text-muted)';
const BG       = 'var(--surface)';
const BORDER   = 'var(--border)';
const GREEN    = '#16a34a';
const RED      = '#dc2626';
const BLUE     = '#2D4A5A';
const R        = 12;

/* ─── helpers ─── */
const pct  = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
const usd  = v => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtV = v => (v / 1e6).toFixed(1) + 'M';

/* ─── TMT / Consumer / Retail tickers ─── */
const TICKERS = [
  'META','GOOGL','AMZN','PINS','SNAP','RDDT','SHOP','SPOT',
  'LYV','WMG','NFLX','DIS','UBER','DASH','LYFT','CART',
  'ETSY','W','WSM','ROST','BURL','TJX','MDB','QQQ','SPY','V',
];

const RISK_REWARD = [
  { ticker: 'META',  low: 440, high: 680, rr: '1:2.2' },
  { ticker: 'GOOGL', low: 130, high: 195, rr: '1:2.5' },
  { ticker: 'AMZN',  low: 160, high: 235, rr: '1:2.8' },
  { ticker: 'PINS',  low: 28,  high: 48,  rr: '1:2.9' },
  { ticker: 'SNAP',  low: 9,   high: 18,  rr: '1:3.5' },
  { ticker: 'RDDT',  low: 110, high: 200, rr: '1:2.4' },
  { ticker: 'SHOP',  low: 65,  high: 115, rr: '1:2.6' },
  { ticker: 'SPOT',  low: 420, high: 650, rr: '1:2.1' },
  { ticker: 'LYV',   low: 95,  high: 140, rr: '1:2.0' },
  { ticker: 'WMG',   low: 28,  high: 42,  rr: '1:1.8' },
  { ticker: 'NFLX',  low: 550, high: 850, rr: '1:2.0' },
  { ticker: 'DIS',   low: 85,  high: 135, rr: '1:2.2' },
  { ticker: 'UBER',  low: 60,  high: 95,  rr: '1:2.3' },
  { ticker: 'DASH',  low: 140, high: 220, rr: '1:2.4' },
  { ticker: 'LYFT',  low: 12,  high: 22,  rr: '1:3.0' },
  { ticker: 'CART',  low: 30,  high: 52,  rr: '1:2.7' },
  { ticker: 'ETSY',  low: 48,  high: 85,  rr: '1:2.5' },
  { ticker: 'W',     low: 30,  high: 65,  rr: '1:3.2' },
  { ticker: 'WSM',   low: 250, high: 400, rr: '1:2.0' },
  { ticker: 'ROST',  low: 140, high: 195, rr: '1:1.9' },
  { ticker: 'BURL',  low: 200, high: 310, rr: '1:2.1' },
  { ticker: 'TJX',   low: 105, high: 145, rr: '1:1.8' },
];

const CATALYSTS = [
  { date: '2026-03-26', ticker: 'SNAP',  event: 'Investor day' },
  { date: '2026-04-02', ticker: 'UBER',  event: 'Mobility summit keynote' },
  { date: '2026-04-10', ticker: 'CART',  event: 'Q1 earnings' },
  { date: '2026-04-15', ticker: 'NFLX',  event: 'Q1 earnings' },
  { date: '2026-04-17', ticker: 'GOOGL', event: 'Q1 earnings' },
  { date: '2026-04-22', ticker: 'SPOT',  event: 'Q1 earnings' },
  { date: '2026-04-23', ticker: 'META',  event: 'Q1 earnings' },
  { date: '2026-04-24', ticker: 'AMZN',  event: 'Q1 earnings' },
  { date: '2026-04-29', ticker: 'PINS',  event: 'Q1 earnings' },
  { date: '2026-04-29', ticker: 'SNAP',  event: 'Q1 earnings' },
  { date: '2026-04-30', ticker: 'DASH',  event: 'Q1 earnings' },
  { date: '2026-04-30', ticker: 'ETSY',  event: 'Q1 earnings' },
  { date: '2026-05-01', ticker: 'SHOP',  event: 'Q1 earnings' },
  { date: '2026-05-01', ticker: 'W',     event: 'Q1 earnings' },
  { date: '2026-05-06', ticker: 'UBER',  event: 'Q1 earnings' },
  { date: '2026-05-06', ticker: 'LYFT',  event: 'Q1 earnings' },
  { date: '2026-05-07', ticker: 'DIS',   event: 'Q2 earnings' },
  { date: '2026-05-08', ticker: 'RDDT',  event: 'Q1 earnings' },
  { date: '2026-05-15', ticker: 'WMG',   event: 'Q2 earnings' },
  { date: '2026-05-22', ticker: 'ROST',  event: 'Q1 earnings' },
  { date: '2026-05-22', ticker: 'TJX',   event: 'Q1 earnings' },
  { date: '2026-05-29', ticker: 'BURL',  event: 'Q1 earnings' },
  { date: '2026-05-29', ticker: 'WSM',   event: 'Q1 earnings' },
  { date: '2026-06-04', ticker: 'LYV',   event: 'Summer concert outlook' },
];

/* ─── risk bar ─── */
function RiskBar({ low, high, current }) {
  const mn = low * 0.9, mx = high * 1.05, sp = mx - mn;
  const l = ((low - mn) / sp) * 100, h = ((high - mn) / sp) * 100;
  const c = current ? Math.min(100, Math.max(0, ((current - mn) / sp) * 100)) : null;
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, width: '100%' }}>
      <div style={{ position: 'absolute', left: `${l}%`, width: `${h - l}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #facc15 40%, #22c55e)', borderRadius: 3, opacity: 0.55 }} />
      {c !== null && <div style={{ position: 'absolute', left: `${c}%`, top: -3, width: 2, height: 12, background: TXT, borderRadius: 1 }} />}
    </div>
  );
}

/* ─── macro series generator ─── */
function genSeries(base, vol, trend, n) {
  const d = []; let v = base; const now = new Date();
  for (let i = n; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    v += trend + (Math.random() - 0.45) * vol;
    d.push({ m: dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), v: +v.toFixed(2) });
  }
  return d;
}

/* ─── fed rate data ─── */
const FED = [
  { mtg: 'Mar 26', hold: 82, c25: 15, c50: 3 },
  { mtg: 'May 26', hold: 55, c25: 35, c50: 10 },
  { mtg: 'Jun 26', hold: 30, c25: 48, c50: 22 },
  { mtg: 'Jul 26', hold: 20, c25: 42, c50: 38 },
  { mtg: 'Sep 26', hold: 12, c25: 35, c50: 53 },
  { mtg: 'Nov 26', hold: 8,  c25: 30, c50: 62 },
];

/* ─── mini area chart ─── */
function MiniChart({ data, label, unit = '', color = '#6366f1' }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.v), mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const W = 280, H = 70, st = W / (data.length - 1);
  const pts = vals.map((v, i) => `${i * st},${H - ((v - mn) / rng) * (H - 8) - 4}`);
  const up = vals[vals.length - 1] >= vals[0];
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: up ? GREEN : RED }}>{unit}{vals[vals.length - 1].toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id={`g-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M0,${H} L${pts.join(' L')} L${W},${H} Z`} fill={`url(#g-${label.replace(/\s/g, '')})`} />
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ─── FRED economic chart ─── */
function FredChart({ title, data, color = '#2D4A5A', unit = '', onRefresh, isLoading = false }) {
  if (isLoading) {
    return (
      <div style={{ padding: '14px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, marginBottom: 10, minHeight: 180 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', marginBottom: 12 }}>
          {title}
          <button onClick={onRefresh} style={{ float: 'right', padding: '2px 6px', fontSize: 8, background: 'transparent', border: 'none', color: BLUE, cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: DIM, fontSize: 11 }}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length < 2) {
    return (
      <div style={{ padding: '14px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, marginBottom: 10, minHeight: 180 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', marginBottom: 12 }}>
          {title}
          <button onClick={onRefresh} style={{ float: 'right', padding: '2px 6px', fontSize: 8, background: 'transparent', border: 'none', color: BLUE, cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: RED, fontSize: 11 }}>Data unavailable</div>
      </div>
    );
  }

  const rawVals = data.map(d => parseFloat(d.value) || 0).filter(v => !isNaN(v));
  if (rawVals.length < 2) {
    return (
      <div style={{ padding: '14px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, marginBottom: 10, minHeight: 180 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', marginBottom: 12 }}>
          {title}
          <button onClick={onRefresh} style={{ float: 'right', padding: '2px 6px', fontSize: 8, background: 'transparent', border: 'none', color: BLUE, cursor: 'pointer' }}>Refresh</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, color: RED, fontSize: 11 }}>Data unavailable</div>
      </div>
    );
  }

  // For Y/Y titles, compute year-over-year % change using 12-month offset
  const isYoY = title.toLowerCase().includes('y/y');
  let vals, displayVal;
  if (isYoY && rawVals.length >= 13) {
    vals = [];
    for (let i = 12; i < rawVals.length; i++) {
      vals.push(rawVals[i - 12] !== 0 ? ((rawVals[i] - rawVals[i - 12]) / rawVals[i - 12]) * 100 : 0);
    }
    displayVal = vals[vals.length - 1];
  } else {
    vals = rawVals;
    displayVal = vals[vals.length - 1];
  }

  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rng = mx - mn || 1;
  const W = 250;
  const H = 100;
  const st = W / (vals.length - 1);
  const pts = vals.map((v, i) => `${i * st},${H - ((v - mn) / rng) * (H - 12) - 6}`);
  const latest = displayVal;
  const prev = vals.length >= 2 ? vals[vals.length - 2] : vals[0];
  const isPositive = latest >= prev;
  const color_val = isPositive ? GREEN : RED;

  // X-axis labels: show first, middle, and last date
  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const midIdx = Math.floor(data.length / 2);
  const midDate = new Date(data[midIdx].date);

  return (
    <div style={{ padding: '14px 12px', background: BG, border: `1px solid ${BORDER}`, borderRadius: 6, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase' }}>{title}</div>
        <button onClick={onRefresh} style={{ padding: '2px 6px', fontSize: 8, background: 'transparent', border: 'none', color: BLUE, cursor: 'pointer' }}>Refresh</button>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color_val, marginBottom: 8 }}>
        {isYoY ? (latest >= 0 ? '+' : '') + latest.toFixed(1) + '%' : unit === '$' ? '$' + latest.toFixed(2) : latest >= 1000 ? Math.round(latest).toLocaleString() : latest.toFixed(2)}{!isYoY && unit && unit !== '$' ? unit : ''}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto', marginBottom: 6 }}>
        {/* Light gridlines */}
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={BORDER} strokeWidth="0.5" opacity="0.3" />
        {/* Chart area */}
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: DIM }}>
        <span>{firstDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
        <span>{lastDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
      </div>
    </div>
  );
}

/* ─── sector tickers ─── */
const SECTORS = [
  { ticker: 'SPX', name: 'S&P 500', label: 'Benchmark' },
  { ticker: 'XLK', name: 'Technology', label: 'Tech' },
  { ticker: 'XLC', name: 'Communication Svcs', label: 'Comms' },
  { ticker: 'XLY', name: 'Consumer Disc', label: 'Discretionary' },
  { ticker: 'XLP', name: 'Consumer Staples', label: 'Staples' },
  { ticker: 'XLF', name: 'Financials', label: 'Financials' },
  { ticker: 'XLV', name: 'Healthcare', label: 'Healthcare' },
  { ticker: 'XLE', name: 'Energy', label: 'Energy' },
  { ticker: 'XLI', name: 'Industrials', label: 'Industrials' },
  { ticker: 'XLRE', name: 'Real Estate', label: 'Real Estate' },
  { ticker: 'XLU', name: 'Utilities', label: 'Utilities' },
  { ticker: 'XLB', name: 'Materials', label: 'Materials' },
];

/* ─── default portfolios ─── */
const defaultPortfolios = {
  'UA | Merrill': [
    { ticker: 'MDB', mark: 281.00, shares: 765 },
    { ticker: 'META', mark: 614.00, shares: 520 },
    { ticker: 'QQQ', mark: 570.00, shares: 87 },
    { ticker: 'SPOT', mark: 476.00, shares: 411 },
    { ticker: 'V', mark: 335.00, shares: 596 },
    { ticker: 'TJX', mark: 145.00, shares: 257 },
    { ticker: 'SPY', mark: 562.00, shares: 791 },
    { ticker: 'CASH', mark: 1.00, shares: 444508, isCash: true },
  ],
  'Shirish | E-Trade': [
    { ticker: 'SPOT', mark: 500.00, shares: 40 },
    { ticker: 'PINS', mark: 32.00, shares: 200 },
    { ticker: 'SHOP', mark: 75.00, shares: 120 },
    { ticker: 'RDDT', mark: 130.00, shares: 80 },
  ],
  'Gurdeep | Fidelity': [
    { ticker: 'DIS', mark: 100.00, shares: 150 },
    { ticker: 'UBER', mark: 65.00, shares: 100 },
    { ticker: 'LYV', mark: 105.00, shares: 60 },
    { ticker: 'DASH', mark: 160.00, shares: 45 },
  ],
};

/* ════════════════════════════════════════════
   THOMAS — TMT / Consumer Daily Briefing
   ════════════════════════════════════════════ */
export default function PortfolioManagement() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [sectorQuotes, setSectorQuotes] = useState([]);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [briefingWatchlist, setBriefingWatchlist] = useState([]);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [portfolios, setPortfolios] = useState(defaultPortfolios);
  const [activePortfolio, setActivePortfolio] = useState('UA | Merrill');

  const [retail]   = useState(() => genSeries(580, 12, 2.1, 18));
  const [homes]    = useState(() => genSeries(660, 25, 1.5, 18));
  const [cpi]      = useState(() => genSeries(3.1, 0.15, -0.03, 18));

  /* ─── FRED Economic Data ─── */
  const [fredData, setFredData] = useState({
    rsxfs: null,
    icsa: null,
    cpiaucsl: null,
    ppiaco: null,
    ces0500000003: null,
  });
  const [fredLoading, setFredLoading] = useState(true);

  // Load briefing watchlist
  useEffect(() => {
    api.get('/agents/francisco/watchlist').then(res => {
      if (Array.isArray(res.data)) setBriefingWatchlist(res.data);
    }).catch(() => {
      setBriefingWatchlist(['BURL','ROST','TJX','META','AMZN','W','WSM','ETSY']);
    });
  }, []);

  const addToWatchlist = useCallback((ticker) => {
    const t = ticker.trim().toUpperCase();
    if (!t || briefingWatchlist.includes(t)) return;
    const updated = [...briefingWatchlist, t];
    setBriefingWatchlist(updated);
    api.put('/agents/francisco/watchlist', { tickers: updated }).catch(() => {});
  }, [briefingWatchlist]);

  const removeFromWatchlist = useCallback((ticker) => {
    const updated = briefingWatchlist.filter(t => t !== ticker);
    setBriefingWatchlist(updated);
    api.put('/agents/francisco/watchlist', { tickers: updated }).catch(() => {});
  }, [briefingWatchlist]);

  /* sort handler */
  const handleSort = useCallback((field) => {
    setSortField(prev => {
      if (prev === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return field; }
      setSortDir(field === 'ticker' ? 'asc' : 'desc');
      return field;
    });
  }, []);

  const sortedQuotes = useMemo(() => {
    if (!quotes.length) return [];
    const arr = [...quotes];
    arr.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [quotes, sortField, sortDir]);

  const sortArrow = useCallback((field) => sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '', [sortField, sortDir]);

  /* Portfolio handlers */
  const updatePortfolioPosition = useCallback((portfolioName, index, field, value) => {
    setPortfolios(prev => {
      const updated = { ...prev };
      const positions = [...updated[portfolioName]];
      positions[index] = { ...positions[index], [field]: field === 'shares' ? parseInt(value) || 0 : parseFloat(value) || 0 };
      updated[portfolioName] = positions;
      return updated;
    });
  }, []);

  const getPortfolioWithPrices = useCallback(() => {
    const portfolio = portfolios[activePortfolio] || [];
    const positions = portfolio.map(pos => {
      if (pos.isCash) {
        const val = pos.shares; // shares field holds the cash amount
        return { ...pos, currentPrice: 1, costBasis: val, purchaseValue: val, marketValue: val, unrealizedGain: 0, unrealizedGainPct: 0 };
      }
      const quote = quotes.find(q => q.ticker === pos.ticker);
      const currentPrice = quote?.close || pos.mark;
      const costBasis = pos.mark * pos.shares;
      const purchaseValue = costBasis;
      const marketValue = currentPrice * pos.shares;
      const unrealizedGain = marketValue - costBasis;
      const unrealizedGainPct = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;
      return { ...pos, currentPrice, costBasis, purchaseValue, marketValue, unrealizedGain, unrealizedGainPct };
    });
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    return positions.map(p => ({ ...p, pctOfPortfolio: totalMarketValue > 0 ? (p.marketValue / totalMarketValue) * 100 : 0 }));
  }, [portfolios, activePortfolio, quotes]);

  const handleUpdatePrices = useCallback(() => {
    // Force re-render by updating portfolio state
    setPortfolios(prev => ({ ...prev }));
  }, []);

  /* Generate fallback mock quote */
  const generateMockQuote = useCallback((ticker, base) => {
    const b = base || 200;
    const cl = b + (Math.random() - 0.5) * b * 0.04;
    const pr = b + (Math.random() - 0.5) * b * 0.02;
    return { ticker, close: +cl.toFixed(2), change: +(cl-pr).toFixed(2), changePct: +((cl-pr)/pr*100).toFixed(2), high: +(cl*1.012).toFixed(2), low: +(cl*0.988).toFixed(2), volume: Math.floor(2e7+Math.random()*6e7) };
  }, []);

  /* Generate fallback mock sector quote */
  const generateMockSectorQuote = useCallback((ticker, name, label, base) => {
    const b = base || 100;
    const cl = b + (Math.random() - 0.5) * b * 0.025;
    const pr = b + (Math.random() - 0.5) * b * 0.01;
    return { ticker, name, label, close: +cl.toFixed(2), change: +(cl-pr).toFixed(2), changePct: +((cl-pr)/pr*100).toFixed(2), high: +(cl*1.008).toFixed(2), low: +(cl*0.992).toFixed(2), volume: Math.floor(5e7+Math.random()*2e8) };
  }, []);

  /* EOD quotes */
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        // Try to fetch real data from API
        const tickerString = TICKERS.join(',');
        const r = await api.get(`/api/quotes?tickers=${tickerString}`);
        if (!c && Array.isArray(r.data)) {
          setQuotes(r.data);
          setLoading(false);

          // Fetch sector/index quotes in parallel
          try {
            const sectorTickerString = SECTORS.map(s => s.ticker).join(',');
            const sr = await api.get(`/api/quotes?tickers=${sectorTickerString}`);
            if (!c && Array.isArray(sr.data)) {
              // Merge sector data with names and labels
              const sectorWithNames = sr.data.map(s => {
                const info = SECTORS.find(sec => sec.ticker === s.ticker);
                return { ...s, name: info?.name || '', label: info?.label || '' };
              });
              setSectorQuotes(sectorWithNames);
            }
          } catch (sErr) {
            console.warn('Sector quotes fetch failed, using fallback:', sErr.message);
            // Fallback for sectors
            const sBases = { SPX:5280,XLK:210,XLC:85,XLY:188,XLP:80,XLF:42,XLV:148,XLE:88,XLI:120,XLRE:42,XLU:72,XLB:85 };
            setSectorQuotes(SECTORS.map(s => generateMockSectorQuote(s.ticker, s.name, s.label, sBases[s.ticker])));
          }
          return;
        }
      } catch (err) {
        console.warn('Real quotes fetch failed, using fallback:', err.message);
      }

      if (!c) {
        // Fallback: generate mock data
        const bases = { META:560,GOOGL:168,AMZN:198,PINS:38,SNAP:14,RDDT:155,SHOP:88,SPOT:540,LYV:118,WMG:34,NFLX:720,DIS:112,UBER:78,DASH:185,LYFT:17,CART:42,ETSY:62,W:48,WSM:330,ROST:168,BURL:260,TJX:125 };
        setQuotes(TICKERS.map(t => generateMockQuote(t, bases[t])));

        const sBases = { SPX:5280,XLK:210,XLC:85,XLY:188,XLP:80,XLF:42,XLV:148,XLE:88,XLI:120,XLRE:42,XLU:72,XLB:85 };
        setSectorQuotes(SECTORS.map(s => generateMockSectorQuote(s.ticker, s.name, s.label, sBases[s.ticker])));

        setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [generateMockQuote, generateMockSectorQuote]);

  /* News */
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const r = await api.get('/agents/francisco/news');
        if (!c && Array.isArray(r.data) && r.data.length) { setNews(r.data); setNewsLoading(false); return; }
      } catch {}
      if (!c) {
        setNews([
          { title:'Fed signals patience on rate cuts amid sticky inflation', src:'Reuters', time:'2h', sent:'bearish', tags:['Macro'] },
          { title:'Meta AI ad tools drive 20% revenue lift in early tests', src:'TechCrunch', time:'3h', sent:'bullish', tags:['META','AdTech'] },
          { title:'Pinterest launches AI-powered shopping lens, GMV surges', src:'Bloomberg', time:'3h', sent:'bullish', tags:['PINS','E-comm'] },
          { title:'Retail sales beat expectations, up 0.8% in February', src:'CNBC', time:'4h', sent:'bullish', tags:['Consumer','TJX','ROST'] },
          { title:'Snap AR glasses see enterprise adoption, B2B pivot gains traction', src:'The Verge', time:'4h', sent:'bullish', tags:['SNAP','AR'] },
          { title:'Reddit ad revenue tops $1B annual run rate for first time', src:'WSJ', time:'5h', sent:'bullish', tags:['RDDT','AdTech'] },
          { title:'Spotify hits 680M MAUs, podcast ad revenue up 35%', src:'Billboard', time:'5h', sent:'bullish', tags:['SPOT','Audio'] },
          { title:'Disney+ reaches 180M global subs, ad tier growing fast', src:'Variety', time:'6h', sent:'bullish', tags:['DIS','Streaming'] },
          { title:'DoorDash expands grocery to 15 new markets, takes share from Instacart', src:'CNBC', time:'6h', sent:'mixed', tags:['DASH','CART'] },
          { title:'Uber launches autonomous rides in 3 new cities with Waymo', src:'TechCrunch', time:'7h', sent:'bullish', tags:['UBER','AV'] },
          { title:'Burlington and TJX both raise guidance on off-price demand surge', src:'Barrons', time:'8h', sent:'bullish', tags:['BURL','TJX','Retail'] },
          { title:'Wayfair sees home furnishing rebound as housing activity picks up', src:'MarketWatch', time:'9h', sent:'bullish', tags:['W','Housing'] },
          { title:'Netflix password-sharing crackdown adds 8M subs in Q1', src:'Bloomberg', time:'9h', sent:'bullish', tags:['NFLX','Streaming'] },
          { title:'Live Nation summer concert pre-sales hit record levels', src:'Billboard', time:'10h', sent:'bullish', tags:['LYV','Events'] },
          { title:'Google DeepMind breakthrough boosts Alphabet AI narrative', src:'Nature', time:'11h', sent:'bullish', tags:['GOOGL','AI'] },
          { title:'Shopify launches AI commerce assistant for merchants', src:'TechCrunch', time:'11h', sent:'bullish', tags:['SHOP','E-comm'] },
        ]);
        setNewsLoading(false);
      }
    })();
    return () => { c = true; };
  }, []);

  /* ─── FRED Economic Data Fetching (static JSON fallback) ─── */
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        // Try live FRED API first, fall back to static JSON
        const FRED_KEY = '0ca4a1d4c47ee8eff03e2b9d9263ac6e';
        const fredSeries = {
          rsxfs: 'RSXFS', icsa: 'ICSA', cpiaucsl: 'CPIAUCSL',
          ppiaco: 'PPIACO', ces0500000003: 'CES0500000003',
        };
        let results = {};
        let liveSuccess = false;
        try {
          const testRes = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=ICSA&api_key=${FRED_KEY}&file_type=json&limit=3&sort_order=desc`);
          if (testRes.ok) {
            liveSuccess = true;
            for (const [key, seriesId] of Object.entries(fredSeries)) {
              try {
                const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json&limit=24&sort_order=desc`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.observations && Array.isArray(data.observations)) {
                    results[key] = data.observations.reverse();
                  }
                }
              } catch (e) { console.warn(`FRED fetch failed for ${key}:`, e.message); }
            }
          }
        } catch (e) { console.warn('Live FRED unavailable, using static data'); }

        // Fall back to pre-fetched static data
        if (!liveSuccess) {
          try {
            const res = await fetch('/static/fred_data.json');
            if (res.ok) results = await res.json();
          } catch (e) { console.warn('Static FRED data also unavailable'); }
        }

        if (!c) { setFredData(results); setFredLoading(false); }
      } catch (e) {
        console.warn('FRED data fetch error:', e);
        if (!c) setFredLoading(false);
      }
    })();
    return () => { c = true; };
  }, []);

  const catalysts = useMemo(() => {
    const now = new Date(), cut = new Date(now.getTime() + 45*864e5);
    return CATALYSTS.filter(c => { const d = new Date(c.date); return d >= now && d <= cut; }).sort((a,b) => new Date(a.date) - new Date(b.date));
  }, []);

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const sentColor = { bullish: GREEN, bearish: RED, neutral: '#64748b', mixed: '#d97706' };

  return (
    <div className="fade-in" style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* ═══ LEFT RAIL: Main content ═══ */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <PageHeader title="Francisco" />

        {/* ═══ PORTFOLIOS SECTION ═══ */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1 }}>Investment Portfolios</div>
          <button
            onClick={handleUpdatePrices}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              background: 'rgba(45, 74, 90, 0.05)',
              color: BLUE,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(45, 74, 90, 0.1)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'rgba(45, 74, 90, 0.05)'; }}
          >
            Update Prices
          </button>
        </div>

        {/* Portfolio Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: `1px solid ${BORDER}`, paddingBottom: 8 }}>
          {Object.keys(portfolios).map(name => (
            <button
              key={name}
              onClick={() => setActivePortfolio(name)}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 600,
                border: 'none',
                background: activePortfolio === name ? BLUE : 'transparent',
                color: activePortfolio === name ? 'white' : DIM,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activePortfolio !== name) {
                  e.target.style.background = 'rgba(45, 74, 90, 0.05)';
                  e.target.style.color = TXT;
                }
              }}
              onMouseLeave={(e) => {
                if (activePortfolio !== name) {
                  e.target.style.background = 'transparent';
                  e.target.style.color = DIM;
                }
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Portfolio Table */}
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Ticker', 'Unit Cost', 'Shares', 'Cost Basis', 'Cur. Price', 'Mkt Value', '% Port', 'Unreal. $', 'Unreal. %'].map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '8px 5px',
                    fontSize: 9,
                    fontWeight: 600,
                    color: DIM,
                    textAlign: i === 0 ? 'left' : 'right',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const positions = getPortfolioWithPrices();
              const totalMV = positions.reduce((s,p) => s + p.marketValue, 0);
              const totalCB = positions.filter(p => !p.isCash).reduce((s,p) => s + p.costBasis, 0);
              const totalGain = positions.filter(p => !p.isCash).reduce((s,p) => s + p.unrealizedGain, 0);
              return (<>
              {positions.map((pos, idx) => {
                const gainColor = pos.unrealizedGain >= 0 ? GREEN : RED;
                const gainSign = pos.unrealizedGain >= 0 ? '+' : '';
                if (pos.isCash) return (
                  <tr key={idx} style={{ borderBottom: `1px solid ${BORDER}`, background: 'var(--surface-alt, rgba(0,0,0,0.02))' }}>
                    <td style={{ padding: '7px 5px', fontSize: 12, fontWeight: 700, color: DIM }}>CASH</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>—</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>—</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>{usd(pos.marketValue)}</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>—</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{usd(pos.marketValue)}</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>{pos.pctOfPortfolio.toFixed(1)}%</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>—</td>
                    <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>—</td>
                  </tr>
                );
                return (
                <tr key={idx} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: '7px 5px', fontSize: 12, fontWeight: 700, color: BLUE }}>{pos.ticker}</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right' }}>
                    <input type="number" value={pos.mark}
                      onChange={(e) => updatePortfolioPosition(activePortfolio, idx, 'mark', e.target.value)}
                      style={{ width: '80px', padding: '3px 5px', fontSize: 11, border: `1px solid ${BORDER}`, borderRadius: 4, background: 'transparent', color: TXT, textAlign: 'right' }}
                      step="0.01" />
                  </td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right' }}>
                    <input type="number" value={pos.shares}
                      onChange={(e) => updatePortfolioPosition(activePortfolio, idx, 'shares', e.target.value)}
                      style={{ width: '70px', padding: '3px 5px', fontSize: 11, border: `1px solid ${BORDER}`, borderRadius: 4, background: 'transparent', color: TXT, textAlign: 'right' }}
                      step="1" />
                  </td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>{usd(pos.costBasis)}</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{usd(pos.currentPrice)}</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{usd(pos.marketValue)}</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', color: DIM }}>{pos.pctOfPortfolio.toFixed(1)}%</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 600, color: gainColor }}>{gainSign}{usd(Math.abs(pos.unrealizedGain))}</td>
                  <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 600, color: gainColor }}>{gainSign}{pos.unrealizedGainPct.toFixed(2)}%</td>
                </tr>
                );
              })}
              <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                <td style={{ padding: '7px 5px', fontSize: 11, fontWeight: 700 }}>TOTAL</td>
                <td colSpan={2}></td>
                <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 700 }}>{usd(totalCB + positions.filter(p=>p.isCash).reduce((s,p)=>s+p.marketValue,0))}</td>
                <td></td>
                <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: totalGain >= 0 ? GREEN : RED }}>{usd(totalMV)}</td>
                <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 700 }}>100%</td>
                <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: totalGain >= 0 ? GREEN : RED }}>{totalGain >= 0 ? '+' : ''}{usd(Math.abs(totalGain))}</td>
                <td style={{ padding: '7px 5px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: totalGain >= 0 ? GREEN : RED }}>{totalCB > 0 ? ((totalGain >= 0 ? '+' : '') + (totalGain/totalCB*100).toFixed(2) + '%') : '—'}</td>
              </tr>
              </>);
            })()}
          </tbody>
        </table>
        </div>
      </div>

      {/* ═══ BRIEFING WATCHLIST ═══ */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1 }}>Briefing Watchlist</div>
          <div style={{ fontSize: 10, color: DIM }}>These tickers appear in your daily morning briefing</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {briefingWatchlist.map(ticker => (
            <span key={ticker} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 12, fontWeight: 600,
              background: 'rgba(45, 74, 90, 0.08)', borderRadius: 6, color: BLUE,
            }}>
              {ticker}
              <span onClick={() => removeFromWatchlist(ticker)} style={{
                cursor: 'pointer', fontSize: 14, color: DIM, marginLeft: 2,
                lineHeight: 1, fontWeight: 400,
              }}>&times;</span>
            </span>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); addToWatchlist(watchlistInput); setWatchlistInput(''); }}
          style={{ display: 'flex', gap: 8 }}>
          <input
            value={watchlistInput}
            onChange={e => setWatchlistInput(e.target.value)}
            placeholder="Add ticker (e.g. NFLX)"
            style={{
              padding: '6px 10px', fontSize: 12, border: `1px solid ${BORDER}`,
              borderRadius: 6, width: 160, outline: 'none',
              background: 'var(--surface2, #f5f5f5)',
            }}
          />
          <button type="submit" style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 600,
            border: `1px solid ${BORDER}`, borderRadius: 6,
            background: 'rgba(45, 74, 90, 0.05)', cursor: 'pointer', color: BLUE,
          }}>Add</button>
        </form>
      </div>

      {/* ═══ ROW 1: Quotes | Risk-Reward | Catalysts ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.7fr', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>

        {/* Quotes */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 14px', overflow: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>End-of-Day Quotes</div>
          {loading ? <div style={{ fontSize: 11, color: DIM, textAlign: 'center', padding: 20 }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {[{l:'',f:'ticker'},{l:'',f:null},{l:'Close',f:'close'},{l:'% Chg',f:'changePct'},{l:'H',f:'high'},{l:'L',f:'low'},{l:'Vol',f:'volume'}].map((h,i) => (
                  <th key={i} onClick={h.f ? () => handleSort(h.f) : undefined} style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: h.f && sortField === h.f ? TXT : DIM, textAlign: i <= 1 ? 'left' : 'right', cursor: h.f ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {h.l}{h.f ? sortArrow(h.f) : ''}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {/* ── Indexes / Sectors ── */}
                <tr><td colSpan={7} style={{ padding: '6px 6px 3px', fontSize: 9, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8, background: 'rgba(0,0,0,0.02)' }}>Indexes &amp; Sectors</td></tr>
                {sectorQuotes.map(s => (
                  <tr key={s.ticker} style={{ opacity: 0.85 }}>
                    <td style={{ padding: '4px 6px', fontSize: 11, fontWeight: 700, color: DIM }}>{s.ticker}</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, color: DIM, fontStyle: 'italic' }}>{s.label}</td>
                    <td style={{ padding: '4px 6px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{s.ticker === 'SPX' ? s.close.toLocaleString(undefined,{minimumFractionDigits:2}) : usd(s.close)}</td>
                    <td style={{ padding: '4px 6px', fontSize: 11, textAlign: 'right', fontWeight: 600, color: s.changePct >= 0 ? GREEN : RED }}>{pct(s.changePct)}</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{s.ticker === 'SPX' ? s.high.toLocaleString(undefined,{minimumFractionDigits:2}) : usd(s.high)}</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{s.ticker === 'SPX' ? s.low.toLocaleString(undefined,{minimumFractionDigits:2}) : usd(s.low)}</td>
                    <td style={{ padding: '4px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{fmtV(s.volume)}</td>
                  </tr>
                ))}
                {/* ── Single Stocks ── */}
                <tr><td colSpan={7} style={{ padding: '8px 6px 3px', fontSize: 9, fontWeight: 700, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8, borderTop: `2px solid ${BORDER}`, background: 'rgba(0,0,0,0.02)' }}>Watchlist</td></tr>
                {sortedQuotes.map(q => (
                  <tr key={q.ticker}>
                    <td style={{ padding: '6px 6px', fontSize: 12, fontWeight: 700, color: BLUE }}>{q.ticker}</td>
                    <td />
                    <td style={{ padding: '6px 6px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{usd(q.close)}</td>
                    <td style={{ padding: '6px 6px', fontSize: 11, textAlign: 'right', fontWeight: 600, color: q.changePct >= 0 ? GREEN : RED }}>
                      {pct(q.changePct)}
                    </td>
                    <td style={{ padding: '6px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{usd(q.high)}</td>
                    <td style={{ padding: '6px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{usd(q.low)}</td>
                    <td style={{ padding: '6px 6px', fontSize: 10, textAlign: 'right', color: DIM }}>{fmtV(q.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Risk-Reward */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 14px', overflow: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Risk / Reward</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['','Cur','Low','High','R:R','Range'].map((h,i) => (
                <th key={i} style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600, color: DIM, textAlign: i === 0 || i === 5 ? 'left' : i === 4 ? 'center' : 'right' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {RISK_REWARD.map(r => {
                const cur = quotes.find(q => q.ticker === r.ticker)?.close;
                const upside = cur ? ((r.high - cur) / cur * 100).toFixed(0) : null;
                const downside = cur ? ((cur - r.low) / cur * 100).toFixed(0) : null;
                return (
                  <tr key={r.ticker}>
                    <td style={{ padding: '6px 6px', fontSize: 12, fontWeight: 700, color: BLUE }}>{r.ticker}</td>
                    <td style={{ padding: '6px 6px', fontSize: 11, textAlign: 'right', fontWeight: 600 }}>{cur ? usd(cur) : '—'}</td>
                    <td style={{ padding: '6px 6px', fontSize: 11, textAlign: 'right', color: RED }}>{usd(r.low)}{downside ? <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>-{downside}%</span> : null}</td>
                    <td style={{ padding: '6px 6px', fontSize: 11, textAlign: 'right', color: GREEN }}>{usd(r.high)}{upside ? <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>+{upside}%</span> : null}</td>
                    <td style={{ padding: '6px 6px', fontSize: 10, textAlign: 'center', fontWeight: 600 }}>{r.rr}</td>
                    <td style={{ padding: '8px 6px' }}><RiskBar low={r.low} high={r.high} current={cur} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Catalysts */}
        <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 14px', overflow: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Catalysts</div>
          {catalysts.map((c, i) => {
            const d = new Date(c.date + 'T00:00:00');
            const days = Math.ceil((d - new Date()) / 864e5);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < catalysts.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ minWidth: 30, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: DIM }}>{d.toLocaleDateString('en-US',{month:'short'})}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TXT }}>{d.getDate()}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>{c.ticker}</span>
                  <span style={{ fontSize: 11, color: DIM, marginLeft: 6 }}>{c.event}</span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: days <= 7 ? '#d97706' : DIM }}>{days}d</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ ROW 2: Daily News ═══ */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Daily Market News</div>
        {newsLoading ? <div style={{ fontSize: 11, color: DIM, textAlign: 'center', padding: 16 }}>Loading...</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {news.map((n, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ minWidth: 4, borderRadius: 2, background: sentColor[n.sent] || '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TXT, lineHeight: 1.35, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: DIM }}>{n.src}</span>
                    <span style={{ fontSize: 9, color: DIM }}>·</span>
                    <span style={{ fontSize: 10, color: DIM }}>{n.time} ago</span>
                    {n.tags && n.tags.map(t => (
                      <span key={t} style={{ fontSize: 9, fontWeight: 600, color: BLUE, background: 'rgba(45,74,90,0.08)', borderRadius: 3, padding: '1px 5px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ ROW 3: Macro ═══ */}
      <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: R, padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Macro</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, borderTop: `1px solid ${BORDER}` }}>
          <MiniChart data={retail} label="Retail Sales" unit="$" color="#6366f1" />
          <div style={{ borderLeft: `1px solid ${BORDER}` }}><MiniChart data={homes} label="New Home Sales" color="#0ea5e9" /></div>
          <div style={{ borderLeft: `1px solid ${BORDER}` }}><MiniChart data={cpi} label="CPI YoY %" color="#f59e0b" /></div>
          <div style={{ borderLeft: `1px solid ${BORDER}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Fed Rate Exp.</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 9, fontWeight: 600, color: DIM }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#6366f1', marginRight: 3 }} />Hold</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 3 }} />-25bp</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e', marginRight: 3 }} />-50bp</span>
            </div>
            {FED.map((m, i) => (
              <div key={i} style={{ marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: DIM, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{m.mtg}</span>
                  <span>{m.hold}/{m.c25}/{m.c50}%</span>
                </div>
                <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${m.hold}%`, background: '#6366f1' }} />
                  <div style={{ width: `${m.c25}%`, background: '#f59e0b' }} />
                  <div style={{ width: `${m.c50}%`, background: '#22c55e' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      </div>

      {/* ═══ RIGHT RAIL: FRED Economic Charts ═══ */}
      <div style={{ width: 280, flexShrink: 0, position: 'sticky', top: 80 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: DIM, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingTop: 8 }}>Economic Indicators</div>

        {/* Retail Sales */}
        <FredChart title="Retail Sales Y/Y" data={fredData.rsxfs} color="#6366f1" unit="" isLoading={fredLoading}
          onRefresh={() => { setFredLoading(true); fetch('/static/fred_data.json').then(r=>r.json()).then(d => { setFredData(prev => ({...prev, rsxfs: d.rsxfs})); setFredLoading(false); }).catch(()=>setFredLoading(false)); }} />

        {/* Jobless Claims */}
        <FredChart title="Jobless Claims" data={fredData.icsa} color="#f59e0b" unit="" isLoading={fredLoading}
          onRefresh={() => { setFredLoading(true); fetch('/static/fred_data.json').then(r=>r.json()).then(d => { setFredData(prev => ({...prev, icsa: d.icsa})); setFredLoading(false); }).catch(()=>setFredLoading(false)); }} />

        {/* CPI Y/Y */}
        <FredChart title="CPI Y/Y Growth" data={fredData.cpiaucsl} color="#ef4444" unit="" isLoading={fredLoading}
          onRefresh={() => { setFredLoading(true); fetch('/static/fred_data.json').then(r=>r.json()).then(d => { setFredData(prev => ({...prev, cpiaucsl: d.cpiaucsl})); setFredLoading(false); }).catch(()=>setFredLoading(false)); }} />

        {/* Average Hourly Wages */}
        <FredChart title="Avg Hourly Wages" data={fredData.ces0500000003} color="#22c55e" unit="$" isLoading={fredLoading}
          onRefresh={() => { setFredLoading(true); fetch('/static/fred_data.json').then(r=>r.json()).then(d => { setFredData(prev => ({...prev, ces0500000003: d.ces0500000003})); setFredLoading(false); }).catch(()=>setFredLoading(false)); }} />
      </div>
    </div>
  );
}
