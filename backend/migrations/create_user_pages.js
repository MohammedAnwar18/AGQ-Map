const pool = require('../config/database');

async function createPagesTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_design_pages (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                config JSONB NOT NULL,
                is_public BOOLEAN DEFAULT TRUE,
                views INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_pages_slug ON user_design_pages(slug);`);
        
        console.log('✅ Success: user_design_pages table created.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating table:', err);
        process.exit(1);
    }
}

createPagesTable();
