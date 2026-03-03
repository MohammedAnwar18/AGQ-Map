const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function addTaxiDetailsColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting add_taxi_details migration...');

        await client.query(`
            ALTER TABLE shop_drivers
            ADD COLUMN IF NOT EXISTS car_type VARCHAR(100),
            ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50),
            ADD COLUMN IF NOT EXISTS passengers_capacity INTEGER DEFAULT 4;
        `);
        console.log('✅ Added car_type, plate_number, passengers_capacity to shop_drivers');

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    addTaxiDetailsColumn();
}

module.exports = { addTaxiDetailsColumn };
