const pool = require('./config/database');

const fixTable = async () => {
    try {
        console.log('🔧 Fixing Shops Table Schema...');

        // Add category if missing
        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';
        `);
        console.log('✅ Added category column');

        // Add description if missing
        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);
        console.log('✅ Added description column');

        // Add profile_picture if missing
        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(255);
        `);
        console.log('✅ Added profile_picture column');

        console.log('🎉 Table schema updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
};

fixTable();
