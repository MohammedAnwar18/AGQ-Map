const pool = require('./config/database');

const addProximityCol = async () => {
    try {
        console.log('Adding enable_proximity_notifications column to shops table...');
        await pool.query(`
            ALTER TABLE shops 
            ADD COLUMN IF NOT EXISTS enable_proximity_notifications BOOLEAN DEFAULT FALSE;
        `);
        console.log('Column added successfully.');
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        pool.end();
    }
};

addProximityCol();
