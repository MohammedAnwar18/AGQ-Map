const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT 
          conname, 
          pg_get_constraintdef(c.oid)
      FROM 
          pg_constraint c
      JOIN 
          pg_namespace n ON n.oid = c.connamespace
      WHERE 
          conrelid = 'shop_followers'::regclass
    `);
        console.log('Constraints Details:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
