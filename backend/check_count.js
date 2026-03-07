const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`SELECT count(*) FROM shop_followers`);
        console.log('Followers count:', res.rows[0].count);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
