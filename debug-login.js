const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });

(async () => {
  try {
    const r = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', ['admin@unlimitedavenues.com']);
    if (r.rows.length === 0) {
      console.log('No user found!');
    } else {
      const user = r.rows[0];
      console.log('User found:', user.email);
      console.log('ID:', user.id);
      console.log('Hash exists:', !!user.password_hash);
      console.log('Hash:', user.password_hash);
      const match = await bcrypt.compare('admin123', user.password_hash);
      console.log('Password "admin123" matches:', match);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
