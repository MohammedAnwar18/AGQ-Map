const pool = require('./config/database');

const createShopTables = async () => {
    try {
        console.log('Building Shops Social Features...');

        // 1. جدول المحلات الأساسي (بسيط)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shops (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(50) DEFAULT 'general',
                description TEXT,
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                profile_picture VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. جدول المتابعة (من يتابع من)
        // هذا هو الجدول الجديد الذي يحقق فكرتك
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_followers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, shop_id) -- منع التكرار
            );
        `);

        console.log('✅ Shops & Followers tables ready!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setup DB:', error);
        process.exit(1);
    }
};

createShopTables();
