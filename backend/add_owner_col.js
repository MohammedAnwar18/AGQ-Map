const pool = require('./config/database');

const updateShopsOwner = async () => {
    try {
        console.log('🏗️ Adding Owner to Shops...');

        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        `);

        console.log('✅ Owner column added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Update failed:', error);
        process.exit(1);
    }
};

updateShopsOwner();
