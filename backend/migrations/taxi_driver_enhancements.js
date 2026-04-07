const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function taxiDriverEnhancements() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting taxi driver enhancements migration...');

        // 1. Add assigned_driver_id to taxi_requests if not exists
        await client.query(`
            ALTER TABLE taxi_requests 
            ADD COLUMN IF NOT EXISTS assigned_driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        `);
        console.log('✅ Added assigned_driver_id to taxi_requests');

        // 2. Add estimated_arrival to taxi_requests
        await client.query(`
            ALTER TABLE taxi_requests 
            ADD COLUMN IF NOT EXISTS estimated_arrival INTEGER; -- minutes
        `);
        console.log('✅ Added estimated_arrival to taxi_requests');

        // 3. Add notes column
        await client.query(`
            ALTER TABLE taxi_requests 
            ADD COLUMN IF NOT EXISTS notes TEXT;
        `);
        console.log('✅ Added notes to taxi_requests');

        // 4. Add index for driver queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_taxi_requests_driver 
            ON taxi_requests(assigned_driver_id) 
            WHERE status IN ('pending', 'accepted', 'arrived');
        `);
        console.log('✅ Created driver index on taxi_requests');

        // 5. Add index for shop + status queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_taxi_requests_shop_status 
            ON taxi_requests(shop_id, status);
        `);
        console.log('✅ Created shop+status index on taxi_requests');

        console.log('✨ Taxi driver enhancements migration completed!');
    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    taxiDriverEnhancements();
}

module.exports = { taxiDriverEnhancements };
