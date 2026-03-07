const pool = require('../backend/config/database');
async function findShop() {
    try {
        const res = await pool.query('SELECT id FROM shops LIMIT 1');
        console.log('Shop ID:', res.rows[0]?.id);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
findShop();
