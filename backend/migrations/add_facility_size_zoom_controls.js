const pool = require('../config/database');

const addFacilitySizeZoomControls = async () => {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting migration: Adding size and zoom control columns to university_facilities table...');

        // 1. Add icon_size column
        await client.query(`
            ALTER TABLE university_facilities 
            ADD COLUMN IF NOT EXISTS icon_size INTEGER DEFAULT NULL;
        `);
        console.log('✅ Added icon_size column to university_facilities');

        // 2. Add text_size column
        await client.query(`
            ALTER TABLE university_facilities 
            ADD COLUMN IF NOT EXISTS text_size INTEGER DEFAULT NULL;
        `);
        console.log('✅ Added text_size column to university_facilities');

        // 3. Add min_zoom column
        await client.query(`
            ALTER TABLE university_facilities 
            ADD COLUMN IF NOT EXISTS min_zoom NUMERIC DEFAULT NULL;
        `);
        console.log('✅ Added min_zoom column to university_facilities');

        // 4. Add text_min_zoom column
        await client.query(`
            ALTER TABLE university_facilities 
            ADD COLUMN IF NOT EXISTS text_min_zoom NUMERIC DEFAULT NULL;
        `);
        console.log('✅ Added text_min_zoom column to university_facilities');

        console.log('✨ University facilities size and zoom control columns added successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
};

addFacilitySizeZoomControls();
