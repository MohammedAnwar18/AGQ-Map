const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    try {
        const res = await pool.query('SELECT id, name, slug, LENGTH(config::text) as config_size FROM user_design_pages WHERE slug = $1', ['khv']);
        console.log(res.rows);
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
