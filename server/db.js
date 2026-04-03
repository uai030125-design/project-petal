const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

// ──────────────────────────────────────────────────────────────────────────────
// In-memory fallback store — used when PostgreSQL is unavailable
// ──────────────────────────────────────────────────────────────────────────────
let _nextId = 200;
const nextId = () => ++_nextId;

const store = {
  samples: [],  // populated from persist file below
  users: [
    {
      id: 1,
      email: 'admin@unlimitedavenues.com',
      // bcrypt hash of 'admin123'
      password_hash: '$2a$10$VfJ5dTvOmUHBgIu8NP3OserT5IOG8eGqOSVsNcDtaTOJOeuWCTBBq',
      full_name: 'Admin',
      role: 'admin',
      title: 'System Admin',
      department: 'IT',
      avatar_color: '#6366f1',
      is_active: true,
    },
  ],
  styles: [
    { id: 1,  style_number: 'SKO/18740/25', category: 'Caftan', colors: 'Beige/Black',        color_count: 2, image_url: '/images/caftan_SKO-18740-25.png', total_ats: 0, origin: null },
    { id: 2,  style_number: 'SKO/18759/25', category: 'Caftan', colors: 'Black/Floral',        color_count: 2, image_url: '/images/caftan_SKO-18759-25.png', total_ats: 0, origin: null },
    { id: 3,  style_number: 'SK 69',        category: 'Caftan', colors: 'Leopard/Peacock',     color_count: 2, image_url: '/images/caftan_SK-69.png',         total_ats: 0, origin: null },
    { id: 4,  style_number: 'SKO-040',      category: 'Caftan', colors: 'Pink/Green',          color_count: 2, image_url: '/images/caftan_SKO-040.png',       total_ats: 0, origin: null },
    { id: 5,  style_number: 'SKO-042',      category: 'Caftan', colors: 'Turquoise',           color_count: 1, image_url: '/images/caftan_SKO-042.png',       total_ats: 0, origin: null },
    { id: 6,  style_number: 'SK 49',        category: 'Caftan', colors: 'Leopard/Teal',        color_count: 2, image_url: '/images/caftan_SK-49.png',         total_ats: 0, origin: null },
    { id: 7,  style_number: 'SK 89',        category: 'Caftan', colors: 'Orange/Floral',       color_count: 2, image_url: '/images/caftan_SK-89.png',         total_ats: 0, origin: null },
    { id: 8,  style_number: 'SKO/18796/25', category: 'Caftan', colors: 'Black/Pink Floral',   color_count: 2, image_url: '/images/caftan_SKO-18796-25.png', total_ats: 0, origin: null },
    { id: 9,  style_number: 'SKO/18798/25', category: 'Caftan', colors: 'Red/Orange Tribal',   color_count: 2, image_url: '/images/caftan_SKO-18798-25.png', total_ats: 0, origin: null },
    { id: 10, style_number: 'SKO/18709/25', category: 'Caftan', colors: 'Black/Red Floral',    color_count: 2, image_url: '/images/caftan_SKO-18709-25.png', total_ats: 0, origin: null },
  ],
};

store.production_data = [];
store.containers = [];
store.internal_todos = [];

// Persist user-added data across server restarts
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, 'data');
const STYLES_PERSIST  = path.join(DATA_DIR, 'mock_styles.json');
const SAMPLES_PERSIST = path.join(DATA_DIR, 'mock_samples.json');
const PO_PERSIST      = path.join(DATA_DIR, 'po_tracking.json');
const PROD_PERSIST    = path.join(DATA_DIR, 'production_data.json');
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(STYLES_PERSIST)) {
    const extra = JSON.parse(fs.readFileSync(STYLES_PERSIST, 'utf8'));
    store.styles.push(...extra);
    _nextId = Math.max(_nextId, ...extra.map(s => s.id));
  }
  if (fs.existsSync(SAMPLES_PERSIST)) {
    const saved = JSON.parse(fs.readFileSync(SAMPLES_PERSIST, 'utf8'));
    store.samples.push(...saved);
    if (saved.length) _nextId = Math.max(_nextId, ...saved.map(s => s.id));
  }
  // Load po_tracking from JSON file
  if (fs.existsSync(PO_PERSIST)) {
    store.po_tracking = JSON.parse(fs.readFileSync(PO_PERSIST, 'utf8'));
    // Ensure every record has an id
    for (const row of store.po_tracking) {
      if (!row.id) row.id = nextId();
    }
    if (store.po_tracking.length) _nextId = Math.max(_nextId, ...store.po_tracking.map(r => r.id || 0));
  }
  // Load production_data
  if (fs.existsSync(PROD_PERSIST)) {
    store.production_data = JSON.parse(fs.readFileSync(PROD_PERSIST, 'utf8'));
    for (const row of store.production_data) { if (!row.id) row.id = nextId(); }
    if (store.production_data.length) _nextId = Math.max(_nextId, ...store.production_data.map(r => r.id || 0));
  }
} catch (e) { /* ignore */ }
if (!store.po_tracking) store.po_tracking = [];
if (!store.production_data) store.production_data = [];

// ── jazzy_trends mock data ──
const JAZZY_PERSIST = path.join(DATA_DIR, 'jazzy_trends.json');
if (fs.existsSync(JAZZY_PERSIST)) {
  try { store.jazzy_trends = JSON.parse(fs.readFileSync(JAZZY_PERSIST, 'utf8')); } catch { store.jazzy_trends = []; }
} else {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  // Image URLs go through /api/img-proxy on your server so they load from localhost
  const px = (u) => '/api/img-proxy?url=' + encodeURIComponent(u);
  store.jazzy_trends = [
    { id: 1, title: 'Folk Town Boho Maxi Dress', brand: 'Free People', source_url: 'https://www.freepeople.com/shop/folk-town-boho-dress', image_url: px('https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=400&q=80'), market: 'Missy', category: 'Dresses', description: 'Flowy maxi dress with intricate embroidery and tassel details. Earthy tones with a relaxed silhouette.', price_range: '$148', tags: ['boho','maxi','embroidered'], found_date: today, created_at: new Date().toISOString() },
    { id: 2, title: 'Daydreamer Crochet Top', brand: 'Free People', source_url: 'https://www.freepeople.com/shop/daydreamer-crochet-top', image_url: px('https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&q=80'), market: 'Juniors', category: 'Tops', description: 'Hand-crochet crop top with scalloped edges and adjustable ties. Festival-ready in ivory and sage green.', price_range: '$78', tags: ['crochet','crop','festival'], found_date: today, created_at: new Date().toISOString() },
    { id: 3, title: 'Canyon Sunset Wide-Leg Pants', brand: 'Free People', source_url: 'https://www.freepeople.com/shop/canyon-sunset-pants', image_url: px('https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80'), market: 'Missy', category: 'Bottoms', description: 'Relaxed wide-leg pants in a rust paisley print with smocked waistband.', price_range: '$108', tags: ['wide-leg','paisley'], found_date: today, created_at: new Date().toISOString() },
    { id: 4, title: 'Wildflower Tiered Mini Dress', brand: 'Free People', source_url: 'https://www.freepeople.com/shop/wildflower-tiered-mini', image_url: px('https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80'), market: 'Juniors', category: 'Dresses', description: 'Playful tiered mini dress with ditsy floral print and puff sleeves.', price_range: '$98', tags: ['floral','tiered','mini'], found_date: yesterday, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 5, title: 'Wanderer Suede Fringe Jacket', brand: 'Free People', source_url: 'https://www.freepeople.com/shop/wanderer-fringe-jacket', image_url: px('https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400&q=80'), market: 'Missy', category: 'Outerwear', description: 'Vintage-inspired suede jacket with long fringe detailing.', price_range: '$268', tags: ['fringe','suede','western'], found_date: yesterday, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 6, title: 'Embroidered Prairie Midi Dress', brand: 'Anthropologie', source_url: 'https://www.anthropologie.com/shop/embroidered-prairie-midi-dress', image_url: px('https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80'), market: 'Missy', category: 'Dresses', description: 'Delicate floral embroidery on a breezy cotton midi with ruffled tiers.', price_range: '$188', tags: ['prairie','embroidered','midi'], found_date: yesterday, created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 7, title: 'Velvet Underground Blazer', brand: 'Anthropologie', source_url: 'https://www.anthropologie.com/shop/velvet-underground-blazer', image_url: px('https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80'), market: 'Missy', category: 'Outerwear', description: 'Oversized velvet blazer in deep plum with satin lining.', price_range: '$228', tags: ['velvet','blazer','oversized'], found_date: twoDaysAgo, created_at: new Date(Date.now() - 2*86400000).toISOString() },
    { id: 8, title: 'Bohemian Garden Wrap Skirt', brand: "Altar'd State", source_url: 'https://www.altardstate.com/shop/bohemian-garden-wrap-skirt', image_url: px('https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&q=80'), market: 'Juniors', category: 'Bottoms', description: 'Wrap-style midi skirt in a botanical print with ruffle hem.', price_range: '$58', tags: ['wrap','botanical','midi'], found_date: twoDaysAgo, created_at: new Date(Date.now() - 2*86400000).toISOString() },
    { id: 9, title: 'Sunset Festival Kimono', brand: "Altar'd State", source_url: 'https://www.altardstate.com/shop/sunset-festival-kimono', image_url: px('https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&q=80'), market: 'Juniors', category: 'Outerwear', description: 'Lightweight kimono with paisley print and tassel trim. One-size.', price_range: '$48', tags: ['kimono','festival','tassel'], found_date: twoDaysAgo, created_at: new Date(Date.now() - 2*86400000).toISOString() },
    { id: 10, title: 'Boho Linen Jumpsuit', brand: 'Mango', source_url: 'https://www.mango.com/shop/boho-linen-jumpsuit', image_url: px('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'), market: 'Missy', category: 'Jumpsuits', description: 'Relaxed linen jumpsuit with wide legs and a cinched waist. Natural sand colorway.', price_range: '$89', tags: ['linen','jumpsuit','boho'], found_date: twoDaysAgo, created_at: new Date(Date.now() - 2*86400000).toISOString() },
    { id: 11, title: 'Patchwork Denim Jacket', brand: 'PacSun', source_url: 'https://www.pacsun.com/shop/patchwork-denim-jacket', image_url: px('https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80'), market: 'Juniors', category: 'Outerwear', description: 'Oversized denim jacket with vintage patchwork panels and distressed wash.', price_range: '$72', tags: ['denim','patchwork','vintage'], found_date: today, created_at: new Date().toISOString() },
    { id: 12, title: 'Crochet Cutout Maxi', brand: 'Revolve', source_url: 'https://www.revolve.com/shop/crochet-cutout-maxi', image_url: px('https://images.unsplash.com/photo-1518622358385-8ea7d0794bf6?w=400&q=80'), market: 'Juniors', category: 'Dresses', description: 'Body-skimming maxi with crochet cutout panels at the waist. White.', price_range: '$224', tags: ['crochet','cutout','maxi'], found_date: today, created_at: new Date().toISOString() },
  ];
}
function persistJazzy() {
  try { fs.writeFileSync(JAZZY_PERSIST, JSON.stringify(store.jazzy_trends, null, 2)); }
  catch (e) { console.error('[db-mock] Failed to persist jazzy_trends:', e.message); }
}
let _jazzyNextId = store.jazzy_trends.length > 0 ? Math.max(...store.jazzy_trends.map(t => t.id)) + 1 : 1;

function persistProduction() {
  try { fs.writeFileSync(PROD_PERSIST, JSON.stringify(store.production_data, null, 2)); }
  catch (e) { console.error('[db-mock] Failed to persist production_data:', e.message); }
}

function persistExtraStyles() {
  try {
    const extra = store.styles.filter(s => s.id >= 200);
    fs.writeFileSync(STYLES_PERSIST, JSON.stringify(extra, null, 2));
  } catch (e) { /* ignore */ }
}

function persistSamples() {
  try {
    fs.writeFileSync(SAMPLES_PERSIST, JSON.stringify(store.samples, null, 2));
  } catch (e) { /* ignore */ }
}

function persistPoTracking() {
  try {
    fs.writeFileSync(PO_PERSIST, JSON.stringify(store.po_tracking));
  } catch (e) {
    console.error('[db-mock] Failed to persist po_tracking:', e.message);
  }
}

// Filter po_tracking rows based on SQL WHERE clauses
function applyPoFilters(rows, sql, params) {
  // warehouse filter: pt.warehouse = $N
  const whMatch = sql.match(/pt\.warehouse\s*=\s*\$(\d+)/i);
  if (whMatch) {
    const val = (params[parseInt(whMatch[1]) - 1] || '').toUpperCase();
    rows = rows.filter(r => (r.warehouse || '').toUpperCase() === val);
  }
  // search filter: po_number ILIKE $N OR cut_ticket ILIKE $N ...
  const searchMatch = sql.match(/pt\.po_number ILIKE \$(\d+)/i);
  if (searchMatch) {
    const val = (params[parseInt(searchMatch[1]) - 1] || '').replace(/%/g, '').toLowerCase();
    rows = rows.filter(r =>
      (r.po_number || '').toLowerCase().includes(val) ||
      (r.cut_ticket || '').toLowerCase().includes(val) ||
      (r.pick_ticket || '').toLowerCase().includes(val) ||
      (r.style || '').toLowerCase().includes(val)
    );
  }
  // buyer filter
  const buyerMatch = sql.match(/pt\.buyer ILIKE \$(\d+)/i);
  if (buyerMatch) {
    const val = (params[parseInt(buyerMatch[1]) - 1] || '').replace(/%/g, '').toLowerCase();
    rows = rows.filter(r => (r.buyer || '').toLowerCase().includes(val));
  }
  // shipping scope: date range filter
  if (/ship_window_end >= CURRENT_DATE/i.test(sql) && /INTERVAL/i.test(sql)) {
    const now = new Date(); now.setHours(0,0,0,0);
    const past = new Date(now); past.setDate(past.getDate() - 90);
    const future = new Date(now); future.setDate(future.getDate() + 30);
    rows = rows.filter(r => {
      if (!r.ship_window_end) return false;
      const d = new Date(r.ship_window_end);
      return d >= past && d <= future;
    });
  }
  // status filter (computed)
  const statusMatch = sql.match(/ELSE 'not_routed'\s+END\s*=\s*\$(\d+)/i);
  if (statusMatch) {
    const val = params[parseInt(statusMatch[1]) - 1];
    rows = rows.filter(r => {
      const computed = (r.routing_id && r.routing_id !== '') ? 'routed' :
        r.routing_status === 'Shipped' ? 'shipped' :
        r.routing_status === 'Cancelled' ? 'cancelled' : 'not_routed';
      return computed === val;
    });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────────
// Simple SQL mock — handles the subset of queries our routes use
// ──────────────────────────────────────────────────────────────────────────────
function mockQuery(text, params) {
  params = params || [];
  const sql = text.replace(/\s+/g, ' ').trim();

  // Debug: log po_tracking queries
  if (sql.includes('po_tracking') && !sql.includes('CREATE') && !sql.includes('ALTER') && !sql.includes('DROP')) {
    console.log(`[mock-debug] po_tracking query: ${sql.slice(0, 100)} | store.po_tracking.length=${store.po_tracking.length}`);
  }

  // SELECT COUNT(*) FROM styles
  if (/^SELECT COUNT\(\*\) FROM styles/i.test(sql)) {
    let rows = [...store.styles];
    const catMatch = sql.match(/category ILIKE \$(\d+)/i);
    if (catMatch) {
      const val = (params[parseInt(catMatch[1]) - 1] || '').toLowerCase().replace(/%/g, '');
      rows = rows.filter(s => (s.category || '').toLowerCase().includes(val));
    }
    return { rows: [{ count: String(rows.length) }] };
  }

  // SELECT * FROM styles
  if (/^SELECT \* FROM styles/i.test(sql)) {
    let rows = [...store.styles];
    const catMatch = sql.match(/category ILIKE \$(\d+)/i);
    if (catMatch) {
      const val = (params[parseInt(catMatch[1]) - 1] || '').toLowerCase().replace(/%/g, '');
      rows = rows.filter(s => (s.category || '').toLowerCase().includes(val));
    }
    const searchMatch = sql.match(/style_number ILIKE \$(\d+)/i);
    if (searchMatch) {
      const val = (params[parseInt(searchMatch[1]) - 1] || '').toLowerCase().replace(/%/g, '');
      rows = rows.filter(s =>
        (s.style_number || '').toLowerCase().includes(val) ||
        (s.colors || '').toLowerCase().includes(val) ||
        (s.origin || '').toLowerCase().includes(val)
      );
    }
    // WHERE id = $1
    const idMatch = sql.match(/WHERE id = \$(\d+)/i);
    if (idMatch) {
      const id = parseInt(params[parseInt(idMatch[1]) - 1]);
      rows = rows.filter(s => s.id === id);
    }
    rows.sort((a, b) => {
      const cc = (a.category || '').localeCompare(b.category || '');
      return cc !== 0 ? cc : (a.style_number || '').localeCompare(b.style_number || '');
    });
    const limitMatch = [...sql.matchAll(/LIMIT \$(\d+)/gi)];
    const offsetMatch = [...sql.matchAll(/OFFSET \$(\d+)/gi)];
    if (limitMatch.length > 0) {
      const lim = parseInt(params[parseInt(limitMatch[0][1]) - 1]) || 50;
      const off = offsetMatch.length > 0 ? parseInt(params[parseInt(offsetMatch[0][1]) - 1]) || 0 : 0;
      rows = rows.slice(off, off + lim);
    }
    return { rows };
  }

  // SELECT DISTINCT category FROM styles
  if (/SELECT DISTINCT category FROM styles/i.test(sql)) {
    const cats = [...new Set(store.styles.map(s => s.category).filter(Boolean))].sort();
    return { rows: cats.map(c => ({ category: c })) };
  }

  // INSERT INTO styles
  if (/^INSERT INTO styles/i.test(sql)) {
    const id = nextId();
    const colMatch = sql.match(/INSERT INTO styles \(([^)]+)\)/i);
    const cols = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];
    const row = { id, total_ats: 0, image_url: null };
    cols.forEach((col, i) => { row[col] = params[i] !== undefined ? params[i] : null; });
    store.styles.push(row);
    persistExtraStyles();
    return { rows: [row] };
  }

  // UPDATE styles SET image_url = $1 WHERE id = $2 RETURNING *
  if (/^UPDATE styles SET image_url/i.test(sql)) {
    const imgUrl = params[0];
    const id = parseInt(params[1]);
    const style = store.styles.find(s => s.id === id);
    if (style) { style.image_url = imgUrl; persistExtraStyles(); }
    return { rows: style ? [style] : [] };
  }

  // UPDATE styles SET ... (generic)
  if (/^UPDATE styles SET/i.test(sql)) {
    const idMatch = sql.match(/WHERE id = \$(\d+)/i);
    if (idMatch) {
      const id = parseInt(params[parseInt(idMatch[1]) - 1]);
      const style = store.styles.find(s => s.id === id);
      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch && style) {
        setMatch[1].split(',').forEach(part => {
          const m = part.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
          if (m) style[m[1]] = params[parseInt(m[2]) - 1];
        });
        persistExtraStyles();
      }
      return { rows: style ? [style] : [] };
    }
    return { rows: [] };
  }

  // DELETE FROM styles WHERE id
  if (/^DELETE FROM styles WHERE id/i.test(sql)) {
    const id = parseInt(params[0]);
    const idx = store.styles.findIndex(s => s.id === id);
    let deleted = [];
    if (idx !== -1) { deleted = store.styles.splice(idx, 1); persistExtraStyles(); }
    return { rows: deleted };
  }

  // ── SELECT * FROM samples ────────────────────────────────────────────────
  if (/^SELECT \* FROM samples/i.test(sql)) {
    const rows = [...store.samples].sort((a, b) => {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return { rows };
  }

  // ── INSERT INTO samples ──────────────────────────────────────────────────
  if (/^INSERT INTO samples/i.test(sql)) {
    const id = nextId();
    const colMatch = sql.match(/INSERT INTO samples \(([^)]+)\)/i);
    const cols = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];
    const row = { id, image_url: null, created_at: new Date().toISOString() };
    cols.forEach((col, i) => { if (col !== 'NOW()') row[col] = params[i] !== undefined ? params[i] : null; });
    store.samples.push(row);
    persistSamples();
    return { rows: [row] };
  }

  // ── UPDATE samples SET image_url ─────────────────────────────────────────
  if (/^UPDATE samples SET image_url/i.test(sql)) {
    const imgUrl = params[0];
    const id = parseInt(params[1]);
    const sample = store.samples.find(s => s.id === id);
    if (sample) { sample.image_url = imgUrl; persistSamples(); }
    return { rows: sample ? [sample] : [] };
  }

  // ── UPDATE samples SET ... (generic) ─────────────────────────────────────
  if (/^UPDATE samples SET/i.test(sql)) {
    const idMatch = sql.match(/WHERE id = \$(\d+)/i);
    if (idMatch) {
      const id = parseInt(params[parseInt(idMatch[1]) - 1]);
      const sample = store.samples.find(s => s.id === id);
      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch && sample) {
        setMatch[1].split(',').forEach(part => {
          const m = part.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
          if (m) sample[m[1]] = params[parseInt(m[2]) - 1];
        });
        persistSamples();
      }
      return { rows: sample ? [sample] : [] };
    }
    return { rows: [] };
  }

  // ── DELETE FROM samples ──────────────────────────────────────────────────
  if (/^DELETE FROM samples WHERE id/i.test(sql)) {
    const id = parseInt(params[0]);
    const idx = store.samples.findIndex(s => s.id === id);
    let deleted = [];
    if (idx !== -1) { deleted = store.samples.splice(idx, 1); persistSamples(); }
    return { rows: deleted };
  }

  // SELECT * FROM users WHERE email
  if (/FROM users WHERE email/i.test(sql)) {
    const email = params[0];
    const user = store.users.find(u => u.email === email && u.is_active);
    return { rows: user ? [user] : [] };
  }

  // SELECT FROM users WHERE id
  if (/FROM users WHERE id/i.test(sql)) {
    const id = parseInt(params[0]);
    const user = store.users.find(u => u.id === id);
    return { rows: user ? [user] : [] };
  }

  // ── po_tracking: SELECT COUNT(*) ─────────────────────────────────────────
  if (/^SELECT COUNT\(\*\).*FROM po_tracking/i.test(sql)) {
    let rows = [...store.po_tracking];
    rows = applyPoFilters(rows, sql, params);
    return { rows: [{ count: String(rows.length) }] };
  }

  // ── po_tracking: SELECT * / SELECT fields ──────────────────────────────
  if (/^SELECT[\s\S]*FROM po_tracking/i.test(sql)) {
    let rows = [...store.po_tracking];
    rows = applyPoFilters(rows, sql, params);
    // Apply column aliases (pt.po_number AS po, etc.)
    rows = rows.map(r => ({
      id: r.id,
      po: r.po_number,
      ticket_number: r.cut_ticket,
      store_name: r.buyer,
      start_date: r.ship_window_start && !isNaN(new Date(r.ship_window_start).getTime()) ? new Date(r.ship_window_start).toISOString() : r.ship_window_start || null,
      cancel_date: r.ship_window_end && !isNaN(new Date(r.ship_window_end).getTime()) ? new Date(r.ship_window_end).toISOString() : r.ship_window_end || null,
      warehouse_code: r.warehouse,
      routing: r.routing_id,
      routing_status:
        (r.routing_id && r.routing_id !== '') ? 'routed' :
        r.routing_status === 'Shipped' ? 'shipped' :
        r.routing_status === 'Cancelled' ? 'cancelled' : 'not_routed',
      lifecycle:
        (r.date_shipped || r.routing_status === 'Shipped') ? 'Shipped' :
        (r.routing_id && r.routing_id !== '' && r.carrier && r.carrier !== '') ? 'In Transit' :
        (r.routing_id && r.routing_id !== '') ? 'Routed' : null,
      style: r.style,
      units: r.units || 0,
      cartons: r.cartons || 0,
      lot: r.lot,
      date_shipped: r.date_shipped,
      carrier: r.carrier,
      notes: r.notes,
      shipment_info: r.shipment_info || null,
      pick_ticket: r.pick_ticket || null,
      so_number: r.so_number || null,
      ct_ticket: null,
      ct_status: null,
      // Also keep raw fields for dedup/generic queries
      po_number: r.po_number,
      cut_ticket: r.cut_ticket,
      buyer: r.buyer,
      ship_window_start: r.ship_window_start,
      ship_window_end: r.ship_window_end,
      warehouse: r.warehouse,
      routing_id: r.routing_id,
    }));
    // Sort
    rows.sort((a, b) => {
      const ae = a.cancel_date || ''; const be = b.cancel_date || '';
      return ae.localeCompare(be) || (a.po || '').localeCompare(b.po || '');
    });
    // Limit/offset
    const limitMatch = [...sql.matchAll(/LIMIT \$(\d+)/gi)];
    const offsetMatch = [...sql.matchAll(/OFFSET \$(\d+)/gi)];
    if (limitMatch.length > 0) {
      const lim = parseInt(params[parseInt(limitMatch[0][1]) - 1]) || 5000;
      const off = offsetMatch.length > 0 ? parseInt(params[parseInt(offsetMatch[0][1]) - 1]) || 0 : 0;
      rows = rows.slice(off, off + lim);
    }
    return { rows };
  }

  // ── po_tracking: INSERT ────────────────────────────────────────────────
  if (/^INSERT INTO po_tracking/i.test(sql)) {
    const id = nextId();
    const colMatch = sql.match(/INSERT INTO po_tracking\s*\(([^)]+)\)/i);
    const cols = colMatch ? colMatch[1].split(',').map(c => c.trim()) : [];
    const row = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    cols.forEach((col, i) => { row[col] = params[i] !== undefined ? params[i] : null; });
    store.po_tracking.push(row);
    // Defer persist to avoid I/O on every insert during bulk sync
    if (!store._poPersistTimer) {
      store._poPersistTimer = setTimeout(() => { persistPoTracking(); store._poPersistTimer = null; }, 2000);
    }
    return { rows: [row] };
  }

  // ── po_tracking: UPDATE ────────────────────────────────────────────────
  if (/^UPDATE po_tracking/i.test(sql)) {
    const idMatch = sql.match(/WHERE id = \$(\d+)/i);
    if (idMatch) {
      const id = parseInt(params[parseInt(idMatch[1]) - 1]);
      const row = store.po_tracking.find(r => r.id === id);
      const setMatch = sql.match(/SET (.+?) WHERE/i);
      if (setMatch && row) {
        setMatch[1].split(',').forEach(part => {
          const m = part.trim().match(/(\w+)\s*=\s*\$(\d+)/i);
          if (m) row[m[1]] = params[parseInt(m[2]) - 1];
          const nullM = part.trim().match(/(\w+)\s*=\s*NULL/i);
          if (nullM) row[nullM[1]] = null;
        });
        row.updated_at = new Date().toISOString();
        persistPoTracking();
      }
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    // UPDATE with FROM (e.g. update cut_ticket from cut_tickets) — skip silently
    return { rows: [], rowCount: 0 };
  }

  // ── po_tracking: DELETE ────────────────────────────────────────────────
  if (/^DELETE FROM po_tracking WHERE id = \$(\d+)/i.test(sql)) {
    const idIdx = parseInt(sql.match(/\$(\d+)/)[1]) - 1;
    const id = parseInt(params[idIdx]);
    const idx = store.po_tracking.findIndex(r => r.id === id);
    if (idx !== -1) { store.po_tracking.splice(idx, 1); persistPoTracking(); }
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }
  if (/^DELETE FROM po_tracking/i.test(sql)) {
    const count = store.po_tracking.length;
    store.po_tracking = [];
    persistPoTracking();
    return { rows: [], rowCount: count };
  }

  // ── production_data: SELECT ───────────────────────────────────────────
  if (/^SELECT \* FROM production_data/i.test(sql)) {
    let rows = [...store.production_data];
    const searchMatch = sql.match(/LIKE LOWER\(\$(\d+)\)/i);
    if (searchMatch) {
      const val = (params[parseInt(searchMatch[1]) - 1] || '').replace(/%/g, '').toLowerCase();
      rows = rows.filter(r =>
        (r.ct || '').toLowerCase().includes(val) ||
        (r.customer || '').toLowerCase().includes(val) ||
        (r.customer_po || '').toLowerCase().includes(val) ||
        (r.vendor || '').toLowerCase().includes(val) ||
        (r.style || '').toLowerCase().includes(val) ||
        (r.color || '').toLowerCase().includes(val)
      );
    }
    rows.sort((a, b) => ((a.due_date || '') > (b.due_date || '') ? 1 : -1));
    return { rows };
  }
  if (/^SELECT id FROM production_data/i.test(sql)) {
    return { rows: store.production_data.map(r => ({ id: r.id })) };
  }
  // ── production_data: INSERT ───────────────────────────────────────────
  if (/^INSERT INTO production_data/i.test(sql)) {
    const id = nextId();
    const row = {
      id, ct: params[0], customer: params[1], customer_po: params[2], vendor: params[3],
      style: params[4], color: params[5], units: parseInt(params[6]) || 0,
      due_date: params[7], notes: params[8] || '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.production_data.push(row);
    if (!store._prodPersistTimer) {
      store._prodPersistTimer = setTimeout(() => { persistProduction(); store._prodPersistTimer = null; }, 2000);
    }
    return { rows: [row] };
  }
  // ── production_data: UPDATE ───────────────────────────────────────────
  if (/^UPDATE production_data/i.test(sql)) {
    const idIdx = sql.match(/WHERE id=\$(\d+)/i);
    if (idIdx) {
      const id = parseInt(params[parseInt(idIdx[1]) - 1]);
      const row = store.production_data.find(r => r.id === id);
      if (row) {
        row.ct = params[0]; row.customer = params[1]; row.customer_po = params[2];
        row.vendor = params[3]; row.style = params[4]; row.color = params[5];
        row.units = parseInt(params[6]) || 0; row.due_date = params[7]; row.notes = params[8] || '';
        row.updated_at = new Date().toISOString();
        persistProduction();
      }
      return { rows: row ? [row] : [] };
    }
    return { rows: [] };
  }
  // ── production_data: DELETE ───────────────────────────────────────────
  if (/^DELETE FROM production_data WHERE id/i.test(sql)) {
    const id = parseInt(params[0]);
    const idx = store.production_data.findIndex(r => r.id === id);
    if (idx !== -1) { store.production_data.splice(idx, 1); persistProduction(); }
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }
  if (/^DELETE FROM production_data/i.test(sql)) {
    const count = store.production_data.length;
    store.production_data = [];
    persistProduction();
    return { rows: [], rowCount: count };
  }

  // ── Generic CREATE TABLE / ALTER TABLE handler ─────────────────────────
  if (/^CREATE TABLE/i.test(sql) || /^ALTER TABLE/i.test(sql) || /^DROP CONSTRAINT/i.test(sql)) {
    return { rows: [] };
  }

  // ── jazzy_trends: SELECT tags (for save toggle) ─────────────────────
  if (/^SELECT tags FROM jazzy_trends WHERE id/i.test(sql)) {
    const id = parseInt(params[0]);
    const row = store.jazzy_trends.find(r => r.id === id);
    return { rows: row ? [{ tags: row.tags || [] }] : [] };
  }

  // ── jazzy_trends: SELECT COUNT (MUST come before SELECT *) ──────────
  if (/SELECT COUNT/i.test(sql) && /jazzy_trends/i.test(sql)) {
    console.log('[db-mock] jazzy COUNT matched');
    let rows = store.jazzy_trends;
    const today = new Date().toISOString().split('T')[0];
    if (/found_date = CURRENT_DATE/i.test(sql)) {
      rows = rows.filter(r => r.found_date === today);
    }
    if (/ANY\(tags\)/i.test(sql) || /'saved' = ANY/i.test(sql)) {
      rows = rows.filter(r => (r.tags || []).includes('saved'));
    }
    return { rows: [{ count: String(rows.length) }] };
  }

  // ── jazzy_trends: SELECT market/brand GROUP BY (MUST come before SELECT *) ─
  if (/GROUP BY/i.test(sql) && /jazzy_trends/i.test(sql)) {
    console.log('[db-mock] jazzy GROUP BY matched');
    const field = /SELECT market/i.test(sql) ? 'market' : 'brand';
    const counts = {};
    store.jazzy_trends.forEach(t => {
      const key = t[field] || '';
      counts[key] = (counts[key] || 0) + 1;
    });
    const rows = Object.entries(counts)
      .map(([val, count]) => ({ [field]: val, count: String(count) }))
      .sort((a, b) => parseInt(b.count) - parseInt(a.count));
    return { rows };
  }

  // ── jazzy_trends: SELECT * (catch-all for jazzy SELECTs) ──────────────
  if (/jazzy_trends/i.test(sql) && /^SELECT/i.test(sql)) {
    console.log('[db-mock] jazzy SELECT matched, store has', store.jazzy_trends.length, 'rows');
    let rows = [...store.jazzy_trends];
    // Date filter: found_date >= CURRENT_DATE - $1
    if (params.length > 0 && /found_date/i.test(sql)) {
      const daysBack = parseInt(params[0]) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysBack);
      rows = rows.filter(r => !r.found_date || new Date(r.found_date) >= cutoff);
    }
    // Market filter
    const marketIdx = sql.match(/market\s*=\s*\$(\d+)/i);
    if (marketIdx) {
      const val = params[parseInt(marketIdx[1]) - 1];
      if (val) rows = rows.filter(r => r.market === val);
    }
    // Brand filter
    const brandIdx = sql.match(/LOWER\(brand\)\s*=\s*LOWER\(\$(\d+)\)/i);
    if (brandIdx) {
      const val = (params[parseInt(brandIdx[1]) - 1] || '').toLowerCase();
      if (val) rows = rows.filter(r => (r.brand || '').toLowerCase() === val);
    }
    // Search filter
    const searchIdx = sql.match(/LOWER\(title\) LIKE LOWER\(\$(\d+)\)/i);
    if (searchIdx) {
      const val = (params[parseInt(searchIdx[1]) - 1] || '').replace(/%/g, '').toLowerCase();
      if (val) rows = rows.filter(r =>
        (r.title || '').toLowerCase().includes(val) ||
        (r.description || '').toLowerCase().includes(val) ||
        (r.brand || '').toLowerCase().includes(val)
      );
    }
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return { rows };
  }

  // ── jazzy_trends: INSERT ──────────────────────────────────────────────
  if (/^INSERT INTO jazzy_trends/i.test(sql)) {
    const id = _jazzyNextId++;
    const row = {
      id,
      title: params[0] || '',
      brand: params[1] || '',
      source_url: params[2] || '',
      image_url: params[3] || '',
      market: params[4] || '',
      category: params[5] || '',
      description: params[6] || '',
      price_range: params[7] || '',
      tags: params[8] || [],
      found_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    store.jazzy_trends.push(row);
    persistJazzy();
    return { rows: [row] };
  }

  // ── jazzy_trends: UPDATE (save/unsave) ────────────────────────────────
  if (/^UPDATE jazzy_trends/i.test(sql)) {
    const idMatch = sql.match(/WHERE id = \$(\d+)/i);
    if (idMatch) {
      const id = parseInt(params[parseInt(idMatch[1]) - 1]);
      const row = store.jazzy_trends.find(r => r.id === id);
      if (row) {
        // Toggle saved tag
        if (sql.includes('tags')) {
          const tagsIdx = sql.match(/tags\s*=\s*\$(\d+)/i);
          if (tagsIdx) row.tags = params[parseInt(tagsIdx[1]) - 1] || [];
        }
        // Update image_url
        if (/image_url\s*=\s*\$/i.test(sql)) {
          const imgIdx = sql.match(/image_url\s*=\s*\$(\d+)/i);
          if (imgIdx) row.image_url = params[parseInt(imgIdx[1]) - 1];
        }
        // Update found_date
        if (/found_date\s*=\s*\$/i.test(sql)) {
          const fdIdx = sql.match(/found_date\s*=\s*\$(\d+)/i);
          if (fdIdx) row.found_date = params[parseInt(fdIdx[1]) - 1];
        }
        // Update any other SET field generically
        const setMatches = sql.matchAll(/(\w+)\s*=\s*\$(\d+)/gi);
        for (const m of setMatches) {
          const field = m[1].toLowerCase();
          const paramIdx = parseInt(m[2]) - 1;
          if (field !== 'id' && params[paramIdx] !== undefined && !['tags','image_url','found_date'].includes(field)) {
            row[field] = params[paramIdx];
          }
        }
        persistJazzy();
        return { rows: [row] };
      }
    }
    return { rows: [] };
  }

  // ── jazzy_trends: DELETE ──────────────────────────────────────────────
  if (/^DELETE FROM jazzy_trends WHERE id = \$(\d+)/i.test(sql)) {
    const idMatch = sql.match(/\$(\d+)/);
    const id = parseInt(params[parseInt(idMatch[1]) - 1]);
    const idx = store.jazzy_trends.findIndex(r => r.id === id);
    if (idx !== -1) { store.jazzy_trends.splice(idx, 1); persistJazzy(); }
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }

  // ── agent_logs: INSERT (no-op) ─────────────────────────────────────────
  if (/^INSERT INTO agent_logs/i.test(sql)) {
    return { rows: [{ id: nextId(), agent_name: params[0], action: params[1], details: params[2], created_at: new Date().toISOString() }] };
  }
  // ── agent_logs: SELECT ────────────────────────────────────────────────
  if (/agent_logs/i.test(sql)) {
    if (/COUNT/i.test(sql)) return { rows: [{ count: '0' }] };
    return { rows: [] };
  }

  // ── containers: SELECT ───────────────────────────────────────────────
  if (/^SELECT.*FROM containers/i.test(sql)) {
    if (/SELECT id FROM containers$/i.test(sql.trim())) {
      return { rows: store.containers.map(c => ({ id: c.id })) };
    }
    return { rows: [...store.containers].sort((a, b) => (b.id || 0) - (a.id || 0)) };
  }
  // ── containers: INSERT ──────────────────────────────────────────────
  if (/^INSERT INTO containers/i.test(sql)) {
    const row = {
      id: nextId(), folder: params[0] || '', lot: params[1] || '', container: params[2] || '',
      invoice: params[3] || '', method: params[4] || '', eta: params[5], notes: params[6] || '',
      cut_tickets: params[7] || '', received: params[8] || false, pts_issued: params[9] || false,
      ats_remaining: params[10] || false, qb: params[11] || false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.containers.push(row);
    return { rows: [row] };
  }
  // ── containers: UPDATE ──────────────────────────────────────────────
  if (/^UPDATE containers/i.test(sql)) {
    const id = parseInt(params[params.length - 1]);
    const c = store.containers.find(r => r.id === id);
    if (c) {
      Object.assign(c, {
        folder: params[0], lot: params[1], container: params[2], invoice: params[3],
        method: params[4], eta: params[5], notes: params[6], cut_tickets: params[7],
        received: params[8], pts_issued: params[9], ats_remaining: params[10], qb: params[11],
        updated_at: new Date().toISOString(),
      });
      return { rows: [c] };
    }
    return { rows: [] };
  }
  // ── containers: DELETE ──────────────────────────────────────────────
  if (/^DELETE FROM containers/i.test(sql)) {
    const id = parseInt(params[0]);
    const idx = store.containers.findIndex(r => r.id === id);
    if (idx !== -1) store.containers.splice(idx, 1);
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }

  // ── internal_todos: SELECT ──────────────────────────────────────────
  if (/^SELECT.*FROM internal_todos/i.test(sql)) {
    if (/COALESCE\(MAX\(sort_order\)/i.test(sql)) {
      const max = store.internal_todos.reduce((m, t) => Math.max(m, t.sort_order || 0), 0);
      return { rows: [{ next: max + 1 }] };
    }
    return { rows: [...store.internal_todos].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id) };
  }
  // ── internal_todos: INSERT ──────────────────────────────────────────
  if (/^INSERT INTO internal_todos/i.test(sql)) {
    const row = {
      id: nextId(), title: params[0] || '', done: params[1] || false,
      status: params[2] || 'Not Started', comment: params[3] || '',
      sort_order: params[4] || 0, done_by: params[5] || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.internal_todos.push(row);
    return { rows: [row] };
  }
  // ── internal_todos: UPDATE ──────────────────────────────────────────
  if (/^UPDATE internal_todos/i.test(sql)) {
    const id = parseInt(params[params.length - 1]);
    const t = store.internal_todos.find(r => r.id === id);
    if (t) {
      if (params[0] !== undefined && params[0] !== null) t.title = params[0];
      if (params[1] !== undefined && params[1] !== null) t.done = params[1];
      if (params[2] !== undefined && params[2] !== null) t.status = params[2];
      if (params[3] !== undefined && params[3] !== null) t.comment = params[3];
      t.done_by = params[4] !== undefined ? params[4] : t.done_by;
      t.updated_at = new Date().toISOString();
      return { rows: [t] };
    }
    return { rows: [] };
  }
  // ── internal_todos: DELETE ──────────────────────────────────────────
  if (/^DELETE FROM internal_todos/i.test(sql)) {
    const id = parseInt(params[0]);
    const idx = store.internal_todos.findIndex(r => r.id === id);
    let deleted = [];
    if (idx !== -1) { deleted = store.internal_todos.splice(idx, 1); }
    return { rows: deleted.map(r => ({ id: r.id })) };
  }

  // Catch-all
  console.warn('[db-mock] Unhandled query:', sql.slice(0, 120));
  return { rows: [] };
}

// ──────────────────────────────────────────────────────────────────────────────
// PostgreSQL pool — falls back to mock on connection failure
// ──────────────────────────────────────────────────────────────────────────────
let pgPool = null;
let usingMock = false;

try {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 3000,
  });

  pgPool.on('error', (err) => {
    console.warn('[db] Idle client error — switching to mock store:', err.message);
    usingMock = true;
  });

  pgPool.query('SELECT 1').then(() => {
    console.log('[db] PostgreSQL connected.');
  }).catch((err) => {
    console.warn('[db] PostgreSQL unavailable — using in-memory mock store:', err.message);
    usingMock = true;
  });
} catch (e) {
  console.warn('[db] Could not create pg Pool — using in-memory mock store:', e.message);
  usingMock = true;
}

module.exports = {
  query: async (text, params) => {
    if (!usingMock && pgPool) {
      try {
        return await pgPool.query(text, params);
      } catch (err) {
        // Connection-level errors → permanently switch to mock
        const hardErr = ['ECONNREFUSED', 'ENOTFOUND', '57P01', 'ETIMEDOUT', '08006', '08001', '08004'];
        if (hardErr.includes(err.code)) {
          console.warn('[db] PG connection failed, switching to mock permanently:', err.message);
          usingMock = true;
        } else if (err.code === '42P01') {
          // Table doesn't exist in PG → fall through to mock for THIS query only
          console.warn('[db] Table missing in PG, using mock for this query:', text.slice(0, 80));
          return mockQuery(text, params);
        } else {
          throw err;
        }
      }
    }
    return mockQuery(text, params);
  },
  get pool() { return pgPool; },
  get usingMock() { return usingMock; },
};
