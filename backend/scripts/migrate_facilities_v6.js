const { Pool } = require('pg');
require('dotenv').config();

// Try without SSL first, then with SSL if it fails? 
// Actually, the error "server does not support SSL" usually means we are trying to use SSL on a non-SSL port/pooler.
// Let's try ssl: false explicitly.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1
});

async function updateFacilitiesSchema() {
  try {
    console.log('Updating university_facilities schema (No SSL)...');
    
    // Add additional fields for facilities
    await pool.query(`
      ALTER TABLE public.university_facilities 
      ADD COLUMN IF NOT EXISTS image_url TEXT,
      ADD COLUMN IF NOT EXISTS cover_background TEXT,
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
        media_type VARCHAR(50) DEFAULT 'text',
        post_type VARCHAR(50) DEFAULT 'news',
        event_date TIMESTAMP WITHOUT TIME ZONE,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // Create university_specialties table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.university_specialties (
        id SERIAL PRIMARY KEY,
        facility_id INT REFERENCES public.university_facilities(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        degree_level VARCHAR(100),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('🎉 Database Schema Updated Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  }
}

updateFacilitiesSchema();
