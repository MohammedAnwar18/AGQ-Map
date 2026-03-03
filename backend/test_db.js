const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.ybrgvpubwnlskcledlaq:Mohammed%40%40002%40%40003@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('Querying getUserProfile logic...');
        const userId = 1;

        const likesCount = await pool.query(`SELECT COUNT(*)::int as count FROM likes JOIN posts ON likes.post_id = posts.id WHERE posts.user_id = $1`, [userId]);
        console.log('likesCount:', likesCount.rows[0]);

        console.log('Success!');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
