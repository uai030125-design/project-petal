const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : (process.env.CLIENT_URL || 'http://localhost:3000'),
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Image proxy — serves external images through localhost to avoid CORS/blocking issues
app.get('/api/image-proxy', (req, res) => {
  const url = req.query.url;
  if (!url || !url.startsWith('https://')) return res.status(400).send('Missing or invalid url');
  const allowed = ['images.urbndata.com', 'urbndata.com', 'freepeople.com', 'anthropologie.com',
                   'asos.com', 'zara.com', 'mango.com', 'revolve.com', 'altardstate.com', 'urbanoutfitters.com',
                   'princesspolly.com', 'abercrombie.com', 'scene7.com', 'imgix.net', 'shopify.com', 'cdn.shopify.com'];
  try {
    const hostname = new URL(url).hostname;
    if (!allowed.some(d => hostname.includes(d))) return res.status(403).send('Domain not allowed');
  } catch { return res.status(400).send('Invalid URL'); }
  const https = require('https');
  const parsedUrl = new URL(url);
  https.get(url, {
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Referer': parsedUrl.origin + '/',
    }
  }, (proxyRes) => {
    if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
      return res.redirect(proxyRes.headers.location);
    }
    if (proxyRes.statusCode !== 200) return res.status(proxyRes.statusCode).send('Image not found');
    res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    proxyRes.pipe(res);
  }).on('error', () => res.status(502).send('Failed to fetch image'));
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/warehouse-orders', require('./routes/warehouse-orders'));
app.use('/api/styles', require('./routes/styles'));
app.use('/api/routing', require('./routes/routing'));
app.use('/api/team', require('./routes/team'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/buyers', require('./routes/buyers'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/containers', require('./routes/containers'));
app.use('/api/production', require('./routes/production'));
app.use('/api/jazzy', require('./routes/jazzy'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/consolidated-db', require('./routes/consolidated-db'));
app.use('/api/ats', require('./routes/ats'));
app.use('/api/samples', require('./routes/samples'));
app.use('/api/briefings', require('./routes/briefings'));
app.use('/api/scrubs', require('./routes/scrubs'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/chargebacks', require('./routes/chargebacks'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/social-monitor', require('./routes/social-monitor'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Debug: check trend image URLs (temporary)
app.get('/api/debug-trends', async (req, res) => {
  try {
    const { query } = require('./db');
    const result = await query('SELECT id, title, image_url FROM jazzy_trends ORDER BY id');
    res.json(result.rows);
  } catch (e) { res.json({ error: e.message }); }
});

// Debug: get trends with source URLs
app.get('/api/debug-trends-full', async (req, res) => {
  try {
    const { query } = require('./db');
    const result = await query('SELECT id, title, source_url, image_url FROM jazzy_trends ORDER BY id');
    res.json(result.rows);
  } catch (e) { res.json({ error: e.message }); }
});

// Debug: batch update image URLs
app.post('/api/debug-fix-images', async (req, res) => {
  try {
    const { query } = require('./db');
    const updates = req.body; // [{id, image_url}]
    for (const u of updates) {
      await query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [u.image_url, u.id]);
    }
    res.json({ updated: updates.length });
  } catch (e) { res.json({ error: e.message }); }
});

// Debug: delete trend by id
app.post('/api/debug-delete-trends', async (req, res) => {
  try {
    const { query } = require('./db');
    const ids = req.body.ids || [];
    for (const id of ids) {
      await query('DELETE FROM jazzy_trends WHERE id = $1', [id]);
    }
    res.json({ deleted: ids.length });
  } catch (e) { res.json({ error: e.message }); }
});

// Image proxy — fetches external images and serves them from localhost
const https = require('https');
const http = require('http');
const fs = require('fs');
const imgCacheDir = path.join(__dirname, 'data', 'img_cache');
try { fs.mkdirSync(imgCacheDir, { recursive: true }); } catch {}

app.get('/api/img-proxy', (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl) return res.status(400).send('Missing url param');

  // Cache key
  const cacheKey = Buffer.from(imgUrl).toString('base64url').slice(0, 200) + '.img';
  const cachePath = path.join(imgCacheDir, cacheKey);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size >= 1024) {
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      return res.sendFile(cachePath);
    }
    // Cached file is too small (placeholder), delete and re-fetch
    try { fs.unlinkSync(cachePath); } catch {}
    console.log('[img-proxy] Deleted tiny cached file:', cacheKey, stat.size, 'bytes');
  }

  // Fetch with proper redirect handling per-hop
  const doFetch = (targetUrl, hops) => {
    if (hops > 8) return res.status(502).send('Too many redirects');
    let parsed;
    try { parsed = new URL(targetUrl); } catch { return res.status(400).send('Bad URL'); }
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/jpeg,image/png,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': parsed.hostname.includes('urbndata.com') ? 'https://www.anthropologie.com/' : (parsed.protocol + '//' + parsed.hostname + '/'),
      },
      timeout: 10000,
    };
    console.log('[img-proxy] Fetching:', parsed.hostname + parsed.pathname.slice(0, 40), 'hop', hops);
    const request = mod.get(opts, (imgRes) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(imgRes.statusCode) && imgRes.headers.location) {
        let loc = imgRes.headers.location;
        if (loc.startsWith('/')) loc = parsed.protocol + '//' + parsed.hostname + loc;
        imgRes.resume(); // drain
        return doFetch(loc, hops + 1);
      }
      if (imgRes.statusCode !== 200) {
        console.log('[img-proxy] Failed:', imgRes.statusCode);
        imgRes.resume();
        return res.status(imgRes.statusCode).send('Upstream ' + imgRes.statusCode);
      }
      const chunks = [];
      imgRes.on('data', c => chunks.push(c));
      imgRes.on('end', () => {
        const buf = Buffer.concat(chunks);
        console.log('[img-proxy] Got', buf.length, 'bytes');
        // Don't cache tiny placeholder/error responses (< 1KB)
        if (buf.length >= 1024) {
          try { fs.writeFileSync(cachePath, buf); } catch {}
        } else {
          console.log('[img-proxy] Skipping cache for tiny response:', buf.length, 'bytes');
        }
        res.set('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(buf);
      });
    });
    request.on('error', (e) => {
      console.log('[img-proxy] Error:', e.message);
      res.status(502).send('Fetch error: ' + e.message);
    });
    request.on('timeout', () => {
      console.log('[img-proxy] Timeout');
      request.destroy();
      res.status(504).send('Timeout');
    });
  };
  doFetch(imgUrl, 0);
});

// Scrape og:image from a product page URL (for client-side image fetching)
app.get('/api/scrape-og-image', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl) return res.status(400).json({ error: 'Missing url param' });

  const fetchHtml = (targetUrl, hops = 0) => {
    return new Promise((resolve) => {
      if (hops > 6) return resolve('');
      let parsed;
      try { parsed = new URL(targetUrl); } catch { return resolve(''); }
      const mod = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Referer': parsed.origin + '/',
        },
        timeout: 12000,
      };
      const request = mod.get(opts, (pageRes) => {
        if ([301, 302, 303, 307, 308].includes(pageRes.statusCode) && pageRes.headers.location) {
          let loc = pageRes.headers.location;
          if (loc.startsWith('/')) loc = parsed.protocol + '//' + parsed.hostname + loc;
          else if (!loc.startsWith('http')) loc = parsed.protocol + '//' + parsed.hostname + '/' + loc;
          pageRes.resume();
          return fetchHtml(loc, hops + 1).then(resolve);
        }
        let html = '';
        pageRes.setEncoding('utf8');
        pageRes.on('data', c => { html += c; if (html.length > 500000) pageRes.destroy(); });
        pageRes.on('end', () => resolve(html));
        pageRes.on('error', () => resolve(html));
      });
      request.on('error', () => resolve(''));
      request.on('timeout', () => { request.destroy(); resolve(''); });
    });
  };

  try {
    const html = await fetchHtml(pageUrl);
    if (!html) return res.json({ image: null });

    // Try og:image
    let match = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
    if (match && match[1]) return res.json({ image: match[1] });

    // Try twitter:image
    match = html.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);
    if (match && match[1]) return res.json({ image: match[1] });

    // Try JSON-LD Product.image
    const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (ldBlocks) {
      for (const block of ldBlocks) {
        try {
          const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const data = JSON.parse(jsonStr);
          const findImg = (d) => {
            if (!d) return null;
            if (Array.isArray(d)) { for (const i of d) { const r = findImg(i); if (r) return r; } return null; }
            if (typeof d !== 'object') return null;
            if ((d['@type'] === 'Product' || d['@type'] === 'IndividualProduct') && d.image) {
              if (typeof d.image === 'string') return d.image;
              if (Array.isArray(d.image) && d.image[0]) return typeof d.image[0] === 'string' ? d.image[0] : d.image[0].url;
              if (d.image.url) return d.image.url;
            }
            if (d['@graph']) return findImg(d['@graph']);
            return null;
          };
          const img = findImg(data);
          if (img) return res.json({ image: img });
        } catch {}
      }
    }

    // Try first product-style image
    const imgMatch = html.match(/<img[^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp)[^"']*["'][^>]*src=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      let imgUrl = imgMatch[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      return res.json({ image: imgUrl });
    }

    // Try inline JSON "image"
    const inlineMatch = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    if (inlineMatch && inlineMatch[1]) return res.json({ image: inlineMatch[1] });

    res.json({ image: null });
  } catch (e) {
    console.log('[scrape-og] Error:', e.message);
    res.json({ image: null, error: e.message });
  }
});

// Server restart endpoint (dev only — restarts the process, relies on external process manager or manual restart)
app.post('/api/restart', (req, res) => {
  res.json({ status: 'restarting' });
  setTimeout(() => {
    console.log('[Server] Restarting via /api/restart...');
    const { spawn } = require('child_process');
    const child = spawn(process.argv[0], process.argv.slice(1), {
      detached: true,
      stdio: 'inherit',
      cwd: __dirname,
    });
    child.unref();
    process.exit(0);
  }, 500);
});

// Serve React build — static assets (JS/CSS with hashes) get long cache,
// index.html always gets no-cache so the browser picks up new bundles
const buildPath = path.join(__dirname, '..', 'client', 'build');
app.use('/static', express.static(path.join(buildPath, 'static'), { maxAge: '1y' }));
app.use(express.static(buildPath, { maxAge: 0, etag: false }));
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Prevent unhandled errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err && err.message ? err.message : err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Unlimited Avenues API running on port ${PORT}`);
});
