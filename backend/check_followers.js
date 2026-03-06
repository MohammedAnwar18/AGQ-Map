require('dotenv').config();
const pool = require('./config/database');

async function test() {
    try {
        const res = await pool.query('SELECT * FROM shop_followers');
        console.log("shop_followers table exists. Rows:", res.rows.length);
        console.log(res.rows);
    } catch (err) {
        console.error("Error with shop_followers:", err.message);
    }
    process.exit();
}
test();
