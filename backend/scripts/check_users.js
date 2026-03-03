const pool = require('../config/database');

async function checkUsers() {
    try {
        const res = await pool.query('SELECT id, username, email, is_verified, is_active, lock_until FROM users');
        console.log('Users in DB:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error querying users:', err);
    } finally {
        pool.end();
    }
}

checkUsers();
