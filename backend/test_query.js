require('dotenv').config();
const pool = require('./config/database');

async function test() {
    try {
        const userId = 1; // Try user 1 initially
        const followedRes = await pool.query(`
            SELECT s.*,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'full_name', u.full_name,
                    'latitude', u.last_latitude,
                    'longitude', u.last_longitude,
                    'profile_picture', u.profile_picture,
                    'car_type', sd.car_type,
                    'plate_number', sd.plate_number,
                    'passengers_capacity', sd.passengers_capacity
                ))
                FROM shop_drivers sd
                JOIN users u ON sd.user_id = u.id
                WHERE sd.shop_id = s.id AND sd.is_active = TRUE AND u.last_latitude IS NOT NULL
            ) as active_drivers
            FROM shops s
            JOIN shop_followers sf ON s.id = sf.shop_id
            WHERE sf.user_id = $1
    `, [userId]);
        console.log("Followed shops count:", followedRes.rows.length);
        if (followedRes.rows.length > 0) {
            console.log(followedRes.rows[0]);
        }
    } catch (err) {
        console.error("Test error:", err.message);
    }
    process.exit();
}
test();
