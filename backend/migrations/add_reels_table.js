const pool = require('../config/database');

/**
 * Migration: إنشاء جداول Reels المكانية
 * - reels: تخزين الريلز مع رابط يوتيوب والإحداثيات
 * - reel_likes: الإعجابات
 * - reel_comments: التعليقات
 */
async function addReelsTable() {
    const client = await pool.connect();
    try {
        console.log('🎬 Creating Spatial Reels tables...');

        // جدول الريلز الرئيسي
        await client.query(`
            CREATE TABLE IF NOT EXISTS reels (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                youtube_url TEXT NOT NULL,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                location_name TEXT,
                city TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ reels table created');

        // جدول الإعجابات
        await client.query(`
            CREATE TABLE IF NOT EXISTS reel_likes (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(reel_id, user_id)
            );
        `);
        console.log('✅ reel_likes table created');

        // جدول التعليقات
        await client.query(`
            CREATE TABLE IF NOT EXISTS reel_comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ reel_comments table created');

        // Indexes للأداء
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_reels_created ON reels(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_reel_likes_reel ON reel_likes(reel_id);
            CREATE INDEX IF NOT EXISTS idx_reel_comments_reel ON reel_comments(reel_id);
        `);
        console.log('✅ Indexes created');

        // إدخال بيانات تجريبية للاختبار
        await client.query(`
            INSERT INTO reels (user_id, title, description, youtube_url, latitude, longitude, location_name, city)
            SELECT 
                (SELECT id FROM users LIMIT 1),
                'جولة في رام الله - وسط البلد',
                'استكشاف أجمل أماكن واجهة رام الله 🏙️',
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                31.9038, 35.2034,
                'وسط البلد', 'رام الله'
            WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
            ON CONFLICT DO NOTHING;

            INSERT INTO reels (user_id, title, description, youtube_url, latitude, longitude, location_name, city)
            SELECT 
                (SELECT id FROM users LIMIT 1),
                'قهوة الصباح في البيرة',
                'أجمل كافيهات البيرة ☕',
                'https://www.youtube.com/watch?v=ScMzIvxBSi4',
                31.9100, 35.2150,
                'شارع الإرسال', 'البيرة'
            WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
            ON CONFLICT DO NOTHING;

            INSERT INTO reels (user_id, title, description, youtube_url, latitude, longitude, location_name, city)
            SELECT 
                (SELECT id FROM users LIMIT 1),
                'أسواق نابلس التراثية',
                'تجوال في أسواق نابلس القديمة 🧆',
                'https://www.youtube.com/watch?v=9bZkp7q19f0',
                32.2223, 35.2621,
                'الكاسترا', 'نابلس'
            WHERE EXISTS (SELECT 1 FROM users LIMIT 1)
            ON CONFLICT DO NOTHING;
        `);
        console.log('✅ Sample reels inserted');

        console.log('✨ Reels migration completed!');
    } catch (error) {
        console.error('❌ Reels migration error:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    addReelsTable()
        .then(() => {
            console.log('🎉 Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('💥 Failed:', err);
            process.exit(1);
        });
}

module.exports = { addReelsTable };
