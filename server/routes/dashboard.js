const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary — home page KPIs
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const [orders, routing, styles, cuts] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(*) FILTER (WHERE ship_window_end >= CURRENT_DATE AND date_shipped IS NULL
            AND routing_status != 'Shipped' AND routing_status != 'Cancelled')::int AS active_orders,
          COALESCE(SUM(units) FILTER (WHERE ship_window_end >= CURRENT_DATE AND date_shipped IS NULL
            AND routing_status != 'Shipped' AND routing_status != 'Cancelled'), 0)::int AS active_units
        FROM po_tracking
      `),
      db.query(`
        SELECT
          CASE
            WHEN routing_id IS NOT NULL AND routing_id != '' THEN 'routed'
            WHEN routing_status = 'Shipped' THEN 'shipped'
            WHEN routing_status = 'Cancelled' THEN 'cancelled'
            ELSE 'not_routed'
          END AS routing_status,
          COUNT(*)::int AS count
        FROM po_tracking
        WHERE ship_window_end >= CURRENT_DATE AND date_shipped IS NULL
          AND routing_status != 'Shipped' AND routing_status != 'Cancelled'
        GROUP BY 1
      `),
      db.query('SELECT COUNT(*)::int AS count FROM styles').catch(() => ({ rows: [{ count: 0 }] })),
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM cut_tickets GROUP BY status
      `).catch(() => ({ rows: [] }))
    ]);

    const routingMap = {};
    routing.rows.forEach(r => { routingMap[r.routing_status] = r.count; });

    const cutMap = {};
    cuts.rows.forEach(r => { cutMap[r.status] = r.count; });

    res.json({
      orders: orders.rows[0],
      routing: routingMap,
      styles: styles.rows[0].count,
      production: cutMap
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/alerts — upcoming deadlines and issues
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const [urgentOrders, unrouted, shipmentsMonth, unrouted14, inWarehouse] = await Promise.all([
      // Orders with cancel date within 7 days
      db.query(`
        SELECT pt.po_number AS po, pt.ship_window_end AS cancel_date,
               pt.buyer AS store_name, pt.warehouse
        FROM po_tracking pt
        WHERE pt.ship_window_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND pt.date_shipped IS NULL
          AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
        ORDER BY pt.ship_window_end
        LIMIT 20
      `),
      // Not routed count
      db.query(`
        SELECT COUNT(*)::int AS count FROM po_tracking pt
        WHERE (pt.routing_id IS NULL OR pt.routing_id = '')
          AND pt.date_shipped IS NULL
          AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
          AND pt.ship_window_end >= CURRENT_DATE
      `),
      // Shipments this month
      db.query(`
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(pt.units), 0)::int AS units
        FROM po_tracking pt
        WHERE pt.date_shipped IS NOT NULL
          AND pt.date_shipped >= date_trunc('month', CURRENT_DATE)
      `),
      // All unrouted orders (active, not shipped)
      db.query(`
        SELECT pt.po_number AS po, pt.ship_window_end AS cancel_date,
               pt.units, pt.buyer AS store_name, pt.warehouse,
               pt.style AS style_number
        FROM po_tracking pt
        WHERE (pt.routing_id IS NULL OR pt.routing_id = '')
          AND pt.date_shipped IS NULL
          AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
          AND pt.ship_window_end >= CURRENT_DATE
        ORDER BY pt.ship_window_end
        LIMIT 50
      `),
      // POs routed and in warehouse (not yet shipped)
      db.query(`
        SELECT pt.po_number AS po, pt.ship_window_end AS cancel_date,
               pt.units, pt.style AS style_number,
               pt.buyer AS store_name, pt.warehouse
        FROM po_tracking pt
        WHERE pt.routing_id IS NOT NULL AND pt.routing_id != ''
          AND pt.date_shipped IS NULL
          AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
          AND pt.ship_window_end >= CURRENT_DATE
        ORDER BY pt.ship_window_end
        LIMIT 30
      `)
    ]);

    res.json({
      urgent_orders: urgentOrders.rows,
      unrouted_count: unrouted.rows[0].count,
      shipments_month: shipmentsMonth.rows[0],
      unrouted_14d: unrouted14.rows,
      unrouted_14d_count: unrouted14.rows.length,
      in_warehouse: inWarehouse.rows,
      in_warehouse_count: inWarehouse.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/report — 2-week report data for one-pager PDF
router.get('/report', authMiddleware, async (req, res) => {
  try {
    // Query po_tracking (the real table) with correct column names
    const routing = await db.query(`
      SELECT pt.po_number AS po, pt.cut_ticket AS ticket_number, pt.style AS style_number,
             pt.routing_id AS routing,
             CASE
               WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'shipped'
               WHEN LOWER(pt.routing_status) = 'cancelled' THEN 'cancelled'
               WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN 'not_routed'
               WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'routed'
               WHEN LOWER(pt.routing_status) = 'routed' THEN 'routed'
               ELSE 'not_routed'
             END AS routing_status,
             pt.ship_window_start AS start_date, pt.ship_window_end AS cancel_date,
             pt.units, pt.cartons, pt.lot, pt.carrier,
             pt.warehouse AS warehouse_code, pt.buyer AS store_name
      FROM po_tracking pt
      WHERE pt.ship_window_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
        AND pt.date_shipped IS NULL
        AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
      ORDER BY pt.ship_window_end ASC, pt.po_number
    `);

    // Cut tickets — wrap in try/catch in case table doesn't exist
    let cutTicketRows = [];
    try {
      const cutTickets = await db.query(`
        SELECT ct_number, style_number, po, quantity, status, due_date, notes
        FROM cut_tickets
        WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
        ORDER BY due_date ASC
      `);
      cutTicketRows = cutTickets.rows;
    } catch (e) { /* cut_tickets table may not exist */ }

    // ATS inventory
    let atsRows = [];
    try {
      const ats = await db.query(`
        SELECT style_number, category, color, ats_units,
               warehouse, lot, vendor_inv, ct_number, buyer, remarks
        FROM ats_inventory
        ORDER BY style_number
      `);
      atsRows = ats.rows;
    } catch (e) { /* ats_inventory may not exist */ }

    // Shipments: routed orders with carrier info (ready to ship / in transit)
    const shipments = await db.query(`
      SELECT pt.po_number AS po, pt.cut_ticket AS ticket_number, pt.style AS style_number,
             pt.carrier, pt.date_shipped AS load_id_date, pt.routing_id AS load_id_number,
             pt.units, pt.cartons, pt.lot,
             pt.warehouse AS warehouse_code, pt.buyer AS store_name
      FROM po_tracking pt
      WHERE pt.routing_id IS NOT NULL AND pt.routing_id != ''
        AND pt.date_shipped IS NULL
        AND pt.routing_status != 'Shipped' AND pt.routing_status != 'Cancelled'
        AND pt.ship_window_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
      ORDER BY pt.ship_window_end ASC
    `);

    // Routing summary counts
    const routingSummary = { routed: 0, not_routed: 0, cancelled: 0, issue: 0 };
    routing.rows.forEach(r => {
      const s = r.routing_status || 'not_routed';
      routingSummary[s] = (routingSummary[s] || 0) + 1;
    });

    res.json({
      generated_at: new Date().toISOString(),
      period: '2 weeks',
      routing: { summary: routingSummary, orders: routing.rows },
      cut_tickets: cutTicketRows,
      ats: atsRows,
      shipments: shipments.rows
    });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
