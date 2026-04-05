#!/usr/bin/env node
// Larry Nightly Report — queries DB, generates PDF
// Run: node larry-report.js
//   Outputs: larry-report.pdf in the same directory
const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });

(async () => {
  try {
    console.log('Querying database...');

    const [pastDue, unrouted, shipments] = await Promise.all([
      pool.query(`
        SELECT po_number, buyer, ship_window_start, ship_window_end, lot, warehouse, units, style
        FROM po_tracking
        WHERE (routing_id IS NULL OR routing_id = '')
          AND (routing_status IS NULL OR routing_status NOT IN ('Shipped', 'Cancelled'))
          AND date_shipped IS NULL
          AND ship_window_end < CURRENT_DATE
        ORDER BY ship_window_end ASC
      `),
      pool.query(`
        SELECT po_number, buyer, ship_window_start, ship_window_end, lot, warehouse, units, style
        FROM po_tracking
        WHERE (routing_id IS NULL OR routing_id = '')
          AND (routing_status IS NULL OR routing_status NOT IN ('Shipped', 'Cancelled'))
          AND date_shipped IS NULL
          AND ship_window_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
        ORDER BY ship_window_end ASC
      `),
      pool.query(`
        SELECT po_number, buyer, routing_id, ship_window_end, lot, warehouse, units, carrier
        FROM po_tracking
        WHERE routing_id IS NOT NULL AND routing_id != ''
          AND date_shipped IS NULL
          AND (routing_status IS NULL OR routing_status NOT IN ('Shipped', 'Cancelled'))
          AND ship_window_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
        ORDER BY ship_window_end ASC
      `),
    ]);

    let cutTickets = [];
    try {
      const ct = await pool.query(`
        SELECT ct_number, style_number, po, quantity, status, due_date, notes
        FROM cut_tickets
        WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        ORDER BY due_date ASC
      `);
      cutTickets = ct.rows;
    } catch (e) { /* table may not exist */ }

    const data = {
      generated_at: new Date().toISOString(),
      past_due: pastDue.rows,
      unrouted: unrouted.rows,
      shipments: shipments.rows,
      cut_tickets: cutTickets,
    };

    console.log(`Found: ${data.past_due.length} past due, ${data.unrouted.length} unrouted, ${data.shipments.length} shipments, ${data.cut_tickets.length} cut tickets`);

    // Generate PDF via Python
    const scriptDir = path.dirname(require.resolve('./generate-larry-pdf.py'));
    const outputPath = path.join(scriptDir, 'larry-report.pdf');
    const pyScript = path.join(scriptDir, 'generate-larry-pdf.py');

    console.log('Generating PDF...');
    execSync(`echo '${JSON.stringify(data).replace(/'/g, "\\'")}' | python3 "${pyScript}" "${outputPath}"`);

    console.log(`\nPDF saved: ${outputPath}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
