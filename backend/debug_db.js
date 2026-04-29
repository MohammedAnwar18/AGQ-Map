const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findTables() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'facility_id'");
        console.log('Tables with facility_id:', res.rows);
        
        const res2 = await pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'post_id'");
        console.log('Tables with post_id:', res2.rows);

        const res3 = await pool.query("SELECT table_name FROM information_schema.columns WHERE column_name = 'facility_post_id'");
        console.log('Tables with facility_post_id:', res3.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

findTables();
