# Unlimited Avenues — Web App Setup

## Prerequisites
- **Node.js** 18+ (https://nodejs.org)
- **PostgreSQL** 14+ (https://postgresql.org or use Homebrew: `brew install postgresql@16`)

## 1. Database Setup

```bash
# Start PostgreSQL (if not running)
brew services start postgresql@16   # macOS
# or: sudo service postgresql start  # Linux

# Create the database
createdb unlimited_avenues
```

## 2. Environment Config

```bash
cd unlimited-avenues-app
cp .env.example .env
```

Edit `.env` and set your values:
```
DATABASE_URL=postgresql://localhost:5432/unlimited_avenues
JWT_SECRET=pick-a-long-random-string-here
```

## 3. Install Dependencies

```bash
npm run setup
```

This runs `npm install` for both server and client, then runs migrations and seeds.

Or do it manually:
```bash
npm install
cd client && npm install && cd ..
npm run db:migrate   # creates all tables
npm run db:seed      # adds admin user, team, warehouses, caftan styles
```

## 4. Start the App

```bash
npm run dev
```

This starts both the backend (port 4000) and React frontend (port 3000) concurrently.

## 5. Login

Open http://localhost:3000 and sign in:
- **Email:** admin@unlimitedavenues.com
- **Password:** admin123

## Project Structure

```
unlimited-avenues-app/
├── .env.example
├── package.json
├── server/
│   ├── index.js              # Express server
│   ├── db.js                 # PostgreSQL connection
│   ├── middleware/auth.js     # JWT auth + role checks
│   ├── migrations/
│   │   ├── 001_schema.sql    # Full database schema (15 tables)
│   │   └── run.js            # Migration runner
│   ├── seeds/run.js          # Seed data
│   ├── routes/
│   │   ├── auth.js           # Login, /me
│   │   ├── warehouse-orders.js  # CRUD + filters
│   │   ├── styles.js         # Showroom catalog + image upload
│   │   ├── routing.js        # Routing status classification
│   │   ├── team.js           # Org chart CRUD + tree
│   │   ├── uploads.js        # Excel upload + parsing (warehouse, buyer)
│   │   ├── buyers.js         # Buyer orders, reads, Burlington LPOs
│   │   └── dashboard.js      # Home KPIs + alerts
│   └── uploads/              # File storage
├── client/
│   ├── package.json
│   ├── public/index.html
│   └── src/
│       ├── App.js            # Router + protected routes
│       ├── index.js
│       ├── context/AuthContext.js
│       ├── utils/api.js      # Axios + JWT interceptor
│       ├── styles/globals.css
│       ├── components/Layout.js  # Nav + dropdowns
│       └── pages/
│           ├── Login.js
│           ├── Home.js       # KPIs + chat
│           ├── Shipping.js   # SO Tracker + upload
│           ├── Routing.js    # Routing status view
│           ├── Showroom.js   # Style catalog grid
│           ├── Team.js       # Org chart
│           ├── BuyerPage.js  # Per-buyer orders
│           └── ...
```

## Database Tables
1. **users** — Auth + roles (admin/manager/viewer)
2. **warehouses** — STAR, CSM
3. **stores** — Burlington, Ross, etc.
4. **styles** — Showroom catalog
5. **warehouse_orders** — Core: POs, routing, ship status
6. **sales_orders** — WinFashion SO data
7. **consolidated_db** — SO+PT+CT linkage
8. **cut_tickets** — Production tracking
9. **ats_inventory** — Available to sell
10. **buyer_orders** — Per-salesperson buyer data
11. **buyer_reads** — Editable buyer tables
12. **burlington_lpos** — Burlington LPO consolidation
13. **team_members** — Org chart (self-referencing)
14. **file_uploads** — Upload history
15. **chat_messages** — Query/Larry chat history

## Key Features
- **Warehouse file upload** — Drop "For Larry's Eyes Only.xlsx" and it auto-parses STAR + CSM tabs
- **Smart routing classification** — RTS codes = routed, CANCELLED/PAST/CANNOT = issue, blank = not routed
- **Org chart** — Gary → Kunal → 5 department heads
- **Caftan styles** — 10 styles pre-seeded from the PDF catalog
- **JWT auth** — Token-based with role permissions
