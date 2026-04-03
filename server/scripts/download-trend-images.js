#!/usr/bin/env node
/**
 * Download trend images locally for reliable serving
 * Run: node server/scripts/download-trend-images.js
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TRENDS_FILE = path.join(__dirname, '..', 'data', 'jazzy-trends-latest.json');
const BRIEFINGS_FILE = path.join(__dirname, '..', 'data', 'briefings.json');
const IMG_DIR = path.join(__dirname, '..', 'uploads', 'trends');

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const dest = path.join(IMG_DIR, filename);
    const file = fs.createWriteStream(dest);
    proto.get(url, { timeout: 10000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadImage(res.headers.location, filename).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        resolve({ path: '/uploads/trends/' + filename, size });
      });
    }).on('error', e => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    }).on('timeout', () => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  console.log('Reading trends from', TRENDS_FILE);
  const data = JSON.parse(fs.readFileSync(TRENDS_FILE, 'utf8'));

  let downloaded = 0, failed = 0;
  const urlMap = {}; // old URL -> local path

  for (const t of data.trends) {
    if (!t.image_url || t.image_url.startsWith('/uploads/')) {
      console.log(`  ✓ ${t.title} — already local`);
      continue;
    }
    const slug = slugify(t.title);
    const filename = slug + '.jpg';
    try {
      const result = await downloadImage(t.image_url, filename);
      const sizeKB = Math.round(result.size / 1024);
      console.log(`  ✓ ${t.title} — ${sizeKB}KB → ${result.path}`);
      urlMap[t.image_url] = result.path;
      t.image_url = result.path;
      downloaded++;
    } catch (e) {
      console.log(`  ✗ ${t.title} — ${e.message}`);
      failed++;
    }
  }

  // Save updated trends
  fs.writeFileSync(TRENDS_FILE, JSON.stringify(data, null, 2));
  console.log(`\nTrends updated: ${downloaded} downloaded, ${failed} failed`);

  // Update briefings.json
  if (Object.keys(urlMap).length > 0) {
    let briefings = fs.readFileSync(BRIEFINGS_FILE, 'utf8');
    for (const [oldUrl, newPath] of Object.entries(urlMap)) {
      briefings = briefings.split(oldUrl).join(newPath);
    }
    fs.writeFileSync(BRIEFINGS_FILE, briefings);
    console.log(`Briefings updated: replaced ${Object.keys(urlMap).length} image URLs`);
  }

  console.log('\nDone! Total image storage:',
    fs.readdirSync(IMG_DIR).reduce((sum, f) => sum + fs.statSync(path.join(IMG_DIR, f)).size, 0) / 1024, 'KB');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
