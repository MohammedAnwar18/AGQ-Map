const pool = require('../config/database');

const up = async () => {
    try {
        await pool.query(`
            ALTER TABLE posts 
            ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}'::TEXT[];
        `);
        console.log('✅ Added media_urls column to posts table');
    } catch (error) {
        console.error('❌ Failed to add media_urls column:', error);
    }
};

up();
