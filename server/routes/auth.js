const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('[auth] Login attempt for:', email, '| mock mode:', db.usingMock);

    const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    console.log('[auth] Query returned', result.rows.length, 'rows | mock mode now:', db.usingMock);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const secret = process.env.JWT_SECRET || 'ua-fallback-secret-2026';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.full_name, role: user.role, title: user.title }
    });
  } catch (err) {
    console.error('[auth] Login error:', err.message, err.code || '');
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, full_name, role, title, department, avatar_color FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
