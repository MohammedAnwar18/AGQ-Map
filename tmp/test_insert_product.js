const pool = require('../backend/config/database');
async function test() {
    try {
        const res = await pool.query(`
            INSERT INTO shop_products (shop_id, name, price, description, image_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [6, 'Test Product', 10, 'Test Desc', null]);
        console.log('Insert success:', res.rows[0]);
    } catch (e) {
        console.error('Insert failed:', e.message);
    }
    process.exit(0);
}
test();
