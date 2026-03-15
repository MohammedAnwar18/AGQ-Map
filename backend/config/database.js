const { Pool } = require('pg');
require('dotenv').config();

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1 // مهم جداً لـ Vercel لعدم استهلاك الاتصالات
    });

    pool.on('error', (err) => {
      console.error('❌ database pool error:', err.message);
      pool = null; // إعادة التعيين للمحاولة لاحقاً
    });
  }
  return pool;
};

// تصدير كائن يحاكي الـ pool الأصلي لكنه يستخدم الـ lazy pool
module.exports = {
  query: (text, params) => getPool().query(text, params),
  on: (event, handler) => getPool().on(event, handler),
  connect: () => getPool().connect(),
  getPool
};
