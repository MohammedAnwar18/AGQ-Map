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

// DELETE /api/data/layers/:slug
router.delete('/layers/:slug', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureSchema();
        const r = await pool.query('DELETE FROM geo_layers WHERE slug = $1 RETURNING slug', [req.params.slug]);
        if (!r.rows.length) return bad(res, 404, 'الطبقة غير موجودة');
        return res.json({ ok: true, deleted: r.rows[0].slug });
    } catch (e) { return bad(res, 500, String(e.message || e)); }
});

module.exports = router;
