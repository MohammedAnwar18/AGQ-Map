const pool = require('./config/database');
async function testFollow() {
    try {
        const userId = 1; // Assuming user 1
        const shopId = 7; // Use an existing shop id if possible. 

        console.log(`Testing follow for user ${userId} and shop ${shopId}`);

        // Clear first to be sure
        await pool.query(`DELETE FROM shop_followers WHERE user_id = $1 AND shop_id = $2`, [userId, shopId]);

        // Follow
        await pool.query(`
        INSERT INTO shop_followers (user_id, shop_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
    `, [userId, shopId]);

        // Fetch
        const res = await pool.query(`
        SELECT s.* FROM shops s
        JOIN shop_followers sf ON s.id = sf.shop_id
        WHERE sf.user_id = $1
    `, [userId]);

        console.log('Followed Shops:', res.rows.map(r => ({ id: r.id, name: r.name })));
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}
testFollow();
