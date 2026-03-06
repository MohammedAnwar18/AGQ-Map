const { Pool } = require('pg');
require('dotenv').config();

// إعداد خيارات الاتصال - بسيطة جداً لضمان عدم الانهيار في Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // إعدادات إضافية للسرعة في Vercel
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

module.exports = pool;
