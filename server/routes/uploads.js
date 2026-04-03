const express = require('express');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { classifyRouting } = require('./routing');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', 'files')),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Helper: find column index by header name patterns
function findCol(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim().toUpperCase();
    for (const p of patterns) {
      if (h === p || h.includes(p)) return i;
    }
  }
  return -1;
}

// Helper: parse Excel date
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

// POST /api/uploads/warehouse — upload For Larry's Eyes Only xlsx
router.post('/warehouse', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const wb = XLSX.readFile(req.file.path, { cellDates: true });
    const sheetNames = wb.SheetNames;
    let totalInserted = 0;

    // Record file upload
    const uploadRec = await db.query(
      `INSERT INTO file_uploads (filename, file_type, original_name, file_path, uploaded_by)
       VALUES ($1, 'warehouse_tracker', $2, $3, $4) RETURNING id`,
      [req.file.filename, req.file.originalname, req.file.path, req.user.id]
    );
    const uploadId = uploadRec.rows[0].id;

    // Process each warehouse tab
    for (const sheetName of sheetNames) {
      const upperSheet = sheetName.toUpperCase().trim();
      if (upperSheet !== 'STAR' && upperSheet !== 'CSM') continue;

      // Find or create warehouse
      const whRes = await db.query(
        `INSERT INTO warehouses (code, name) VALUES ($1, $2)
         ON CONFLICT (code) DO UPDATE SET name = $2 RETURNING id`,
        [upperSheet, sheetName]
      );
      const warehouseId = whRes.rows[0].id;

      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
      if (rows.length < 2) continue;

      const headers = rows[0];
      const cols = {
        store: findCol(headers, ['STORE', 'CUSTOMER']),
        po: findCol(headers, ['PO', 'PO#']),
        ticket: findCol(headers, ['TICKET', 'TICKET #', 'TICKET#']),
        style: findCol(headers, ['STYLE', 'STYLES']),
        startDate: findCol(headers, ['START DATE', 'START']),
        cancelDate: findCol(headers, ['CANCEL DATE', 'CXL DATE', 'CANCEL', 'CXL']),
        routing: findCol(headers, ['ROUTING', 'ROUTING CONF', 'ROUTING CONF#']),
        shipped: findCol(headers, ['SHIPPED']),
        units: findCol(headers, ['UNITS', 'QTY']),
        cartons: findCol(headers, ['CARTONS', 'CTNS']),
        lot: findCol(headers, ['LOT']),
        carrier: findCol(headers, ['CARRIER']),
        labels: findCol(headers, ['LABELS']),
        loadDate: findCol(headers, ['LOAD ID DATE', 'LOAD DATE']),
        loadNumber: findCol(headers, ['LOAD ID NUMBER', 'LOAD #']),
        comments: findCol(headers, ['COMMENTS', 'NOTES'])
      };

      if (cols.po === -1) continue; // PO column is required

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const poVal = cols.po >= 0 ? String(row[cols.po] || '').trim() : '';
        if (!poVal) continue;

        const storeVal = cols.store >= 0 ? String(row[cols.store] || '').trim() : '';
        // Skip disregarded
        if (storeVal.toUpperCase().includes('DISREGARD')) continue;

        const routingVal = cols.routing >= 0 ? String(row[cols.routing] || '').trim() : '';
        const routingStatus = classifyRouting(routingVal);

        const shippedVal = cols.shipped >= 0 ? row[cols.shipped] : null;
        const isShipped = shippedVal === true || String(shippedVal).toUpperCase() === 'Y'
          || String(shippedVal).toUpperCase() === 'YES' || String(shippedVal).toUpperCase() === 'TRUE';

        // Find or create store
        let storeId = null;
        if (storeVal) {
          const storeRes = await db.query(
            `INSERT INTO stores (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id`,
            [storeVal.toUpperCase()]
          );
          storeId = storeRes.rows[0].id;
        }

        await db.query(`
          INSERT INTO warehouse_orders (
            warehouse_id, store_id, po, ticket_number, style_number,
            start_date, cancel_date, routing, routing_status, shipped,
            disregarded, units, cartons, lot, carrier, labels,
            load_id_date, load_id_number, comments, file_upload_id
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        `, [
          warehouseId, storeId, poVal,
          cols.ticket >= 0 ? String(row[cols.ticket] || '').trim() || null : null,
          cols.style >= 0 ? String(row[cols.style] || '').trim() || null : null,
          parseDate(cols.startDate >= 0 ? row[cols.startDate] : null),
          parseDate(cols.cancelDate >= 0 ? row[cols.cancelDate] : null),
          routingVal || null, routingStatus, isShipped,
          false,
          cols.units >= 0 ? parseInt(row[cols.units]) || 0 : 0,
          cols.cartons >= 0 ? parseInt(row[cols.cartons]) || 0 : 0,
          cols.lot >= 0 ? String(row[cols.lot] || '').trim() || null : null,
          cols.carrier >= 0 ? String(row[cols.carrier] || '').trim() || null : null,
          cols.labels >= 0 ? String(row[cols.labels] || '').trim() || null : null,
          parseDate(cols.loadDate >= 0 ? row[cols.loadDate] : null),
          cols.loadNumber >= 0 ? String(row[cols.loadNumber] || '').trim() || null : null,
          cols.comments >= 0 ? String(row[cols.comments] || '').trim() || null : null,
          uploadId
        ]);
        totalInserted++;
      }
    }

    // Update upload record with row count
    await db.query('UPDATE file_uploads SET row_count = $1 WHERE id = $2', [totalInserted, uploadId]);

    res.json({ success: true, rowsInserted: totalInserted, uploadId });
  } catch (err) {
    console.error('Warehouse upload error:', err);
    res.status(500).json({ error: 'Upload processing failed: ' + err.message });
  }
});

// POST /api/uploads/buyer-orders — upload buyer order spreadsheets
router.post('/buyer-orders', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const { salesperson, category, buyer, page_id } = req.body;
    if (!salesperson || !buyer || !page_id) {
      return res.status(400).json({ error: 'salesperson, buyer, page_id required' });
    }

    const wb = XLSX.readFile(req.file.path, { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return res.json({ success: true, rowsInserted: 0 });

    const headers = rows[0];
    const cols = {
      po: findCol(headers, ['PO', 'PO#', 'PO NUMBER']),
      style: findCol(headers, ['STYLE', 'STYLE#', 'STYLE NUMBER']),
      desc: findCol(headers, ['DESCRIPTION', 'DESC']),
      color: findCol(headers, ['COLOR', 'COLOUR']),
      shipStart: findCol(headers, ['SHIP START', 'START SHIP', 'SHIP FROM']),
      shipEnd: findCol(headers, ['SHIP END', 'CANCEL', 'CXL', 'SHIP TO']),
      units: findCol(headers, ['UNITS', 'QTY', 'QUANTITY'])
    };

    const uploadRec = await db.query(
      `INSERT INTO file_uploads (filename, file_type, original_name, file_path, uploaded_by, metadata)
       VALUES ($1, 'buyer_order', $2, $3, $4, $5) RETURNING id`,
      [req.file.filename, req.file.originalname, req.file.path, req.user.id,
       JSON.stringify({ salesperson, category, buyer, page_id })]
    );

    let inserted = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const poVal = cols.po >= 0 ? String(row[cols.po] || '').trim() : '';
      if (!poVal) continue;

      await db.query(`
        INSERT INTO buyer_orders (salesperson, category, buyer, page_id, po, style_number, description, color, ship_start, ship_end, units, raw_data)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        salesperson, category || null, buyer, page_id, poVal,
        cols.style >= 0 ? String(row[cols.style] || '').trim() || null : null,
        cols.desc >= 0 ? String(row[cols.desc] || '').trim() || null : null,
        cols.color >= 0 ? String(row[cols.color] || '').trim() || null : null,
        parseDate(cols.shipStart >= 0 ? row[cols.shipStart] : null),
        parseDate(cols.shipEnd >= 0 ? row[cols.shipEnd] : null),
        cols.units >= 0 ? parseInt(row[cols.units]) || 0 : 0,
        JSON.stringify(row)
      ]);
      inserted++;
    }

    res.json({ success: true, rowsInserted: inserted });
  } catch (err) {
    console.error('Buyer order upload error:', err);
    res.status(500).json({ error: 'Upload processing failed: ' + err.message });
  }
});

// GET /api/uploads — list recent uploads
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT fu.*, u.full_name AS uploaded_by_name
      FROM file_uploads fu
      LEFT JOIN users u ON fu.uploaded_by = u.id
      ORDER BY fu.created_at DESC LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
