const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/buyers/orders — buyer orders with filters
router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const { page_id, salesperson, buyer, order_type, page = 1, limit = 100 } = req.query;
    let where = ['1=1'];
    let params = [];
    let idx = 1;

    if (page_id) { where.push(`page_id = $${idx++}`); params.push(page_id); }
    if (salesperson) { where.push(`salesperson = $${idx++}`); params.push(salesperson); }
    if (buyer) { where.push(`buyer ILIKE $${idx++}`); params.push(`%${buyer}%`); }
    if (order_type) { where.push(`order_type = $${idx++}`); params.push(order_type); }

    const offset = (page - 1) * limit;
    const countResult = await db.query(`SELECT COUNT(*) FROM buyer_orders WHERE ${where.join(' AND ')}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(`
      SELECT * FROM buyer_orders WHERE ${where.join(' AND ')}
      ORDER BY ship_start ASC NULLS LAST, po
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    res.json({ data: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Buyer orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/buyers/reads — buyer reads (editable table)
router.get('/reads', authMiddleware, async (req, res) => {
  try {
    const { page_id } = req.query;
    if (!page_id) return res.status(400).json({ error: 'page_id required' });
    const result = await db.query('SELECT * FROM buyer_reads WHERE page_id = $1 ORDER BY id', [page_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/buyers/reads — add row
router.post('/reads', authMiddleware, async (req, res) => {
  try {
    const { page_id, style_number, color, units, ship_date, on_floor_date, notes } = req.body;
    const result = await db.query(`
      INSERT INTO buyer_reads (page_id, style_number, color, units, ship_date, on_floor_date, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [page_id, style_number, color, units || 0, ship_date, on_floor_date, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/buyers/reads/:id
router.put('/reads/:id', authMiddleware, async (req, res) => {
  try {
    const { style_number, color, units, ship_date, on_floor_date, notes } = req.body;
    const result = await db.query(`
      UPDATE buyer_reads SET
        style_number = COALESCE($1, style_number), color = COALESCE($2, color),
        units = COALESCE($3, units), ship_date = $4, on_floor_date = $5,
        notes = COALESCE($6, notes)
      WHERE id = $7 RETURNING *
    `, [style_number, color, units, ship_date, on_floor_date, notes, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/buyers/reads/:id
router.delete('/reads/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM buyer_reads WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/buyers/burlington-lpos
router.get('/burlington-lpos', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM burlington_lpos';
    let params = [];
    if (search) {
      query += ` WHERE lpo ILIKE $1 OR po ILIKE $1 OR style_number ILIKE $1`;
      params.push(`%${search}%`);
    }
    query += ' ORDER BY ship_date ASC NULLS LAST';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/buyers/pages — list all distinct buyer pages
router.get('/pages', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT page_id, salesperson, category, buyer
      FROM buyer_orders
      ORDER BY salesperson, buyer
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
