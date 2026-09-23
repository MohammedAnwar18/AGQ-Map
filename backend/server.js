
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
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});
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
const cameraRoutes = require('./routes/cameras');
const reelsRoutes = require('./routes/reels');
const studySpaceRoutes = require('./routes/studySpace');
const fitnessRoutes = require('./routes/fitness');

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
app.use('/api/ar-models', require('./routes/arModels'));
app.use('/api/helly', require('./routes/helly'));
app.use('/api/game', require('./routes/game'));
app.use('/api/ar-indoor', require('./routes/arIndoor'));
app.use('/api/regional-events', regionalEventsRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/study-space', studySpaceRoutes);
app.use('/api/fitness', fitnessRoutes);

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

// Auto-migrate: واجهة المحل (أقسام المنتجات + صور متعددة + سعر اختياري)
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_product_categories (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (shop_id, name)
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_product_categories_shop
            ON shop_product_categories (shop_id, sort_order);
        `);
        await pool.query(`
            ALTER TABLE shop_products
                ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES shop_product_categories(id) ON DELETE SET NULL,
                ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
                ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
        `);
        await pool.query('ALTER TABLE shop_products ALTER COLUMN price DROP NOT NULL;').catch(() => {});
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_products_category
            ON shop_products (shop_id, category_id, sort_order);
        `);
        await pool.query(`
            UPDATE shop_products
            SET images = to_jsonb(ARRAY[image_url])
            WHERE image_url IS NOT NULL AND image_url <> ''
              AND (images IS NULL OR jsonb_array_length(images) = 0);
        `);
        console.log('✅ storefront product tables ready');
    } catch (err) {
        console.warn('⚠️ storefront migration warning:', err.message);
    }
})();

// Auto-migrate: محرّك HellyAgents للمحاكاة متعدّدة الوكلاء
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS helly_simulations (
                id SERIAL PRIMARY KEY,
                topic TEXT NOT NULL,
                seed TEXT,
                agent_count INTEGER NOT NULL DEFAULT 0,
                total_rounds INTEGER NOT NULL DEFAULT 6,
                current_round INTEGER NOT NULL DEFAULT 0,
                report TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS helly_agents (
                id SERIAL PRIMARY KEY,
                simulation_id INTEGER NOT NULL REFERENCES helly_simulations(id) ON DELETE CASCADE,
                name VARCHAR(120) NOT NULL,
                persona TEXT NOT NULL,
                stance VARCHAR(40) NOT NULL,
                initial_stance VARCHAR(40) NOT NULL,
                influence INTEGER NOT NULL DEFAULT 5,
                shifts INTEGER NOT NULL DEFAULT 0,
                last_said TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS helly_events (
                id SERIAL PRIMARY KEY,
                simulation_id INTEGER NOT NULL REFERENCES helly_simulations(id) ON DELETE CASCADE,
                agent_id INTEGER REFERENCES helly_agents(id) ON DELETE CASCADE,
                round INTEGER NOT NULL DEFAULT 0,
                kind VARCHAR(20) NOT NULL DEFAULT 'post',
                content TEXT NOT NULL,
                stance_after VARCHAR(40),
                shifted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_helly_events_sim
            ON helly_events (simulation_id, round DESC, id DESC);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_helly_agents_sim
            ON helly_agents (simulation_id);
        `);

        // الطبقة المكانية — إضافية بالكامل: المحاكاة القديمة تبقى تعمل بلا مكان
        await pool.query(`
            ALTER TABLE helly_simulations
                ADD COLUMN IF NOT EXISTS area JSONB,
                ADD COLUMN IF NOT EXISTS place_name TEXT,
                ADD COLUMN IF NOT EXISTS place_context JSONB;
        `);
        await pool.query(`
            ALTER TABLE helly_agents
                ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7),
                ADD COLUMN IF NOT EXISTS lon NUMERIC(10, 7),
                ADD COLUMN IF NOT EXISTS place_role VARCHAR(120);
        `);
        console.log('✅ HellyAgents tables ready');
    } catch (err) {
        console.warn('⚠️ HellyAgents migration warning:', err.message);
    }
})();

// Auto-migrate: خرائط الواقع المعزّز الداخلية
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_venues (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(60) NOT NULL UNIQUE,
                title VARCHAR(160) NOT NULL,
                description TEXT,

                -- ارتفاع الكاميرا عن الأرض ومجال رؤيتها: بهما يُسقَط
                -- ما على الشاشة على الأرض، فهما إعداد للمشروع لا ثابت
                eye_height NUMERIC(4, 2) NOT NULL DEFAULT 1.50,
                fov NUMERIC(5, 2) NOT NULL DEFAULT 65,

                is_published BOOLEAN DEFAULT FALSE,
                views INTEGER DEFAULT 0,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ar_venues_slug ON ar_venues (slug);
        `);

        // العقدة: مكان له اسم يُبحث عنه، أو تقاطع يمرّ به الطريق
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_nodes (
                id SERIAL PRIMARY KEY,
                venue_id INTEGER NOT NULL REFERENCES ar_venues(id) ON DELETE CASCADE,
                name VARCHAR(160) NOT NULL,
                kind VARCHAR(20) NOT NULL DEFAULT 'place',
                category VARCHAR(60),
                x NUMERIC(8, 3) NOT NULL,
                z NUMERIC(8, 3) NOT NULL,
                floor SMALLINT NOT NULL DEFAULT 0,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ar_nodes_venue ON ar_nodes (venue_id);
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_edges (
                id SERIAL PRIMARY KEY,
                venue_id INTEGER NOT NULL REFERENCES ar_venues(id) ON DELETE CASCADE,
                from_node INTEGER NOT NULL REFERENCES ar_nodes(id) ON DELETE CASCADE,
                to_node INTEGER NOT NULL REFERENCES ar_nodes(id) ON DELETE CASCADE,
                kind VARCHAR(20) NOT NULL DEFAULT 'walk',
                one_way BOOLEAN DEFAULT FALSE,

                -- الخطّ المرسوم بالإصبع على الأرض؛ فارغ يعني خطّاً
                -- مستقيماً بين العقدتين
                path JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ar_edges_venue ON ar_edges (venue_id);
        `);

        console.log('OK indoor AR map tables ready');
    } catch (err) {
        console.warn('WARN indoor AR migration warning:', err.message);
    }
})();

// Auto-migrate: عالم اللعب — هوية اللاعب وعالمه وحضوره
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_players (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(8) NOT NULL UNIQUE,
                display_name VARCHAR(40) NOT NULL,
                appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
                stats JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_game_players_code ON game_players (code);
        `);

        // عالم واحد لكل مالك — ولهذا القيد على owner_id: الحفظ
        // upsert لا إدراج متكرّر
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_worlds (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                data JSONB NOT NULL,
                title VARCHAR(80),
                is_open BOOLEAN DEFAULT TRUE,
                visits INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // الحضور: صفّ واحد لكل لاعب في كل عالم، يُحدَّث كل ثانية
        // ويُحذف بعد عشرين من الصمت
        await pool.query(`
            CREATE TABLE IF NOT EXISTS game_presence (
                id SERIAL PRIMARY KEY,
                world_code VARCHAR(8) NOT NULL,
                player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
                x NUMERIC(9, 2) DEFAULT 0,
                y NUMERIC(9, 2) DEFAULT 0,
                z NUMERIC(9, 2) DEFAULT 0,
                heading NUMERIC(8, 4) DEFAULT 0,
                mode VARCHAR(12) DEFAULT 'walk',
                vehicle VARCHAR(24),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (world_code, player_id)
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_game_presence_world
                ON game_presence (world_code, updated_at DESC);
        `);

        console.log('✅ game world tables ready');
    } catch (err) {
        console.warn('⚠️ game world migration warning:', err.message);
    }
})();

// Auto-migrate: مجسّمات الواقع المعزّز ورموزها
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ar_models (
                id SERIAL PRIMARY KEY,
                slug VARCHAR(24) NOT NULL UNIQUE,
                title VARCHAR(200) NOT NULL,
                subtitle VARCHAR(200),
                description TEXT,
                model_url TEXT NOT NULL,
                ios_url TEXT,
                poster_url TEXT,
                hotspots JSONB NOT NULL DEFAULT '[]'::jsonb,
                is_published BOOLEAN DEFAULT TRUE,
                views INTEGER DEFAULT 0,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_ar_models_slug ON ar_models (slug);
        `);
        console.log('✅ AR models table ready');
    } catch (err) {
        console.warn('⚠️ AR models migration warning:', err.message);
    }
})();

// Auto-migrate: كتالوج باركود المحل
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_barcodes (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                code VARCHAR(64) NOT NULL,
                name VARCHAR(200) NOT NULL,
                price NUMERIC(12, 2),
                product_id INTEGER REFERENCES shop_products(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (shop_id, code)
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_barcodes_lookup
            ON shop_barcodes (shop_id, code);
        `);
        console.log('✅ shop barcodes table ready');
    } catch (err) {
        console.warn('⚠️ shop barcodes migration warning:', err.message);
    }
})();

// Auto-migrate: سجلّ فواتير المحل
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_invoices (
                id SERIAL PRIMARY KEY,
                shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
                invoice_number INTEGER NOT NULL,
                customer_name VARCHAR(160),
                notes TEXT,
                items JSONB NOT NULL DEFAULT '[]'::jsonb,
                total NUMERIC(12, 2) NOT NULL DEFAULT 0,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (shop_id, invoice_number)
            );
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_shop_invoices_shop
            ON shop_invoices (shop_id, created_at DESC);
        `);
        console.log('✅ shop invoices table ready');
    } catch (err) {
        console.warn('⚠️ shop invoices migration warning:', err.message);
    }
})();

// Auto-migrate: روابط التواصل الاجتماعي وغلاف الفيديو للمحل
(async () => {
    try {
        await pool.query(`
            ALTER TABLE shops
                ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS cover_video_url TEXT;
        `);
        await pool.query(`
            ALTER TABLE shop_product_categories
                ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);
        await pool.query(`
            ALTER TABLE shop_products
                ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb,
                ADD COLUMN IF NOT EXISTS table_image_url TEXT;
        `);
        console.log('✅ shop social links, cover video & category images ready');
    } catch (err) {
        console.warn('⚠️ shop social/cover migration warning:', err.message);
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


// Auto-migrate: ensure face recognition tables exist (person registry + reference photos/descriptors)
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS face_people (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                info TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS face_photos (
                id SERIAL PRIMARY KEY,
                person_id INTEGER NOT NULL REFERENCES face_people(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                descriptor JSONB NOT NULL,
                face_box JSONB,
                detection_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_face_photos_person_id ON face_photos(person_id);`);
        console.log('✅ face_people / face_photos tables ready');
    } catch (err) {
        console.warn('⚠️ face recognition tables migration warning:', err.message);
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


