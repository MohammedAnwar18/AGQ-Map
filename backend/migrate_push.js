const pool = require('./config/database');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Creating push_subscriptions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subscription JSONB NOT NULL,
                device_info TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subscription)
            );
            CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
        `);
        console.log('✅ push_subscriptions table created successfully!');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.release();
        process.exit();
    }
}

runMigration();
