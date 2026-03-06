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

const isProduction = process.env.NODE_ENV === 'production' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// اختبار الاتصال
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Connected to PostgreSQL database');
  }
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  // DO NOT process.exit(-1) on Vercel as it crashes the lambda
});

module.exports = pool;
