
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
const pushRoutes = require('./routes/push');


// إنشاء Express App
const app = express();
const server = http.createServer(app);

// إعداد Socket.IO للدردشة
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

app.set('io', io);

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        const allowed = [
            process.env.CLIENT_URL,
            'http://localhost:5173',
            'http://localhost:3000',
            'https://palnovaa.com',
            'https://www.palnovaa.com',
        ].filter(Boolean);
        // السماح بأي origin على Vercel أو في حال عدم وجود origin (server-to-server)
        if (!origin || allowed.includes(origin) || (origin && origin.includes('vercel.app'))) {
            callback(null, true);
        } else {
            callback(null, true); // السماح بالجميع مؤقتاً للإنتاج
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// إنشاء مجلد uploads - في Vercel يكون نظام الملفات Read-Only لذا نستخدم /tmp
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const uploadsDir = isVercel
    ? '/tmp/uploads'
    : path.join(__dirname, 'uploads');

try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (err) {
    console.warn('⚠️ Could not create uploads dir (likely read-only filesystem):', err.message);
}

// تقديم الملفات الثابتة
app.use('/uploads', express.static(uploadsDir));

const geoportalRoutes = require('./routes/geoportal');
const storageRoutes = require('./routes/storageRoutes');
const regionalEventsRoutes = require('./routes/regionalEvents');

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
app.use('/api/geoportals', geoportalRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/regional-events', regionalEventsRoutes);

// Auto-migrate: ensure shop_drivers table exists with all required columns
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_drivers (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                car_type VARCHAR(100),
                plate_number VARCHAR(50),
                passengers_capacity INTEGER DEFAULT 4,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(shop_id, user_id)
            );
        `);
        await pool.query(`
            ALTER TABLE shop_drivers
                ADD COLUMN IF NOT EXISTS car_type VARCHAR(100),
                ADD COLUMN IF NOT EXISTS plate_number VARCHAR(50),
                ADD COLUMN IF NOT EXISTS passengers_capacity INTEGER DEFAULT 4;
        `);
        console.log('✅ shop_drivers table ready');
    } catch (err) {
        console.warn('⚠️ shop_drivers migration warning:', err.message);
    }
})();

// Auto-migrate: ensure 360 panorama tables exist (panoramas + hotspots)
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS university_panoramas (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
                title VARCHAR(255),
                thumbnail_url TEXT,
                equirect_url TEXT,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            ALTER TABLE university_panoramas
                ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS panorama_hotspots (
                id SERIAL PRIMARY KEY,
                panorama_id INTEGER REFERENCES university_panoramas(id) ON DELETE CASCADE,
                type VARCHAR(20) NOT NULL DEFAULT 'info',
                pos_x DOUBLE PRECISION,
                pos_y DOUBLE PRECISION,
                label VARCHAR(255),
                value TEXT,
                image_url TEXT,
                target_panorama_id INTEGER REFERENCES university_panoramas(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // pos_x/pos_y (percentage position on the flat panorama image) replaced the old
        // yaw/pitch (spherical-degree) columns from the sphere-based viewer.
        await pool.query(`
            ALTER TABLE panorama_hotspots
                ADD COLUMN IF NOT EXISTS pos_x DOUBLE PRECISION,
                ADD COLUMN IF NOT EXISTS pos_y DOUBLE PRECISION;
        `);
        await pool.query(`ALTER TABLE panorama_hotspots ALTER COLUMN yaw DROP NOT NULL;`).catch(() => {});
        await pool.query(`ALTER TABLE panorama_hotspots ALTER COLUMN pitch DROP NOT NULL;`).catch(() => {});
        console.log('✅ 360 panorama tables ready');
    } catch (err) {
        console.warn('⚠️ panorama tables migration warning:', err.message);
    }
})();


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

// تشغيل السيرفر — في Vercel لا نحتاج listen (Vercel يدير HTTP بنفسه)
if (!isVercel) {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log('Server running on port ' + PORT);
        console.log('📡 WebSocket server ready');
        console.log('🌐 API: http://localhost:' + PORT);
    });
}

module.exports = app;


