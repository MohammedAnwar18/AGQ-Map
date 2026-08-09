const { Pool } = require('pg');
require('dotenv').config();

console.log('🔌 Initializing database connection...');
console.log('NODE_ENV:', process.env.NODE_ENV);
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  // Mask password in logs
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('DATABASE_URL:', maskedUrl);
} else {
  console.error('❌ DATABASE_URL is missing in environment variables!');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// اختبار الاتصال
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
