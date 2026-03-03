const pool = require('../config/database');

const initCommunities = async () => {
    try {
        console.log('Initializing Communities feature...');

        // 1. Create communities table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS communities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                icon_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created communities table.');

        // 2. Create community_members table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS community_members (
                id SERIAL PRIMARY KEY,
                community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(community_id, user_id)
            );
        `);
        console.log('Created community_members table.');

        // 3. Add community_id to posts table
        // Check if column exists first to avoid error
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='posts' AND column_name='community_id';
        `);

        if (checkColumn.rows.length === 0) {
            await pool.query(`
                ALTER TABLE posts 
                ADD COLUMN community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL;
            `);
            console.log('Added community_id to posts table.');
        } else {
            console.log('community_id column already exists in posts table.');
        }

        // 4. Seed initial communities
        const initialCommunities = [
            { name: 'نباتات فلسطين', description: 'مجتمع لتوثيق النباتات البرية في فلسطين.' },
            { name: 'الزراعة في القرى الفلسطينية', description: 'توثيق العادات والمحاصيل الزراعية في قرانا.' }
        ];

        for (const comm of initialCommunities) {
            const res = await pool.query('SELECT id FROM communities WHERE name = $1', [comm.name]);
            if (res.rows.length === 0) {
                await pool.query('INSERT INTO communities (name, description) VALUES ($1, $2)', [comm.name, comm.description]);
                console.log(`Seeded community: ${comm.name}`);
            }
        }

        console.log('Communities initialization complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing communities:', error);
        process.exit(1);
    }
};

initCommunities();
