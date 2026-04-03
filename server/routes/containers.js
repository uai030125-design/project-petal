const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table if not exists
const initTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS containers (
      id SERIAL PRIMARY KEY,
      folder VARCHAR(100),
      lot VARCHAR(100),
      container VARCHAR(100),
      invoice VARCHAR(100),
      method VARCHAR(20),
      eta DATE,
      notes TEXT,
      cut_tickets TEXT,
      received BOOLEAN DEFAULT false,
      pts_issued BOOLEAN DEFAULT false,
      ats_remaining BOOLEAN DEFAULT false,
      qb BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.query('ALTER TABLE containers ADD COLUMN IF NOT EXISTS cut_tickets TEXT').catch(() => {});
};
initTable().catch(err => console.error('containers table init error:', err));

// GET /api/containers — list all
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM containers ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('containers list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/containers — create a new row
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { folder, lot, container, invoice, method, eta, notes, cut_tickets,
            received, pts_issued, ats_remaining, qb } = req.body;
    const result = await db.query(`
      INSERT INTO containers (folder, lot, container, invoice, method, eta, notes, cut_tickets,
                              received, pts_issued, ats_remaining, qb)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [folder || '', lot || '', container || '', invoice || '',
        method || '', eta || null, notes || '', cut_tickets || '',
        received || false, pts_issued || false, ats_remaining || false, qb || false]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('containers create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/containers/:id — update a row
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { folder, lot, container, invoice, method, eta, notes, cut_tickets,
            received, pts_issued, ats_remaining, qb } = req.body;
    const result = await db.query(`
      UPDATE containers SET
        folder=$1, lot=$2, container=$3, invoice=$4, method=$5, eta=$6, notes=$7, cut_tickets=$8,
        received=$9, pts_issued=$10, ats_remaining=$11, qb=$12, updated_at=NOW()
      WHERE id=$13
      RETURNING *
    `, [folder || '', lot || '', container || '', invoice || '',
        method || '', eta || null, notes || '', cut_tickets || '',
        received || false, pts_issued || false, ats_remaining || false, qb || false,
        req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('containers update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/containers/:id — delete a row
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM containers WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('containers delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/containers/bulk — save all rows at once (upsert)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'rows required' });

    // Get existing IDs
    const existing = await db.query('SELECT id FROM containers');
    const existingIds = new Set(existing.rows.map(r => r.id));
    const incomingIds = new Set();

    const saved = [];
    for (const row of rows) {
      const vals = [
        row.folder || '', row.lot || '', row.container || '', row.invoice || '',
        row.method || '', row.eta || null, row.notes || '', row.cut_tickets || '',
        row.received || false, row.pts_issued || false, row.ats_remaining || false, row.qb || false,
      ];

      if (row.id && existingIds.has(row.id)) {
        // Update
        const result = await db.query(`
          UPDATE containers SET
            folder=$1, lot=$2, container=$3, invoice=$4, method=$5, eta=$6, notes=$7, cut_tickets=$8,
            received=$9, pts_issued=$10, ats_remaining=$11, qb=$12, updated_at=NOW()
          WHERE id=$13 RETURNING *
        `, [...vals, row.id]);
        saved.push(result.rows[0]);
        incomingIds.add(row.id);
      } else {
        // Insert
        const result = await db.query(`
          INSERT INTO containers (folder, lot, container, invoice, method, eta, notes, cut_tickets,
                                  received, pts_issued, ats_remaining, qb)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
        `, vals);
        saved.push(result.rows[0]);
        incomingIds.add(result.rows[0].id);
      }
    }

    // Delete rows that were removed on the client
    for (const id of existingIds) {
      if (!incomingIds.has(id)) {
        await db.query('DELETE FROM containers WHERE id=$1', [id]);
      }
    }

    res.json(saved);
  } catch (err) {
    console.error('containers bulk error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/containers/by-cut-ticket — look up container invoice by cut ticket number
router.get('/by-cut-ticket', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT id, invoice, cut_tickets, folder, container FROM containers WHERE cut_tickets IS NOT NULL AND cut_tickets != \'\'');
    // Build a map: ct_number -> { invoice, folder, container }
    const ctMap = {};
    for (const row of result.rows) {
      const cts = (row.cut_tickets || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const ct of cts) {
        ctMap[ct] = { invoice: row.invoice, folder: row.folder, container: row.container };
      }
    }
    res.json(ctMap);
  } catch (err) {
    console.error('containers by-cut-ticket error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
