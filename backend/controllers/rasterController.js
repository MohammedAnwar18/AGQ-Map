const pool = require('../config/database');

/* ============================================================
   راستر — تخزين البلاطات وخدمتها

   البلاطات تُخزَّن في قاعدة البيانات لا في ‎R2‎، وهذا اختيار مقصود:

     · ‎storage.js‎ يرتدّ إلى ‎Base64‎ داخل القاعدة حين لا يكون ‎R2‎
       مُهيّأً — فنصير نخزّن في القاعدة على كل حال، لكن بنصّ منفوخ
       ثلثاً وبلا فهرسة
     · والبلاطة عشرات الكيلوبايتات، وهرم نموذجي ثلاثة أو أربعة
       ميجابايت — حجم لا يحسّه ‎Postgres‎
     · ومسار واحد يعمل في كل بيئة أهون من مسارين أحدهما لا يُجرَّب

   وخدمتها من مسار عامّ بلا حساب: ‎MapLibre‎ يطلب البلاطات بوسم
   ‎<img>‎ داخلي لا يحمل ترويسة تخويل. ومن ثمّ: البلاطات عامّة بطبعها،
   ومن يملك الرابط يرى الصورة — وهذا ما يجب أن يعرفه الأدمن قبل أن
   يرفع صورة لا يريد أن تُرى.
   ============================================================ */

const isAdmin = (req) => req.user?.role === 'admin';

const denyNonAdmin = (req, res) => {
    if (isAdmin(req)) return false;
    res.status(403).json({ error: 'هذا القسم للأدمن العام' });
    return true;
};

const num = (value, fallback = null) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

const int = (value, fallback = null) => {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
};

/* حدود ما يُقبل: تحمي من رفع لا نهائي ومن أرقام فاسدة */
const MAX_TILES = 4000;
const MAX_BYTES = 180 * 1024 * 1024;
const MAX_TILE_BYTES = 2 * 1024 * 1024;

/* ============================================================
   الإنشاء والرفع
   ============================================================ */

/**
 * يفتح سجلّ راستر قبل أن تُرفع بلاطاته.
 *
 * الحالة ‎building‎ تعني أنّه لا يُعرض على الخريطة بعد: هرم نصف
 * مرفوع يظهر كصورة مثقوبة، وأسوأ من ألّا يظهر.
 */
const createRaster = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ error: 'اسم الطبقة مطلوب' });

        const west = num(req.body.west);
        const south = num(req.body.south);
        const east = num(req.body.east);
        const north = num(req.body.north);

        if ([west, south, east, north].some(v => v === null)) {
            return res.status(400).json({ error: 'حدود الطبقة ناقصة' });
        }
        if (east <= west || north <= south) {
            return res.status(400).json({ error: 'حدود الطبقة غير منطقية' });
        }
        if (Math.abs(west) > 180 || Math.abs(east) > 180 || Math.abs(south) > 90 || Math.abs(north) > 90) {
            return res.status(400).json({ error: 'الحدود خارج نطاق الأرض' });
        }

        const minZoom = int(req.body.min_zoom, 0);
        const maxZoom = int(req.body.max_zoom, 0);
        if (minZoom < 0 || maxZoom > 24 || maxZoom < minZoom) {
            return res.status(400).json({ error: 'مستويات التكبير غير منطقية' });
        }

        const result = await pool.query(`
            INSERT INTO map_rasters
                (name, west, south, east, north, min_zoom, max_zoom, crs, opacity, is_visible, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, 'building', $10)
            RETURNING *
        `, [
            name.slice(0, 160),
            west, south, east, north,
            minZoom, maxZoom,
            String(req.body.crs || '').slice(0, 32) || null,
            Math.min(1, Math.max(0.05, num(req.body.opacity, 0.9))),
            req.user.userId
        ]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Create raster error:', error);
        res.status(500).json({ error: 'تعذّر إنشاء الطبقة' });
    }
};

/**
 * يستقبل دفعة بلاطات.
 *
 * دفعةً لا واحدةً واحدة: هرم من ألف بلاطة يعني ألف رحلة إلى
 * ‎Vercel‎، وكل رحلة بدء تشغيل بارد محتمل. والدفعة من عشرين بلاطة
 * تبقى تحت حدّ جسم الطلب هناك.
 *
 * واسم الحقل يحمل الموضع: ‎t_<z>_<x>_<y>‎. فلا نحتاج بياناً موازياً
 * قد يختلّ ترتيبه عن ترتيب الملفّات.
 */
const putTiles = async (req, res) => {
    const client = await pool.connect();

    try {
        if (denyNonAdmin(req, res)) return;

        const rasterId = int(req.params.id);
        if (!rasterId) return res.status(400).json({ error: 'معرّف غير صالح' });

        const existing = await client.query(
            'SELECT id, min_zoom, max_zoom, tile_count, bytes FROM map_rasters WHERE id = $1',
            [rasterId]
        );
        if (!existing.rows.length) return res.status(404).json({ error: 'الطبقة غير موجودة' });

        const raster = existing.rows[0];
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) return res.status(400).json({ error: 'لا بلاطات في الطلب' });

        let added = 0;
        let bytes = 0;
        const rejected = [];

        await client.query('BEGIN');

        for (const file of files) {
            const match = /^t_(\d{1,2})_(\d{1,9})_(\d{1,9})$/.exec(file.fieldname || '');
            if (!match) { rejected.push({ field: file.fieldname, why: 'اسم حقل غير صالح' }); continue; }

            const z = parseInt(match[1], 10);
            const x = parseInt(match[2], 10);
            const y = parseInt(match[3], 10);

            if (z < raster.min_zoom || z > raster.max_zoom) {
                rejected.push({ field: file.fieldname, why: 'مستوى خارج الهرم' });
                continue;
            }

            // الموضع داخل العالم عند هذا المستوى
            const span = Math.pow(2, z);
            if (x < 0 || y < 0 || x >= span || y >= span) {
                rejected.push({ field: file.fieldname, why: 'موضع خارج العالم' });
                continue;
            }

            if (!file.buffer?.length || file.buffer.length > MAX_TILE_BYTES) {
                rejected.push({ field: file.fieldname, why: 'حجم البلاطة غير مقبول' });
                continue;
            }

            if (raster.tile_count + added >= MAX_TILES) {
                rejected.push({ field: file.fieldname, why: 'تجاوز سقف عدد البلاطات' });
                continue;
            }
            if (Number(raster.bytes) + bytes + file.buffer.length > MAX_BYTES) {
                rejected.push({ field: file.fieldname, why: 'تجاوز سقف الحجم' });
                continue;
            }

            /* إعادة الرفع تستبدل: محاولة ثانية بعد انقطاع لا تُضاعف */
            await client.query(`
                INSERT INTO map_raster_tiles (raster_id, z, x, y, mime, data)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (raster_id, z, x, y) DO UPDATE
                    SET mime = EXCLUDED.mime, data = EXCLUDED.data
            `, [rasterId, z, x, y, file.mimetype || 'image/webp', file.buffer]);

            added += 1;
            bytes += file.buffer.length;
        }

        /* العدّ يُقرأ من الجدول لا يُجمَّع: الاستبدال لا يزيد العدد،
           وجمعُه يدويّاً ينحرف مع كل محاولة ثانية */
        const counted = await client.query(`
            UPDATE map_rasters SET
                tile_count = (SELECT COUNT(*)::int FROM map_raster_tiles WHERE raster_id = $1),
                bytes = (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM map_raster_tiles WHERE raster_id = $1)
            WHERE id = $1
            RETURNING tile_count, bytes
        `, [rasterId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            added,
            rejected,
            tile_count: counted.rows[0].tile_count,
            bytes: Number(counted.rows[0].bytes)
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Put tiles error:', error);
        res.status(500).json({ error: 'تعذّر رفع البلاطات' });
    } finally {
        client.release();
    }
};

/** يُعلن الهرم جاهزاً فيظهر على الخريطة */
const finishRaster = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const rasterId = int(req.params.id);
        if (!rasterId) return res.status(400).json({ error: 'معرّف غير صالح' });

        const result = await pool.query(`
            UPDATE map_rasters
            SET status = 'ready',
                is_visible = $2,
                tile_count = (SELECT COUNT(*)::int FROM map_raster_tiles WHERE raster_id = $1),
                bytes = (SELECT COALESCE(SUM(LENGTH(data)), 0) FROM map_raster_tiles WHERE raster_id = $1)
            WHERE id = $1
            RETURNING *
        `, [rasterId, String(req.body.is_visible) !== 'false']);

        if (!result.rows.length) return res.status(404).json({ error: 'الطبقة غير موجودة' });

        const raster = result.rows[0];
        if (!raster.tile_count) {
            return res.status(400).json({ error: 'لا بلاطات مرفوعة — لا شيء يُعرض' });
        }

        res.json(raster);
    } catch (error) {
        console.error('Finish raster error:', error);
        res.status(500).json({ error: 'تعذّر إنهاء الطبقة' });
    }
};

/* ============================================================
   القراءة
   ============================================================ */

/**
 * الطبقات. الخريطة تطلب الجاهز المرئي، والأدمن يطلب الكلّ.
 *
 * ولا ‎data‎ هنا بحال: صفّ واحد من الجدول قد يكون ميجابايتات،
 * وقائمة الطبقات تُطلب في كل فتح للخريطة.
 */
const listRasters = async (req, res) => {
    try {
        const all = isAdmin(req) && String(req.query.all) === 'true';

        const result = await pool.query(`
            SELECT id, name, west, south, east, north, min_zoom, max_zoom,
                   crs, opacity, is_visible, status, tile_count, bytes, created_at
            FROM map_rasters
            ${all ? '' : "WHERE status = 'ready' AND is_visible"}
            ORDER BY created_at DESC
        `);

        res.json({
            rasters: result.rows.map(r => ({
                ...r,
                bytes: Number(r.bytes),
                opacity: Number(r.opacity),
                west: Number(r.west), south: Number(r.south),
                east: Number(r.east), north: Number(r.north)
            }))
        });
    } catch (error) {
        console.error('List rasters error:', error);
        res.status(500).json({ error: 'تعذّر تحميل الطبقات' });
    }
};

/**
 * البلاطة نفسها — المسار الذي يطلبه ‎MapLibre‎ آلاف المرّات.
 *
 * بلا حساب، لأنّ ‎MapLibre‎ يطلبها بلا ترويسة تخويل. ومع تخزين أبديّ:
 * بلاطةٌ لراستر مُعرَّف لا تتغيّر أبداً — تعديل الصورة يُنشئ راستراً
 * جديداً بمعرّف جديد. فيُحمَّل الهرم مرّة واحدة في عمر المتصفّح.
 *
 * والمفقودة ‎204‎ لا ‎404‎: الفراغ داخل مستطيل الحدود طبيعي حين يكون
 * الراستر مائلاً، و‎MapLibre‎ يسجّل ‎404‎ خطأً في الطرفية بلا داع.
 */
const getTile = async (req, res) => {
    try {
        const rasterId = int(req.params.id);
        const z = int(req.params.z);
        const x = int(req.params.x);
        const y = int(String(req.params.y).replace(/\.(webp|png|jpg)$/i, ''));

        if ([rasterId, z, x, y].some(v => v === null) || z < 0 || z > 24 || x < 0 || y < 0) {
            return res.status(400).end();
        }

        const result = await pool.query(
            'SELECT mime, data FROM map_raster_tiles WHERE raster_id = $1 AND z = $2 AND x = $3 AND y = $4',
            [rasterId, z, x, y]
        );

        if (!result.rows.length) {
            res.set('Cache-Control', 'public, max-age=86400');
            return res.status(204).end();
        }

        res.set('Content-Type', result.rows[0].mime || 'image/webp');
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(result.rows[0].data);
    } catch (error) {
        console.error('Get tile error:', error);
        return res.status(500).end();
    }
};

/* ============================================================
   التعديل والحذف
   ============================================================ */

const updateRaster = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const rasterId = int(req.params.id);
        if (!rasterId) return res.status(400).json({ error: 'معرّف غير صالح' });

        const parts = [];
        const values = [];
        let i = 1;

        if (req.body.name !== undefined) {
            const name = String(req.body.name).trim();
            if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
            parts.push(`name = $${i++}`);
            values.push(name.slice(0, 160));
        }
        if (req.body.opacity !== undefined) {
            parts.push(`opacity = $${i++}`);
            values.push(Math.min(1, Math.max(0.05, num(req.body.opacity, 0.9))));
        }
        if (req.body.is_visible !== undefined) {
            parts.push(`is_visible = $${i++}`);
            values.push(String(req.body.is_visible) !== 'false');
        }

        if (!parts.length) return res.status(400).json({ error: 'لا تغيير' });

        values.push(rasterId);
        const result = await pool.query(
            `UPDATE map_rasters SET ${parts.join(', ')} WHERE id = $${i} RETURNING *`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'الطبقة غير موجودة' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update raster error:', error);
        res.status(500).json({ error: 'تعذّر التعديل' });
    }
};

/** الحذف يأخذ البلاطات معه — ‎ON DELETE CASCADE‎ على الجدول */
const deleteRaster = async (req, res) => {
    try {
        if (denyNonAdmin(req, res)) return;

        const rasterId = int(req.params.id);
        if (!rasterId) return res.status(400).json({ error: 'معرّف غير صالح' });

        const result = await pool.query('DELETE FROM map_rasters WHERE id = $1 RETURNING id', [rasterId]);
        if (!result.rows.length) return res.status(404).json({ error: 'الطبقة غير موجودة' });

        res.json({ success: true, id: rasterId });
    } catch (error) {
        console.error('Delete raster error:', error);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

module.exports = {
    createRaster,
    putTiles,
    finishRaster,
    listRasters,
    getTile,
    updateRaster,
    deleteRaster
};
