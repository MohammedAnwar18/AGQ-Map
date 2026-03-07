const pool = require('./config/database');
async function test() {
    try {
        const userId = NaN;
        const shopId = 7;
        console.log(`Testing with userId: ${userId}`);
        await pool.query(`
        INSERT INTO shop_followers (user_id, shop_id) 
        VALUES ($1::int, $2::int)
    `, [userId, shopId]);
        console.log('Success (unexpected)');
        process.exit(0);
    } catch (e) {
        console.error('Expected Failure:', e.message);
        process.exit(1);
    }
}
test();
