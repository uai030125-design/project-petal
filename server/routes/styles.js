const express = require('express');
const multer = require('multer');
const path = require('path');
const https = require('https');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Image upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'styles')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `style_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/styles — list with filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let idx = 1;

    if (category) {
      where.push(`category ILIKE $${idx++}`);
      params.push(category);
    }
    if (search) {
      where.push(`(style_number ILIKE $${idx} OR colors ILIKE $${idx} OR origin ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const countResult = await db.query(`SELECT COUNT(*) FROM styles WHERE ${where.join(' AND ')}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await db.query(`
      SELECT * FROM styles WHERE ${where.join(' AND ')}
      ORDER BY category, style_number
      LIMIT $${idx++} OFFSET $${idx++}
    `, params);

    res.json({ data: result.rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Styles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/styles/categories — distinct categories
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT category FROM styles ORDER BY category');
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/styles/ai-model — generate AI model image for a style
// (Must be before /:id routes so Express doesn't match 'ai-model' as an id)
router.post('/ai-model', authMiddleware, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'AI image generation is not configured. Add OPENAI_API_KEY to .env' });
    }

    const { styleNumber, category, colors, description } = req.body;
    if (!styleNumber) {
      return res.status(400).json({ error: 'styleNumber is required' });
    }

    const colorList = colors || 'neutral tones';
    const garmentType = (category || 'garment').toLowerCase();
    const extra = description || '';

    const prompt = `Professional fashion photography of a model wearing a ${garmentType} in ${colorList}. ${extra}. Clean white studio background, editorial style, full body shot, high fashion, soft natural lighting, 4K quality.`;

    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const result = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'api.openai.com',
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode !== 200) {
              reject(new Error(parsed.error?.message || `OpenAI API error ${response.statusCode}`));
            } else {
              resolve(parsed);
            }
          } catch (e) {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    const imageUrl = result.data?.[0]?.url;
    if (!imageUrl) {
      return res.status(500).json({ error: 'No image returned from AI' });
    }

    res.json({ url: imageUrl, prompt });
  } catch (err) {
    console.error('AI model generation error:', err);
    res.status(500).json({ error: err.message || 'AI image generation failed' });
  }
});

// POST /api/styles — create new style
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { style_number, category, colors, color_count, total_ats, origin } = req.body;
    const result = await db.query(`
      INSERT INTO styles (style_number, category, colors, color_count, total_ats, origin)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [style_number, category || 'Apparel', colors, color_count || 1, total_ats || 0, origin]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Style number already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/styles/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { style_number, category, colors, color_count, total_ats, origin } = req.body;
    const result = await db.query(`
      UPDATE styles SET
        style_number = COALESCE($1, style_number),
        category = COALESCE($2, category),
        colors = COALESCE($3, colors),
        color_count = COALESCE($4, color_count),
        total_ats = COALESCE($5, total_ats),
        origin = COALESCE($6, origin)
      WHERE id = $7 RETURNING *
    `, [style_number, category, colors, color_count, total_ats, origin, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/styles/:id/image — upload product image
router.post('/:id/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    const imageUrl = `/uploads/styles/${req.file.filename}`;
    const result = await db.query(
      'UPDATE styles SET image_url = $1 WHERE id = $2 RETURNING *',
      [imageUrl, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Style not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/styles/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM styles WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
