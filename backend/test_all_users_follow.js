const pool = require('./config/database');
async function run() {
    const q = `
    SELECT s.*, (
      SELECT json_agg(json_build_object('id', u.id))
      FROM shop_drivers sd
      JOIN users u ON sd.user_id = u.id
      WHERE sd.shop_id = s.id AND sd.is_active = TRUE AND u.last_latitude IS NOT NULL
    ) as active_drivers
    FROM shops s
    JOIN shop_followers sf ON s.id = sf.shop_id
    WHERE sf.user_id = $1::int
  `;
    for (let id of [1, 4, 5, 7, 9, 11]) {
        try {
            await pool.query(q, [id]);
            console.log('User ' + id + ' OK');
        } catch (e) {
            console.log('User ' + id + ' ERROR', e.message);
        }
    }
    process.exit(0);
}
run();
