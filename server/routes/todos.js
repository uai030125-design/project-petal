const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Ensure table exists on first load
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS internal_todos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        done BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'Not Started',
        comment TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Add done_by column if missing
    await db.query(`
      ALTER TABLE internal_todos ADD COLUMN IF NOT EXISTS done_by DATE
    `).catch(() => {});
  } catch (err) {
    console.error('Failed to create internal_todos table:', err);
  }
})();

// GET /api/todos — list all
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM internal_todos ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) {
    console.error('Todos list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/todos — create
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, done, status, comment, done_by } = req.body;
    const maxOrder = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM internal_todos');
    const nextOrder = maxOrder.rows[0].next;
    const result = await db.query(
      `INSERT INTO internal_todos (title, done, status, comment, sort_order, done_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title || '', done || false, status || 'Not Started', comment || '', nextOrder, done_by || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Todo create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/todos/:id — update
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, done, status, comment, done_by } = req.body;
    const result = await db.query(
      `UPDATE internal_todos SET
        title = COALESCE($1, title),
        done = COALESCE($2, done),
        status = COALESCE($3, status),
        comment = COALESCE($4, comment),
        done_by = $5,
        updated_at = NOW()
      WHERE id = $6 RETURNING *`,
      [title, done, status, comment, done_by !== undefined ? done_by : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Todo update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/todos/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM internal_todos WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Todo delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
