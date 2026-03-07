const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT id, username, email FROM users ORDER BY id DESC LIMIT 20
    `);
        console.log('Users:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
