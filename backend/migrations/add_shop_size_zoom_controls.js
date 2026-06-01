const pool = require('../config/database');

const addShopSizeZoomControls = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting migration: Adding size and zoom control columns to shops table...');

        // 1. Add icon_size column
        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS icon_size INTEGER DEFAULT NULL;
        `);
        console.log('✅ Added icon_size column to shops');

        // 2. Add text_size column
        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS text_size INTEGER DEFAULT NULL;
        `);
        console.log('✅ Added text_size column to shops');

        // 3. Add min_zoom column
        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS min_zoom NUMERIC DEFAULT NULL;
        `);
        console.log('✅ Added min_zoom column to shops');

        // 4. Add text_min_zoom column
        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS text_min_zoom NUMERIC DEFAULT NULL;
        `);
        console.log('✅ Added text_min_zoom column to shops');

        console.log('✨ Shop size and zoom control columns added successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
};

addShopSizeZoomControls();
