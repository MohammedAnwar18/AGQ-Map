/**
 * Migration: Add privacy_settings column to users table
 * Run: node backend/migrations/add_privacy_settings.js
 */

const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🔄 Adding privacy_settings column to users table...');
        
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}'::jsonb
        `);
        
        console.log('✅ privacy_settings column added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
