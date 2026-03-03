const pool = require('../config/database');

async function run() {
    try {
        console.log('Adding image_url column to messages table...');

        // Add image_url column if it doesn't exist
        await pool.query(`
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);

        console.log('Successfully added image_url column to messages table');
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        await pool.end();
    }
}

run();
