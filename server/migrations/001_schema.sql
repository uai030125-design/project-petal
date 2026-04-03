-- ============================================================
-- UNLIMITED AVENUES — Full Database Schema
-- ============================================================

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','manager','viewer')),
  title         TEXT,
  department    TEXT,
  avatar_color  TEXT DEFAULT '#6366f1',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. WAREHOUSES
-- ============================================================
CREATE TABLE warehouses (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,  -- 'STAR', 'CSM'
  name  TEXT NOT NULL,
  address TEXT
);

-- ============================================================
-- 3. STORES / BUYERS
-- ============================================================
CREATE TABLE stores (
  id    SERIAL PRIMARY KEY,
  name  CITEXT UNIQUE NOT NULL  -- 'BURLINGTON', 'ROSS', 'MACY''S BACKSTAGE', etc.
);

-- ============================================================
-- 4. STYLES (Showroom catalog)
-- ============================================================
CREATE TABLE styles (
  id            SERIAL PRIMARY KEY,
  style_number  TEXT UNIQUE NOT NULL,         -- e.g. 'SKO/18740/25', '5344600'
  category      TEXT NOT NULL DEFAULT 'Apparel',
  colors        TEXT,                          -- comma-separated
  color_count   INT DEFAULT 1,
  total_ats     INT DEFAULT 0,
  origin        TEXT,
  image_url     TEXT,                          -- path or URL to product image
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. WAREHOUSE ORDERS (the core — from "For Larry's Eyes Only")
-- ============================================================
CREATE TABLE warehouse_orders (
  id              SERIAL PRIMARY KEY,
  warehouse_id    INT REFERENCES warehouses(id),
  store_id        INT REFERENCES stores(id),
  po              TEXT NOT NULL,
  ticket_number   TEXT,
  style_number    TEXT,
  start_date      DATE,
  cancel_date     DATE,
  routing         TEXT,                        -- raw routing value (RTS code, CANCELLED, etc.)
  routing_status  TEXT NOT NULL DEFAULT 'not_routed'
                  CHECK (routing_status IN ('routed','not_routed','cancelled','issue')),
  shipped         BOOLEAN DEFAULT false,
  disregarded     BOOLEAN DEFAULT false,
  units           INT DEFAULT 0,
  cartons         INT DEFAULT 0,
  lot             TEXT,
  load_id_date    DATE,
  load_id_number  TEXT,
  labels          TEXT,
  carrier         TEXT,
  shipped_date    DATE,
  comments        TEXT,
  file_upload_id  INT,                         -- tracks which upload batch this came from
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wo_po ON warehouse_orders(po);
CREATE INDEX idx_wo_cancel ON warehouse_orders(cancel_date);
CREATE INDEX idx_wo_warehouse ON warehouse_orders(warehouse_id);
CREATE INDEX idx_wo_status ON warehouse_orders(routing_status);

-- ============================================================
-- 6. SALES ORDERS (from WinFashion / SO Listing)
-- ============================================================
CREATE TABLE sales_orders (
  id            SERIAL PRIMARY KEY,
  order_number  TEXT,
  po            TEXT NOT NULL,
  so_number     TEXT,                          -- Sales Order number
  buyer         TEXT,
  ship_date     DATE,
  cancel_date   DATE,
  warehouse     TEXT,
  wh_code       TEXT,
  pt_number     TEXT,
  ct_number     TEXT,
  status        TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_so_po ON sales_orders(po);

-- ============================================================
-- 7. CONSOLIDATED DATABASE (SO + PT + CT linkage)
-- ============================================================
CREATE TABLE consolidated_db (
  id            SERIAL PRIMARY KEY,
  po            TEXT,
  style_number  TEXT,
  so_number     TEXT,
  pt_number     TEXT,
  ct_number     TEXT,
  buyer         TEXT,
  description   TEXT,
  color         TEXT,
  link_status   TEXT DEFAULT 'missing'
                CHECK (link_status IN ('linked','partial','missing')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cdb_po ON consolidated_db(po);
CREATE INDEX idx_cdb_style ON consolidated_db(style_number);

-- ============================================================
-- 8. CUT TICKETS (Production tracking)
-- ============================================================
CREATE TABLE cut_tickets (
  id            SERIAL PRIMARY KEY,
  ct_number     TEXT NOT NULL,
  style_number  TEXT,
  po            TEXT,
  quantity      INT DEFAULT 0,
  status        TEXT DEFAULT 'Pending'
                CHECK (status IN ('Pending','Fabric In','Cutting','Sewing','Finishing','QC','Complete','Delayed')),
  due_date      DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. ATS (Available To Sell inventory)
-- ============================================================
CREATE TABLE ats_inventory (
  id            SERIAL PRIMARY KEY,
  style_number  TEXT NOT NULL,
  category      TEXT,
  color         TEXT,
  ats_units     INT DEFAULT 0,
  warehouse     TEXT,
  lot           TEXT,
  vendor_inv    TEXT,
  eta           TEXT,
  ct_number     TEXT,
  buyer         TEXT,
  remarks       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ats_style ON ats_inventory(style_number);

-- ============================================================
-- 10. BUYER ORDER DATA (per salesperson → buyer page uploads)
-- ============================================================
CREATE TABLE buyer_orders (
  id              SERIAL PRIMARY KEY,
  salesperson     TEXT NOT NULL,          -- 'kunal', 'gary'
  category        TEXT,                    -- 'missy_dresses', 'scrubs', etc.
  buyer           TEXT NOT NULL,           -- 'tj_australia', 'gabes', 'burlington', etc.
  page_id         TEXT NOT NULL,           -- 'sp-kunal-md-tjaus', etc.
  po              TEXT,
  style_number    TEXT,
  description     TEXT,
  color           TEXT,
  ship_start      DATE,
  ship_end        DATE,
  units           INT DEFAULT 0,
  order_type      TEXT DEFAULT 'outstanding'
                  CHECK (order_type IN ('outstanding','historical')),
  raw_data        JSONB,                   -- stores full row for flexibility
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bo_page ON buyer_orders(page_id);
CREATE INDEX idx_bo_type ON buyer_orders(order_type);

-- ============================================================
-- 11. BUYER READS (editable table per buyer page)
-- ============================================================
CREATE TABLE buyer_reads (
  id            SERIAL PRIMARY KEY,
  page_id       TEXT NOT NULL,
  style_number  TEXT,
  color         TEXT,
  units         INT DEFAULT 0,
  ship_date     DATE,
  on_floor_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. BURLINGTON LPO (consolidated LPO view)
-- ============================================================
CREATE TABLE burlington_lpos (
  id            SERIAL PRIMARY KEY,
  lpo           TEXT NOT NULL,
  po            TEXT,
  style_number  TEXT,
  description   TEXT,
  color         TEXT,
  ship_date     DATE,
  cancel_date   DATE,
  sizes         JSONB DEFAULT '{}',       -- { "S": 10, "M": 20, "L": 15, ... }
  total_units   INT DEFAULT 0,
  so_number     TEXT,
  ct_number     TEXT,
  pt_number     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blpo_lpo ON burlington_lpos(lpo);

-- ============================================================
-- 13. TEAM / ORG CHART
-- ============================================================
CREATE TABLE team_members (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  title         TEXT NOT NULL,
  department    TEXT,
  reports_to    INT REFERENCES team_members(id),
  level         INT DEFAULT 0,            -- 0=president, 1=vp, 2=department head
  avatar_color  TEXT DEFAULT '#6366f1',
  email         TEXT,
  phone         TEXT,
  is_active     BOOLEAN DEFAULT true,
  sort_order    INT DEFAULT 0
);

-- ============================================================
-- 14. FILE UPLOADS (track every file that's been uploaded)
-- ============================================================
CREATE TABLE file_uploads (
  id            SERIAL PRIMARY KEY,
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL,            -- 'warehouse_tracker', 'so_listing', 'pt_listing', 'ct_listing', 'buyer_order', 'burlington', 'ats', 'showroom_image'
  original_name TEXT,
  file_path     TEXT,
  uploaded_by   UUID REFERENCES users(id),
  row_count     INT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 15. QUERY / CHAT HISTORY (Larry + Standard queries)
-- ============================================================
CREATE TABLE chat_messages (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  mode          TEXT DEFAULT 'standard'
                CHECK (mode IN ('standard','larry')),
  message       TEXT NOT NULL,
  response      TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_styles_updated BEFORE UPDATE ON styles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_wo_updated BEFORE UPDATE ON warehouse_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON cut_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_ats_updated BEFORE UPDATE ON ats_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reads_updated BEFORE UPDATE ON buyer_reads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
