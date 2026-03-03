const pool = require('../config/database');

async function addMediaTypeColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding media_type column to posts table...');

        await client.query(`
            ALTER TABLE posts 
            ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image';
        `);

        console.log('✅ media_type column added successfully');
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addMediaTypeColumn();
