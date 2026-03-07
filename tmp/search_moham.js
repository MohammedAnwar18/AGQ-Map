const pool = require('../backend/config/database');
async function searchUsers() {
    try {
        const res = await pool.query("SELECT id, username, email, full_name, role FROM users WHERE username ILIKE '%moham%'");
        console.log('Search results for moham:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Search failed:', e);
        process.exit(1);
    }
}
searchUsers();
