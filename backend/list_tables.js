const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listTables() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables in public schema:', res.rows.map(r => r.table_name));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

listTables();
