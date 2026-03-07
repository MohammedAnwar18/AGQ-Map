const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'shops'
    `);
        console.log('Shops Nullability:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
