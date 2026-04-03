const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Classify routing value into status
function classifyRouting(val) {
  if (!val || val === 'None' || val === '0' || val === 'nan' || val === 'NaN') return 'not_routed';
  const upper = String(val).toUpperCase().trim();
  if (!upper) return 'not_routed';
  if (upper.includes('CANCEL')) return 'cancelled';
  if (upper.includes('DISREGARD')) return 'cancelled';
  if (upper.includes('PAST')) return 'issue';
  if (upper.includes('CANNOT')) return 'issue';
  if (upper.includes('TOO EARLY')) return 'issue';
  if (upper.includes('MORE THAN')) return 'issue';
  if (upper.includes('RTS')) return 'routed';
  if (upper.includes('CS0')) return 'routed';
  if (/^D\d/.test(upper)) return 'routed';
  if (/^\d{5,}/.test(upper)) return 'routed';
  return 'not_routed';
}

// GET /api/routing/status — future orders grouped by routing status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { warehouse } = req.query;
    let where = 'wo.cancel_date >= CURRENT_DATE AND wo.shipped = false AND wo.disregarded = false';
    let params = [];

    if (warehouse) {
      where += ` AND w.code = $1`;
      params.push(warehouse.toUpperCase());
    }

    const result = await db.query(`
      SELECT wo.id, wo.po, wo.ticket_number, wo.style_number, wo.routing, wo.routing_status,
             wo.start_date, wo.cancel_date, wo.units, wo.cartons, wo.lot,
             w.code AS warehouse_code, s.name AS store_name
      FROM warehouse_orders wo
      LEFT JOIN warehouses w ON wo.warehouse_id = w.id
      LEFT JOIN stores s ON wo.store_id = s.id
      WHERE ${where}
      ORDER BY wo.cancel_date ASC, wo.po
    `, params);

    // Summary counts
    const summary = { routed: 0, not_routed: 0, cancelled: 0, issue: 0, total: result.rows.length };
    result.rows.forEach(r => {
      summary[r.routing_status] = (summary[r.routing_status] || 0) + 1;
    });

    res.json({ data: result.rows, summary });
  } catch (err) {
    console.error('Routing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/routing/:id — update routing for a single order
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { routing } = req.body;
    const status = classifyRouting(routing);
    const result = await db.query(`
      UPDATE warehouse_orders SET routing = $1, routing_status = $2 WHERE id = $3 RETURNING *
    `, [routing, status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Export classify function for use in upload parsing
router.classifyRouting = classifyRouting;

module.exports = router;
