const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. إنشاء Express App
const app = express();

// 2. إعدادات الوسائط (Middleware) - بسيطة جداً للبدء
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. مجلد الرفع (فقط محلي)
const uploadsDir = path.join(__dirname, 'uploads');
if (!process.env.VERCEL && !fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 4. مسار الفحص (Health Check) - "سر النجاح":
// هذا المسار لا يتصل بقاعدة البيانات لكي لا ينهار السيرفر إذا كانت هناك مشكلة في الـ DB URL
app.get('/', (req, res) => {
    res.json({
        message: '🗺️ Spatial Social Network API - UP AND RUNNING',
        status: 'SUCCESS',
        platform: process.env.VERCEL ? 'Vercel Cloud' : 'Local Host',
        version: '1.0.5-final-stable',
        dbCheck: process.env.DATABASE_URL ? 'Configured ✅' : 'Missing ❌'
    });
});

// 5. تحميل المسارات الفرعية (جعلها آمنة)
try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/posts', require('./routes/posts'));
    app.use('/api/users', require('./routes/users'));
    app.use('/api/friends', require('./routes/friends'));
    app.use('/api/ai', require('./routes/ai'));
    app.use('/api/comments', require('./routes/comments'));
    app.use('/api/admin', require('./routes/admin'));
    app.use('/api/notifications', require('./routes/notifications'));
    app.use('/api/news', require('./routes/news'));
    app.use('/api/communities', require('./routes/communities'));
    app.use('/api/shops', require('./routes/shops'));
} catch (routeErr) {
    console.error('❌ Router Loading Error:', routeErr.message);
}

// 6. التشغيل المحلي فقط (للمبرمج)
if (!process.env.VERCEL) {
    const http = require('http');
    const server = http.createServer(app);
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Local development at http://localhost:${PORT}`));
}

// 7. تصدير التطبيق لـ Vercel
module.exports = app;
