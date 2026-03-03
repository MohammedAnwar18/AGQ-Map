const pool = require('../config/database');

async function addDateOfBirthColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding date_of_birth column to users table...');

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        `);

        console.log('✅ date_of_birth column added successfully');
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addDateOfBirthColumn();
