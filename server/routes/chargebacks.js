const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Auto-create table if not exists
const initTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS chargebacks (
      id SERIAL PRIMARY KEY,
      po_number VARCHAR(100),
      buyer VARCHAR(100),
      amount DECIMAL(10,2),
      reason_code VARCHAR(50),
      status VARCHAR(50),
      description TEXT,
      dispute_date DATE,
      resolution_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
};
initTable().catch(err => console.error('chargebacks table init error:', err));

// Mock data for in-memory fallback
const mockChargebacks = [
  // Burlington
  { id: 1, po_number: 'BRL-2025-001', buyer: 'Burlington', amount: 250.00, reason_code: 'Late Shipment', status: 'Open', description: 'Shipment arrived 3 days late per ASN', dispute_date: '2025-03-20', resolution_date: null, notes: '', created_at: '2025-03-20T10:00:00Z', updated_at: '2025-03-20T10:00:00Z' },
  { id: 2, po_number: 'BRL-2025-002', buyer: 'Burlington', amount: 500.00, reason_code: 'ASN Error', status: 'Disputed', description: 'ASN missing carton count, corrected cartons on arrival', dispute_date: '2025-03-18', resolution_date: null, notes: 'Sent corrected ASN - awaiting confirmation', created_at: '2025-03-18T14:30:00Z', updated_at: '2025-03-25T09:15:00Z' },
  { id: 3, po_number: 'BRL-2025-003', buyer: 'Burlington', amount: 150.00, reason_code: 'Labeling Non-Compliance', status: 'Resolved', description: 'Case labels missing style number', dispute_date: '2025-02-28', resolution_date: '2025-03-10', notes: 'Credit issued $150', created_at: '2025-02-28T11:20:00Z', updated_at: '2025-03-10T16:45:00Z' },
  { id: 4, po_number: 'BRL-2025-004', buyer: 'Burlington', amount: 750.00, reason_code: 'Routing Violation', status: 'Open', description: 'Shipment routed to wrong distribution center', dispute_date: '2025-03-22', resolution_date: null, notes: 'Investigating routing error in TMS', created_at: '2025-03-22T08:30:00Z', updated_at: '2025-03-22T08:30:00Z' },
  { id: 5, po_number: 'BRL-2025-005', buyer: 'Burlington', amount: 450.00, reason_code: 'Shortage', status: 'Written Off', description: 'Carton short - 12 units missing on receipt', dispute_date: '2025-02-10', resolution_date: '2025-03-05', notes: 'Inventory variance - written off', created_at: '2025-02-10T13:45:00Z', updated_at: '2025-03-05T10:00:00Z' },

  // Ross Missy
  { id: 6, po_number: 'ROS-2025-010', buyer: 'Ross Missy', amount: 300.00, reason_code: 'Late Shipment', status: 'Open', description: 'Missed promised ship date by 2 days', dispute_date: '2025-03-21', resolution_date: null, notes: '', created_at: '2025-03-21T09:00:00Z', updated_at: '2025-03-21T09:00:00Z' },
  { id: 7, po_number: 'ROS-2025-011', buyer: 'Ross Missy', amount: 100.00, reason_code: 'Carton Overage', status: 'Resolved', description: 'Received 5 extra cartons', dispute_date: '2025-03-10', resolution_date: '2025-03-17', notes: 'Credit issued $100 - goods returned', created_at: '2025-03-10T15:20:00Z', updated_at: '2025-03-17T14:30:00Z' },
  { id: 8, po_number: 'ROS-2025-012', buyer: 'Ross Missy', amount: 600.00, reason_code: 'ASN Error', status: 'Disputed', description: 'ASN qty mismatch - invoice showed 500 pcs, received 600 pcs', dispute_date: '2025-03-15', resolution_date: null, notes: 'Awaiting inventory recount confirmation', created_at: '2025-03-15T11:00:00Z', updated_at: '2025-03-24T13:20:00Z' },
  { id: 9, po_number: 'ROS-2025-013', buyer: 'Ross Missy', amount: 200.00, reason_code: 'Wrong Store', status: 'Resolved', description: 'Shipment routed to Ross Petite instead of Ross Missy', dispute_date: '2025-02-20', resolution_date: '2025-03-02', notes: 'Corrective shipment sent', created_at: '2025-02-20T10:15:00Z', updated_at: '2025-03-02T16:00:00Z' },
  { id: 10, po_number: 'ROS-2025-014', buyer: 'Ross Missy', amount: 350.00, reason_code: 'Labeling Non-Compliance', status: 'Open', description: 'Size labels incorrect on 3 cartons', dispute_date: '2025-03-23', resolution_date: null, notes: '', created_at: '2025-03-23T07:45:00Z', updated_at: '2025-03-23T07:45:00Z' },

  // Ross Petite
  { id: 11, po_number: 'ROP-2025-020', buyer: 'Ross Petite', amount: 275.00, reason_code: 'Late Shipment', status: 'Open', description: 'Arrived 1 day late', dispute_date: '2025-03-22', resolution_date: null, notes: '', created_at: '2025-03-22T12:30:00Z', updated_at: '2025-03-22T12:30:00Z' },
  { id: 12, po_number: 'ROP-2025-021', buyer: 'Ross Petite', amount: 425.00, reason_code: 'Routing Violation', status: 'Resolved', description: 'Routed through non-preferred carrier', dispute_date: '2025-02-15', resolution_date: '2025-03-01', notes: 'Process improvement noted', created_at: '2025-02-15T14:00:00Z', updated_at: '2025-03-01T09:30:00Z' },
  { id: 13, po_number: 'ROP-2025-022', buyer: 'Ross Petite', amount: 550.00, reason_code: 'Shortage', status: 'Disputed', description: '50 units short per receiving report', dispute_date: '2025-03-05', resolution_date: null, notes: 'Requesting weight/count audit', created_at: '2025-03-05T16:20:00Z', updated_at: '2025-03-20T11:00:00Z' },

  // Ross Plus
  { id: 14, po_number: 'ROP-2025-030', buyer: 'Ross Plus', amount: 180.00, reason_code: 'Carton Overage', status: 'Resolved', description: '2 extra cartons in shipment', dispute_date: '2025-03-08', resolution_date: '2025-03-14', notes: 'Credit issued, cartons returned', created_at: '2025-03-08T10:45:00Z', updated_at: '2025-03-14T15:20:00Z' },
  { id: 15, po_number: 'ROP-2025-031', buyer: 'Ross Plus', amount: 520.00, reason_code: 'Late Shipment', status: 'Open', description: 'Shipment 4 days late', dispute_date: '2025-03-20', resolution_date: null, notes: 'Production delay caused issue', created_at: '2025-03-20T13:15:00Z', updated_at: '2025-03-20T13:15:00Z' },
  { id: 16, po_number: 'ROP-2025-032', buyer: 'Ross Plus', amount: 320.00, reason_code: 'Labeling Non-Compliance', status: 'Written Off', description: 'UPC barcodes not scannable on 1 carton', dispute_date: '2025-01-25', resolution_date: '2025-02-15', notes: 'Single carton issue - written off', created_at: '2025-01-25T09:20:00Z', updated_at: '2025-02-15T12:00:00Z' },

  // Bealls
  { id: 17, po_number: 'BEA-2025-040', buyer: 'Bealls', amount: 400.00, reason_code: 'Late Shipment', status: 'Open', description: 'Shipment promised by 3/15, arrived 3/19', dispute_date: '2025-03-19', resolution_date: null, notes: '', created_at: '2025-03-19T08:00:00Z', updated_at: '2025-03-19T08:00:00Z' },
  { id: 18, po_number: 'BEA-2025-041', buyer: 'Bealls', amount: 250.00, reason_code: 'ASN Error', status: 'Resolved', description: 'Weight variance on ASN vs actual received', dispute_date: '2025-03-12', resolution_date: '2025-03-19', notes: 'Corrected weight report issued', created_at: '2025-03-12T14:30:00Z', updated_at: '2025-03-19T10:45:00Z' },
  { id: 19, po_number: 'BEA-2025-042', buyer: 'Bealls', amount: 480.00, reason_code: 'Routing Violation', status: 'Disputed', description: 'Routed via ground instead of expedited as requested', dispute_date: '2025-03-17', resolution_date: null, notes: 'TMS routing preference needs update', created_at: '2025-03-17T11:20:00Z', updated_at: '2025-03-23T15:10:00Z' },
  { id: 20, po_number: 'BEA-2025-043', buyer: 'Bealls', amount: 350.00, reason_code: 'Wrong Store', status: 'Resolved', description: 'Cartons labeled for wrong distribution center', dispute_date: '2025-02-28', resolution_date: '2025-03-12', notes: 'Corrective shipment sent, original returned', created_at: '2025-02-28T13:00:00Z', updated_at: '2025-03-12T14:20:00Z' },
];

// GET /api/chargebacks — list all with filtering
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { buyer, status, reason, startDate, endDate } = req.query;

    let query = 'SELECT * FROM chargebacks WHERE 1=1';
    const params = [];

    if (buyer) {
      query += ' AND buyer = $' + (params.length + 1);
      params.push(buyer);
    }
    if (status) {
      query += ' AND status = $' + (params.length + 1);
      params.push(status);
    }
    if (reason) {
      query += ' AND reason_code = $' + (params.length + 1);
      params.push(reason);
    }
    if (startDate) {
      query += ' AND dispute_date >= $' + (params.length + 1);
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND dispute_date <= $' + (params.length + 1);
      params.push(endDate);
    }

    query += ' ORDER BY dispute_date DESC, created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    // Fallback to mock data if DB unavailable
    console.error('chargebacks list error:', err);
    let filtered = mockChargebacks;
    const { buyer, status, reason, startDate, endDate } = req.query;
    if (buyer) filtered = filtered.filter(c => c.buyer === buyer);
    if (status) filtered = filtered.filter(c => c.status === status);
    if (reason) filtered = filtered.filter(c => c.reason_code === reason);
    if (startDate) filtered = filtered.filter(c => c.dispute_date >= startDate);
    if (endDate) filtered = filtered.filter(c => c.dispute_date <= endDate);
    res.json(filtered.sort((a, b) => new Date(b.dispute_date) - new Date(a.dispute_date)));
  }
});

// GET /api/chargebacks/summary — get summary stats
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        SUM(amount) as total_amount,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status='Open' THEN 1 END) as open_count,
        COUNT(CASE WHEN status='Disputed' THEN 1 END) as disputed_count,
        COUNT(CASE WHEN status='Resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status='Written Off' THEN 1 END) as written_off_count,
        SUM(CASE WHEN status='Open' THEN amount ELSE 0 END) as open_amount,
        SUM(CASE WHEN status='Resolved' THEN amount ELSE 0 END) as resolved_amount
      FROM chargebacks
    `);

    // Get reason breakdown
    const reasonResult = await db.query(`
      SELECT reason_code, SUM(amount) as amount, COUNT(*) as count
      FROM chargebacks
      GROUP BY reason_code
      ORDER BY amount DESC
    `);

    // Get buyer breakdown
    const buyerResult = await db.query(`
      SELECT buyer, SUM(amount) as amount, COUNT(*) as count
      FROM chargebacks
      GROUP BY buyer
      ORDER BY amount DESC
    `);

    const stats = result.rows[0];
    res.json({
      total_amount: parseFloat(stats.total_amount || 0),
      total_count: parseInt(stats.total_count || 0),
      open_count: parseInt(stats.open_count || 0),
      disputed_count: parseInt(stats.disputed_count || 0),
      resolved_count: parseInt(stats.resolved_count || 0),
      written_off_count: parseInt(stats.written_off_count || 0),
      open_amount: parseFloat(stats.open_amount || 0),
      resolved_amount: parseFloat(stats.resolved_amount || 0),
      by_reason: reasonResult.rows,
      by_buyer: buyerResult.rows,
    });
  } catch (err) {
    // Fallback to mock data
    console.error('chargebacks summary error:', err);
    const total_amount = mockChargebacks.reduce((sum, c) => sum + c.amount, 0);
    const open_amount = mockChargebacks.filter(c => c.status === 'Open').reduce((sum, c) => sum + c.amount, 0);
    const resolved_amount = mockChargebacks.filter(c => c.status === 'Resolved').reduce((sum, c) => sum + c.amount, 0);

    const by_reason = {};
    mockChargebacks.forEach(c => {
      if (!by_reason[c.reason_code]) by_reason[c.reason_code] = { amount: 0, count: 0 };
      by_reason[c.reason_code].amount += c.amount;
      by_reason[c.reason_code].count += 1;
    });

    const by_buyer = {};
    mockChargebacks.forEach(c => {
      if (!by_buyer[c.buyer]) by_buyer[c.buyer] = { amount: 0, count: 0 };
      by_buyer[c.buyer].amount += c.amount;
      by_buyer[c.buyer].count += 1;
    });

    res.json({
      total_amount,
      total_count: mockChargebacks.length,
      open_count: mockChargebacks.filter(c => c.status === 'Open').length,
      disputed_count: mockChargebacks.filter(c => c.status === 'Disputed').length,
      resolved_count: mockChargebacks.filter(c => c.status === 'Resolved').length,
      written_off_count: mockChargebacks.filter(c => c.status === 'Written Off').length,
      open_amount,
      resolved_amount,
      by_reason: Object.entries(by_reason).map(([reason_code, { amount, count }]) => ({ reason_code, amount, count })),
      by_buyer: Object.entries(by_buyer).map(([buyer, { amount, count }]) => ({ buyer, amount, count })),
    });
  }
});

// POST /api/chargebacks — create a new chargeback
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { po_number, buyer, amount, reason_code, status, description, dispute_date, resolution_date, notes } = req.body;
    const result = await db.query(`
      INSERT INTO chargebacks (po_number, buyer, amount, reason_code, status, description, dispute_date, resolution_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [po_number || '', buyer || '', amount || 0, reason_code || '', status || 'Open',
        description || '', dispute_date || null, resolution_date || null, notes || '']);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('chargebacks create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/chargebacks/:id — update a chargeback
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { po_number, buyer, amount, reason_code, status, description, dispute_date, resolution_date, notes } = req.body;
    const result = await db.query(`
      UPDATE chargebacks SET
        po_number=$1, buyer=$2, amount=$3, reason_code=$4, status=$5, description=$6,
        dispute_date=$7, resolution_date=$8, notes=$9, updated_at=NOW()
      WHERE id=$10
      RETURNING *
    `, [po_number || '', buyer || '', amount || 0, reason_code || '', status || 'Open',
        description || '', dispute_date || null, resolution_date || null, notes || '',
        req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('chargebacks update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/chargebacks/:id — delete a chargeback
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM chargebacks WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('chargebacks delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
