const express = require('express');
const https = require('https');
const router = express.Router();

// Cache for quotes (5 minute TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

// Ticker -> Yahoo symbol mapping
const TICKER_MAP = {
  'SPX': '^GSPC',
  'XLK': 'XLK',
  'XLC': 'XLC',
  'XLY': 'XLY',
  'XLP': 'XLP',
  'XLF': 'XLF',
  'XLV': 'XLV',
  'XLE': 'XLE',
  'XLI': 'XLI',
  'XLRE': 'XLRE',
  'XLU': 'XLU',
  'XLB': 'XLB',
};

// Base prices for fallback mock data (when API fails)
const BASE_PRICES = {
  META: 560, GOOGL: 168, AMZN: 198, PINS: 38, SNAP: 14, RDDT: 155,
  SHOP: 88, SPOT: 540, LYV: 118, WMG: 34, NFLX: 720, DIS: 112,
  UBER: 78, DASH: 185, LYFT: 17, CART: 42, ETSY: 62, W: 48,
  WSM: 330, ROST: 168, BURL: 260, TJX: 125,
  SPX: 5280, XLK: 210, XLC: 85, XLY: 188, XLP: 80, XLF: 42,
  XLV: 148, XLE: 88, XLI: 120, XLRE: 42, XLU: 72, XLB: 85,
  USO: 72, SPY: 562, QQQ: 480, DIA: 420, IWM: 205, VIX: 18,
};

/**
 * Generate fallback mock quote when API fails
 */
function generateMockQuote(ticker) {
  const base = BASE_PRICES[ticker] || 200;
  const close = base + (Math.random() - 0.5) * base * 0.04;
  const prevClose = base + (Math.random() - 0.5) * base * 0.02;
  const change = close - prevClose;
  const changePct = (change / prevClose) * 100;

  return {
    ticker,
    close: parseFloat(close.toFixed(2)),
    previousClose: parseFloat(prevClose.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePct: parseFloat(changePct.toFixed(2)),
    high: parseFloat((close * 1.012).toFixed(2)),
    low: parseFloat((close * 0.988).toFixed(2)),
    volume: Math.floor(2e7 + Math.random() * 6e7),
  };
}

/**
 * Fetch quotes from Yahoo Finance API
 */
function fetchYahooQuotes(symbols) {
  return new Promise((resolve) => {
    const symbolString = symbols.join(',');
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbolString)}&range=1d&interval=1d&indicators=close`;

    const timeout = setTimeout(() => {
      console.warn(`Yahoo Finance API timeout for symbols: ${symbolString}`);
      resolve(null);
    }, 5000);

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.error('Yahoo Finance parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      console.error('Yahoo Finance API error:', err.message);
      resolve(null);
    });
  });
}

/**
 * Parse Yahoo Finance response
 */
function parseYahooResponse(yahooData, tickers) {
  if (!yahooData || !yahooData.results) return null;

  const quotes = [];

  for (const ticker of tickers) {
    const result = yahooData.results.find(r => r.symbol === ticker);
    if (!result || !result.response || !result.response[0]) continue;

    try {
      const data = result.response[0];
      const close = data.regularMarketPrice;
      const previousClose = data.regularMarketPrice; // Yahoo doesn't always give prev close in spark
      const change = data.regularMarketChange || 0;
      const changePct = data.regularMarketChangePercent || 0;

      quotes.push({
        ticker,
        close: parseFloat(close.toFixed(2)),
        previousClose: parseFloat(previousClose.toFixed(2)),
        change: parseFloat(change.toFixed(2)),
        changePct: parseFloat(changePct.toFixed(2)),
        high: parseFloat((data.regularMarketDayHigh || close).toFixed(2)),
        low: parseFloat((data.regularMarketDayLow || close).toFixed(2)),
        volume: data.regularMarketVolume || 0,
      });
    } catch (e) {
      console.error(`Error parsing Yahoo data for ${ticker}:`, e.message);
    }
  }

  return quotes.length > 0 ? quotes : null;
}

/**
 * GET /api/quotes?tickers=META,GOOGL,AMZN
 */
router.get('/', async (req, res) => {
  try {
    const tickerParam = req.query.tickers || '';
    const requestedTickers = tickerParam.split(',').filter(t => t.trim());

    if (!requestedTickers.length) {
      return res.status(400).json({ error: 'No tickers provided' });
    }

    // Check cache
    const cacheKey = `quotes_${requestedTickers.sort().join('_')}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Cache hit for: ${requestedTickers.join(',')}`);
      return res.json(cached.data);
    }

    // Map tickers to Yahoo symbols
    const yahooSymbols = requestedTickers.map(t => TICKER_MAP[t] || t);

    // Fetch from Yahoo Finance
    const yahooData = await fetchYahooQuotes(yahooSymbols);

    let quotes = [];

    if (yahooData) {
      // Try to parse Yahoo response
      quotes = parseYahooResponse(yahooData, yahooSymbols) || [];

      // Map back to original tickers if needed
      quotes = quotes.map(q => {
        const originalTicker = requestedTickers.find(t => (TICKER_MAP[t] || t) === q.ticker);
        return originalTicker ? { ...q, ticker: originalTicker } : q;
      });
    }

    // Fill in any missing tickers with mock data
    const returnedTickers = new Set(quotes.map(q => q.ticker));
    for (const ticker of requestedTickers) {
      if (!returnedTickers.has(ticker)) {
        quotes.push(generateMockQuote(ticker));
      }
    }

    // Cache the result
    cache.set(cacheKey, { data: quotes, timestamp: Date.now() });

    res.json(quotes);
  } catch (err) {
    console.error('Quotes API error:', err);

    // Fallback: generate mock data for all requested tickers
    const tickerParam = req.query.tickers || '';
    const tickers = tickerParam.split(',').filter(t => t.trim());
    const quotes = tickers.map(t => generateMockQuote(t));

    res.json(quotes);
  }
});

module.exports = router;
