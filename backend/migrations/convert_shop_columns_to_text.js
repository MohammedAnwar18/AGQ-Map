const pool = require('../config/database');

async function convertColumnsToText() {
    const client = await pool.connect();
    try {
        console.log('🚀 Converting shop columns to TEXT...');

        // 1. Alter opening_hours to TEXT
        await client.query(`
            ALTER TABLE shops 
            ALTER COLUMN opening_hours TYPE TEXT USING opening_hours::TEXT;
        `);
        console.log('✅ opening_hours converted to TEXT');

        // 2. Alter contact_info to TEXT
        await client.query(`
            ALTER TABLE shops 
            ALTER COLUMN contact_info TYPE TEXT USING contact_info::TEXT;
        `);
        console.log('✅ contact_info converted to TEXT');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

if (require.main === module) {
    convertColumnsToText();
}
