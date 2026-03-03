const pool = require('./config/database');

async function fixNotificationsSchema() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing notifications table schema...');

        // 1. Drop existing table
        await client.query('DROP TABLE IF EXISTS notifications CASCADE');
        console.log('✅ Dropped old notifications table');

        // 2. Create new table matching the controller
        await client.query(`
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX idx_notifications_is_read ON notifications(is_read);
            CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
        `);
        console.log('✅ Created new notifications table');

    } catch (error) {
        console.error('❌ Error fixing notifications schema:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixNotificationsSchema();
