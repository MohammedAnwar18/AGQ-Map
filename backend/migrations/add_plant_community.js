const pool = require('../config/database');

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting communities migration...');

        // 1. Create communities table
        await client.query(`
            CREATE TABLE IF NOT EXISTS communities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                icon_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Communities table updated');

        // 2. Create community_members table
        await client.query(`
            CREATE TABLE IF NOT EXISTS community_members (
                id SERIAL PRIMARY KEY,
                community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(community_id, user_id)
            );
        `);
        console.log('✅ Community members table updated');

        // 3. Add community_id to posts if not exists
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'community_id') THEN 
                    ALTER TABLE posts ADD COLUMN community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL; 
                END IF; 
            END $$;
        `);
        console.log('✅ Posts table updated with community_id');

        // 4. Seed the requested community
        const communityName = 'توثيق النباتات البرية في فلسطين';
        const communityDesc = 'مجتمع متخصص لتوثيق ومشاركة صور ومعلومات حول النباتات البرية والزراعية في فلسطين.';
        const communityIcon = '🌿'; // Using an emoji as a simple icon/placeholder

        // Check if exists
        const res = await client.query('SELECT id FROM communities WHERE name = $1', [communityName]);

        if (res.rows.length === 0) {
            await client.query(
                'INSERT INTO communities (name, description, icon_url) VALUES ($1, $2, $3)',
                [communityName, communityDesc, communityIcon]
            );
            console.log(`✅ Community "${communityName}" created`);
        } else {
            console.log(`ℹ️ Community "${communityName}" already exists`);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
