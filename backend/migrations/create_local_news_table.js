const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function createLocalNewsTable() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting local_news migration...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS local_news (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                image TEXT,
                location GEOMETRY(Point, 4326),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created local_news table');

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    createLocalNewsTable();
}

module.exports = { createLocalNewsTable };
