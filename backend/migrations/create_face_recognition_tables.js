const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function createFaceRecognitionTables() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting face recognition tables migration...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS face_people (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                info TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created face_people table');

        await client.query(`
            CREATE TABLE IF NOT EXISTS face_photos (
                id SERIAL PRIMARY KEY,
                person_id INTEGER NOT NULL REFERENCES face_people(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                descriptor JSONB NOT NULL,
                face_box JSONB,
                detection_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Created face_photos table');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_face_photos_person_id ON face_photos(person_id);`);
        console.log('✅ Created index on face_photos.person_id');

    } catch (error) {
        console.error('❌ Migration error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    createFaceRecognitionTables();
}

module.exports = { createFaceRecognitionTables };
