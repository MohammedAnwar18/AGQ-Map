const pool = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Updating users schema...');
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;
        `);
        console.log('Users schema updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error updating schema:', error);
        process.exit(1);
    }
};

updateSchema();
