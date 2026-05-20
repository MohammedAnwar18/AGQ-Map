const pool = require('../backend/config/database');

async function checkAdmins() {
    try {
        const res = await pool.query('SELECT id, username, email, role, is_active, is_verified FROM users WHERE role = $1', ['admin']);
        console.log("=== Active Admins ===");
        console.log(res.rows);
    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

checkAdmins();
