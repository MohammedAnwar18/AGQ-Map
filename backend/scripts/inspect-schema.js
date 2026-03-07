const pool = require('../config/database');

async function inspectTable(tableName) {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
        `, [tableName]);
        console.log(`Schema for table ${tableName}:`);
        console.table(result.rows);
        process.exit(0);
    } catch (err) {
        console.error('Inspection failed:', err);
        process.exit(1);
    }
}

inspectTable('shop_products');
