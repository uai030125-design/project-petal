#!/usr/bin/env node
/**
 * Quick fix: Update Stevie Cardigan image (ID 43) — was showing a rug
 * Run: node server/scripts/fix-stevie-image.js
 */
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/unlimited_avenues',
});

async function main() {
  // Fix Stevie Cardigan image (was 88469556_040_b which is a rug)
  const res = await pool.query(
    'UPDATE jazzy_trends SET image_url = $1 WHERE id = $2',
    ['https://images.urbndata.com/is/image/UrbanOutfitters/98829682_012_b', 43]
  );
  console.log('Updated Stevie Cardigan image:', res.rowCount, 'row(s)');

  // Show remaining trends
  const all = await pool.query('SELECT id, title, image_url FROM jazzy_trends ORDER BY id');
  console.log('\nRemaining trends:');
  for (const row of all.rows) {
    console.log(`  [${row.id}] ${row.title} — ${(row.image_url || '').substring(0, 70)}`);
  }
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
