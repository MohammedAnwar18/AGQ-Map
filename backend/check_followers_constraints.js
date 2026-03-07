const pool = require('./config/database');
async function check() {
    try {
        const res = await pool.query(`
      SELECT 
          tc.constraint_name, 
          tc.table_name, 
          kcu.column_name
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'shop_followers' AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');
    `);
        console.log('shop_followers Constraints:', res.rows);
        process.exit(0);
    } catch (e) {
        console.error('Check failed:', e);
        process.exit(1);
    }
}
check();
