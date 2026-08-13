const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function addShopDriversTable() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting shop_drivers migration...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS shop_drivers (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                car_type VARCHAR(100),
                plate_number VARCHAR(50),
                passengers_capacity INTEGER DEFAULT 4,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(shop_id, user_id)
            );
        `);

        // Add missing columns to existing tables (safe ALTER TABLE)
        await client.query(`
            ALTER TABLE shop_drivers
                ADD COLUMN IF NOT EXISTS car_type VARCHAR(100),
                ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50),
                ADD COLUMN IF NOT EXISTS passengers_capacity INTEGER DEFAULT 4;
        `);
        console.log('✅ Created shop_drivers table');

        // Check if current_lat/lon exists in users, if not, relying on users table updates is fine for now
        // But maybe we want specific taxi tracking? Let's stick to users location for MVP as per request "moq3o bibayen 3la map"

        console.log('✨ shop_drivers table migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    addShopDriversTable();
}

module.exports = { addShopDriversTable };
