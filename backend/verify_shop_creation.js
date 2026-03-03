const pool = require('./config/database');

const verify = async () => {
    try {
        console.log('🔍 Checking Shops Table...');

        // 1. Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'shops'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.error('❌ Table "shops" does NOT exist!');
            process.exit(1);
        }
        console.log('✅ Table "shops" exists.');

        // 2. Try to insert a test shop
        console.log('🧪 Attempting to insert a test shop...');
        const testShop = {
            name: 'Test Shop Verification',
            category: 'General',
            latitude: 31.95,
            longitude: 35.93
        };

        const insertResult = await pool.query(`
            INSERT INTO shops (name, category, latitude, longitude)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [testShop.name, testShop.category, testShop.latitude, testShop.longitude]);

        console.log('✅ Test shop created successfully:', insertResult.rows[0]);

        // 3. Clean up
        await pool.query('DELETE FROM shops WHERE id = $1', [insertResult.rows[0].id]);
        console.log('🧹 Test shop deleted. System is ready.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
};

verify();
