const pool = require('../config/database');

async function listCommunities() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT id, name FROM communities');
        console.log('Current Communities:');
        res.rows.forEach(r => console.log(`${r.id}: ${r.name}`));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
listCommunities();
