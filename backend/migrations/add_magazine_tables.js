const pool = require('../config/database');

const up = async () => {
    try {
        console.log('🚀 Creating magazine tables...');

        // 1. Magazines Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS magazines (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                cover_image TEXT,
                is_published BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Magazine Pages Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS magazine_pages (
                id SERIAL PRIMARY KEY,
                magazine_id INTEGER REFERENCES magazines(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                content JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(magazine_id, page_number)
            );
        `);

        console.log('✅ Magazine tables created successfully.');
    } catch (error) {
        console.error('❌ Error creating magazine tables:', error);
    }
};

up();
