const pool = require('../config/database');

const createARContentsTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_contents (
                id SERIAL PRIMARY KEY,
                latitude NUMERIC NOT NULL,
                longitude NUMERIC NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                shape VARCHAR(50) DEFAULT 'crystal',
                bearing NUMERIC DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                location GEOGRAPHY(Point, 4326)
            )
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS ar_contents_location_idx ON ar_contents USING GIST (location)
        `);

        console.log('✅ ar_contents table and location index created successfully');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await pool.end();
    }
};

createARContentsTable();
