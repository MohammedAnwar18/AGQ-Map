const pool = require('../config/database');

async function createNotificationsTable() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
                CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
            CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
        `);

        console.log('✅ Notifications table created successfully');
    } catch (error) {
        console.error('❌ Error creating notifications table:', error);
        throw error;
    } finally {
        client.release();
    }
}

createNotificationsTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
