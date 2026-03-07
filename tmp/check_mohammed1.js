const pool = require('../backend/config/database');
async function checkUser() {
    try {
        const username = 'mohammed1';
        const res = await pool.query('SELECT id, username, email, full_name, role, is_active, is_verified, otp_code, otp_expires_at, lock_until FROM users WHERE username = $1 OR email = $1', [username]);
        console.log('User details for', username, ':', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
checkUser();
