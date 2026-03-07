const pool = require('../backend/config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE contype = 'c' AND conrelid = 'public.users'::regclass;
    `);
        console.log('Users Check Constraints:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
