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

// 3. مسار الصحة الأساسي وفحص الاتصال بقاعدة البيانات
app.get('/health', async (req, res) => {
    try {
        const pool = require('./config/database');
        await pool.query('SELECT NOW()');
        res.json({
            status: "SUCCESS",
            database: "CONNECTED",
            time: new Date(),
            platform: "Vercel"
        });
    } catch (e) {
        res.status(500).json({
            status: "ERROR",
            database: "DISCONNECTED",
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

// 4. تحميل المسارات (Routes) بشكل ديناميكي
// هذا النمط يسمح بدعم كل من الروابط التي تبدأ بـ /api والروابط العادية
const routes = ['auth', 'users', 'friends', 'posts', 'comments', 'ai', 'notifications', 'news', 'communities', 'shops', 'admin'];

routes.forEach(route => {
    const routeHandler = (req, res, next) => {
        try {
            require(`./routes/${route}`)(req, res, next);
        } catch (e) {
            console.error(`Error loading route ${route}:`, e);
            res.status(500).json({ error: 'Route loading failed' });
        }
    };
    app.use(`/${route}`, routeHandler);
    app.use(`/api/${route}`, routeHandler);
});

// 5. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 API Locally at http://localhost:${PORT}`));
}

// 6. تصدير التطبيق لـ Vercel
module.exports = app;
