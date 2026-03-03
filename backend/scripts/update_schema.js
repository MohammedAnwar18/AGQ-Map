const pool = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Updating schema...');
        await pool.query(`
            ALTER TABLE friendships 
            ADD COLUMN IF NOT EXISTS user1_shares_location BOOLEAN DEFAULT FALSE;
        `);
        await pool.query(`
            ALTER TABLE friendships 
            ADD COLUMN IF NOT EXISTS user2_shares_location BOOLEAN DEFAULT FALSE;
        `);
        console.log('Schema updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error updating schema:', error);
        process.exit(1);
    }
};

updateSchema();
