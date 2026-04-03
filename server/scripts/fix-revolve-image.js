#!/usr/bin/env node
// One-shot script: download the Revolve Lily Crochet Top image locally and update DB + briefings

const https = require('https');
const fs = require('fs');
const path = require('path');

const REMOTE_URL = 'https://is4.revolveassets.com/images/p4/n/c/FREE-WS5185_V1.jpg';
const LOCAL_FILENAME = 'lily-crochet-top.jpg';
const TRENDS_DIR = path.join(__dirname, '..', 'uploads', 'trends');
const LOCAL_PATH = '/uploads/trends/' + LOCAL_FILENAME;
const DEST = path.join(TRENDS_DIR, LOCAL_FILENAME);

if (!fs.existsSync(TRENDS_DIR)) fs.mkdirSync(TRENDS_DIR, { recursive: true });

function download(url, dest, attempt = 1) {
  return new Promise((resolve, reject) => {
    console.log(`[Attempt ${attempt}] Downloading ${url}`);
    const file = fs.createWriteStream(dest);
    const req = https.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.revolve.com/',
        'sec-ch-ua': '"Chromium";v="120"',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    }, (res) => {
      console.log(`  Status: ${res.statusCode}, Content-Type: ${res.headers['content-type']}, Content-Length: ${res.headers['content-length']}`);
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        console.log(`  Redirecting to: ${res.headers.location}`);
        return download(res.headers.location, dest, attempt + 1).then(resolve).catch(reject);
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
        console.log(`  Downloaded: ${size} bytes`);
        resolve(size);
      });
    });
    req.on('error', (e) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy();
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  try {
    const size = await download(REMOTE_URL, DEST);
    if (size < 1000) {
      console.log('WARNING: Downloaded file is very small, might be an error page');
    }
    console.log(`\nImage saved to ${DEST} (${size} bytes)`);

    // Update briefings.json
    const briefingsFile = path.join(__dirname, '..', 'data', 'briefings.json');
    let briefings = fs.readFileSync(briefingsFile, 'utf8');
    // Replace proxy URL references
    const proxyPattern = /\/api\/image-proxy\?url=https%3A%2F%2Fis4\.revolveassets\.com%2Fimages%2Fp4%2Fn%2Fc%2FFREE-WS5185_V1\.jpg/g;
    const matches = briefings.match(proxyPattern);
    console.log(`Found ${matches ? matches.length : 0} proxy URL references in briefings.json`);
    briefings = briefings.replace(proxyPattern, LOCAL_PATH);
    // Also replace direct remote URL references
    briefings = briefings.replace(/https:\/\/is4\.revolveassets\.com\/images\/p4\/n\/c\/FREE-WS5185_V1\.jpg/g, LOCAL_PATH);
    fs.writeFileSync(briefingsFile, briefings);
    console.log('Updated briefings.json');

    // Update DB via pg
    try {
      const db = require('../db');
      const result = await db.query(
        "UPDATE jazzy_trends SET image_url = $1 WHERE image_url = $2 OR image_url LIKE '%FREE-WS5185_V1%'",
        [LOCAL_PATH, REMOTE_URL]
      );
      console.log(`Updated ${result.rowCount} DB records`);
    } catch (e) {
      console.log('DB update skipped (may not be accessible from script):', e.message);
    }

    console.log('\nDone!');
    process.exit(0);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
}

main();
