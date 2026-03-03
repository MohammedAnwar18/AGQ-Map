const pool = require('./config/database');

const updateSchema = async () => {
    try {
        console.log('🏗️ Updating Schema for Shop Profile & Posts...');

        // 1. Update 'shops' table with profile fields
        console.log('🔹 Extening shops table...');
        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS cover_picture VARCHAR(255),
            ADD COLUMN IF NOT EXISTS bio TEXT,
            ADD COLUMN IF NOT EXISTS opening_hours JSONB,
            ADD COLUMN IF NOT EXISTS contact_info JSONB,
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
        `);

        // 2. Update 'posts' table to support shop posts
        console.log('🔹 Extending posts table...');
        await pool.query(`
            ALTER TABLE posts 
            ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
            ALTER COLUMN user_id DROP NOT NULL; -- Allow posts without user_id if shop_id is present
        `);

        // Add index for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_posts_shop_id ON posts(shop_id);
        `);

        console.log('✅ Schema updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Schema update failed:', error);
        process.exit(1);
    }
};

updateSchema();
