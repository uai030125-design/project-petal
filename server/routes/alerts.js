const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// In-memory store for dismissed and snoozed alerts
const alertState = {
  dismissed: {},      // { alertId: true }
  snoozed: {},        // { alertId: timestamp }
};

// Mock data for persistent alerts
const generateAlerts = async () => {
  const alerts = [];
  const now = new Date();
  let alertId = 1;

  try {
    // Query active POs with approaching ship windows
    const poResult = await db.query(`
      SELECT po_number, buyer, ship_window_end, routing_status
      FROM po_tracking
      WHERE ship_window_end >= CURRENT_DATE
        AND ship_window_end <= CURRENT_DATE + INTERVAL '3 days'
        AND date_shipped IS NULL
        AND routing_status != 'Shipped' AND routing_status != 'Cancelled'
      ORDER BY ship_window_end
      LIMIT 3
    `).catch(() => ({ rows: [] }));

    // Generate PO-related alerts
    poResult.rows.forEach(po => {
      const daysLeft = Math.ceil(
        (new Date(po.ship_window_end) - now) / (1000 * 60 * 60 * 24)
      );
      const isNotRouted = po.routing_status === null || po.routing_status === '';

      alerts.push({
        id: `alert-po-${alertId++}`,
        priority: isNotRouted ? 'critical' : 'warning',
        title: `PO #${po.po_number} ship window closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        description: isNotRouted
          ? `Not yet routed — action required`
          : `Destination: ${po.buyer}`,
        timestamp: new Date(now - Math.random() * 4 * 60 * 60 * 1000),
        actionLink: `/orders/${po.po_number}`,
        actionLabel: 'View PO',
        read: false,
      });
    });

    // Compliance alert
    alerts.push({
      id: `alert-compliance-${alertId++}`,
      priority: 'warning',
      title: 'Burlington compliance score dropped to 82%',
      description: 'Monthly score below target threshold',
      timestamp: new Date(now - 2 * 60 * 60 * 1000),
      actionLink: '/compliance/burlington',
      actionLabel: 'View Details',
      read: false,
    });

    // Sample feedback alert
    alerts.push({
      id: `alert-samples-${alertId++}`,
      priority: 'info',
      title: '5 samples with Ross buyer for 14+ days',
      description: 'Awaiting feedback on styles SKO-042, SK-69, SKO-040',
      timestamp: new Date(now - 3 * 60 * 60 * 1000),
      actionLink: '/samples',
      actionLabel: 'Review Samples',
      read: false,
    });

    // Container ETA alert
    alerts.push({
      id: `alert-container-${alertId++}`,
      priority: 'warning',
      title: 'Container MSCU-4821 ETA delayed',
      description: 'New arrival date: April 8 (originally April 5)',
      timestamp: new Date(now - 5 * 60 * 60 * 1000),
      actionLink: '/containers/MSCU-4821',
      actionLabel: 'View Container',
      read: false,
    });

    // Chargeback alert
    alerts.push({
      id: `alert-chargeback-${alertId++}`,
      priority: 'critical',
      title: 'Chargeback dispute #CB-1204 response deadline tomorrow',
      description: 'Submit evidence by 5:00 PM EST to avoid reversal',
      timestamp: new Date(now - 6 * 60 * 60 * 1000),
      actionLink: '/disputes/CB-1204',
      actionLabel: 'View Dispute',
      read: false,
    });

    // ATS inventory alert
    alerts.push({
      id: `alert-ats-${alertId++}`,
      priority: 'info',
      title: 'ATS for style SKO-042 below 50 units',
      description: 'Current stock: 42 units across all warehouses',
      timestamp: new Date(now - 7 * 60 * 60 * 1000),
      actionLink: '/styles/SKO-042',
      actionLabel: 'View Style',
      read: false,
    });

    // Routing guide alert
    alerts.push({
      id: `alert-guide-${alertId++}`,
      priority: 'info',
      title: 'New routing guide uploaded by Burlington',
      description: 'Review required — effective April 5, 2026',
      timestamp: new Date(now - 8 * 60 * 60 * 1000),
      actionLink: '/guides',
      actionLabel: 'Review Guide',
      read: false,
    });

  } catch (err) {
    console.error('Error generating alerts:', err);
  }

  return alerts;
};

// GET /api/alerts — returns all active alerts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const allAlerts = await generateAlerts();

    // Filter out dismissed and expired snoozed alerts
    const now = Date.now();
    const activeAlerts = allAlerts.filter(alert => {
      if (alertState.dismissed[alert.id]) {
        return false;
      }
      if (alertState.snoozed[alert.id]) {
        // Check if snooze has expired
        if (alertState.snoozed[alert.id] > now) {
          return false; // Still snoozed
        } else {
          // Snooze expired, remove it
          delete alertState.snoozed[alert.id];
        }
      }
      return true;
    });

    // Sort by priority and timestamp
    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    activeAlerts.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    });

    res.json({
      alerts: activeAlerts,
      unreadCount: activeAlerts.filter(a => !a.read).length,
    });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/alerts/:id/dismiss — dismiss an alert
router.put('/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    alertState.dismissed[id] = true;
    // Remove from snoozed if it was there
    delete alertState.snoozed[id];
    res.json({ success: true, message: 'Alert dismissed' });
  } catch (err) {
    console.error('Error dismissing alert:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/alerts/:id/snooze — snooze an alert for X hours
router.put('/:id/snooze', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { hours = 4 } = req.body; // Default to 4 hours

    // Set snooze expiration time
    alertState.snoozed[id] = Date.now() + hours * 60 * 60 * 1000;

    res.json({
      success: true,
      message: `Alert snoozed for ${hours} hour${hours !== 1 ? 's' : ''}`,
      snoozedUntil: new Date(alertState.snoozed[id]).toISOString(),
    });
  } catch (err) {
    console.error('Error snoozing alert:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/alerts/settings — get alert preferences
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    // Return default alert preference settings
    const settings = {
      enableNotifications: true,
      soundEnabled: true,
      emailAlerts: {
        critical: true,
        warning: false,
        info: false,
      },
      categories: {
        orders: true,
        compliance: true,
        samples: true,
        containers: true,
        disputes: true,
        inventory: true,
        documents: true,
      },
      pollingInterval: 30000, // 30 seconds in milliseconds
    };
    res.json(settings);
  } catch (err) {
    console.error('Error fetching alert settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
