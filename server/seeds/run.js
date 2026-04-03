const bcrypt = require('bcryptjs');
const { pool } = require('../db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Admin user ───
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, full_name, role, title, department, avatar_color)
      VALUES ('admin@unlimitedavenues.com', $1, 'Admin', 'admin', 'System Admin', 'IT', '#6366f1')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    // ─── 2. Warehouses ───
    await client.query(`
      INSERT INTO warehouses (code, name) VALUES
        ('STAR', 'STAR Warehouse'),
        ('CSM', 'CSM Warehouse')
      ON CONFLICT (code) DO NOTHING
    `);

    // ─── 3. Team members (org chart) ───
    // President
    const gary = await client.query(`
      INSERT INTO team_members (full_name, title, department, level, avatar_color, sort_order)
      VALUES ('Gary Sachdev', 'President', 'Executive', 0, '#6366f1', 1)
      ON CONFLICT DO NOTHING RETURNING id
    `);
    const garyId = gary.rows[0]?.id;

    // VP
    const kunal = await client.query(`
      INSERT INTO team_members (full_name, title, department, reports_to, level, avatar_color, sort_order)
      VALUES ('Kunal Sachdev', 'Vice President', 'Executive', $1, 1, '#f59e0b', 2)
      ON CONFLICT DO NOTHING RETURNING id
    `, [garyId]);
    const kunalId = kunal.rows[0]?.id;

    // Department heads
    if (kunalId) {
      const heads = [
        ['Rob Chewning', 'Head of Sales', 'Sales', '#10b981', 1],
        ['Geeta', 'Head of Production', 'Production', '#ec4899', 2],
        ['Harjinder Kaur', 'Head of Logistics', 'Logistics', '#06b6d4', 3],
        ['Arpita Sarkar', 'Head of Technology', 'Technology', '#8b5cf6', 4],
        ['Vijay Gujral', 'Head Accountant', 'Finance', '#f97316', 5],
      ];
      for (const [name, title, dept, color, order] of heads) {
        await client.query(`
          INSERT INTO team_members (full_name, title, department, reports_to, level, avatar_color, sort_order)
          VALUES ($1, $2, $3, $4, 2, $5, $6)
          ON CONFLICT DO NOTHING
        `, [name, title, dept, kunalId, color, order]);
      }
    }

    // ─── 4. Showroom styles (Caftans from PDF) with images ───
    const caftans = [
      ['SKO/18740/25', 'Caftan', 'Beige/Black', 2, '/images/caftan_SKO-18740-25.png'],
      ['SKO/18759/25', 'Caftan', 'Black/Floral', 2, '/images/caftan_SKO-18759-25.png'],
      ['SK 69', 'Caftan', 'Leopard/Peacock', 2, '/images/caftan_SK-69.png'],
      ['SKO-040', 'Caftan', 'Pink/Green', 2, '/images/caftan_SKO-040.png'],
      ['SKO-042', 'Caftan', 'Turquoise', 1, '/images/caftan_SKO-042.png'],
      ['SK 49', 'Caftan', 'Leopard/Teal', 2, '/images/caftan_SK-49.png'],
      ['SK 89', 'Caftan', 'Orange/Floral', 2, '/images/caftan_SK-89.png'],
      ['SKO/18796/25', 'Caftan', 'Black/Pink Floral', 2, '/images/caftan_SKO-18796-25.png'],
      ['SKO/18798/25', 'Caftan', 'Red/Orange Tribal', 2, '/images/caftan_SKO-18798-25.png'],
      ['SKO/18709/25', 'Caftan', 'Black/Red Floral', 2, '/images/caftan_SKO-18709-25.png'],
    ];
    for (const [num, cat, colors, count, img] of caftans) {
      await client.query(`
        INSERT INTO styles (style_number, category, colors, color_count, image_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (style_number) DO UPDATE SET image_url = $5
      `, [num, cat, colors, count, img]);
    }

    // ─── 5. Common stores ───
    const stores = ['BURLINGTON', 'ROSS', 'TJ MAXX', 'MARSHALLS', 'DD\'S DISCOUNTS', 'GABES', 'BEALLS', 'CATO'];
    for (const name of stores) {
      await client.query('INSERT INTO stores (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }

    await client.query('COMMIT');
    console.log('Seed data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
