const { Pool } = require('pg');
require('dotenv').config();

// Explicitly no SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=disable'),
  ssl: false,
  max: 1
});

async function migrate() {
    try {
        console.log('Migrating WITHOUT SSL...');
        
        await pool.query(`
            ALTER TABLE public.posts 
            ADD COLUMN IF NOT EXISTS title TEXT,
            ADD COLUMN IF NOT EXISTS external_link TEXT,
            ADD COLUMN IF NOT EXISTS post_type VARCHAR(50) DEFAULT 'news'
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.likes (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
                post_id INT REFERENCES public.posts(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                UNIQUE(user_id, post_id)
            )
        `);

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
