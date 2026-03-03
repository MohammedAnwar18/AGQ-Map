const pool = require('../config/database');

async function fixDescription() {
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE communities SET description = $1 WHERE name = $2',
            [
                'مجتمع متخصص لتوثيق ومشاركة صور ومعلومات حول النباتات البرية في فلسطين.',
                'توثيق النباتات البرية في فلسطين'
            ]
        );
        console.log('✅ Description updated to be specific to wild plants.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
fixDescription();
