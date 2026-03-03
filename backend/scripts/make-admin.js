const pool = require('../config/database');

/**
 * تحويل مستخدم إلى أدمن
 * استخدام: node scripts/make-admin.js <username>
 */
async function makeAdmin() {
    const username = process.argv[2];

    if (!username) {
        console.log('❌ Usage: node scripts/make-admin.js <username>');
        console.log('Example: node scripts/make-admin.js john');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        // التحقق من وجود المستخدم
        const userCheck = await client.query(
            'SELECT id, username, email, role FROM users WHERE username = $1',
            [username]
        );

        if (userCheck.rows.length === 0) {
            console.log(`❌ User "${username}" not found`);
            process.exit(1);
        }

        const user = userCheck.rows[0];

        if (user.role === 'admin') {
            console.log(`✅ User "${username}" is already an admin`);
            process.exit(0);
        }

        // تحويل إلى أدمن
        await client.query(
            'UPDATE users SET role = $1 WHERE username = $2',
            ['admin', username]
        );

        console.log(`✅ Successfully made "${username}" an admin!`);
        console.log(`📧 Email: ${user.email}`);
        console.log(`🔑 User ID: ${user.id}`);
        console.log(`\n🎯 You can now access the admin dashboard at: http://localhost:5173/admin`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

makeAdmin();
