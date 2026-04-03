/**
 * Data Import Script
 * Reads parsed JSON data and imports into PostgreSQL via the agents API endpoints.
 * Run with: node server/scripts/import-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { query, pool } = require('../db');

async function importPOTracking() {
  const fs = require('fs');
  const dataPath = process.argv[2] || '/tmp/po_tracking.json';

  if (!fs.existsSync(dataPath)) {
    console.log('PO tracking data file not found at', dataPath);
    return 0;
  }

  const records = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`Importing ${records.length} PO tracking records...`);

  // Clear existing data
  await query('DELETE FROM po_tracking');

  let imported = 0;
  for (const po of records) {
    try {
      await query(
        `INSERT INTO po_tracking
         (po_number, cut_ticket, so_number, pick_ticket, routing_status, routing_id,
          ship_window_start, ship_window_end, warehouse, factory_status, eta, carrier,
          buyer, style, units, cartons, lot, date_shipped, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          po.po_number, po.cut_ticket || null, po.so_number || null, po.pick_ticket || null,
          po.routing_status || 'Not Routed', po.routing_id || null,
          po.ship_window_start || null, po.ship_window_end || null,
          po.warehouse || null, po.factory_status || null, po.eta || null, po.carrier || null,
          po.buyer || null, po.style || null, po.units || 0, po.cartons || 0,
          po.lot || null, po.date_shipped || null, po.notes || null,
        ]
      );
      imported++;
    } catch (err) {
      // Skip errors (bad dates, etc.)
    }
  }

  console.log(`  Imported ${imported}/${records.length} PO records`);
  return imported;
}

async function importATS() {
  const fs = require('fs');
  const dataPath = process.argv[3] || '/tmp/ats_data.json';

  if (!fs.existsSync(dataPath)) {
    console.log('ATS data file not found at', dataPath);
    return 0;
  }

  const records = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`Importing ${records.length} ATS records...`);

  await query('DELETE FROM ats_inventory');

  let imported = 0;
  for (const item of records) {
    try {
      await query(
        `INSERT INTO ats_inventory (style, color, units, adj_units, warehouse, orders_expected)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [item.style, item.color || null, item.units || 0, item.adj_units || item.units || 0,
         item.warehouse || null, item.orders_expected || null]
      );
      imported++;
    } catch (err) { /* skip */ }
  }

  console.log(`  Imported ${imported}/${records.length} ATS records`);
  return imported;
}

async function importFinancial() {
  const fs = require('fs');
  const plPath = process.argv[4] || '/tmp/pl_data.json';
  const modelPath = process.argv[5] || '/tmp/ua_model.json';

  let plImported = 0, modelImported = 0;

  if (fs.existsSync(plPath)) {
    const plItems = JSON.parse(fs.readFileSync(plPath, 'utf8'));
    console.log(`Importing ${plItems.length} P&L line items...`);

    await query("DELETE FROM financial_data WHERE category = 'pl'");

    for (const item of plItems) {
      if (item.values) {
        for (const [month, amount] of Object.entries(item.values)) {
          try {
            const yearMatch = month.match(/(\d{2})$/);
            const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : null;
            await query(
              `INSERT INTO financial_data (line_item, category, month, amount, year, source_file)
               VALUES ($1, 'pl', $2, $3, $4, 'Book2.xlsx')`,
              [item.label, month, parseFloat(amount) || 0, year]
            );
            plImported++;
          } catch (e) { /* skip */ }
        }
      }
    }
    console.log(`  Imported ${plImported} P&L entries`);
  }

  if (fs.existsSync(modelPath)) {
    const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
    console.log(`Importing ${modelData.line_items?.length || 0} model line items...`);

    await query('DELETE FROM ua_model');

    for (const item of (modelData.line_items || [])) {
      if (item.values) {
        for (const [year, amount] of Object.entries(item.values)) {
          try {
            await query(
              'INSERT INTO ua_model (line_item, year, amount) VALUES ($1, $2, $3)',
              [item.label, parseInt(year), parseFloat(amount) || 0]
            );
            modelImported++;
          } catch (e) { /* skip */ }
        }
      }
    }
    console.log(`  Imported ${modelImported} model entries`);
  }

  return { plImported, modelImported };
}

async function logImport(agent, action, details) {
  try {
    await query(
      'INSERT INTO agent_logs (agent_name, action, details) VALUES ($1, $2, $3)',
      [agent, action, details]
    );
  } catch (e) { /* ignore */ }
}

async function main() {
  console.log('=== Unlimited Avenues Data Import ===\n');

  try {
    const poCount = await importPOTracking();
    const atsCount = await importATS();
    const { plImported, modelImported } = await importFinancial();

    // Log imports
    if (poCount) await logImport('Larry', 'data_import', `Imported ${poCount} PO tracking records from email data`);
    if (atsCount) await logImport('Larry', 'ats_import', `Imported ${atsCount} ATS inventory records`);
    if (plImported) await logImport('Gordon', 'pl_import', `Imported ${plImported} P&L entries from QuickBooks`);
    if (modelImported) await logImport('Gordon', 'model_import', `Imported ${modelImported} financial model entries`);

    console.log('\n=== Import Complete ===');
    console.log(`PO Tracking: ${poCount}`);
    console.log(`ATS Inventory: ${atsCount}`);
    console.log(`P&L Entries: ${plImported}`);
    console.log(`Model Entries: ${modelImported}`);
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await pool.end();
  }
}

main();
