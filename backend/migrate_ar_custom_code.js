const pool = require('./config/database');

(async () => {
  try {
    console.log('🔄 Starting migration: Adding custom_code column to ar_contents...');
    
    // Add column if it doesn't exist
    await pool.query(`
      ALTER TABLE ar_contents 
      ADD COLUMN IF NOT EXISTS custom_code VARCHAR(100) UNIQUE
    `);
    console.log('✅ Column custom_code added or already exists.');

    // Create index for lookup speed
    await pool.query(`
      CREATE INDEX IF NOT EXISTS ar_contents_custom_code_idx 
      ON ar_contents (custom_code)
    `);
    console.log('✅ Index on custom_code created.');

    console.log('🎉 Migration completed successfully!');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
  } finally {
    await pool.end();
  }
})();
