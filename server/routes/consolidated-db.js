const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table if not exists
const initTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS consolidated_db (
      id SERIAL PRIMARY KEY,
      po TEXT,
      style_number TEXT,
      so_number TEXT,
      pt_number TEXT,
      ct_number TEXT,
      buyer TEXT,
      description TEXT,
      color TEXT,
      link_status TEXT DEFAULT 'missing',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(po, style_number)
    )
  `);
};
initTable().catch(err => console.error('consolidated_db table init error:', err));

// GET /api/consolidated-db — list all with optional search and link_status filter
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, link_status, page = 1, limit = 5000 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(po ILIKE $${idx} OR style_number ILIKE $${idx} OR so_number ILIKE $${idx} OR ct_number ILIKE $${idx} OR buyer ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (link_status) {
      where.push(`link_status = $${idx++}`);
      params.push(link_status);
    }

    const countQuery = `SELECT COUNT(*) FROM consolidated_db WHERE ${where.join(' AND ')}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT * FROM consolidated_db
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);
    const result = await db.query(dataQuery, params);

    res.json({
      data: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('consolidated_db list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/consolidated-db/import — bulk insert rows
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows array required' });
    }

    const saved = [];
    for (const row of rows) {
      const { po, style_number, so_number, pt_number, ct_number, buyer, description, color } = row;

      // Auto-determine link_status
      let link_status = 'missing';
      if (so_number && ct_number) {
        link_status = 'linked';
      } else if (so_number || ct_number) {
        link_status = 'partial';
      }

      try {
        const result = await db.query(`
          INSERT INTO consolidated_db (po, style_number, so_number, pt_number, ct_number, buyer, description, color, link_status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (po, style_number) DO NOTHING
          RETURNING *
        `, [po || '', style_number || '', so_number || '', pt_number || '', ct_number || '', buyer || '', description || '', color || '', link_status]);

        if (result.rows.length > 0) {
          saved.push(result.rows[0]);
        }
      } catch (err) {
        // Log conflict errors but continue processing
        console.warn('Duplicate row skipped:', { po, style_number });
      }
    }

    res.json({ imported: saved.length, data: saved });
  } catch (err) {
    console.error('consolidated_db import error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/consolidated-db/search — cross-table search
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'q parameter required' });
    }

    const searchTerm = `%${q}%`;
    const results = [];

    // Search warehouse_orders
    try {
      const woResult = await db.query(
        `SELECT id, po_number AS po, style, 'warehouse_orders' AS source FROM warehouse_orders
         WHERE po_number ILIKE $1 OR style ILIKE $1 LIMIT 50`,
        [searchTerm]
      );
      results.push(...woResult.rows);
    } catch (err) {
      console.warn('warehouse_orders search error:', err.message);
    }

    // Search sales_orders
    try {
      const soResult = await db.query(
        `SELECT id, po, so_number, 'sales_orders' AS source FROM sales_orders
         WHERE po ILIKE $1 OR so_number ILIKE $1 LIMIT 50`,
        [searchTerm]
      );
      results.push(...soResult.rows);
    } catch (err) {
      console.warn('sales_orders search error:', err.message);
    }

    // Search cut_tickets
    try {
      const ctResult = await db.query(
        `SELECT id, ct_number, po, 'cut_tickets' AS source FROM cut_tickets
         WHERE ct_number ILIKE $1 OR po ILIKE $1 LIMIT 50`,
        [searchTerm]
      );
      results.push(...ctResult.rows);
    } catch (err) {
      console.warn('cut_tickets search error:', err.message);
    }

    res.json({ results, count: results.length });
  } catch (err) {
    console.error('consolidated_db search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
