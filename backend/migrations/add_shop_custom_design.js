const pool = require('../config/database');

async function addShopCustomDesign() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding custom_design column to shops table...');

        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS custom_design JSONB DEFAULT '{}'::jsonb;
        `);
        
        console.log('✅ Added custom_design column successfully');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    addShopCustomDesign();
}

module.exports = { addShopCustomDesign };
