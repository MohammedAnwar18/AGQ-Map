const pool = require('../config/database');

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                subscription JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, subscription)
            );
        `);
        console.log('Push subscriptions table created / verified.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

migrate();
