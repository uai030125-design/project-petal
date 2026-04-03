const express = require('express');
const router = express.Router();
const { query, pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads', 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.xlsb', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only spreadsheet files are allowed'));
  }
});

// Initialize tables on startup
async function initializeTables() {
  const tables = [
    {
      name: 'po_tracking',
      sql: `CREATE TABLE IF NOT EXISTS po_tracking (
        id SERIAL PRIMARY KEY, po_number TEXT NOT NULL, cut_ticket TEXT,
        so_number TEXT, pick_ticket TEXT, routing_status TEXT DEFAULT 'Not Routed',
        routing_id TEXT, ship_window_start DATE, ship_window_end DATE,
        warehouse TEXT, factory_status TEXT, eta DATE, carrier TEXT,
        buyer TEXT, style TEXT, units INTEGER DEFAULT 0, cartons INTEGER DEFAULT 0,
        lot TEXT, date_shipped DATE, notes TEXT, shipment_info TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`
    },
    {
      name: 'ats_inventory',
      sql: `CREATE TABLE IF NOT EXISTS ats_inventory (
        id SERIAL PRIMARY KEY, style TEXT NOT NULL, color TEXT,
        units INTEGER DEFAULT 0, adj_units INTEGER DEFAULT 0,
        warehouse TEXT, orders_expected TEXT, category TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`
    },
    {
      name: 'financial_data',
      sql: `CREATE TABLE IF NOT EXISTS financial_data (
        id SERIAL PRIMARY KEY, source_file TEXT, line_item TEXT NOT NULL,
        category TEXT, month TEXT, amount NUMERIC(15,2), year INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )`
    },
    {
      name: 'ua_model',
      sql: `CREATE TABLE IF NOT EXISTS ua_model (
        id SERIAL PRIMARY KEY, line_item TEXT NOT NULL, year INTEGER,
        amount NUMERIC(15,2), created_at TIMESTAMP DEFAULT NOW()
      )`
    },
    {
      name: 'agent_logs',
      sql: `CREATE TABLE IF NOT EXISTS agent_logs (
        id SERIAL PRIMARY KEY, agent_name TEXT NOT NULL, action TEXT NOT NULL,
        details TEXT, created_at TIMESTAMP DEFAULT NOW()
      )`
    },
  ];

  for (const t of tables) {
    try {
      await query(t.sql);
      console.log(`  Table ${t.name}: OK`);
    } catch (err) {
      console.error(`  Table ${t.name} FAILED:`, err.message);
    }
  }

  // Add columns to po_tracking if upgrading
  const colsToAdd = [
    ['buyer', 'TEXT'], ['style', 'TEXT'], ['units', 'INTEGER DEFAULT 0'],
    ['cartons', 'INTEGER DEFAULT 0'], ['lot', 'TEXT'], ['date_shipped', 'DATE'],
    ['routing_id', 'TEXT'],
  ];
  for (const [col, type] of colsToAdd) {
    try { await query(`ALTER TABLE po_tracking ADD COLUMN IF NOT EXISTS ${col} ${type}`); }
    catch (e) { /* column exists */ }
  }
  try { await query(`ALTER TABLE po_tracking DROP CONSTRAINT IF EXISTS po_tracking_po_number_key`); }
  catch (e) { /* ignore */ }

  // Add columns for existing tables
  await query('ALTER TABLE po_tracking ADD COLUMN IF NOT EXISTS shipment_info TEXT').catch(() => {});
  await query('ALTER TABLE containers ADD COLUMN IF NOT EXISTS cut_tickets TEXT').catch(() => {});

  console.log('Agent tables initialized');
}

initializeTables();

// Log agent activity
async function logAgentActivity(agentName, action, details = null) {
  try {
    await query(
      'INSERT INTO agent_logs (agent_name, action, details) VALUES ($1, $2, $3)',
      [agentName, action, details]
    );
  } catch (err) {
    console.error('Failed to log agent activity:', err);
  }
}

// ==================== PO TRACKING ====================

// GET /api/agents/po-search?q=SEARCH_TERM&type=po|cut_ticket|pick_ticket|so
router.get('/po-search', authMiddleware, async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

    let whereClause;
    const param = `%${q}%`;

    if (type === 'po') {
      whereClause = 'po_number ILIKE $1';
    } else if (type === 'cut_ticket') {
      // Search BOTH po_tracking AND production_data for cut tickets
      const poResult = await query(
        `SELECT *, 'po_tracking' as _source FROM po_tracking WHERE cut_ticket ILIKE $1 ORDER BY ship_window_start DESC NULLS LAST LIMIT 50`,
        [param]
      );
      const prodResult = await query(
        `SELECT *, 'production' as _source FROM production_data WHERE LOWER(ct) LIKE LOWER($1) ORDER BY due_date ASC NULLS LAST LIMIT 50`,
        [param]
      );
      const combined = [...prodResult.rows, ...poResult.rows];
      await logAgentActivity('Larry', 'po_search', `Searched cut tickets for: ${q}, found ${combined.length} (${prodResult.rows.length} production, ${poResult.rows.length} po_tracking)`);
      return res.json(combined);
    } else if (type === 'pick_ticket') {
      whereClause = 'pick_ticket ILIKE $1';
    } else if (type === 'so') {
      whereClause = 'so_number ILIKE $1';
    } else {
      // 'all' — search across all relevant fields in po_tracking AND production_data
      whereClause = 'po_number ILIKE $1 OR cut_ticket ILIKE $1 OR pick_ticket ILIKE $1 OR so_number ILIKE $1 OR buyer ILIKE $1 OR style ILIKE $1';
      const poResult = await query(
        `SELECT *, 'po_tracking' as _source FROM po_tracking WHERE ${whereClause} ORDER BY ship_window_start DESC NULLS LAST LIMIT 50`,
        [param]
      );
      const prodResult = await query(
        `SELECT *, 'production' as _source FROM production_data WHERE LOWER(ct) LIKE LOWER($1) OR LOWER(customer_po) LIKE LOWER($1) OR LOWER(style) LIKE LOWER($1) OR LOWER(vendor) LIKE LOWER($1) ORDER BY due_date ASC NULLS LAST LIMIT 50`,
        [param]
      );
      const combined = [...prodResult.rows, ...poResult.rows];
      await logAgentActivity('Larry', 'po_search', `Searched for: ${q} (type: all), found ${combined.length} (${prodResult.rows.length} production, ${poResult.rows.length} po_tracking)`);
      return res.json(combined);
    }

    const result = await query(
      `SELECT *, 'po_tracking' as _source FROM po_tracking WHERE ${whereClause} ORDER BY ship_window_start DESC NULLS LAST LIMIT 50`,
      [param]
    );

    await logAgentActivity('Larry', 'po_search', `Searched for: ${q} (type: ${type || 'all'}), found ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    console.error('PO search error:', err);
    res.status(500).json({ error: 'Failed to search POs' });
  }
});

// GET /api/agents/po-tracking - list POs with filters
router.get('/po-tracking', authMiddleware, async (req, res) => {
  try {
    const { status, warehouse, buyer, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM po_tracking WHERE 1=1';
    const params = [];
    let n = 1;

    if (status) { sql += ` AND routing_status = $${n++}`; params.push(status); }
    if (warehouse) { sql += ` AND warehouse = $${n++}`; params.push(warehouse); }
    if (buyer) { sql += ` AND buyer ILIKE $${n++}`; params.push(`%${buyer}%`); }

    sql += ` ORDER BY ship_window_start DESC NULLS LAST LIMIT $${n++} OFFSET $${n++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    const countResult = await query('SELECT COUNT(*) FROM po_tracking');

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('PO tracking list error:', err);
    res.status(500).json({ error: 'Failed to fetch PO tracking' });
  }
});

// GET /api/agents/po-summary - dashboard summary stats
router.get('/po-summary', authMiddleware, async (req, res) => {
  try {
    const total = await query('SELECT COUNT(*) as count FROM po_tracking');
    const byStatus = await query(
      `SELECT routing_status, COUNT(*) as count, SUM(units) as total_units
       FROM po_tracking GROUP BY routing_status ORDER BY count DESC`
    );
    const byBuyer = await query(
      `SELECT buyer, COUNT(*) as count, SUM(units) as total_units
       FROM po_tracking GROUP BY buyer ORDER BY total_units DESC LIMIT 10`
    );
    const byWarehouse = await query(
      `SELECT warehouse, COUNT(*) as count, SUM(units) as total_units
       FROM po_tracking WHERE warehouse IS NOT NULL GROUP BY warehouse ORDER BY count DESC`
    );
    const upcoming = await query(
      `SELECT COUNT(*) as count, SUM(units) as total_units FROM po_tracking
       WHERE ship_window_start >= CURRENT_DATE AND ship_window_start <= CURRENT_DATE + INTERVAL '14 days'`
    );
    const unrouted = await query(
      `SELECT COUNT(*) as count FROM po_tracking WHERE routing_status IN ('In Warehouse', 'In Transit')
       AND ship_window_start <= CURRENT_DATE + INTERVAL '14 days'`
    );

    res.json({
      total: parseInt(total.rows[0].count),
      by_status: byStatus.rows,
      by_buyer: byBuyer.rows,
      by_warehouse: byWarehouse.rows,
      upcoming_14_days: {
        count: parseInt(upcoming.rows[0].count || 0),
        units: parseInt(upcoming.rows[0].total_units || 0),
      },
      urgent_unrouted: parseInt(unrouted.rows[0].count || 0),
    });
  } catch (err) {
    console.error('PO summary error:', err);
    res.status(500).json({ error: 'Failed to get PO summary' });
  }
});

// POST /api/agents/po-tracking/bulk - bulk import POs
router.post('/po-tracking/bulk', authMiddleware, async (req, res) => {
  try {
    const { pos } = req.body;
    if (!Array.isArray(pos)) return res.status(400).json({ error: 'pos must be an array' });

    let imported = 0;
    for (const po of pos) {
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
        // Skip duplicates / errors
      }
    }

    await logAgentActivity('Larry', 'po_bulk_import', `Imported ${imported} of ${pos.length} POs`);
    res.json({ imported, total: pos.length });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to bulk import POs' });
  }
});

// ==================== ATS INVENTORY ====================

// GET /api/agents/ats - list ATS inventory
router.get('/ats', authMiddleware, async (req, res) => {
  try {
    const { warehouse, search } = req.query;
    let sql = 'SELECT * FROM ats_inventory WHERE 1=1';
    const params = [];
    let n = 1;

    if (warehouse) { sql += ` AND warehouse = $${n++}`; params.push(warehouse); }
    if (search) { sql += ` AND (style ILIKE $${n} OR color ILIKE $${n})`; params.push(`%${search}%`); n++; }

    sql += ' ORDER BY units DESC';
    const result = await query(sql, params);

    const summary = await query(
      `SELECT warehouse, COUNT(*) as sku_count, SUM(adj_units) as total_units
       FROM ats_inventory GROUP BY warehouse ORDER BY total_units DESC`
    );

    res.json({ data: result.rows, summary: summary.rows });
  } catch (err) {
    console.error('ATS fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch ATS data', detail: err.message });
  }
});

// POST /api/agents/ats/bulk - bulk import ATS data
router.post('/ats/bulk', authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

    // Clear existing data and reimport
    await query('DELETE FROM ats_inventory');

    let imported = 0;
    for (const item of items) {
      try {
        await query(
          `INSERT INTO ats_inventory (style, color, units, adj_units, warehouse, orders_expected, category)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [item.style, item.color || null, item.units || 0, item.adj_units || item.units || 0,
           item.warehouse || null, item.orders_expected || null, item.category || null]
        );
        imported++;
      } catch (err) { console.error('ATS bulk insert err:', err.message); }
    }

    await logAgentActivity('Larry', 'ats_import', `Imported ${imported} ATS records`);
    res.json({ imported });
  } catch (err) {
    console.error('ATS bulk import error:', err);
    res.status(500).json({ error: 'Failed to import ATS data' });
  }
});

// ==================== FINANCIAL DATA ====================

// GET /api/agents/financial - get financial summary
router.get('/financial', authMiddleware, async (req, res) => {
  try {
    const pl = await query(
      `SELECT line_item, month, amount, year FROM financial_data
       WHERE category = 'pl' ORDER BY line_item, year, month`
    );

    const model = await query(
      `SELECT line_item, year, amount FROM ua_model ORDER BY line_item, year`
    );

    res.json({ pl: pl.rows, model: model.rows });
  } catch (err) {
    console.error('Financial fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch financial data' });
  }
});

// GET /api/agents/financial/summary - quick financial KPIs
router.get('/financial/summary', authMiddleware, async (req, res) => {
  try {
    // Get revenue from P&L
    const revenue = await query(
      `SELECT month, amount FROM financial_data
       WHERE line_item = 'Sales' AND category = 'pl' ORDER BY year, month`
    );

    const totalRevenue = await query(
      `SELECT SUM(amount) as total FROM financial_data WHERE line_item = 'Sales' AND category = 'pl'`
    );

    const totalCogs = await query(
      `SELECT SUM(amount) as total FROM financial_data WHERE line_item = 'Total COGS' AND category = 'pl'`
    );

    // Model projections
    const projections = await query(
      `SELECT line_item, year, amount FROM ua_model WHERE year >= 2025 ORDER BY year`
    );

    res.json({
      ytd_revenue: parseFloat(totalRevenue.rows[0]?.total || 0),
      ytd_cogs: parseFloat(totalCogs.rows[0]?.total || 0),
      monthly_revenue: revenue.rows,
      projections: projections.rows,
    });
  } catch (err) {
    console.error('Financial summary error:', err);
    res.status(500).json({ error: 'Failed to get financial summary' });
  }
});

// POST /api/agents/financial/bulk - bulk import financial data
router.post('/financial/bulk', authMiddleware, async (req, res) => {
  try {
    const { pl_items, model_items } = req.body;
    let plImported = 0, modelImported = 0;

    if (Array.isArray(pl_items)) {
      await query("DELETE FROM financial_data WHERE category = 'pl'");
      for (const item of pl_items) {
        if (item.values) {
          for (const [month, amount] of Object.entries(item.values)) {
            try {
              // Extract year from month string like "Jan 25" → 2025
              const yearMatch = month.match(/(\d{2})$/);
              const year = yearMatch ? 2000 + parseInt(yearMatch[1]) : null;
              await query(
                `INSERT INTO financial_data (line_item, category, month, amount, year, source_file)
                 VALUES ($1, 'pl', $2, $3, $4, $5)`,
                [item.label, month, parseFloat(amount) || 0, year, item.source || 'Book2.xlsx']
              );
              plImported++;
            } catch (e) { /* skip */ }
          }
        }
      }
    }

    if (Array.isArray(model_items)) {
      await query('DELETE FROM ua_model');
      for (const item of model_items) {
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
    }

    await logAgentActivity('Gordon', 'financial_import', `Imported ${plImported} P&L entries, ${modelImported} model entries`);
    res.json({ pl_imported: plImported, model_imported: modelImported });
  } catch (err) {
    console.error('Financial bulk import error:', err);
    res.status(500).json({ error: 'Failed to import financial data' });
  }
});

// ==================== AGENT LOGS ====================

router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const { agent, limit = 100 } = req.query;
    let sql = 'SELECT * FROM agent_logs WHERE 1=1';
    const params = [];
    let n = 1;

    if (agent) { sql += ` AND agent_name = $${n++}`; params.push(agent); }
    sql += ` ORDER BY created_at DESC LIMIT $${n++}`;
    params.push(parseInt(limit));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Logs fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.post('/logs', authMiddleware, async (req, res) => {
  try {
    const { agent_name, action, details } = req.body;
    if (!agent_name || !action) return res.status(400).json({ error: 'agent_name and action are required' });

    const result = await query(
      'INSERT INTO agent_logs (agent_name, action, details) VALUES ($1, $2, $3) RETURNING *',
      [agent_name, action, details || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Log creation error:', err);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
});

// ==================== DASHBOARD OVERVIEW ====================

// GET /api/agents/dashboard - combined dashboard stats for Claudia
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const [poCount, atsCount, finCount, logCount] = await Promise.all([
      query('SELECT COUNT(*) as count FROM po_tracking').catch(() => ({ rows: [{ count: 0 }] })),
      query('SELECT COUNT(*) as count, SUM(adj_units) as total_units FROM ats_inventory').catch(() => ({ rows: [{ count: 0, total_units: 0 }] })),
      query("SELECT COUNT(DISTINCT line_item) as count FROM financial_data WHERE category = 'pl'").catch(() => ({ rows: [{ count: 0 }] })),
      query('SELECT COUNT(*) as count FROM agent_logs').catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const recentLogs = await query(
      'SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT 20'
    ).catch(() => ({ rows: [] }));

    res.json({
      larry: {
        po_count: parseInt(poCount.rows[0].count || 0),
        ats_skus: parseInt(atsCount.rows[0].count || 0),
        ats_total_units: parseInt(atsCount.rows[0].total_units || 0),
      },
      gordon: {
        pl_line_items: parseInt(finCount.rows[0].count || 0),
      },
      activity: recentLogs.rows,
      total_logs: parseInt(logCount.rows[0].count || 0),
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ==================== AUTO-IMPORT FROM FILES ====================

// POST /api/agents/import - import all data from server/data/ JSON files
router.post('/import', authMiddleware, async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '..', 'data');
  const results = { po: 0, ats: 0, pl: 0, model: 0 };

  try {
    // Import PO Tracking
    const poPath = path.join(dataDir, 'po_tracking.json');
    if (fs.existsSync(poPath)) {
      const records = JSON.parse(fs.readFileSync(poPath, 'utf8'));
      await query('DELETE FROM po_tracking');
      for (const po of records) {
        try {
          await query(
            `INSERT INTO po_tracking
             (po_number, cut_ticket, so_number, pick_ticket, routing_status, routing_id,
              ship_window_start, ship_window_end, warehouse, factory_status, eta, carrier,
              buyer, style, units, cartons, lot, date_shipped, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
            [po.po_number, po.cut_ticket || null, po.so_number || null, po.pick_ticket || null,
             po.routing_status || 'Not Routed', po.routing_id || null,
             po.ship_window_start || null, po.ship_window_end || null,
             po.warehouse || null, po.factory_status || null, po.eta || null, po.carrier || null,
             po.buyer || null, po.style || null, po.units || 0, po.cartons || 0,
             po.lot || null, po.date_shipped || null, po.notes || null]
          );
          results.po++;
        } catch (e) { /* skip bad records */ }
      }
      await logAgentActivity('Larry', 'file_import', `Imported ${results.po} PO records from file`);
    }

    // Import ATS
    const atsPath = path.join(dataDir, 'ats_data.json');
    if (fs.existsSync(atsPath)) {
      const items = JSON.parse(fs.readFileSync(atsPath, 'utf8'));
      console.log(`ATS file found with ${items.length} records`);
      // Drop and recreate table to ensure correct schema
      await query('DROP TABLE IF EXISTS ats_inventory');
      await query(`CREATE TABLE ats_inventory (
        id SERIAL PRIMARY KEY, style TEXT NOT NULL, color TEXT,
        units INTEGER DEFAULT 0, adj_units INTEGER DEFAULT 0,
        warehouse TEXT, orders_expected TEXT, category TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`);
      await query('DELETE FROM ats_inventory');
      for (const item of items) {
        try {
          await query(
            `INSERT INTO ats_inventory (style, color, units, adj_units, warehouse, orders_expected)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [item.style, item.color, item.units || 0, item.adj_units || item.units || 0,
             item.warehouse, item.orders_expected || null]
          );
          results.ats++;
        } catch (e) { console.error('ATS insert error:', e.message); }
      }
      console.log(`ATS import: ${results.ats}/${items.length} records`);
      await logAgentActivity('Larry', 'file_import', `Imported ${results.ats} ATS records from file`);
    }

    // Import P&L
    const plPath = path.join(dataDir, 'pl_data.json');
    if (fs.existsSync(plPath)) {
      const plItems = JSON.parse(fs.readFileSync(plPath, 'utf8'));
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
              results.pl++;
            } catch (e) { /* skip */ }
          }
        }
      }
      await logAgentActivity('Gordon', 'file_import', `Imported ${results.pl} P&L entries from file`);
    }

    // Import UA Model
    const modelPath = path.join(dataDir, 'ua_model.json');
    if (fs.existsSync(modelPath)) {
      const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      await query('DELETE FROM ua_model');
      for (const item of (modelData.line_items || [])) {
        if (item.values) {
          for (const [year, amount] of Object.entries(item.values)) {
            try {
              await query(
                'INSERT INTO ua_model (line_item, year, amount) VALUES ($1, $2, $3)',
                [item.label, parseInt(year), parseFloat(amount) || 0]
              );
              results.model++;
            } catch (e) { /* skip */ }
          }
        }
      }
      await logAgentActivity('Gordon', 'file_import', `Imported ${results.model} model entries from file`);
    }

    res.json({ success: true, imported: results });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed', details: err.message });
  }
});

// ==================== FILE UPLOAD: FOR LARRY'S EYES ONLY ====================

// Helper: parse "For Larry's Eyes Only" workbook into PO records
// Normalize a header string for fuzzy matching: lowercase, strip spaces/punctuation
function normKey(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper: find a value from a row trying multiple possible header names (fuzzy)
// First tries exact match, then falls back to normalized matching
function col(row, ...names) {
  // Exact match first
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== '') return row[n];
  }
  // Fuzzy match: normalize both the target names and the row keys
  const normNames = names.map(normKey);
  for (const key of Object.keys(row)) {
    const nk = normKey(key);
    for (const nn of normNames) {
      if (nk === nn && row[key] !== undefined && row[key] !== '') return row[key];
    }
  }
  return '';
}

// Helper: parse a date value (could be Excel serial number or string)
function parseDate(raw) {
  if (!raw && raw !== 0) return null;
  try {
    if (typeof raw === 'number') {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  } catch (e) { /* skip */ }
  return null;
}

function parseLarrySheet(workbook) {
  const records = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const location = sheetName.toUpperCase(); // STAR or CSM

    console.log(`[Larry Parse] Sheet "${sheetName}": ${data.length} data rows`);
    if (data.length > 0) {
      console.log(`[Larry Parse] Headers:`, Object.keys(data[0]).join(', '));
    }

    for (const row of data) {
      // PO number — STAR uses "PO", CSM uses "PO#"
      const po = String(col(row, 'PO', 'PO#', 'PO #')).trim();
      if (!po) continue;

      // Ticket number from sheet
      const ticketNum = String(col(row, 'Ticket #', 'Ticket#', 'TICKET #', 'Ticket')).trim() || null;

      // Shipped status — STAR uses "SHIPPED" column, CSM uses 'SHIPPED "YES"'
      const shipped = String(col(row, 'SHIPPED', 'Shipped', 'SHIPPED "YES"', 'SHIPPED YES')).toUpperCase();

      const style = String(col(row, 'Styles', 'Style', 'STYLES')).trim();
      const lot = String(col(row, 'Lot', 'LOT')).trim();
      const units = parseInt(String(col(row, 'Units', 'UNITS') || 0).toString().replace(/[^0-9]/g, '')) || 0;
      const cartons = parseInt(String(col(row, 'Cartons', 'CARTONS') || 0).toString().replace(/[^0-9]/g, '')) || 0;
      const carrier = String(col(row, 'CARRIER', 'Carrier')).trim();

      // Routing column — on STAR this can be a text status ("CANCELLED") OR a numeric routing ID
      const routingRaw = String(col(row, 'Routing', 'ROUTING')).trim();

      // Routing ID — STAR: "LOAD ID NUMBER" or the "Routing" column if numeric; CSM: "ROUTING CONF#"
      let routingId = String(col(row, 'LOAD ID NUMBER', 'D ID NUM', 'D ID NUMBER', 'Routing ID', 'ROUTING CONF#', 'ROUTING CONF')).trim();

      // On STAR, if LOAD ID NUMBER is empty but "Routing" contains a routing ID, extract it
      if (!routingId && routingRaw) {
        if (/^\d+$/.test(routingRaw)) {
          // Pure numeric — that IS the routing ID
          routingId = routingRaw;
        } else if (/^[A-Z]{1,4}\s*(\d{5,})$/i.test(routingRaw)) {
          // Prefixed routing IDs: "RTS 39535334", "TS 3953533", "S000101600", "D860602" etc.
          routingId = routingRaw.match(/(\d{5,})/)[1];
        } else if (/^ROUTED$/i.test(routingRaw)) {
          // "ROUTED" text with no ID — mark as routed
          routingId = 'ROUTED';
        }
      }

      // Determine the routing text (non-numeric values like "CANCELLED", "LAST CANCELLED")
      const hasRoutingId = /^\d+$/.test(routingRaw) || /^[A-Z]{1,4}\s*\d{5,}$/i.test(routingRaw) || /^ROUTED$/i.test(routingRaw);
      const routing = hasRoutingId ? '' : routingRaw;

      // Date shipped — STAR uses "LOAD ID DATE" or "DATE SHIPPED", CSM uses "SHIPPED DATE"
      const dateShippedRaw = col(row, 'LOAD ID DATE', 'DAD ID DATE', 'DATE SHIPPED', 'Date Shipped', 'SHIPPED DATE', 'Shipped Date');

      // Parse dates
      const startRaw = col(row, 'Start Date', 'START DATE', 'Ship Start');
      const cancelRaw = col(row, 'Cancel Date', 'ancel Date', 'CANCEL DATE', 'Cancel Dat', 'CXL date', 'CXL Date', 'CXL DATE');

      const shipStart = parseDate(startRaw);
      const shipEnd = parseDate(cancelRaw);
      const dateShippedParsed = parseDate(dateShippedRaw);

      // Determine status
      let status = 'In Warehouse';
      const routingUpper = routing.toUpperCase();
      const routingIdUpper = routingId.toUpperCase();
      // Check both routing text (STAR) and routing conf# (CSM) for cancelled/special values
      const isCancelled = routingUpper === 'CANCELLED' || routingUpper.includes('CANCEL')
        || routingIdUpper === 'CANCELLED' || routingIdUpper.includes('CANCELLED');
      const isNotOnPortal = routingIdUpper.includes('NOT ON PORTAL');
      const isShipped = shipped === 'YES' || shipped === 'DISREGARDED' || shipped === 'DISREGARD'
        || (dateShippedParsed && shipped !== 'NO');
      // routingId is "routed" only if it looks like an actual ID (numeric or alphanumeric code)
      const isRouted = routingId && routingId.length > 0
        && !isCancelled && !isNotOnPortal
        && !routingIdUpper.includes('REPLACED');

      if (isCancelled && !isShipped) {
        status = 'Cancelled';
      } else if (isShipped) {
        status = 'Shipped';
      } else if (isRouted) {
        status = 'Routed';
      } else {
        status = 'In Warehouse';
      }

      // Debug: log specific PO to trace routing issue
      if (po === '1122490' || String(po).includes('1122490')) {
        console.log(`[Larry Debug] PO 1122490 found on sheet "${sheetName}":`);
        console.log(`  Raw row keys:`, Object.keys(row).join(', '));
        console.log(`  Raw row values:`, JSON.stringify(row));
        console.log(`  routingId="${routingId}", routing="${routing}", shipped="${shipped}"`);
        console.log(`  isCancelled=${isCancelled}, isShipped=${isShipped}, isRouted=${isRouted}`);
        console.log(`  Final status: ${status}`);
      }

      const warehouse = location;
      const storeVal = String(col(row, 'STORE', 'Store')).trim();
      const comments = String(col(row, 'COMMENTS', 'Comments', 'LABEL', 'Label')).trim();

      records.push({
        po_number: po,
        cut_ticket: ticketNum,
        so_number: null,
        pick_ticket: null,
        routing_status: status,
        routing_id: routingId || null,
        ship_window_start: shipStart,
        ship_window_end: shipEnd,
        warehouse: warehouse || storeVal || null,
        factory_status: null,
        eta: null,
        carrier: carrier || null,
        buyer: storeVal || null,
        style: style || null,
        units: units,
        cartons: cartons,
        lot: lot || null,
        date_shipped: dateShippedParsed,
        notes: comments || (storeVal ? `Store: ${storeVal}` : null),
      });
    }
  }

  console.log(`[Larry Parse] Total records parsed: ${records.length}`);
  const breakdown = {};
  records.forEach(r => { breakdown[r.routing_status] = (breakdown[r.routing_status] || 0) + 1; });
  console.log(`[Larry Parse] Status breakdown:`, JSON.stringify(breakdown));

  return records;
}

// POST /api/agents/larry/upload - Upload and parse "For Larry's Eyes Only"
router.post('/larry/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const records = parseLarrySheet(workbook);

    // Clean up temp file
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

    if (records.length === 0) {
      return res.status(400).json({ error: 'No PO records found in the spreadsheet' });
    }

    // Clear existing "For Larry's Eyes Only" data and reimport
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
          [po.po_number, po.cut_ticket, po.so_number, po.pick_ticket,
           po.routing_status, po.routing_id, po.ship_window_start, po.ship_window_end,
           po.warehouse, po.factory_status, po.eta, po.carrier,
           po.buyer, po.style, po.units, po.cartons,
           po.lot, po.date_shipped, po.notes]
        );
        imported++;
      } catch (e) { /* skip bad records */ }
    }

    // Populate cut_ticket from cut_tickets table by matching PO number
    await query(`
      UPDATE po_tracking pt
      SET cut_ticket = ct.ct_number
      FROM cut_tickets ct
      WHERE pt.po_number = ct.po
        AND ct.ct_number IS NOT NULL
        AND ct.ct_number != ''
    `);


    // Count by status
    const statusBreakdown = {};
    records.forEach(r => { statusBreakdown[r.routing_status] = (statusBreakdown[r.routing_status] || 0) + 1; });

    await logAgentActivity('Larry', 'larry_upload', `Uploaded For Larry's Eyes Only: ${imported} POs imported. Breakdown: ${JSON.stringify(statusBreakdown)}`);

    res.json({
      success: true,
      imported,
      total_parsed: records.length,
      sheets: workbook.SheetNames,
      status_breakdown: statusBreakdown,
    });
  } catch (err) {
    console.error('Larry upload error:', err);
    // Clean up temp file on error
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: 'Failed to parse spreadsheet', details: err.message });
  }
});

// POST /api/agents/larry/upload-url - Fetch and parse Google Sheet by URL
router.post('/larry/upload-url', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Extract Google Sheet ID from URL
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return res.status(400).json({ error: 'Invalid Google Sheets URL' });

    const sheetId = match[1];

    // Fetch xlsx export from Google Sheets using native fetch (Node 22+)
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(exportUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
        redirect: 'follow',
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        throw new Error('Timed out fetching Google Sheet (30s). Check your internet connection and that the sheet is publicly shared.');
      }
      throw new Error('Network error fetching Google Sheet: ' + fetchErr.message);
    }
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Google returned status ${response.status}. Make sure the sheet is shared as "Anyone with the link".`);
    }

    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const head = buffer.slice(0, 100).toString('utf8');
    if (head.includes('<!DOCTYPE') || head.includes('<html')) {
      throw new Error('Google Sheet is not publicly shared. Set sharing to "Anyone with the link" → Viewer.');
    }
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Log sheet structure for debugging
    for (const name of workbook.SheetNames) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '' });
      if (data.length > 0) {
        console.log(`[Larry Sync] Sheet "${name}": ${data.length} rows, headers:`, Object.keys(data[0]));
        // Log first row to check column mapping
        console.log(`[Larry Sync] Sheet "${name}" first row:`, JSON.stringify(data[0]));
      } else {
        console.log(`[Larry Sync] Sheet "${name}": EMPTY`);
      }
    }

    const records = parseLarrySheet(workbook);

    if (records.length === 0) {
      return res.status(400).json({ error: 'No PO records found in the Google Sheet' });
    }

    // Clear ALL po_tracking and reimport — prevents stale/sparse orphan
    // entries (e.g. rows with NULL warehouse) from surviving the sync.
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
          [po.po_number, po.cut_ticket, po.so_number, po.pick_ticket,
           po.routing_status, po.routing_id, po.ship_window_start, po.ship_window_end,
           po.warehouse, po.factory_status, po.eta, po.carrier,
           po.buyer, po.style, po.units, po.cartons,
           po.lot, po.date_shipped, po.notes]
        );
        imported++;
      } catch (e) { /* skip */ }
    }

    // Populate cut_ticket from cut_tickets table by matching PO number
    await query(`
      UPDATE po_tracking pt
      SET cut_ticket = ct.ct_number
      FROM cut_tickets ct
      WHERE pt.po_number = ct.po
        AND ct.ct_number IS NOT NULL
        AND ct.ct_number != ''
    `);

    // Deduplicate: when the same PO has multiple entries, keep the most
    // complete one (most populated fields) and delete sparser duplicates.
    // Uses JS logic since the mock DB can't handle complex subqueries.
    try {
      const allRows = await query('SELECT * FROM po_tracking ORDER BY id');
      const byPo = {};
      for (const row of allRows.rows) {
        const key = row.po_number || row.po;
        if (!key) continue;
        if (!byPo[key]) byPo[key] = [];
        byPo[key].push(row);
      }
      let dedupCount = 0;
      for (const [, entries] of Object.entries(byPo)) {
        if (entries.length <= 1) continue;
        // Score each entry by how many key fields are populated
        const scored = entries.map(e => ({
          id: e.id,
          score: [e.warehouse, e.cut_ticket, e.style, e.routing_id, e.lot].filter(v => v && v !== '').length
                 + [e.units, e.cartons].filter(v => v && v > 0).length
        }));
        const maxScore = Math.max(...scored.map(s => s.score));
        // Delete all entries that score below the best
        for (const s of scored) {
          if (s.score < maxScore) {
            await query('DELETE FROM po_tracking WHERE id = $1', [s.id]);
            dedupCount++;
          }
        }
      }
      if (dedupCount > 0) {
        console.log(`[Larry Sync] Dedup: removed ${dedupCount} sparse duplicate PO entries`);
      }
    } catch (dedupErr) {
      console.error('[Larry Sync] Dedup error (non-fatal):', dedupErr.message);
    }

    const statusBreakdown = {};
    records.forEach(r => { statusBreakdown[r.routing_status] = (statusBreakdown[r.routing_status] || 0) + 1; });

    await logAgentActivity('Larry', 'larry_gsheet', `Fetched Google Sheet: ${imported} POs imported`);

    res.json({ success: true, imported, total_parsed: records.length, sheets: workbook.SheetNames, status_breakdown: statusBreakdown });
  } catch (err) {
    console.error('Google Sheet fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch Google Sheet', details: err.message });
  }
});

// GET /api/agents/two-week-report - POs shipping within next 14 days (printer-friendly data)
router.get('/two-week-report', authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM po_tracking
       WHERE ship_window_start >= CURRENT_DATE
       AND ship_window_start <= CURRENT_DATE + INTERVAL '14 days'
       AND routing_status NOT IN ('Cancelled', 'Shipped')
       ORDER BY ship_window_start ASC, warehouse, po_number`
    );

    // Also include items that are In Warehouse or Routed (regardless of ship date)
    const inWarehouse = await query(
      `SELECT * FROM po_tracking
       WHERE routing_status IN ('In Warehouse', 'Routed')
       AND (ship_window_start IS NULL OR ship_window_start <= CURRENT_DATE + INTERVAL '14 days')
       ORDER BY ship_window_start ASC NULLS LAST, warehouse, po_number`
    );

    // Merge, deduplicate by id
    const allMap = {};
    [...result.rows, ...inWarehouse.rows].forEach(r => { allMap[r.id] = r; });
    const all = Object.values(allMap).sort((a, b) => {
      if (!a.ship_window_start) return 1;
      if (!b.ship_window_start) return -1;
      return new Date(a.ship_window_start) - new Date(b.ship_window_start);
    });

    // Summary stats
    const byStatus = {};
    const byWarehouse = {};
    all.forEach(r => {
      byStatus[r.routing_status] = (byStatus[r.routing_status] || 0) + 1;
      if (r.warehouse) byWarehouse[r.warehouse] = (byWarehouse[r.warehouse] || 0) + 1;
    });

    // Strip style, units, cartons from each item
    const items = all.map(({ style, units, cartons, ...rest }) => rest);

    res.json({
      report_date: new Date().toISOString().split('T')[0],
      window_start: new Date().toISOString().split('T')[0],
      window_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      total_pos: items.length,
      routed: byStatus['Routed'] || 0,
      not_routed_in_warehouse: byStatus['In Warehouse'] || 0,
      by_status: byStatus,
      by_warehouse: byWarehouse,
      items,
    });
  } catch (err) {
    console.error('Two week report error:', err);
    res.status(500).json({ error: 'Failed to generate two week report' });
  }
});

// POST /api/agents/ats/upload - Upload and parse ATS inventory file
router.post('/ats/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    try { fs.unlinkSync(filePath); } catch (e) {}

    // Find the right sheet — prefer "ATS Tracker", then any with ATS/Inventory/Consolidated
    let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('ats tracker'))
      || workbook.SheetNames.find(s =>
        s.toUpperCase().includes('ATS') || s.toUpperCase().includes('INVENTORY') || s.toUpperCase().includes('CONSOLIDATED')
      ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    // Convert to array of arrays to find the header row dynamically
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find the header row by looking for a row containing "Style" in some form
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const rowStr = rawData[i].map(c => String(c).toLowerCase()).join('|');
      if (rowStr.includes('style') && (rowStr.includes('color') || rowStr.includes('ats') || rowStr.includes('units'))) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = rawData[headerRowIdx].map(h => String(h).trim());
    const dataRows = rawData.slice(headerRowIdx + 1);

    const items = [];
    let currentLot = '';
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const cells = dataRows[rowIdx];

      // Stop at "Total ATS" summary row or after ~100 data rows past the header
      const possibleTotal = String(cells[3] || '').trim().toLowerCase();
      if (possibleTotal.includes('total ats') || possibleTotal.includes('total units')) break;

      // Hard cap: don't read past 100 data rows (covers header offset)
      const excelRow = headerRowIdx + 1 + rowIdx + 1; // 1-based Excel row
      if (excelRow > 105) break;

      // Build a row object keyed by header
      const row = {};
      headers.forEach((h, j) => { if (h) row[h] = cells[j] !== undefined ? cells[j] : ''; });

      // Detect lot group headers (e.g., "101 Lot") — a row where col B has text containing "Lot"
      const firstVal = String(cells[1] || '').trim();
      if (firstVal && /lot$/i.test(firstVal) && !String(cells[3] || '').trim()) {
        currentLot = firstVal.replace(/\s*lot\s*$/i, '').trim();
        continue;
      }

      // Flexible column matching
      const style = String(row['Style No'] || row['Style'] || row['STYLE'] || row['style'] || row['Style #'] || '').trim();
      if (!style) continue; // skip empty rows
      // Use ATS column strictly — "Units" column is a separate field, not a fallback
      const atsRaw = row['ATS'] !== undefined && row['ATS'] !== '' ? row['ATS'] : null;
      const unitsVal = atsRaw !== null
        ? (parseInt(String(atsRaw).replace(/[^0-9]/g, '')) || 0)
        : (parseInt(String(row['Qty'] || row['QTY'] || row['Available'] || 0).toString().replace(/[^0-9]/g, '')) || 0);
      // Allow text-like styles (e.g. "Multiple") if they have ATS data
      if (/^[a-z\s]+$/i.test(style) && unitsVal === 0) continue; // skip text-only rows with no units

      const color = String(row['Color'] || row['COLOR'] || row['Colour'] || row['CLR'] || '').trim();
      const units = unitsVal;
      const warehouse = String(row['WH'] || row['Warehouse'] || row['WAREHOUSE'] || row['Location'] || '').trim();
      const category = String(row['Category'] || row['CATEGORY'] || row['Cat'] || row['Dept'] || '').trim();
      const lot = String(row['Lot'] || row['LOT'] || row['Shipment'] || '').trim() || currentLot;
      const vendor_inv = String(row['Vendor Invoice'] || row['Vendor Invoice '] || row['VENDOR INVOICE'] || row['VInv'] || '').trim();
      const ct = String(row['CT'] || row['Cut Ticket'] || row['CUT TICKET'] || '').trim();
      const eta = String(row['ETA'] || row['Eta'] || '').trim();
      const buyer = String(row['Buyer'] || row['BUYER'] || '').trim();
      const remarks = String(row['Remarks'] || row['REMARKS'] || row['Notes'] || '').trim();
      const picked = parseInt(String(row['Units'] || row['Picked'] || 0).toString().replace(/[^0-9]/g, '')) || 0;

      items.push({ style, color, units, adj_units: units, warehouse, orders_expected: '', category, lot, vendor_inv, ct, eta, buyer, remarks, picked });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No ATS records found in the spreadsheet' });
    }

    // Attach contractor name to each item by cross-referencing CT Tracker
    try {
      const ctSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('ct tracker'));
      if (ctSheetName) {
        const ctSheet = workbook.Sheets[ctSheetName];
        const ctRaw = XLSX.utils.sheet_to_json(ctSheet, { header: 1, defval: '' });
        const ctToContractor = {};
        for (let i = 1; i < ctRaw.length; i++) {
          const cutno = String(ctRaw[i][1] || '').trim();
          const contractor = String(ctRaw[i][6] || '').trim();
          if (cutno && contractor) ctToContractor[cutno] = contractor;
        }
        // Stamp contractor onto each item
        for (const item of items) {
          item.contractor = item.ct && ctToContractor[item.ct] ? ctToContractor[item.ct] : '';
        }
        console.log('[ATS] Attached contractor to items. Sample:', items.slice(0, 3).map(i => i.ct + '->' + i.contractor));
      }
    } catch (e) {
      console.error('[ATS] CT Tracker parsing error:', e.message);
    }

    // DB operations (non-critical — wrap in try/catch so they don't kill the response)
    let imported = 0;
    try {
      await query('DROP TABLE IF EXISTS ats_inventory');
      await query(`CREATE TABLE ats_inventory (
        id SERIAL PRIMARY KEY, style TEXT NOT NULL, color TEXT,
        units INTEGER DEFAULT 0, adj_units INTEGER DEFAULT 0,
        warehouse TEXT, orders_expected TEXT, category TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`);
      for (const item of items) {
        try {
          await query(
            `INSERT INTO ats_inventory (style, color, units, adj_units, warehouse, orders_expected)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [item.style, item.color, item.units, item.adj_units, item.warehouse, item.orders_expected]
          );
          imported++;
        } catch (e) { /* skip */ }
      }
      await logAgentActivity('Larry', 'ats_upload', `Uploaded ATS inventory: ${imported} records from ${sheetName}`);
    } catch (dbErr) {
      console.error('[ATS] DB save error (non-critical):', dbErr.message);
    }

    // Return parsed items (contractor is now a field on each item)
    res.json({ success: true, imported, total_parsed: items.length, sheet: sheetName, items });
  } catch (err) {
    console.error('ATS upload error:', err);
    if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.status(500).json({ error: 'Failed to parse ATS spreadsheet', details: err.message });
  }
});

// POST /api/agents/larry/bulk-import - Bulk import PO records as JSON
router.post('/larry/bulk-import', authMiddleware, async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided' });
    }

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
          [po.po_number, po.cut_ticket, po.so_number, po.pick_ticket,
           po.routing_status, po.routing_id, po.ship_window_start, po.ship_window_end,
           po.warehouse, po.factory_status, null, po.carrier,
           po.buyer, po.style, po.units || 0, po.cartons || 0,
           po.lot, po.date_shipped, po.notes]
        );
        imported++;
      } catch (e) { /* skip bad records */ }
    }

    // Populate cut_ticket from cut_tickets table by matching PO number
    await query(`
      UPDATE po_tracking pt
      SET cut_ticket = ct.ct_number
      FROM cut_tickets ct
      WHERE pt.po_number = ct.po
        AND ct.ct_number IS NOT NULL
        AND ct.ct_number != ''
    `);


    await logAgentActivity('Larry', 'bulk_import', `Bulk imported ${imported} of ${records.length} PO records`);
    res.json({ success: true, imported, total: records.length });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Failed to bulk import', details: err.message });
  }
});

// ==================== JAZZY — TREND SCOUT AGENT ====================

// Helper: fetch product image from a page URL (tries multiple strategies)
const https = require('https');
const http = require('http');

// Validate a URL returns HTTP 200 (not 404/redirect-to-homepage)
function validateProductUrl(url, depth = 0) {
  return new Promise((resolve) => {
    if (!url || depth > 3) return resolve(false);
    try {
      const lib = url.startsWith('https') ? https : http;
      const parsedUrl = new URL(url);
      const req = lib.request(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 8000,
      }, (res) => {
        // Follow redirects (but detect homepage/dead-end redirects as invalid)
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          let loc = res.headers.location;
          if (loc.startsWith('/')) loc = parsedUrl.protocol + '//' + parsedUrl.host + loc;
          try {
            const redirectUrl = new URL(loc);
            const rp = redirectUrl.pathname.toLowerCase();
            // Dead-end patterns: homepage, search, /None, generic error pages
            if (rp === '/' || rp.includes('/search') || rp === '/none' ||
                rp.includes('/404') || rp.includes('/not-found') ||
                rp.includes('/error') || rp.endsWith('/None')) {
              console.log(`[validateUrl] ${url.slice(0, 60)} → redirected to dead-end (${rp}), invalid`);
              return resolve(false);
            }
          } catch {}
          return validateProductUrl(loc, depth + 1).then(resolve);
        }
        // For 200 responses, do a GET to check the final URL isn't a soft 404
        if (res.statusCode === 200) {
          // Additional check: the URL path should look product-like
          const p = parsedUrl.pathname.toLowerCase();
          if (p === '/none' || p === '/' || p.endsWith('/none')) {
            return resolve(false);
          }
          return resolve(true);
        }
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function fetchPageHtml(url, depth = 0) {
  return new Promise((resolve) => {
    if (!url || depth > 5) return resolve('');
    const lib = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
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
      timeout: 3000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(url);
          loc = u.protocol + '//' + u.host + loc;
        } else if (!loc.startsWith('http')) {
          loc = parsedUrl.origin + '/' + loc;
        }
        return fetchPageHtml(loc, depth + 1).then(resolve);
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { html += chunk; if (html.length > 300000) res.destroy(); });
      res.on('end', () => resolve(html));
      res.on('error', () => resolve(html));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

function extractImageFromHtml(html, sourceUrl) {
  if (!html) return null;

  // Strategy 1: og:image meta tag
  const ogMatch = html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
  if (ogMatch && ogMatch[1] && !isGenericImage(ogMatch[1])) return ogMatch[1];

  // Strategy 2: twitter:image meta tag
  const twMatch = html.match(/<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i);
  if (twMatch && twMatch[1] && !isGenericImage(twMatch[1])) return twMatch[1];

  // Strategy 3: JSON-LD structured data (Product schema)
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const img = findImageInJsonLd(data);
        if (img && !isGenericImage(img)) return img;
      } catch { /* skip bad JSON */ }
    }
  }

  // Strategy 4: Look for product image patterns in HTML
  // Many retail sites use data attributes or specific class names
  const productImgMatch = html.match(/<img[^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp)[^"']*["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*(?:product|hero|primary|main|pdp)[^"']*["']/i);
  if (productImgMatch && productImgMatch[1] && !isGenericImage(productImgMatch[1])) {
    return makeAbsolute(productImgMatch[1], sourceUrl);
  }

  // Strategy 5: data-src or data-zoom-image (lazy loaded images)
  const lazySrcMatch = html.match(/data-(?:src|zoom-image|large-image|full-image)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
  if (lazySrcMatch && lazySrcMatch[1] && !isGenericImage(lazySrcMatch[1])) {
    return makeAbsolute(lazySrcMatch[1], sourceUrl);
  }

  // Strategy 6: "image" key in any inline JSON
  const inlineJson = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || html.match(/"imageUrl"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
    || html.match(/"productImage"\s*:\s*"(https?:\/\/[^"]+)"/i);
  if (inlineJson && inlineJson[1] && !isGenericImage(inlineJson[1])) return inlineJson[1];

  // Strategy 7: First large image on the page (likely product image)
  const allImgs = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["'][^>]*>/gi);
  if (allImgs) {
    for (const imgTag of allImgs.slice(0, 10)) {
      const srcMatch = imgTag.match(/src=["'](https?:\/\/[^"']+)["']/i);
      if (srcMatch && srcMatch[1] && !isGenericImage(srcMatch[1]) && !isIconOrLogo(srcMatch[1])) {
        return srcMatch[1];
      }
    }
  }

  return null;
}

function findImageInJsonLd(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = findImageInJsonLd(item);
      if (img) return img;
    }
    return null;
  }
  if (typeof data !== 'object') return null;
  // Check if this is a Product type
  if (data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') {
    if (data.image) {
      if (typeof data.image === 'string') return data.image;
      if (Array.isArray(data.image) && data.image[0]) {
        return typeof data.image[0] === 'string' ? data.image[0] : data.image[0].url;
      }
      if (data.image.url) return data.image.url;
      if (data.image.contentUrl) return data.image.contentUrl;
    }
  }
  // Check @graph
  if (data['@graph']) return findImageInJsonLd(data['@graph']);
  // Generic image field on any object
  if (data.image && typeof data.image === 'string' && data.image.match(/\.(jpg|jpeg|png|webp)/i)) return data.image;
  return null;
}

function isGenericImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return lower.includes('unsplash.com') || lower.includes('placeholder') ||
    lower.includes('stock') || lower.includes('default') ||
    lower.includes('logo') || lower.includes('favicon') ||
    lower.includes('blank') || lower.includes('spacer') ||
    lower.includes('pixel.gif') || lower.includes('1x1');
}

function isIconOrLogo(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return lower.includes('icon') || lower.includes('logo') ||
    lower.includes('favicon') || lower.includes('sprite') ||
    lower.includes('badge') || lower.includes('flag') ||
    lower.includes('/svg/') || lower.endsWith('.svg') ||
    lower.includes('tracking') || lower.includes('analytics');
}

function makeAbsolute(imgUrl, pageUrl) {
  if (!imgUrl) return imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  try {
    const base = new URL(pageUrl);
    return base.protocol + '//' + base.host + (imgUrl.startsWith('/') ? '' : '/') + imgUrl;
  } catch { return imgUrl; }
}

// Retailer-specific image fetching strategies
async function fetchUrbnImage(url) {
  // URBN brands (Anthropologie, Urban Outfitters, Free People) use images.urbndata.com
  // Their pages redirect /shop/slug -> /shop/hybrid/slug and have og:image in the HTML
  // Also try their catalog API which returns JSON with image data
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;
    const slug = parsedUrl.pathname.split('/').pop();

    if (!slug) return null;

    // Try the catalog API first (returns JSON with product images)
    let brand = 'Anthropologie';
    if (host.includes('urbanoutfitters')) brand = 'UrbanOutfitters';
    else if (host.includes('freepeople')) brand = 'FreePeople';

    const apiUrl = `https://www.${host.replace('www.', '')}/api/catalog/v0/extracts/by-slug/${slug}`;
    console.log('[Woodcock] Trying URBN API:', apiUrl);
    const apiHtml = await fetchPageHtml(apiUrl);
    if (apiHtml) {
      try {
        const data = JSON.parse(apiHtml);
        // Look for image in the API response
        const img = data?.product?.defaultImage || data?.product?.images?.[0]?.url
          || data?.product?.media?.[0]?.url || data?.displayImage;
        if (img) {
          const finalImg = img.startsWith('//') ? 'https:' + img : img;
          console.log('[Woodcock] URBN API image:', finalImg.slice(0, 80));
          return finalImg;
        }
      } catch { /* not JSON, try HTML */ }
    }

    // Try constructing direct CDN URL patterns for URBN
    // Pattern: https://images.urbndata.com/is/image/{Brand}/{productId}_001
    // We can try the slug itself as a search term in their search API
    const searchUrl = `https://www.${host.replace('www.', '')}/api/catalog/v0/search?query=${encodeURIComponent(slug.replace(/-/g, ' '))}&count=1`;
    console.log('[Woodcock] Trying URBN search:', searchUrl);
    const searchHtml = await fetchPageHtml(searchUrl);
    if (searchHtml) {
      try {
        const sdata = JSON.parse(searchHtml);
        const products = sdata?.products || sdata?.results || [];
        if (products[0]) {
          const pimg = products[0].defaultImage || products[0].images?.[0]?.url || products[0].image;
          if (pimg) {
            const finalImg = pimg.startsWith('//') ? 'https:' + pimg : pimg;
            console.log('[Woodcock] URBN search image:', finalImg.slice(0, 80));
            return finalImg;
          }
        }
      } catch { /* not JSON */ }
    }

    return null;
  } catch (e) {
    console.log('[Woodcock] URBN fetch error:', e.message);
    return null;
  }
}

async function fetchAltardStateImage(url) {
  // Altar'd State - try their page directly
  try {
    const html = await fetchPageHtml(url);
    if (html) {
      const img = extractImageFromHtml(html, url);
      if (img) return img;
    }
    // Try their search/API as fallback
    const slug = new URL(url).pathname.split('/').pop();
    if (slug) {
      const searchUrl = `https://www.altardstate.com/search?q=${encodeURIComponent(slug.replace(/-/g, ' '))}`;
      const searchHtml = await fetchPageHtml(searchUrl);
      if (searchHtml) {
        const img = extractImageFromHtml(searchHtml, url);
        if (img) return img;
      }
    }
    return null;
  } catch (e) {
    console.log('[Woodcock] AltardState error:', e.message);
    return null;
  }
}

async function fetchOgImage(url) {
  try {
    if (!url) return null;
    const host = new URL(url).hostname.toLowerCase();

    // Skip non-product URLs (category pages, search pages, etc.)
    const path = new URL(url).pathname;
    const isProductPage = path.includes('/shop/') || path.includes('/prd/') ||
      path.includes('/dp/') || path.includes('/product/') ||
      (host.includes('asos.com') && path.includes('/prd/'));
    const isCategoryPage = path.endsWith('/new-clothes') || path.endsWith('/new-clothes/') ||
      path.includes('/catalog-products') || path.includes('/seasonal/') ||
      path.endsWith('/new-dresses') || path.endsWith('/new-dresses/') ||
      path.includes('/search/pins/');

    if (isCategoryPage) {
      console.log('[Woodcock] Skipping category/search page:', url.slice(0, 60));
      return null;
    }

    // Try retailer-specific strategies first
    if (host.includes('anthropologie.com') || host.includes('urbanoutfitters.com') || host.includes('freepeople.com')) {
      const urbnImg = await fetchUrbnImage(url);
      if (urbnImg && !isGenericImage(urbnImg)) return urbnImg;
    }

    if (host.includes('altardstate.com')) {
      const altImg = await fetchAltardStateImage(url);
      if (altImg && !isGenericImage(altImg)) return altImg;
    }

    // Generic approach: fetch HTML and extract image
    const html = await fetchPageHtml(url);
    const img = extractImageFromHtml(html, url);
    if (img && !isGenericImage(img)) {
      console.log('[Woodcock] Found image for', url.slice(0, 60), '->', img.slice(0, 80));
      return img;
    }

    console.log('[Woodcock] No image found for', url.slice(0, 60));
    return null;
  } catch (e) {
    console.log('[Woodcock] Error fetching', url.slice(0, 60), e.message);
    return null;
  }
}

// Initialize jazzy_trends table
(async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS jazzy_trends (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      brand TEXT,
      source_url TEXT,
      image_url TEXT,
      market TEXT,
      category TEXT,
      description TEXT,
      price_range TEXT,
      tags TEXT[],
      found_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log('  Table jazzy_trends: OK');
  } catch (e) {
    console.error('  Table jazzy_trends FAILED:', e.message);
  }
})();

// GET /api/agents/jazzy/trends - Get all trends with optional filters
router.get('/jazzy/trends', authMiddleware, async (req, res) => {
  try {
    const { market, brand, category, days = 30, search } = req.query;
    let sql = 'SELECT * FROM jazzy_trends WHERE found_date >= CURRENT_DATE - $1::int';
    const params = [parseInt(days) || 30];
    let idx = 2;

    if (market) {
      sql += ` AND market = $${idx}`;
      params.push(market);
      idx++;
    }
    if (brand) {
      sql += ` AND LOWER(brand) = LOWER($${idx})`;
      params.push(brand);
      idx++;
    }
    if (category) {
      sql += ` AND LOWER(category) = LOWER($${idx})`;
      params.push(category);
      idx++;
    }
    if (search) {
      sql += ` AND (LOWER(title) LIKE LOWER($${idx}) OR LOWER(description) LIKE LOWER($${idx}) OR LOWER(brand) LIKE LOWER($${idx}))`;
      params.push(`%${search}%`);
      idx++;
    }
    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, trends: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('Jazzy trends fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// ── Helper: download a remote image to uploads/trends/ and return local path ──
const TRENDS_IMG_DIR = path.join(__dirname, '..', 'uploads', 'trends');
if (!fs.existsSync(TRENDS_IMG_DIR)) fs.mkdirSync(TRENDS_IMG_DIR, { recursive: true });

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const http = url.startsWith('https') ? require('https') : require('http');
    const dest = path.join(TRENDS_IMG_DIR, filename);
    const file = fs.createWriteStream(dest);
    http.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': new URL(url).origin + '/',
      },
    }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadImage(res.headers.location, filename).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve('/uploads/trends/' + filename); });
    }).on('error', e => { file.close(); try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

async function downloadTrendImages(trends) {
  const results = [];
  for (const t of trends) {
    if (!t.image_url || t.image_url.startsWith('/uploads/')) { results.push(t); continue; }
    const slug = slugify(t.title);
    const filename = slug + '.jpg';
    try {
      const localPath = await downloadImage(t.image_url, filename);
      results.push({ ...t, image_url: localPath });
    } catch (e) {
      console.log(`[downloadTrendImages] Failed for ${t.title}: ${e.message}`);
      results.push(t); // keep remote URL as fallback
    }
  }
  return results;
}

// POST /api/agents/jazzy/download-trend-images - Download current trend images locally
router.post('/jazzy/download-trend-images', authMiddleware, async (req, res) => {
  try {
    const trendsFile = path.join(__dirname, '..', 'data', 'jazzy-trends-latest.json');
    const data = JSON.parse(fs.readFileSync(trendsFile, 'utf8'));
    const updated = await downloadTrendImages(data.trends);
    data.trends = updated;
    fs.writeFileSync(trendsFile, JSON.stringify(data, null, 2));

    // Also update briefings.json image URLs
    const briefingsFile = path.join(__dirname, '..', 'data', 'briefings.json');
    let briefingsStr = fs.readFileSync(briefingsFile, 'utf8');
    for (const t of updated) {
      if (t.image_url && t.image_url.startsWith('/uploads/')) {
        // Replace any remote image URL for this title with the local one
        const escapedTitle = t.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`!\\[${escapedTitle}\\]\\([^)]+\\)`, 'g');
        briefingsStr = briefingsStr.replace(regex, `![${t.title}](${t.image_url})`);
      }
    }
    fs.writeFileSync(briefingsFile, briefingsStr);

    const localCount = updated.filter(t => t.image_url && t.image_url.startsWith('/uploads/')).length;
    res.json({ success: true, downloaded: localCount, total: updated.length });
  } catch (e) {
    console.error('[download-trend-images]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agents/jazzy/fix-revolve-image - Download broken Revolve image locally
router.post('/jazzy/fix-revolve-image', authMiddleware, async (req, res) => {
  const REMOTE_URL = 'https://is4.revolveassets.com/images/p4/n/c/FREE-WS5185_V1.jpg';
  const LOCAL_FILENAME = 'lily-crochet-top.jpg';
  const LOCAL_PATH = '/uploads/trends/' + LOCAL_FILENAME;
  const DEST = path.join(TRENDS_IMG_DIR, LOCAL_FILENAME);

  try {
    // Download the image
    await downloadImage(REMOTE_URL, LOCAL_FILENAME);
    const size = fs.statSync(DEST).size;
    console.log(`[fix-revolve] Downloaded Revolve image: ${size} bytes`);

    // Update DB
    const dbResult = await query(
      "UPDATE jazzy_trends SET image_url = $1 WHERE image_url = $2 OR image_url LIKE '%FREE-WS5185_V1%'",
      [LOCAL_PATH, REMOTE_URL]
    );
    console.log(`[fix-revolve] Updated ${dbResult.rowCount} DB records`);

    // Update briefings.json
    const briefingsFile = path.join(__dirname, '..', 'data', 'briefings.json');
    let briefings = fs.readFileSync(briefingsFile, 'utf8');
    const proxyPattern = /\/api\/image-proxy\?url=https%3A%2F%2Fis4\.revolveassets\.com%2Fimages%2Fp4%2Fn%2Fc%2FFREE-WS5185_V1\.jpg/g;
    briefings = briefings.replace(proxyPattern, LOCAL_PATH);
    briefings = briefings.replace(/https:\/\/is4\.revolveassets\.com\/images\/p4\/n\/c\/FREE-WS5185_V1\.jpg/g, LOCAL_PATH);
    fs.writeFileSync(briefingsFile, briefings);

    res.json({ success: true, size, dbUpdated: dbResult.rowCount, localPath: LOCAL_PATH });
  } catch (e) {
    console.error('[fix-revolve]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agents/jazzy/scan - Run a fresh trend scout scan across retail sites
router.post('/jazzy/scan', authMiddleware, async (req, res) => {
  console.log('[Woodcock] Starting trend scan...');

  // ── Seen-products history: skip anything shown before ──
  const SEEN_FILE = path.join(__dirname, '..', 'data', 'trend-seen-history.json');
  let seenHistory = [];
  try { seenHistory = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch { seenHistory = []; }

  // ── Category filter from request body (optional) ──
  const requestedCategories = (req.body.categories && Array.isArray(req.body.categories) && req.body.categories.length > 0)
    ? req.body.categories.map(c => c.toLowerCase())
    : null; // null = all categories

  const sites = [
    {
      name: 'Free People',
      urls: [
        'https://www.freepeople.com/tops/',
        'https://www.freepeople.com/dresses/',
        'https://www.freepeople.com/skirts/',
        'https://www.freepeople.com/pants/',
        'https://www.freepeople.com/shop/we-the-free/',
        'https://www.freepeople.com/new-arrivals/',
      ],
      market: 'Missy',
    },
    {
      name: 'Anthropologie',
      urls: [
        'https://www.anthropologie.com/new-clothes',
        'https://www.anthropologie.com/dresses',
        'https://www.anthropologie.com/tops',
        'https://www.anthropologie.com/blouses',
        'https://www.anthropologie.com/skirts',
        'https://www.anthropologie.com/pants',
      ],
      market: 'Missy',
    },
    {
      name: 'Urban Outfitters',
      urls: [
        'https://www.urbanoutfitters.com/womens-new-arrivals',
        'https://www.urbanoutfitters.com/womens-dresses',
        'https://www.urbanoutfitters.com/womens-tops',
        'https://www.urbanoutfitters.com/womens-bottoms',
      ],
      market: 'Juniors',
    },
    {
      name: "Altar'd State",
      urls: [
        'https://www.altardstate.com/new-arrivals/',
        'https://www.altardstate.com/dresses/',
        'https://www.altardstate.com/tops/',
        'https://www.altardstate.com/bottoms/',
      ],
      market: 'Girls',
    },
    {
      name: 'Princess Polly',
      urls: [
        'https://us.princesspolly.com/collections/new-in',
        'https://us.princesspolly.com/collections/dresses',
        'https://us.princesspolly.com/collections/tops',
        'https://us.princesspolly.com/collections/skirts',
        'https://us.princesspolly.com/collections/pants',
      ],
      market: 'Juniors',
    },
    {
      name: 'Abercrombie',
      urls: [
        'https://www.abercrombie.com/shop/us/womens-new-arrivals',
        'https://www.abercrombie.com/shop/us/womens-dresses',
        'https://www.abercrombie.com/shop/us/womens-tops',
        'https://www.abercrombie.com/shop/us/womens-jeans',
        'https://www.abercrombie.com/shop/us/womens-skirts',
      ],
      market: 'Missy',
    },
    {
      name: 'ASOS',
      urls: [
        'https://www.asos.com/us/women/new-in/new-in-clothing/cat/?cid=2623',
        'https://www.asos.com/us/women/dresses/cat/?cid=8799',
      ],
      market: 'Juniors',
    },
    {
      name: 'Revolve',
      urls: [
        'https://www.revolve.com/dresses/br/8b97bc/',
        'https://www.revolve.com/tops/br/1b1f38/',
        'https://www.revolve.com/clothing/br/a94084/?sortBy=newest',
      ],
      market: 'Missy',
    },
    {
      name: 'Zara',
      urls: [
        'https://www.zara.com/us/en/woman-new-in-l1180.html',
        'https://www.zara.com/us/en/woman-dresses-l1066.html',
        'https://www.zara.com/us/en/woman-tops-l1217.html',
        'https://www.zara.com/us/en/woman-skirts-l1299.html',
        'https://www.zara.com/us/en/woman-trousers-l1335.html',
      ],
      market: 'Missy',
    },
    {
      name: 'Mango',
      urls: [
        'https://shop.mango.com/us/en/c/women/new-now_d5992883',
        'https://shop.mango.com/us/en/c/women/dresses_d10051382',
        'https://shop.mango.com/us/en/c/women/skirts_d10051391',
        'https://shop.mango.com/us/en/c/women/trousers_d10051392',
      ],
      market: 'Missy',
    },
  ];

  // Boho-related keywords to filter relevant products
  const BOHO_KEYWORDS = [
    'crochet', 'boho', 'bohemian', 'tiered', 'maxi', 'lace', 'floral',
    'fringe', 'embroidered', 'peasant', 'wrap', 'flowing', 'prairie',
    'gypsy', 'festival', 'tassel', 'ruffle', 'vintage', 'romantic',
    'cottage', 'linen', 'gauze', 'eyelet', 'smocked', 'patchwork',
    'kimono', 'caftan', 'tunic', 'palazzo', 'bell sleeve', 'off-shoulder',
    'halter', 'sundress', 'midi', 'overlay', 'layered', 'woven',
    'corset', 'mesh', 'sheer', 'cutout', 'knit', 'broderie', 'pleated',
    'scallop', 'print', 'stripe', 'peplum', 'button-front', 'shirred',
    'poplin', 'textured', 'babydoll', 'trapeze', 'swing', 'a-line',
    'v-neck', 'off shoulder', 'open back', 'tie', 'puff sleeve', 'flutter',
  ];

  function isBohoRelevant(title, desc) {
    const text = ((title || '') + ' ' + (desc || '')).toLowerCase();
    return BOHO_KEYWORDS.some(kw => text.includes(kw));
  }

  function categorizeProduct(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('dress') || t.includes('romper') || t.includes('jumpsuit') || t.includes('overall')) return 'Dresses';
    if (t.includes('skirt')) return 'Skirts';
    if (t.includes('pant') || t.includes('jean') || t.includes('trouser') || t.includes('palazzo') || t.includes('short') || t.includes('legging')) return 'Pants';
    if (t.includes('top') || t.includes('blouse') || t.includes('shirt') || t.includes('tee') || t.includes('tank') || t.includes('cami') || t.includes('bodysuit') || t.includes('corset') || t.includes('crop') || t.includes('bustier')) return 'Tops';
    if (t.includes('jacket') || t.includes('cardigan') || t.includes('sweater') || t.includes('coat') || t.includes('vest') || t.includes('blazer')) return 'Outerwear';
    if (t.includes('maxi') || t.includes('midi') || t.includes('mini')) return 'Dresses';
    return 'Tops';
  }

  // Extract products from page HTML using JSON-LD and meta/HTML patterns
  function extractProducts(html, siteName, market, pageUrl) {
    const products = [];

    // Strategy 1: JSON-LD Product data
    const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdBlocks) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const items = extractJsonLdProducts(data);
        for (const item of items) {
          if (item.name && item.image) {
            products.push({
              title: item.name,
              brand: siteName,
              source_url: (item.url && item.url.startsWith('http')) ? item.url : pageUrl,
              image_url: item.image,
              market,
              category: categorizeProduct(item.name),
              description: item.description || '',
              price_range: item.price || '',
              tags: [],
            });
          }
        }
      } catch { /* skip bad JSON */ }
    }

    // Strategy 2: Look for product cards in HTML (common patterns)
    // Many sites use <a> tags with product data
    const productCardPattern = /<a[^>]*href=["']([^"']*(?:\/shop\/|\/product\/|\/dp\/|\/prd\/)[^"']*)["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
    let match;
    while ((match = productCardPattern.exec(html)) !== null) {
      const href = makeAbsolute(match[1], pageUrl);
      const imgUrl = match[2];
      // Try to find title near the link
      const titleMatch = match[0].match(/(?:alt|title)=["']([^"']+)["']/i);
      if (titleMatch && imgUrl && !isIconOrLogo(imgUrl)) {
        products.push({
          title: titleMatch[1],
          brand: siteName,
          source_url: href,
          image_url: imgUrl.startsWith('//') ? 'https:' + imgUrl : imgUrl,
          market,
          category: categorizeProduct(titleMatch[1]),
          description: '',
          price_range: '',
          tags: [],
        });
      }
    }

    // Strategy 3: og:image + og:title for single-product pages
    if (products.length === 0) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitle && ogImage && !isGenericImage(ogImage[1])) {
        products.push({
          title: ogTitle[1],
          brand: siteName,
          source_url: pageUrl,
          image_url: ogImage[1],
          market,
          category: categorizeProduct(ogTitle[1]),
          description: ogDesc ? ogDesc[1] : '',
          price_range: '',
          tags: [],
        });
      }
    }

    return products;
  }

  function extractJsonLdProducts(data) {
    const results = [];
    if (!data) return results;
    if (Array.isArray(data)) {
      for (const item of data) results.push(...extractJsonLdProducts(item));
      return results;
    }
    if (typeof data !== 'object') return results;

    if (data['@type'] === 'Product' || data['@type'] === 'IndividualProduct') {
      const img = data.image
        ? (typeof data.image === 'string' ? data.image :
           Array.isArray(data.image) ? (typeof data.image[0] === 'string' ? data.image[0] : data.image[0]?.url) :
           data.image.url || data.image.contentUrl)
        : null;
      const price = data.offers
        ? (data.offers.price || data.offers.lowPrice || (Array.isArray(data.offers) && data.offers[0]?.price) || '')
        : '';
      const currency = data.offers?.priceCurrency || 'USD';
      // Validate URL: must start with http, reject "None", null, etc.
      const rawUrl = data.url && typeof data.url === 'string' && data.url.startsWith('http') ? data.url : '';
      results.push({
        name: data.name || '',
        image: img,
        url: rawUrl,
        description: data.description || '',
        price: price ? `$${price}` : '',
      });
    }
    if (data['@graph']) results.push(...extractJsonLdProducts(data['@graph']));
    if (data.itemListElement) {
      for (const el of (Array.isArray(data.itemListElement) ? data.itemListElement : [data.itemListElement])) {
        if (el.item) results.push(...extractJsonLdProducts(el.item));
        else results.push(...extractJsonLdProducts(el));
      }
    }
    return results;
  }

  // Helper: normalize a URL to its path for dedup (strip query params, trailing slashes, protocol)
  function normalizeUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return (u.hostname + u.pathname).toLowerCase().replace(/\/+$/, '');
    } catch { return url.toLowerCase().replace(/\?.*$/, '').replace(/\/+$/, ''); }
  }

  try {
    // ── Fresh scan: clear non-saved trends so we always get a fresh set ──
    // Keep trends that the user explicitly saved/liked
    const savedTrends = await query(
      `SELECT id, title, tags FROM jazzy_trends WHERE 'saved' = ANY(tags)`
    ).catch(() => ({ rows: [] }));
    const savedIds = new Set(savedTrends.rows.map(r => r.id));
    const savedTitlesLower = new Set(savedTrends.rows.map(r => (r.title || '').toLowerCase().trim()));

    // ── CRITICAL: Before deleting, sync ALL existing DB trend titles + URLs into seen-history ──
    // This ensures nothing falls through the cracks if a prior scan's history write failed
    const allExistingFull = await query('SELECT id, title, source_url, image_url FROM jazzy_trends').catch(() => ({ rows: [] }));
    const existingTitles = allExistingFull.rows.map(r => r.title).filter(Boolean);
    const existingUrls = allExistingFull.rows.map(r => r.source_url).filter(Boolean);
    // Merge into seenHistory (titles)
    const seenHistorySet = new Set(seenHistory.map(s => s.toLowerCase().trim()));
    for (const t of existingTitles) {
      if (!seenHistorySet.has(t.toLowerCase().trim())) {
        seenHistory.push(t);
        seenHistorySet.add(t.toLowerCase().trim());
      }
    }

    // ── Load/build seen-URLs history file (parallel to title history) ──
    const SEEN_URLS_FILE = path.join(__dirname, '..', 'data', 'trend-seen-urls.json');
    let seenUrlHistory = [];
    try { seenUrlHistory = JSON.parse(fs.readFileSync(SEEN_URLS_FILE, 'utf8')); } catch { seenUrlHistory = []; }
    const seenUrlSet = new Set(seenUrlHistory.map(u => normalizeUrl(u)));
    // Also add all existing DB URLs
    for (const u of existingUrls) {
      const norm = normalizeUrl(u);
      if (norm && !seenUrlSet.has(norm)) {
        seenUrlHistory.push(u);
        seenUrlSet.add(norm);
      }
    }

    // ── Load/build seen-IMAGE-URLs history (unique identifier per product image) ──
    const SEEN_IMAGES_FILE = path.join(__dirname, '..', 'data', 'trend-seen-images.json');
    let seenImageHistory = [];
    try { seenImageHistory = JSON.parse(fs.readFileSync(SEEN_IMAGES_FILE, 'utf8')); } catch { seenImageHistory = []; }
    const seenImageSet = new Set(seenImageHistory.map(u => normalizeUrl(u)));
    // Seed with existing DB image URLs
    const existingImages = allExistingFull.rows.map(r => r.image_url).filter(Boolean);
    for (const u of existingImages) {
      const norm = normalizeUrl(u);
      if (norm && !seenImageSet.has(norm)) {
        seenImageHistory.push(u);
        seenImageSet.add(norm);
      }
    }

    // Rebuild seenTitlesLower from the now-complete history
    const seenTitlesLower = new Set(seenHistory.map(s => s.toLowerCase().trim()));

    // Delete all non-saved trends to make room for fresh scrape
    let cleared = 0;
    for (const row of allExistingFull.rows) {
      if (!savedIds.has(row.id)) {
        await query('DELETE FROM jazzy_trends WHERE id = $1', [row.id]);
        cleared++;
      }
    }
    console.log(`[Woodcock] Cleared ${cleared} old trends (kept ${savedIds.size} saved). Seen history: ${seenHistory.length} titles, ${seenUrlHistory.length} URLs`);

    let allProducts = [];
    let scanned = 0;
    let errors = 0;

    for (const site of sites) {
      for (const url of site.urls) {
        try {
          console.log(`[Woodcock] Scanning: ${site.name} — ${url.slice(0, 60)}...`);
          const html = await fetchPageHtml(url);
          if (!html || html.length < 500) {
            console.log(`[Woodcock] Empty/blocked response from ${url.slice(0, 50)}`);
            errors++;
            continue;
          }
          const products = extractProducts(html, site.name, site.market, url);
          console.log(`[Woodcock] Found ${products.length} products from ${site.name}`);
          allProducts.push(...products);
          scanned++;
        } catch (e) {
          console.log(`[Woodcock] Error scanning ${url}: ${e.message}`);
          errors++;
        }
      }
    }

    // Normalize title for dedup: strip punctuation, extra spaces, brand prefixes
    function normalizeTitle(title) {
      return (title || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')  // strip punctuation
        .replace(/\s+/g, ' ')          // collapse whitespace
        .trim();
    }

    // Filter: deduplicate within this batch + skip already-saved titles + skip previously seen
    // Uses FOUR unique identifiers: exact title, normalized title, source URL, image URL
    const seen = new Set();
    const seenNormalized = new Set();
    const seenBatchUrls = new Set();
    const seenBatchImages = new Set();
    // Also build normalized versions of history for fuzzy matching
    const seenHistoryNorm = new Set(seenHistory.map(s => normalizeTitle(s)));
    const savedTitlesNorm = new Set(savedTrends.rows.map(r => normalizeTitle(r.title)));

    const filtered = allProducts.filter(p => {
      const key = p.title.toLowerCase().trim();
      const norm = normalizeTitle(p.title);
      const urlNorm = normalizeUrl(p.source_url);
      const imgNorm = normalizeUrl(p.image_url);

      // IMAGE-based dedup: same product image = same product (unique identifier)
      if (imgNorm && (seenBatchImages.has(imgNorm) || seenImageSet.has(imgNorm))) return false;

      // URL-based dedup: same product page = same product, regardless of title
      if (urlNorm && (seenBatchUrls.has(urlNorm) || seenUrlSet.has(urlNorm))) return false;

      // Exact title match dedup
      if (seen.has(key) || savedTitlesLower.has(key)) return false;
      // Normalized/fuzzy title dedup (catches "Lace-Trim Top" vs "Lace Trim Top")
      if (seenNormalized.has(norm) || savedTitlesNorm.has(norm)) return false;
      // Skip products shown in previous scans (freshness guarantee) — both exact and normalized
      if (seenTitlesLower.has(key) || seenHistoryNorm.has(norm)) return false;
      // Category filter: if user requested specific categories, only keep matching ones
      if (requestedCategories) {
        const cat = (p.category || '').toLowerCase();
        if (!requestedCategories.includes(cat)) return false;
      }
      seen.add(key);
      seenNormalized.add(norm);
      if (urlNorm) seenBatchUrls.add(urlNorm);
      if (imgNorm) seenBatchImages.add(imgNorm);
      return p.image_url && !isGenericImage(p.image_url) && !isIconOrLogo(p.image_url);
    });

    // ── Style diversity filter: cap similar style keywords to avoid "repeat styles" ──
    // e.g., max 2 crochet items, max 2 lace items, etc.
    const STYLE_KEYWORDS = ['crochet', 'lace', 'embroidered', 'eyelet', 'knit', 'denim', 'corset', 'peplum', 'ruffle', 'smocked', 'pleated', 'quilted', 'sequin', 'velvet', 'satin', 'mesh', 'sheer', 'floral print', 'polka dot', 'striped'];
    const MAX_PER_STYLE = 2;
    const styleCounts = {};
    const diverseFiltered = filtered.filter(p => {
      const titleLower = (p.title || '').toLowerCase();
      const matchedKeywords = STYLE_KEYWORDS.filter(kw => titleLower.includes(kw));
      if (matchedKeywords.length === 0) return true; // no style keyword — always keep
      // Check if any matched keyword is already at the cap
      const overCap = matchedKeywords.some(kw => (styleCounts[kw] || 0) >= MAX_PER_STYLE);
      if (overCap) {
        console.log(`[Woodcock] Style diversity skip: "${p.title}" (${matchedKeywords.join(', ')} at cap)`);
        return false;
      }
      // Increment counts for all matched keywords
      matchedKeywords.forEach(kw => { styleCounts[kw] = (styleCounts[kw] || 0) + 1; });
      return true;
    });
    console.log(`[Woodcock] Style diversity filter: ${filtered.length} → ${diverseFiltered.length} (removed ${filtered.length - diverseFiltered.length} near-duplicates)`);

    // Import products — skip URL validation for known-good retail domains (fast path)
    const TRUSTED_DOMAINS = ['urbanoutfitters.com', 'anthropologie.com', 'freepeople.com', 'revolve.com', 'asos.com', 'zara.com', 'mango.com', 'altardstate.com', 'princesspolly.com', 'abercrombie.com'];
    function isTrustedUrl(url) {
      try { return TRUSTED_DOMAINS.some(d => new URL(url).hostname.includes(d)); } catch { return false; }
    }
    let imported = 0;
    let skippedInvalid = 0;
    const BATCH_SIZE = 10;
    for (let i = 0; i < diverseFiltered.length; i += BATCH_SIZE) {
      const batch = diverseFiltered.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (t) => {
        if (t.source_url && !isTrustedUrl(t.source_url)) {
          const isValid = await validateProductUrl(t.source_url);
          if (!isValid) {
            console.log(`[Woodcock] Skipping "${t.title}" — invalid source URL: ${(t.source_url || '').slice(0, 80)}`);
            return { ...t, _skip: true };
          }
        }
        return t;
      }));
      for (const t of results) {
        if (t._skip) { skippedInvalid++; continue; }
        try {
          await query(
            `INSERT INTO jazzy_trends (title, brand, source_url, image_url, market, category, description, price_range, tags)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [t.title, t.brand, t.source_url, t.image_url, t.market, t.category, t.description || '', t.price_range || '', t.tags || []]
          );
          imported++;
        } catch (e) { /* skip duplicates */ }
      }
    }

    // ── Persist seen history: append ALL scraped titles + URLs + image URLs so future scans skip them ──
    // We save ALL scraped products (not just imported), so even filtered ones can't come back
    const newTitles = allProducts.map(t => t.title);
    const newUrls = allProducts.filter(t => t.source_url).map(t => t.source_url);
    const newImages = allProducts.filter(t => t.image_url).map(t => t.image_url);
    const updatedHistory = [...seenHistory, ...newTitles];
    const updatedUrlHistory = [...seenUrlHistory, ...newUrls];
    const updatedImageHistory = [...seenImageHistory, ...newImages];
    // Keep last 2000 entries max to avoid unbounded growth
    const trimmedHistory = updatedHistory.slice(-2000);
    const trimmedUrlHistory = updatedUrlHistory.slice(-2000);
    const trimmedImageHistory = updatedImageHistory.slice(-2000);
    try { fs.writeFileSync(SEEN_FILE, JSON.stringify(trimmedHistory, null, 2)); } catch (e) { console.log('[Woodcock] Failed to save seen history:', e.message); }
    try { fs.writeFileSync(SEEN_URLS_FILE, JSON.stringify(trimmedUrlHistory, null, 2)); } catch (e) { console.log('[Woodcock] Failed to save seen URL history:', e.message); }
    try { fs.writeFileSync(SEEN_IMAGES_FILE, JSON.stringify(trimmedImageHistory, null, 2)); } catch (e) { console.log('[Woodcock] Failed to save seen image history:', e.message); }
    const skippedRepeat = allProducts.length - filtered.length - (allProducts.length - [...new Set(allProducts.map(p => p.title.toLowerCase().trim()))].length);

    // ── Download trend images locally for reliable serving ──
    let imagesDownloaded = 0;
    try {
      const allTrends = await query('SELECT id, title, image_url FROM jazzy_trends ORDER BY created_at DESC LIMIT 20');
      const toDownload = allTrends.rows.filter(t => t.image_url && !t.image_url.startsWith('/uploads/'));
      console.log(`[Woodcock] Downloading ${toDownload.length} trend images locally...`);
      for (const t of toDownload) {
        try {
          const slug = slugify(t.title);
          const localPath = await downloadImage(t.image_url, slug + '.jpg');
          await query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [localPath, t.id]);
          imagesDownloaded++;
        } catch (e) { console.log(`[Woodcock] Image download failed for "${t.title}": ${e.message}`); }
      }
      console.log(`[Woodcock] Downloaded ${imagesDownloaded}/${toDownload.length} trend images`);
    } catch (e) { console.log('[Woodcock] Image download phase failed:', e.message); }

    await logAgentActivity('Jazzy', 'trend_scan', `Fresh scan: cleared ${cleared} old trends. Scanned ${scanned} pages from ${sites.length} sites. Found ${allProducts.length} products, imported ${imported} new trends. ${skippedInvalid} skipped (invalid URLs). ${imagesDownloaded} images downloaded locally.`);
    console.log(`[Woodcock] Scan complete: ${scanned} pages, ${allProducts.length} found, ${imported} imported, ${skippedInvalid} invalid URLs, ${imagesDownloaded} images downloaded, ${errors} errors`);
    res.json({ success: true, scanned, found: allProducts.length, imported, cleared, skippedInvalid, imagesDownloaded, errors });
  } catch (err) {
    console.error('Jazzy scan error:', err);
    res.status(500).json({ error: 'Scan failed: ' + err.message });
  }
});

// POST /api/agents/jazzy/trends - Add new trend(s)
router.post('/jazzy/trends', authMiddleware, async (req, res) => {
  try {
    const { trends } = req.body;
    if (!trends || !Array.isArray(trends) || trends.length === 0) {
      return res.status(400).json({ error: 'No trends provided' });
    }

    let imported = 0;
    let skippedInvalid = 0;
    for (const t of trends) {
      try {
        // Validate source URL before importing
        if (t.source_url) {
          const isValid = await validateProductUrl(t.source_url);
          if (!isValid) {
            console.log(`[Woodcock] Skipping "${t.title}" — invalid source URL: ${(t.source_url || '').slice(0, 80)}`);
            skippedInvalid++;
            continue;
          }
        }
        await query(
          `INSERT INTO jazzy_trends (title, brand, source_url, image_url, market, category, description, price_range, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [t.title, t.brand || '', t.source_url || '', t.image_url || '', t.market || '', t.category || '', t.description || '', t.price_range || '', t.tags || []]
        );
        imported++;
      } catch (e) { /* skip duplicates */ }
    }

    await logAgentActivity('Jazzy', 'trend_import', `Imported ${imported} new trends${skippedInvalid ? `, ${skippedInvalid} skipped (invalid URLs)` : ''}`);
    res.json({ success: true, imported, skippedInvalid });
  } catch (err) {
    console.error('Jazzy trend import error:', err);
    res.status(500).json({ error: 'Failed to import trends' });
  }
});

// POST /api/agents/jazzy/trends/fetch-images - Fetch OG images for trends missing image_url
router.post('/jazzy/trends/fetch-images', authMiddleware, async (req, res) => {
  try {
    // Also retry ones that got unsplash/placeholder images previously
    const result = await query(
      `SELECT id, source_url, image_url FROM jazzy_trends
       WHERE source_url IS NOT NULL AND source_url != ''
       AND (image_url IS NULL OR image_url = '' OR LOWER(image_url) LIKE '%unsplash%' OR LOWER(image_url) LIKE '%placeholder%')
       LIMIT 50`
    );
    console.log('[Woodcock] Fetching images for', result.rows.length, 'trends...');
    let updated = 0;
    let failed = 0;
    for (const row of result.rows) {
      try {
        const imgUrl = await fetchOgImage(row.source_url);
        if (imgUrl) {
          await query('UPDATE jazzy_trends SET image_url = $1 WHERE id = $2', [imgUrl, row.id]);
          updated++;
        } else {
          failed++;
        }
      } catch (e) {
        console.log('[Woodcock] Error processing trend', row.id, ':', e.message);
        failed++;
      }
    }
    console.log(`[Woodcock] Done: ${updated} updated, ${failed} failed out of ${result.rows.length}`);
    res.json({ success: true, checked: result.rows.length, updated, failed });
  } catch (err) {
    console.error('Jazzy fetch-images error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// PUT /api/agents/jazzy/trends/:id - Update a trend (e.g. image_url)
router.put('/jazzy/trends/:id', authMiddleware, async (req, res) => {
  try {
    const { image_url, title, description, market, category, price_range, source_url } = req.body;
    const sets = [];
    const vals = [];
    let idx = 1;
    if (image_url !== undefined) { sets.push(`image_url = $${idx++}`); vals.push(image_url); }
    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (market !== undefined) { sets.push(`market = $${idx++}`); vals.push(market); }
    if (category !== undefined) { sets.push(`category = $${idx++}`); vals.push(category); }
    if (price_range !== undefined) { sets.push(`price_range = $${idx++}`); vals.push(price_range); }
    if (source_url !== undefined) { sets.push(`source_url = $${idx++}`); vals.push(source_url); }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    await query(`UPDATE jazzy_trends SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update trend' });
  }
});

// DELETE /api/agents/jazzy/trends/:id - Remove a trend
router.delete('/jazzy/trends/:id', authMiddleware, async (req, res) => {
  try {
    await query('DELETE FROM jazzy_trends WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete trend' });
  }
});

// POST /api/agents/jazzy/trends/:id/save - Toggle save/favorite
router.post('/jazzy/trends/:id/save', authMiddleware, async (req, res) => {
  try {
    // We'll use tags to mark saved items
    const result = await query('SELECT tags FROM jazzy_trends WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const tags = result.rows[0].tags || [];
    const isSaved = tags.includes('saved');
    const newTags = isSaved ? tags.filter(t => t !== 'saved') : [...tags, 'saved'];
    await query('UPDATE jazzy_trends SET tags = $1 WHERE id = $2', [newTags, req.params.id]);
    res.json({ success: true, saved: !isSaved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save trend' });
  }
});

// GET /api/agents/jazzy/stats - Quick stats
router.get('/jazzy/stats', authMiddleware, async (req, res) => {
  try {
    const total = await query('SELECT COUNT(*) as count FROM jazzy_trends');
    const today = await query('SELECT COUNT(*) as count FROM jazzy_trends WHERE found_date = CURRENT_DATE');
    const markets = await query('SELECT market, COUNT(*) as count FROM jazzy_trends GROUP BY market ORDER BY count DESC');
    const brands = await query('SELECT brand, COUNT(*) as count FROM jazzy_trends GROUP BY brand ORDER BY count DESC LIMIT 10');
    const saved = await query("SELECT COUNT(*) as count FROM jazzy_trends WHERE 'saved' = ANY(tags)");
    res.json({
      total: parseInt(total.rows[0].count),
      today: parseInt(today.rows[0].count),
      saved: parseInt(saved.rows[0].count),
      markets: markets.rows,
      brands: brands.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ── Jazzy Preferences (Like/Dislike for algorithm training) ──
(async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS jazzy_preferences (
      id SERIAL PRIMARY KEY,
      trend_id INTEGER REFERENCES jazzy_trends(id) ON DELETE CASCADE,
      vote TEXT NOT NULL CHECK (vote IN ('like', 'dislike')),
      brand TEXT,
      category TEXT,
      market TEXT,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(trend_id)
    )`);
    // Aggregate table for algorithm weights
    await query(`CREATE TABLE IF NOT EXISTS jazzy_algo_weights (
      id SERIAL PRIMARY KEY,
      dimension TEXT NOT NULL,
      value TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(dimension, value)
    )`);
    console.log('  Table jazzy_preferences: OK');
    console.log('  Table jazzy_algo_weights: OK');
  } catch (e) {
    console.error('  Preferences tables:', e.message);
  }
})();

// POST /api/agents/jazzy/trends/:id/vote - Like or dislike a trend
router.post('/jazzy/trends/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { vote } = req.body; // 'like' or 'dislike'
    if (!['like', 'dislike'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be "like" or "dislike"' });
    }

    // Get trend details for algo learning
    const trendRes = await query('SELECT * FROM jazzy_trends WHERE id = $1', [req.params.id]);
    if (trendRes.rows.length === 0) return res.status(404).json({ error: 'Trend not found' });
    const trend = trendRes.rows[0];

    // Upsert the preference
    await query(
      `INSERT INTO jazzy_preferences (trend_id, vote, brand, category, market, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (trend_id) DO UPDATE SET vote = $2, created_at = NOW()`,
      [req.params.id, vote, trend.brand, trend.category, trend.market, trend.tags]
    );

    // Update algorithm weights — likes add +1, dislikes add -1
    const delta = vote === 'like' ? 1 : -1;
    const dimensions = [];
    if (trend.brand) dimensions.push(['brand', trend.brand]);
    if (trend.category) dimensions.push(['category', trend.category]);
    if (trend.market) dimensions.push(['market', trend.market]);
    if (trend.tags) {
      for (const tag of trend.tags.filter(t => t !== 'saved')) {
        dimensions.push(['tag', tag]);
      }
    }

    for (const [dim, val] of dimensions) {
      await query(
        `INSERT INTO jazzy_algo_weights (dimension, value, score, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (dimension, value) DO UPDATE SET score = jazzy_algo_weights.score + $3, updated_at = NOW()`,
        [dim, val, delta]
      );
    }

    res.json({ success: true, vote });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

// GET /api/agents/jazzy/preferences - Get current preference weights
router.get('/jazzy/preferences', authMiddleware, async (req, res) => {
  try {
    const weights = await query('SELECT dimension, value, score FROM jazzy_algo_weights ORDER BY score DESC');
    const votes = await query('SELECT trend_id, vote FROM jazzy_preferences');
    res.json({
      weights: weights.rows,
      votes: votes.rows.reduce((acc, v) => { acc[v.trend_id] = v.vote; return acc; }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// ── Woodcock Trend Scout PDF Report ──
router.get('/jazzy/report/pdf', authMiddleware, async (req, res) => {
  try {
    // Gather trend data
    const trendsRes = await query('SELECT * FROM jazzy_trends ORDER BY created_at DESC');
    const trends = trendsRes.rows;

    // Gather preferences
    let weights = [];
    let votes = {};
    try {
      const wRes = await query('SELECT dimension, value, score FROM jazzy_algo_weights ORDER BY score DESC');
      weights = wRes.rows;
      const vRes = await query('SELECT trend_id, vote FROM jazzy_preferences');
      votes = vRes.rows.reduce((acc, v) => { acc[v.trend_id] = v.vote; return acc; }, {});
    } catch { /* tables might not exist yet */ }

    const data = { trends, weights, votes };

    const { execSync } = require('child_process');
    const os = require('os');
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const jsonFile = path.join(tmpDir, `trend-data-${ts}.json`);
    const tmpFile = path.join(tmpDir, `trend-scout-${ts}.pdf`);
    const pyScript = path.join(__dirname, '..', '..', 'generate-trend-scout-pdf.py');

    fs.writeFileSync(jsonFile, JSON.stringify(data));
    execSync(`python3 "${pyScript}" "${tmpFile}" < "${jsonFile}"`, { timeout: 60000 });
    fs.unlinkSync(jsonFile);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const filename = `${mm}-${dd}-${yyyy}_Trend_Scout_Report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const pdfBuffer = fs.readFileSync(tmpFile);
    res.send(pdfBuffer);
    fs.unlinkSync(tmpFile);
  } catch (err) {
    console.error('Trend Scout PDF error:', err);
    res.status(500).json({ error: 'Failed to generate Trend Scout PDF', details: err.message });
  }
});

// ── Larry Nightly Report ──
const larryReport = require('../services/larry-report');

// GET /api/agents/larry/report — generate report JSON
router.get('/larry/report', authMiddleware, async (req, res) => {
  try {
    const data = await larryReport.generateReport();
    res.json(data);
  } catch (err) {
    console.error('Larry report error:', err);
    res.status(500).json({ error: 'Failed to generate Larry report' });
  }
});

// GET /api/agents/larry/report/html — generate report as HTML email preview
router.get('/larry/report/html', authMiddleware, async (req, res) => {
  try {
    const data = await larryReport.generateReport();
    const html = larryReport.buildEmailHtml(data);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Larry report HTML error:', err);
    res.status(500).json({ error: 'Failed to generate Larry report' });
  }
});

// POST /api/agents/larry/report/send — generate and email report
router.post('/larry/report/send', authMiddleware, async (req, res) => {
  try {
    const data = await larryReport.generateReport();
    const html = larryReport.buildEmailHtml(data);
    const text = larryReport.buildPlainText(data);
    // Store latest report for Claudia digest
    const fs = require('fs');
    const reportPath = path.join(__dirname, '..', 'uploads', 'larry-latest-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));
    res.json({ success: true, summary: {
      past_due: data.past_due.length,
      unrouted: data.unrouted.length,
      shipments: data.shipments.length,
      cut_tickets: data.cut_tickets.length,
    }, html_preview: '/api/agents/larry/report/html' });
  } catch (err) {
    console.error('Larry send error:', err);
    res.status(500).json({ error: 'Failed to send Larry report' });
  }
});

// GET /api/agents/larry/report/pdf — generate and download PDF
router.get('/larry/report/pdf', authMiddleware, async (req, res) => {
  try {
    const data = await larryReport.generateReport();
    const { execSync } = require('child_process');
    const os = require('os');
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const jsonFile = path.join(tmpDir, `larry-data-${ts}.json`);
    const tmpFile = path.join(tmpDir, `larry-report-${ts}.pdf`);
    const pyScript = path.join(__dirname, '..', '..', 'generate-larry-pdf.py');

    // Write JSON to temp file to avoid shell escaping issues
    fs.writeFileSync(jsonFile, JSON.stringify(data));
    execSync(`python3 "${pyScript}" "${tmpFile}" < "${jsonFile}"`, { timeout: 15000 });
    fs.unlinkSync(jsonFile);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const filename = `${mm}-${dd}-${yyyy}_Logistics_Report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const pdfBuffer = fs.readFileSync(tmpFile);
    res.send(pdfBuffer);
    fs.unlinkSync(tmpFile);
  } catch (err) {
    console.error('Larry PDF error:', err);
    res.status(500).json({ error: 'Failed to generate Larry PDF', details: err.message });
  }
});

// GET /api/agents/ats/report/pdf — generate and download ATS Inventory PDF
router.get('/ats/report/pdf', authMiddleware, async (req, res) => {
  try {
    // Fetch ATS data
    let atsRows = [];
    try {
      const ats = await query(`
        SELECT style_number, category, color, ats_units,
               warehouse, lot, vendor_inv, ct_number, buyer, remarks
        FROM ats_inventory ORDER BY style_number
      `);
      atsRows = ats.rows;
    } catch (e) { /* table may not exist */ }

    const data = { ats: atsRows };

    const { execSync } = require('child_process');
    const os = require('os');
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const jsonFile = path.join(tmpDir, `ats-data-${ts}.json`);
    const tmpFile = path.join(tmpDir, `ats-report-${ts}.pdf`);
    const pyScript = path.join(__dirname, '..', '..', 'generate-ats-pdf.py');

    fs.writeFileSync(jsonFile, JSON.stringify(data));
    execSync(`python3 "${pyScript}" "${tmpFile}" < "${jsonFile}"`, { timeout: 15000 });
    fs.unlinkSync(jsonFile);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const filename = `${mm}-${dd}-${yyyy}_ATS_Inventory.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const pdfBuffer = fs.readFileSync(tmpFile);
    res.send(pdfBuffer);
    fs.unlinkSync(tmpFile);
  } catch (err) {
    console.error('ATS PDF error:', err);
    res.status(500).json({ error: 'Failed to generate ATS PDF', details: err.message });
  }
});

// ─── Francisco (Portfolio Management) endpoints ───

// GET /api/agents/francisco/models/:filename — serve a financial model file
router.get('/francisco/models/:filename', authMiddleware, (req, res) => {
  const modelsDir = path.join(__dirname, '..', '..', 'models');
  const filePath = path.join(modelsDir, req.params.filename);
  // Also check project root
  const rootPath = path.join(__dirname, '..', '..', req.params.filename);
  const tryPath = fs.existsSync(filePath) ? filePath : fs.existsSync(rootPath) ? rootPath : null;
  if (!tryPath) return res.status(404).json({ error: 'Model not found' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  res.sendFile(tryPath);
});

// POST /api/agents/francisco/upload-model — accept a financial model upload
router.post('/francisco/upload-model', authMiddleware, (req, res) => {
  res.json({ status: 'queued', message: 'Model received — Francisco will update it.' });
});

// Placeholder endpoints for quotes and news (to be wired to live data later)
router.get('/francisco/quotes', authMiddleware, (req, res) => {
  res.status(204).end(); // No data yet — frontend uses fallback
});

router.get('/francisco/news', authMiddleware, (req, res) => {
  res.status(204).end(); // No data yet — frontend uses fallback
});

// ─── Briefing Watchlist (persisted to JSON) ───
const WATCHLIST_FILE = path.join(__dirname, '..', 'data', 'briefing_watchlist.json');
function loadWatchlist() {
  try { return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8')); }
  catch { return ['BURL','ROST','TJX','META','AMZN','W','WSM','ETSY']; }
}
function saveWatchlist(tickers) {
  const dir = path.dirname(WATCHLIST_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(tickers, null, 2));
}
router.get('/francisco/watchlist', authMiddleware, (req, res) => {
  res.json(loadWatchlist());
});
router.put('/francisco/watchlist', authMiddleware, (req, res) => {
  const { tickers } = req.body;
  if (!Array.isArray(tickers)) return res.status(400).json({ error: 'tickers must be an array' });
  const clean = tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean);
  saveWatchlist(clean);
  res.json(clean);
});

// ─── Email Inbox Pipeline (PETAL ingest) ───

// Ensure petal_inbox table
(async () => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS petal_inbox (
      id SERIAL PRIMARY KEY,
      gmail_message_id TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      parsed_data JSONB,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP
    )`);
    console.log('  Table petal_inbox: OK');
  } catch (e) { console.error('  petal_inbox init error:', e.message); }
})();

// POST /api/agents/petal-inbox — receive a parsed email entry
router.post('/petal-inbox', authMiddleware, async (req, res) => {
  const { gmail_message_id, category, subject, body, parsed_data } = req.body;
  if (!gmail_message_id || !category) return res.status(400).json({ error: 'gmail_message_id and category required' });
  try {
    // Upsert to avoid duplicates
    const result = await query(
      `INSERT INTO petal_inbox (gmail_message_id, category, subject, body, parsed_data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (gmail_message_id) DO NOTHING
       RETURNING id`,
      [gmail_message_id, category, subject, body, JSON.stringify(parsed_data || {})]
    );
    if (result.rows.length === 0) return res.json({ status: 'duplicate', message: 'Already processed' });

    // Apply the update based on category
    if (category === 'CRM' && parsed_data) {
      // Insert into a lightweight contact_log_entries table
      await query(`CREATE TABLE IF NOT EXISTS contact_log_entries (
        id SERIAL PRIMARY KEY, buyer_name TEXT, company TEXT, notes TEXT,
        contact_type TEXT DEFAULT 'email', contact_date DATE DEFAULT CURRENT_DATE,
        source TEXT DEFAULT 'email', created_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(
        `INSERT INTO contact_log_entries (buyer_name, company, notes, contact_type, contact_date)
         VALUES ($1, $2, $3, $4, $5)`,
        [parsed_data.buyer_name || '', parsed_data.company || '', parsed_data.notes || body, parsed_data.contact_type || 'email', parsed_data.date || new Date().toISOString().split('T')[0]]
      );
      await query(`UPDATE petal_inbox SET status='applied', processed_at=NOW() WHERE gmail_message_id=$1`, [gmail_message_id]);
      await logAgentActivity('John Anthony', 'email_ingest', `CRM entry added via email: ${parsed_data.company || 'unknown'}`);
    }

    if (category === 'PROD' && parsed_data) {
      // Update po_tracking if PO number provided
      if (parsed_data.po_number) {
        const updates = [];
        const vals = [];
        let idx = 1;
        for (const [key, val] of Object.entries(parsed_data)) {
          if (key === 'po_number') continue;
          if (['routing_status', 'factory_status', 'carrier', 'eta', 'date_shipped', 'notes', 'warehouse', 'units', 'cartons'].includes(key)) {
            updates.push(`${key}=$${idx}`);
            vals.push(val);
            idx++;
          }
        }
        if (updates.length > 0) {
          updates.push(`updated_at=NOW()`);
          vals.push(parsed_data.po_number);
          await query(`UPDATE po_tracking SET ${updates.join(', ')} WHERE po_number=$${idx}`, vals);
        }
      }
      await query(`UPDATE petal_inbox SET status='applied', processed_at=NOW() WHERE gmail_message_id=$1`, [gmail_message_id]);
      await logAgentActivity('Eddie', 'email_ingest', `Production update via email: PO ${parsed_data.po_number || 'unknown'}`);
    }

    res.json({ status: 'ok', id: result.rows[0]?.id });
  } catch (err) {
    console.error('petal-inbox error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/petal-inbox — list recent inbox entries
router.get('/petal-inbox', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM petal_inbox ORDER BY created_at DESC LIMIT 50');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/contact-log-entries — list CRM entries from email
router.get('/contact-log-entries', authMiddleware, async (req, res) => {
  try {
    await query(`CREATE TABLE IF NOT EXISTS contact_log_entries (
      id SERIAL PRIMARY KEY, buyer_name TEXT, company TEXT, notes TEXT,
      contact_type TEXT DEFAULT 'email', contact_date DATE DEFAULT CURRENT_DATE,
      source TEXT DEFAULT 'email', created_at TIMESTAMP DEFAULT NOW()
    )`);
    const result = await query('SELECT * FROM contact_log_entries ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// TREND SCOUT PDF LOOKBOOK — Generate & Archive
// ═══════════════════════════════════════════

const lookbookDir = path.join(__dirname, '..', 'data', 'lookbooks');
try { fs.mkdirSync(lookbookDir, { recursive: true }); } catch {}

// Helper: download image to buffer
function downloadImageBuffer(url, timeout = 8000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? require('https') : require('http');
      const req = lib.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadImageBuffer(res.headers.location, timeout).then(resolve);
        }
        if (res.statusCode !== 200) return resolve(null);
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(null));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch { resolve(null); }
  });
}

// Helper: build lookbook PDF and save to file (shared between manual + nightly)
async function buildLookbookPDF(trends, filepath) {
  const PDFGen = require('../lib/pdf-gen');
  const pdf = new PDFGen({ width: 792, height: 612 }); // US Letter landscape

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const now = new Date();
  const prettyDate = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  // ── Cover page ──
  pdf.addPage();
  pdf.setColorHex('F5EDE3').rect(0, 0, 792, 612);
  pdf.setColorHex('3C1A00').rect(0, 0, 792, 6);
  pdf.setColorHex('3C1A00').setFont('Helvetica-Bold', 42)
    .text('TREND SCOUT', 0, 240, { align: 'center', maxWidth: 792 });
  pdf.setColorHex('8B7355').setFont('Helvetica', 14)
    .text('L O O K B O O K', 0, 295, { align: 'center', maxWidth: 792 });
  pdf.setColorHex('A89478').setFont('Helvetica', 11)
    .text(prettyDate, 0, 325, { align: 'center', maxWidth: 792 });
  pdf.setFont('Helvetica', 10)
    .text(`${trends.length} Curated Find${trends.length !== 1 ? 's' : ''}`, 0, 345, { align: 'center', maxWidth: 792 });
  pdf.setColorHex('C4B098').setFont('Helvetica', 9)
    .text('UNLIMITED AVENUES  ·  PROJECT PETAL', 0, 570, { align: 'center', maxWidth: 792 });

  // ── Product pages — 2 per page ──
  for (let i = 0; i < trends.length; i += 2) {
    pdf.addPage();
    pdf.setColorHex('FDFAF6').rect(0, 0, 792, 612);
    pdf.setColorHex('3C1A00').rect(0, 0, 792, 3);

    const cols = [trends[i], trends[i + 1]].filter(Boolean);
    const colW = 792 / cols.length;

    for (let c = 0; c < cols.length; c++) {
      const t = cols[c];
      const xOff = c * colW;
      const padding = 30;

      if (c > 0) {
        pdf.setColorHex('E0D5C8').line(xOff, 20, xOff, 592, 0.5);
      }

      // Try to download and place image
      let imgPlaced = false;
      if (t.image_url) {
        try {
          const imgBuf = await downloadImageBuffer(t.image_url);
          if (imgBuf && imgBuf.length > 2000) {
            // Check if it's a JPEG (starts with FFD8)
            if (imgBuf[0] === 0xFF && imgBuf[1] === 0xD8) {
              const imgW = colW - padding * 2;
              const imgH = 430;
              pdf.addImage(imgBuf, xOff + padding, 15, imgW, imgH);
              imgPlaced = true;
            }
          }
        } catch { /* skip image */ }
      }

      const textY = imgPlaced ? 460 : 40;

      // Brand
      pdf.setColorHex('A89478').setFont('Helvetica-Bold', 8)
        .text((t.brand || '').toUpperCase(), xOff + padding, textY, { maxWidth: colW - padding * 2 });

      // Title
      pdf.setColorHex('3C1A00').setFont('Helvetica-Bold', 16)
        .text(t.title || '', xOff + padding, textY + 16, { maxWidth: colW - padding * 2, maxLines: 2 });

      // Price
      if (t.price_range) {
        pdf.setColorHex('5C4A32').setFont('Helvetica', 11)
          .text(t.price_range, xOff + padding, textY + 52, { maxWidth: colW - padding * 2 });
      }

      // Market
      if (t.market) {
        pdf.setColorHex('A89478').setFont('Helvetica', 8)
          .text(t.market.toUpperCase(), xOff + padding, textY + 70, { maxWidth: colW - padding * 2 });
      }

      // Description when no image
      if (t.description && !imgPlaced) {
        const desc = t.description.length > 200 ? t.description.slice(0, 200) + '...' : t.description;
        pdf.setColorHex('8B7355').setFont('Helvetica', 9)
          .text(desc, xOff + padding, textY + 90, { maxWidth: colW - padding * 2, maxLines: 4 });
      }
    }

    // Page number
    pdf.setColorHex('C4B098').setFont('Helvetica', 8)
      .text(`${Math.floor(i / 2) + 1}`, 0, 598, { align: 'center', maxWidth: 792 });
  }

  const buf = pdf.toBuffer();
  fs.writeFileSync(filepath, buf);
  return buf.length;
}

// POST /api/agents/jazzy/lookbook/generate — Generate a lookbook PDF from saved trends
router.post('/jazzy/lookbook/generate', authMiddleware, async (req, res) => {
  try {
    const result = await query("SELECT * FROM jazzy_trends WHERE 'saved' = ANY(tags) ORDER BY created_at DESC");
    const trends = result.rows;
    if (trends.length === 0) {
      return res.status(400).json({ error: 'No saved trends to include in lookbook' });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Trend-Scout-Lookbook-${dateStr}.pdf`;
    const filepath = path.join(lookbookDir, filename);

    const size = await buildLookbookPDF(trends, filepath);
    console.log(`[Lookbook] Generated: ${filename} (${(size / 1024).toFixed(1)} KB, ${trends.length} trends)`);

    res.json({ success: true, filename, date: dateStr, trends: trends.length, size });
  } catch (err) {
    console.error('Lookbook generation error:', err);
    res.status(500).json({ error: 'Failed to generate lookbook: ' + err.message });
  }
});

// GET /api/agents/jazzy/lookbook/archive — List all generated lookbooks
router.get('/jazzy/lookbook/archive', authMiddleware, async (req, res) => {
  try {
    const files = fs.readdirSync(lookbookDir)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(lookbookDir, f));
        // Extract date from filename: Trend-Scout-Lookbook-YYYY-MM-DD.pdf
        const match = f.match(/(\d{4}-\d{2}-\d{2})/);
        return {
          filename: f,
          date: match ? match[1] : null,
          size: stat.size,
          created: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.created.localeCompare(a.created)); // newest first

    res.json({ success: true, lookbooks: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list lookbooks' });
  }
});

// GET /api/agents/jazzy/lookbook/download/:filename — Serve a lookbook PDF
router.get('/jazzy/lookbook/download/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // sanitize
    const filepath = path.join(lookbookDir, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Lookbook not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download lookbook' });
  }
});

// ── Nightly auto-generation (runs every 24h at midnight) ──
function scheduleNightlyLookbook() {
  const now = new Date();
  // Calculate ms until next midnight
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow - now;

  setTimeout(async () => {
    await generateNightlyLookbook();
    // Then repeat every 24h
    setInterval(generateNightlyLookbook, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`[Lookbook] Nightly auto-generation scheduled. Next run in ${(msUntilMidnight / 1000 / 60 / 60).toFixed(1)} hours`);
}

async function generateNightlyLookbook() {
  try {
    const result = await query("SELECT * FROM jazzy_trends WHERE 'saved' = ANY(tags) ORDER BY created_at DESC");
    const trends = result.rows;
    if (trends.length === 0) {
      console.log('[Lookbook] No saved trends, skipping nightly generation');
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Trend-Scout-Lookbook-${dateStr}.pdf`;
    const filepath = path.join(lookbookDir, filename);

    if (fs.existsSync(filepath)) {
      console.log(`[Lookbook] Already generated today: ${filename}`);
      return;
    }

    const size = await buildLookbookPDF(trends, filepath);
    console.log(`[Lookbook] Nightly auto-generated: ${filename} (${(size / 1024).toFixed(1)} KB, ${trends.length} trends)`);
  } catch (err) {
    console.error('[Lookbook] Nightly generation error:', err);
  }
}

// Start the scheduler
scheduleNightlyLookbook();

// ═══════════════════════════════════════════════════════════
//  PRESS RELEASE SCANNER — Coverage Companies
// ═══════════════════════════════════════════════════════════

const COVERAGE_COMPANIES = [
  {
    name: 'Burlington',
    searchName: 'Burlington Stores',
    ticker: 'BURL',
    prSources: [
      'https://www.businesswire.com/portal/site/burlington-stores/',
      'https://investor.burlingtonstores.com/press-releases',
    ],
    keywords: ['Burlington Stores', 'Burlington Coat Factory', 'BURL'],
  },
  {
    name: 'Ross Stores',
    searchName: 'Ross Stores',
    ticker: 'ROST',
    prSources: [
      'https://www.businesswire.com/portal/site/rossstores/',
      'https://corp.rossstores.com/news-releases/',
    ],
    keywords: ['Ross Stores', 'Ross Dress for Less', 'ROST'],
  },
  {
    name: 'TJX Companies',
    ticker: 'TJX',
    prSources: [
      'https://www.businesswire.com/portal/site/tjx/',
      'https://tjx.com/press-releases',
    ],
    keywords: ['TJX Companies', 'TJ Maxx', 'T.J. Maxx', 'Marshalls', 'HomeGoods', 'Winners', 'TJX'],
  },
  {
    name: "Macy's",
    ticker: 'M',
    prSources: [
      'https://www.businesswire.com/portal/site/macysinc/',
      'https://www.macysinc.com/news-media/press-releases',
    ],
    keywords: ["Macy's", "Macy's Inc", 'Bloomingdales', "Macy's Backstage"],
  },
  {
    name: 'Citi Trends',
    ticker: 'CTRN',
    prSources: [
      'https://www.globenewswire.com/search/tag/Citi%20Trends',
      'https://ir.cititrends.com/press-releases',
    ],
    keywords: ['Citi Trends', 'CitiTrends', 'CTRN'],
  },
  {
    name: 'Nordstrom',
    ticker: 'JWN',
    prSources: [
      'https://press.nordstrom.com/press-releases',
    ],
    keywords: ['Nordstrom', 'Nordstrom Rack', 'JWN'],
  },
  {
    name: "Bealls",
    ticker: null,
    prSources: [],
    keywords: ["Bealls", "Beall's", "Beall's Outlet"],
  },
  {
    name: "Gabe's",
    ticker: null,
    prSources: [],
    keywords: ["Gabe's", "Gabriel Brothers"],
  },
  {
    name: "DD's Discounts",
    ticker: null,
    prSources: [],
    keywords: ["DD's Discounts", "DDs"],
  },
  {
    name: 'Factory Connection',
    ticker: null,
    prSources: [],
    keywords: ['Factory Connection'],
  },
];

const PR_CACHE_FILE = path.join(__dirname, '..', 'data', 'press-releases-cache.json');

function loadPRCache() {
  try { return JSON.parse(fs.readFileSync(PR_CACHE_FILE, 'utf8')); } catch { return []; }
}

function savePRCache(data) {
  // Keep last 200 entries max
  const trimmed = data.slice(0, 200);
  fs.writeFileSync(PR_CACHE_FILE, JSON.stringify(trimmed, null, 2));
}

// Extract press releases from HTML using common patterns
function extractPressReleases(html, companyName, sourceUrl) {
  const releases = [];
  if (!html || html.length < 200) return releases;

  // Pattern 1: BusinessWire / GlobeNewsWire — headlines with dates
  // Look for anchor tags with press release URLs and nearby dates
  const bwPattern = /<a[^>]*href=["']([^"']*(?:press-release|news-release|\/\d{4}\/\d{2}\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = bwPattern.exec(html)) !== null) {
    const url = match[1];
    const titleHtml = match[2].replace(/<[^>]+>/g, '').trim();
    if (titleHtml.length > 15 && titleHtml.length < 300) {
      const fullUrl = url.startsWith('http') ? url : (url.startsWith('/') ? new URL(sourceUrl).origin + url : sourceUrl + url);
      releases.push({ title: titleHtml, url: fullUrl, company: companyName });
    }
  }

  // Pattern 2: JSON-LD NewsArticle / PressRelease
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of jsonLdBlocks) {
    try {
      const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      for (const item of items) {
        if (item['@type'] === 'NewsArticle' || item['@type'] === 'Article' || item['@type'] === 'WebPage') {
          if (item.headline || item.name) {
            releases.push({
              title: item.headline || item.name,
              url: item.url || sourceUrl,
              date: item.datePublished || item.dateModified || null,
              company: companyName,
            });
          }
        }
      }
    } catch { /* skip bad JSON */ }
  }

  // Pattern 3: Meta tags with article info
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const articleDateMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
  const ogUrlMatch = html.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);

  // Pattern 4: Date extraction near headlines
  const datePattern = /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/gi;
  const allDates = html.match(datePattern) || [];
  const latestDate = allDates.length > 0 ? allDates[0] : new Date().toISOString().split('T')[0];

  // Assign dates to releases that don't have them
  for (const r of releases) {
    if (!r.date) r.date = latestDate;
    // Normalize date
    try {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) r.date = d.toISOString().split('T')[0];
    } catch {}
  }

  return releases;
}

// Scan RSS/Atom feeds for press releases
function extractFromRSS(xml, companyName) {
  const releases = [];
  if (!xml) return releases;

  // RSS <item> blocks
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const item = match[1];
    const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<dc:date>([\s\S]*?)<\/dc:date>/i);
    if (titleMatch) {
      let pubDate = null;
      if (dateMatch) {
        try { pubDate = new Date(dateMatch[1].trim()).toISOString().split('T')[0]; } catch {}
      }
      releases.push({
        title: titleMatch[1].trim(),
        url: linkMatch ? linkMatch[1].trim() : '',
        date: pubDate || new Date().toISOString().split('T')[0],
        company: companyName,
      });
    }
  }

  // Atom <entry> blocks
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/gi;
  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1];
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/i);
    const dateMatch = entry.match(/<published>([\s\S]*?)<\/published>/i) || entry.match(/<updated>([\s\S]*?)<\/updated>/i);
    if (titleMatch) {
      let pubDate = null;
      if (dateMatch) {
        try { pubDate = new Date(dateMatch[1].trim()).toISOString().split('T')[0]; } catch {}
      }
      releases.push({
        title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
        url: linkMatch ? linkMatch[1] : '',
        date: pubDate || new Date().toISOString().split('T')[0],
        company: companyName,
      });
    }
  }

  return releases;
}

// Dedicated RSS/HTML fetcher with longer timeout for press release sources
function fetchWithTimeout(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!url) return resolve('');
    const lib = url.startsWith('https') ? https : http;
    let data = '';
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
      timeout: timeoutMs,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = new URL(url).origin + loc;
        else if (!loc.startsWith('http')) loc = new URL(url).origin + '/' + loc;
        return fetchWithTimeout(loc, timeoutMs).then(resolve);
      }
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; if (data.length > 500000) res.destroy(); });
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// Build search URLs for each company — multiple reliable free sources
function buildSearchUrls(company) {
  const urls = [];
  // Use searchName if available (more specific), otherwise company name
  const name = company.searchName || company.name;
  const ticker = company.ticker;

  // Google News RSS — most reliable for recent news
  const gq = encodeURIComponent(`"${name}" (press release OR earnings OR "quarterly results" OR announces OR revenue OR store)`);
  urls.push({ url: `https://news.google.com/rss/search?q=${gq}&hl=en-US&gl=US&ceid=US:en`, type: 'rss' });

  // If they have a ticker, also search by ticker (very reliable, no ambiguity)
  if (ticker) {
    const tq = encodeURIComponent(`${ticker} (earnings OR "press release" OR announces OR "quarterly results" OR stock OR dividend)`);
    urls.push({ url: `https://news.google.com/rss/search?q=${tq}&hl=en-US&gl=US&ceid=US:en`, type: 'rss' });
  }

  // BusinessWire search RSS
  const bwq = encodeURIComponent(name);
  urls.push({ url: `https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeGVtZag==&keyword=${bwq}`, type: 'rss' });

  // Direct PR source pages (HTML scraping fallback)
  for (const prUrl of (company.prSources || [])) {
    urls.push({ url: prUrl, type: 'html' });
  }

  return urls;
}

// POST /api/agents/jazzy/scan-press-releases — Scan for press releases from coverage companies
router.post('/jazzy/scan-press-releases', authMiddleware, async (req, res) => {
  console.log('[PressReleases] Starting press release scan...');
  const existing = loadPRCache();
  const existingUrls = new Set(existing.map(p => p.url));
  const existingTitles = new Set(existing.map(p => p.title.toLowerCase().trim()));

  let totalFound = 0;
  let newFound = 0;
  let errors = 0;
  const allNew = [];

  // Process companies in parallel (batches of 3 to avoid overwhelming network)
  const BATCH = 3;
  for (let i = 0; i < COVERAGE_COMPANIES.length; i += BATCH) {
    const batch = COVERAGE_COMPANIES.slice(i, i + BATCH);
    await Promise.all(batch.map(async (company) => {
      const sources = buildSearchUrls(company);
      for (const source of sources) {
        try {
          console.log(`[PressReleases] ${company.name} — ${source.type}: ${source.url.slice(0, 70)}...`);
          const content = await fetchWithTimeout(source.url, 10000);
          if (!content || content.length < 100) {
            console.log(`[PressReleases] ${company.name} — empty response (${content.length} chars)`);
            continue;
          }

          let releases = [];
          if (source.type === 'rss' || content.trim().startsWith('<?xml') || content.includes('<rss') || content.includes('<feed')) {
            releases = extractFromRSS(content, company.name);
          } else {
            releases = extractPressReleases(content, company.name, source.url);
          }

          console.log(`[PressReleases] ${company.name} — found ${releases.length} items from ${source.type}`);

          // Retail/business context words — at least one must appear to filter out noise
          const RETAIL_CONTEXT = [
            'store', 'retail', 'earnings', 'revenue', 'quarter', 'fiscal', 'dividend',
            'stock', 'share', 'analyst', 'sales', 'profit', 'margin', 'guidance',
            'outlook', 'report', 'announces', 'ceo', 'cfo', 'inc.', 'corp',
            'press release', 'investor', 'financial', 'buyback', 'valuation',
            'opening', 'expansion', 'discount', 'off-price', 'department',
            'fashion', 'apparel', 'merchandise', 'comparable', 'comp sales',
            'forecast', 'ipo', 'acquisition', 'merger', 'layoff', 'hire',
            'supply chain', 'distribution', 'e-commerce', 'online', 'holiday',
            'seasonal', 'inventory', 'markdown', 'clearance', 'pricing',
          ];
          // Non-retail noise words that indicate false matches
          const NOISE_WORDS = [
            'farmers market', 'free press', 'album release', 'concert', 'music',
            'restaurant', 'hotel', 'burlington vt', 'burlington vermont',
            'burlington, vt', 'burlington county', 'south burlington', 'west burlington',
            'burlington, nc', 'burlington, nj', 'burlington township',
            'iowa', 'recipe', 'weather', 'sports', 'football',
            'baseball', 'basketball', 'obituary', 'crime', 'arrest', 'traffic',
            'resurfacing', 'road work', 'ice raid', 'police', 'fire department',
          ];

          for (const r of releases) {
            totalFound++;
            const titleKey = r.title.toLowerCase().trim();
            if (!existingUrls.has(r.url) && !existingTitles.has(titleKey)) {
              const titleLower = r.title.toLowerCase();
              const urlLower = (r.url || '').toLowerCase();
              // Block Yahoo and MSN sources at scan level
              if (urlLower.includes('yahoo.com') || urlLower.includes('msn.com') || titleLower.includes('yahoo finance') || titleLower.includes('msn money')) continue;
              // Must mention a company keyword
              const matchesCompany = company.keywords.some(kw => titleLower.includes(kw.toLowerCase()));
              if (!matchesCompany && source.type !== 'html') continue;
              // Filter noise: skip if title contains non-retail noise words
              const hasNoise = NOISE_WORDS.some(nw => titleLower.includes(nw));
              if (hasNoise) continue;
              // Filter stock/insider trading noise — focus on major corporate news
              const STOCK_NOISE = [
                'stock purchase', 'stock sale', 'insider buy', 'insider sell', 'insider trading',
                'shares purchased', 'shares sold', 'share repurchase',
                'director buys', 'director sells', 'officer buys', 'officer sells',
                'sec filing', 'form 4', 'form 13', '10-q filing', '10-k filing', 'schedule 13',
                'beneficial ownership', 'stock option', 'option exercise', 'vested shares',
                'analyst rating', 'price target', 'upgrade', 'downgrade', 'buy rating',
                'hold rating', 'sell rating', 'overweight', 'underweight', 'outperform',
                'ex-dividend',
              ];
              const isStockNoise = STOCK_NOISE.some(sn => titleLower.includes(sn));
              if (isStockNoise) continue;
              // For ambiguous company names (Burlington, Ross), require retail context
              const ambiguousNames = ['Burlington', 'Ross Stores', "Gabe's", "DD's Discounts"];
              const needsContext = ambiguousNames.includes(company.name);
              if (needsContext && source.type === 'rss') {
                const hasContext = RETAIL_CONTEXT.some(ctx => titleLower.includes(ctx));
                // Also check if ticker symbol appears (strong signal)
                const hasTicker = company.ticker && titleLower.includes(company.ticker.toLowerCase());
                if (!hasContext && !hasTicker) continue;
              }
              allNew.push(r);
              existingUrls.add(r.url);
              existingTitles.add(titleKey);
              newFound++;
            }
          }
        } catch (e) {
          console.log(`[PressReleases] Error ${company.name}: ${e.message}`);
          errors++;
        }
      }
    }));
  }

  // Merge new releases with existing, sort by date desc
  const merged = [...allNew, ...existing].sort((a, b) => {
    const da = new Date(a.date || 0);
    const db = new Date(b.date || 0);
    return db - da;
  });
  savePRCache(merged);

  await logAgentActivity('Jazzy', 'press_release_scan', `Scanned ${COVERAGE_COMPANIES.length} companies. Found ${totalFound} total, ${newFound} new press releases. ${errors} errors.`);
  console.log(`[PressReleases] Scan complete: ${totalFound} found, ${newFound} new, ${errors} errors`);
  res.json({ success: true, total: totalFound, new: newFound, cached: merged.length, errors });
});

// GET /api/agents/jazzy/press-releases — Get cached press releases
router.get('/jazzy/press-releases', authMiddleware, async (req, res) => {
  const { days = 30, company } = req.query;
  let data = loadPRCache();
  const cutoff = new Date(Date.now() - parseInt(days) * 86400000);
  data = data.filter(pr => new Date(pr.date) >= cutoff);
  if (company) {
    data = data.filter(pr => pr.company.toLowerCase().includes(company.toLowerCase()));
  }
  res.json({ success: true, releases: data, total: data.length });
});

// GET /api/agents/jazzy/coverage-companies — List coverage companies
router.get('/jazzy/coverage-companies', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    companies: COVERAGE_COMPANIES.map(c => ({
      name: c.name,
      ticker: c.ticker,
      keywords: c.keywords,
      sourcesCount: c.prSources.length,
    })),
  });
});

module.exports = router;
