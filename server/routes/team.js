const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/team — org chart tree
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, full_name, title, department, reports_to, level, avatar_color, email, phone, is_active, sort_order
      FROM team_members
      WHERE is_active = true
      ORDER BY level, sort_order, full_name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/team/tree — hierarchical tree
router.get('/tree', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, full_name, title, department, reports_to, level, avatar_color
      FROM team_members WHERE is_active = true
      ORDER BY level, sort_order
    `);
    const members = result.rows;
    const map = {};
    members.forEach(m => { map[m.id] = { ...m, children: [] }; });
    const roots = [];
    members.forEach(m => {
      if (m.reports_to && map[m.reports_to]) {
        map[m.reports_to].children.push(map[m.id]);
      } else {
        roots.push(map[m.id]);
      }
    });
    res.json(roots);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/team
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { full_name, title, department, reports_to, level, avatar_color, email, phone } = req.body;
    const result = await db.query(`
      INSERT INTO team_members (full_name, title, department, reports_to, level, avatar_color, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [full_name, title, department, reports_to, level || 0, avatar_color || '#6366f1', email, phone]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/team/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { full_name, title, department, reports_to, level, avatar_color, email, phone } = req.body;
    const result = await db.query(`
      UPDATE team_members SET
        full_name = COALESCE($1, full_name), title = COALESCE($2, title),
        department = COALESCE($3, department), reports_to = $4,
        level = COALESCE($5, level), avatar_color = COALESCE($6, avatar_color),
        email = COALESCE($7, email), phone = COALESCE($8, phone)
      WHERE id = $9 RETURNING *
    `, [full_name, title, department, reports_to, level, avatar_color, email, phone, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
