const pool = require('../config/database');

async function migrate() {
    try {
        console.log('Migrating via existing pool config...');
        
        // 1. Add fields to posts
        await pool.query(`
            ALTER TABLE public.posts 
            ADD COLUMN IF NOT EXISTS external_link TEXT,
            ADD COLUMN IF NOT EXISTS post_type VARCHAR(50) DEFAULT 'news'
        `);

        // 2. Likes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.likes (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
                post_id INT REFERENCES public.posts(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, post_id)
            )
        `);

        // 3. Comments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.comments (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
                post_id INT REFERENCES public.posts(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )
        `);

        console.log('✅ Migration done');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrate();
