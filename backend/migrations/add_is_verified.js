const pool = require('../config/database');

async function addIsVerifiedColumn() {
    const client = await pool.connect();
    try {
        console.log('🚀 Adding is_verified column to users table...');

        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        `);

        // تحديث المستخدمين الحاليين ليكونوا مفعلين (لتجنب إغلاق حسابك الحالي)
        // أو يمكنك جعلها FALSE إذا أردت تجربة التحقق بنفسك
        // سنجعلها FALSE لأنك تريد تجربة النظام "الحقيقي"
        await client.query(`UPDATE users SET is_verified = FALSE`);

        console.log('✅ is_verified column added successfully');
    } catch (error) {
        console.error('❌ Error adding column:', error);
    } finally {
        client.release();
        process.exit();
    }
}

addIsVerifiedColumn();
