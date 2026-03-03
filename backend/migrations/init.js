const pool = require('../config/database');

/**
 * إنشاء جداول قاعدة البيانات مع PostGIS
 */
async function initDatabase() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting database migration...');

        // تفعيل PostGIS
        await client.query(`
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE EXTENSION IF NOT EXISTS postgis_topology;
    `);
        console.log('✅ PostGIS extension enabled');

        // جدول المستخدمين
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        bio TEXT,
        profile_picture VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_online BOOLEAN DEFAULT false
      );
    `);
        console.log('✅ Users table created');

        // جدول طلبات الصداقة
        await client.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, receiver_id)
      );
    `);
        console.log('✅ Friend requests table created');

        // جدول الأصدقاء
        await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_id, user2_id),
        CHECK (user1_id < user2_id)
      );
    `);
        console.log('✅ Friendships table created');

        // جدول المنشورات المكانية
        await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT,
        image_url VARCHAR(255),
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Posts table created');

        // إنشاء INDEX مكاني للمنشورات
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_location 
      ON posts USING GIST(location);
    `);
        console.log('✅ Spatial index created');

        // جدول الرسائل
        await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Messages table created');

        // جدول الإشعارات
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- friend_request, message, post_like, etc.
        content TEXT NOT NULL,
        related_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        related_post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Notifications table created');

        // إنشاء indexes للأداء
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
    `);
        console.log('✅ Performance indexes created');

        console.log('✨ Database migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// تشغيل Migration
if (require.main === module) {
    initDatabase()
        .then(() => {
            console.log('🎉 All done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed:', error);
            process.exit(1);
        });
}

module.exports = { initDatabase };
