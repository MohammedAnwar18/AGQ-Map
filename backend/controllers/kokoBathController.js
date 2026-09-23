const pool = require('../config/database');

/* ============================================================
   KokoBath — نظام الملاحة الداخلية بالواقع المعزز (VPS)

   Visual Positioning System: الكاميرا تحل محل GPS داخل المباني.

   المشروع (venue) هو أي مبنى: مول، مستشفى، مطار، فندق، جامعة.
   لكل مشروع:
     - معلومات أساسية (اسم، نوع، طوابق، مساحة)
     - بصمات بصرية (fingerprints): نقاط بصمة SLAM مع وصف المكان
     - شبكة ملاحة (navigation_nodes + edges) مرتبطة بـ ar_venues

   الكتابة والحذف للأدمن وحده.
   ============================================================ */

// ── أدوات ───────────────────────────────────────────────────

const clean = (v, max = 120) =>
    String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);

const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const isAdmin = (req) => req.user?.role === 'admin';

const VENUE_TYPES = new Set([
    'mall', 'hospital', 'airport', 'hotel', 'university',
    'office', 'museum', 'stadium', 'station', 'other'
]);

const VENUE_TYPE_LABELS = {
    mall: 'مركز تجاري',
    hospital: 'مستشفى',
    airport: 'مطار',
    hotel: 'فندق',
    university: 'جامعة / كلية',
    office: 'مبنى مكاتب',
    museum: 'متحف',
    stadium: 'ملعب / استاد',
    station: 'محطة',
    other: 'أخرى'
};

// ── تأكد من وجود الجداول ─────────────────────────────────────

const ensureTables = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kokobath_venues (
            id           SERIAL PRIMARY KEY,
            name         VARCHAR(160)  NOT NULL,
            type         VARCHAR(40)   NOT NULL DEFAULT 'other',
            description  TEXT,
            floor_count  INT           NOT NULL DEFAULT 1,
            area_sqm     NUMERIC(10,2) DEFAULT NULL,
            city         VARCHAR(120)  DEFAULT NULL,
            address      TEXT          DEFAULT NULL,
            status       VARCHAR(20)   NOT NULL DEFAULT 'pending',
            is_published BOOLEAN       NOT NULL DEFAULT FALSE,
            qr_slug      VARCHAR(40)   UNIQUE,
            created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS kokobath_fingerprints (
            id              SERIAL PRIMARY KEY,
            venue_id        INT           NOT NULL REFERENCES kokobath_venues(id) ON DELETE CASCADE,
            label           VARCHAR(200)  NOT NULL,
            floor           INT           NOT NULL DEFAULT 0,
            position_x      NUMERIC(10,3) NOT NULL DEFAULT 0,
            position_z      NUMERIC(10,3) NOT NULL DEFAULT 0,
            heading_deg     NUMERIC(6,2)  NOT NULL DEFAULT 0,
            descriptor_hash VARCHAR(512)  DEFAULT NULL,
            thumbnail_url   TEXT          DEFAULT NULL,
            capture_method  VARCHAR(40)   NOT NULL DEFAULT 'manual',
            quality_score   NUMERIC(4,2)  DEFAULT NULL,
            captured_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
    `);
};

// تشغيل إنشاء الجداول عند بدء التطبيق
ensureTables().catch(err => console.error('KokoBath tables init error:', err.message));

// ── شكل البيانات المُعادة ────────────────────────────────────

const shapeVenue = (row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    typeLabel: VENUE_TYPE_LABELS[row.type] || row.type,
    description: row.description,
    floorCount: Number(row.floor_count),
    areaSqm: row.area_sqm ? Number(row.area_sqm) : null,
    city: row.city,
    address: row.address,
    status: row.status,
    isPublished: row.is_published,
    qrSlug: row.qr_slug,
    fingerprintCount: Number(row.fingerprint_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const shapeFingerprint = (row) => ({
    id: row.id,
    venueId: row.venue_id,
    label: row.label,
    floor: Number(row.floor),
    positionX: Number(row.position_x),
    positionZ: Number(row.position_z),
    headingDeg: Number(row.heading_deg),
    descriptorHash: row.descriptor_hash,
    thumbnailUrl: row.thumbnail_url,
    captureMethod: row.capture_method,
    qualityScore: row.quality_score ? Number(row.quality_score) : null,
    capturedAt: row.captured_at
});

// ── ١) الإحصاءات العامة ──────────────────────────────────────

exports.getStats = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const [venueStats, fpStats, recentVenues] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*)                              AS total_venues,
                    COUNT(*) FILTER (WHERE is_published)  AS published_venues,
                    COUNT(*) FILTER (WHERE status = 'active') AS active_venues,
                    COUNT(*) FILTER (WHERE status = 'pending') AS pending_venues
                FROM kokobath_venues
            `),
            pool.query(`
                SELECT
                    COUNT(*) AS total_fingerprints,
                    COUNT(DISTINCT venue_id) AS venues_with_fingerprints,
                    AVG(quality_score) FILTER (WHERE quality_score IS NOT NULL) AS avg_quality
                FROM kokobath_fingerprints
            `),
            pool.query(`
                SELECT v.id, v.name, v.type, v.status, v.created_at,
                       COUNT(f.id) AS fingerprint_count
                FROM kokobath_venues v
                LEFT JOIN kokobath_fingerprints f ON f.venue_id = v.id
                GROUP BY v.id
                ORDER BY v.created_at DESC
                LIMIT 5
            `)
        ]);

        const vs = venueStats.rows[0];
        const fs = fpStats.rows[0];

        res.json({
            stats: {
                totalVenues: Number(vs.total_venues),
                publishedVenues: Number(vs.published_venues),
                activeVenues: Number(vs.active_venues),
                pendingVenues: Number(vs.pending_venues),
                totalFingerprints: Number(fs.total_fingerprints),
                venuesWithFingerprints: Number(fs.venues_with_fingerprints),
                avgQualityScore: fs.avg_quality ? Number(Number(fs.avg_quality).toFixed(2)) : null,
            },
            recentVenues: recentVenues.rows.map(shapeVenue)
        });
    } catch (err) {
        console.error('kokobath/stats:', err.message);
        res.status(500).json({ error: 'تعذّر جلب الإحصاءات' });
    }
};

// ── ٢) المواقع (Venues) ──────────────────────────────────────

exports.listVenues = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const search = clean(req.query.search || '', 100);
        const page = Math.max(1, num(req.query.page, 1));
        const limit = Math.min(50, Math.max(5, num(req.query.limit, 20)));
        const offset = (page - 1) * limit;

        const whereClause = search
            ? `WHERE (v.name ILIKE $3 OR v.city ILIKE $3 OR v.type ILIKE $3)`
            : '';

        const params = search
            ? [limit, offset, `%${search}%`]
            : [limit, offset];

        const [rows, countRow] = await Promise.all([
            pool.query(`
                SELECT v.*, COUNT(f.id) AS fingerprint_count
                FROM kokobath_venues v
                LEFT JOIN kokobath_fingerprints f ON f.venue_id = v.id
                ${whereClause}
                GROUP BY v.id
                ORDER BY v.updated_at DESC
                LIMIT $1 OFFSET $2
            `, params),
            pool.query(`
                SELECT COUNT(*) FROM kokobath_venues v
                ${whereClause}
            `, search ? [`%${search}%`] : [])
        ]);

        const total = Number(countRow.rows[0].count);

        res.json({
            venues: rows.rows.map(shapeVenue),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('kokobath/list:', err.message);
        res.status(500).json({ error: 'تعذّر جلب المواقع' });
    }
};

exports.getVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const row = await pool.query(`
            SELECT v.*, COUNT(f.id) AS fingerprint_count
            FROM kokobath_venues v
            LEFT JOIN kokobath_fingerprints f ON f.venue_id = v.id
            WHERE v.id = $1
            GROUP BY v.id
        `, [req.params.id]);

        if (!row.rows.length) return res.status(404).json({ error: 'لا موقع بهذا المعرّف' });
        res.json({ venue: shapeVenue(row.rows[0]) });
    } catch (err) {
        console.error('kokobath/get:', err.message);
        res.status(500).json({ error: 'تعذّر جلب الموقع' });
    }
};

// إنشاء slug فريد للـ QR
const generateQrSlug = async () => {
    const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
    for (let attempt = 0; attempt < 8; attempt++) {
        let slug = 'kb-';
        for (let i = 0; i < 6; i++) slug += CHARS[Math.floor(Math.random() * CHARS.length)];
        const exists = await pool.query('SELECT 1 FROM kokobath_venues WHERE qr_slug = $1', [slug]);
        if (!exists.rows.length) return slug;
    }
    return null;
};

exports.createVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const name = clean(req.body?.name, 160);
        if (name.length < 2) return res.status(400).json({ error: 'اسم الموقع قصير جداً' });

        const type = VENUE_TYPES.has(req.body?.type) ? req.body.type : 'other';
        const floorCount = Math.max(1, Math.min(200, num(req.body?.floorCount, 1)));
        const areaSqm = req.body?.areaSqm ? Math.max(1, Math.min(9999999, num(req.body.areaSqm))) : null;
        const qrSlug = await generateQrSlug();

        const inserted = await pool.query(`
            INSERT INTO kokobath_venues
                (name, type, description, floor_count, area_sqm, city, address, status, qr_slug)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
            RETURNING *
        `, [
            name,
            type,
            clean(req.body?.description, 1000) || null,
            floorCount,
            areaSqm,
            clean(req.body?.city, 120) || null,
            clean(req.body?.address, 400) || null,
            qrSlug
        ]);

        res.json({ venue: shapeVenue({ ...inserted.rows[0], fingerprint_count: 0 }) });
    } catch (err) {
        console.error('kokobath/create:', err.message);
        res.status(500).json({ error: 'تعذّر إنشاء الموقع' });
    }
};

exports.updateVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const fields = [];
        const values = [req.params.id];
        const add = (col, val) => { values.push(val); fields.push(`${col} = $${values.length}`); };

        if (req.body?.name !== undefined) {
            const name = clean(req.body.name, 160);
            if (name.length < 2) return res.status(400).json({ error: 'الاسم قصير جداً' });
            add('name', name);
        }
        if (req.body?.type !== undefined) add('type', VENUE_TYPES.has(req.body.type) ? req.body.type : 'other');
        if (req.body?.description !== undefined) add('description', clean(req.body.description, 1000) || null);
        if (req.body?.floorCount !== undefined) add('floor_count', Math.max(1, Math.min(200, num(req.body.floorCount, 1))));
        if (req.body?.areaSqm !== undefined) add('area_sqm', req.body.areaSqm ? Math.max(1, num(req.body.areaSqm)) : null);
        if (req.body?.city !== undefined) add('city', clean(req.body.city, 120) || null);
        if (req.body?.address !== undefined) add('address', clean(req.body.address, 400) || null);
        if (req.body?.status !== undefined) {
            const s = req.body.status;
            if (['pending', 'active', 'inactive', 'archived'].includes(s)) add('status', s);
        }
        if (req.body?.isPublished !== undefined) add('is_published', Boolean(req.body.isPublished));

        if (!fields.length) return res.status(400).json({ error: 'لا شيء لتعديله' });

        const updated = await pool.query(`
            UPDATE kokobath_venues
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $1 RETURNING *
        `, values);

        if (!updated.rows.length) return res.status(404).json({ error: 'لا موقع بهذا المعرّف' });

        const fpCount = await pool.query('SELECT COUNT(*) FROM kokobath_fingerprints WHERE venue_id = $1', [req.params.id]);
        res.json({ venue: shapeVenue({ ...updated.rows[0], fingerprint_count: fpCount.rows[0].count }) });
    } catch (err) {
        console.error('kokobath/update:', err.message);
        res.status(500).json({ error: 'تعذّر الحفظ' });
    }
};

exports.deleteVenue = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const done = await pool.query('DELETE FROM kokobath_venues WHERE id = $1 RETURNING id', [req.params.id]);
        if (!done.rows.length) return res.status(404).json({ error: 'لا موقع بهذا المعرّف' });

        res.json({ ok: true });
    } catch (err) {
        console.error('kokobath/delete:', err.message);
        res.status(500).json({ error: 'تعذّر الحذف' });
    }
};

// ── ٣) البصمات البصرية (Fingerprints) ───────────────────────

exports.listFingerprints = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const venueId = req.params.id;
        const venue = await pool.query('SELECT id FROM kokobath_venues WHERE id = $1', [venueId]);
        if (!venue.rows.length) return res.status(404).json({ error: 'لا موقع بهذا المعرّف' });

        const rows = await pool.query(
            'SELECT * FROM kokobath_fingerprints WHERE venue_id = $1 ORDER BY floor, captured_at DESC',
            [venueId]
        );

        res.json({ fingerprints: rows.rows.map(shapeFingerprint) });
    } catch (err) {
        console.error('kokobath/fp/list:', err.message);
        res.status(500).json({ error: 'تعذّر جلب البصمات' });
    }
};

exports.addFingerprint = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const venueId = req.params.id;
        const label = clean(req.body?.label, 200);
        if (label.length < 2) return res.status(400).json({ error: 'اسم نقطة البصمة قصير جداً' });

        const floor = Math.max(-5, Math.min(200, num(req.body?.floor, 0)));
        const posX = Math.max(-5000, Math.min(5000, num(req.body?.positionX, 0)));
        const posZ = Math.max(-5000, Math.min(5000, num(req.body?.positionZ, 0)));
        const heading = ((num(req.body?.headingDeg, 0) % 360) + 360) % 360;
        const method = ['manual', 'slam', 'lidar', 'photo'].includes(req.body?.captureMethod)
            ? req.body.captureMethod : 'manual';
        const quality = req.body?.qualityScore
            ? Math.max(0, Math.min(100, num(req.body.qualityScore))) : null;

        const inserted = await pool.query(`
            INSERT INTO kokobath_fingerprints
                (venue_id, label, floor, position_x, position_z, heading_deg,
                 descriptor_hash, thumbnail_url, capture_method, quality_score)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            RETURNING *
        `, [
            venueId,
            label,
            floor,
            posX,
            posZ,
            heading,
            clean(req.body?.descriptorHash, 512) || null,
            clean(req.body?.thumbnailUrl, 1000) || null,
            method,
            quality
        ]);

        // تحديث updated_at للموقع
        pool.query('UPDATE kokobath_venues SET updated_at = NOW() WHERE id = $1', [venueId]).catch(() => {});

        res.json({ fingerprint: shapeFingerprint(inserted.rows[0]) });
    } catch (err) {
        console.error('kokobath/fp/add:', err.message);
        res.status(500).json({ error: 'تعذّر إضافة البصمة' });
    }
};

exports.deleteFingerprint = async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'للأدمن العام وحده' });

        const done = await pool.query(
            'DELETE FROM kokobath_fingerprints WHERE id = $1 RETURNING id, venue_id',
            [req.params.fpId]
        );
        if (!done.rows.length) return res.status(404).json({ error: 'لا بصمة بهذا المعرّف' });

        pool.query('UPDATE kokobath_venues SET updated_at = NOW() WHERE id = $1', [done.rows[0].venue_id]).catch(() => {});

        res.json({ ok: true });
    } catch (err) {
        console.error('kokobath/fp/delete:', err.message);
        res.status(500).json({ error: 'تعذّر حذف البصمة' });
    }
};
