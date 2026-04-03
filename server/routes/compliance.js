const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Mock data for compliance metrics — in production, would compute from po_tracking + actual shipping data
const generateComplianceData = () => {
  const buyers = [
    { name: 'Burlington', shortCode: 'BUR' },
    { name: 'Ross Missy', shortCode: 'ROS-M' },
    { name: 'Ross Petite', shortCode: 'ROS-P' },
    { name: 'Ross Plus', shortCode: 'ROS-PL' },
    { name: 'Bealls', shortCode: 'BEA' },
  ];

  // Realistic compliance data with trends
  const scores = {
    'Burlington': {
      buyer: 'Burlington',
      on_time_shipping: 94,
      routing_compliance: 91,
      asn_accuracy: 97,
      labeling_compliance: 96,
      overall_score: 94.5,
      trend: 'improving',
      trend_change: '+2.3%',
      completed_orders: 247,
      total_orders: 262,
    },
    'Ross Missy': {
      buyer: 'Ross Missy',
      on_time_shipping: 87,
      routing_compliance: 82,
      asn_accuracy: 88,
      labeling_compliance: 90,
      overall_score: 86.75,
      trend: 'stable',
      trend_change: '±0.5%',
      completed_orders: 156,
      total_orders: 180,
    },
    'Ross Petite': {
      buyer: 'Ross Petite',
      on_time_shipping: 91,
      routing_compliance: 93,
      asn_accuracy: 95,
      labeling_compliance: 94,
      overall_score: 93.25,
      trend: 'improving',
      trend_change: '+1.8%',
      completed_orders: 112,
      total_orders: 123,
    },
    'Ross Plus': {
      buyer: 'Ross Plus',
      on_time_shipping: 78,
      routing_compliance: 75,
      asn_accuracy: 82,
      labeling_compliance: 81,
      overall_score: 79.0,
      trend: 'declining',
      trend_change: '-2.1%',
      completed_orders: 89,
      total_orders: 114,
    },
    'Bealls': {
      buyer: 'Bealls',
      on_time_shipping: 88,
      routing_compliance: 86,
      asn_accuracy: 92,
      labeling_compliance: 89,
      overall_score: 88.75,
      trend: 'improving',
      trend_change: '+1.2%',
      completed_orders: 201,
      total_orders: 228,
    },
  };

  return scores;
};

// Generate at-risk POs (approaching ship window without routing)
const generateAtRiskPOs = () => {
  const today = new Date();
  const twoWeeksFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'PO-2026-4501',
      po_number: 'PO-2026-4501',
      buyer: 'Ross Plus',
      style: 'SKO/18740/25',
      units: 2400,
      ship_window_start: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ship_window_end: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      routing_status: 'not_routed',
      days_until_ship: 8,
      severity: 'critical',
      notes: 'Awaiting cut ticket from production',
    },
    {
      id: 'PO-2026-4498',
      po_number: 'PO-2026-4498',
      buyer: 'Ross Missy',
      style: 'SK 69',
      units: 1800,
      ship_window_start: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ship_window_end: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      routing_status: 'not_routed',
      days_until_ship: 10,
      severity: 'high',
      notes: 'Awaiting carrier quote',
    },
    {
      id: 'PO-2026-4495',
      po_number: 'PO-2026-4495',
      buyer: 'Burlington',
      style: 'SKO-040',
      units: 3200,
      ship_window_start: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ship_window_end: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      routing_status: 'not_routed',
      days_until_ship: 12,
      severity: 'medium',
      notes: 'Consolidated shipment, waiting on 1 carton',
    },
    {
      id: 'PO-2026-4492',
      po_number: 'PO-2026-4492',
      buyer: 'Bealls',
      style: 'SKO-042',
      units: 960,
      ship_window_start: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ship_window_end: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      routing_status: 'not_routed',
      days_until_ship: 7,
      severity: 'critical',
      notes: 'High priority — customer requested expedited delivery',
    },
  ];
};

// GET /api/compliance/scorecard — returns buyer compliance scores
router.get('/scorecard', authMiddleware, async (req, res) => {
  try {
    const scores = generateComplianceData();
    const scoreArray = Object.values(scores);
    res.json({
      data: scoreArray,
      generated_at: new Date().toISOString(),
      total_buyers: scoreArray.length,
    });
  } catch (err) {
    console.error('Compliance scorecard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/at-risk — returns POs at risk of missing ship windows
router.get('/at-risk', authMiddleware, async (req, res) => {
  try {
    const atRisk = generateAtRiskPOs();
    res.json({
      data: atRisk,
      total: atRisk.length,
      critical_count: atRisk.filter(p => p.severity === 'critical').length,
      high_count: atRisk.filter(p => p.severity === 'high').length,
    });
  } catch (err) {
    console.error('At-risk POs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/compliance/log — log a compliance event (audit trail)
router.post('/log', authMiddleware, async (req, res) => {
  try {
    const { event_type, buyer, po_number, metric, value, notes } = req.body;

    if (!event_type || !buyer) {
      return res.status(400).json({ error: 'event_type and buyer required' });
    }

    // In production, this would write to a compliance_events table
    const event = {
      id: Date.now(),
      event_type, // e.g., 'on_time', 'asn_mismatch', 'labeling_issue'
      buyer,
      po_number,
      metric,
      value,
      notes,
      created_at: new Date().toISOString(),
      created_by: req.user?.email || 'system',
    };

    // Mock: Store in memory (in production, would persist to DB)
    if (!global.complianceEvents) {
      global.complianceEvents = [];
    }
    global.complianceEvents.push(event);
    // Keep only recent events
    if (global.complianceEvents.length > 1000) {
      global.complianceEvents = global.complianceEvents.slice(-500);
    }

    res.status(201).json(event);
  } catch (err) {
    console.error('Compliance log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/compliance/events — retrieve logged compliance events
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const { buyer, event_type, limit = 50 } = req.query;
    let events = global.complianceEvents || [];

    if (buyer) {
      events = events.filter(e => e.buyer === buyer);
    }
    if (event_type) {
      events = events.filter(e => e.event_type === event_type);
    }

    // Return most recent first
    events = events.sort((a, b) => b.id - a.id).slice(0, limit);

    res.json({
      data: events,
      total: events.length,
    });
  } catch (err) {
    console.error('Compliance events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
