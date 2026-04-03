const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table
(async () => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS jazzy_trends (
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
  } catch (e) { console.error('jazzy_trends table error:', e.message); }
})();

// POST /api/jazzy/trends — Add one or many trends
router.post('/trends', authMiddleware, async (req, res) => {
  try {
    // Support both { trends: [...] } and single trend object
    let items = req.body.trends || (req.body.title ? [req.body] : []);
    if (!items.length) return res.status(400).json({ error: 'No trends provided' });

    let imported = 0;
    for (const t of items) {
      try {
        await db.query(
          `INSERT INTO jazzy_trends (title, brand, source_url, image_url, market, category, description, price_range, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [t.title, t.brand || '', t.source_url || '', t.image_url || '', t.market || '', t.category || '', t.description || '', t.price_range || '', t.tags || []]
        );
        imported++;
      } catch (e) { /* skip duplicates */ }
    }
    res.json({ success: true, imported });
  } catch (err) {
    console.error('Jazzy trend POST error:', err);
    res.status(500).json({ error: 'Failed to import trends' });
  }
});

module.exports = router;
