#!/usr/bin/env node
/**
 * Fix Woodcock Images v2 — uses curl instead of Node.js HTTP
 * curl handles TLS/cookies/redirects differently and often succeeds where Node fails
 *
 * Run: node server/scripts/fix-images2.js
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/unlimited_avenues',
});

function curlFetch(url) {
  try {
    const html = execSync(`curl -sL -m 15 \
      -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
      -H "Accept-Language: en-US,en;q=0.9" \
      -H "Sec-Ch-Ua: \\"Chromium\\";v=\\"131\\", \\"Not_A Brand\\";v=\\"24\\"" \
      -H "Sec-Ch-Ua-Mobile: ?0" \
      -H "Sec-Ch-Ua-Platform: \\"macOS\\"" \
      -H "Sec-Fetch-Dest: document" \
      -H "Sec-Fetch-Mode: navigate" \
      -H "Sec-Fetch-Site: none" \
      -H "Sec-Fetch-User: ?1" \
      -H "Upgrade-Insecure-Requests: 1" \
      "${url}"`, { maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
    return html;
  } catch (e) {
    return '';
  }
}

function extractImage(html, sourceUrl) {
  if (!html || html.length < 500) return null;

  // Check for 404/error pages
  if (html.includes("Oops!") || html.includes("page not found") || html.includes("404") && html.includes("not found")) {
    return null;
  }

  // 1. og:image
  let m = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
  if (m && m[1] && !isBad(m[1])) return cleanUrl(m[1]);

  // 2. twitter:image
  m = html.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);
  if (m && m[1] && !isBad(m[1])) return cleanUrl(m[1]);

  // 3. JSON-LD
  const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (ldBlocks) {
    for (const block of ldBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const img = findLdImage(data);
        if (img && !isBad(img)) return cleanUrl(img);
      } catch {}
    }
  }

  // 4. data-zoom-image or similar product image attributes
  m = html.match(/data-(?:zoom-image|large-image|full-image|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (m && m[1] && !isBad(m[1])) return cleanUrl(m[1]);

  // 5. First large image with product-related class
  m = html.match(/<img[^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp|gallery|zoom)[^"']*["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp|gallery|zoom)[^"']*["']/i);
  if (m && m[1] && !isBad(m[1])) return cleanUrl(makeAbs(m[1], sourceUrl));

  // 6. Inline JSON with image URLs (common in React/Next.js apps)
  m = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || html.match(/"imageUrl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || html.match(/"src"\s*:\s*"(https?:\/\/images\.urbndata\.com[^"]*)"/i)
    || html.match(/"src"\s*:\s*"(https?:\/\/[^"]*\.(?:scene7|urbndata|akamaized)[^"]*)"/i);
  if (m && m[1] && !isBad(m[1])) return cleanUrl(m[1]);

  // 7. Any urbndata.com image URL in the HTML
  m = html.match(/https?:\/\/images\.urbndata\.com\/is\/image\/[A-Za-z]+\/[0-9]+[^"'\s<>)]+/);
  if (m && m[0]) return cleanUrl(m[0]);

  return null;
}

function findLdImage(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) { const r = findLdImage(item); if (r) return r; }
    return null;
  }
  if (typeof data !== 'object') return null;
  if ((data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') && data.image) {
    if (typeof data.image === 'string') return data.image;
    if (Array.isArray(data.image) && data.image[0]) return typeof data.image[0] === 'string' ? data.image[0] : (data.image[0].url || data.image[0].contentUrl);
    if (data.image.url) return data.image.url;
  }
  if (data['@graph']) return findLdImage(data['@graph']);
  return null;
}

function cleanUrl(url) {
  if (!url) return url;
  // Remove query params from image URLs to get clean CDN URL
  try {
    const u = new URL(url);
    // Keep query params for CDN URLs that need them (like urbndata)
    if (u.hostname.includes('urbndata') || u.hostname.includes('scene7') || u.hostname.includes('asos-media')) {
      return url.split('?')[0]; // Clean version
    }
    return url;
  } catch { return url; }
}

function isBad(url) {
  if (!url) return true;
  const l = url.toLowerCase();
  return l.includes('unsplash.com') || l.includes('placeholder') || l.includes('stock') ||
    l.includes('default-image') || l.includes('no-image') || l.includes('blank') ||
    l.includes('spacer') || l.includes('1x1') || l.includes('pixel.gif') ||
    l.includes('logo') || l.includes('favicon');
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
    if (path.includes('/shop/') || path.includes('/prd/') || path.includes('/dp/') || path.includes('/product/')) return true;
    return false;
  } catch { return false; }
}

// For each retailer, try searching their site for similar products
function getSearchUrl(brand, title) {
  const terms = title.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).slice(0, 3).join('+');
  const host = brand.toLowerCase();
  if (host.includes('free people')) return `https://www.freepeople.com/search/?q=${terms}`;
  if (host.includes('anthropologie')) return `https://www.anthropologie.com/search?q=${terms}`;
  if (host.includes('urban outfitter')) return `https://www.urbanoutfitters.com/search?q=${terms}`;
  if (host.includes("altar'd state") || host.includes('altard')) return `https://www.altardstate.com/search?q=${terms}`;
  return null;
}

async function main() {
  console.log('\n=== Woodcock Image Fixer v2 (curl) ===\n');

  const result = await pool.query(`
    SELECT id, title, brand, source_url, image_url FROM jazzy_trends
    WHERE source_url IS NOT NULL AND source_url != ''
    AND (image_url IS NULL OR image_url = ''
         OR LOWER(image_url) LIKE '%unsplash%'
         OR LOWER(image_url) LIKE '%placeholder%')
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} trends needing images\n`);

  let updated = 0;
  let failed = 0;

  for (const row of result.rows) {
    console.log(`[${row.id}] ${row.brand} — ${row.title}`);

    let img = null;

    // Step 1: Try the actual product page
    if (isProductPage(row.source_url)) {
      console.log(`  Fetching product page...`);
      const html = curlFetch(row.source_url);
      if (html.length > 1000) {
        console.log(`  Got ${html.length} chars`);
        img = extractImage(html, row.source_url);
      } else {
        console.log(`  Page returned ${html.length} chars (likely 404 or blocked)`);
      }
    }

    // Step 2: If product page failed, try retailer search
    if (!img && row.brand) {
      const searchUrl = getSearchUrl(row.brand, row.title);
      if (searchUrl) {
        console.log(`  Trying search: ${searchUrl}`);
        const searchHtml = curlFetch(searchUrl);
        if (searchHtml.length > 1000) {
          console.log(`  Search returned ${searchHtml.length} chars`);
          // Extract first product image from search results
          // URBN search results pages embed product data in JSON
          const urbnMatch = searchHtml.match(/https?:\/\/images\.urbndata\.com\/is\/image\/[A-Za-z]+\/[0-9]+[^"'\s<>)]+/);
          if (urbnMatch) {
            img = cleanUrl(urbnMatch[0]);
            console.log(`  Found URBN image in search: ${img.slice(0, 80)}`);
          }
          // Try ASOS pattern
          if (!img) {
            const asosMatch = searchHtml.match(/https?:\/\/images\.asos-media\.com\/products\/[^"'\s<>)]+/);
            if (asosMatch) img = cleanUrl(asosMatch[0]);
          }
          // Try altardstate pattern
          if (!img) {
            const altMatch = searchHtml.match(/https?:\/\/[^"'\s]*altardstate[^"'\s]*\.(?:jpg|jpeg|png|webp)/i);
            if (altMatch) img = cleanUrl(altMatch[0]);
          }
          // Generic og:image from search page as last resort
          if (!img) {
            img = extractImage(searchHtml, searchUrl);
          }
        }
      }
    }

    if (img && !isBad(img)) {
      await pool.query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [img, row.id]);
      console.log(`  ✓ Updated: ${img.slice(0, 80)}\n`);
      updated++;
    } else {
      console.log(`  ✗ No image found\n`);
      failed++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${result.rows.length}\n`);

  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
