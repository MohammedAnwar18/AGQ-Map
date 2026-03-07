const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT tgname 
      FROM pg_trigger 
      WHERE tgrelid = 'shop_followers'::regclass
    `);
        console.log('Triggers:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
