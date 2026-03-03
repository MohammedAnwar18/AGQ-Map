const pool = require('../config/database');

async function addGenderColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding gender column to users table...');

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
        `);

        console.log('✅ gender column added successfully');
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addGenderColumn();
