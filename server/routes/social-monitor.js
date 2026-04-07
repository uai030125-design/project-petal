const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

// ════════════════════════════════════════════════════════════════════
// Social & Trend Monitor — Woodcock Extension
// 4 monitors: Google Trends, Pinterest, Instagram hashtags, New Arrivals
// ════════════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'social-monitor-cache.json');

// ── Utility: HTTP GET with browser-like headers ──
function fetchUrl(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Referer': parsedUrl.origin + '/',
      },
      timeout,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchUrl(redirect, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Load / save cache ──
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch { return { googleTrends: [], pinterest: [], instagram: [], newArrivals: [], lastScan: null }; }
}
function saveCache(data) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error('[SocialMonitor] Cache write error:', e.message); }
}

// ════════════════════════════════════════════════════════════════════
// 1. GOOGLE TRENDS — Fashion keyword tracking
// ════════════════════════════════════════════════════════════════════
const FASHION_KEYWORDS = [
  // Silhouettes & styles
  'linen pants', 'wide leg pants', 'cargo pants', 'barrel jeans',
  'maxi dress', 'midi skirt', 'mini skirt', 'slip dress', 'shirt dress',
  'crochet top', 'corset top', 'tube top', 'halter top', 'peplum top',
  'romper', 'jumpsuit', 'bodysuit',
  // Aesthetics & movements
  'cottagecore', 'quiet luxury', 'mob wife aesthetic', 'clean girl aesthetic',
  'coastal grandmother', 'dark academia', 'boho chic', 'y2k fashion',
  'old money style', 'coquette aesthetic', 'balletcore',
  // Materials & details
  'lace trim', 'eyelet', 'broderie anglaise', 'smocked',
  'tiered dress', 'ruched', 'pleated', 'embroidered',
  'linen blend', 'satin', 'mesh top',
  // Off-price / retail relevant
  'off price fashion', 'discount designer', 'budget fashion',
  'spring fashion trends', 'summer fashion trends',
];

async function scanGoogleTrends() {
  const results = [];

  // Google Trends Daily Trends RSS
  try {
    const rssUrl = 'https://trends.google.com/trending/rss?geo=US';
    const xml = await fetchUrl(rssUrl);
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1] || '';
      const traffic = (block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/s) || [])[1] || '';
      const link = (block.match(/<link>(.*?)<\/link>/s) || [])[1] || '';
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s) || [])[1] || '';

      // Check if this trend is fashion-relevant
      const titleLower = (title + ' ' + desc).toLowerCase();
      const isFashion = FASHION_KEYWORDS.some(kw => titleLower.includes(kw)) ||
        ['fashion', 'style', 'clothing', 'outfit', 'dress', 'wear', 'retail', 'brand'].some(w => titleLower.includes(w));

      if (isFashion) {
        results.push({
          keyword: title.trim(),
          traffic: traffic.trim(),
          link: link.trim(),
          description: desc.replace(/<[^>]+>/g, '').trim().slice(0, 200),
          source: 'google-trends-daily',
          scannedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.log('[SocialMonitor] Google Trends daily RSS error:', e.message);
  }

  // Google Trends search for our tracked keywords (via related queries)
  // Use the public "explore" interest-over-time for batches of keywords
  for (let i = 0; i < FASHION_KEYWORDS.length; i += 5) {
    const batch = FASHION_KEYWORDS.slice(i, i + 5);
    try {
      const q = batch.map(k => encodeURIComponent(k)).join(',');
      const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=240&geo=US&hl=en-US&ns=15`;
      const raw = await fetchUrl(url);
      // Google Trends API returns JSON with a )]}' prefix
      const cleaned = raw.replace(/^\)\]\}\'/, '').trim();
      if (cleaned.startsWith('{')) {
        const data = JSON.parse(cleaned);
        const days = data.default?.trendingSearchesDays || [];
        for (const day of days.slice(0, 2)) {
          for (const search of (day.trendingSearches || []).slice(0, 10)) {
            const title = search.title?.query || '';
            const titleLower = title.toLowerCase();
            const isFashion = FASHION_KEYWORDS.some(kw => titleLower.includes(kw)) ||
              ['fashion', 'style', 'clothing', 'outfit', 'dress', 'wear', 'retail'].some(w => titleLower.includes(w));
            if (isFashion && !results.find(r => r.keyword.toLowerCase() === titleLower)) {
              results.push({
                keyword: title,
                traffic: search.formattedTraffic || '',
                link: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=US`,
                description: (search.articles || []).map(a => a.title).slice(0, 2).join(' | '),
                source: 'google-trends-api',
                scannedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (e) {
      // Silently continue — rate limits are expected
    }
  }

  // Also check Google Shopping Trends via search suggestions
  for (const kw of FASHION_KEYWORDS.slice(0, 15)) {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(kw + ' 2026')}&hl=en`;
      const raw = await fetchUrl(url, 5000);
      const data = JSON.parse(raw);
      const suggestions = data[1] || [];
      for (const s of suggestions.slice(0, 3)) {
        if (!results.find(r => r.keyword.toLowerCase() === s.toLowerCase())) {
          results.push({
            keyword: s,
            traffic: 'rising',
            link: `https://www.google.com/search?q=${encodeURIComponent(s)}`,
            description: `Related to "${kw}"`,
            source: 'google-suggest',
            scannedAt: new Date().toISOString(),
          });
        }
      }
    } catch {}
  }

  console.log(`[SocialMonitor] Google Trends: ${results.length} fashion-relevant trends found`);
  return results;
}

// ════════════════════════════════════════════════════════════════════
// 2. PINTEREST TRENDS — Fashion trending pins
// ════════════════════════════════════════════════════════════════════
const PINTEREST_SEARCHES = [
  'spring 2026 fashion trends',
  'summer 2026 outfit ideas',
  'off price fashion finds',
  'cottagecore outfit',
  'linen outfit women',
  'boho dress 2026',
  'trending outfits 2026',
  'casual chic outfit',
  'modest fashion trends',
  'workwear outfit ideas',
];

async function scanPinterest() {
  const results = [];

  // Pinterest Trends page (public)
  try {
    const html = await fetchUrl('https://trends.pinterest.com/');
    // Extract trending topics from the page
    const trendMatches = html.match(/trending.*?<\/[a-z]/gi) || [];
    for (const m of trendMatches.slice(0, 20)) {
      const text = m.replace(/<[^>]+>/g, '').trim();
      if (text.length > 3 && text.length < 100) {
        results.push({
          keyword: text,
          platform: 'pinterest',
          link: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(text)}`,
          engagement: 'trending',
          source: 'pinterest-trends',
          scannedAt: new Date().toISOString(),
        });
      }
    }
  } catch (e) {
    console.log('[SocialMonitor] Pinterest trends page error:', e.message);
  }

  // Pinterest RSS feeds for fashion content
  for (const searchTerm of PINTEREST_SEARCHES) {
    try {
      const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}&rs=typed`;
      const html = await fetchUrl(url, 8000);

      // Extract pin data from the HTML/JSON embedded in the page
      const jsonMatches = html.match(/"title"\s*:\s*"([^"]{10,100})"/g) || [];
      const seen = new Set();
      for (const m of jsonMatches.slice(0, 5)) {
        const title = m.match(/"title"\s*:\s*"([^"]+)"/)?.[1] || '';
        const lower = title.toLowerCase();
        if (title.length > 5 && !seen.has(lower) && !results.find(r => r.keyword.toLowerCase() === lower)) {
          seen.add(lower);
          results.push({
            keyword: title,
            platform: 'pinterest',
            link: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(searchTerm)}`,
            engagement: 'search-result',
            searchTerm,
            source: 'pinterest-search',
            scannedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Rate limited or blocked — expected
    }
  }

  console.log(`[SocialMonitor] Pinterest: ${results.length} fashion trends found`);
  return results;
}

// ════════════════════════════════════════════════════════════════════
// 3. INSTAGRAM HASHTAG TRACKER — Fashion hashtag monitoring
// ════════════════════════════════════════════════════════════════════
const INSTAGRAM_HASHTAGS = [
  'fashiontrends', 'ootd', 'outfitinspiration', 'springfashion',
  'summerfashion', 'offpricefinds', 'budgetfashion', 'thriftfinds',
  'cottagecore', 'bohochic', 'streetstyle', 'casualchic',
  'linenstyle', 'mididress', 'floraldress', 'lacetop',
  'retailfashion', 'fashionblogger', 'styleinspo', 'whatiwore',
];

async function scanInstagram() {
  const results = [];

  // Instagram public hashtag pages (limited — they block most scraping)
  // Instead, use Google search for recent Instagram fashion posts
  for (const hashtag of INSTAGRAM_HASHTAGS.slice(0, 10)) {
    try {
      // Use Google to find trending Instagram content for each hashtag
      const searchUrl = `https://www.google.com/search?q=site:instagram.com+%23${hashtag}+fashion+2026&tbs=qdr:w`;
      const html = await fetchUrl(searchUrl, 8000);

      // Extract titles from search results
      const titleMatches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
      for (const m of titleMatches.slice(0, 3)) {
        const text = m.replace(/<[^>]+>/g, '').trim();
        if (text.length > 10 && text.length < 200) {
          results.push({
            hashtag: `#${hashtag}`,
            title: text,
            platform: 'instagram',
            link: `https://www.instagram.com/explore/tags/${hashtag}/`,
            source: 'instagram-google',
            scannedAt: new Date().toISOString(),
          });
        }
      }
    } catch {}
  }

  // Also check what's trending on Instagram via fashion aggregator blogs
  const fashionBlogs = [
    'https://www.whowhatwear.com/fashion/trends',
    'https://www.refinery29.com/en-us/fashion/trends',
  ];

  for (const blogUrl of fashionBlogs) {
    try {
      const html = await fetchUrl(blogUrl, 10000);
      // Extract article titles that mention trends
      const headlines = html.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi) || [];
      for (const h of headlines.slice(0, 8)) {
        const text = h.replace(/<[^>]+>/g, '').trim();
        if (text.length > 15 && text.length < 150) {
          const lower = text.toLowerCase();
          if (['trend', 'style', 'fashion', 'wear', 'outfit', 'spring', 'summer'].some(w => lower.includes(w))) {
            results.push({
              hashtag: '',
              title: text,
              platform: 'fashion-blog',
              link: blogUrl,
              source: new URL(blogUrl).hostname,
              scannedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {
      console.log(`[SocialMonitor] Blog scrape error ${blogUrl}: ${e.message}`);
    }
  }

  console.log(`[SocialMonitor] Instagram/Social: ${results.length} items found`);
  return results;
}

// ════════════════════════════════════════════════════════════════════
// 4. RETAIL COMPETITOR NEW ARRIVALS — Monitor what's dropping
// ════════════════════════════════════════════════════════════════════
const RETAILERS = [
  {
    name: 'Anthropologie',
    url: 'https://www.anthropologie.com/new-clothing',
    selector: { titleRegex: /"name"\s*:\s*"([^"]{5,100})"/, priceRegex: /"price"\s*:\s*"?\$?([\d.]+)"?/ },
  },
  {
    name: 'Free People',
    url: 'https://www.freepeople.com/new-arrivals/',
    selector: { titleRegex: /"name"\s*:\s*"([^"]{5,100})"/, priceRegex: /"price"\s*:\s*"?\$?([\d.]+)"?/ },
  },
  {
    name: 'Zara',
    url: 'https://www.zara.com/us/en/woman-new-in-l1180.html',
    selector: { titleRegex: /"name"\s*:\s*"([^"]{5,100})"/, priceRegex: /"price"\s*:\s*(\d+\.\d{2})/ },
  },
  {
    name: 'Urban Outfitters',
    url: 'https://www.urbanoutfitters.com/womens-new-arrivals',
    selector: { titleRegex: /"displayName"\s*:\s*"([^"]{5,100})"/, priceRegex: /"salePrice"\s*:\s*(\d+\.\d{2})/ },
  },
  {
    name: 'H&M',
    url: 'https://www2.hm.com/en_us/women/new-arrivals/view-all.html',
    selector: { titleRegex: /"title"\s*:\s*"([^"]{5,100})"/, priceRegex: /"price"\s*:\s*(\d+\.\d{2})/ },
  },
  {
    name: 'ASOS',
    url: 'https://www.asos.com/us/women/new-in/new-in-clothing/cat/?cid=2623',
    selector: { titleRegex: /"name"\s*:\s*"([^"]{5,100})"/, priceRegex: /"current":\{"value":(\d+\.?\d*)/ },
  },
  {
    name: 'Nordstrom',
    url: 'https://www.nordstrom.com/browse/women/clothing/new-arrivals',
    selector: { titleRegex: /"name"\s*:\s*"([^"]{5,80})"/, priceRegex: /"regularPrice":\{"min":(\d+\.?\d*)/ },
  },
  {
    name: 'Target',
    url: 'https://www.target.com/c/new-arrivals-women-s-clothing/-/N-o0eqa',
    selector: { titleRegex: /"title"\s*:\s*"([^"]{5,100})"/, priceRegex: /"current_retail":\s*(\d+\.?\d*)/ },
  },
];

// Fashion categories to track in new arrivals
const TRENDING_CATEGORIES = [
  'dress', 'linen', 'crochet', 'lace', 'eyelet', 'embroidered', 'tiered',
  'smocked', 'peplum', 'corset', 'ruched', 'pleated', 'romper', 'jumpsuit',
  'wide leg', 'cargo', 'barrel', 'floral', 'boho', 'cottage',
  'satin', 'mesh', 'slip', 'midi', 'maxi',
];

async function scanNewArrivals() {
  const results = [];

  for (const retailer of RETAILERS) {
    try {
      console.log(`[SocialMonitor] Scanning new arrivals: ${retailer.name}`);
      const html = await fetchUrl(retailer.url, 15000);

      if (!html || html.length < 500) {
        console.log(`[SocialMonitor] Empty/blocked from ${retailer.name}`);
        continue;
      }

      // Extract product names from JSON-LD or inline data
      const products = [];
      const titleRegex = new RegExp(retailer.selector.titleRegex.source, 'gi');
      let titleMatch;
      const seen = new Set();
      while ((titleMatch = titleRegex.exec(html)) !== null) {
        const name = titleMatch[1].trim();
        const lower = name.toLowerCase();
        if (name.length > 5 && !seen.has(lower)) {
          seen.add(lower);
          products.push({ name, lower });
        }
      }

      // Extract prices
      const priceRegex = new RegExp(retailer.selector.priceRegex.source, 'gi');
      const prices = [];
      let priceMatch;
      while ((priceMatch = priceRegex.exec(html)) !== null) {
        prices.push(parseFloat(priceMatch[1]));
      }

      // Track which trending categories appear in new arrivals
      const categoryHits = {};
      for (const product of products) {
        for (const cat of TRENDING_CATEGORIES) {
          if (product.lower.includes(cat)) {
            if (!categoryHits[cat]) categoryHits[cat] = [];
            categoryHits[cat].push(product.name);
          }
        }
      }

      // Report findings
      for (const [category, items] of Object.entries(categoryHits)) {
        results.push({
          retailer: retailer.name,
          category,
          count: items.length,
          examples: items.slice(0, 3),
          url: retailer.url,
          source: 'new-arrivals',
          scannedAt: new Date().toISOString(),
        });
      }

      // Also track total new arrivals count
      if (products.length > 0) {
        const avgPrice = prices.length > 0
          ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
          : null;
        results.push({
          retailer: retailer.name,
          category: '_summary',
          count: products.length,
          avgPrice,
          examples: products.slice(0, 5).map(p => p.name),
          url: retailer.url,
          source: 'new-arrivals-summary',
          scannedAt: new Date().toISOString(),
        });
      }

      console.log(`[SocialMonitor] ${retailer.name}: ${products.length} products, ${Object.keys(categoryHits).length} trending categories`);
    } catch (e) {
      console.log(`[SocialMonitor] Error scanning ${retailer.name}: ${e.message}`);
    }
  }

  console.log(`[SocialMonitor] New Arrivals: ${results.length} data points across ${RETAILERS.length} retailers`);
  return results;
}


// ════════════════════════════════════════════════════════════════════
// API ROUTES
// ════════════════════════════════════════════════════════════════════

// POST /api/social-monitor/scan — Run all 4 monitors
router.post('/scan', authMiddleware, async (req, res) => {
  const { monitors = ['all'] } = req.body;
  const runAll = monitors.includes('all');

  console.log('[SocialMonitor] Starting scan...', monitors);

  const cache = loadCache();
  const scanResults = {
    googleTrends: cache.googleTrends,
    pinterest: cache.pinterest,
    instagram: cache.instagram,
    newArrivals: cache.newArrivals,
  };
  let totalNew = 0;

  try {
    if (runAll || monitors.includes('google-trends')) {
      scanResults.googleTrends = await scanGoogleTrends();
      totalNew += scanResults.googleTrends.length;
    }
  } catch (e) { console.error('[SocialMonitor] Google Trends error:', e.message); }

  try {
    if (runAll || monitors.includes('pinterest')) {
      scanResults.pinterest = await scanPinterest();
      totalNew += scanResults.pinterest.length;
    }
  } catch (e) { console.error('[SocialMonitor] Pinterest error:', e.message); }

  try {
    if (runAll || monitors.includes('instagram')) {
      scanResults.instagram = await scanInstagram();
      totalNew += scanResults.instagram.length;
    }
  } catch (e) { console.error('[SocialMonitor] Instagram error:', e.message); }

  try {
    if (runAll || monitors.includes('new-arrivals')) {
      scanResults.newArrivals = await scanNewArrivals();
      totalNew += scanResults.newArrivals.length;
    }
  } catch (e) { console.error('[SocialMonitor] New Arrivals error:', e.message); }

  scanResults.lastScan = new Date().toISOString();
  saveCache(scanResults);

  res.json({
    success: true,
    summary: {
      googleTrends: scanResults.googleTrends.length,
      pinterest: scanResults.pinterest.length,
      instagram: scanResults.instagram.length,
      newArrivals: scanResults.newArrivals.length,
      total: totalNew,
      lastScan: scanResults.lastScan,
    },
  });
});

// GET /api/social-monitor/results — Get cached results
router.get('/results', authMiddleware, async (req, res) => {
  const { monitor } = req.query;
  const cache = loadCache();

  if (monitor && cache[monitor]) {
    return res.json({ success: true, data: cache[monitor], lastScan: cache.lastScan });
  }

  res.json({
    success: true,
    data: cache,
    summary: {
      googleTrends: (cache.googleTrends || []).length,
      pinterest: (cache.pinterest || []).length,
      instagram: (cache.instagram || []).length,
      newArrivals: (cache.newArrivals || []).length,
      lastScan: cache.lastScan,
    },
  });
});

// GET /api/social-monitor/keywords — Get tracked fashion keywords
router.get('/keywords', authMiddleware, (req, res) => {
  res.json({
    success: true,
    keywords: FASHION_KEYWORDS,
    hashtags: INSTAGRAM_HASHTAGS,
    retailers: RETAILERS.map(r => ({ name: r.name, url: r.url })),
    trendingCategories: TRENDING_CATEGORIES,
  });
});

// POST /api/social-monitor/keywords — Add custom keywords to track
router.post('/keywords', authMiddleware, (req, res) => {
  const { keywords = [] } = req.body;
  for (const kw of keywords) {
    if (kw && !FASHION_KEYWORDS.includes(kw.toLowerCase())) {
      FASHION_KEYWORDS.push(kw.toLowerCase());
    }
  }
  res.json({ success: true, keywords: FASHION_KEYWORDS });
});

// GET /api/social-monitor/insights — AI-generated style insights summary
router.get('/insights', authMiddleware, async (req, res) => {
  const cache = loadCache();

  // Aggregate signals across all monitors
  const insights = [];

  // 1. Rising Google Trends keywords
  const risingKeywords = (cache.googleTrends || [])
    .filter(t => t.traffic && t.traffic !== '')
    .sort((a, b) => {
      const aNum = parseInt((a.traffic || '0').replace(/[^0-9]/g, ''));
      const bNum = parseInt((b.traffic || '0').replace(/[^0-9]/g, ''));
      return bNum - aNum;
    })
    .slice(0, 5);

  if (risingKeywords.length > 0) {
    insights.push({
      type: 'rising-searches',
      title: 'Rising Fashion Searches',
      items: risingKeywords.map(k => `${k.keyword} (${k.traffic})`),
      signal: 'strong',
    });
  }

  // 2. Common categories across new arrivals (what multiple retailers are stocking)
  const newArrivals = cache.newArrivals || [];
  const categoryCounts = {};
  for (const item of newArrivals) {
    if (item.category && item.category !== '_summary') {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + item.count;
    }
  }
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topCategories.length > 0) {
    insights.push({
      type: 'hot-categories',
      title: 'Hot Categories Across Retailers',
      items: topCategories.map(([cat, count]) => {
        const retailers = newArrivals
          .filter(a => a.category === cat)
          .map(a => a.retailer);
        return `${cat} (${count} items across ${[...new Set(retailers)].join(', ')})`;
      }),
      signal: 'strong',
    });
  }

  // 3. Pinterest/Instagram social buzz
  const socialBuzz = [
    ...(cache.pinterest || []).slice(0, 3),
    ...(cache.instagram || []).filter(i => i.platform === 'fashion-blog').slice(0, 3),
  ];
  if (socialBuzz.length > 0) {
    insights.push({
      type: 'social-buzz',
      title: 'Social Media Buzz',
      items: socialBuzz.map(s => s.keyword || s.title),
      signal: 'moderate',
    });
  }

  // 4. Category convergence — find styles trending in BOTH search AND retail
  const searchKeywords = new Set(
    (cache.googleTrends || []).map(t => t.keyword.toLowerCase())
  );
  const retailCategories = new Set(
    newArrivals.filter(a => a.category !== '_summary').map(a => a.category)
  );
  const convergence = [];
  for (const cat of retailCategories) {
    for (const kw of searchKeywords) {
      if (kw.includes(cat) || cat.includes(kw.split(' ')[0])) {
        convergence.push(cat);
        break;
      }
    }
  }
  if (convergence.length > 0) {
    insights.push({
      type: 'convergence',
      title: 'Search + Retail Convergence (strongest signal)',
      items: convergence.map(c => `"${c}" is trending in search AND stocked by multiple retailers`),
      signal: 'very-strong',
    });
  }

  res.json({
    success: true,
    insights,
    lastScan: cache.lastScan,
    totalDataPoints: (cache.googleTrends || []).length + (cache.pinterest || []).length +
      (cache.instagram || []).length + (cache.newArrivals || []).length,
  });
});

module.exports = router;
