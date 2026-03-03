const pool = require('../config/database');

async function fixExistingUsers() {
    const client = await pool.connect();
    try {
        console.log('🚀 Updating existing users to be verified...');

        // Update all users to be verified
        const result = await client.query(`UPDATE users SET is_verified = TRUE`);

        console.log(`✅ Updated ${result.rowCount} users to be verified.`);
        console.log('Now existing users will not be asked for OTP.');
    } catch (error) {
        console.error('❌ Error updating users:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixExistingUsers();
