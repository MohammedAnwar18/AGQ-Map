#!/usr/bin/env node
/* ============================================================================
   PalNovaa Data API — خدمةٌ مستقلّةٌ تعمل على خادم البيانات (Hetzner)
   تخدم /api/data وحدها، بجوار PostGIS على الجهاز نفسه — فلا تمرّ الاستعلامات
   المكانيّة عبر الشبكة، ولا تُفتَح اتّصالاتُ قاعدةٍ جديدةٌ مع كلّ طلبٍ كما
   يحدث مع الدوالّ عديمة الحالة.
   المصادقة: التحقّق من JWT بالمفتاح نفسه الذي يوقّع به التطبيق الرئيس — بلا
   استعلام قاعدة، فلا حاجة لمشاركة قاعدة المستخدمين.
   ============================================================================ */
require('dotenv').config();
const express = require('express');

const app = express();
const PORT = parseInt(process.env.DATA_API_PORT, 10) || 8080;

// النطاقات المسموح لها — تُضبَط بـDATA_API_ORIGINS مفصولةً بفواصل
const ORIGINS = (process.env.DATA_API_ORIGINS || 'https://palnovaa.com,https://www.palnovaa.com')
    .split(',').map((s) => s.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);   // خلف Caddy
app.use(express.json({ limit: '4mb' }));

/* CORS يدويّ: لا نضيف اعتماديّةً لأجل بضعة رؤوس */
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = !origin || ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (allowed && origin) res.set('Access-Control-Allow-Origin', origin);
    else if (!origin) res.set('Access-Control-Allow-Origin', '*');
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});

app.get('/health', async (_req, res) => {
    try {
        const pool = require('../config/database');
        const r = await pool.query('SELECT postgis_version() v');
        const c = await pool.query(`SELECT count(*)::int n FROM geo_layers`).catch(() => ({ rows: [{ n: null }] }));
        return res.json({ ok: true, postgis: r.rows[0].v, layers: c.rows[0].n, uptime: Math.round(process.uptime()) });
    } catch (e) { return res.status(500).json({ ok: false, reason: String(e.message || e) }); }
});

app.use('/api/data', require('../routes/data'));

app.use((req, res) => res.status(404).json({ ok: false, reason: 'مسارٌ غير معروف: ' + req.path }));

const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🌍 PalNovaa Data API على 127.0.0.1:${PORT}`);
    console.log(`   النطاقات المسموحة: ${ORIGINS.join(', ')}`);
    if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET غير مضبوط — مسارات الأدمن سترفض كلّ طلب');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => { console.log(`\n${sig}: إغلاق…`); server.close(() => process.exit(0)); });
}
