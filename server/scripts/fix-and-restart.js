#!/usr/bin/env node
/**
 * Fix remaining issues and clear broken image cache
 * Run from project root: node server/scripts/fix-and-restart.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/unlimited_avenues',
});

async function main() {
  // 1. Fix Stevie Cardigan image (was showing a rug)
  const r1 = await pool.query(
    'UPDATE jazzy_trends SET image_url = $1 WHERE id = $2',
    ['https://images.urbndata.com/is/image/UrbanOutfitters/98829682_012_b', 43]
  );
  console.log('Fixed Stevie Cardigan image:', r1.rowCount, 'row(s)');

  // 2. Clear broken cached ASOS images so proxy re-fetches them with new headers
  const cacheDir = path.join(__dirname, '..', 'data', 'img_cache');
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    let cleared = 0;
    for (const f of files) {
      const fp = path.join(cacheDir, f);
      const stat = fs.statSync(fp);
      // Remove small cached files (likely failed fetches) and any asos-related cache
      if (stat.size < 1000) {
        fs.unlinkSync(fp);
        cleared++;
      }
    }
    console.log('Cleared', cleared, 'broken cached images out of', files.length, 'total');
  }

  // 3. Show final state
  const all = await pool.query('SELECT id, title, category, image_url FROM jazzy_trends ORDER BY id');
  console.log('\n=== Final Trend Scout State (' + all.rows.length + ' trends) ===');
  for (const row of all.rows) {
    const imgHost = (row.image_url || '').match(/https?:\/\/([^/]+)/)?.[1] || 'none';
    console.log(`  [${row.id}] ${row.title} | ${row.category} | ${imgHost}`);
  }

  await pool.end();
  console.log('\nDone! Now restart the server:');
  console.log('  cd server && pkill -f "node index.js"; node index.js &');
}

main().catch(e => { console.error(e); process.exit(1); });
