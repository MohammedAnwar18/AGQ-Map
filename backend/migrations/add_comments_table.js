const pool = require('../config/database');

/**
 * إضافة جدول التعليقات
 */
async function addCommentsTable() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting comments table migration...');

        // جدول التعليقات
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Comments table created');

        // إنشاء Index
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
            CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at ASC);
        `);
        console.log('✅ Comment indexes created');

        console.log('✨ Comments migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// تشغيل Migration
if (require.main === module) {
    addCommentsTable()
        .then(() => {
            console.log('🎉 All done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Failed:', error);
            process.exit(1);
        });
}

module.exports = { addCommentsTable };
