/**
 * Migration: Add privacy_settings column to users table
 * Uses the DATABASE_URL from .env with SSL disabled for pooler connection
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🔄 Adding privacy_settings column to users table...');
        
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}'::jsonb
        `);
        
        console.log('✅ privacy_settings column added successfully!');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        await pool.end();
        process.exit(1);
    }
}

migrate();
