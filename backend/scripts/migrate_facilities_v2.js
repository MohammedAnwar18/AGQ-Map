const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 1
});

async function updateFacilitiesSchema() {
  try {
    console.log('Updating university_facilities schema (local mode)...');
    
    // Add additional fields for facilities
    await pool.query(`
      ALTER TABLE public.university_facilities 
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_image TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS opening_hours TEXT,
      ADD COLUMN IF NOT EXISTS contact_info TEXT,
      ADD COLUMN IF NOT EXISTS website TEXT;
    `);

    // Create facility_posts table for events, news, and achievements
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.facility_posts (
        id SERIAL PRIMARY KEY,
        facility_id INT REFERENCES public.university_facilities(id) ON DELETE CASCADE,
        user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        content TEXT NOT NULL,
        media_urls TEXT[], 
        media_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'video'
        post_type VARCHAR(50) DEFAULT 'news', -- 'news', 'event', 'achievement', 'announcement'
        event_date TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Create facility_specialties table (for colleges)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.university_specialties (
        id SERIAL PRIMARY KEY,
        facility_id INT REFERENCES public.university_facilities(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        degree_level VARCHAR(100), -- 'Bachelor', 'Master', 'PhD'
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('Enabling RLS on new tables...');
    await pool.query(`ALTER TABLE public.facility_posts ENABLE ROW LEVEL SECURITY;`);
    await pool.query(`ALTER TABLE public.university_specialties ENABLE ROW LEVEL SECURITY;`);

    console.log('🎉 Database Schema Updated Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

updateFacilitiesSchema();
