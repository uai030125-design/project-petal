const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Image upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'samples');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `sample_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/samples
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM samples ORDER BY created_at DESC`,
      []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Samples list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/samples — create
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { style_number, factory, date_input, date_shipment, comment } = req.body;
    const result = await db.query(
      `INSERT INTO samples (style_number, factory, date_input, date_shipment, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [style_number || '', factory || '', date_input || null, date_shipment || null, comment || '', new Date().toISOString()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create sample error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/samples/:id — update
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { style_number, factory, date_input, date_shipment, comment } = req.body;
    const result = await db.query(
      `UPDATE samples SET
         style_number = COALESCE($1, style_number),
         factory = COALESCE($2, factory),
         date_input = $3,
         date_shipment = $4,
         comment = COALESCE($5, comment)
       WHERE id = $6 RETURNING *`,
      [style_number, factory, date_input || null, date_shipment || null, comment, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update sample error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/samples/:id/image — upload photo
router.post('/:id/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const imageUrl = `/uploads/samples/${req.file.filename}`;
    const result = await db.query(
      'UPDATE samples SET image_url = $1 WHERE id = $2 RETURNING *',
      [imageUrl, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sample not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Sample image upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/samples/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM samples WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Delete image file if exists
    const sample = result.rows[0];
    if (sample.image_url) {
      const filePath = path.join(__dirname, '..', sample.image_url);
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete sample error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
