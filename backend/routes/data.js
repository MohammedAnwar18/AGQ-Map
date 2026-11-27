/* ============================================================================
   PalNovaa Data Engine — مكتبة البيانات الجغرافيّة المركزيّة
   ----------------------------------------------------------------------------
   الفكرة: البيانات تُرحَّل مرّةً واحدةً إلى PostGIS، ثمّ تُخدَم لحظيّاً.
   ونموذج الذكاء الاصطناعيّ لا يرى البيانات إطلاقاً — يرى **وصف** الطبقات
   وروابط الاستعلام فقط، فينخفض استهلاك التوكِنز ويتسارع البناء.

   الاسترجاع الذكيّ (جوهر النظام): «مساجد قرية بيتا» تُنفَّذ هكذا —
     ١. نجد «بيتا» في طبقةٍ موسومةٍ كحدود (is_boundary)
     ٢. نقصّ طبقة المساجد بحدودها عبر ST_Intersects على فهرس GiST
     ٣. نُعيد ما بداخلها فقط — لا الطبقة كاملة

   قياساتٌ أُجريت على 500 ألف مضلّع قبل كتابة هذا الملفّ:
     بلاطة z15 = 22ms · z13 = 260ms · z11 = 940ms · z8 = 14.9s (لذلك minzoom)
     بحثٌ بالخصائص = 24ms
   الدرس الحاسم: الفهرس GiST لا يُستخدَم إن حوّلنا هندسة الصفوف داخل الشرط،
   فنحوّل غلاف البلاطة إلى 4326 بدل تحويل كلّ صفّ (540ms ثابتة ← 22ms).
   ============================================================================ */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');

/* ---------------- تهيئة المخطّط (كسولة، مرّةً واحدة) ---------------- */
let ready = null;
function ensureSchema() {
    if (!ready) {
        ready = (async () => {
            await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
            await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS geo_layers (
                    id            BIGSERIAL PRIMARY KEY,
                    slug          TEXT UNIQUE NOT NULL,
                    name_ar       TEXT NOT NULL,
                    name_en       TEXT,
                    description   TEXT,
                    category      TEXT,
                    keywords      TEXT[] DEFAULT '{}',
                    geometry_type TEXT,
                    feature_count INTEGER DEFAULT 0,
                    extent        JSONB,
                    fields        JSONB DEFAULT '[]'::jsonb,
                    source        JSONB DEFAULT '{}'::jsonb,
                    license       TEXT,
                    is_boundary   BOOLEAN DEFAULT FALSE,
                    name_field    TEXT,
                    minzoom       INTEGER DEFAULT 10,
                    status        TEXT DEFAULT 'ready',
                    created_at    TIMESTAMPTZ DEFAULT now(),
                    updated_at    TIMESTAMPTZ DEFAULT now()
                )`);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS geo_features (
                    id       BIGSERIAL PRIMARY KEY,
                    layer_id BIGINT NOT NULL REFERENCES geo_layers(id) ON DELETE CASCADE,
                    name     TEXT,
                    props    JSONB NOT NULL DEFAULT '{}'::jsonb,
                    geom     geometry(Geometry, 4326) NOT NULL
                )`);

            // الفهارس: المكانيّ أوّلاً، ثمّ الطبقة، ثمّ الخصائص، ثمّ الاسم (بحثٌ تقريبيّ)
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_features_geom_gix ON geo_features USING GIST (geom)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_features_layer_idx ON geo_features (layer_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_features_props_gin ON geo_features USING GIN (props jsonb_path_ops)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_features_name_trgm ON geo_features USING GIN (name gin_trgm_ops)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_layers_kw_gin ON geo_layers USING GIN (keywords)`);
            console.log('✅ PalNovaa Data Engine: جداول PostGIS جاهزة');
        })().catch((e) => { ready = null; throw e; });
    }
    return ready;
}

const bad = (res, code, reason) => res.status(code).json({ ok: false, reason });
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

/* ============================ ١) الكتالوج ============================
   ما يراه نموذج الذكاء الاصطناعيّ: أسماءٌ ووصفٌ وحقولٌ وأعداد — لا بيانات. */

// GET /api/data/layers?q=&category=&boundary=1
router.get('/layers', async (req, res) => {
    try {
        await ensureSchema();
        const q = (req.query.q || '').toString().trim().slice(0, 120);
        const cat = (req.query.category || '').toString().trim().slice(0, 80);
        const onlyBoundary = req.query.boundary === '1';

        const where = [`status = 'ready'`];
        const vals = [];
        if (q) {
            vals.push(`%${q}%`);
            vals.push(q);
            where.push(`(name_ar ILIKE $${vals.length - 1} OR name_en ILIKE $${vals.length - 1}
                         OR description ILIKE $${vals.length - 1} OR $${vals.length} = ANY(keywords))`);
        }
        if (cat) { vals.push(cat); where.push(`category = $${vals.length}`); }
        if (onlyBoundary) where.push('is_boundary = TRUE');

        const r = await pool.query(
            `SELECT slug, name_ar, name_en, description, category, keywords, geometry_type,
                    feature_count, extent, fields, license, is_boundary, name_field, minzoom, updated_at
             FROM geo_layers WHERE ${where.join(' AND ')}
             ORDER BY is_boundary DESC, feature_count DESC LIMIT 200`, vals);

        return res.json({ ok: true, count: r.rows.length, layers: r.rows });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

// GET /api/data/layers/:slug  — تفاصيلُ طبقةٍ واحدة + قيمٌ شائعةٌ لكلّ حقلٍ نصّيّ
router.get('/layers/:slug', async (req, res) => {
    try {
        await ensureSchema();
        const r = await pool.query('SELECT * FROM geo_layers WHERE slug = $1', [req.params.slug]);
        if (!r.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const L = r.rows[0];
        // عيّنةٌ من القيم المميّزة تساعد الموديل على بناء فلاترَ صحيحة
        const facets = {};
        for (const f of (L.fields || []).filter((x) => /string|text/i.test(x.type || '')).slice(0, 6)) {
            try {
                const v = await pool.query(
                    `SELECT props->>$1 AS v, count(*)::int AS n FROM geo_features
                     WHERE layer_id = $2 AND props ? $1 GROUP BY 1 ORDER BY n DESC LIMIT 15`, [f.name, L.id]);
                if (v.rows.length) facets[f.name] = v.rows.filter((x) => x.v);
            } catch { /* */ }
        }
        delete L.id;
        return res.json({ ok: true, layer: L, facets });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ======================= ٢) البحث عن منطقة (حدود) =======================
   «بيتا»، «نابلس» … نُرجع المعالم الحدوديّة المطابقة لتُستعمَل كقاطعٍ مكانيّ. */

// GET /api/data/places?q=بيتا&limit=10
router.get('/places', async (req, res) => {
    try {
        await ensureSchema();
        const q = (req.query.q || '').toString().trim().slice(0, 120);
        if (!q) return bad(res, 400, 'أدخِل اسم المنطقة (q)');
        const limit = Math.min(num(req.query.limit, 10), 50);

        const r = await pool.query(
            `SELECT f.id, f.name, l.slug AS layer, l.name_ar AS layer_name,
                    ST_AsGeoJSON(ST_Envelope(f.geom))::json AS bbox,
                    round(ST_Area(f.geom::geography) / 1000000.0)::int AS area_km2,
                    similarity(f.name, $1) AS score
             FROM geo_features f
             JOIN geo_layers l ON l.id = f.layer_id
             WHERE l.is_boundary = TRUE AND f.name IS NOT NULL AND f.name % $1
             ORDER BY score DESC, area_km2 ASC
             LIMIT $2`, [q, limit]);

        return res.json({ ok: true, count: r.rows.length, places: r.rows });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ===================== ٣) الاستعلام الذكيّ (القلب) =====================
   GET /api/data/query
     layer   = slug الطبقة المطلوبة          (إلزاميّ)
     in      = معرّف معلمٍ حدوديّ  → القصّ داخله
     place   = اسم منطقة          → يُبحَث عنه ثمّ يُقصّ داخله
     bbox    = minx,miny,maxx,maxy
     filter  = JSON لمطابقة الخصائص: {"type":"مسجد"}
     limit   = سقف النتائج (افتراضيّ 2000، أقصى 20000)
   يُعيد GeoJSON — وهذا ما يستهلكه التطبيق المولَّد، لا الموديل. */
router.get('/query', async (req, res) => {
    try {
        await ensureSchema();
        const slug = (req.query.layer || '').toString().trim();
        if (!slug) return bad(res, 400, 'حدّد الطبقة (layer)');

        const lr = await pool.query('SELECT id, name_ar FROM geo_layers WHERE slug = $1', [slug]);
        if (!lr.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const layerId = lr.rows[0].id;

        const vals = [layerId];
        const where = [`f.layer_id = $1`];
        let clippedBy = null;

        // القصّ داخل منطقة — إمّا بمعرّفٍ مباشر أو ببحثٍ بالاسم
        let areaId = num(req.query.in, 0);
        if (!areaId && req.query.place) {
            const p = await pool.query(
                `SELECT f.id, f.name FROM geo_features f JOIN geo_layers l ON l.id = f.layer_id
                 WHERE l.is_boundary = TRUE AND f.name % $1
                 ORDER BY similarity(f.name, $1) DESC, ST_Area(f.geom) ASC LIMIT 1`,
                [req.query.place.toString().slice(0, 120)]);
            if (!p.rows.length) return bad(res, 404, `لم أجد منطقةً باسم «${req.query.place}»`);
            areaId = p.rows[0].id; clippedBy = p.rows[0].name;
        }
        if (areaId) {
            vals.push(areaId);
            // ST_Intersects على الفهرس: الهندستان في 4326 فلا تحويل داخل الشرط
            where.push(`ST_Intersects(f.geom, (SELECT geom FROM geo_features WHERE id = $${vals.length}))`);
            if (!clippedBy) {
                const nm = await pool.query('SELECT name FROM geo_features WHERE id = $1', [areaId]);
                clippedBy = nm.rows[0]?.name || null;
            }
        }

        if (req.query.bbox) {
            const b = req.query.bbox.toString().split(',').map(Number);
            if (b.length === 4 && b.every(Number.isFinite)) {
                vals.push(b[0], b[1], b[2], b[3]);
                where.push(`f.geom && ST_MakeEnvelope($${vals.length - 3},$${vals.length - 2},$${vals.length - 1},$${vals.length},4326)`);
            }
        }

        // فلتر الخصائص: JSON فقط — محصّنٌ من الحقن ويستفيد من فهرس GIN
        if (req.query.filter) {
            let obj = null;
            try { obj = JSON.parse(req.query.filter.toString()); } catch { return bad(res, 400, 'filter ليس JSON صالحاً'); }
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                vals.push(JSON.stringify(obj));
                where.push(`f.props @> $${vals.length}::jsonb`);
            }
        }

        const limit = Math.min(num(req.query.limit, 2000), 20000);
        vals.push(limit);

        const t0 = Date.now();
        const r = await pool.query(
            `SELECT f.id, f.name, f.props, ST_AsGeoJSON(f.geom)::json AS geometry
             FROM geo_features f WHERE ${where.join(' AND ')} LIMIT $${vals.length}`, vals);

        res.set('Access-Control-Allow-Origin', '*');
        return res.json({
            ok: true,
            type: 'FeatureCollection',
            layer: slug,
            clipped_by: clippedBy,
            count: r.rows.length,
            truncated: r.rows.length >= limit,
            elapsed_ms: Date.now() - t0,
            features: r.rows.map((x) => ({
                type: 'Feature', id: x.id,
                properties: { ...(x.props || {}), _name: x.name },
                geometry: x.geometry,
            })),
        });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ===================== ٤) بلاطات متّجهة (MVT) =====================
   للعرض السلس لملايين المعالم. بوّابة minzoom تمنع البلاطة الكارثيّة
   عند التكبير المنخفض (قِيست: 14.9 ثانية و12MB عند z8 لنصف مليون مضلّع). */
router.get('/tiles/:slug/:z/:x/:y.mvt', async (req, res) => {
    try {
        await ensureSchema();
        const z = num(req.params.z, -1), x = num(req.params.x, -1), y = num(req.params.y, -1);
        if (z < 0 || z > 22 || x < 0 || y < 0) return bad(res, 400, 'إحداثيّات بلاطةٍ غير صالحة');

        const lr = await pool.query('SELECT id, minzoom FROM geo_layers WHERE slug = $1', [req.params.slug]);
        if (!lr.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const { id: layerId, minzoom } = lr.rows[0];

        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', 'application/vnd.mapbox-vector-tile');
        // أقلّ من minzoom → بلاطةٌ فارغة بدل إرهاق القاعدة
        if (z < (minzoom ?? 10)) { res.set('Cache-Control', 'public, max-age=86400'); return res.send(Buffer.alloc(0)); }

        const r = await pool.query(
            `WITH b AS (SELECT ST_TileEnvelope($1,$2,$3) AS env)
             SELECT ST_AsMVT(t, 'data', 4096, 'geom') AS mvt FROM (
               SELECT f.id, f.name, f.props,
                      ST_AsMVTGeom(ST_Transform(f.geom, 3857), b.env, 4096, 64, true) AS geom
               FROM geo_features f, b
               WHERE f.layer_id = $4 AND f.geom && ST_Transform(b.env, 4326)
             ) t WHERE t.geom IS NOT NULL`, [z, x, y, layerId]);

        res.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return res.send(r.rows[0]?.mvt || Buffer.alloc(0));
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ===================== ٥) الإدارة: إنشاء وتعبئة الطبقات =====================
   الترحيل من GeoMOLG وغيره يمرّ من هنا — للأدمن وحده. */

// POST /api/data/layers   { slug, name_ar, ..., is_boundary, name_field, license, source }
router.post('/layers', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        const b = req.body || {};
        const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!slug) return bad(res, 400, 'slug مطلوب (أحرفٌ لاتينيّةٌ وأرقام)');
        if (!b.name_ar) return bad(res, 400, 'name_ar مطلوب');

        const r = await pool.query(
            `INSERT INTO geo_layers (slug, name_ar, name_en, description, category, keywords,
                                     geometry_type, fields, source, license, is_boundary, name_field, minzoom)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13)
             ON CONFLICT (slug) DO UPDATE SET
               name_ar=EXCLUDED.name_ar, name_en=EXCLUDED.name_en, description=EXCLUDED.description,
               category=EXCLUDED.category, keywords=EXCLUDED.keywords, geometry_type=EXCLUDED.geometry_type,
               fields=EXCLUDED.fields, source=EXCLUDED.source, license=EXCLUDED.license,
               is_boundary=EXCLUDED.is_boundary, name_field=EXCLUDED.name_field,
               minzoom=EXCLUDED.minzoom, updated_at=now()
             RETURNING slug, name_ar, is_boundary`,
            [slug, b.name_ar, b.name_en || null, b.description || null, b.category || null,
             Array.isArray(b.keywords) ? b.keywords : [], b.geometry_type || null,
             JSON.stringify(b.fields || []), JSON.stringify(b.source || {}), b.license || null,
             !!b.is_boundary, b.name_field || null, num(b.minzoom, 10)]);

        return res.json({ ok: true, layer: r.rows[0] });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

// POST /api/data/layers/:slug/features  { features: [GeoJSON Feature], replace?:bool }
// إدراجٌ دفعيّ بمعاملةٍ واحدة — الترحيل يستدعيه على دفعاتٍ متتابعة.
router.post('/layers/:slug/features', authenticateToken, isAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        await ensureSchema();
        const lr = await pool.query('SELECT id, name_field FROM geo_layers WHERE slug = $1', [req.params.slug]);
        if (!lr.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const { id: layerId, name_field } = lr.rows[0];

        const feats = Array.isArray(req.body?.features) ? req.body.features : null;
        if (!feats || !feats.length) return bad(res, 400, 'أرسِل features (مصفوفة GeoJSON)');
        if (feats.length > 20000) return bad(res, 413, 'الدفعة كبيرة — أرسِل 20000 معلمٍ كحدٍّ أقصى');

        await client.query('BEGIN');
        if (req.body.replace) await client.query('DELETE FROM geo_features WHERE layer_id = $1', [layerId]);

        let n = 0, skipped = 0;
        for (const f of feats) {
            if (!f || !f.geometry) { skipped++; continue; }
            const props = f.properties || {};
            const nm = name_field ? (props[name_field] != null ? String(props[name_field]) : null) : null;
            try {
                await client.query(
                    `INSERT INTO geo_features (layer_id, name, props, geom)
                     VALUES ($1, $2, $3::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))`,
                    [layerId, nm, JSON.stringify(props), JSON.stringify(f.geometry)]);
                n++;
            } catch { skipped++; }
        }

        // تحديث إحصاءات الطبقة من الواقع لا من الادّعاء
        await client.query(
            `UPDATE geo_layers SET
               feature_count = (SELECT count(*) FROM geo_features WHERE layer_id = $1),
               extent = (SELECT ST_AsGeoJSON(ST_Envelope(ST_Extent(geom)))::jsonb FROM geo_features WHERE layer_id = $1),
               geometry_type = COALESCE(geometry_type,
                 (SELECT replace(GeometryType(geom), 'MULTI', '') FROM geo_features WHERE layer_id = $1 LIMIT 1)),
               updated_at = now()
             WHERE id = $1`, [layerId]);
        await client.query('COMMIT');

        const c = await pool.query('SELECT feature_count FROM geo_layers WHERE id = $1', [layerId]);
        return res.json({ ok: true, inserted: n, skipped, total: c.rows[0].feature_count });
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch { /* */ }
        return bad(res, 500, String(e.message || e));
    } finally { client.release(); }
});

/* PATCH /api/data/layers/:slug — تصحيحُ وصف طبقةٍ مرحَّلةٍ بلا إعادة سحب.
   الأهمّ: تغييرُ name_field يُعيد اشتقاق عمود name لكلّ المعالم فوراً بأمرٍ
   واحد — وهذا ما يُصلح البحث المكانيّ حين يُختار الحقل الخطأ عند الترحيل
   (مثل LayerName_Arabic الذي يحمل القيمة نفسها لكلّ الصفوف). */
router.patch('/layers/:slug', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        const lr = await pool.query('SELECT id, fields FROM geo_layers WHERE slug = $1', [req.params.slug]);
        if (!lr.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const { id, fields } = lr.rows[0];
        const b = req.body || {};

        const sets = [], vals = [];
        const put = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
        if (b.name_ar !== undefined) put('name_ar', b.name_ar);
        if (b.category !== undefined) put('category', b.category || null);
        if (b.license !== undefined) put('license', b.license || null);
        if (b.is_boundary !== undefined) put('is_boundary', !!b.is_boundary);
        if (b.minzoom !== undefined) put('minzoom', num(b.minzoom, 10));
        if (Array.isArray(b.keywords)) put('keywords', b.keywords);

        let renamed = 0;
        if (b.name_field !== undefined) {
            const nf = b.name_field || null;
            // نقبل أسماء الحقول المعروفة فقط — لا نبني SQL من مدخلٍ حرّ
            if (nf && !(fields || []).some((f) => f.name === nf)) return bad(res, 400, 'حقلٌ غير موجود في هذه الطبقة');
            put('name_field', nf);
            const up = nf
                ? await pool.query('UPDATE geo_features SET name = props->>$2 WHERE layer_id = $1', [id, nf])
                : await pool.query('UPDATE geo_features SET name = NULL WHERE layer_id = $1', [id]);
            renamed = up.rowCount || 0;
        }

        if (!sets.length) return bad(res, 400, 'لا تغييرات');
        vals.push(id);
        const r = await pool.query(
            `UPDATE geo_layers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}
             RETURNING slug, name_ar, category, is_boundary, name_field, minzoom, feature_count`, vals);
        return res.json({ ok: true, layer: r.rows[0], renamed });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* GET /api/data/layers/:slug/field-stats — تمييزُ الحقول الصالحة للاسم:
   حقلٌ قيمتُه واحدةٌ لكلّ الصفوف لا يصلح، وحقلٌ قيمُه فريدةٌ غالباً يصلح. */
router.get('/layers/:slug/field-stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        const lr = await pool.query('SELECT id, fields, feature_count FROM geo_layers WHERE slug = $1', [req.params.slug]);
        if (!lr.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        const { id, fields, feature_count } = lr.rows[0];
        const out = [];
        for (const f of (fields || []).filter((x) => /string|text/i.test(x.type || '')).slice(0, 40)) {
            try {
                const r = await pool.query(
                    `SELECT count(DISTINCT props->>$2)::int d, count(*)::int n FROM geo_features WHERE layer_id = $1`,
                    [id, f.name]);
                const { d, n } = r.rows[0];
                out.push({ name: f.name, distinct: d, total: n, ratio: n ? +(d / n).toFixed(3) : 0 });
            } catch { /* */ }
        }
        out.sort((a, b2) => b2.distinct - a.distinct);
        return res.json({ ok: true, total: feature_count, fields: out });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

// DELETE /api/data/layers/:slug
router.delete('/layers/:slug', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        const r = await pool.query('DELETE FROM geo_layers WHERE slug = $1 RETURNING slug', [req.params.slug]);
        if (!r.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        return res.json({ ok: true, deleted: r.rows[0].slug });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ===================== ٥ب) الاسترجاع الذكيّ لنموذج الذكاء =====================
   نقطةٌ واحدة يستدعيها المحرّك قبل التوليد: يُرسل نصّ طلب المستخدم، فتُعيد
   سياقاً مضغوطاً — أيُّ طبقاتٍ تناسبه، وأيُّ منطقةٍ ذُكرت فيه — بلا أيّ
   بيانات. فيبني النموذج تطبيقاً يجلب الحقيقيَّ بنفسه، ولا نُحمّله توكِنزاً.
   ============================================================================ */

// كلماتٌ شائعةٌ لا تدلّ على مكانٍ ولا موضوع — تُستبعَد قبل المطابقة
const STOP = new Set(['أريد','اريد','ابن','ابنِ','بناء','تطبيق','موقع','خريطة','خارطة','صفحة','نظام','لوحة',
    'عرض','يعرض','يُظهر','اظهر','مع','في','على','من','الى','إلى','عن','كل','جميع','التي','الذي','هذه','هذا',
    'يكون','يمكن','أن','ان','ثم','و','أو','او','بحث','فلترة','تحليل','إحصاءات','احصاءات','بيانات','طبقة','طبقات',
    'map','app','build','want','with','the','and','for','all','show','data','layer','layers','gis']);

const tokens = (t) => String(t || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP.has(w) && !STOP.has(w.replace(/^(ال)/, '')));

// GET /api/data/resolve?text=...&max=4
router.get('/resolve', async (req, res) => {
    try {
        await ensureSchema();
        const text = (req.query.text || '').toString().slice(0, 1200);
        if (!text.trim()) return bad(res, 400, 'أرسِل text');
        const max = Math.min(num(req.query.max, 4), 8);
        const words = tokens(text).slice(0, 24);
        res.set('Access-Control-Allow-Origin', '*');
        if (!words.length) return res.json({ ok: true, layers: [], place: null, words: [] });

        /* ١) الطبقات: نُطابق كلمات الطلب باسم الطبقة ووصفها وكلماتها المفتاحيّة.
              نستعمل أعلى تشابهٍ لأيّ كلمةٍ بدل جمعها، فلا تطغى الطبقاتُ طويلةُ الاسم. */
        /* المطابقة بـword_similarity لا similarity: الثانية تُقسَم على طول النصّ
           كلّه، فكلمةٌ قصيرة («حدود») داخل اسمٍ طويل تحصل على درجةٍ ضئيلة.
           وword_similarity مصمّمةٌ لمطابقة كلمةٍ داخل عبارة. والاحتواء الحرفيّ
           يأخذ الدرجة الكاملة. */
        const lr = await pool.query(
            `WITH m AS (
               SELECT l.*, GREATEST(
                   CASE WHEN l.name_ar ILIKE '%' || w || '%' THEN 1.0 ELSE 0 END,
                   CASE WHEN COALESCE(l.name_en,'') ILIKE '%' || w || '%' THEN 0.95 ELSE 0 END,
                   CASE WHEN l.keywords && ARRAY[w] THEN 1.0 ELSE 0 END,
                   CASE WHEN l.category = w THEN 0.9 ELSE 0 END,
                   word_similarity(w, l.name_ar),
                   word_similarity(w, COALESCE(l.name_en,'')) * 0.9,
                   word_similarity(w, COALESCE(l.description,'')) * 0.6
                 ) AS sc
               FROM geo_layers l, unnest($1::text[]) AS w
               WHERE l.status = 'ready'
             )
             SELECT slug, name_ar, name_en, description, category, geometry_type, feature_count,
                    fields, is_boundary, name_field, minzoom, MAX(sc) AS score
             FROM m
             GROUP BY slug, name_ar, name_en, description, category, geometry_type,
                      feature_count, fields, is_boundary, name_field, minzoom
             HAVING MAX(sc) >= 0.45
             ORDER BY score DESC, feature_count DESC
             LIMIT $2`, [words, max]);

        /* ٢) المكان: نجرّب كلمات الطلب على المعالم الحدوديّة ونأخذ أقواها.
              الأصغر مساحةً يفوز عند التعادل — «بيتا» أدقّ من «نابلس». */
        const pr = await pool.query(
            `SELECT f.id, f.name, l.slug AS layer, similarity(f.name, w) AS score,
                    round(ST_Area(f.geom::geography)/1000000.0)::int AS area_km2
             FROM geo_features f
             JOIN geo_layers l ON l.id = f.layer_id, unnest($1::text[]) AS w
             WHERE l.is_boundary = TRUE AND f.name IS NOT NULL AND similarity(f.name, w) > 0.55
             ORDER BY score DESC, area_km2 ASC
             LIMIT 1`, [words]);

        return res.json({
            ok: true,
            words,
            place: pr.rows[0] || null,
            layers: lr.rows.map((l) => ({
                slug: l.slug, name: l.name_ar, name_en: l.name_en, category: l.category,
                geometry: l.geometry_type, count: l.feature_count,
                is_boundary: l.is_boundary, name_field: l.name_field, minzoom: l.minzoom,
                // الحقول المفيدة فقط — لا نُغرق الموديل
                fields: (l.fields || []).filter((x) => /string|text|integer|double|small/i.test(x.type || ''))
                    .slice(0, 14).map((x) => x.name),
                score: Number(l.score).toFixed(2),
            })),
        });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

/* ============== ٦) Data Hub: الاكتشاف والترحيل (أدمن) ==============
   الاكتشاف خفيفٌ فيبقى هنا؛ أمّا السحب فيُنفّذه العامل المستقلّ
   (backend/dataengine/worker.js) لأنّه قد يمتدّ دقائق — ودوالّ Vercel لا تصلح له. */
const arc = require('../dataengine/arcgis');
const jobs = require('../dataengine/migrate');

// GET /api/data/discover?url=...  — تصفّح دليل خدماتٍ أو خدمةٍ مفردة
router.get('/discover', authenticateToken, isAdmin, async (req, res) => {
    try {
        const out = await arc.discover((req.query.url || '').toString());
        return res.json({ ok: true, ...out });
    } catch (e) { return bad(res, 400, String(e.message || e)); }
});

// GET /api/data/describe?url=<serviceUrl>&layer=<id>  — حقولٌ وعددٌ قبل الترحيل
router.get('/describe', authenticateToken, isAdmin, async (req, res) => {
    try {
        const d = await arc.describeLayer((req.query.url || '').toString(), req.query.layer);
        return res.json({ ok: true, layer: d });
    } catch (e) { return bad(res, 400, String(e.message || e)); }
});

/* POST /api/data/migrate — إضافةُ مهمّةِ ترحيلٍ إلى الطابور
   { slug, serviceUrl, layerId, name_ar?, category?, name_field?, is_boundary?,
     where?, license?, minzoom?, maxFeatures? }                                   */
router.post('/migrate', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        await jobs.ensureJobs();
        const b = req.body || {};
        const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!slug) return bad(res, 400, 'slug مطلوب');
        if (!b.serviceUrl || b.layerId == null) return bad(res, 400, 'serviceUrl و layerId مطلوبان');

        const dup = await pool.query(`SELECT id FROM geo_jobs WHERE layer_slug=$1 AND status IN ('queued','running')`, [slug]);
        if (dup.rows.length) return bad(res, 409, 'توجد مهمّةٌ جاريةٌ لهذه الطبقة');

        const source = {
            kind: 'arcgis', serviceUrl: String(b.serviceUrl), layerId: b.layerId,
            where: b.where || '1=1', name_ar: b.name_ar || null, category: b.category || null,
            name_field: b.name_field || null, is_boundary: !!b.is_boundary,
            license: b.license || null, minzoom: Number.isFinite(b.minzoom) ? b.minzoom : 10,
            maxFeatures: Number.isFinite(b.maxFeatures) ? b.maxFeatures : undefined,
        };
        const r = await pool.query(
            `INSERT INTO geo_jobs (layer_slug, source, created_by) VALUES ($1,$2::jsonb,$3)
             RETURNING id, layer_slug, status, created_at`,
            [slug, JSON.stringify(source), req.user?.id || null]);
        return res.json({ ok: true, job: r.rows[0], note: 'أُضيفت للطابور — يلتقطها العامل' });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

// GET /api/data/jobs  — حالةُ المهامّ لعرض التقدّم
router.get('/jobs', authenticateToken, isAdmin, async (req, res) => {
    try {
        await jobs.ensureJobs();
        const r = await pool.query(
            `SELECT id, layer_slug, status, total, done, message, created_at, started_at, finished_at,
                    source->>'serviceUrl' AS service_url, source->>'layerId' AS layer_id
             FROM geo_jobs ORDER BY id DESC LIMIT 50`);
        return res.json({ ok: true, jobs: r.rows });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

// POST /api/data/jobs/:id/cancel  — العامل يفحص الحالة بين الدفعات فيتوقّف
router.post('/jobs/:id/cancel', authenticateToken, isAdmin, async (req, res) => {
    try {
        await jobs.ensureJobs();
        const r = await pool.query(
            `UPDATE geo_jobs SET status='canceled', finished_at=now(), message='أُلغيت يدويّاً'
             WHERE id=$1 AND status IN ('queued','running') RETURNING id, status`, [req.params.id]);
        if (!r.rows.length) return bad(res, 404, 'لا توجد مهمّةٌ قابلةٌ للإلغاء بهذا الرقم');
        return res.json({ ok: true, job: r.rows[0] });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

module.exports = router;
