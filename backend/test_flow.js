require('dotenv').config();
const pool = require('./config/database');

async function test() {
    try {
        const userId = 1; // Assuming user 1 exists
        // 1. Create Shop
        const shopRes = await pool.query(`
      INSERT INTO shops (name, latitude, longitude, category)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, ['Test Shop', 31.9, 35.2, 'General']);
        const shop = shopRes.rows[0];
        console.log("Created shop:", shop);

        // 2. Follow Shop
        await pool.query(`
      INSERT INTO shop_followers (user_id, shop_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, shop_id) DO NOTHING
    `, [userId, shop.id]);
        console.log(`User ${userId} followed shop ${shop.id}`);

        // 3. Get Followed Shops
        const followedRes = await pool.query(`
      SELECT s.*
      FROM shops s
      JOIN shop_followers sf ON s.id = sf.shop_id
      WHERE sf.user_id = $1
    `, [userId]);
        console.log("Followed shops count:", followedRes.rows.length);
        console.log("Is Test Shop in followed?", followedRes.rows.some(s => s.id === shop.id));

        // 4. Clean up
        await pool.query('DELETE FROM shops WHERE id = $1', [shop.id]);
        console.log("Test finished & cleaned up.");
    } catch (err) {
        console.error("Test error:", err.message);
    }
    process.exit();
}
test();
