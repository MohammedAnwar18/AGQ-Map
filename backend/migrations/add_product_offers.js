const pool = require('../config/database');

async function addProductOfferColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding offer features to products...');

        await client.query(`
            ALTER TABLE shop_products 
            ADD COLUMN IF NOT EXISTS old_price DECIMAL(10, 2);
        `);
        console.log('✅ Added old_price column to shop_products');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

if (require.main === module) {
    addProductOfferColumn();
}
