
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const aiRoutes = require('./routes/ai');
const commentRoutes = require('./routes/comments');
const notificationRoutes = require('./routes/notifications');
const newsRoutes = require('./routes/news');
const communityRoutes = require('./routes/communities');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shops');


// إنشاء Express App
const app = express();
const server = http.createServer(app);

// إعداد Socket.IO للدردشة
const io = new Server(server, {
    cors: {
        origin: [
            'http://localhost:5173',
            'https://agq-map.vercel.app',
            process.env.CLIENT_URL
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.set('io', io);

const allowedOrigins = [
    'http://localhost:5173',
    'https://agq-map.vercel.app',
    process.env.CLIENT_URL
].filter(Boolean);

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// إنشاء مجلد uploads إذا لم يكن موجوداً
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// تقديم الملفات الثابتة
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/shops', shopRoutes);


// صفحة البداية
app.get('/', (req, res) => {
    res.json({
        message: '🗺️ Spatial Social Network API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            posts: '/api/posts',
            users: '/api/users',
            friends: '/api/friends'
        }
    });
});

// Socket.IO للدردشة الفورية
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // تسجيل المستخدم
    socket.on('register', async (userId) => {
        connectedUsers.set(userId.toString(), socket.id);
        socket.userId = userId;

        // تحديث حالة المستخدم في قاعدة البيانات
        await pool.query(
            'UPDATE users SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );

        console.log('User registered:', userId, 'with socket', socket.id);

        // إخبار جميع الأصدقاء أن المستخدم أصبح متصلاً
        socket.broadcast.emit('user-online', userId);
    });

    // إرسال رسالة
    socket.on('send-message', async (data) => {
        try {
            const { receiverId, content, imageUrl } = data;
            const senderId = socket.userId;

            if (!senderId || !receiverId || (!content && !imageUrl)) {
                return;
            }

            // حفظ الرسالة في قاعدة البيانات
            const query = "INSERT INTO messages(sender_id, receiver_id, content, image_url) VALUES($1, $2, $3, $4) RETURNING id, sender_id, receiver_id, content, image_url, is_read, created_at";
            const result = await pool.query(query, [senderId, receiverId, content || '', imageUrl || null]);

            const message = result.rows[0];

            // إرسال الرسالة للمستقبل إذا كان متصلاً
            const receiverSocketId = connectedUsers.get(receiverId.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive-message', message);
            }

            // تأكيد الإرسال للمرسل
            socket.emit('message-sent', message);

        } catch (error) {
            console.error('Send message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // تحميل المحادثات
    socket.on('get-messages', async (data) => {
        try {
            const { friendId } = data;
            const userId = socket.userId;

            const query = "SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) ORDER BY created_at ASC LIMIT 100";
            const result = await pool.query(query, [userId, friendId]);

            socket.emit('messages-loaded', result.rows);

            // تحديث الرسائل كمقروءة
            const updateQuery = "UPDATE messages SET is_read = true WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false";
            await pool.query(updateQuery, [userId, friendId]);

        } catch (error) {
            console.error('Get messages error:', error);
            socket.emit('error', { message: 'Failed to load messages' });
        }
    });

    // الكتابة
    socket.on('typing', (data) => {
        const { receiverId } = data;
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user-typing', { userId: socket.userId });
        }
    });

    // توقف عن الكتابة
    socket.on('stop-typing', (data) => {
        const { receiverId } = data;
        const receiverSocketId = connectedUsers.get(receiverId.toString());
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user-stop-typing', { userId: socket.userId });
        }
    });

    // الإعجاب برسالة
    socket.on('like-message', async (data) => {
        try {
            const { messageId, receiverId } = data;

            // Toggle like status
            const result = await pool.query(
                'UPDATE messages SET is_liked = NOT COALESCE(is_liked, false) WHERE id = $1 RETURNING *',
                [messageId]
            );

            if (result.rows.length > 0) {
                const updatedMessage = result.rows[0];

                // Emit to receiver
                const receiverSocketId = connectedUsers.get(receiverId.toString());
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('message-updated', updatedMessage);
                }

                // Emit back to sender (to confirm and update UI)
                socket.emit('message-updated', updatedMessage);
            }
        } catch (error) {
            console.error('Like message error:', error);
        }
    });

    // قطع الاتصال
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);

        if (socket.userId) {
            connectedUsers.delete(socket.userId.toString());

            // تحديث حالة المستخدم في قاعدة البيانات
            await pool.query(
                'UPDATE users SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [socket.userId]
            );

            // إخبار جميع الأصدقاء أن المستخدم قطع الاتصال
            socket.broadcast.emit('user-offline', socket.userId);
        }
    });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;

// Database Auto-Migrations
const runMigrations = async () => {
    try {
        console.log('🏗️ Checking database schema...');

        // Add owner_id to shops if missing
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='owner_id') THEN
                    ALTER TABLE shops ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                    RAISE NOTICE 'Added owner_id column to shops table';
                END IF;
            END $$;
        `);

        // Ensure enable_proximity_notifications exists
        await pool.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shops' AND column_name='enable_proximity_notifications') THEN
                    ALTER TABLE shops ADD COLUMN enable_proximity_notifications BOOLEAN DEFAULT FALSE;
                    RAISE NOTICE 'Added enable_proximity_notifications column to shops table';
                END IF;
            END $$;
        `);

        console.log('✅ Database schema verified');
    } catch (err) {
        console.error('❌ Migration error:', err);
    }
};

server.listen(PORT, async () => {
    console.log('Server running on port ' + PORT);
    await runMigrations();
    console.log('📡 WebSocket server ready');
    console.log('🌐 API: http://localhost:' + PORT);
});

module.exports = { app, server, io };

