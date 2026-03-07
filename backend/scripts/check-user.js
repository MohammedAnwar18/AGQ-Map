const pool = require('../config/database');

async function checkUser(email) {
    try {
        const result = await pool.query(`SELECT id, username, role FROM users WHERE email = $1`, [email]);
        console.table(result.rows);
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

checkUser('mohammed2003anwar@gmail.com');
