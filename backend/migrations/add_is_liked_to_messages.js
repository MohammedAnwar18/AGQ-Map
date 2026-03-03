require('dotenv').config({ path: './backend/.env' }); // try backend/.env if running from root
const pool = require('../config/database');

const migrate = async () => {
    try {
        await pool.query(`
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS is_liked BOOLEAN DEFAULT FALSE;
        `);
        console.log('Migration successful: Added is_liked to messages table');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
};

migrate();
