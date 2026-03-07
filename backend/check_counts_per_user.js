const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT user_id, count(*) FROM shop_followers GROUP BY user_id
    `);
        console.log('Follow counts by user:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
