const pool = require('../config/database');

async function addAdminRole() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding admin role and is_active columns...');

        // Add role column (default: 'user', can be 'admin')
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
        `);

        // Add is_active column for account suspension
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
        `);

        console.log('✅ Admin role columns added successfully');
        console.log('💡 To make a user admin, run: UPDATE users SET role = \'admin\' WHERE username = \'your_username\';');

    } catch (error) {
        console.error('❌ Error adding columns:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addAdminRole();
