const { Pool } = require('pg');

// التحميل فقط في البيئة المحلية، في Vercel البيئة جاهزة تلقائياً
if (!process.env.VERCEL) {
  require('dotenv').config();
}

let pool;

/**
 * دالة الحصول على مجمع الاتصالات (Pool)
 * ملاحظة هامة لـ Vercel/Supabase:
 * يجب استخدام Port 6543 في DATABASE_URL لتفعيل الـ Transaction Mode
 * لتجنب خطأ MaxClientsInSessionMode
 */
const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    // التحقق من أن الرابط يستخدم المنفذ الصحيح للـ Pooling
    if (connectionString && connectionString.includes(':5432') && process.env.VERCEL) {
      console.warn('⚠️ تنبيه: أنت تستخدم المنفذ 5432 على Vercel. يفضل استخدام 6543 لتجنب نفاذ الاتصالات.');
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      // إعدادات مثالية للـ Serverless Functions (Vercel)
      max: 1, 
      idleTimeoutMillis: 10000, // إغلاق الاتصالات الخاملة بسرعة
      connectionTimeoutMillis: 5000, // عدم الانتظار طويلاً إذا كانت القاعدة مشغولة
    });

    pool.on('error', (err) => {
      console.error('❌ Database pool error:', err.message);
      // إذا حدث خطأ قاتل، نعيد تعيين الـ pool للمحاولة في الطلب القادم
      if (err.message.includes('Session mode') || err.message.includes('max clients')) {
        pool = null;
      }
    });
  }
  return pool;
};

module.exports = {
  query: (text, params) => getPool().query(text, params),
  on: (event, handler) => getPool().on(event, handler),
  connect: () => getPool().connect(),
  getPool
};
