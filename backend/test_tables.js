const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.ybrgvpubwnlskcledlaq:Mohammed%40%40002%40%40003@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        const res = await pool.query(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`);
        console.log(res.rows.map(r => r.tablename));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
