const pool = require('../config/database');

async function enhanceShopFeatures() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting shop enhancements migration...');

        // 1. Add cover_picture to shops if not exists
        await client.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS cover_picture TEXT;
        `);
        console.log('✅ Added cover_picture column to shops');

        // 2. Create shop_products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS shop_products (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created shop_products table');

        // 3. Ensure posts has shop_id (just in case)
        await client.query(`
            ALTER TABLE posts 
            ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
        `);
        console.log('✅ Verified shop_id in posts');

        console.log('✨ Shop enhancements completed successfully!');
    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    enhanceShopFeatures();
}

module.exports = { enhanceShopFeatures };
