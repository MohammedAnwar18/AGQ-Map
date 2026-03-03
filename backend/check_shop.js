
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkShop() {
    try {
        const res = await pool.query("SELECT id, name, category, bio FROM shops WHERE name ILIKE '%قطنة%' OR bio ILIKE '%قطنة%'");
        console.log('Shops found:', res.rows);
    } catch (err) {
        console.error('Error querying:', err);
    } finally {
        pool.end();
    }
}

checkShop();
