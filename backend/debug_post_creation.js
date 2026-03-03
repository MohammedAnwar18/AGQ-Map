const pool = require('./config/database');

const debug = async () => {
    try {
        console.log('🐞 Debugging Shop Post Creation...');

        // 1. Get a shop ID
        const shopRes = await pool.query('SELECT id FROM shops LIMIT 1');
        if (shopRes.rows.length === 0) {
            console.log('⚠️ No shops found to test with.');
            process.exit(0);
        }
        const shopId = shopRes.rows[0].id;

        // 2. Try INSERT
        console.log(`Trying to insert post for shop ${shopId} without location/user_id...`);

        try {
            await pool.query(`
                INSERT INTO posts (shop_id, content, media_type, created_at)
                VALUES ($1, 'Debug Post', 'text', NOW())
            `, [shopId]);
            console.log('✅ Insert SUCCESS! The issue might be elsewhere (e.g. middleware).');
        } catch (err) {
            console.error('❌ Insert FAILED (Expected):');
            console.error(err.message);
            if (err.detail) console.error('Detail:', err.detail);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
};

debug();
