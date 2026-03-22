const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 1. إنشاء التطبيق
const app = express();

// 2. إعدادات Middleware والحماية برمجياً
// تحديد عدد الطلبات (Rate Limiter) لمنع الهجمات المزعجة
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 300, // حد أقصى 300 طلب لكل جهاز
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" }
});

app.use(limiter);
app.use(helmet({
    contentSecurityPolicy: false, // تم الإيقاف حالياً لضمان عمل خرائط Mapbox والصور بوضوح بلا مشاكل
    crossOriginResourcePolicy: false 
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. مسار الصحة الأساسي وفحص الاتصال بقاعدة البيانات والتخزين
app.get('/health', async (req, res) => {
    try {
        const pool = require('./config/database');
        const supabase = require('./config/supabase');

        await pool.query('SELECT NOW()');
        const { error: storageError } = await supabase.storage.listBuckets();

        res.json({
            status: "SUCCESS",
            database: "CONNECTED",
            storage: storageError ? `ERROR: ${storageError.message}` : "CONNECTED",
            version: "1.0.8-debug-storage",
            time: new Date(),
            platform: "Vercel"
        });
    } catch (e) {
        res.status(500).json({ status: "ERROR", error: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        message: "🗺️ Spatial Social Network API - ACTIVE",
        status: "SUCCESS",
        platform: "Vercel Lambda",
        version: "1.0.8"
    });
});

// Alias for common path
app.get('/api', (req, res) => res.redirect('/'));
app.get('/api/health', (req, res) => res.redirect('/health'));

// 4. تحميل المسارات بشكل صريح لضمان التوافق مع Vercel
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/friends', require('./routes/friends'));
app.use('/posts', require('./routes/posts'));
app.use('/comments', require('./routes/comments'));
app.use('/ai', require('./routes/ai'));
app.use('/notifications', require('./routes/notifications'));
app.use('/news', require('./routes/news'));
app.use('/communities', require('./routes/communities'));
app.use('/shops', require('./routes/shops'));
app.use('/admin', require('./routes/admin'));

// API Aliases (/api/...) - لضمان عمل المسارات بكلا الصيغتين
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/news', require('./routes/news'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// 5. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 API Locally at http://localhost:${PORT}`));
}

// 6. تصدير التطبيق لـ Vercel
module.exports = app;
