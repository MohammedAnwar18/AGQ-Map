/* ============================================================================
   محرّك الترحيل — يسحب طبقةً من مصدرٍ خارجيّ ويخزّنها في PostGIS
   مصمَّمٌ ليعمل في عمليّةٍ طويلة (جهازك الآن، ثمّ Hetzner) لا في دالّة Vercel.
   التقدّم يُكتَب في geo_jobs فتقرأه لوحة Data Hub لحظةً بلحظة.
   ============================================================================ */
const pool = require('../config/database');
const { describeLayer, fetchFeatures } = require('./arcgis');

let schemaReady = null;
function ensureJobs() {
    if (!schemaReady) {
        schemaReady = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS geo_jobs (
                    id          BIGSERIAL PRIMARY KEY,
                    layer_slug  TEXT NOT NULL,
                    source      JSONB NOT NULL DEFAULT '{}'::jsonb,
                    status      TEXT NOT NULL DEFAULT 'queued',   -- queued|running|done|error|canceled
                    total       INTEGER,
                    done        INTEGER DEFAULT 0,
                    message     TEXT,
                    created_by  INTEGER,
                    created_at  TIMESTAMPTZ DEFAULT now(),
                    started_at  TIMESTAMPTZ,
                    finished_at TIMESTAMPTZ
                )`);
            await pool.query(`CREATE INDEX IF NOT EXISTS geo_jobs_status_idx ON geo_jobs (status, id)`);
        })().catch((e) => { schemaReady = null; throw e; });
    }
    return schemaReady;
}

/* إدراجٌ دفعيّ بـunnest — أسرع بمراتب من صفٍّ صفّ.
   الهندسة غير الصالحة لا تُسقِط الدفعة كلّها: نتجاهلها بـON CONFLICT-free filter. */
async function insertBatch(client, layerId, nameField, features) {
    const names = [], props = [], geoms = [];
    for (const f of features) {
        if (!f || !f.geometry) continue;
        const p = f.properties || {};
        names.push(nameField && p[nameField] != null ? String(p[nameField]) : null);
        props.push(JSON.stringify(p));
        geoms.push(JSON.stringify(f.geometry));
    }
    if (!geoms.length) return 0;

    const r = await client.query(
        `INSERT INTO geo_features (layer_id, name, props, geom)
         SELECT $1, t.n, t.p::jsonb, ST_SetSRID(ST_GeomFromGeoJSON(t.g), 4326)
         FROM unnest($2::text[], $3::text[], $4::text[]) AS t(n, p, g)
         WHERE t.g IS NOT NULL`,
        [layerId, names, props, geoms]);
    return r.rowCount || 0;
}

/* تشغيل مهمّةٍ واحدة حتى نهايتها */
async function runJob(jobId, { onProgress } = {}) {
    await ensureJobs();
    const jr = await pool.query('SELECT * FROM geo_jobs WHERE id = $1', [jobId]);
    if (!jr.rows.length) throw new Error('المهمّة غير موجودة');
    const job = jr.rows[0];
    if (job.status === 'running') throw new Error('المهمّة قيد التنفيذ بالفعل');

    const src = job.source || {};
    const mark = (patch) => {
        const keys = Object.keys(patch);
        return pool.query(
            `UPDATE geo_jobs SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`,
            [jobId, ...keys.map((k) => patch[k])]);
    };

    await mark({ status: 'running', started_at: new Date(), message: 'جارٍ قراءة وصف الطبقة…', done: 0 });

    const client = await pool.connect();
    try {
        if (src.kind !== 'arcgis') throw new Error(`مصدرٌ غير مدعوم: ${src.kind}`);
        const desc = await describeLayer(src.serviceUrl, src.layerId);
        await mark({ total: desc.count ?? null, message: `السحب من «${desc.name}»…` });

        // الطبقة في الكتالوج: تُنشأ أو تُحدَّث
        const lr = await client.query(
            `INSERT INTO geo_layers (slug, name_ar, name_en, category, geometry_type, fields,
                                     source, license, is_boundary, name_field, minzoom, status)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,'building')
             ON CONFLICT (slug) DO UPDATE SET
               name_ar=EXCLUDED.name_ar, category=EXCLUDED.category,
               geometry_type=EXCLUDED.geometry_type, fields=EXCLUDED.fields,
               source=EXCLUDED.source, license=EXCLUDED.license,
               is_boundary=EXCLUDED.is_boundary, name_field=EXCLUDED.name_field,
               minzoom=EXCLUDED.minzoom, status='building', updated_at=now()
             RETURNING id`,
            [job.layer_slug, src.name_ar || desc.name, desc.name, src.category || null,
             desc.geometryType, JSON.stringify(desc.fields), JSON.stringify({ ...src, resolvedUrl: desc.url }),
             src.license || null, !!src.is_boundary, src.name_field || null,
             Number.isFinite(src.minzoom) ? src.minzoom : 10]);
        const layerId = lr.rows[0].id;

        // ترحيلٌ نظيف: نستبدل محتوى الطبقة بالكامل
        await client.query('DELETE FROM geo_features WHERE layer_id = $1', [layerId]);

        let done = 0, batches = 0;
        for await (const page of fetchFeatures(desc.url, {
            where: src.where || '1=1',
            pageSize: Math.min(desc.maxRecordCount || 2000, 2000),
            maxFeatures: src.maxFeatures || Infinity,
        })) {
            done += await insertBatch(client, layerId, src.name_field, page);
            batches++;
            if (batches % 3 === 0 || done === page.length) {
                await mark({ done, message: `أُدرِج ${done.toLocaleString('en')} معلماً…` });
                if (onProgress) onProgress({ done, total: desc.count });
            }
            // فحصُ إلغاء
            const st = await pool.query('SELECT status FROM geo_jobs WHERE id = $1', [jobId]);
            if (st.rows[0]?.status === 'canceled') throw new Error('أُلغيت المهمّة');
        }

        // إحصاءاتٌ من الواقع + تفعيل الطبقة
        await client.query(
            `UPDATE geo_layers SET
               feature_count = (SELECT count(*) FROM geo_features WHERE layer_id = $1),
               extent = (SELECT ST_AsGeoJSON(ST_Envelope(ST_Extent(geom)))::jsonb FROM geo_features WHERE layer_id = $1),
               status = 'ready', updated_at = now()
             WHERE id = $1`, [layerId]);
        await client.query('ANALYZE geo_features');

        const fc = (await client.query('SELECT feature_count FROM geo_layers WHERE id = $1', [layerId])).rows[0].feature_count;
        await mark({ status: 'done', done: fc, finished_at: new Date(), message: `اكتمل: ${Number(fc).toLocaleString('en')} معلم` });
        return { ok: true, layerId, count: fc };
    } catch (e) {
        await mark({ status: 'error', finished_at: new Date(), message: String(e.message || e).slice(0, 500) });
        await pool.query(`UPDATE geo_layers SET status='error' WHERE slug=$1`, [job.layer_slug]).catch(() => {});
        throw e;
    } finally { client.release(); }
}

/* التقاطُ أقدم مهمّةٍ منتظرة وتشغيلها — يستعمله العامل الدائم */
async function runNextQueued() {
    await ensureJobs();
    const r = await pool.query(`SELECT id FROM geo_jobs WHERE status='queued' ORDER BY id LIMIT 1`);
    if (!r.rows.length) return null;
    const id = r.rows[0].id;
    try { return await runJob(id); } catch (e) { return { ok: false, id, reason: e.message }; }
}

module.exports = { ensureJobs, runJob, runNextQueued, insertBatch };
