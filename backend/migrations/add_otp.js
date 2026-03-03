const pool = require('../config/database');

async function addOtpColumns() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding OTP columns to users table...');

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS otp_code VARCHAR(255),
            ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP;
        `);

        console.log('✅ OTP columns added successfully');
    } catch (error) {
        console.error('❌ Error adding columns:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addOtpColumns();
