const express = require('express');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '..', 'data', 'scrubs-inventory.json');

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /api/scrubs — full scrubs inventory + deal info
router.get('/', authMiddleware, async (req, res) => {
  try {
    const data = loadData();
    res.json(data);
  } catch (err) {
    console.error('scrubs load error:', err);
    res.status(500).json({ error: 'Failed to load scrubs inventory' });
  }
});

// PUT /api/scrubs/deal — update deal status/notes
router.put('/deal', authMiddleware, async (req, res) => {
  try {
    const data = loadData();
    const { status, notes } = req.body;
    if (status) data.deal.status = status;
    if (notes !== undefined) data.deal.notes = notes;
    data.deal.last_updated = new Date().toISOString().slice(0, 10);
    saveData(data);
    res.json({ ok: true, deal: data.deal });
  } catch (err) {
    console.error('scrubs deal update error:', err);
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

// PUT /api/scrubs/inventory/:style — update a single style row
router.put('/inventory/:style', authMiddleware, async (req, res) => {
  try {
    const data = loadData();
    const { style } = req.params;
    const updates = req.body; // { color: newQty, ... }
    // Find in bottoms, tops, or plus
    for (const cat of ['bottoms', 'tops', 'plus']) {
      const row = data.inventory[cat].find(r => r.style === style);
      if (row) {
        for (const [color, qty] of Object.entries(updates)) {
          if (color in row) row[color] = parseInt(qty) || 0;
        }
        // Recalc totals
        recalcTotals(data);
        saveData(data);
        return res.json({ ok: true });
      }
    }
    res.status(404).json({ error: 'Style not found' });
  } catch (err) {
    console.error('scrubs inventory update error:', err);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

function recalcTotals(data) {
  const colors = [...data.colors.core, ...data.colors.trend];
  const totals = {};
  let grand = 0;
  for (const c of colors) totals[c] = 0;
  for (const cat of ['bottoms', 'tops', 'plus']) {
    for (const row of data.inventory[cat]) {
      for (const c of colors) {
        const v = row[c] || 0;
        totals[c] += v;
        grand += v;
      }
    }
  }
  totals.grand_total = grand;
  data.inventory.totals = totals;
}

module.exports = router;
