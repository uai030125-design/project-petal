#!/usr/bin/env node
// Delete all POs from 2023, 2024, and 2025 from po_tracking table
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });

(async () => {
  try {
    // Show counts before
    const before = await pool.query(`
      SELECT EXTRACT(YEAR FROM ship_window_end)::int AS yr, COUNT(*) AS cnt
      FROM po_tracking
      WHERE EXTRACT(YEAR FROM ship_window_end) IN (2023, 2024, 2025)
      GROUP BY yr ORDER BY yr
    `);
    console.log('POs to delete:');
    before.rows.forEach(r => console.log(`  ${r.yr}: ${r.cnt} POs`));

    const total = before.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
    if (total === 0) {
      console.log('No POs found for 2023-2025. Nothing to delete.');
      await pool.end();
      return;
    }

    // Delete
    const result = await pool.query(`
      DELETE FROM po_tracking
      WHERE EXTRACT(YEAR FROM ship_window_end) IN (2023, 2024, 2025)
    `);
    console.log(`\n✅ Deleted ${result.rowCount} POs from 2023-2025`);

    // Show remaining
    const after = await pool.query(`
      SELECT EXTRACT(YEAR FROM ship_window_end)::int AS yr, COUNT(*) AS cnt
      FROM po_tracking
      GROUP BY yr ORDER BY yr
    `);
    console.log('\nRemaining POs by year:');
    after.rows.forEach(r => console.log(`  ${r.yr}: ${r.cnt} POs`));
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
})();
