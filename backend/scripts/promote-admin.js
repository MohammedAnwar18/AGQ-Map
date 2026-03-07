const pool = require('../config/database');

async function promoteToAdmin(email) {
    try {
        console.log(`🚀 Promoting user with email: ${email} to admin...`);

        const result = await pool.query(
            "UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, username, email, role",
            [email]
        );

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('✅ User promoted successfully!');
            console.log(`👤 Username: ${user.username}`);
            console.log(`📧 Email:    ${user.email}`);
            console.log(`🎖️ Role:     ${user.role}`);
            console.log(`\n🎯 You can now access the admin dashboard at /admin`);
        } else {
            console.log(`❌ User with email ${email} not found.`);
        }
        process.exit(0);
    } catch (error) {
        console.error('Promotion failed:', error);
        process.exit(1);
    }
}

const email = process.argv[2] || 'mohammed2003anwar@gmail.com';
promoteToAdmin(email);
