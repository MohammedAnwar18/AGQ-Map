const pool = require('./config/database');

const migrations = [
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'story'",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS subtitle TEXT",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS model_url TEXT",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS image_url TEXT",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS trigger_radius INTEGER DEFAULT 50",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS fov_angle INTEGER DEFAULT 25",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_x FLOAT DEFAULT 1.0",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_y FLOAT DEFAULT 1.0",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS scale_z FLOAT DEFAULT 1.0",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS elevation FLOAT DEFAULT 0",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS era_year INTEGER",
  "ALTER TABLE ar_contents ADD COLUMN IF NOT EXISTS tags TEXT[]",
  "CREATE INDEX IF NOT EXISTS ar_contents_type_idx ON ar_contents (type)"
];

(async () => {
  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      console.log('✅', sql.substring(0, 60));
      ok++;
    } catch (e) {
      console.error('❌', e.message, '→', sql.substring(0, 60));
      fail++;
    }
  }
  console.log(`\nDone: ${ok} succeeded, ${fail} failed`);
  await pool.end();
})();
