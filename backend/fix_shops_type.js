const pool = require('./config/database');

const fixTable = async () => {
    try {
        console.log('🔧 Fixing Shops Table Constraint...');

        // Make 'type' column optional (drop NOT NULL constraint)
        await pool.query(`
            ALTER TABLE shops 
            ALTER COLUMN type DROP NOT NULL;
        `);
        console.log('✅ Dropped NOT NULL constraint from "type" column');

        // Optional: Set a default just in case
        await pool.query(`
            ALTER TABLE shops 
            ALTER COLUMN type SET DEFAULT 'general';
        `);
        console.log('✅ Set default value for "type" column');

        console.log('🎉 Table constraints updated successfully!');
        process.exit(0);
    } catch (error) {
        // If column doesn't exist, this will error, which is fine (means we don't have the problem)
        console.error('ℹ️ Fix info (might be normal if column missing):', error.message);
        process.exit(0);
    }
};

fixTable();
