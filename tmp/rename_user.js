const pool = require('../backend/config/database');
async function renameUser() {
    try {
        const res = await pool.query("UPDATE users SET username = 'mohammed1' WHERE username = 'MohammedAnwar1' RETURNING *");
        console.log('Renamed user results:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Rename failed:', e);
        process.exit(1);
    }
}
renameUser();
