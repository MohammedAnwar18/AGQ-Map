const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../config/database');

const migrate = async () => {
    try {
        console.log('🔄 Creating repository_layers table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS repository_layers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                format VARCHAR(100) NOT NULL,
                size VARCHAR(50) NOT NULL,
                description TEXT,
                file_url TEXT NOT NULL,
                file_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('✅ repository_layers table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
};

migrate();
