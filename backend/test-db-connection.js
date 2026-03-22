const pool = require('./config/database');
const bcrypt = require('bcryptjs');

async function testConnection() {
    try {
        console.log('Testing DATABASE_URL:', process.env.DATABASE_URL ? 'EXISTS' : 'MISSING');
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Success: DB response:', res.rows[0]);
    } catch (err) {
        console.error('❌ Failed: DB error:', err.message);
    }
}

testConnection().then(() => process.exit(0));
