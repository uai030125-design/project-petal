const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

// Configure multer for document uploads
const upload = multer({
  dest: path.join(__dirname, '..', 'uploads', 'documents'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/gif',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: PDF, Word, Excel, text, images`));
    }
  }
});

// In-memory store with file persistence
const store = {
  documents: []
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const DOCUMENTS_PERSIST = path.join(DATA_DIR, 'documents.json');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'documents');
fs.mkdirSync(uploadsDir, { recursive: true });

// Load documents from file on startup
function loadDocuments() {
  try {
    if (fs.existsSync(DOCUMENTS_PERSIST)) {
      const data = JSON.parse(fs.readFileSync(DOCUMENTS_PERSIST, 'utf8'));
      store.documents = data;
    } else {
      // Initialize with mock data
      store.documents = initializeMockDocuments();
      persistDocuments();
    }
  } catch (e) {
    console.error('Error loading documents:', e.message);
    store.documents = initializeMockDocuments();
  }
}

// Initialize with realistic mock documents
function initializeMockDocuments() {
  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const buyers = ['Burlington', 'Ross Missy', 'Ross Petite', 'Ross Plus', 'Bealls', 'General/All'];
  const types = ['Line Sheet', 'Purchase Order', 'Routing Guide', 'Compliance Guide', 'Invoice', 'Packing List', 'Sample Request', 'Other'];
  const seasons = ['Spring 2025', 'Summer 2025', 'Fall 2025', 'Holiday 2025', 'Spring 2026', 'Summer 2026'];
  const users = ['Sarah Chen', 'Michael Park', 'Jessica Martinez', 'Admin'];

  let id = 1;
  const docs = [
    // Burlington docs
    { id: id++, name: 'BUR-SS25-LineSheet.pdf', buyer: 'Burlington', type: 'Line Sheet', season: 'Spring 2025', uploadedBy: 'Sarah Chen', uploadDate: now, tags: ['spring','styles','caftans'], fileSize: 2400000 },
    { id: id++, name: 'BUR-PO-2025-001.pdf', buyer: 'Burlington', type: 'Purchase Order', season: 'Spring 2025', uploadedBy: 'Michael Park', uploadDate: oneWeekAgo, tags: ['purchase','order'], fileSize: 1800000 },
    { id: id++, name: 'BUR-RoutingGuide-SS25.docx', buyer: 'Burlington', type: 'Routing Guide', season: 'Spring 2025', uploadedBy: 'Sarah Chen', uploadDate: twoWeeksAgo, tags: ['routing','shipping'], fileSize: 950000 },
    { id: id++, name: 'BUR-ComplianceGuide-2025.pdf', buyer: 'Burlington', type: 'Compliance Guide', season: 'Spring 2025', uploadedBy: 'Admin', uploadDate: monthAgo, tags: ['compliance','standards'], fileSize: 3200000 },

    // Ross Missy docs
    { id: id++, name: 'ROSS-Missy-SS25-LineSheet.xlsx', buyer: 'Ross Missy', type: 'Line Sheet', season: 'Spring 2025', uploadedBy: 'Jessica Martinez', uploadDate: now, tags: ['missy','spring'], fileSize: 1500000 },
    { id: id++, name: 'ROSS-Missy-Invoice-2025-0342.pdf', buyer: 'Ross Missy', type: 'Invoice', season: 'Spring 2025', uploadedBy: 'Michael Park', uploadDate: oneWeekAgo, tags: ['invoice','billing'], fileSize: 850000 },
    { id: id++, name: 'ROSS-Missy-PackingList-SS25.pdf', buyer: 'Ross Missy', type: 'Packing List', season: 'Spring 2025', uploadedBy: 'Sarah Chen', uploadDate: twoWeeksAgo, tags: ['packing','shipping','missy'], fileSize: 1200000 },

    // Ross Petite docs
    { id: id++, name: 'ROSS-Petite-SampleRequest-Mar2025.docx', buyer: 'Ross Petite', type: 'Sample Request', season: 'Spring 2025', uploadedBy: 'Jessica Martinez', uploadDate: oneWeekAgo, tags: ['sample','request','petite'], fileSize: 620000 },
    { id: id++, name: 'ROSS-Petite-LineSheet-SS25.pdf', buyer: 'Ross Petite', type: 'Line Sheet', season: 'Spring 2025', uploadedBy: 'Sarah Chen', uploadDate: now, tags: ['petite','spring','styles'], fileSize: 2100000 },

    // Ross Plus docs
    { id: id++, name: 'ROSS-Plus-ComplianceChecklist-2025.xlsx', buyer: 'Ross Plus', type: 'Compliance Guide', season: 'Spring 2025', uploadedBy: 'Admin', uploadDate: monthAgo, tags: ['compliance','plus-size'], fileSize: 780000 },
    { id: id++, name: 'ROSS-Plus-RoutingGuide-SS25.pdf', buyer: 'Ross Plus', type: 'Routing Guide', season: 'Spring 2025', uploadedBy: 'Michael Park', uploadDate: twoWeeksAgo, tags: ['routing','plus'], fileSize: 1100000 },
    { id: id++, name: 'ROSS-Plus-PO-2025-004.pdf', buyer: 'Ross Plus', type: 'Purchase Order', season: 'Spring 2025', uploadedBy: 'Sarah Chen', uploadDate: oneWeekAgo, tags: ['purchase','order'], fileSize: 1600000 },

    // Bealls docs
    { id: id++, name: 'Bealls-SS25-LineSheet-Updated.xlsx', buyer: 'Bealls', type: 'Line Sheet', season: 'Spring 2025', uploadedBy: 'Jessica Martinez', uploadDate: now, tags: ['bealls','spring','updated'], fileSize: 1900000 },
    { id: id++, name: 'Bealls-PackingInstructions-2025.pdf', buyer: 'Bealls', type: 'Packing List', season: 'Spring 2025', uploadedBy: 'Michael Park', uploadDate: twoWeeksAgo, tags: ['packing','instructions'], fileSize: 1350000 },

    // General/All docs
    { id: id++, name: 'General-CompliancePolicies-2025.pdf', buyer: 'General/All', type: 'Compliance Guide', season: 'Spring 2025', uploadedBy: 'Admin', uploadDate: monthAgo, tags: ['general','compliance','all-buyers'], fileSize: 4200000 },
  ];

  return docs;
}

// Persist documents to file
function persistDocuments() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DOCUMENTS_PERSIST, JSON.stringify(store.documents, null, 2));
  } catch (e) {
    console.error('Error persisting documents:', e.message);
  }
}

// Load on startup
loadDocuments();

// Helper to get next ID
function getNextId() {
  return store.documents.length > 0 ? Math.max(...store.documents.map(d => d.id)) + 1 : 1;
}

// ==================== API ENDPOINTS ====================

// GET /api/documents - List documents with filtering
router.get('/', authMiddleware, (req, res) => {
  try {
    const { buyer, type, season, search } = req.query;

    let filtered = [...store.documents];

    if (buyer && buyer !== 'All') {
      filtered = filtered.filter(d => d.buyer === buyer);
    }

    if (type && type !== 'All') {
      filtered = filtered.filter(d => d.type === type);
    }

    if (season && season !== 'All') {
      filtered = filtered.filter(d => d.season === season);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.tags.some(tag => tag.toLowerCase().includes(q)) ||
        d.uploadedBy.toLowerCase().includes(q)
      );
    }

    // Sort by upload date descending
    filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    res.json(filtered);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/documents/upload - Upload a document
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { buyer, type, season, tags } = req.body;

    if (!buyer || !type || !season) {
      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Missing required fields: buyer, type, season' });
    }

    const id = getNextId();
    const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const doc = {
      id,
      name: req.file.originalname,
      buyer,
      type,
      season,
      uploadedBy: req.user?.full_name || 'Unknown',
      uploadDate: new Date(),
      tags: tagArray,
      fileSize: req.file.size,
      filePath: req.file.path, // Store the path for downloads
      mimeType: req.file.mimetype,
    };

    store.documents.push(doc);
    persistDocuments();

    res.json(doc);
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE /api/documents/:id - Delete a document
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const docIndex = store.documents.findIndex(d => d.id === parseInt(id));

    if (docIndex === -1) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = store.documents[docIndex];

    // Delete file if it exists
    if (doc.filePath && fs.existsSync(doc.filePath)) {
      fs.unlinkSync(doc.filePath);
    }

    store.documents.splice(docIndex, 1);
    persistDocuments();

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// GET /api/documents/:id/download - Download a document
router.get('/:id/download', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const doc = store.documents.find(d => d.id === parseInt(id));

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // For mock data (no file path), return a message
    if (!doc.filePath || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(doc.filePath, doc.name);
  } catch (err) {
    console.error('Error downloading document:', err);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

module.exports = router;
