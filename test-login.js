// Mimics exactly what the server's auth.js does
process.chdir(__dirname + '/server');
require('dotenv').config({ path: '../.env' });

const db = require('./server/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

(async () => {
  try {
    console.log('1. DB URL:', process.env.DATABASE_URL);
    console.log('2. JWT_SECRET:', process.env.JWT_SECRET ? 'set' : 'NOT SET');

    const email = 'admin@unlimitedavenues.com';
    const password = 'admin123';

    console.log('3. Querying user...');
    const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    console.log('4. Found rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('NO USER FOUND');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('5. User columns:', Object.keys(user).join(', '));
    console.log('6. password_hash exists:', !!user.password_hash);

    console.log('7. Comparing password...');
    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('8. Password valid:', valid);

    console.log('9. Signing JWT...');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('10. Token generated:', token.substring(0, 30) + '...');
    console.log('\n✅ Login would succeed!');
  } catch (err) {
    console.error('\n❌ LOGIN FAILS AT THIS STEP:');
    console.error(err);
  } finally {
    process.exit();
  }
})();
