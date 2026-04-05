const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/database');

const migrate = async () => {
    try {
        console.log('🔄 Creating municipality_items table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS municipality_items (
                id SERIAL PRIMARY KEY,
                municipality_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                section VARCHAR(100) NOT NULL,
                -- sections: live_streams | public_squares | public_parks | services | tourism | culture
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                image_url VARCHAR(500),
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW(),
                created_by INTEGER REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_municipality_items_muni ON municipality_items(municipality_id);
            CREATE INDEX IF NOT EXISTS idx_municipality_items_section ON municipality_items(section);
        `);

        console.log('✅ municipality_items table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
};

migrate();
