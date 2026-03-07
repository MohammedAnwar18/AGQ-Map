const pool = require('../config/database');

async function listShops() {
    try {
        const result = await pool.query(`SELECT id, name, owner_id FROM shops`);
        console.table(result.rows);
        process.exit(0);
    } catch (err) {
        console.error('List failed:', err);
        process.exit(1);
    }
}

listShops();
