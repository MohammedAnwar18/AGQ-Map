const { randomUUID } = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../config/database');
const { r2Client } = require('../config/r2');

/**
 * مجسّمات الواقع المعزّز — لكل مجسّم رمز QR يفتح صفحته المستقلة.
 *
 * الملفات تُرفع من المتصفح مباشرةً إلى Cloudflare R2 برابط موقّع،
 * لأن دوال Vercel تحدّ جسم الطلب بـ ٤٫٥ ميغابايت والمجسّمات أكبر بكثير.
 */

// رمز قصير للرابط: أحرف لا تلتبس عند القراءة من ورق
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const makeSlug = (length = 8) => {
    let out = '';
    for (let i = 0; i < length; i++) {
        out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
    }
    return out;
};

const isAdmin = (req) => req.user?.role === 'admin';

const requireAdmin = (req, res) => {
    if (isAdmin(req)) return true;
    res.status(403).json({ error: 'هذه الميزة للأدمن العام فقط' });
    return false;
};

/** النقاط التوضيحية على المجسّم: [{ id, title, body, position, normal }] */
const normalizeHotspots = (value) => {
    let parsed = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value); } catch { parsed = []; }
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
        .map((spot, index) => ({
            id: String(spot?.id || `spot-${index + 1}`).slice(0, 40),
            title: String(spot?.title || '').trim().slice(0, 120),
            body: String(spot?.body || '').trim().slice(0, 1200),
            // إحداثيات model-viewer نصّية مثل "0.1m 0.2m 0.3m"
            position: String(spot?.position || '0m 0m 0m').slice(0, 60),
            normal: String(spot?.normal || '0m 1m 0m').slice(0, 60)
        }))
        .filter(spot => spot.title || spot.body)
        .slice(0, 30);
};

const normalizeModel = (row) => {
    if (!row) return row;
    let hotspots = row.hotspots;
    if (typeof hotspots === 'string') {
        try { hotspots = JSON.parse(hotspots); } catch { hotspots = []; }
    }
    return { ...row, hotspots: Array.isArray(hotspots) ? hotspots : [] };
};

// ── القراءة العامة: صفحة المجسّم تفتح بلا حساب ───────────────
const getModelBySlug = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM ar_models WHERE slug = $1 AND is_published = TRUE',
            [String(req.params.slug || '').trim().toLowerCase()]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'المجسّم غير موجود' });

        // عدّاد مشاهدات بسيط، لا يعطّل الاستجابة إن فشل
        pool.query('UPDATE ar_models SET views = views + 1 WHERE id = $1', [result.rows[0].id])
            .catch(() => {});

        res.json(normalizeModel(result.rows[0]));
    } catch (e) {
        console.error('Get AR model error:', e);
        res.status(500).json({ error: 'Failed to load model' });
    }
};

// ── إدارة (أدمن عام) ─────────────────────────────────────────
const listModels = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const result = await pool.query(`
            SELECT m.*, u.username AS created_by_name
            FROM ar_models m
            LEFT JOIN users u ON u.id = m.created_by
            ORDER BY m.created_at DESC
        `);
        res.json({ models: result.rows.map(normalizeModel) });
    } catch (e) {
        console.error('List AR models error:', e);
        res.status(500).json({ error: 'Failed to list models' });
    }
};

const createModel = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const title = String(req.body.title || '').trim().slice(0, 200);
        if (!title) return res.status(400).json({ error: 'اسم المجسّم مطلوب' });
        if (!req.body.model_url) return res.status(400).json({ error: 'ملف المجسّم مطلوب' });

        // نحاول بضع مرّات تحسّباً لتصادم نادر في الرمز
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const result = await pool.query(`
                    INSERT INTO ar_models
                        (slug, title, subtitle, description, model_url, ios_url, poster_url,
                         hotspots, created_by, is_published)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, TRUE)
                    RETURNING *
                `, [
                    makeSlug(),
                    title,
                    String(req.body.subtitle || '').trim().slice(0, 200) || null,
                    String(req.body.description || '').trim().slice(0, 5000) || null,
                    req.body.model_url,
                    req.body.ios_url || null,
                    req.body.poster_url || null,
                    JSON.stringify(normalizeHotspots(req.body.hotspots)),
                    req.user.userId || req.user.id || null
                ]);
                return res.json(normalizeModel(result.rows[0]));
            } catch (err) {
                if (err.code !== '23505') throw err;   // ليس تصادم رمز
            }
        }

        res.status(409).json({ error: 'تعذّر توليد رمز فريد، حاول مجدداً' });
    } catch (e) {
        console.error('Create AR model error:', e);
        res.status(500).json({ error: 'Failed to create model' });
    }
};

const updateModel = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const fields = [];
        const values = [];
        let index = 1;

        const setIf = (key, value) => {
            if (value === undefined) return;
            fields.push(`${key} = $${index++}`);
            values.push(value);
        };

        if (req.body.title !== undefined) {
            const title = String(req.body.title).trim().slice(0, 200);
            if (!title) return res.status(400).json({ error: 'اسم المجسّم مطلوب' });
            setIf('title', title);
        }
        if (req.body.subtitle !== undefined) setIf('subtitle', String(req.body.subtitle).trim().slice(0, 200) || null);
        if (req.body.description !== undefined) setIf('description', String(req.body.description).trim().slice(0, 5000) || null);
        if (req.body.model_url !== undefined) setIf('model_url', req.body.model_url || null);
        if (req.body.ios_url !== undefined) setIf('ios_url', req.body.ios_url || null);
        if (req.body.poster_url !== undefined) setIf('poster_url', req.body.poster_url || null);
        if (req.body.is_published !== undefined) setIf('is_published', Boolean(req.body.is_published));

        if (req.body.hotspots !== undefined) {
            fields.push(`hotspots = $${index++}::jsonb`);
            values.push(JSON.stringify(normalizeHotspots(req.body.hotspots)));
        }

        if (!fields.length) return res.json({ message: 'No changes provided' });
        fields.push('updated_at = CURRENT_TIMESTAMP');

        values.push(req.params.id);
        const result = await pool.query(
            `UPDATE ar_models SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'المجسّم غير موجود' });
        res.json(normalizeModel(result.rows[0]));
    } catch (e) {
        console.error('Update AR model error:', e);
        res.status(500).json({ error: 'Failed to update model' });
    }
};

const deleteModel = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const result = await pool.query('DELETE FROM ar_models WHERE id = $1 RETURNING id', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'المجسّم غير موجود' });

        res.json({ message: 'Model deleted' });
    } catch (e) {
        console.error('Delete AR model error:', e);
        res.status(500).json({ error: 'Failed to delete model' });
    }
};

/**
 * رابط رفع موقّع إلى R2 — المتصفح يرفع الملف مباشرةً،
 * فلا يمرّ المجسّم عبر الخادم ولا يصطدم بحدّ حجم الطلب.
 */
const getModelUploadUrl = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const bucket = process.env.R2_BUCKET_NAME || process.env.R2_GIS_BUCKET_NAME;
        const rawPublic = process.env.R2_PUBLIC_URL || process.env.R2_GIS_PUBLIC_URL || '';

        if (!bucket || !process.env.R2_ACCESS_KEY_ID) {
            return res.status(400).json({ error: 'تخزين R2 غير مهيّأ في متغيّرات البيئة' });
        }

        const fileName = String(req.body.fileName || 'model.glb');
        const ext = (fileName.split('.').pop() || 'glb').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
        const key = `ar-models/${randomUUID()}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: req.body.contentType || 'application/octet-stream'
        });

        const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

        let publicBase = rawPublic.trim();
        if (publicBase && !/^https?:\/\//.test(publicBase)) publicBase = `https://${publicBase}`;
        publicBase = publicBase.replace(/\/+$/, '');

        res.json({
            uploadUrl,
            publicUrl: publicBase ? `${publicBase}/${key}` : null,
            key
        });
    } catch (e) {
        console.error('AR upload URL error:', e);
        res.status(500).json({ error: 'تعذّر تجهيز رابط الرفع' });
    }
};

module.exports = {
    getModelBySlug,
    listModels,
    createModel,
    updateModel,
    deleteModel,
    getModelUploadUrl
};
