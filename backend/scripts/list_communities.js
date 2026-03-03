const pool = require('../config/database');

async function listCommunities() {
    try {
        const res = await pool.query('SELECT * FROM communities');
        console.log('Communities:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

listCommunities();
