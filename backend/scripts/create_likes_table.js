const pool = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Creating likes table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, post_id)
            );
        `);
        console.log('Likes table created successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error creating table:', error);
        process.exit(1);
    }
};

updateSchema();
