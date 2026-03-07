const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 1. إنشاء التطبيق
const app = express();

// 2. إعدادات Middleware
app.use(cors()); // Allow all for now to debug
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. مسار الصحة الأساسي وفحص الاتصال بقاعدة البيانات والتخزين
app.get('/health', async (req, res) => {
    try {
        const pool = require('./config/database');
        const supabase = require('./config/supabase');

        // فحص قاعدة البيانات
        await pool.query('SELECT NOW()');

        // فحص التخزين (محاولة جلب قائمة الـ buckets لـ التحقق من المفاتيح)
        const { data: buckets, error: storageError } = await supabase.storage.listBuckets();

        res.json({
            status: "SUCCESS",
            database: "CONNECTED",
            storage: storageError ? `ERROR: ${storageError.message}` : "CONNECTED",
            time: new Date(),
            platform: "Vercel"
        });
    } catch (e) {
        res.status(500).json({
            status: "ERROR",
            database: "CHECK_FAILED",
            error: e.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        message: "🗺️ Spatial Social Network API - ACTIVE",
        status: "SUCCESS",
        platform: "Vercel Lambda",
        environment: "Production",
        version: "1.0.7-final-stable"
    });
});

// Alias for common path
app.get('/api', (req, res) => res.redirect('/'));
app.get('/api/health', (req, res) => res.redirect('/health'));

// 4. تحميل المسارات (Routes)
const routes = ['auth', 'users', 'friends', 'posts', 'comments', 'ai', 'notifications', 'news', 'communities', 'shops', 'admin'];

routes.forEach(route => {
    try {
        const routeModule = require(`./routes/${route}`);
        app.use(`/${route}`, routeModule);
        app.use(`/api/${route}`, routeModule);
    } catch (e) {
        console.error(`Error loading route ${route}:`, e);
    }
});

// 5. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 API Locally at http://localhost:${PORT}`));
}

// 6. تصدير التطبيق لـ Vercel
module.exports = app;
