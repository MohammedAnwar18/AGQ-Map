const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('Using DATABASE_URL:', process.env.DATABASE_URL ? 'FOUND' : 'NOT FOUND');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing in .env');
    process.exit(1);
}

// Explicitly no SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=disable'),
  ssl: false,
  max: 1
});

async function migrate() {
    try {
        console.log('Migrating WITHOUT SSL (v5)...');
        
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
