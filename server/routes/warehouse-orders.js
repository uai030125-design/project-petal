const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/warehouse-orders — list from po_tracking (Larry's Eyes Only data)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { warehouse, status, buyer, search, future_only, page = 1, limit = 5000 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    let params = [];
    let idx = 1;

    if (warehouse) {
      where.push(`pt.warehouse = $${idx++}`);
      params.push(warehouse.toUpperCase());
    }
    if (status) {
      // Map frontend status values to po_tracking routing_status
      // Shipped/Cancelled must be checked BEFORE routing_id presence
      const computedStatus = `CASE
        WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'shipped'
        WHEN LOWER(pt.routing_status) = 'cancelled' THEN 'cancelled'
        WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN 'not_routed'
        WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'routed'
        WHEN LOWER(pt.routing_status) = 'routed' THEN 'routed'
        WHEN LOWER(pt.routing_status) = 'not_routed' THEN 'not_routed'
        ELSE 'not_routed'
      END`;
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        where.push(`${computedStatus} = $${idx++}`);
        params.push(statuses[0]);
      } else {
        const placeholders = statuses.map(() => `$${idx++}`).join(', ');
        where.push(`${computedStatus} IN (${placeholders})`);
        params.push(...statuses);
      }
    }
    if (buyer) {
      where.push(`pt.buyer ILIKE $${idx++}`);
      params.push(`%${buyer}%`);
    }
    if (search) {
      where.push(`(pt.po_number ILIKE $${idx} OR pt.cut_ticket ILIKE $${idx} OR pt.pick_ticket ILIKE $${idx} OR pt.style ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (future_only === 'true') {
      where.push(`pt.ship_window_end >= CURRENT_DATE`);
      where.push(`pt.routing_status != 'Shipped'`);
      where.push(`pt.routing_status != 'Cancelled'`);
    }
    // Shipping page scope: only pull rows relevant to the 2-week window + past-due
    if (req.query.scope === 'shipping') {
      where.push(`pt.ship_window_end >= CURRENT_DATE - INTERVAL '90 days'`);
      where.push(`pt.ship_window_end <= CURRENT_DATE + INTERVAL '30 days'`);
    }

    const countQuery = `
      SELECT COUNT(*) FROM po_tracking pt
      WHERE ${where.join(' AND ')}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT
        pt.id,
        pt.po_number AS po,
        pt.cut_ticket AS ticket_number,
        pt.buyer AS store_name,
        pt.ship_window_start AS start_date,
        pt.ship_window_end AS cancel_date,
        pt.warehouse AS warehouse_code,
        pt.routing_id AS routing,
        CASE
          WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'shipped'
          WHEN LOWER(pt.routing_status) = 'cancelled' THEN 'cancelled'
          WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN 'not_routed'
          WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'routed'
          WHEN LOWER(pt.routing_status) = 'routed' THEN 'routed'
          ELSE 'not_routed'
        END AS routing_status,
        CASE
          WHEN pt.date_shipped IS NOT NULL OR LOWER(pt.routing_status) = 'shipped' THEN 'Shipped'
          WHEN LOWER(COALESCE(pt.routing_id,'')) LIKE '%unable to route%' THEN NULL
          WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' AND pt.carrier IS NOT NULL AND pt.carrier != '' THEN 'In Transit'
          WHEN pt.routing_id IS NOT NULL AND pt.routing_id != '' THEN 'Routed'
          WHEN LOWER(pt.routing_status) = 'routed' THEN 'Routed'
          WHEN ct.id IS NOT NULL AND ct.status NOT IN ('Complete') THEN 'In Production'
          ELSE NULL
        END AS lifecycle,
        pt.style,
        pt.units,
        pt.cartons,
        pt.lot,
        pt.date_shipped,
        pt.carrier,
        pt.notes,
        pt.shipment_info,
        ct.ct_number AS ct_ticket,
        ct.status AS ct_status
      FROM po_tracking pt
      LEFT JOIN LATERAL (
        SELECT ct2.id, ct2.ct_number, ct2.status
        FROM cut_tickets ct2
        WHERE ct2.po = pt.po_number
        LIMIT 1
      ) ct ON true
      WHERE ${where.join(' AND ')}
      ORDER BY pt.ship_window_end ASC NULLS LAST, pt.po_number
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(limit, offset);
    const result = await db.query(dataQuery, params);

    res.json({
      data: result.rows,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Warehouse orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/warehouse-orders/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT wo.*, w.code AS warehouse_code, s.name AS store_name
      FROM warehouse_orders wo
      LEFT JOIN warehouses w ON wo.warehouse_id = w.id
      LEFT JOIN stores s ON wo.store_id = s.id
      WHERE wo.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/warehouse-orders/:id — update any field on po_tracking
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Map frontend field names to po_tracking column names
    const fieldMap = {
      po: 'po_number',
      ticket_number: 'cut_ticket',
      store_name: 'buyer',
      start_date: 'ship_window_start',
      cancel_date: 'ship_window_end',
      warehouse_code: 'warehouse',
      routing: 'routing_id',
      routing_status: 'routing_status',
      notes: 'notes',
      shipment_info: 'shipment_info',
    };

    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [frontendKey, dbCol] of Object.entries(fieldMap)) {
      if (req.body[frontendKey] !== undefined) {
        // For date fields, handle empty strings as NULL
        const val = req.body[frontendKey];
        if ((dbCol === 'ship_window_start' || dbCol === 'ship_window_end') && val === '') {
          setClauses.push(`${dbCol} = NULL`);
        } else {
          setClauses.push(`${dbCol} = $${idx++}`);
          params.push(val);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await db.query(`
      UPDATE po_tracking
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, params);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update po_tracking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/warehouse-orders/bulk-delete — delete POs by year(s)
router.delete('/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { years } = req.body; // e.g. [2023, 2024, 2025]
    if (!years || !Array.isArray(years) || years.length === 0) {
      return res.status(400).json({ error: 'years array required' });
    }
    const placeholders = years.map((_, i) => `$${i + 1}`).join(', ');
    const result = await db.query(
      `DELETE FROM po_tracking WHERE EXTRACT(YEAR FROM ship_window_end) IN (${placeholders})`,
      years
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
