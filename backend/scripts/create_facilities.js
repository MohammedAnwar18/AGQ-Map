const pool = require('../config/database');

async function createFacilitiesTable() {
  try {
    console.log('Creating university_facilities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.university_facilities (
        id SERIAL PRIMARY KEY,
        university_id INT REFERENCES public.shops(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        icon VARCHAR(255),
        latitude NUMERIC NOT NULL,
        longitude NUMERIC NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Also, remember Supabase Linter we solved earlier. We need to enable RLS on this new table.
    console.log('Enabling RLS...');
    await pool.query(`ALTER TABLE public.university_facilities ENABLE ROW LEVEL SECURITY;`);
    
    console.log('🎉 Done creating University Facilities table!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createFacilitiesTable();
