const pool = require('../config/database');

async function updateCommunities() {
    const client = await pool.connect();
    try {
        console.log('🔄 Starting communities update...');

        await client.query('BEGIN');

        // 1. Rename ID 1
        console.log('📝 Renaming community ID 1...');
        await client.query(`
            UPDATE communities 
            SET name = 'مجتمع لتوثيق النباتات البرية في فلسطين' 
            WHERE id = 1
        `);

        // 2. Remove ID 2
        console.log('🗑️ Removing community ID 2...');
        await client.query(`
            DELETE FROM communities WHERE id = 2
        `);

        // 3. Add new community
        console.log('➕ Adding new community...');
        await client.query(`
            INSERT INTO communities (name, description)
            VALUES ($1, $2)
        `, ['اخبار محلية لمحافظات الضفة الغربية وقطاع غزة', 'تغطية مستمرة للأحداث المحلية في جميع المحافظات']);

        await client.query('COMMIT');
        console.log('✅ Communities updated successfully!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error updating communities:', err);
    } finally {
        client.release();
        pool.end();
    }
}

updateCommunities();
