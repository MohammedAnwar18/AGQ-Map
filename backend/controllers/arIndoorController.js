const pool = require('../config/database');

/* ============================================================
   خرائط الواقع المعزّز الداخلية

   المشروع الواحد (venue) هو مبنى أو طابق: بيت، محلّ، مولّ، مستشفى.
   وداخله رسم بياني:

     العقد (nodes)   أماكن لها أسماء يبحث عنها الزائر، وتقاطعات
                     لا اسم لها يمرّ بها الطريق
     الحوافّ (edges) ما يصل بينها، ومعها الخطّ المرسوم بالإصبع

   والملاحة بحث عن أقصر طريق في هذا الرسم، ثم فرده خطّاً يُسقَط على
   الأرض في الكاميرا.

   الإحداثيات بالأمتار في إطار محلّي أصله نقطة يختارها الأدمن — لا
   إحداثيات جغرافية: داخل المبنى لا GPS، والمتر أدقّ من درجة.

   الكتابة للأدمن وحده، والقراءة برابط المشاركة بلا حساب — وهذا هو
   بيت القصيد: تُرسل الرابط فيمشي من يفتحه.
   ============================================================ */

const MAX_NODES = 400;
const MAX_EDGES = 900;
const MAX_PATH_POINTS = 120;

// ── أدوات ───────────────────────────────────────────────────

const clean = (value, max = 120) => String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const metres = (value) => {
    // حدّ ألف متر: مبنى أكبر من ذلك ليس مبنى، والرقم الشارد يُفسد
    // الخريطة كلّها حين تُرسم
    const n = num(value, 0);
    return Math.max(-1000, Math.min(1000, +n.toFixed(3)));
};

const isAdmin = (req) => req.user?.role === 'admin';

/** رابط مشاركة: حروف صغيرة وأرقام، يُقرأ ويُكتب بلا التباس */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const randomSlug = (length = 7) => {
    let out = '';
    for (let i = 0; i < length; i++) {
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
};

const slugify = (title) => {
    const base = String(title || '')
        .toLowerCase()
        .replace(/[^a-z0-9ء-ي]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);

    // العربية لا تصلح في رابط يُكتب بالإنجليزية على لوحة مفاتيح
    // أجنبية، فنكتفي بالعشوائي حين لا يبقى من العنوان حرف لاتيني
    return /^[a-z0-9-]{3,}$/.test(base) ? base : randomSlug();
};

const NODE_KINDS = new Set(['place', 'junction', 'entrance', 'stairs', 'elevator', 'exit']);
const EDGE_KINDS = new Set(['walk', 'stairs', 'elevator', 'ramp']);

const sanitizePath = (raw) => {
    if (!Array.isArray(raw)) return [];

    return raw
        .slice(0, MAX_PATH_POINTS)
        .map(p => ({ x: metres(p?.x), z: metres(p?.z) }))
        .filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));
};

// ── الشكل المُعاد ───────────────────────────────────────────

const shapeVenue = (row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    eyeHeight: Number(row.eye_height),
    fov: Number(row.fov),
    isPublished: row.is_published,
    views: row.views,
    nodeCount: Number(row.node_count || 0),
    updatedAt: row.updated_at,
    createdAt: row.created_at
});

const shapeNode = (row) => ({
    id: String(row.id),
    name: row.name,
    kind: row.kind,
    category: row.category,
    x: Number(row.x),
    z: Number(row.z),
    floor: row.floor,
    note: row.note
});

const shapeEdge = (row) => ({
    id: String(row.id),
    from: String(row.from_node),
    to: String(row.to_node),
    kind: row.kind,
    oneWay: row.one_way,
    path: Array.isArray(row.path) ? row.path : []
});

// ── ١) المشاريع ─────────────────────────────────────────────

exports.listVenues = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const result = await pool.query(
            `SELECT v.*, COUNT(n.id) FILTER (WHERE n.kind = 'place') AS node_count
               FROM ar_venues v
          LEFT JOIN ar_nodes n ON n.venue_id = v.id
              GROUP BY v.id
              ORDER BY v.updated_at DESC`
        );

        res.json({ venues: result.rows.map(shapeVenue) });
    } catch (err) {
        console.error('arIndoor/list:', err.message);
        res.status(500).json({ error: 'تعذّر جلب المشاريع' });
    }
};

exports.createVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const title = clean(req.body?.title, 120);
        if (title.length < 2) return res.status(400).json({ error: 'اسم المشروع قصير جداً' });

        // الرابط قد يتصادم، فنُحاول ببديل عشوائي بدل أن نفشل
        for (let attempt = 0; attempt < 6; attempt++) {
            const slug = attempt === 0 ? slugify(title) : randomSlug();

            try {
                const created = await pool.query(
                    `INSERT INTO ar_venues (slug, title, description, eye_height, fov, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [
                        slug,
                        title,
                        clean(req.body?.description, 400) || null,
                        Math.max(0.8, Math.min(2.2, num(req.body?.eyeHeight, 1.5))),
                        Math.max(35, Math.min(110, num(req.body?.fov, 65))),
                        req.user.userId
                    ]
                );
                return res.json({ venue: shapeVenue({ ...created.rows[0], node_count: 0 }) });
            } catch (err) {
                if (err.code !== '23505') throw err;
            }
        }

        res.status(500).json({ error: 'تعذّر توليد رابط غير مستعمل' });
    } catch (err) {
        console.error('arIndoor/create:', err.message);
        res.status(500).json({ error: 'تعذّر إنشاء المشروع' });
    }
};

exports.updateVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const fields = [];
        const values = [req.params.id];

        const add = (column, value) => {
            values.push(value);
            fields.push(`${column} = $${values.length}`);
        };

        if (req.body?.title !== undefined) {
            const title = clean(req.body.title, 120);
            if (title.length < 2) return res.status(400).json({ error: 'الاسم قصير جداً' });
            add('title', title);
        }
        if (req.body?.description !== undefined) add('description', clean(req.body.description, 400) || null);
        if (req.body?.eyeHeight !== undefined) add('eye_height', Math.max(0.8, Math.min(2.2, num(req.body.eyeHeight, 1.5))));
        if (req.body?.fov !== undefined) add('fov', Math.max(35, Math.min(110, num(req.body.fov, 65))));
        if (req.body?.isPublished !== undefined) add('is_published', Boolean(req.body.isPublished));

        if (!fields.length) return res.status(400).json({ error: 'لا شيء لتعديله' });

        const updated = await pool.query(
            `UPDATE ar_venues SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
              WHERE id = $1 RETURNING *`,
            values
        );

        if (!updated.rows.length) return res.status(404).json({ error: 'لا مشروع بهذا المعرّف' });
        res.json({ venue: shapeVenue(updated.rows[0]) });
    } catch (err) {
        console.error('arIndoor/update:', err.message);
        res.status(500).json({ error: 'تعذّر الحفظ' });
    }
};

exports.deleteVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        // العقد والحوافّ تُحذف معه بقيد المفتاح الأجنبي
        const done = await pool.query('DELETE FROM ar_venues WHERE id = $1 RETURNING id', [req.params.id]);
        if (!done.rows.length) return res.status(404).json({ error: 'لا مشروع بهذا المعرّف' });

        res.json({ ok: true });
    } catch (err) {
        console.error('arIndoor/delete:', err.message);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

// ── ٢) الخريطة: العقد والحوافّ ──────────────────────────────

const loadMap = async (venueId) => {
    const [nodes, edges] = await Promise.all([
        pool.query('SELECT * FROM ar_nodes WHERE venue_id = $1 ORDER BY id', [venueId]),
        pool.query('SELECT * FROM ar_edges WHERE venue_id = $1 ORDER BY id', [venueId])
    ]);

    return {
        nodes: nodes.rows.map(shapeNode),
        edges: edges.rows.map(shapeEdge)
    };
};

/** الخريطة كاملة للأدمن — بالمعرّف */
exports.getVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const found = await pool.query('SELECT * FROM ar_venues WHERE id = $1', [req.params.id]);
        if (!found.rows.length) return res.status(404).json({ error: 'لا مشروع بهذا المعرّف' });

        res.json({ venue: shapeVenue(found.rows[0]), ...(await loadMap(found.rows[0].id)) });
    } catch (err) {
        console.error('arIndoor/get:', err.message);
        res.status(500).json({ error: 'تعذّر فتح المشروع' });
    }
};

/**
 * الخريطة للزائر — برابط المشاركة وبلا حساب.
 *
 * هذا المسار وحده مفتوح: من يفتح الرابط يمشي فوراً، ولا يُطلب منه
 * تسجيل لأجل أن يعرف أين المطبخ.
 */
exports.getPublicVenue = async (req, res) => {
    try {
        const slug = clean(req.params.slug, 60).toLowerCase();

        const found = await pool.query('SELECT * FROM ar_venues WHERE slug = $1', [slug]);
        if (!found.rows.length) return res.status(404).json({ error: 'لا خريطة بهذا الرابط' });

        const venue = found.rows[0];
        if (!venue.is_published && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'هذه الخريطة غير منشورة بعد' });
        }

        // العدّاد لا يُوقف الردّ إن تعثّر
        pool.query('UPDATE ar_venues SET views = views + 1 WHERE id = $1', [venue.id]).catch(() => {});

        res.json({ venue: shapeVenue(venue), ...(await loadMap(venue.id)) });
    } catch (err) {
        console.error('arIndoor/public:', err.message);
        res.status(500).json({ error: 'تعذّر فتح الخريطة' });
    }
};

/**
 * حفظ الخريطة كاملة دفعةً واحدة.
 *
 * استبدال شامل لا تعديل جزئي: المحرّر يعمل على نسخة في الذاكرة —
 * ترسم وتحذف وتُعيد التسمية عشرات المرّات — ثم يحفظ. ومزامنة كل
 * لمسة مع الخادم تعني عشرات الطلبات وحالات تعارض لا داعي لها.
 *
 * والمعاملة تضمن ألّا يبقى المشروع نصف محفوظ إن تعثّر شيء في
 * المنتصف: إمّا الخريطة الجديدة كلّها أو القديمة كلّها.
 */
exports.saveMap = async (req, res) => {
    const client = await pool.connect();

    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const venueId = Number(req.params.id);
        const rawNodes = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
        const rawEdges = Array.isArray(req.body?.edges) ? req.body.edges : [];

        if (rawNodes.length > MAX_NODES) {
            return res.status(413).json({ error: `العقد أكثر من الحدّ (${MAX_NODES})` });
        }
        if (rawEdges.length > MAX_EDGES) {
            return res.status(413).json({ error: `الروابط أكثر من الحدّ (${MAX_EDGES})` });
        }

        await client.query('BEGIN');

        const venue = await client.query('SELECT id FROM ar_venues WHERE id = $1 FOR UPDATE', [venueId]);
        if (!venue.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'لا مشروع بهذا المعرّف' });
        }

        await client.query('DELETE FROM ar_edges WHERE venue_id = $1', [venueId]);
        await client.query('DELETE FROM ar_nodes WHERE venue_id = $1', [venueId]);

        // المعرّفات المؤقّتة من المحرّر تُترجَم إلى معرّفات القاعدة
        const idMap = new Map();

        for (const raw of rawNodes) {
            const name = clean(raw?.name, 120);
            const kind = NODE_KINDS.has(raw?.kind) ? raw.kind : 'place';

            const inserted = await client.query(
                `INSERT INTO ar_nodes (venue_id, name, kind, category, x, z, floor, note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [
                    venueId,
                    name || (kind === 'junction' ? 'تقاطع' : 'بلا اسم'),
                    kind,
                    clean(raw?.category, 60) || null,
                    metres(raw?.x),
                    metres(raw?.z),
                    Math.max(-20, Math.min(200, Math.round(num(raw?.floor, 0)))),
                    clean(raw?.note, 300) || null
                ]
            );

            idMap.set(String(raw?.id), inserted.rows[0].id);
        }

        let skipped = 0;

        for (const raw of rawEdges) {
            const from = idMap.get(String(raw?.from));
            const to = idMap.get(String(raw?.to));

            // رابط إلى عقدة محذوفة لا يُحفظ — ولا يُسقط الحفظ كلّه
            if (!from || !to || from === to) { skipped++; continue; }

            await client.query(
                `INSERT INTO ar_edges (venue_id, from_node, to_node, kind, one_way, path)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    venueId,
                    from,
                    to,
                    EDGE_KINDS.has(raw?.kind) ? raw.kind : 'walk',
                    Boolean(raw?.oneWay),
                    JSON.stringify(sanitizePath(raw?.path))
                ]
            );
        }

        await client.query(
            'UPDATE ar_venues SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [venueId]
        );

        await client.query('COMMIT');

        res.json({
            ok: true,
            nodes: rawNodes.length,
            edges: rawEdges.length - skipped,
            skipped
        });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('arIndoor/saveMap:', err.message);
        res.status(500).json({ error: 'تعذّر حفظ الخريطة' });
    } finally {
        client.release();
    }
};
