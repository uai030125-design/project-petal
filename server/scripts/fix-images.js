#!/usr/bin/env node
/**
 * Fix Woodcock Trend Scout Images
 *
 * This script:
 * 1. Finds all trends with Unsplash/placeholder/missing images
 * 2. Visits each product page URL
 * 3. Extracts the real product image (og:image, JSON-LD, etc.)
 * 4. Updates the database with the correct image URL
 *
 * Run: node server/scripts/fix-images.js
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/unlimited_avenues',
});

function fetchPageHtml(url, depth = 0) {
  return new Promise((resolve) => {
    if (!url || depth > 6) return resolve('');
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return resolve(''); }
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': parsedUrl.origin + '/',
      },
      timeout: 15000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = parsedUrl.protocol + '//' + parsedUrl.host + loc;
        else if (!loc.startsWith('http')) loc = parsedUrl.origin + '/' + loc;
        res.resume();
        return fetchPageHtml(loc, depth + 1).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve('');
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { html += chunk; if (html.length > 500000) res.destroy(); });
      res.on('end', () => resolve(html));
      res.on('error', () => resolve(html));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function extractImage(html, sourceUrl) {
  if (!html) return null;

  // 1. og:image
  let m = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
  if (m && m[1] && !isBad(m[1])) return m[1];

  // 2. twitter:image
  m = html.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);
  if (m && m[1] && !isBad(m[1])) return m[1];

  // 3. JSON-LD Product.image
  const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldBlocks) {
    for (const block of ldBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const img = findLdImage(data);
        if (img && !isBad(img)) return img;
      } catch {}
    }
  }

  // 4. Product image class patterns
  m = html.match(/<img[^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp|gallery)[^"']*["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp|gallery)[^"']*["']/i);
  if (m && m[1] && !isBad(m[1])) return makeAbs(m[1], sourceUrl);

  // 5. data-src lazy loaded
  m = html.match(/data-(?:src|zoom-image|large-image)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (m && m[1] && !isBad(m[1])) return makeAbs(m[1], sourceUrl);

  // 6. Inline JSON "image" key
  m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || html.match(/"imageUrl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (m && m[1] && !isBad(m[1])) return m[1];

  return null;
}

function findLdImage(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) { const r = findLdImage(item); if (r) return r; }
    return null;
  }
  if (typeof data !== 'object') return null;
  if (data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') {
    if (data.image) {
      if (typeof data.image === 'string') return data.image;
      if (Array.isArray(data.image) && data.image[0]) return typeof data.image[0] === 'string' ? data.image[0] : data.image[0].url;
      if (data.image.url) return data.image.url;
    }
  }
  if (data['@graph']) return findLdImage(data['@graph']);
  if (data.image && typeof data.image === 'string' && /\.(jpg|jpeg|png|webp)/i.test(data.image)) return data.image;
  return null;
}

function isBad(url) {
  if (!url) return true;
  const l = url.toLowerCase();
  return l.includes('unsplash.com') || l.includes('placeholder') || l.includes('stock') ||
    l.includes('default') || l.includes('logo') || l.includes('favicon') ||
    l.includes('blank') || l.includes('spacer') || l.includes('1x1') || l.includes('pixel');
}

function makeAbs(imgUrl, pageUrl) {
  if (!imgUrl) return imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  try {
    const base = new URL(pageUrl);
    return base.protocol + '//' + base.host + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
  } catch { return imgUrl; }
}

function isProductPage(url) {
  try {
    const path = new URL(url).pathname;
    return path.includes('/shop/') || path.includes('/prd/') || path.includes('/dp/') || path.includes('/product/');
  } catch { return false; }
}

// URBN API approach for Anthropologie, UO, Free People
async function tryUrbnApi(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    const slug = parsed.pathname.split('/').pop();
    if (!slug) return null;

    // Try catalog extract API
    const apiUrl = `https://www.${host}/api/catalog/v0/extracts/by-slug/${slug}`;
    console.log('  Trying URBN API:', slug);
    const html = await fetchPageHtml(apiUrl);
    if (html) {
      try {
        const data = JSON.parse(html);
        const img = data?.product?.defaultImage || data?.product?.images?.[0]?.url || data?.displayImage;
        if (img) return img.startsWith('//') ? 'https:' + img : img;
      } catch {}
    }

    // Try search API
    const searchUrl = `https://www.${host}/api/catalog/v0/search?query=${encodeURIComponent(slug.replace(/-/g, ' '))}&count=1`;
    console.log('  Trying URBN search:', slug);
    const searchHtml = await fetchPageHtml(searchUrl);
    if (searchHtml) {
      try {
        const sdata = JSON.parse(searchHtml);
        const products = sdata?.products || sdata?.results || [];
        if (products[0]) {
          const pimg = products[0].defaultImage || products[0].images?.[0]?.url || products[0].image;
          if (pimg) return pimg.startsWith('//') ? 'https:' + pimg : pimg;
        }
      } catch {}
    }
    return null;
  } catch { return null; }
}

async function scrapeImage(sourceUrl) {
  if (!sourceUrl) return null;

  const host = new URL(sourceUrl).hostname.toLowerCase();

  // Skip non-product pages
  if (!isProductPage(sourceUrl)) {
    console.log('  Skipping non-product page');
    return null;
  }

  // Try URBN API first for their brands
  if (host.includes('anthropologie.com') || host.includes('urbanoutfitters.com') || host.includes('freepeople.com')) {
    const urbnImg = await tryUrbnApi(sourceUrl);
    if (urbnImg && !isBad(urbnImg)) {
      console.log('  URBN API got:', urbnImg.slice(0, 80));
      return urbnImg;
    }
  }

  // Generic HTML scrape
  const html = await fetchPageHtml(sourceUrl);
  const img = extractImage(html, sourceUrl);
  if (img) {
    console.log('  HTML scrape got:', img.slice(0, 80));
  }
  return img;
}

async function main() {
  console.log('\n=== Woodcock Image Fixer ===\n');

  // Find trends with bad images
  const result = await pool.query(`
    SELECT id, title, brand, source_url, image_url FROM jazzy_trends
    WHERE source_url IS NOT NULL AND source_url != ''
    AND (image_url IS NULL OR image_url = ''
         OR LOWER(image_url) LIKE '%unsplash%'
         OR LOWER(image_url) LIKE '%placeholder%')
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} trends with bad/missing images\n`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of result.rows) {
    console.log(`[${row.id}] ${row.brand} — ${row.title}`);
    console.log(`  URL: ${row.source_url}`);

    try {
      const img = await scrapeImage(row.source_url);
      if (img && !isBad(img)) {
        await pool.query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [img, row.id]);
        console.log(`  ✓ Updated: ${img.slice(0, 80)}\n`);
        updated++;
      } else {
        console.log(`  ✗ No image found\n`);
        failed++;
      }
    } catch (e) {
      console.log(`  ✗ Error: ${e.message}\n`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Done ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${result.rows.length}\n`);

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
