const pool = require('../config/database');

const run = async () => {
    console.log('📍 Adding coordinates columns to community_historical_maps...');
    await pool.query(`
        ALTER TABLE community_historical_maps
        ADD COLUMN IF NOT EXISTS center_lat FLOAT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS center_lng FLOAT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS default_zoom INTEGER DEFAULT 8;
    `);
    console.log('✅ Columns added successfully!');
    process.exit(0);
};

run().catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
