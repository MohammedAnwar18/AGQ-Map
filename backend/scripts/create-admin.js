const pool = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * إنشاء حساب أدمن جديد
 */
async function createAdmin() {
    const client = await pool.connect();
    try {
        // بيانات الأدمن
        const adminData = {
            username: 'admin',
            email: 'admin@palnovaa.com',
            password: 'admin123',  // يمكن تغييرها بعد أول تسجيل دخول
            full_name: 'PalNovaa Administrator'
        };

        console.log('🚀 Creating admin account...\n');

        // التحقق من وجود الأدمن
        const existingAdmin = await client.query(
            'SELECT id, username FROM users WHERE username = $1 OR email = $2',
            [adminData.username, adminData.email]
        );

        if (existingAdmin.rows.length > 0) {
            console.log('⚠️  Admin account already exists!');
            console.log(`📧 Email: ${adminData.email}`);
            console.log(`👤 Username: ${adminData.username}`);
            console.log(`🔑 Password: ${adminData.password}`);
            console.log(`\n🎯 Access dashboard at: http://localhost:5173/admin`);
            return;
        }

        // تشفير كلمة المرور
        const password_hash = await bcrypt.hash(adminData.password, 10);

        // إنشاء حساب الأدمن
        const result = await client.query(
            `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, email, full_name, role`,
            [adminData.username, adminData.email, password_hash, adminData.full_name, 'admin', true]
        );

        const admin = result.rows[0];

        console.log('✅ Admin account created successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Admin Account Details:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔑 User ID:    ${admin.id}`);
        console.log(`👤 Username:   ${admin.username}`);
        console.log(`📧 Email:      ${admin.email}`);
        console.log(`🔐 Password:   ${adminData.password}`);
        console.log(`👨‍💼 Full Name:  ${admin.full_name}`);
        console.log(`🎖️  Role:       ${admin.role}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🎯 Next Steps:');
        console.log('1. Go to: http://localhost:5173/login');
        console.log(`2. Login with username: ${admin.username}`);
        console.log(`3. Password: ${adminData.password}`);
        console.log('4. Access dashboard: http://localhost:5173/admin\n');
        console.log('⚠️  IMPORTANT: Change the password after first login!\n');

    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

createAdmin();
