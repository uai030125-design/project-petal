const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });
(async () => {
  try {
    const r = await pool.query('SELECT id, email, full_name, role, is_active FROM users ORDER BY id');
    console.table(r.rows);
  } catch(e) { console.error(e.message); }
  finally { await pool.end(); }
})();
