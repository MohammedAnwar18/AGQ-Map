const pool = require('../backend/config/database');
async function listUsers() {
    try {
        const res = await pool.query('SELECT id, username, email, full_name, role FROM users LIMIT 10');
        console.log('Recent 10 users:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('List failed:', e);
        process.exit(1);
    }
}
listUsers();
