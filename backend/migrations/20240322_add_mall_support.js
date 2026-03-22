const { query } = require('../config/database');

async function migrate() {
    try {
        console.log('Starting migration for Malls feature...');
        
        // 1. Add parent_shop_id and floor columns to shops table
        await query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS parent_shop_id INTEGER REFERENCES shops(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS floor CHARACTER VARYING(50)
        `);
        console.log('✅ Added parent_shop_id and floor columns.');

        // 2. Index for performance
        await query(`
            CREATE INDEX IF NOT EXISTS idx_shops_parent ON shops(parent_shop_id);
        `);
        console.log('✅ Created index on parent_shop_id.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
