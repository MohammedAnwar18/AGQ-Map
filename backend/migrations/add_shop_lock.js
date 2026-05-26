const pool = require('../config/database');

const addShopLock = async () => {
    try {
        await pool.query(`
            ALTER TABLE shops
            ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE
        `);
        console.log('✅ is_locked column added to shops');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await pool.end();
    }
};

addShopLock();
