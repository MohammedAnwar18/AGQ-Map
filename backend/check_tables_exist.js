const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTables() {
    try {
        await pool.query("SELECT 1 FROM facility_posts LIMIT 1");
        console.log('facility_posts exists');
    } catch (e) {
        console.log('facility_posts DOES NOT exist:', e.message);
    }

    try {
        await pool.query("SELECT 1 FROM university_specialties LIMIT 1");
        console.log('university_specialties exists');
    } catch (e) {
        console.log('university_specialties DOES NOT exist:', e.message);
    }
    
    await pool.end();
}

checkTables();
