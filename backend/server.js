const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. إنشاء التطبيق
const app = express();

// 2. الإعدادات والوسائط (Middleware)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. المسارات الثابتة
const uploadsDir = path.join(__dirname, 'uploads');
if (!process.env.VERCEL && !fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 4. مسار الفحص (Health Check) - يعمل فوراً على Vercel
app.get('/', (req, res) => {
    res.json({
        message: '🗺️ Spatial Social Network API',
        status: 'UP',
        environment: process.env.VERCEL ? 'vercel' : 'local',
        version: '1.0.4-stable-vercel'
    });
});

// 5. تحميل المسارات الفرعية
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

// 6. التشغيل المحلي (فقط إذا لم يكن على Vercel)
if (!process.env.VERCEL) {
    const server = http.createServer(app);
    const { Server } = require('socket.io');
    const io = new Server(server, { cors: { origin: '*', credentials: true } });
    app.set('io', io);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, async () => {
        console.log(`🚀 Local server running at http://localhost:${PORT}`);
    });
}

// 7. تصدير التطبيق لـ Vercel
module.exports = app;
