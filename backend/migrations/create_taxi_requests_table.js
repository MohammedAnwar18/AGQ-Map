const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function createTaxiRequestsTable() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting taxi_requests migration...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS taxi_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, arrived, completed, cancelled
                pickup_location GEOGRAPHY(Point, 4326),
                pickup_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created taxi_requests table');

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    createTaxiRequestsTable();
}

module.exports = { createTaxiRequestsTable };
