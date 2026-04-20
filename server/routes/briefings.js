const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const db = require('../db');

const DATA_FILE = path.join(__dirname, '..', 'data', 'briefings.json');

// ── Local image download helper (avoids proxy issues with sites like Revolve) ──
const TRENDS_IMG_DIR = path.join(__dirname, '..', 'uploads', 'trends');
if (!fs.existsSync(TRENDS_IMG_DIR)) fs.mkdirSync(TRENDS_IMG_DIR, { recursive: true });

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function downloadTrendImage(url, filename) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const dest = path.join(TRENDS_IMG_DIR, filename);
    const file = fs.createWriteStream(dest);
    proto.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': new URL(url).origin + '/',
      },
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadTrendImage(res.headers.location, filename).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve('/uploads/trends/' + filename); });
    }).on('error', e => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

// ── Blocked news sources ──
const BLOCKED_SOURCES = [
  'motley fool', 'fool.com',
  'tikr', 'tikr.com',
  'seeking alpha', 'seekingalpha.com',
  'zacks', 'zacks.com',
  'investorplace', 'investorplace.com',
  'thestreet.com',
  'benzinga', 'benzinga.com',
  'tipranks', 'tipranks.com',
  'insidermonkey', 'insidermonkey.com',
  '247wallst', '247wallst.com',
  'marketbeat', 'marketbeat.com',
  'yahoo', 'yahoo.com', 'finance.yahoo',
  'msn', 'msn.com',
];

function isBlockedSource(title, source) {
  const text = `${title} ${source}`.toLowerCase();
  return BLOCKED_SOURCES.some(b => text.includes(b));
}

function loadBriefings() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

function saveBriefings(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Fetch helper ──
function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const timer = setTimeout(() => resolve(null), timeout);
    proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { clearTimeout(timer); resolve(data); });
    }).on('error', () => { clearTimeout(timer); resolve(null); });
  });
}

// ── Parse RSS items (simple XML parsing) ──
function parseRssItems(xml) {
  if (!xml) return [];
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/s) || [])[1] || '';
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/s) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || '';
    const description = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s) || [])[1] || '';
    if (title && !isBlockedSource(title, source)) {
      items.push({ title: title.trim(), link: link.trim(), source: source.trim(), pubDate: pubDate.trim(), description: description.trim() });
    }
  }
  return items;
}

// ── Portfolio companies for news filtering ──
// Business News should only show articles relevant to these companies / sectors
const PORTFOLIO_TICKERS = [
  'META','GOOGL','AMZN','PINS','SNAP','RDDT','SHOP','SPOT',
  'LYV','WMG','NFLX','DIS','UBER','DASH','LYFT','CART',
  'ETSY','W','WSM','ROST','BURL','TJX',
];
// Map of ticker -> company names / keywords to match in headlines
const PORTFOLIO_NAMES = {
  META:  ['meta platforms', 'meta ', 'facebook', 'instagram', 'whatsapp', 'zuckerberg'],
  GOOGL: ['google', 'alphabet', 'youtube', 'waymo', 'pichai'],
  AMZN:  ['amazon', 'aws', 'prime video', 'jassy'],
  PINS:  ['pinterest'],
  SNAP:  ['snapchat', 'snap inc', 'snap '],
  RDDT:  ['reddit'],
  SHOP:  ['shopify'],
  SPOT:  ['spotify'],
  LYV:   ['live nation', 'livenation', 'ticketmaster'],
  WMG:   ['warner music'],
  NFLX:  ['netflix'],
  DIS:   ['disney', 'walt disney', 'hulu', 'espn'],
  UBER:  ['uber'],
  DASH:  ['doordash', 'door dash'],
  LYFT:  ['lyft'],
  CART:  ['instacart', 'maplebear'],
  ETSY:  ['etsy'],
  W:     ['wayfair'],
  WSM:   ['williams-sonoma', 'williams sonoma', 'pottery barn', 'west elm'],
  ROST:  ['ross stores', 'ross dress'],
  BURL:  ['burlington stores', 'burlington coat'],
  TJX:   ['tjx', 'tj maxx', 'tjmaxx', 'marshalls', 'homegoods', 'home goods'],
};
// Build regex-based matchers for portfolio terms
// Short tickers (1-3 chars) need word-boundary matching to avoid false positives
// e.g. ticker "W" (Wayfair) must not match every word containing "w"
const PORTFOLIO_REGEXES = [
  // Tickers: require word boundaries, case-insensitive
  ...PORTFOLIO_TICKERS.map(t => new RegExp(`\\b${t.toLowerCase()}\\b`, 'i')),
  // Company names: substring match is fine (they're multi-word / distinctive)
  ...Object.values(PORTFOLIO_NAMES).flat().map(n => {
    // Escape regex special chars, trim trailing spaces for matching
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trimEnd();
    return new RegExp(escaped, 'i');
  }),
];

function matchesPortfolio(text) {
  return PORTFOLIO_REGEXES.some(rx => rx.test(text));
}

// Sectors relevant to the portfolio (TMT, off-price retail, e-commerce)
const PORTFOLIO_SECTOR_WORDS = [
  'off-price', 'off price', 'e-commerce', 'ecommerce', 'streaming',
  'social media', 'digital advertising', 'digital ads', 'ad revenue',
  'gig economy', 'ride-hailing', 'rideshare', 'food delivery',
  'online retail', 'dtc', 'direct to consumer',
  // Retail / apparel / supply-chain signals
  "women's apparel", 'womens apparel', "women's fashion", 'womens fashion',
  'fast fashion', 'apparel', 'apparel retailer', 'apparel importer',
  'department store', 'specialty retailer', 'discount retailer',
  'supply chain', 'ocean freight', 'air freight', 'port congestion',
  'tariff', 'tariffs', 'trade war', 'de minimis', 'usmca', 'import duties',
  'consumer spending', 'retail sales',
];

// General market / macro terms (only classify as Business if combined with portfolio relevance or strong market signal)
const MARKET_WORDS = ['stock', 'market', 'wall street', 'nasdaq', 's&p', 'dow jones', 'fed ',
  'federal reserve', 'interest rate', 'inflation', 'gdp', 'earnings', 'revenue',
  'profit', 'ipo', 'merger', 'acquisition',
  'retail sales', 'consumer spending', 'fiscal', 'dividend', 'investor',
  'bond', 'treasury', 'commodity', 'tech stock', 'tech sector',
  'valuation', 'equity', 'recession', 'economic growth',
  'tariff', 'trade war', 'antitrust',
];

// ── Classify a news headline into a category ──
function classifyNewsItem(title, source) {
  const t = (title + ' ' + source).toLowerCase();

  // 1. Check if headline mentions a portfolio company directly — strongest signal
  const portfolioMatch = matchesPortfolio(t);
  const sectorMatch = PORTFOLIO_SECTOR_WORDS.some(w => t.includes(w));
  const marketScore = MARKET_WORDS.filter(w => t.includes(w)).length;

  // Direct portfolio mention = Business News, always
  if (portfolioMatch) return 'Business News';

  // Sector match + at least one market keyword = Business News
  if (sectorMatch && marketScore >= 1) return 'Business News';

  // Strong market/macro signal (3+ market keywords) = Business News
  if (marketScore >= 3) return 'Business News';

  // 2. Global indicators
  const globalWords = ['china', 'europe', 'eu ', 'russia', 'ukraine', 'nato', 'middle east',
    'israel', 'gaza', 'iran', 'india', 'japan', 'korea', 'taiwan', 'africa', 'brazil',
    'uk ', 'britain', 'france', 'germany', 'canada', 'mexico', 'opec', 'united nations',
    'world', 'global', 'international', 'foreign', 'g7', 'g20',
    'diplomat', 'embassy', 'sanction'];

  // 3. US News indicators
  const usWords = ['congress', 'senate', 'house of rep', 'white house', 'president',
    'supreme court', 'fbi', 'doj', 'pentagon', 'election', 'democrat', 'republican',
    'governor', 'state law', 'federal law', 'immigration', 'border', 'shooting',
    'hurricane', 'tornado', 'wildfire', 'flooding'];

  const globalScore = globalWords.filter(w => t.includes(w)).length;
  const usScore = usWords.filter(w => t.includes(w)).length;

  // Market keyword (1-2) from a premium source, but NO portfolio/sector match = NOT business
  // This prevents generic Reuters/NYT articles from landing in Business

  if (globalScore >= 2 || (globalScore >= 1 && usScore === 0)) return 'Global News';
  if (usScore >= 1) return 'US News';

  // Weak market signal (1-2 keywords, no portfolio match) — still classify as Business
  // only if there's nothing else to go on
  if (marketScore >= 2) return 'Business News';

  return 'US News';
}

// ── Fetch news from Google News RSS (categorized) ──
async function fetchNews() {
  const feeds = [
   // Top headlines (general)
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    // World news
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    // Business news
    'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    // Markets
    'https://news.google.com/rss/search?q=stock+market+today+OR+wall+street+OR+S%26P+500&hl=en-US&gl=US&ceid=US:en',
    // WSJ (Dow Jones public RSS)
    'https://feeds.content.dowjones.io/public/rss/RSSWSJD',
    'https://feeds.content.dowjones.io/public/rss/RSSWorldNews',
    // NYT (public RSS)
    'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
    'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml',
    // FT (public RSS)
    'https://www.ft.com/rss/home',
    'https://www.ft.com/rss/companies/retail-consumer',
    // Reuters (no public RSS — via Google News site: query)
    'https://news.google.com/rss/search?q=site:reuters.com+retail+OR+consumer+OR+tariff&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=site:reuters.com+iran+OR+hormuz+OR+oil&hl=en-US&gl=US&ceid=US:en',
    // Bloomberg (no public RSS — via Google News site: query)
    'https://news.google.com/rss/search?q=site:bloomberg.com+retail+OR+apparel+OR+tariff&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=site:bloomberg.com+iran+OR+hormuz+OR+oil&hl=en-US&gl=US&ceid=US:en',
  ];
  const allItems = [];
  for (const url of feeds) {
    try {
      const xml = await fetchUrl(url);
      const items = parseRssItems(xml);
      allItems.push(...items);
    } catch (e) {
      console.error('[Monica] RSS fetch error:', e.message);
    }
  }

  // Deduplicate by title similarity and filter blocked sources (Yahoo, MSN, etc.)
  const seen = new Set();
  const unique = [];
  for (const item of allItems) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (seen.has(key)) continue;
    // Block Yahoo, MSN, and other blocked sources
    if (isBlockedSource(item.title, item.source || '')) continue;
    const linkLower = (item.link || '').toLowerCase();
    if (linkLower.includes('yahoo.com') || linkLower.includes('msn.com')) continue;
    seen.add(key);
    // Classify by content, not feed source
    item.category = classifyNewsItem(item.title, item.source);
    unique.push(item);
  }
  return unique.slice(0, 30);
}


// ── Fetch Iran / Middle East geopolitical news from premium sources ──
async function fetchIranNews() {
  const queries = ['iran+war+OR+hormuz', 'strait+of+hormuz+oil', 'iran+ceasefire+OR+sanctions', 'iran+israel+strike'];
  const sources = ['bloomberg.com', 'reuters.com', 'wsj.com', 'nytimes.com', 'ft.com'];
  const urls = [];
  for (const q of queries) for (const s of sources) {
    urls.push(`https://news.google.com/rss/search?q=site:${s}+${q}&hl=en-US&gl=US&ceid=US:en`);
  }
  const all = [];
  for (const url of urls) {
    try { const xml = await fetchUrl(url, 6000); all.push(...parseRssItems(xml)); }
    catch (e) { console.error('[Iran] RSS error:', e.message); }
  }
  const seen = new Set();
  const uniq = [];
  for (const it of all) {
    const k = it.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(it);
  }
  return uniq.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0)).slice(0, 8);
}

// ── Fetch market quotes (in-process — avoids localhost network hop on Railway) ──
async function fetchMarketQuotes(extraTickers) {
  const base = ['SPY','QQQ','VIX'];
  const all = [...new Set([...base, ...(extraTickers || [])])];
  try {
    // Import the Yahoo Finance fetch + parse helpers directly from quotes module
    const quotesModule = require('./quotes');
    // Use the router's internal handler by constructing a mock req/res
    const quotes = await new Promise((resolve) => {
      const mockReq = { query: { tickers: all.join(',') } };
      const mockRes = {
        status: function() { return this; },
        json: function(data) { resolve(data); },
      };
      // Find the GET handler on the router
      const getLayer = quotesModule.stack.find(l => l.route && l.route.methods.get);
      if (getLayer) {
        getLayer.route.stack[0].handle(mockReq, mockRes, () => resolve([]));
      } else {
        resolve([]);
      }
    });
    console.log(`[Briefing] Market quotes fetched in-process: ${quotes.length} tickers`);
    return quotes;
  } catch (e) {
    console.error('[Briefing] In-process market quote fetch failed:', e.message);
    // Fallback: try the network call (works in local dev)
    try {
      const port = process.env.PORT || 4000;
      const raw = await fetchUrl(`http://localhost:${port}/api/quotes?tickers=${all.join(',')}`);
      if (raw) return JSON.parse(raw);
    } catch (e2) {
      console.error('[Briefing] Network fallback also failed:', e2.message);
    }
  }
  return [];
}

// ── Load briefing watchlist ──
function loadBriefingWatchlist() {
  try {
    const f = path.join(__dirname, '..', 'data', 'briefing_watchlist.json');
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch { return ['BURL','ROST','TJX','META','AMZN','W','WSM','ETSY']; }
}

// GET /api/briefings — list all briefings (newest first)
router.get('/', (req, res) => {
  const briefings = loadBriefings();
  briefings.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(briefings);
});

// POST /api/briefings — save a new briefing
router.post('/', (req, res) => {
  const { date, title, content, source } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const briefings = loadBriefings();
  const briefing = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: date || new Date().toISOString().split('T')[0],
    title: title || `Morning Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`,
    content,
    source: source || 'daily-morning-briefing',
    createdAt: new Date().toISOString(),
  };
  briefings.push(briefing);
  saveBriefings(briefings);
  res.status(201).json(briefing);
});

// ── Preferred news sources ──
const PREFERRED_SOURCES = [
  'wall street journal', 'wsj', 'wsj.com',
  'new york times', 'nytimes', 'nytimes.com',
  'bloomberg', 'bloomberg.com',
  'reuters', 'reuters.com',
  'barrons', "barron's", 'barrons.com',
];

function isPreferredSource(title, source) {
  const text = `${title} ${source}`.toLowerCase();
  return PREFERRED_SOURCES.some(s => text.includes(s));
}

// POST /api/briefings/generate — auto-generate today's briefing from live DB data
router.post('/generate', async (req, res) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Allow ?force=true to regenerate today's briefing
    const force = req.query.force === 'true' || req.body.force === true;
    const briefings = loadBriefings();

    if (!force) {
      const existsToday = briefings.find(b => b.date === dateStr && b.source === 'daily-morning-briefing');
      if (existsToday) {
        return res.json({ exists: true, briefing: existsToday });
      }
    }

    // ── Pull live data in parallel ──
    const watchlistTickers = loadBriefingWatchlist();
    const [newsItems, marketQuotes, iranItems] = await Promise.all([
      fetchNews().catch(() => []),
      fetchMarketQuotes(watchlistTickers).catch(() => []),
      fetchIranNews().catch(() => []),
    ]);

    // ── Trigger press release scan (fire-and-forget, don't block briefing) ──
    try {
      const http = require('http');
      const prReq = http.request({ hostname: 'localhost', port: process.env.PORT || 4000, path: '/api/agents/jazzy/scan-press-releases', method: 'POST', headers: { 'Authorization': req.headers.authorization || '', 'Content-Type': 'application/json' } });
      prReq.on('error', () => {}); // ignore errors
      prReq.end();
      console.log('[Briefing] Triggered press release scan in background');
    } catch { /* ignore */ }

    const sections = [];

    // ── Collect data needed by multiple sections ──

    // Get ALL po_tracking rows and compute routing status in JavaScript
    // (avoids SQL parsing issues with the mock DB)
    const allPOsRaw = await db.query(`SELECT * FROM po_tracking pt ORDER BY pt.ship_window_end ASC`).catch(e => {
      console.error('[Briefing] po_tracking query error:', e.message);
      return { rows: [] };
    });

    // Compute routing status from raw PO data (handles both real PG and mock DB)
    // Raw routing_status values from PG: 'Shipped', 'Cancelled', 'Routed', 'In Warehouse', 'In Transit', 'In Production'
    // Mock DB may return computed values: 'shipped', 'cancelled', 'routed', 'not_routed'
    function computeRoutingStatus(r) {
      const ds = r.date_shipped;
      const rs = (r.routing_status || '').toLowerCase();
      const rid = (r.routing_id || r.routing || '').trim();
      if (ds || rs === 'shipped') return 'shipped';
      if (rs === 'cancelled') return 'cancelled';
      if (rid.toLowerCase().includes('unable to route')) return 'not_routed';
      if (rid && rid !== '0' && rid.toLowerCase() !== 'none' && rid.toLowerCase() !== 'nan' && rid !== '') return 'routed';
      if (rs === 'routed') return 'routed';
      // Raw PG statuses like 'In Transit' with a routing_id = routed; without = not_routed
      return 'not_routed';
    }

    // Parse date helper — handles ISO strings, date strings, and mapped field names
    function parseShipDate(d) {
      if (!d) return null;
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    // Get ship date from either real PG or mock mapped field names
    function getShipEnd(r) {
      return parseShipDate(r.ship_window_end || r.cancel_date);
    }

    // Filter: active POs (not shipped, not cancelled, not disregarded)
    const activePOs = allPOsRaw.rows.filter(r => {
      const crs = computeRoutingStatus(r);
      if (crs === 'shipped' || crs === 'cancelled') return false;
      if (r.date_shipped) return false;
      const buyer = (r.buyer || r.store_name || '').toLowerCase();
      if (buyer.includes('disregard')) return false;
      return true;
    }).map(r => ({ ...r, _routing: computeRoutingStatus(r) }));

    const allNotRouted = activePOs.filter(r => r._routing === 'not_routed');

    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const future14d = new Date(todayStart.getTime() + 14 * 86400000);
    const future30d = new Date(todayStart.getTime() + 30 * 86400000);
    const past90d = new Date(todayStart.getTime() - 90 * 86400000);

    // Scope not-routed to shipping window (matching Shipping page: past 90d to future 30d)
    const scopedNotRouted = allNotRouted.filter(r => {
      const end = getShipEnd(r);
      return end && end >= past90d && end <= future30d;
    });

    // Upcoming not-routed (next 14 days)
    const urgentNotRouted = scopedNotRouted.filter(r => {
      const end = getShipEnd(r);
      return end && end >= todayStart && end <= future14d;
    });

    console.log(`[Briefing] PO stats: total=${allPOsRaw.rows.length}, active=${activePOs.length}, allNotRouted=${allNotRouted.length}, scoped=${scopedNotRouted.length}, urgent14d=${urgentNotRouted.length}`);

    // Trend data
    const trendStats = await db.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN found_date >= CURRENT_DATE - 7 THEN 1 END) as this_week,
              COUNT(CASE WHEN 'saved' = ANY(tags) THEN 1 END) as saved
       FROM jazzy_trends`
    ).catch(() => ({ rows: [{ total: 0, this_week: 0, saved: 0 }] }));

    // ── Catalyst calendar (mirrored from client PortfolioManagement) ──
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
    const todayCatalysts = CATALYSTS.filter(c => c.date === dateStr);

    // ── Risk-reward: compute which stocks are ≥ 2.0 R/R using live quotes ──
    const RISK_REWARD = [
      { ticker: 'META',  low: 440, high: 680 },
      { ticker: 'GOOGL', low: 130, high: 195 },
      { ticker: 'AMZN',  low: 160, high: 235 },
      { ticker: 'PINS',  low: 28,  high: 48 },
      { ticker: 'SNAP',  low: 9,   high: 18 },
      { ticker: 'RDDT',  low: 110, high: 200 },
      { ticker: 'SHOP',  low: 65,  high: 115 },
      { ticker: 'SPOT',  low: 420, high: 650 },
      { ticker: 'LYV',   low: 95,  high: 140 },
      { ticker: 'WMG',   low: 28,  high: 42 },
      { ticker: 'NFLX',  low: 550, high: 850 },
      { ticker: 'DIS',   low: 85,  high: 135 },
      { ticker: 'UBER',  low: 60,  high: 95 },
      { ticker: 'DASH',  low: 140, high: 220 },
      { ticker: 'LYFT',  low: 12,  high: 22 },
      { ticker: 'CART',  low: 30,  high: 52 },
      { ticker: 'ETSY',  low: 48,  high: 85 },
      { ticker: 'W',     low: 30,  high: 65 },
      { ticker: 'WSM',   low: 250, high: 400 },
      { ticker: 'ROST',  low: 140, high: 195 },
      { ticker: 'BURL',  low: 200, high: 310 },
      { ticker: 'TJX',   low: 105, high: 145 },
    ];
    const highRRStocks = [];
    for (const rr of RISK_REWARD) {
      const q = marketQuotes.find(m => m.ticker === rr.ticker);
      if (q && q.close) {
        const downside = q.close - rr.low;
        const upside = rr.high - q.close;
        if (downside > 0) {
          const ratio = upside / downside;
          if (ratio >= 2.0) highRRStocks.push({ ticker: rr.ticker, ratio: ratio.toFixed(1), price: q.close, low: rr.low, high: rr.high });
        }
      }
    }

    // ── Contact log: people still needing outreach ──
    const BUYER_CONTACTS = [
      { company: 'Burlington', buyer: 'Jessica Pion', lastContact: '2026-03-18' },
      { company: 'Ross', buyer: 'Victoria/Traci', lastContact: '2026-03-18' },
      { company: 'Bealls', buyer: 'Grace', lastContact: '2026-03-18' },
    ];
    // Also try to pull from contact_log_entries if available
    let contactLogEntries = [];
    try {
      const clResult = await db.query('SELECT buyer_name, company, contact_date FROM contact_log_entries ORDER BY contact_date DESC LIMIT 50').catch(() => ({ rows: [] }));
      contactLogEntries = clResult.rows;
    } catch {}

    // Merge: find contacts not reached in the last 14 days
    const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 86400000);
    const pendingOutreach = BUYER_CONTACTS.filter(bc => {
      // Check static data
      const lastDate = new Date(bc.lastContact);
      // Check if there's a more recent entry in the DB
      const dbEntry = contactLogEntries.find(e => (e.company || '').toLowerCase().includes(bc.company.toLowerCase()));
      const effectiveDate = dbEntry ? new Date(dbEntry.contact_date) : lastDate;
      return effectiveDate < twoWeeksAgo;
    });

    // ── Woodcock trend report for today ──
    const todayTrends = await db.query(
      `SELECT COUNT(*) as count FROM jazzy_trends WHERE found_date = CURRENT_DATE`
    ).catch(() => ({ rows: [{ count: 0 }] }));
    const todayTrendCount = parseInt(todayTrends.rows[0]?.count || 0);

    // ════════════════════════════════════════════════════════
    // § 1 ACTION ITEMS TODAY (from To Do List only)
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**ACTION ITEMS TODAY**\n'];
      let todoItems = [];
      try {
        const todoResult = await db.query(
          `SELECT id, title, status, comment FROM internal_todos
           WHERE done = false AND (category IS NULL OR category != \'weekly_project\')
           ORDER BY sort_order ASC, created_at ASC`
        );
        todoItems = todoResult.rows || [];
      } catch (e) {
        console.error('[Briefing] Failed to fetch todos:', e.message);
      }
      if (todoItems.length > 0) {
        for (const todo of todoItems) {
          const statusTag = todo.status ? ` *(${todo.status})*` : '';
          lines.push(`- ${todo.title}${statusTag}`);
        }
      } else {
        lines.push('*No pending action items \u2014 your To Do list is clear.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 1.5 WEEKLY PROJECTS
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**WEEKLY PROJECTS**\n'];
      let weeklyItems = [];
      try {
        const weeklyResult = await db.query(
          `SELECT id, title, status, comment FROM internal_todos
           WHERE done = false AND category = \'weekly_project\'
           ORDER BY sort_order ASC, created_at ASC`
        ).catch(() => ({ rows: [] }));
        weeklyItems = weeklyResult.rows || [];
      } catch (e) {
        console.error('[Briefing] Weekly projects fetch error:', e.message);
      }
      if (weeklyItems.length > 0) {
        for (const wp of weeklyItems) {
          const statusTag = wp.status ? ` *(${wp.status})*` : '';
          lines.push(`- ${wp.title}${statusTag}`);
        }
      } else {
        lines.push('*No weekly projects in flight. Add one on the Weekly page.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 2 MAJOR INDICES
    // ════════════════════════════════════════════════════════
    {
      const indices = ['SPY', 'QQQ', 'VIX'];
      let lines = ['**MAJOR INDICES**\n'];
      if (marketQuotes.length > 0) {
        for (const ticker of indices) {
          const q = marketQuotes.find(m => m.ticker === ticker);
          if (q) {
            const dir = q.changePct >= 0 ? '\u25b2' : '\u25bc';
            const sign = q.changePct >= 0 ? '+' : '';
            lines.push(`- **${ticker}** ${q.close?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${dir} ${sign}${q.changePct?.toFixed(2)}%`);
          }
        }
      } else {
        lines.push('*Market data unavailable \u2014 check back later.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 2.5 CATALYST CALENDAR
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**CATALYST CALENDAR**\n'];
      const windowEnd = new Date(todayStart.getTime() + 14 * 86400000);
      const upcoming = CATALYSTS
        .filter(c => {
          const d = new Date(c.date + 'T12:00:00');
          return d >= todayStart && d <= windowEnd;
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      if (upcoming.length > 0) {
        for (const c of upcoming) {
          const d = new Date(c.date + 'T12:00:00');
          const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          lines.push(`- **${dayStr}** \u2014 ${c.ticker} \u00b7 ${c.event}`);
        }
      } else {
        lines.push('*No catalysts in the next 14 days.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 3 NEWS (WSJ, NYT, Bloomberg, FT \u2014 premium sources only)
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**NEWS**\n'];
      const PREMIUM_ONLY = ['wall street journal', 'wsj', 'wsj.com',
        'new york times', 'nytimes', 'nytimes.com',
        'bloomberg', 'bloomberg.com',
        'financial times', 'ft.com', ' ft '];
      function isPremium(item) {
        const t = `${item.title} ${item.source || ''} ${item.link || ''}`.toLowerCase();
        return PREMIUM_ONLY.some(s => t.includes(s));
      }
      const SPORTS_POP_WORDS = [
        'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball',
        'super bowl', 'playoff', 'championship', 'grammys', 'oscars', 'emmys',
        'kardashian', 'taylor swift', 'beyonce', 'royal family', 'tiktok trend',
      ];
      const premiumNews = newsItems
        .filter(it => isPremium(it))
        .filter(it => {
          const t = (it.title + ' ' + (it.source || '')).toLowerCase();
          return !SPORTS_POP_WORDS.some(w => t.includes(w));
        });
      const portfolio = [];
      const macro = [];
      for (const item of premiumNews) {
        const t = (item.title + ' ' + (item.source || '')).toLowerCase();
        if (matchesPortfolio(t) || item.category === 'Business News') portfolio.push(item);
        else macro.push(item);
      }
      if (portfolio.length > 0) {
        lines.push('**Portfolio-Relevant**\n');
        for (const item of portfolio.slice(0, 6)) {
          const src = item.source ? ` *(${item.source})*` : '';
          lines.push(item.link ? `- [${item.title}](${item.link})${src}` : `- ${item.title}${src}`);
        }
        lines.push('');
      }
      if (macro.length > 0) {
        lines.push('**Macro & General**\n');
        for (const item of macro.slice(0, 4)) {
          const src = item.source ? ` *(${item.source})*` : '';
          lines.push(item.link ? `- [${item.title}](${item.link})${src}` : `- ${item.title}${src}`);
        }
      }
      if (portfolio.length === 0 && macro.length === 0) {
        lines.push('*No premium-source headlines pulled this cycle.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 4 IRAN WAR UPDATE
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**IRAN WAR UPDATE**\n'];
      if (iranItems.length > 0) {
        for (const item of iranItems) {
          const src = item.source ? ` *(${item.source})*` : '';
          lines.push(item.link
            ? `- [${item.title}](${item.link})${src}`
            : `- ${item.title}${src}`);
        }
      } else {
        lines.push('*No recent Iran / geopolitical headlines from premium sources.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 5 RISK-REWARD STOCKS (from Francisco portfolio)
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**RISK-REWARD STOCKS**\n'];
      if (highRRStocks.length > 0) {
        for (const rr of highRRStocks.slice(0, 10)) {
          lines.push(`- **${rr.ticker}** $${rr.price.toFixed(2)} \u00b7 R/R ${rr.ratio}\u00d7 (low $${rr.low} / high $${rr.high})`);
        }
      } else {
        lines.push('*No names at \u2265 2.0\u00d7 risk-reward today.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 5.5 THEME TRACKER
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**THEME TRACKER**\n'];
      try {
        const themeResult = await db.query(
          `SELECT unnest(tags) AS theme, COUNT(*)::int AS cnt
           FROM jazzy_trends
           WHERE found_date >= CURRENT_DATE - 7
           GROUP BY theme
           ORDER BY cnt DESC
           LIMIT 8`
        ).catch(() => ({ rows: [] }));
        const themes = themeResult.rows || [];
        if (themes.length > 0) {
          for (const t of themes) {
            lines.push(`- **${t.theme}** \u2014 ${t.cnt} finds this week`);
          }
        } else {
          lines.push('*No Woodcock trend data this week. Theme tracker will populate once the Theme Tracker page is wired up.*');
        }
      } catch {
        lines.push('*Theme tracker pending \u2014 will populate when the Theme Tracker page is live.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 6 AGENTS STATUS (what Jazzy / Eddie / Woodcock did overnight)
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**AGENTS STATUS**\n'];
      let agentRuns = [];
      try {
        const runsResult = await db.query(
          `SELECT agent_name, status, started_at, finished_at, summary
           FROM agent_runs
           WHERE started_at >= CURRENT_DATE - 1
           ORDER BY started_at DESC
           LIMIT 20`
        ).catch(() => ({ rows: [] }));
        agentRuns = runsResult.rows || [];
      } catch {}
      if (agentRuns.length > 0) {
        const latest = {};
        for (const r of agentRuns) {
          if (!latest[r.agent_name]) latest[r.agent_name] = r;
        }
        for (const agent of Object.keys(latest)) {
          const r = latest[agent];
          const when = r.finished_at ? new Date(r.finished_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'running';
          const statusIcon = r.status === 'success' ? '\u2713' : r.status === 'failed' ? '\u2717' : '\u2026';
          const summary = r.summary ? ` \u2014 ${r.summary}` : '';
          lines.push(`- ${statusIcon} **${agent}** (${when})${summary}`);
        }
      } else {
        lines.push('- *Jazzy* \u2014 no overnight run logged');
        lines.push('- *Eddie* \u2014 no overnight run logged');
        lines.push('- *Woodcock* \u2014 no overnight run logged');
        lines.push('');
        lines.push('*Agent run logging pending \u2014 wire up the `agent_runs` table to populate.*');
      }
      sections.push(lines.join('\n'));
    }

    // ════════════════════════════════════════════════════════
    // § 7 LOGISTICS: POs NOT ROUTED (next 2 weeks only)
    // ════════════════════════════════════════════════════════
    {
      let lines = ['**LOGISTICS: POs NOT ROUTED**\n'];
      if (urgentNotRouted.length > 0) {
        const byBuyer = {};
        for (const po of urgentNotRouted) {
          const b = po.buyer || po.store_name || 'Other';
          if (!byBuyer[b]) byBuyer[b] = [];
          byBuyer[b].push(po);
        }
        lines.push(`**${urgentNotRouted.length} POs not routed \u2014 shipping next 2 weeks**\n`);
        for (const [buyerName, pos] of Object.entries(byBuyer).sort((a, b) => b[1].length - a[1].length)) {
          lines.push(`**${buyerName}** (${pos.length})`);
          for (const po of pos.slice(0, 8)) {
            const shipEnd = getShipEnd(po);
            const cancel = shipEnd ? shipEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014';
            const lot = po.lot ? ` \u00b7 Lot ${po.lot}` : '';
            lines.push(`- PO ${po.po_number || po.po || '\u2014'} \u00b7 Cancel ${cancel}${lot} \u00b7 ${parseInt(po.units || po.total_units || 0).toLocaleString()} units`);
          }
          if (pos.length > 8) lines.push(`- ... and ${pos.length - 8} more`);
          lines.push('');
        }
      } else {
        lines.push('All POs shipping in the next 2 weeks are routed.');
      }
      sections.push(lines.join('\n'));
    }

    // Build the briefing content
    const content = `**Good Morning, Jazzy — ${dayName}**\n\nHere's your morning brief.\n\n` + sections.join('\n\n');

    // Remove old briefing for today if force-regenerating
    const filtered = force
      ? briefings.filter(b => !(b.date === dateStr && b.source === 'daily-morning-briefing'))
      : briefings;

    // Save it
    const briefing = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: dateStr,
      title: `Morning Briefing — ${dayName}`,
      content,
      source: 'daily-morning-briefing',
      createdAt: new Date().toISOString(),
    };
    filtered.push(briefing);
    saveBriefings(filtered);

    console.log('[Monica] Generated morning briefing for', dateStr);
    res.status(201).json(briefing);
  } catch (err) {
    console.error('Briefing generate error:', err);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

// DELETE /api/briefings/:id
router.delete('/:id', (req, res) => {
  let briefings = loadBriefings();
  briefings = briefings.filter(b => b.id !== req.params.id);
  saveBriefings(briefings);
  res.json({ ok: true });
});

// DEBUG: test PO routing query (temporary)
module.exports = router;
