const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 1. إنشاء التطبيق
const app = express();

// 2. إعدادات Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. صفحة البداية - (بدون أي تعقيدات)
app.get('/', (req, res) => {
    res.status(200).json({
        message: '🗺️ Spatial Social Network API - ACTIVE',
        status: 'SUCCESS',
        platform: 'Vercel Lambda',
        environment: 'Production',
        version: '1.0.7-final-stable'
    });
});

// 4. تحميل المسارات عند الطلب (Dynamic Routes)
app.use('/api/auth', (req, res, next) => require('./routes/auth')(req, res, next));
app.use('/api/posts', (req, res, next) => require('./routes/posts')(req, res, next));
app.use('/api/users', (req, res, next) => require('./routes/users')(req, res, next));
app.use('/api/friends', (req, res, next) => require('./routes/friends')(req, res, next));
app.use('/api/ai', (req, res, next) => require('./routes/ai')(req, res, next));
app.use('/api/comments', (req, res, next) => require('./routes/comments')(req, res, next));
app.use('/api/admin', (req, res, next) => require('./routes/admin')(req, res, next));
app.use('/api/notifications', (req, res, next) => require('./routes/notifications')(req, res, next));
app.use('/api/news', (req, res, next) => require('./routes/news')(req, res, next));
app.use('/api/communities', (req, res, next) => require('./routes/communities')(req, res, next));
app.use('/api/shops', (req, res, next) => require('./routes/shops')(req, res, next));

// 5. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 API Locally at http://localhost:${PORT}`));
}

// 6. تصدير التطبيق لـ Vercel
module.exports = app;
