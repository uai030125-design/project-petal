const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table if not exists
const initTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS production_data (
      id SERIAL PRIMARY KEY,
      ct VARCHAR(100),
      customer VARCHAR(200),
      customer_po VARCHAR(100),
      vendor VARCHAR(200),
      style VARCHAR(100),
      color VARCHAR(100),
      units INTEGER DEFAULT 0,
      due_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  // Add columns if they don't exist (for existing tables)
  await db.query('ALTER TABLE production_data ADD COLUMN IF NOT EXISTS style VARCHAR(100)').catch(() => {});
  await db.query('ALTER TABLE production_data ADD COLUMN IF NOT EXISTS color VARCHAR(100)').catch(() => {});
  await db.query('ALTER TABLE production_data ADD COLUMN IF NOT EXISTS units INTEGER DEFAULT 0').catch(() => {});
  await db.query('ALTER TABLE production_data ADD COLUMN IF NOT EXISTS pick_ticket VARCHAR(100)').catch(() => {});
  await db.query('ALTER TABLE production_data ADD COLUMN IF NOT EXISTS eta DATE').catch(() => {});
};
initTable().catch(err => console.error('production_data table init error:', err));

const COLS = 'ct, customer, customer_po, vendor, style, color, units, due_date, notes, pick_ticket, eta';

function rowVals(row) {
  return [
    row.ct || '', row.customer || '', row.customer_po || '', row.vendor || '',
    row.style || '', row.color || '', parseInt(row.units) || 0,
    row.due_date || null, row.notes || '', row.pick_ticket || '', row.eta || null,
  ];
}

// GET /api/production — list all with optional search
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM production_data';
    const params = [];

    if (search) {
      query += ` WHERE
        LOWER(ct) LIKE LOWER($1) OR
        LOWER(customer) LIKE LOWER($1) OR
        LOWER(customer_po) LIKE LOWER($1) OR
        LOWER(vendor) LIKE LOWER($1) OR
        LOWER(style) LIKE LOWER($1) OR
        LOWER(color) LIKE LOWER($1)`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY due_date ASC NULLS LAST';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('production list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/production — create a new row
router.post('/', authMiddleware, async (req, res) => {
  try {
    const vals = rowVals(req.body);
    const result = await db.query(`
      INSERT INTO production_data (${COLS})
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, vals);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('production create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/production/:id — update a row
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const vals = rowVals(req.body);
    const result = await db.query(`
      UPDATE production_data SET
        ct=$1, customer=$2, customer_po=$3, vendor=$4, style=$5, color=$6, units=$7, due_date=$8, notes=$9, pick_ticket=$10, eta=$11, updated_at=NOW()
      WHERE id=$12
      RETURNING *
    `, [...vals, req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('production update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/production/:id — delete a row
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM production_data WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('production delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/production/bulk — save rows (customer-scoped: only replaces rows for customers in the upload)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

    // Determine which customers are in this upload
    const incomingCustomers = new Set(
      rows.map(r => (r.customer || '').trim().toUpperCase()).filter(Boolean)
    );

    // Only fetch existing rows for these customers (customer-scoped)
    let existingIds = new Set();
    if (incomingCustomers.size > 0) {
      const custList = [...incomingCustomers];
      const placeholders = custList.map((_, i) => `$${i + 1}`).join(', ');
      const existing = await db.query(
        `SELECT id FROM production_data WHERE UPPER(TRIM(customer)) IN (${placeholders})`,
        custList
      );
      existingIds = new Set(existing.rows.map(r => r.id));
    }

    const incomingIds = new Set();
    const saved = [];
    for (const row of rows) {
      const vals = rowVals(row);
      if (row.id && existingIds.has(row.id)) {
        const result = await db.query(`
          UPDATE production_data SET
            ct=$1, customer=$2, customer_po=$3, vendor=$4, style=$5, color=$6, units=$7, due_date=$8, notes=$9, pick_ticket=$10, eta=$11, updated_at=NOW()
          WHERE id=$12 RETURNING *
        `, [...vals, row.id]);
        saved.push(result.rows[0]);
        incomingIds.add(row.id);
      } else {
        const result = await db.query(`
          INSERT INTO production_data (${COLS})
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
        `, vals);
        saved.push(result.rows[0]);
        incomingIds.add(result.rows[0].id);
      }
    }

    // Only delete rows for the uploaded customers that aren't in the incoming set
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await db.query('DELETE FROM production_data WHERE id=$1', [id]);
      }
    }

    res.json(saved);
  } catch (err) {
    console.error('production bulk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/production/import — import from CT file data
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const { rows, replace } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

    if (replace) {
      await db.query('DELETE FROM production_data');
    }

    let imported = 0;
    for (const row of rows) {
      const vals = rowVals(row);
      await db.query(`
        INSERT INTO production_data (${COLS})
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, vals);
      imported++;
    }

    res.json({ success: true, imported });
  } catch (err) {
    console.error('production import error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
