// Usage: node server/scripts/add-user.js <email> <password> <full_name> <role>
// Roles: admin, manager, viewer
// Example: node server/scripts/add-user.js kunal@unlimitedavenues.com mypass123 "Kunal Sachdev" manager

const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('../db');

async function addUser() {
  const [,, email, password, fullName, role = 'viewer', title = '', department = ''] = process.argv;

  if (!email || !password || !fullName) {
    console.log('Usage: node server/scripts/add-user.js <email> <password> "<full_name>" [role] [title] [department]');
    console.log('Roles: admin, manager, viewer');
    console.log('Example: node server/scripts/add-user.js kunal@ua.com pass123 "Kunal Sachdev" manager "VP" "Executive"');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, title, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, role = $4
       RETURNING id, email, full_name, role`,
      [email, hash, fullName, role, title, department]
    );
    console.log('User created:', result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

addUser();
