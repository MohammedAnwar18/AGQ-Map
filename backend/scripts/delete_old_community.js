const pool = require('../config/database');

async function deleteCommunity() {
    const client = await pool.connect();
    try {
        // Delete the duplicate/old community
        // ID 1: مجتمع لتوثيق النباتات البرية في فلسطين
        const res = await client.query("DELETE FROM communities WHERE name = 'مجتمع لتوثيق النباتات البرية في فلسطين' RETURNING *");

        if (res.rows.length > 0) {
            console.log(`✅ Deleted community: ${res.rows[0].name}`);
        } else {
            console.log('ℹ️ Community not found (already deleted?)');
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
deleteCommunity();
