const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT sf.*, s.name 
      FROM shop_followers sf
      JOIN shops s ON sf.shop_id = s.id
      ORDER BY sf.id DESC
      LIMIT 10
    `);
        console.log('Recent follows:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
