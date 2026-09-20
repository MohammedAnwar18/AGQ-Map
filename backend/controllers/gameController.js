const pool = require('../config/database');

/* ============================================================
   عالم اللعب — الهوية والزيارة والحضور

   ثلاثة أشياء يحتاجها لاعب:

     ١) رقم تعريفي  — ستّة أرقام يُعطيها لمن يريد أن يزوره
     ٢) عالم        — مشهد محفوظ يُفتح لكل من يعرف الرقم
     ٣) حضور        — موضعه يُنشر لمن هم في نفس العالم

   والحضور بالاستطلاع لا بالسوكِت: المشروع يعمل على دوالّ Vercel
   العابرة، ولا اتّصال دائم يعيش فيها. فكل لاعب يُعلن موضعه كل
   ثانية ويأخذ في نفس الردّ مواضع الآخرين، والعميل يُنعّم ما بين
   النبضتين. التأخّر ثانية، وهو مقبول لعالم يُزار لا لمباراة.
   ============================================================ */

const PRESENCE_TTL_SECONDS = 20;   // بعدها يُعدّ اللاعب مغادراً
const MAX_NAME = 32;

// ── أدوات ───────────────────────────────────────────────────

const clean = (value, max = MAX_NAME) => String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/** رقم من ستّة خانات لا يبدأ بصفر — يُقرأ ويُملى بالصوت */
const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

const PALETTE = {
    shirt: ['#E06C75', '#61AFEF', '#E5C07B', '#98C379', '#C678DD', '#56B6C2', '#D19A66', '#EDEDED'],
    pants: ['#3B4252', '#4C566A', '#2E3440', '#5E6472', '#6B5B4A'],
    hair: ['#2B2118', '#4A3527', '#6B4A2F', '#1C1612', '#8A6B45'],
    skin: ['#F0C39A', '#E0AC83', '#C68B62', '#8D5C3D']
};

/** يُبقي المظهر ضمن اللوحة: قيمة غريبة من عميل معدَّل لا تصل للمشهد */
const sanitizeAppearance = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const out = {};

    for (const [key, options] of Object.entries(PALETTE)) {
        out[key] = options.includes(source[key]) ? source[key] : options[0];
    }

    out.height = Math.min(1.12, Math.max(0.88, num(source.height, 1)));
    out.bag = Boolean(source.bag);
    return out;
};

const randomAppearance = () => ({
    shirt: PALETTE.shirt[Math.floor(Math.random() * PALETTE.shirt.length)],
    pants: PALETTE.pants[Math.floor(Math.random() * PALETTE.pants.length)],
    hair: PALETTE.hair[Math.floor(Math.random() * PALETTE.hair.length)],
    skin: PALETTE.skin[Math.floor(Math.random() * PALETTE.skin.length)],
    height: +(0.92 + Math.random() * 0.16).toFixed(3),
    bag: Math.random() > 0.65
});

const shape = (row) => ({
    code: row.code,
    name: row.display_name,
    appearance: row.appearance || {},
    stats: row.stats || {},
    joinedAt: row.created_at
});

// ── ١) الهوية ───────────────────────────────────────────────

/**
 * يُنشئ بطاقة اللاعب عند أوّل دخول ويُعيدها بعد ذلك.
 *
 * الرقم يُولَّد عشوائياً ويُعاد توليده عند التصادم: ستّة أرقام تعني
 * تسعمئة ألف احتمال، والتصادم نادر لكنه ليس مستحيلاً.
 */
const ensurePlayer = async (userId, fallbackName) => {
    const found = await pool.query('SELECT * FROM game_players WHERE user_id = $1', [userId]);
    if (found.rows.length) return found.rows[0];

    const name = clean(fallbackName) || `لاعب ${String(userId).slice(-4)}`;
    const appearance = randomAppearance();

    for (let attempt = 0; attempt < 8; attempt++) {
        try {
            const created = await pool.query(
                `INSERT INTO game_players (user_id, code, display_name, appearance, stats)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [userId, randomCode(), name, appearance, { steps: 0, metersDriven: 0, visits: 0 }]
            );
            return created.rows[0];
        } catch (err) {
            // 23505 = تصادم على قيد الوحدانية. على الرقم نُعيد المحاولة،
            // وعلى المستخدم يعني أن طلباً متوازياً سبقنا — فنقرأ صفّه
            if (err.code !== '23505') throw err;

            const race = await pool.query('SELECT * FROM game_players WHERE user_id = $1', [userId]);
            if (race.rows.length) return race.rows[0];
        }
    }

    throw new Error('تعذّر توليد رقم تعريفي غير مستعمل');
};

exports.me = async (req, res) => {
    try {
        const player = await ensurePlayer(req.user.userId, req.user.username || req.user.name);

        const world = await pool.query(
            'SELECT updated_at, visits, is_open FROM game_worlds WHERE owner_id = $1',
            [req.user.userId]
        );

        res.json({
            player: shape(player),
            isAdmin: req.user.role === 'admin',
            world: world.rows[0]
                ? { saved: true, updatedAt: world.rows[0].updated_at, visits: world.rows[0].visits, open: world.rows[0].is_open }
                : { saved: false }
        });
    } catch (err) {
        console.error('game/me:', err.message);
        res.status(500).json({ error: 'تعذّر تجهيز بطاقة اللاعب' });
    }
};

exports.updateMe = async (req, res) => {
    try {
        await ensurePlayer(req.user.userId, req.user.username);

        const name = clean(req.body?.name);
        if (!name || name.length < 2) {
            return res.status(400).json({ error: 'الاسم قصير جداً' });
        }

        const updated = await pool.query(
            `UPDATE game_players
                SET display_name = $2, appearance = $3, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = $1
          RETURNING *`,
            [req.user.userId, name, sanitizeAppearance(req.body?.appearance)]
        );

        res.json({ player: shape(updated.rows[0]) });
    } catch (err) {
        console.error('game/updateMe:', err.message);
        res.status(500).json({ error: 'تعذّر حفظ البطاقة' });
    }
};

/** بطاقة لاعب برقمه — لعرض «إلى أين أنت ذاهب» قبل الدخول */
exports.lookup = async (req, res) => {
    try {
        const code = clean(req.params.code, 8);
        const found = await pool.query(
            `SELECT p.code, p.display_name, p.appearance,
                    w.updated_at, w.is_open, w.visits
               FROM game_players p
          LEFT JOIN game_worlds w ON w.owner_id = p.user_id
              WHERE p.code = $1`,
            [code]
        );

        if (!found.rows.length) return res.status(404).json({ error: 'لا لاعب بهذا الرقم' });

        const row = found.rows[0];
        res.json({
            code: row.code,
            name: row.display_name,
            appearance: row.appearance || {},
            world: {
                // عالم غير محفوظ ليس عالماً مغلقاً: يُفتح على المشهد
                // الافتراضي، فكل رقم صالح للزيارة منذ اللحظة الأولى
                saved: Boolean(row.updated_at),
                open: row.is_open !== false,
                updatedAt: row.updated_at,
                visits: row.visits || 0
            }
        });
    } catch (err) {
        console.error('game/lookup:', err.message);
        res.status(500).json({ error: 'تعذّر البحث' });
    }
};

// ── ٢) العالم ───────────────────────────────────────────────

exports.saveWorld = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'حفظ العالم للأدمن وحده' });
        }

        const data = req.body?.world;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'لا عالم في الطلب' });
        }

        // حدّ الحجم: حقل الارتفاعات وحده أربعون كيلوبايت، والباقي
        // مجسمات موضوعة. المليون حدّ سخيّ يمنع إغراق قاعدة البيانات.
        const size = JSON.stringify(data).length;
        if (size > 1_000_000) {
            return res.status(413).json({ error: 'ملف العالم أكبر من الحدّ المسموح' });
        }

        await ensurePlayer(req.user.userId, req.user.username);

        const saved = await pool.query(
            `INSERT INTO game_worlds (owner_id, data, title, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (owner_id) DO UPDATE
                SET data = EXCLUDED.data,
                    title = COALESCE(EXCLUDED.title, game_worlds.title),
                    updated_at = CURRENT_TIMESTAMP
          RETURNING updated_at, visits`,
            [req.user.userId, data, clean(req.body?.title, 80) || null]
        );

        res.json({ ok: true, size, updatedAt: saved.rows[0].updated_at, visits: saved.rows[0].visits });
    } catch (err) {
        console.error('game/saveWorld:', err.message);
        res.status(500).json({ error: 'تعذّر حفظ العالم' });
    }
};

/**
 * عالم لاعب برقمه.
 *
 * لا يُرفض رقم لم يحفظ صاحبه عالماً: يُعاد ‎world: null‎ ويبني
 * العميل المشهد الافتراضي. الزيارة تعمل من أوّل يوم بلا أن يضطرّ
 * أحد إلى «إنشاء عالم» قبلها.
 */
exports.getWorld = async (req, res) => {
    try {
        const code = clean(req.params.code, 8);

        const found = await pool.query(
            `SELECT p.user_id, p.code, p.display_name,
                    w.data, w.is_open, w.updated_at
               FROM game_players p
          LEFT JOIN game_worlds w ON w.owner_id = p.user_id
              WHERE p.code = $1`,
            [code]
        );

        if (!found.rows.length) return res.status(404).json({ error: 'لا لاعب بهذا الرقم' });

        const row = found.rows[0];
        const mine = row.user_id === req.user.userId;

        if (row.is_open === false && !mine && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'هذا العالم مغلق أمام الزوّار' });
        }

        if (!mine && row.data) {
            // عدّاد الزيارات لا يُوقف الردّ إن تعثّر
            pool.query('UPDATE game_worlds SET visits = visits + 1 WHERE owner_id = $1', [row.user_id])
                .catch(() => {});
        }

        res.json({
            code: row.code,
            owner: row.display_name,
            mine,
            world: row.data || null,
            updatedAt: row.updated_at || null
        });
    } catch (err) {
        console.error('game/getWorld:', err.message);
        res.status(500).json({ error: 'تعذّر فتح العالم' });
    }
};

exports.setOpen = async (req, res) => {
    try {
        const open = req.body?.open !== false;
        await pool.query(
            `INSERT INTO game_worlds (owner_id, data, is_open)
             VALUES ($1, '{}'::jsonb, $2)
             ON CONFLICT (owner_id) DO UPDATE SET is_open = EXCLUDED.is_open`,
            [req.user.userId, open]
        );
        res.json({ ok: true, open });
    } catch (err) {
        console.error('game/setOpen:', err.message);
        res.status(500).json({ error: 'تعذّر تغيير حالة العالم' });
    }
};

// ── ٣) الحضور ───────────────────────────────────────────────

/**
 * نبضة: أُعلن موضعي وآخذ مواضع من معي.
 *
 * ذهاب وإياب واحد لا اثنان — النبضة تتكرّر كل ثانية، ومضاعفة
 * الطلبات تعني مضاعفة ما تدفعه الاستضافة بلا مقابل.
 */
exports.heartbeat = async (req, res) => {
    try {
        const worldCode = clean(req.body?.world, 8);
        if (!worldCode) return res.status(400).json({ error: 'لا عالم في النبضة' });

        const player = await ensurePlayer(req.user.userId, req.user.username);

        const x = num(req.body?.x);
        const z = num(req.body?.z);
        const y = num(req.body?.y);
        const heading = num(req.body?.heading);
        const mode = ['walk', 'drive'].includes(req.body?.mode) ? req.body.mode : 'walk';
        const vehicle = clean(req.body?.vehicle, 24) || null;

        await pool.query(
            `INSERT INTO game_presence (world_code, player_id, x, y, z, heading, mode, vehicle, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             ON CONFLICT (world_code, player_id) DO UPDATE
                SET x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z,
                    heading = EXCLUDED.heading, mode = EXCLUDED.mode,
                    vehicle = EXCLUDED.vehicle, updated_at = CURRENT_TIMESTAMP`,
            [worldCode, player.id, x, y, z, heading, mode, vehicle]
        );

        // نُنظّف من انقطع: تركه يعني شبحاً واقفاً في الشارع للأبد.
        //
        // في هذا العالم وحده ومرّة كل خمس نبضات تقريباً: النبضة تأتي
        // من كل لاعب كل ثانية، وحذفٌ شاملٌ مع كلّ واحدة يُثقل قاعدة
        // البيانات بلا مقابل — ومهلة العشرين ثانية تحتمل التأخّر.
        if (Math.random() < 0.2) {
            await pool.query(
                `DELETE FROM game_presence
                  WHERE world_code = $1
                    AND updated_at < NOW() - ($2::int * INTERVAL '1 second')`,
                [worldCode, PRESENCE_TTL_SECONDS]
            );
        }

        const others = await pool.query(
            `SELECT p.code, p.display_name, p.appearance,
                    g.x, g.y, g.z, g.heading, g.mode, g.vehicle
               FROM game_presence g
               JOIN game_players p ON p.id = g.player_id
              WHERE g.world_code = $1
                AND g.player_id <> $2
                AND g.updated_at > NOW() - ($3::int * INTERVAL '1 second')
              ORDER BY g.updated_at DESC
              LIMIT 24`,
            [worldCode, player.id, PRESENCE_TTL_SECONDS]
        );

        res.json({
            players: others.rows.map(row => ({
                code: row.code,
                name: row.display_name,
                appearance: row.appearance || {},
                x: Number(row.x),
                y: Number(row.y),
                z: Number(row.z),
                heading: Number(row.heading),
                mode: row.mode,
                vehicle: row.vehicle
            }))
        });
    } catch (err) {
        console.error('game/heartbeat:', err.message);
        res.status(500).json({ error: 'تعذّرت النبضة' });
    }
};

exports.leave = async (req, res) => {
    try {
        const player = await pool.query('SELECT id FROM game_players WHERE user_id = $1', [req.user.userId]);
        if (player.rows.length) {
            await pool.query('DELETE FROM game_presence WHERE player_id = $1', [player.rows[0].id]);
        }
        res.json({ ok: true });
    } catch (err) {
        // المغادرة لا تُبلَّغ بخطأ: النظافة تتكفّل بها مهلة العشرين ثانية
        res.json({ ok: true });
    }
};
