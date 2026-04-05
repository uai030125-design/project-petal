const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });

(async () => {
  try {
    const email = 'admin@unlimitedavenues.com';
    const newPassword = 'admin123';
    const hash = await bcrypt.hash(newPassword, 10);

    // Check if user exists
    const check = await pool.query('SELECT id, email, full_name, is_active FROM users WHERE email = $1', [email]);
    if (check.rows.length === 0) {
      console.log('User not found. Creating admin account...');
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, 'Admin', 'admin', true)`,
        [email, hash]
      );
      console.log('✅ Admin account created!');
    } else {
      const user = check.rows[0];
      console.log(`Found user: ${user.full_name} (active: ${user.is_active})`);
      await pool.query('UPDATE users SET password_hash = $1, is_active = true WHERE email = $2', [hash, email]);
      console.log('✅ Password reset!');
    }

    console.log(`\n  Email:    ${email}`);
    console.log(`  Password: ${newPassword}\n`);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
