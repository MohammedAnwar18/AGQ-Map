const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 1. إنشاء التطبيق
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 2. إعدادات Middleware والحماية برمجياً
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً" }
});

app.use(limiter);
app.use(helmet({
    contentSecurityPolicy: false, 
    crossOriginResourcePolicy: false 
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. Socket.io Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Authentication middleware for socket (optional but recommended)
    // Here we handle registration after connection
    socket.on('register', (userId) => {
        socket.userId = userId;
        socket.join(`user_${userId}`);
        console.log(`User ${userId} registered to room user_${userId}`);
    });

    // Real-time Messaging
    socket.on('send-message', async (data) => {
        const { receiverId, content, imageUrl, senderId: explicitSenderId } = data;
        const senderId = data.senderId || socket.userId;
        console.log(`💬 Message from ${senderId} to ${receiverId}`);
        
        try {
            const pool = require('./config/database');
            const result = await pool.query(
                `INSERT INTO messages (sender_id, receiver_id, content, image_url, created_at)
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                 RETURNING *`,
                [senderId, receiverId, content, imageUrl || null]
            );
            
            const newMessage = result.rows[0];
            console.log('✅ Message saved with ID:', newMessage.id);
            
            // Emit to receiver
            io.to(`user_${receiverId}`).emit('receive-message', newMessage);
            // Emit to sender for confirmation
            socket.emit('receive-message', newMessage);
            
            // Create notification
            const { createNotification } = require('./controllers/notificationController');
            await createNotification(receiverId, senderId, 'message', null);
            
        } catch (error) {
            console.error('Socket send-message error:', error);
        }
    });

    socket.on('get-messages', async ({ friendId, userId: explicitUserId }) => {
        const userId = socket.userId || explicitUserId;
        console.log(`📥 Loading messages for user ${userId} with friend ${friendId}`);
        try {
            const pool = require('./config/database');
            const result = await pool.query(
                `SELECT * FROM messages 
                 WHERE (sender_id = $1 AND receiver_id = $2)
                 OR (sender_id = $2 AND receiver_id = $1)
                 ORDER BY created_at ASC`,
                [userId, friendId]
            );
            
            console.log(`📍 Found ${result.rows.length} messages`);

            // Mark as read
            await pool.query(
                `UPDATE messages SET is_read = true 
                 WHERE receiver_id = $1 AND sender_id = $2`,
                [userId, friendId]
            );
            
            socket.emit('messages-loaded', result.rows);
        } catch (error) {
            console.error('Socket get-messages error:', error);
        }
    });

    socket.on('typing', ({ receiverId }) => {
        socket.to(`user_${receiverId}`).emit('user-typing', { userId: socket.userId });
    });

    socket.on('stop-typing', ({ receiverId }) => {
        socket.to(`user_${receiverId}`).emit('user-stop-typing', { userId: socket.userId });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Attach socket logic manually or inject into req
app.set('io', io);

// 4. تفعيل الثقة في البروكسي (مهم لبرنامج تحديد الاستهلاك على Vercel/Heroku)
app.set('trust proxy', 1);

// 5. مسار الصحة الأساسي
app.get('/health', async (req, res) => {
    try {
        const pool = require('./config/database');
        const supabase = require('./config/supabase');
        await pool.query('SELECT NOW()');
        res.json({ status: "SUCCESS", database: "CONNECTED", time: new Date() });
    } catch (e) {
        res.status(500).json({ status: "ERROR", error: e.message });
    }
});

// 6. تحميل المسارات
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/friends', require('./routes/friends'));
app.use('/messages', require('./routes/messages'));
app.use('/posts', require('./routes/posts'));
app.use('/comments', require('./routes/comments'));
app.use('/ai', require('./routes/ai'));
app.use('/notifications', require('./routes/notifications'));
app.use('/news', require('./routes/news'));
app.use('/communities', require('./routes/communities'));
app.use('/shops', require('./routes/shops'));
app.use('/admin', require('./routes/admin'));

// API Aliases
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/news', require('./routes/news'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comments', require('./routes/comments'));

// 7. التشغيل المحلي (فقط للمبرمج)
if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 API & Sockets at http://localhost:${PORT}`));
}

// 7. تصدير التطبيق لـ Vercel
module.exports = app;

