const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/database');

const migrate = async () => {
    try {
        console.log('🔄 Creating live_cameras table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS live_cameras (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                stream_url VARCHAR(500) NOT NULL,
                crop_position VARCHAR(50) DEFAULT 'full', -- full | cam1 | cam2 | cam3 | cam4
                created_at TIMESTAMP DEFAULT NOW(),
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_live_cameras_location ON live_cameras(latitude, longitude);
        `);

        console.log('✅ live_cameras table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
};

migrate();
