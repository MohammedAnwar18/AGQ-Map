const pool = require('../config/database');

const run = async () => {
    console.log('🗺️ Creating community_historical_maps table...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS community_historical_maps (
            id SERIAL PRIMARY KEY,
            community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            year VARCHAR(50) NOT NULL,
            tile_url TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `);
    console.log('✅ community_historical_maps table created successfully!');
    process.exit(0);
};

run().catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
