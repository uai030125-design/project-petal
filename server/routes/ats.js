const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table if not exists
const initTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ats_inventory (
      id SERIAL PRIMARY KEY,
      style_number TEXT NOT NULL,
      category TEXT,
      color TEXT,
      ats_units INT DEFAULT 0,
      warehouse TEXT,
      lot TEXT,
      vendor_inv TEXT,
      eta TEXT,
      ct_number TEXT,
      buyer TEXT,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};
initTable().catch(err => console.error('ats_inventory table init error:', err));

// GET /api/ats — list all ATS inventory with optional search and category filter
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 5000 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(style_number ILIKE $${idx} OR color ILIKE $${idx} OR buyer ILIKE $${idx} OR ct_number ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (category) {
      where.push(`category = $${idx++}`);
      params.push(category);
    }

    const countQuery = `SELECT COUNT(*) FROM ats_inventory WHERE ${where.join(' AND ')}`;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT * FROM ats_inventory
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
    console.error('ats_inventory list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ats/bulk — upsert all rows
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows array required' });
    }

    // Get existing IDs
    const existing = await db.query('SELECT id FROM ats_inventory');
    const existingIds = new Set(existing.rows.map(r => r.id));
    const incomingIds = new Set();

    const saved = [];
    for (const row of rows) {
      const { style_number, category, color, ats_units, warehouse, lot, vendor_inv, eta, ct_number, buyer, remarks } = row;
      const vals = [
        style_number || '',
        category || '',
        color || '',
        ats_units || 0,
        warehouse || '',
        lot || '',
        vendor_inv || '',
        eta || '',
        ct_number || '',
        buyer || '',
        remarks || ''
      ];

      if (row.id && existingIds.has(row.id)) {
        // Update
        const result = await db.query(`
          UPDATE ats_inventory SET
            style_number=$1, category=$2, color=$3, ats_units=$4, warehouse=$5,
            lot=$6, vendor_inv=$7, eta=$8, ct_number=$9, buyer=$10, remarks=$11, updated_at=NOW()
          WHERE id=$12 RETURNING *
        `, [...vals, row.id]);
        saved.push(result.rows[0]);
        incomingIds.add(row.id);
      } else {
        // Insert
        const result = await db.query(`
          INSERT INTO ats_inventory (style_number, category, color, ats_units, warehouse, lot, vendor_inv, eta, ct_number, buyer, remarks)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, vals);
        saved.push(result.rows[0]);
        incomingIds.add(result.rows[0].id);
      }
    }

    // Delete rows that were removed on the client
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await db.query('DELETE FROM ats_inventory WHERE id=$1', [id]);
      }
    }

    res.json({ count: saved.length, data: saved });
  } catch (err) {
    console.error('ats_inventory bulk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/ats/alerts — return styles where ats_units < 50 (low stock threshold)
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM ats_inventory WHERE ats_units < 50 ORDER BY ats_units ASC, created_at DESC`
    );
    res.json({
      low_stock: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error('ats_inventory alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/ats/all — clear all ATS data (for re-import)
router.delete('/all', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM ats_inventory');
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('ats_inventory delete all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
