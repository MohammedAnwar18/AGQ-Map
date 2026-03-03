const pool = require('../config/database');

const up = async () => {
    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'));
            
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS date_of_birth DATE;
        `);
        console.log('✅ Gender and Date of Birth columns added successfully');
    } catch (error) {
        console.error('❌ Error adding columns:', error);
    } finally {
        pool.end();
    }
};

up();
