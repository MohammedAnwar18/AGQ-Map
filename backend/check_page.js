const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const res = await pool.query('SELECT id, name, slug, status, created_at FROM user_design_pages ORDER BY id DESC LIMIT 10');
        console.log('All pages in DB:');
        console.table(res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
