#!/usr/bin/env node
/**
 * Cleanup Woodcock Trends
 *
 * 1. Deletes jeans, jackets, accessories
 * 2. Deletes trends with fake/404 product links
 * 3. Fixes images for verified real products
 *
 * Run: node server/scripts/cleanup-trends.js
 */

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/unlimited_avenues',
});

async function main() {
  console.log('\n=== Woodcock Trend Cleanup ===\n');

  // IDs to KEEP (verified real products with correct links):
  const keepIds = [
    43, // Kimchi Blue Stevie Crochet Bell Sleeve Flyaway Cardigan (Urban Outfitters) — REAL
    42, // YAS Festival Boho Style Crochet Trim Cami Midi Dress (ASOS) — REAL
    40, // Elliatt Tilly Tiered Maxi Dress (Anthropologie) — REAL
    38, // Kimchi Blue Tulum Crochet Halter Top (Urban Outfitters) — REAL
    37, // YAS Festival Crochet Lace Insert Boho Maxi Skirt (ASOS) — REAL
    36, // Lily Crochet Top (Revolve/Free People) — REAL
    44, // Out From Under Tia Crochet Beach Cover-Up (Urban Outfitters) — REAL
  ];

  // Correct image URLs (verified by visiting each page in Chrome browser):
  const imageFixups = {
    43: 'https://images.urbndata.com/is/image/UrbanOutfitters/98829682_012_b',  // Stevie Cardigan (was showing a rug)
    38: 'https://images.urbndata.com/is/image/UrbanOutfitters/98948037_011_b',  // Tulum Halter Top
    44: 'https://images.urbndata.com/is/image/UrbanOutfitters/41152042_010_b',  // Cover-Up
    40: 'https://images.urbndata.com/is/image/Anthropologie/106832975_410_b',   // Elliatt Tilly
  };

  // Step 1: Delete everything except the verified items
  const allResult = await pool.query('SELECT id, title, brand, category FROM jazzy_trends ORDER BY id');
  const toDelete = allResult.rows.filter(r => !keepIds.includes(r.id));

  console.log(`Total trends: ${allResult.rows.length}`);
  console.log(`Keeping: ${keepIds.length} verified real products`);
  console.log(`Deleting: ${toDelete.length} items\n`);

  console.log('--- DELETING ---');
  for (const row of toDelete) {
    const reason = row.category === 'Accessories' ? 'accessory'
      : row.title.toLowerCase().includes('jeans') ? 'jeans'
      : row.title.toLowerCase().includes('jacket') ? 'jacket'
      : 'fake/404 URL';
    console.log(`  [${row.id}] ${row.brand} — ${row.title} (${reason})`);
    await pool.query('DELETE FROM jazzy_trends WHERE id = $1', [row.id]);
  }

  // Step 2: Fix images for remaining items
  console.log('\n--- FIXING IMAGES ---');
  for (const [id, url] of Object.entries(imageFixups)) {
    await pool.query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [url, parseInt(id)]);
    console.log(`  [${id}] Updated image`);
  }

  // Step 3: Verify what remains
  const remaining = await pool.query('SELECT id, title, brand, image_url FROM jazzy_trends ORDER BY id');
  console.log(`\n--- REMAINING (${remaining.rows.length} trends) ---`);
  for (const row of remaining.rows) {
    const imgOk = row.image_url && !row.image_url.includes('unsplash');
    console.log(`  [${row.id}] ${row.brand} — ${row.title} ${imgOk ? '✓' : '✗ BAD IMAGE'}`);
  }

  console.log('\nDone!\n');
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
