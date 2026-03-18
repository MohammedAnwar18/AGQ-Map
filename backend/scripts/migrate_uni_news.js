const pool = require('../config/database');

async function checkAndMigrate() {
  try {
    console.log('Checking database tables and columns...');
    
    // Check posts table columns
    const columnsRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'posts'
    `);
    const columns = columnsRes.rows.map(r => r.column_name);
    console.log('Posts columns:', columns);

    // Ensure link and type exist
    if (!columns.includes('external_link')) {
      console.log('Adding external_link to posts...');
      await pool.query('ALTER TABLE posts ADD COLUMN external_link TEXT');
    }
    if (!columns.includes('post_type')) {
      console.log('Adding post_type to posts...');
      await pool.query("ALTER TABLE posts ADD COLUMN post_type VARCHAR(50) DEFAULT 'news'");
    }

    // Check if likes table exists
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tables:', tables);

    if (!tables.includes('likes')) {
      console.log('Creating likes table...');
      await pool.query(`
        CREATE TABLE public.likes (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
          post_id INT REFERENCES public.posts(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, post_id)
        );
        ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
      `);
    }

    if (!tables.includes('comments')) {
      console.log('Creating comments table...');
      await pool.query(`
        CREATE TABLE public.comments (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
          post_id INT REFERENCES public.posts(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        );
        ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
      `);
    }

    console.log('🎉 Migration Completed Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Error:', error);
    process.exit(1);
  }
}

checkAndMigrate();
