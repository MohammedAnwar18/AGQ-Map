const pool = require('../config/database');

async function listUsers() {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT id, username, email, role, created_at FROM users ORDER BY id ASC LIMIT 10'
        );

        if (result.rows.length === 0) {
            console.log('❌ No users found in database');
        } else {
            console.log('\n📋 Users in database:\n');
            console.log('ID | Username | Email | Role | Created At');
            console.log('---|----------|-------|------|------------');
            result.rows.forEach(user => {
                console.log(`${user.id} | ${user.username} | ${user.email} | ${user.role || 'user'} | ${user.created_at.toLocaleDateString()}`);
            });
            console.log('\n');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        process.exit();
    }
}

listUsers();
