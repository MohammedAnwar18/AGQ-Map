const express = require('express');
const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const pool = require('../config/database');
const { optionalAuth, authenticateToken, isAdmin } = require('../middleware/auth');
const { PutObjectCommand, DeleteObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { r2Client } = require('../config/r2');
const { detectSkills, buildSkillsContext, TEMPLATES } = require('../engine-skills');
const geojsonvt = require('geojson-vt');
const vtpbf = require('vt-pbf');
let _geotiff = null;                        // تحميل كسول (حزمة ESM) لتفادي كسر تهيئة الدالّة
async function loadGeotiff() {
    if (_geotiff) return _geotiff;
    const m = await import('geotiff');
    _geotiff = (typeof m.fromUrl === 'function') ? m
        : (m.default && typeof m.default.fromUrl === 'function') ? m.default
        : m;
    return _geotiff;
}
const router = express.Router();

/* ============================================================================
   PalNovaa Engine — محرّك بالنوفا (نظامٌ متكامل شبيهٌ بريبلت)
   ----------------------------------------------------------------------------
   يبني تطبيقات GIS من وصفٍ نصّيّ بموديل «PalNovaa 1.0»، مع:
     • ملكيّة وحماية (لا يعدّل/يحذف إلا المالك)
     • حفظ المحادثة (thread) واستعادتها
     • نُسَخ وتراجع (versions / rollback)
     • بياناتٌ حقيقيّة لكلّ تطبيق (رفع GeoJSON/CSV، تُقدَّم عبر API بـCORS)
     • نسخ المشروع (fork)
     • حدود استخدام يوميّة وتتبّع توكِنات

   المزوّد يُكتشف من بادئة المفتاح: sk-ant-→Claude (مع prompt caching)،
   sk-or-→OpenRouter، gsk_→Groq، nvapi-→NVIDIA، وإلّا Gemini.
   ============================================================================ */

const MODEL_NAME = 'PalNovaa 1.0';

const OAI_URL = (process.env.PALNOVAA_API_URL || '').trim();
const USE_OAI = !!OAI_URL;
const OAI_KEY = process.env.PALNOVAA_API_KEY || '';
const GEMINI_MODEL = process.env.PALNOVAA_MODEL || 'gemini-3.8-flash';
const OAI_MODEL = process.env.PALNOVAA_MODEL || 'deepseek/deepseek-chat-v3:free';
const ANTHROPIC_MODEL = process.env.PALNOVAA_MODEL || 'claude-sonnet-5-5';
const SERVER_KEY = process.env.PALNOVAA_MODEL_KEY || process.env.GEMINI_API_KEY || '';
const MAXTOK = parseInt(process.env.PALNOVAA_MAX_TOKENS, 10) || 16000;
// مهلة الاتّصال بالمزوّد (ms). السقف الصلب هو maxDuration في vercel.json (300s)، فنبقى تحته.
const UPSTREAM_TIMEOUT = Math.min(parseInt(process.env.PALNOVAA_TIMEOUT_MS, 10) || 280000, 295000);

/* التقنين بالكلفة الفعليّة (µ$ لكلّ توكِن) — افتراض Claude Sonnet 5.5، قابلٌ للضبط بالبيئة.
   الفكرة: كلّ مستخدمٍ على المفتاح المشترك يستهلك حتى FREE_USD مجّاناً، ثمّ يُطلَب Pro
   الذي يفتح PRO_USD. من يُحضر مفتاحه الخاصّ لا يُحسَب عليه (يستهلك من رصيده). */
const P_IN = parseFloat(process.env.PALNOVAA_PRICE_IN_U || '2');            // $2 / 1M
const P_OUT = parseFloat(process.env.PALNOVAA_PRICE_OUT_U || '10');         // $10 / 1M
const P_CR = parseFloat(process.env.PALNOVAA_PRICE_CACHE_READ_U || '0.1');  // $0.10 / 1M
const P_CW = parseFloat(process.env.PALNOVAA_PRICE_CACHE_WRITE_U || '2.5'); // $2.50 / 1M
const FREE_MICRO = Math.round(parseFloat(process.env.PALNOVAA_FREE_USD || '1') * 1e6);
const PRO_MICRO = Math.round(parseFloat(process.env.PALNOVAA_PRO_USD || '3') * 1e6);
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || '';
const GUMROAD_PRODUCT_URL = (process.env.GUMROAD_PRODUCT_URL || '').trim();
const GUMROAD_SELLER_ID = (process.env.GUMROAD_SELLER_ID || '').trim();
const GUMROAD_ACCESS_TOKEN = (process.env.GUMROAD_ACCESS_TOKEN || '').trim();

const MAX_VERSIONS = 20;
const MAX_DATASET_BYTES = 6 * 1024 * 1024;                                   // حدّ التخزين المباشر في قاعدة البيانات (رفع JSON)
const MAX_GEOJSON_BYTES = parseInt(process.env.PALNOVAA_MAX_GEOJSON, 10) || 40 * 1024 * 1024; // حدّ أقصى صارم
const MAX_GEOTIFF_BYTES = parseInt(process.env.PALNOVAA_MAX_GEOTIFF, 10) || 500 * 1024 * 1024; // GeoTIFF يُخزَّن في R2 فقط
const TILE_THRESHOLD_BYTES = parseInt(process.env.PALNOVAA_TILE_THRESHOLD, 10) || 2_500_000;  // أكبر منه → تقطيع تايلز

/* ---- التخزين على Cloudflare R2 ---- */
const R2_BUCKET = process.env.R2_BUCKET_NAME || process.env.R2_GIS_BUCKET_NAME || '';
const R2_PUBLIC_RAW = (process.env.R2_PUBLIC_URL || process.env.R2_GIS_PUBLIC_URL || '').trim();
const R2_ON = !!(R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT);
const r2Base = R2_PUBLIC_RAW
    ? (R2_PUBLIC_RAW.startsWith('http') ? R2_PUBLIC_RAW : `https://${R2_PUBLIC_RAW}`).replace(/\/+$/, '')
    : '';
const appKey = (slug) => `apps/${slug}/index.html`;

/* ---- طلب JSON عبر HTTPS ---- */
const postJSON = (url, bodyObj, headers = {}, timeoutMs = 60000) => new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    const u = new URL(url);
    const req = https.request({
        method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length, Accept: 'application/json', ...headers }
    }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; if (data.length > 20_000_000) req.destroy(); });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (res.statusCode && res.statusCode >= 400) {
                    const msg = json?.error?.message || (typeof json?.error === 'string' ? json.error : '') || `upstream ${res.statusCode}`;
                    return reject(new Error(msg));
                }
                resolve(json);
            } catch { reject(new Error(`upstream ${res.statusCode}: ${String(data).replace(/\s+/g, ' ').slice(0, 200)}`)); }
        });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
});

/* ---- حماية SSRF: منع العناوين الداخليّة ---- */
function isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
        const p = ip.split('.').map(Number);
        if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
        if (p[0] === 169 && p[1] === 254) return true;                 // link-local
        if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
        if (p[0] === 192 && p[1] === 168) return true;
        if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;    // CGNAT
        return false;
    }
    const low = (ip || '').toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd')) return true;
    if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7));
    return false;
}
async function assertPublicHttpUrl(raw) {
    let u; try { u = new URL(raw); } catch { throw new Error('رابط غير صالح'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('يُسمح بـ http(s) فقط');
    const host = u.hostname;
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('مضيفٌ محليّ غير مسموح');
    if (net.isIP(host) && isPrivateIp(host)) throw new Error('عنوانٌ داخليّ غير مسموح');
    let addrs; try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error('تعذّر حلّ اسم المضيف'); }
    for (const a of addrs) if (isPrivateIp(a.address)) throw new Error('عنوانٌ داخليّ غير مسموح');
    return u;
}
/* ---- جلب GET خام (يعيد الحالة والترويسة والجسم، لا يتبع التحويلات) ---- */
const httpGetRaw = (url, timeoutMs = 15000, maxBytes = 3_000_000) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const req = mod.request({
        method: 'GET', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
        headers: { Accept: 'application/json, */*', 'User-Agent': 'PalNovaa-Engine' }
    }, (res) => {
        let data = ''; res.setEncoding('utf8');
        res.on('data', (c) => { data += c; if (data.length > maxBytes) req.destroy(new Error('استجابةٌ كبيرةٌ جداً')); });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('مهلة الاتصال')));
    req.end();
});
/* ---- جلب لا يتبع التحويلات (لمنع تجاوز SSRF في البروكسي) ---- */
const httpGetText = async (url, timeoutMs = 15000, maxBytes = 3_000_000) => {
    const r = await httpGetRaw(url, timeoutMs, maxBytes);
    if (r.status >= 300 && r.status < 400) throw new Error('تحويلٌ غير مسموح');
    return { status: r.status, body: r.body };
};
/* ---- جلب يتبع التحويلات مع إعادة التحقّق من كلّ قفزة (آمن ضدّ SSRF) ---- */
async function httpGetFollow(startUrl, { maxRedirects = 4, timeoutMs = 30000, maxBytes = 3_000_000 } = {}) {
    let url = startUrl;
    for (let i = 0; i <= maxRedirects; i++) {
        await assertPublicHttpUrl(url);
        const r = await httpGetRaw(url, timeoutMs, maxBytes);
        if (r.status >= 300 && r.status < 400 && r.headers.location) { url = new URL(r.headers.location, url).toString(); continue; }
        return { status: r.status, body: r.body, finalUrl: url };
    }
    throw new Error('تحويلاتٌ كثيرة');
}

/* ---- ضمان وجود الجداول ---- */
let tableReady = null;
function ensureTable() {
    if (!tableReady) {
        tableReady = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_projects (
                    id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL,
                    prompt TEXT, summary TEXT, html TEXT NOT NULL, public_url TEXT,
                    owner_id INTEGER, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
                );`);
            await pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS public_url TEXT;`);
            await pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS thread JSONB;`);
            await pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS forked_from TEXT;`);
            await pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS tok_in BIGINT DEFAULT 0;`);
            await pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS tok_out BIGINT DEFAULT 0;`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_versions (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES engine_projects(id) ON DELETE CASCADE,
                    html TEXT NOT NULL, title TEXT, summary TEXT, label TEXT,
                    created_at TIMESTAMPTZ DEFAULT now()
                );`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_engine_versions_proj ON engine_versions(project_id);`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_datasets (
                    id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
                    kind TEXT NOT NULL, content TEXT, url TEXT, feature_count INTEGER DEFAULT 0,
                    owner_id INTEGER, created_at TIMESTAMPTZ DEFAULT now()
                );`);
            await pool.query(`ALTER TABLE engine_datasets ADD COLUMN IF NOT EXISTS meta JSONB;`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_quota (
                    ident TEXT NOT NULL, day DATE NOT NULL, count INTEGER DEFAULT 0,
                    tok_in BIGINT DEFAULT 0, tok_out BIGINT DEFAULT 0,
                    PRIMARY KEY (ident, day)
                );`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_accounts (
                    ident TEXT PRIMARY KEY, plan TEXT DEFAULT 'free',
                    allowance_micro BIGINT DEFAULT 1000000, used_micro BIGINT DEFAULT 0,
                    period_end TIMESTAMPTZ, paddle_sub TEXT, email TEXT,
                    updated_at TIMESTAMPTZ DEFAULT now()
                );`);
            // أعمدة تفاصيل الدفع (لصفحة إدارة الدفع)
            await pool.query(`ALTER TABLE engine_accounts ADD COLUMN IF NOT EXISTS provider TEXT;`);
            await pool.query(`ALTER TABLE engine_accounts ADD COLUMN IF NOT EXISTS price_cents INTEGER;`);
            await pool.query(`ALTER TABLE engine_accounts ADD COLUMN IF NOT EXISTS currency TEXT;`);
            await pool.query(`ALTER TABLE engine_accounts ADD COLUMN IF NOT EXISTS last_sale_at TIMESTAMPTZ;`);
            // مركز المستندات (مدوّنة + ملفّات/موارد يحرّرها الأدمن ويصل إليها المستخدمون)
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_docs (
                    id SERIAL PRIMARY KEY,
                    slug TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    excerpt TEXT,
                    cover_url TEXT,
                    body TEXT,
                    file_url TEXT,
                    file_name TEXT,
                    kind TEXT DEFAULT 'article',
                    published BOOLEAN DEFAULT true,
                    sort_order INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                );`);
        })().catch((e) => { tableReady = null; throw e; });
    }
    return tableReady;
}

const makeSlug = () => Math.random().toString(36).slice(2, 9);
const ownerOf = (req) => (req.user && (req.user.userId || req.user.id)) || null;
const identOf = (req) => {
    const o = ownerOf(req);
    if (o) return `u:${o}`;
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'anon').toString().split(',')[0].trim();
    return `ip:${ip}`;
};
const canEdit = (project, req) => {
    if (!project.owner_id) return true;            // مشروع بلا مالك (زائر/قديم)
    const o = ownerOf(req);
    return o && String(o) === String(project.owner_id);
};

/* ---- R2: نشر / حذف ---- */
async function publishToR2(slug, html) {
    if (!R2_ON) return null;
    try {
        const published = String(html).replace(/<!--PNE:[\s\S]*?-->\s*/, '');
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET, Key: appKey(slug), Body: published,
            ContentType: 'text/html; charset=utf-8', CacheControl: 'public, max-age=60'
        }));
        return r2Base ? `${r2Base}/${appKey(slug)}` : null;
    } catch (e) { console.warn('engine: R2 publish failed:', e.message); return null; }
}
async function removeFromR2(slug) {
    if (!R2_ON) return;
    try { await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: appKey(slug) })); }
    catch (e) { console.warn('engine: R2 delete failed:', e.message); }
}

/* ---- نُسَخ: لقطة قبل التغيير + تقليم ---- */
async function snapshot(projectId, label) {
    try {
        const r = await pool.query('SELECT html, title, summary FROM engine_projects WHERE id=$1', [projectId]);
        if (!r.rows.length || !r.rows[0].html) return;
        const p = r.rows[0];
        await pool.query('INSERT INTO engine_versions (project_id, html, title, summary, label) VALUES ($1,$2,$3,$4,$5)',
            [projectId, p.html, p.title, p.summary, label || null]);
        await pool.query(
            `DELETE FROM engine_versions WHERE project_id=$1 AND id NOT IN
             (SELECT id FROM engine_versions WHERE project_id=$1 ORDER BY id DESC LIMIT $2)`,
            [projectId, MAX_VERSIONS]);
    } catch (e) { console.warn('engine: snapshot failed:', e.message); }
}

/* ---- حساب الكلفة والحصص (مقنَّنٌ بالدولار الفعليّ للموديل) ---- */
function costMicro(u) { return Math.round((u?.input || 0) * P_IN + (u?.output || 0) * P_OUT + (u?.cacheRead || 0) * P_CR + (u?.cacheWrite || 0) * P_CW); }
const balanceOf = (a) => ({
    plan: a.plan,
    used_usd: +(((a.used_micro || 0) / 1e6).toFixed(4)),
    allowance_usd: +(((a.allowance_micro || 0) / 1e6).toFixed(2)),
    remaining_usd: +((Math.max(0, (a.allowance_micro || 0) - (a.used_micro || 0))) / 1e6).toFixed(4)
});
async function getAccount(ident) {
    let r = await pool.query('SELECT plan, allowance_micro, used_micro, period_end FROM engine_accounts WHERE ident=$1', [ident]);
    if (!r.rows.length) {
        await pool.query(`INSERT INTO engine_accounts (ident, plan, allowance_micro, used_micro) VALUES ($1,'free',$2,0) ON CONFLICT (ident) DO NOTHING`, [ident, FREE_MICRO]);
        r = await pool.query('SELECT plan, allowance_micro, used_micro, period_end FROM engine_accounts WHERE ident=$1', [ident]);
    }
    let a = r.rows[0] || { plan: 'free', allowance_micro: FREE_MICRO, used_micro: 0, period_end: null };
    // انتهاء اشتراك Pro → رجوعٌ لحصّة الخطّة المجانيّة
    if (a.plan === 'pro' && a.period_end && new Date(a.period_end).getTime() < Date.now()) {
        await pool.query(`UPDATE engine_accounts SET plan='free', allowance_micro=$2 WHERE ident=$1`, [ident, FREE_MICRO]);
        a = { ...a, plan: 'free', allowance_micro: FREE_MICRO };
    }
    return a;
}
async function addCost(ident, micro) { try { await pool.query('UPDATE engine_accounts SET used_micro = used_micro + $2, updated_at = now() WHERE ident=$1', [ident, micro]); } catch (e) { /* */ } }
async function recordUsage(ident, usage) {
    try {
        const tin = (usage?.input || 0) + (usage?.cacheRead || 0) + (usage?.cacheWrite || 0);
        await pool.query(
            `INSERT INTO engine_quota (ident, day, count, tok_in, tok_out) VALUES ($1, CURRENT_DATE, 1, $2, $3)
             ON CONFLICT (ident, day) DO UPDATE SET count = engine_quota.count + 1, tok_in = engine_quota.tok_in + $2, tok_out = engine_quota.tok_out + $3`,
            [ident, tin, usage?.output || 0]);
    } catch (e) { /* ignore */ }
}

/* ---- تعليمات الموديل (ثابتة → تُكاش على Claude) ---- */
const SYSTEM_INSTRUCTION = [
    'أنت «PalNovaa 1.0»، محرّكٌ خبيرٌ من الطراز الأوّل يبني تطبيقات ويب تفاعليّة كاملة الوظائف واحترافيّة.',
    'تخصّصك الأوّل: نظم المعلومات الجغرافية (GIS) والتحليل المكانيّ — لكنّك تبني أيّ تطبيق ويب: لوحات معلومات (dashboards)، تقارير بيانيّة، نماذج إدخال ومسح ميدانيّ، أنظمة إدارة سجلات (CRUD)، أدوات تحليل، دلائل تفاعليّة، محرّكات حساب، وأكثر.',
    'مهمّتك: من وصف المستخدم، تُنتج تطبيق ويب كاملاً في ملفٍ واحد (single-file HTML) جاهزاً للتشغيل فوراً دون أيّ خطوةٍ إضافيّة.',
    '',
    '— قواعد الإخراج (صارمة) —',
    '1) أخرِج مستند HTML كاملاً فقط: يبدأ بـ <!doctype html> وينتهي بـ </html>. لا شرح ولا نصّ قبله ولا بعده، ولا تضعه داخل أسوار ```.',
    '2) اكتب الكود كاملاً فعليّاً. ممنوع منعاً باتّاً ترك عناصر نائبة مثل «... بقيّة الكود» أو دوالّ فارغة. كلّ دالّة مُنفَّذة بالكامل، وكلّ زرّ موصولٌ بوظيفةٍ حقيقيّة.',
    '3) ملفٌ واحد مكتفٍ ذاتيّاً: كلّ الـCSS و JavaScript داخل الصفحة. لا ملفات خارجيّة سوى مكتبات CDN مثبّتة الإصدار من cdnjs.cloudflare.com.',
    '4) في أوّل سطرٍ بعد <!doctype html> ضع تعليقاً واحداً بهذا الشكل بالضبط: <!--PNE:{"title":"عنوان قصير للمشروع","summary":"جملة تصف ما بُني"}-->',
    '5) اجعل <title> مطابقاً للعنوان.',
    '6) على وسوم <link> و<script> للمكتبات: استخدم رابط الـsrc/href فقط. ممنوع منعاً باتّاً إضافة سمة integrity أو أيّ بصمة SRI (sha256/sha384/sha512) أو crossorigin — لا تعرف البصمة الصحيحة وستكسر التحميل أو تدخل في حلقة تكرار. اكتب <link rel="stylesheet" href="..."> و<script src="..."></script> بلا سمات أخرى.',
    '7) لا تكرّر أيّ نصّ أو سطر أو سمة أكثر من مرّة بلا داعٍ، ولا تولّد سلاسل عشوائيّة طويلة إطلاقاً.',
    '',
    '— المكتبات المتاحة (CDN مثبّت — استخدم حسب الحاجة فقط) —',
    '• Leaflet 1.9.4 — خرائط تفاعليّة (leaflet.css + leaflet.js)',
    '• Turf.js 6.5.0 — تحليل مكانيّ (buffer, area, centroid, distance, union, intersect, voronoi, bbox)',
    '• Chart.js 4.4.1 — رسوم بيانيّة (bar, line, pie, doughnut, radar, scatter, polarArea, bubble, mixed)',
    '• Leaflet.Draw 1.0.4 — رسم/تعديل أشكال (css+js)',
    '• Leaflet.MarkerCluster 1.5.3 — تجميع العلامات (css+js)',
    '• Leaflet.heat 0.2.0 — خرائط حراريّة',
    '• html2canvas 1.4.1 + jsPDF 2.5.1 — تصدير صور وPDF',
    '• Papa Parse 5.4.1 — تحليل/تصدير CSV',
    '• Flatpickr 4.6.13 — منتقي تاريخ (css+js)',
    '• SortableJS 1.15.0 — سحب وإفلات',
    '• esri-leaflet 3.0.12 — استهلاك خدمات ArcGIS REST (MapServer/FeatureServer/ImageServer) على خريطة Leaflet',
    '• Leaflet.VectorGrid 1.3.0 — عرض التايلز المتّجهة (MVT) للبيانات الكبيرة. من jsDelivr فقط: <script src="https://cdn.jsdelivr.net/npm/leaflet.vectorgrid@1.3.0/dist/Leaflet.VectorGrid.bundled.js"></script>',
    '• georaster + georaster-layer-for-leaflet — عرض صور GeoTIFF النقطيّة على Leaflet. من jsDelivr: georaster@1.6.0/dist/georaster.browser.bundle.min.js ثمّ georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js. تعرض حسب التكبير وتدعم COG بطلبات النطاق.',
    'استخدم فقط المكتبات التي يحتاجها التطبيق فعلاً — ابدأ بالمكتبات أعلاه من cdnjs.cloudflare.com بإصدارٍ مثبّت (باستثناء Leaflet.VectorGrid و georaster فمن cdn.jsdelivr.net بالروابط أعلاه حرفيّاً).',
    'مكتبات إضافيّة عند الحاجة: إن لزمت قدرةٌ لا تغطّيها المكتبات أعلاه، يمكنك استيراد أيّ حزمة npm متوافقةٍ مع المتصفّح كـES Module من esm.sh بإصدارٍ مثبّت داخل <script type="module">، مثال: import confetti from "https://esm.sh/canvas-confetti@1.9.3"; استعمل esm.sh فقط للحزم المتوافقة مع المتصفّح (لا حزم Node)، ثبّت الإصدار دائماً، وعالِج فشل التحميل بلطفٍ ببديلٍ بسيط. فضّل مكتبات cdnjs أوّلاً لأنّها أثبت.',
    '',
    '— الخرائط والتحليل المكانيّ (تخصّصك الأوّل) —',
    '• استخدم Leaflet 1.9.4 من cdnjs: ضمّن leaflet.css و leaflet.js.',
    "• بلاط الخريطة الأساس (المفضّل، مجّانيّ بلا مفتاح من Esri — استخدمه افتراضيّاً في أيّ خريطة فيها طبقة بيانات): صور الأقمار الصناعيّة L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'Esri'}). وخريطة الشوارع L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {maxZoom:19}). أضِف الاثنتين في L.control.layers للتبديل بينهما. (بديلٌ اختياريّ: خرائط Google عبر L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3'], maxZoom:20}).)",
    '• هيّئ الخريطة بعد تحميل DOM، واضبط setView على منطقةٍ منطقيّة (فلسطين/الضفة: [31.95,35.23] zoom 9).',
    '• لا تستخدم أيّ خدمةٍ تتطلّب مفتاح API. للترميز الجغرافيّ استخدم Nominatim العامّ باعتدال.',
    '',
    '— البيانات والموصّلات —',
    '• إن زُوِّدت بروابط بياناتٍ حقيقيّة (datasets) فاجلبها فعليّاً عبر fetch واعرضها، وعالِج الفشل بلُطف (رسالة + زرّ إعادة).',
    '• إن لم تُزوَّد ببيانات: ولّد بياناتٍ تجريبيّة واقعيّة ومتنوّعة مناسبة للسياق بأسماءٍ عربيّة صحيحة.',
    '• موصّلات مجّانيّة بلا مفتاح: OpenStreetMap Overpass API (amenities, buildings, roads)، Open-Meteo (طقس)، Open-Elevation، Nominatim (ترميز جغرافيّ).',
    '• خدمات ArcGIS REST (مثل GeoMOLG الفلسطينيّ): الطريقة الموثوقة هي استعلام الطبقة كـGeoJSON (نقطة query تدعم CORS وتعيد الإسقاط إلى 4326): fetch("<svc>/<MapServer|FeatureServer>/<layerId>/query?where=1=1&outFields=*&outSR=4326&returnGeometry=true&f=geojson&resultRecordCount=4000") ثمّ L.geoJSON(data,{style,pointToLayer:circleMarker,onEachFeature:bindPopup}).addTo(map) وmap.fitBounds. تجنّب esri featureLayer وdynamicMapLayer الافتراضيّ (f:json) لأنّ نقطة export في هذه الخوادم بلا CORS فتظهر فارغة؛ للطبقات النقطيّة التي لا تدعم query فقط استعمل L.esri.dynamicMapLayer({url,f:"image",useCors:false}).',
    '• لوّن الطبقات المكانيّة ترميزاً متدرّجاً (choropleth) وأضِف popup لخصائص كلّ عنصر.',
    '',
    '— الواجهة والتصميم (أنت خبير واجهات من الطراز الأوّل — طبّق هذه الأصول في كلّ مُخرَج بلا استثناء) —',
    '• نظام تصميم موحّد: عرّف كلّ الألوان والمسافات والخطوط والظلال والحواف كمتغيّرات CSS في :root (مصدر حقيقةٍ واحد)، واستعملها في كلّ مكان بدل القيم المبعثرة.',
    '• مقياس المسافات (شبكة 4/8): استعمل مضاعفات 4px فقط — 4·8·12·16·24·32·48·64. ابدأ بمسافاتٍ سخيّة ثمّ قلّل؛ الفراغ الأبيض الوافر (داخل العناصر وبينها) هو أكبر فارقٍ بين تصميمٍ هاوٍ ومحترف. padding البطاقات ≥20px، الفجوات بين الأقسام ≥32px.',
    '• التدرّج الطباعيّ (type scale): 12·14·16·20·24·30·36·48. جسم النصّ 15–16px، سطرٌ 1.5–1.7 للنصّ و1.15–1.25 للعناوين. ابنِ التسلسل بالوزن واللون لا بالحجم وحده: عنوانٌ 600–700 بلونٍ قويّ، وثانويّ بلونٍ أخفت وحجمٍ مقارب. خطّ نصٍّ واحد نظيف (system-ui أو Inter من Google Fonts)؛ تجنّب الخطوط العموميّة الباهتة.',
    '• اللون (أضِفه أخيراً): ابنِ الهيكل والتسلسل بالمسافة والتباين والوزن أوّلاً، ثمّ لوّن. لوحةٌ منضبطة بـHSL: سلسلة رماديّات متدرّجة (≈8–10 درجات) + لونٌ أساسٌ بدرجاته + لون تمييزٍ واحد #E07B39 يُستعمَل بقلّةٍ لنقاط الفعل فقط + ألوان دلاليّة (نجاح #3DB37E، تحذير #E0A33E، خطأ #E0574B، معلومة #4C8DE0).',
    '• التباين (WCAG AA إلزاميّ): نصّ عاديّ ≥4.5:1، كبير/عناصر ≥3:1. النصّ الثانويّ يخفت باللون لا بحجمٍ غير مقروء. لا تضع رماديّاً فاتحاً على أبيض.',
    '• العمق والفصل: ظلالٌ خفيفةٌ متدرّجة (طبقتان ناعمتان) للارتفاع، وحدود 1px خافتة. افصل الأسطح بالخلفيّة/الظلّ لا بالحدود الثقيلة. لا ظلالٌ سوداء فجّة.',
    '• التركيز البصريّ: نقطةٌ واحدة بارزة لكلّ شاشة، وأبرِزها «بتخفيت» ما حولها بدل تضخيمها. حاذِ كلّ شيءٍ على الشبكة بدقّة؛ المحاذاة غير الدقيقة تُفسد الانطباع فوراً.',
    '• الأزرار والحقول: ارتفاعٌ مريح ≥40px، حالاتٌ واضحة hover/focus/active/disabled، حلقة :focus-visible ظاهرة، وانتقالات 150–200ms. الأساس ممتلئ، والثانويّ شبح/حدّ. الحقول بحدٍّ واضحٍ وlabel ومسافةٍ مريحة.',
    '• الاتّساق: نفس نصف القطر في كلّ مكان (8–12px)، طقم أيقونات SVG واحد (stroke 1.5–2، مقاسٌ موحّد)، نمطٌ واحدٌ للبطاقات والجداول.',
    '• الحالات الكاملة (لا تهملها): فراغٌ أنيق (رسمة بسيطة + رسالة + زرّ إجراء)، تحميل (skeleton/spinner)، خطأ برسالةٍ وإعادة، ونجاح (toast). لا شاشة فارغةٌ بلا توجيه.',
    '• حركةٌ بذوق: انتقالاتٌ لطيفةٌ عند hover والظهور، مع احترام prefers-reduced-motion.',
    '• متجاوبٌ بالكامل: الجوّال أوّلاً، breakpoint ≤768px، أهداف لمسٍ ≥44px، بلا تمرير أفقيّ.',
    '• الوضع الافتراضيّ: داكنٌ أنيق عبر المتغيّرات — خلفيّة #0A0B0D، سطوح #12151A/#1A1E24، حدود #2B3038، نصّ #C8CDD4 وثانويّ #8A9099، تمييز #E07B39. واجهةٌ عربيّة RTL. إن ناسب السياق قدّم وضعاً فاتحاً نظيفاً بنفس المنظومة.',
    '• عناصر متخصّصة: بطاقات KPI (أيقونة + قيمة بارزة + تغيّر ↑↓ ملوّن)، ومفتاح ألوان (legend) أنيق لكلّ خريطة.',
    '',
    '— إمكانيّات عامّة (طبّقها حين يناسب الطلب) —',
    '• CRUD: حفظ/تعديل/حذف عبر localStorage + crypto.randomUUID(). نسخة احتياطيّة JSON.',
    '• جداول: ترتيب بالنقر (▲▼)، بحث/فلترة فوري، ترقيم صفحات، header ثابت.',
    '• نماذج: تحقّق عربيّ (required+pattern)، أخطاء أسفل الحقل، نماذج متعدّدة الخطوات.',
    '• تصدير: CSV (Blob+BOM)، GeoJSON، PNG (html2canvas)، PDF (jsPDF)، طباعة (@media print).',
    '• لوحات معلومات: بطاقات KPI (أيقونة+قيمة+تغيّر↑↓)، مخطّطات Chart.js، جداول، فلاتر.',
    '• تخطيط: تبويبات، شريط جانبيّ طيّ، modal، toast، accordion، بطاقات grid.',
    '',
    '— الجودة —',
    '• نفّذ أفضل تصميمٍ وميزاتٍ للطلب بإتقان. الكود سليمٌ متماسكٌ خالٍ من الأخطاء.',
    '• لا متغيّرات غير معرّفة. ترتيب تحميل صحيح للمكتبات. min-height:100vh. لا شريط تمرير أفقيّ.',
    '• كلّ عنصرٍ تفاعليّ يعمل فعلاً: أزرار، فلاتر، بحث، ترتيب، تبويبات.',
    '',
    'عند التعديل على تطبيقٍ قائم: أعِد إخراج المستند الكامل بعد تطبيق التغيير المطلوب فقط، محافظاً على بقيّة الكود والميزات كما هي.'
].join('\n');

/* ---- استخلاص HTML + العنوان + الموجز ---- */
function parseGenerated(text, fallbackPrompt) {
    let html = (text || '').trim();
    html = html.replace(/```html/gi, '').replace(/```/g, '').replace(/\s*تمّ?\.?\s*$/i, '').trim();
    const di = html.toLowerCase().indexOf('<!doctype');
    const hi = html.toLowerCase().indexOf('<html');
    const start = di >= 0 ? di : hi;
    if (start > 0) html = html.slice(start);
    const endIdx = html.toLowerCase().lastIndexOf('</html>');
    if (endIdx >= 0) html = html.slice(0, endIdx + 7);

    let title = null, summary = null;
    const meta = html.match(/<!--PNE:(\{[\s\S]*?\})-->/);
    if (meta) { try { const j = JSON.parse(meta[1]); title = j.title || null; summary = j.summary || null; } catch { /* */ } }
    if (!title) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); if (t) title = t[1].trim(); }
    if (!title) title = (fallbackPrompt || 'تطبيق GIS').slice(0, 60);
    if (!summary) summary = (fallbackPrompt || '').slice(0, 160);
    return { html, title, summary };
}

/* ---- التعديل بالفروقات (SEARCH/REPLACE): أسرع وأرخص وأأمن من إعادة التوليد الكامل ---- */
function extractMeta(html) {
    const m = (html || '').match(/<!--PNE:(\{[\s\S]*?\})-->/);
    if (m) { try { const j = JSON.parse(m[1]); return { title: j.title || null, summary: j.summary || null }; } catch { /* */ } }
    const t = (html || '').match(/<title>([\s\S]*?)<\/title>/i);
    return { title: t ? t[1].trim() : null, summary: null };
}
function parseSearchReplace(text) {
    const blocks = [];
    const re = /<{5,9}\s*SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9}\s*REPLACE/g;
    let m;
    while ((m = re.exec(text || ''))) blocks.push({ search: m[1], replace: m[2] });
    return blocks;
}
function applyOneEdit(html, search, replace) {
    if (!search) return null;
    if (html.includes(search)) return html.replace(search, () => replace);           // مطابقةٌ حرفيّة
    if (search.length < 4000) {                                                        // مطابقةٌ متسامحةٌ مع المسافات (محدودةٌ للأداء)
        const esc = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        try { const rx = new RegExp(esc); if (rx.test(html)) return html.replace(rx, () => replace); } catch { /* */ }
    }
    return null;
}
// يقرّر تلقائياً: كتل فروقات → يطبّقها على الكود الحاليّ؛ وإلّا مستندٌ كامل كالمعتاد
function applyEdits(text, currentHtml, fallbackPrompt) {
    const blocks = parseSearchReplace(text);
    if (blocks.length && currentHtml) {
        let html = currentHtml, applied = 0;
        for (const b of blocks) { const r = applyOneEdit(html, b.search, b.replace); if (r !== null) { html = r; applied++; } }
        if (applied > 0) {
            const meta = extractMeta(html);
            const cur = extractMeta(currentHtml);
            return { html, title: meta.title || cur.title || (fallbackPrompt || '').slice(0, 60), summary: meta.summary || cur.summary || '', mode: 'diff', applied, total: blocks.length };
        }
    }
    return { ...parseGenerated(text, fallbackPrompt), mode: 'full' };
}

/* ---- وصف بنية مجموعة بيانات (لتوجيه الموديل) ---- */
function datasetSchema(kind, content) {
    try {
        if (kind === 'geojson') {
            const j = JSON.parse(content);
            const f = (j.features && j.features[0]) || (j.type === 'Feature' ? j : null);
            const keys = f && f.properties ? Object.keys(f.properties).slice(0, 12) : [];
            const geom = f && f.geometry ? f.geometry.type : 'Geometry';
            return `هندسة: ${geom} · حقول: ${keys.join(', ') || '—'}`;
        }
        if (kind === 'csv') {
            const header = (content.split(/\r?\n/)[0] || '').slice(0, 300);
            return `أعمدة: ${header}`;
        }
    } catch { /* */ }
    return '';
}
function countFeatures(kind, content) {
    try {
        if (kind === 'geojson') { const j = JSON.parse(content); return Array.isArray(j.features) ? j.features.length : (j.type === 'Feature' ? 1 : 0); }
        if (kind === 'csv') { return Math.max(0, content.split(/\r?\n/).filter((l) => l.trim()).length - 1); }
    } catch { /* */ }
    return 0;
}

/* ---- تحليل GeoJSON بدقّة (نوع، عدد، أنواع الهندسة، النطاق، الحقول، الإسناد) ---- */
function updateBbox(coords, bb) {
    if (typeof coords[0] === 'number') {
        const x = coords[0], y = coords[1];
        if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y;
        if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
        return;
    }
    for (const c of coords) updateBbox(c, bb);
}
function analyzeGeoJSON(content) {
    let j; try { j = JSON.parse(content); } catch { throw new Error('الملفّ ليس JSON صالحاً.'); }
    let features;
    if (j && j.type === 'FeatureCollection' && Array.isArray(j.features)) features = j.features;
    else if (j && j.type === 'Feature') features = [j];
    else if (j && typeof j.type === 'string' && j.coordinates) features = [{ type: 'Feature', geometry: j, properties: {} }];
    else throw new Error('ليس GeoJSON صالحاً — المتوقّع FeatureCollection أو Feature أو Geometry.');
    const geometryTypes = {}; const propKeys = new Set(); const bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const f of features) {
        const g = f && f.geometry;
        if (g && g.type) { geometryTypes[g.type] = (geometryTypes[g.type] || 0) + 1; if (g.coordinates) { try { updateBbox(g.coordinates, bb); } catch { /* */ } } }
        if (f && f.properties) for (const k of Object.keys(f.properties)) { if (propKeys.size < 60) propKeys.add(k); }
    }
    let crsWarning = null;
    const crsName = j.crs && j.crs.properties && j.crs.properties.name;
    if (crsName && !/CRS84|:4326/i.test(crsName)) crsWarning = crsName;
    return {
        valid: true, type: j.type, featureCount: features.length,
        geometryTypes, propertyKeys: [...propKeys],
        bbox: bb[0] === Infinity ? null : bb.map((n) => +n.toFixed(6)),
        crsWarning
    };
}

/* ---- تخزين مجموعة بيانات (تحليل + تقرير التقطيع + حفظ + R2) ---- */
async function createDatasetFromContent({ name, kind, content, ownerId, skipR2 = false, publicUrl = null, slug = null }) {
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_GEOJSON_BYTES) { const e = new Error(`الملفّ كبيرٌ جداً (الحدّ ${Math.floor(MAX_GEOJSON_BYTES / 1048576)}MB).`); e.code = 413; throw e; }
    let meta = { bytes }; let count = 0;
    if (kind === 'geojson') { const a = analyzeGeoJSON(content); count = a.featureCount; meta = { ...a, bytes }; }
    else count = countFeatures(kind, content);
    const tiled = kind === 'geojson' && bytes > TILE_THRESHOLD_BYTES && count > 0;
    meta.tiled = tiled; if (tiled) meta.layer = 'data';

    let saved = null, useSlug = slug || makeSlug();
    const attempts = slug ? 1 : 5;   // سلاگ صريح (من presign): لا تولّد بديلاً
    for (let i = 0; i < attempts; i++) {
        try {
            const r = await pool.query(
                `INSERT INTO engine_datasets (slug, name, kind, content, feature_count, owner_id, meta, url)
                 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id, slug, name, kind, feature_count, meta, url, created_at`,
                [useSlug, name, kind, content, count, ownerId, JSON.stringify(meta), publicUrl]
            );
            saved = r.rows[0]; break;
        } catch (e) { if (/unique/i.test(e.message) && !slug) { useSlug = makeSlug(); continue; } throw e; }
    }
    if (!saved) throw new Error('slug conflict');
    if (!skipR2 && R2_ON) {
        try {
            const ext = kind === 'geojson' ? 'geojson' : 'csv';
            await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: `data/${useSlug}.${ext}`, Body: content, ContentType: kind === 'geojson' ? 'application/geo+json' : 'text/csv' }));
            if (r2Base) { const u = `${r2Base}/data/${useSlug}.${ext}`; await pool.query(`UPDATE engine_datasets SET url=$1 WHERE slug=$2`, [u, useSlug]); saved.url = u; }
        } catch { /* */ }
    }
    return saved;
}

/* ---- تقطيع التايلز المتّجهة (geojson-vt + vt-pbf) مع تخزينٍ مؤقّت للفهرس ---- */
const tileCache = new Map();                 // slug -> { index, ts }
const TILE_CACHE_MAX = 4;
async function getTileIndex(slug) {
    const hit = tileCache.get(slug);
    if (hit) { hit.ts = Date.now(); return hit; }
    const r = await pool.query('SELECT content, kind FROM engine_datasets WHERE slug=$1', [slug]);
    if (!r.rows.length || r.rows[0].kind !== 'geojson' || !r.rows[0].content) return null;
    let gj; try { gj = JSON.parse(r.rows[0].content); } catch { return null; }
    const index = geojsonvt(gj, { maxZoom: 20, tolerance: 3, extent: 4096, buffer: 64, indexMaxZoom: 5, indexMaxPoints: 100000 });
    const entry = { index, ts: Date.now() };
    tileCache.set(slug, entry);
    if (tileCache.size > TILE_CACHE_MAX) {
        let oldest = null;
        for (const [k, v] of tileCache) if (!oldest || v.ts < oldest[1].ts) oldest = [k, v];
        if (oldest) tileCache.delete(oldest[0]);
    }
    return entry;
}

/* ---- تحليل GeoTIFF (نقطيّ): الأبعاد، النطاقات، النطاق المكانيّ، الإسناد ---- */
async function analyzeGeoTIFF(url, bytes) {
    const geotiff = await loadGeotiff();
    const tiff = await geotiff.fromUrl(url);                 // يقرأ الترويسة عبر طلبات نطاق (بلا تنزيل كامل)
    const image = await tiff.getImage();
    const width = image.getWidth(), height = image.getHeight();
    const bands = image.getSamplesPerPixel();
    let bbox = null; try { bbox = image.getBoundingBox(); } catch { /* */ }
    let resolution = null; try { resolution = image.getResolution(); } catch { /* */ }
    const gk = image.getGeoKeys() || {};
    const epsg = gk.ProjectedCSTypeGeoKey || gk.GeographicTypeGeoKey || null;
    let nodata = null; try { const fd = image.getFileDirectory(); if (fd && fd.GDAL_NODATA != null) nodata = parseFloat(fd.GDAL_NODATA); } catch { /* */ }
    return {
        raster: true, width, height, bands,
        bbox: bbox ? bbox.map((n) => +Number(n).toFixed(6)) : null,
        resolution: resolution ? resolution.map((n) => +Number(n).toFixed(8)) : null,
        epsg, nodata, bytes: bytes || null
    };
}

/* ---- بناء نصّ حقن مصادر البيانات المرفقة في البرومبت ---- */
function buildDatasetInjection(rows, origin) {
    let hasArc = false, hasTiles = false, hasRaster = false;
    const lines = rows.map((d) => {
        const meta0 = d.meta && typeof d.meta === 'object' ? d.meta : (() => { try { return JSON.parse(d.meta || '{}'); } catch { return {}; } })();
        if (d.kind === 'geotiff') {
            hasRaster = true;
            const dims = meta0.width && meta0.height ? `${meta0.width}×${meta0.height}px` : '';
            const epsg = meta0.epsg ? `EPSG:${meta0.epsg}` : 'إسناد غير معروف';
            return `• «${d.name}» — صورة GeoTIFF نقطيّة (${dims}، ${meta0.bands || '?'} نطاق، ${epsg}) — الرابط: ${d.url || ''}. اعرضها عبر georaster + georaster-layer-for-leaflet: parseGeoraster("${d.url || ''}").then(g=>{const layer=new GeoRasterLayer({georaster:g,opacity:0.9,resolution:256});layer.addTo(map);map.fitBounds(layer.getBounds());}). المكتبة تعرض حسب التكبير (تبليط فعليّ) وتعيد الإسقاط${meta0.epsg && meta0.epsg !== 4326 ? ' (تحتاج proj4 للإسناد غير 4326)' : ''}. لا تجلب الملفّ بـfetch كامل.`;
        }
        if (d.kind === 'arcgis') {
            hasArc = true;
            let meta = {}; try { meta = JSON.parse(d.content || '{}'); } catch { /* */ }
            const u = meta.serviceUrl || '';
            const t = meta.serviceType || 'MapServer';
            const ids = (meta.layers || []).map((l) => l.id);
            const ls = (meta.layers || []).map((l) => `${l.id}:${l.name}${l.geometryType ? ` (${l.geometryType})` : ''}`).join('، ') || '—';
            const sample = ids.length ? ids[0] : 0;
            return `• خادم ArcGIS REST «${d.name}» (${t}) — رابط الخدمة: ${u} — الطبقات [${ls}]. `
                + `اعرضها فعلاً على الخريطة بالطريقة الموثوقة التالية (استعلام query يدعم CORS، بخلاف export): لكلّ طبقة من المعرّفات [${ids.join(', ')}] نفّذ:\n`
                + `fetch("${u}/${t}/${sample}/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=geojson&resultRecordCount=4000").then(r=>r.json()).then(gj=>{ const lyr=L.geoJSON(gj,{style:{color:"#E07B39",weight:1.5,fillColor:"#E07B39",fillOpacity:0.2}, pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:5,color:"#E07B39",fillColor:"#F0954F",fillOpacity:0.85,weight:1}), onEachFeature:(f,l)=>{ if(f.properties) l.bindPopup(Object.entries(f.properties).slice(0,12).map(([k,v])=>"<b>"+k+"</b>: "+v).join("<br>")); }}).addTo(map); try{ map.fitBounds(lyr.getBounds()); }catch(e){} }).catch(()=>{});\n`
                + `بدّل رقم الطبقة لكلّ معرّف. إن أعاد الاستعلام خطأً (طبقة نقطيّة/أورثوفوتو لا تدعم query) استعمل صورة فقط: L.esri.dynamicMapLayer({url:"${u}/${t}", f:"image", useCors:false, opacity:0.85}).addTo(map). مهمّ: لا تستعمل L.esri.featureLayer ولا dynamicMapLayer الافتراضيّ (f:json) لأنّ هذا الخادم بلا CORS على export فتظهر الطبقة فارغة. استخدم الرابط حرفيّاً.`;
        }
        const meta = d.meta && typeof d.meta === 'object' ? d.meta : (() => { try { return JSON.parse(d.meta || '{}'); } catch { return {}; } })();
        if (d.kind === 'geojson' && meta.tiled) {
            hasTiles = true;
            const gtypes = Object.keys(meta.geometryTypes || {}).join('، ') || 'غير معروف';
            const keys = (meta.propertyKeys || []).slice(0, 20).join('، ') || '—';
            const center = meta.bbox ? `مركز العرض ~[${((meta.bbox[1] + meta.bbox[3]) / 2).toFixed(4)}, ${((meta.bbox[0] + meta.bbox[2]) / 2).toFixed(4)}] (lat,lon)` : '';
            return `• «${d.name}» — GeoJSON كبير (${d.feature_count} عنصراً، هندسة: ${gtypes}) مُقسَّم إلى تايلز متّجهة. استهلكه عبر Leaflet.VectorGrid.Protobuf من قالب الرابط: "${origin}/api/engine/datasets/${d.slug}/tiles/{z}/{x}/{y}.pbf". اسم الطبقة داخل التايل: "data". الحقول: [${keys}]. ${center}. لا تجلب الملفّ كاملاً — استعمل التايلز فقط للأداء.`;
        }
        return `• «${d.name}» — ${String(d.kind).toUpperCase()} — ${d.feature_count || countFeatures(d.kind, d.content || '')} عنصراً — اجلبها بـ fetch("${origin}/api/engine/datasets/${d.slug}/data") — ${datasetSchema(d.kind, d.content || '')}`;
    });
    return '\n\n[مصادر بياناتٍ حقيقيّة مرفقة — استخدمها فعليّاً وقت التشغيل بدل أيّ بياناتٍ تجريبيّة:\n'
        + lines.join('\n')
        + '\nملاحظة: روابط الرفع والتايلز تدعم CORS. '
        + (hasArc ? 'لطبقات ArcGIS: استعمل استعلام query?f=geojson&outSR=4326 (يدعم CORS ويعيد الإسقاط) وارسمها بـL.geoJSON، ولا تعتمد على esri featureLayer/export الافتراضيّ. ضمّن Leaflet. اجعل الطبقات ظاهرة فعلاً وكبّر الخريطة على نطاقها. ' : '')
        + (hasTiles ? 'للبيانات المُقسَّمة تايلز: ضمّن Leaflet أوّلاً ثمّ VectorGrid، واستعمل L.vectorGrid.protobuf(قالب_الرابط,{vectorTileLayerStyles:{data:{...}},interactive:true,maxNativeZoom:20}).addTo(map) وbindPopup من خصائص الميزة. ' : '')
        + (hasRaster ? 'لصور GeoTIFF: ضمّن <script src="https://cdn.jsdelivr.net/npm/georaster@1.6.0/dist/georaster.browser.bundle.min.js"></script> ثمّ <script src="https://cdn.jsdelivr.net/npm/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js"></script> بعد leaflet.js، و(للإسناد غير 4326) proj4 من cdnjs. ' : '')
        + 'اعرض البيانات فعلاً على الخريطة وعالِج فشل الجلب برسالةٍ واضحة وزرّ إعادة.]';
}

/* ---- المزوّد ---- */
function pickProvider(KEY) {
    const k = (KEY || '').trim();
    const envM = (process.env.PALNOVAA_MODEL || '').trim();
    // يُستخدَم موديل البيئة فقط إن ناسب المزوّد، وإلّا موديلٌ افتراضيٌّ صالح — فيعمل أيّ مفتاحٍ مجّانيّ بمجرّد لصقه
    const pick = (re, def) => (envM && re.test(envM) ? envM : def);
    if (k.startsWith('sk-ant-')) return { kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages', model: pick(/claude/i, 'claude-sonnet-5-5') };
    if (USE_OAI) return { kind: 'oai', url: OAI_URL, model: OAI_MODEL };
    if (k.startsWith('sk-or-')) return { kind: 'oai', url: 'https://openrouter.ai/api/v1/chat/completions', model: pick(/\//, 'deepseek/deepseek-chat-v3-0324:free') };
    if (k.startsWith('gsk_')) return { kind: 'oai', url: 'https://api.groq.com/openai/v1/chat/completions', model: pick(/llama|mixtral|gemma|qwen|deepseek|gpt-oss/i, 'openai/gpt-oss-120b') };
    if (k.startsWith('nvapi-')) return { kind: 'oai', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: pick(/\//, 'deepseek-ai/deepseek-v4.1-flash') };
    return { kind: 'gemini', url: '', model: pick(/gemini/i, 'gemini-2.0-flash') };
}

const CONTINUE_MSG = 'أكمل بقيّة الكود من حيث توقّفت بالضبط (حرفٌ بحرف)، بلا إعادة أيّ جزءٍ سابق وبلا أيّ شرح. إن كان المستند قد اكتمل بـ</html> فاكتب "تمّ".';

// يُلحَق برسالة «التطبيق الحاليّ» عند التعديل — يطلب فروقات SEARCH/REPLACE للتعديلات الموضعيّة بدل إعادة الملفّ كاملاً
const EDIT_HINT = '\n\n[طريقة التعديل — مهمّة]\nللتعديلات الموضعيّة على هذا التطبيق، لا تُعِد كتابة الملفّ كاملاً؛ أخرِج فقط التغييرات ككتلٍ بهذا الشكل الحرفيّ (يمكن أكثر من كتلة):\n<<<<<<< SEARCH\n(انسخ المقطع الأصليّ من الكود أعلاه حرفيّاً كما هو تماماً — بما في ذلك المسافات — وبما يكفي ليكون فريداً)\n=======\n(المقطع الجديد البديل)\n>>>>>>> REPLACE\nانسخ مقطع SEARCH بدقّةٍ تامّة من الكود الموجود، ولا تضع أيّ شرحٍ خارج الكتل. استثناء وحيد: إن كان التعديل جذريّاً وواسعاً جداً فأخرِج المستند كاملاً من <!doctype html> حتى </html> كالمعتاد.';
const looksComplete = (s) => /<\/html>\s*$/i.test((s || '').trim());
// كشف حلقة التكرار (سلسلة طويلة بلا فراغات = بصمة SRI عشوائيّة أو تكرار منحرف)
const looksLooped = (s) => /\S{2800,}/.test(s || '');
const blankUsage = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/* ---- تصميم مرجعيّ (design-to-code): صورة شاشة أو SVG مُصدَّر من Penpot ---- */
const DESIGN_IMG_NOTE = 'مرفقٌ تصميمٌ مرجعيّ (صورة). طابِق الناتج لهذا التصميم بأمانة: التخطيط العامّ، التسلسل البصريّ، لوحة الألوان، المسافات والحواف، الأزرار والحقول، أحجام الخطوط، والمكوّنات ومواضعها. اجعل الواجهة responsive ونظيفة وحديثة؛ وإن تعذّر عنصرٌ فأقرب بديلٍ ممكن.';
const DESIGN_SVG_NOTE = 'مرفقٌ تصميمٌ مرجعيّ بصيغة SVG (تصدير Penpot أو أداة تصميم). حلّل بنيته: الإطارات والنصوص والألوان (fill/stroke) والإحداثيّات والأحجام، واستخرج منه التخطيط والهويّة البصريّة وطابِقها بدقّة في تطبيق HTML/CSS حديث responsive.';
function validDesign(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.kind === 'svg' && typeof d.svg === 'string' && d.svg.includes('<svg')) return { kind: 'svg', svg: d.svg.slice(0, 1600000) };
    if (d.kind === 'image' && typeof d.data === 'string') {
        const raw = (d.mediaType || '').toLowerCase();
        const mt = /^image\/(png|jpeg|jpg|webp|gif)$/.test(raw) ? (raw === 'image/jpg' ? 'image/jpeg' : raw) : 'image/png';
        const base64 = d.data.replace(/^data:[^,]+,/, '').slice(0, 7000000);
        if (base64.length < 32) return null;
        return { kind: 'image', mediaType: mt, base64 };
    }
    return null;
}
const svgBlock = (note, svg, prompt) => `${note}\n\nالتصميم (SVG):\n\`\`\`svg\n${svg}\n\`\`\`\n\nالمطلوب:\n${prompt}`;
function anthroUser(prompt, design) {
    if (!design) return prompt;
    if (design.kind === 'svg') return svgBlock(DESIGN_SVG_NOTE, design.svg, prompt);
    return [
        { type: 'image', source: { type: 'base64', media_type: design.mediaType, data: design.base64 } },
        { type: 'text', text: `${DESIGN_IMG_NOTE}\n\nالمطلوب:\n${prompt}` },
    ];
}
function oaiUser(prompt, design) {
    if (!design) return prompt;
    if (design.kind === 'svg') return svgBlock(DESIGN_SVG_NOTE, design.svg, prompt);
    // الموديلات الافتراضيّة المجّانيّة لا تقرأ الصور — نوجّه المستخدم ونكمل بالوصف
    return `ملاحظة: أرفق المستخدم تصميماً مرجعيّاً كصورة، لكنّ هذا الموديل لا يقرأ الصور؛ انصحه بلطفٍ في ملخّصك باستخدام مفتاح Claude (sk-ant-) أو Gemini لمطابقة الصورة بدقّة. ابنِ الآن واجهةً حديثةً نظيفةً حسب الوصف.\n\nالمطلوب:\n${prompt}`;
}
function geminiParts(prompt, design) {
    if (!design) return [{ text: prompt }];
    if (design.kind === 'svg') return [{ text: svgBlock(DESIGN_SVG_NOTE, design.svg, prompt) }];
    return [{ inlineData: { mimeType: design.mediaType, data: design.base64 } }, { text: `${DESIGN_IMG_NOTE}\n\nالمطلوب:\n${prompt}` }];
}

async function callModel(KEY, prompt, currentHtml, skillsCtx, design) {
    const prov = pickProvider(KEY);
    const usage = blankUsage();
    const fullSys = skillsCtx ? SYSTEM_INSTRUCTION + skillsCtx : SYSTEM_INSTRUCTION;

    if (prov.kind === 'anthropic') {
        const system = [
            { type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } },
            ...(skillsCtx ? [{ type: 'text', text: skillsCtx }] : []),
        ];
        const messages = [];
        if (currentHtml) {
            messages.push({ role: 'user', content: [{ type: 'text', text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' + EDIT_HINT, cache_control: { type: 'ephemeral' } }] });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: anthroUser(prompt, design) });
        const headers = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
        let full = '';
        for (let i = 0; i < 5; i++) {
            const data = await postJSON(prov.url, { model: prov.model, max_tokens: MAXTOK, system, messages }, headers, UPSTREAM_TIMEOUT);
            const blocks = Array.isArray(data?.content) ? data.content : [];
            const piece = blocks.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
            full += piece;
            const u = data?.usage || {};
            usage.input += u.input_tokens || 0; usage.output += u.output_tokens || 0;
            usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0;
            if (data?.stop_reason !== 'max_tokens' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    if (prov.kind === 'oai') {
        const messages = [{ role: 'system', content: fullSys }];
        if (currentHtml) {
            messages.push({ role: 'user', content: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' + EDIT_HINT });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: oaiUser(prompt, design) });
        const headers = { Authorization: `Bearer ${KEY}` };
        if (/openrouter/i.test(prov.url)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        let full = '';
        for (let i = 0; i < 5; i++) {
            const data = await postJSON(prov.url, { model: prov.model, messages, temperature: 0.4, top_p: 0.9, frequency_penalty: 0.3, max_tokens: MAXTOK }, headers, UPSTREAM_TIMEOUT);
            const choice = data?.choices?.[0]; const msg = choice?.message;
            const piece = ((msg && (typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map((c) => c?.text || '').join('') : ''))) || '');
            full += piece;
            const u = data?.usage || {};
            usage.input += u.prompt_tokens || 0; usage.output += u.completion_tokens || 0;
            usage.cacheRead += u.prompt_tokens_details?.cached_tokens || 0;
            const fin = choice?.finish_reason || choice?.native_finish_reason;
            if (fin !== 'length' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(prov.model)}:generateContent`;
    const contents = [];
    if (currentHtml) {
        contents.push({ role: 'user', parts: [{ text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' + EDIT_HINT }] });
        contents.push({ role: 'model', parts: [{ text: 'تمام، ما التعديل المطلوب؟' }] });
    }
    contents.push({ role: 'user', parts: geminiParts(prompt, design) });
    let full = '';
    for (let i = 0; i < 5; i++) {
        const payload = { systemInstruction: { role: 'system', parts: [{ text: fullSys }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.95 } };
        const data = await postJSON(url, payload, { 'x-goog-api-key': KEY }, UPSTREAM_TIMEOUT);
        const cand = data?.candidates?.[0];
        const piece = (cand?.content?.parts || []).map((p) => p?.text || '').join('');
        full += piece;
        const u = data?.usageMetadata || {};
        usage.input += u.promptTokenCount || 0; usage.output += u.candidatesTokenCount || 0; usage.cacheRead += u.cachedContentTokenCount || 0;
        if (cand?.finishReason !== 'MAX_TOKENS' || looksComplete(full)) break;
        contents.push({ role: 'model', parts: [{ text: piece }] });
        contents.push({ role: 'user', parts: [{ text: CONTINUE_MSG }] });
    }
    return { text: full.trim(), usage };
}

/* ---- قراءة بثّ SSE من المزوّد وتمرير كلّ حدثٍ لدالّة ---- */
function streamHTTPS(url, body, headers, onEvent, timeoutMs = UPSTREAM_TIMEOUT) {
    return new Promise((resolve, reject) => {
        const payload = Buffer.from(JSON.stringify(body), 'utf8');
        const u = new URL(url);
        const req = https.request({
            method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
            headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length, Accept: 'text/event-stream', ...headers }
        }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                let e = ''; res.setEncoding('utf8'); res.on('data', (c) => { e += c; });
                res.on('end', () => { try { const j = JSON.parse(e); reject(new Error(j?.error?.message || (typeof j?.error === 'string' ? j.error : '') || `upstream ${res.statusCode}: ${String(e).replace(/\s+/g, ' ').slice(0, 200)}`)); } catch { reject(new Error(`upstream ${res.statusCode}: ${String(e).replace(/\s+/g, ' ').slice(0, 200)}`)); } });
                return;
            }
            let buf = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                buf += chunk; let idx;
                while ((idx = buf.indexOf('\n\n')) >= 0) {
                    const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
                    let ev = '', data = '';
                    raw.split('\n').forEach((ln) => {
                        if (ln.startsWith('data:')) data += ln.slice(5).trim();
                        else if (ln.startsWith('event:')) ev = ln.slice(6).trim();
                    });
                    if (data) onEvent(ev, data);
                }
            });
            res.on('end', resolve);
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
        req.write(payload); req.end();
    });
}

/* ---- بثّ الموديل: يستدعي onDelta لكلّ قطعة نصّ، ويعيد {text, usage} ---- */
async function streamModel(KEY, prompt, currentHtml, onDelta, skillsCtx, design) {
    const prov = pickProvider(KEY);
    const usage = blankUsage();
    const fullSys = skillsCtx ? SYSTEM_INSTRUCTION + skillsCtx : SYSTEM_INSTRUCTION;
    let full = '';

    if (prov.kind === 'anthropic') {
        const system = [
            { type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } },
            ...(skillsCtx ? [{ type: 'text', text: skillsCtx }] : []),
        ];
        const messages = [];
        if (currentHtml) {
            messages.push({ role: 'user', content: [{ type: 'text', text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' + EDIT_HINT, cache_control: { type: 'ephemeral' } }] });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: anthroUser(prompt, design) });
        const headers = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
        for (let round = 0; round < 5; round++) {
            let piece = '', stop = '', errMsg = '';
            await streamHTTPS(prov.url, { model: prov.model, max_tokens: MAXTOK, system, messages, stream: true }, headers, (ev, data) => {
                if (data === '[DONE]') return;
                let j; try { j = JSON.parse(data); } catch { return; }
                const type = j.type || ev;
                if (type === 'content_block_delta' && j.delta?.type === 'text_delta') { piece += j.delta.text; onDelta(j.delta.text); }
                else if (type === 'message_start') { const u = j.message?.usage || {}; usage.input += u.input_tokens || 0; usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0; }
                else if (type === 'message_delta') { if (j.usage?.output_tokens) usage.output += j.usage.output_tokens; stop = j.delta?.stop_reason || stop; }
                else if (type === 'error') { errMsg = j.error?.message || 'stream error'; }
            });
            if (errMsg) throw new Error(errMsg);
            full += piece;
            if (stop !== 'max_tokens' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    if (prov.kind === 'oai') {
        const messages = [{ role: 'system', content: fullSys }];
        if (currentHtml) {
            messages.push({ role: 'user', content: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' + EDIT_HINT });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: oaiUser(prompt, design) });
        const headers = { Authorization: `Bearer ${KEY}` };
        if (/openrouter/i.test(prov.url)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        for (let round = 0; round < 5; round++) {
            let piece = '', finish = '';
            await streamHTTPS(prov.url, { model: prov.model, messages, temperature: 0.4, top_p: 0.9, frequency_penalty: 0.3, max_tokens: MAXTOK, stream: true, stream_options: { include_usage: true } }, headers, (ev, data) => {
                if (data === '[DONE]') return;
                let j; try { j = JSON.parse(data); } catch { return; }
                const ch = j.choices?.[0];
                const txt = ch?.delta?.content;
                if (txt) { piece += txt; onDelta(txt); }
                if (ch?.finish_reason) finish = ch.finish_reason;
                if (j.usage) { usage.input += j.usage.prompt_tokens || 0; usage.output += j.usage.completion_tokens || 0; usage.cacheRead += j.usage.prompt_tokens_details?.cached_tokens || 0; }
            });
            full += piece;
            if (finish !== 'length' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    // Gemini: لا بثّ تدريجيّ هنا — نستدعي النسخة المخزّنة ونرسلها دفعةً كـِدلتا واحدة
    const r = await callModel(KEY, prompt, currentHtml, skillsCtx, design);
    if (r.text) onDelta(r.text);
    return r;
}

/* ---- نداءٌ خفيفٌ أحاديّ (لمحسّن الوصف ونحوه) عبر أيّ مزوّد ---- */
async function quickComplete(KEY, system, user, maxTokens) {
    const prov = pickProvider(KEY);
    if (prov.kind === 'anthropic') {
        const data = await postJSON(prov.url, { model: prov.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }, { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }, UPSTREAM_TIMEOUT);
        const blocks = Array.isArray(data?.content) ? data.content : [];
        return blocks.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
    }
    if (prov.kind === 'oai') {
        const headers = { Authorization: `Bearer ${KEY}` };
        if (/openrouter/i.test(prov.url)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        const data = await postJSON(prov.url, { model: prov.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.6, max_tokens: maxTokens }, headers, UPSTREAM_TIMEOUT);
        const msg = data?.choices?.[0]?.message;
        return (typeof msg?.content === 'string' ? msg.content : (Array.isArray(msg?.content) ? msg.content.map((c) => c?.text || '').join('') : '')) || '';
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(prov.model)}:generateContent`;
    const data = await postJSON(url, { systemInstruction: { role: 'system', parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens } }, { 'x-goog-api-key': KEY }, UPSTREAM_TIMEOUT);
    return (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('');
}
const ENHANCER_SYS = 'أنت خبيرٌ في صياغة أوصاف تطبيقات الويب لمحرّك بناءٍ بالذكاء الاصطناعيّ متخصّص بالخرائط وGIS. خذ وصف المستخدم المختصر ووسّعه إلى مواصفةٍ غنيّةٍ واضحةٍ قابلةٍ للتنفيذ، محافظاً على نيّته تماماً دون تغيير الفكرة. غطِّ: الأقسام/الصفحات، الميزات الرئيسة، نوع البيانات (أو بيانات تجريبيّة واقعيّة)، عناصر الخريطة إن لزمت، لوحات المؤشّرات والفلاتر والتفاعلات، ولمسات تجربة المستخدم. اكتب بالعربيّة بإيجازٍ منظّم (جملة تمهيديّة ثمّ نقاط)، بلا أيّ كودٍ وبلا ماركداون ثقيل، وبما لا يتجاوز ~170 كلمة. أخرِج الوصف المحسّن فقط.';

/* ---- التخطيط الصامت (plan-then-build) للطلبات المعقّدة فقط ---- */
const PLANNER_SYS = 'أنت مخطّطٌ معماريّ لتطبيقات الويب في مجال الخرائط وGIS. من وصف المستخدم، أخرِج مخطّطاً تنفيذيّاً موجزاً جداً (نقاط فقط): الأقسام/التبويبات، المكوّنات الرئيسة، البيانات المطلوبة (أو تجريبيّة واقعيّة)، عناصر الخريطة، لوحات المؤشّرات والفلاتر، وترتيب التخطيط العامّ. بلا أيّ كود، بلا شرحٍ زائد، بالعربيّة، وبما لا يتجاوز ~120 كلمة.';
// يُفعَّل للطلبات المعقّدة فقط حتى لا يبطّئ البسيطة
function isComplexPrompt(p) {
    const s = (p || '').trim();
    if (!s) return false;
    const words = s.split(/\s+/).length;
    const hints = /(نظام|منصّ[ةه]|لوح[ةه]|تبويب|تقرير|إدار[ةه]|متعدّد|عدّ[ةه]|صفحات|فلات[رى]|مؤشّر|dashboard|CRUD|تحليل|مقارن[ةه]|خطوات|workflow)/i.test(s);
    return words >= 40 || (words >= 22 && hints);
}
async function silentPlan(KEY, prompt) {
    try { const plan = (await quickComplete(KEY, PLANNER_SYS, prompt, 450) || '').trim(); return plan || null; }
    catch { return null; }
}

/* ============================ محسّن الوصف (✨) ============================ */
// POST /api/engine/enhance  { prompt, key? } → { ok, prompt }
router.post('/enhance', optionalAuth, async (req, res) => {
    try {
        const raw = (req.body?.prompt || '').toString().trim().slice(0, 2000);
        if (!raw) return res.json({ ok: false, reason: 'empty' });
        const reqKey = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
        const KEY = reqKey || (USE_OAI ? (OAI_KEY || SERVER_KEY) : SERVER_KEY);
        if (!KEY) return res.json({ ok: false, reason: 'missing_key' });
        const out = (await quickComplete(KEY, ENHANCER_SYS, raw, 700) || '').trim().replace(/^```[a-z]*\n?|\n?```$/gi, '').trim();
        if (!out) return res.json({ ok: false, reason: 'empty_result' });
        return res.json({ ok: true, prompt: out.slice(0, 3500) });
    } catch (err) {
        return res.json({ ok: false, reason: String(err.message || 'error') });
    }
});

/* ============================ التوليد (بثّ حيّ) ============================ */
// POST /api/engine/generate-stream  (SSE) — نفس مدخلات /generate
router.post('/generate-stream', optionalAuth, async (req, res) => {
    const b = req.body || {};
    let prompt = (b.prompt || '').toString().trim().slice(0, 4000);
    const currentHtml = typeof b.currentHtml === 'string' ? b.currentHtml.slice(0, 160000) : '';
    const reqKey = typeof b.key === 'string' ? b.key.trim() : '';
    const KEY = reqKey || (USE_OAI ? (OAI_KEY || SERVER_KEY) : SERVER_KEY);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    const send = (obj) => { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch { /* */ } };
    send({ type: 'start' });

    if (!prompt) { send({ type: 'error', reason: 'empty prompt' }); return res.end(); }
    if (!KEY) { send({ type: 'error', reason: 'missing_key' }); return res.end(); }

    try {
        await ensureTable().catch(() => {});
        const ident = identOf(req);
        const metered = !reqKey;
        const acct = metered ? await getAccount(ident).catch(() => null) : null;
        if (metered && acct && (acct.used_micro || 0) >= (acct.allowance_micro || 0)) {
            send({ type: 'error', reason: 'limit_reached', plan: acct.plan, balance: balanceOf(acct) });
            return res.end();
        }

        const dsSlugs = Array.isArray(b.datasets) ? b.datasets.slice(0, 8).filter((s) => typeof s === 'string') : [];
        if (dsSlugs.length) {
            try {
                const r = await pool.query(`SELECT slug, name, kind, content, feature_count, meta, url FROM engine_datasets WHERE slug = ANY($1)`, [dsSlugs]);
                if (r.rows.length) {
                    const origin = (typeof b.origin === 'string' && /^https?:\/\//.test(b.origin)) ? b.origin.replace(/\/+$/, '') : 'https://palnovaa.com';
                    prompt += buildDatasetInjection(r.rows, origin);
                }
            } catch { /* */ }
        }

        if (!currentHtml && isComplexPrompt(prompt)) {   // تخطيطٌ صامت للطلبات المعقّدة ثمّ بناء
            const plan = await silentPlan(KEY, prompt);
            if (plan) prompt += '\n\n[مخطّطٌ تنفيذيّ التزِم به عند البناء:]\n' + plan;
        }
        const design = validDesign(b.design);
        const skillIds = detectSkills(prompt);
        const skillsCtx = buildSkillsContext(skillIds);
        const { text, usage } = await streamModel(KEY, prompt, currentHtml, (t) => send({ type: 'delta', text: t }), skillsCtx, design);
        if (looksLooped(text)) { send({ type: 'error', reason: 'دخل الموديل في حلقة تكرار (شائع في الموديلات المجّانيّة). أعِد المحاولة، أو استخدم موديلاً أقوى مثل Claude.' }); return res.end(); }
        const out = currentHtml ? applyEdits(text, currentHtml, prompt) : parseGenerated(text, prompt);
        if (!out.html || out.html.length < 60) { send({ type: 'error', reason: 'no_html' }); return res.end(); }
        let balance = null;
        if (metered && acct) { const c = costMicro(usage); await addCost(ident, c); acct.used_micro = (acct.used_micro || 0) + c; balance = balanceOf(acct); }
        await recordUsage(ident, usage);
        send({ type: 'done', model: MODEL_NAME, html: out.html, title: out.title, summary: out.summary, usage, balance, mode: out.mode, applied: out.applied });
        return res.end();
    } catch (err) {
        let m = String(err.message || 'error');
        const transient = /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m);
        if (/ETIMEDOUT|timeout|socket hang|ECONNRESET|ENETUNREACH/i.test(m)) m = 'المزوّد لم يستجب في الوقت المحدّد (بطء/ازدحام في المزوّد المجّاني). جرّب مزوّداً أسرع مثل Groq (gsk_) أو Gemini، أو أعِد المحاولة.';
        else if (/404|not found|does not exist|is not found/i.test(m)) m = `الموديل «${pickProvider(KEY).model}» غير متاح لهذا المفتاح/المزوّد (404). جرّب مفتاحاً آخر أو أخبِرني بالمزوّد. التفصيل: ${m}`;
        send({ type: 'error', reason: transient ? 'الموديل مزدحمٌ الآن. جرّب بعد لحظات.' : m });
        return res.end();
    }
});

/* ============================ التوليد ============================ */
// POST /api/engine/generate  { prompt, currentHtml?, key?, datasets?, origin? }
router.post('/generate', optionalAuth, async (req, res) => {
    const b = req.body || {};
    let prompt = (b.prompt || '').toString().trim().slice(0, 4000);
    const currentHtml = typeof b.currentHtml === 'string' ? b.currentHtml.slice(0, 160000) : '';
    if (!prompt) return res.status(400).json({ ok: false, reason: 'empty prompt' });

    const reqKey = typeof b.key === 'string' ? b.key.trim() : '';
    const KEY = reqKey || (USE_OAI ? (OAI_KEY || SERVER_KEY) : SERVER_KEY);
    if (!KEY) return res.json({ ok: false, reason: 'missing_key', model: MODEL_NAME });

    // التقنين بالكلفة: يُحسَب فقط على المفتاح المشترك (لا على مفتاح المستخدم الخاصّ)
    await ensureTable().catch(() => {});
    const ident = identOf(req);
    const metered = !reqKey;
    let acct = metered ? await getAccount(ident).catch(() => null) : null;
    if (metered && acct && (acct.used_micro || 0) >= (acct.allowance_micro || 0)) {
        return res.json({ ok: false, reason: 'limit_reached', plan: acct.plan, balance: balanceOf(acct), model: MODEL_NAME });
    }

    // حقن البيانات الحقيقيّة المرفقة
    const dsSlugs = Array.isArray(b.datasets) ? b.datasets.slice(0, 8).filter((s) => typeof s === 'string') : [];
    if (dsSlugs.length) {
        try {
            const r = await pool.query(`SELECT slug, name, kind, content, feature_count, meta, url FROM engine_datasets WHERE slug = ANY($1)`, [dsSlugs]);
            if (r.rows.length) {
                const origin = (typeof b.origin === 'string' && /^https?:\/\//.test(b.origin)) ? b.origin.replace(/\/+$/, '') : 'https://palnovaa.com';
                prompt += buildDatasetInjection(r.rows, origin);
            }
        } catch (e) { /* ignore dataset errors */ }
    }

    if (!currentHtml && isComplexPrompt(prompt)) {   // تخطيطٌ صامت للطلبات المعقّدة ثمّ بناء
        const plan = await silentPlan(KEY, prompt);
        if (plan) prompt += '\n\n[مخطّطٌ تنفيذيّ التزِم به عند البناء:]\n' + plan;
    }
    const design = validDesign(b.design);
    const skillIds = detectSkills(prompt);
    const skillsCtx = buildSkillsContext(skillIds);
    const isTransient = (m) => /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m || '');
    let lastErr = 'unavailable';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
        try {
            const { text, usage } = await callModel(KEY, prompt, currentHtml, skillsCtx, design);
            if (!text) { lastErr = 'empty'; continue; }
            if (looksLooped(text)) { lastErr = 'دخل الموديل في حلقة تكرار. أعِد المحاولة أو استخدم موديلاً أقوى مثل Claude.'; continue; }
            const out = currentHtml ? applyEdits(text, currentHtml, prompt) : parseGenerated(text, prompt);
            if (!out.html || out.html.length < 60) { lastErr = 'no_html'; continue; }
            let balance = null;
            if (metered && acct) { const c = costMicro(usage); await addCost(ident, c); acct.used_micro = (acct.used_micro || 0) + c; balance = balanceOf(acct); }
            await recordUsage(ident, usage);
            return res.json({ ok: true, model: MODEL_NAME, usage, balance, ...out });
        } catch (err) {
            lastErr = String(err.message || 'unavailable');
            if (!isTransient(lastErr)) break;
        }
    }
    let reason = isTransient(lastErr) ? 'الموديل مزدحمٌ الآن (ضغطٌ مؤقّت). جرّب بعد لحظات.' : lastErr;
    if (/ETIMEDOUT|timeout|socket hang|ECONNRESET|ENETUNREACH/i.test(lastErr)) reason = 'المزوّد لم يستجب في الوقت المحدّد (بطء/ازدحام في المزوّد المجّاني). جرّب مزوّداً أسرع مثل Groq (gsk_) أو Gemini، أو أعِد المحاولة.';
    else if (/404|not found|does not exist|is not found/i.test(lastErr)) reason = `الموديل «${pickProvider(KEY).model}» غير متاح لهذا المفتاح/المزوّد (404). التفصيل: ${lastErr}`;
    return res.json({ ok: false, reason, model: MODEL_NAME });
});

/* ============================ المشاريع ============================ */
// POST /api/engine/projects  { title, prompt, summary, html, thread? }
router.post('/projects', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const b = req.body || {};
        const title = (b.title || 'تطبيق GIS').toString().slice(0, 160);
        const prompt = (b.prompt || '').toString().slice(0, 4000);
        const summary = (b.summary || '').toString().slice(0, 300);
        const html = (b.html || '').toString();
        const thread = Array.isArray(b.thread) ? JSON.stringify(b.thread).slice(0, 2_000_000) : null;
        if (!html || html.length < 60) return res.status(400).json({ ok: false, reason: 'empty html' });
        const ownerId = ownerOf(req);

        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_projects (slug, title, prompt, summary, html, owner_id, thread)
                     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id, slug, title, summary, owner_id, created_at`,
                    [slug, title, prompt, summary, html, ownerId, thread]
                );
                saved = r.rows[0]; break;
            } catch (e) { if (/unique/i.test(e.message)) { slug = makeSlug(); continue; } throw e; }
        }
        if (!saved) throw new Error('slug conflict');

        const publicUrl = await publishToR2(saved.slug, html);
        if (publicUrl) { await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, saved.slug]); saved.public_url = publicUrl; }
        return res.json({ ok: true, project: saved, url: `/pe/${saved.slug}`, public_url: publicUrl });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// PUT /api/engine/projects/:slug  { title?, html?, summary?, prompt?, thread? }
router.put('/projects/:slug', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const slug = req.params.slug;
        const cur = await pool.query(`SELECT id, owner_id, html FROM engine_projects WHERE slug=$1`, [slug]);
        if (!cur.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });
        const project = cur.rows[0];
        if (!canEdit(project, req)) return res.status(403).json({ ok: false, reason: 'forbidden' });

        const b = req.body || {};
        const htmlChanging = typeof b.html === 'string' && b.html.length >= 60 && b.html !== project.html;
        if (htmlChanging && project.html) await snapshot(project.id, 'تلقائيّ');

        const fields = [], vals = []; let i = 1;
        ['title', 'summary', 'prompt', 'html'].forEach((k) => {
            if (typeof b[k] === 'string') { fields.push(`${k}=$${i++}`); vals.push(b[k]); }
        });
        if (Array.isArray(b.thread)) { fields.push(`thread=$${i++}::jsonb`); vals.push(JSON.stringify(b.thread).slice(0, 2_000_000)); }
        if (!fields.length) return res.status(400).json({ ok: false, reason: 'nothing to update' });
        fields.push(`updated_at=now()`); vals.push(slug);
        const r = await pool.query(`UPDATE engine_projects SET ${fields.join(', ')} WHERE slug=$${i} RETURNING id, slug, title, summary, updated_at`, vals);

        let publicUrl = null;
        if (htmlChanging) {
            publicUrl = await publishToR2(slug, b.html);
            if (publicUrl) { await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, slug]); r.rows[0].public_url = publicUrl; }
        }
        return res.json({ ok: true, project: r.rows[0], url: `/pe/${slug}`, public_url: publicUrl });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// GET /api/engine/projects
router.get('/projects', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const ownerId = ownerOf(req);
        const r = ownerId
            ? await pool.query(`SELECT id, slug, title, summary, updated_at FROM engine_projects WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 60`, [ownerId])
            : await pool.query(`SELECT id, slug, title, summary, updated_at FROM engine_projects WHERE owner_id IS NULL ORDER BY updated_at DESC LIMIT 30`);
        return res.json({ ok: true, projects: r.rows });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error'), projects: [] });
    }
});

// GET /api/engine/projects/:slug  (عامّ)
router.get('/projects/:slug', async (req, res) => {
    try {
        await ensureTable();
        const r = await pool.query(`SELECT id, slug, title, summary, prompt, html, public_url, thread, created_at, updated_at FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        if (!r.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });
        return res.json({ ok: true, project: r.rows[0] });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// DELETE /api/engine/projects/:slug
router.delete('/projects/:slug', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const cur = await pool.query(`SELECT owner_id FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        if (cur.rows.length && !canEdit(cur.rows[0], req)) return res.status(403).json({ ok: false, reason: 'forbidden' });
        await pool.query(`DELETE FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        await removeFromR2(req.params.slug);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ النُّسَخ (versions) ============================ */
// GET /api/engine/projects/:slug/versions
router.get('/projects/:slug/versions', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const p = await pool.query(`SELECT id FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        if (!p.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });
        const r = await pool.query(`SELECT id, title, label, created_at FROM engine_versions WHERE project_id=$1 ORDER BY id DESC`, [p.rows[0].id]);
        return res.json({ ok: true, versions: r.rows });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error'), versions: [] });
    }
});

// POST /api/engine/projects/:slug/restore  { versionId }
router.post('/projects/:slug/restore', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const p = await pool.query(`SELECT id, owner_id, html FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        if (!p.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });
        if (!canEdit(p.rows[0], req)) return res.status(403).json({ ok: false, reason: 'forbidden' });
        const vid = parseInt(req.body?.versionId, 10);
        const v = await pool.query(`SELECT html, title, summary FROM engine_versions WHERE id=$1 AND project_id=$2`, [vid, p.rows[0].id]);
        if (!v.rows.length) return res.status(404).json({ ok: false, reason: 'version not found' });
        await snapshot(p.rows[0].id, 'قبل الاسترجاع');
        const ver = v.rows[0];
        await pool.query(`UPDATE engine_projects SET html=$1, title=$2, summary=$3, updated_at=now() WHERE slug=$4`, [ver.html, ver.title, ver.summary, req.params.slug]);
        const publicUrl = await publishToR2(req.params.slug, ver.html);
        if (publicUrl) await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, req.params.slug]);
        return res.json({ ok: true, project: { slug: req.params.slug, title: ver.title, summary: ver.summary, html: ver.html, public_url: publicUrl } });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ النسخ (fork) ============================ */
// POST /api/engine/projects/:slug/fork
router.post('/projects/:slug/fork', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const src = await pool.query(`SELECT title, summary, prompt, html, thread FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        if (!src.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });
        const s = src.rows[0];
        const ownerId = ownerOf(req);
        const title = `${s.title} (نسخة)`.slice(0, 160);
        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_projects (slug, title, prompt, summary, html, owner_id, forked_from, thread)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id, slug, title, summary, created_at`,
                    [slug, title, s.prompt, s.summary, s.html, ownerId, req.params.slug, s.thread ? JSON.stringify(s.thread) : null]
                );
                saved = r.rows[0]; break;
            } catch (e) { if (/unique/i.test(e.message)) { slug = makeSlug(); continue; } throw e; }
        }
        if (!saved) throw new Error('slug conflict');
        const publicUrl = await publishToR2(saved.slug, s.html);
        if (publicUrl) { await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, saved.slug]); saved.public_url = publicUrl; }
        return res.json({ ok: true, project: saved, url: `/pe/${saved.slug}` });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ موصّل ArcGIS REST ============================ */
// GET /api/engine/arcgis/browse?url=...  — يتصفّح دليل خدمات أو خدمةً مفردة (بروكسي آمن)
router.get('/arcgis/browse', optionalAuth, async (req, res) => {
    try {
        let raw = (req.query.url || '').toString().trim().slice(0, 1000);
        if (!raw) return res.status(400).json({ ok: false, reason: 'الرابط مطلوب' });
        if (!/\/rest\/services/i.test(raw)) return res.status(400).json({ ok: false, reason: 'يجب أن يكون رابط ArcGIS REST (يحوي ‎/rest/services‎).' });
        raw = raw.replace(/[?#].*$/, '').replace(/\/+$/, '');
        await assertPublicHttpUrl(raw);
        const { status, body } = await httpGetText(raw + '?f=json');
        if (status >= 400) return res.status(502).json({ ok: false, reason: `الخادم أعاد ${status}` });
        let j; try { j = JSON.parse(body); } catch { return res.status(502).json({ ok: false, reason: 'الاستجابة ليست JSON — تأكّد من صحّة الرابط.' }); }
        if (j.error) return res.status(400).json({ ok: false, reason: j.error.message || 'خطأ من الخادم' });

        // خدمة مفردة (MapServer / FeatureServer / ImageServer)
        if (Array.isArray(j.layers) || j.mapName || j.serviceDataType) {
            const m = raw.match(/\/(MapServer|FeatureServer|ImageServer)$/i);
            const serviceType = m ? m[1] : 'MapServer';
            const layers = (j.layers || []).slice(0, 120).map((l) => ({ id: l.id, name: l.name, geometryType: l.geometryType || null, type: l.type || null }));
            return res.json({
                ok: true, kind: 'service', serviceType, url: raw,
                name: j.mapName || raw.split('/services/').pop(),
                layers, spatialReference: j.spatialReference || null,
                singleFusedMapCache: !!j.singleFusedMapCache, fullExtent: j.fullExtent || null,
                description: (j.serviceDescription || j.description || '').slice(0, 300)
            });
        }
        // دليل (جذر أو مجلّد)
        if (Array.isArray(j.services) || Array.isArray(j.folders)) {
            const services = (j.services || []).map((s) => {
                const short = String(s.name).split('/').pop();
                return { name: short, type: s.type, url: `${raw}/${short}/${s.type}` };
            });
            const folders = (j.folders || []).map((f) => ({ name: f, url: `${raw}/${f}` }));
            return res.json({ ok: true, kind: 'directory', version: j.currentVersion || null, folders, services });
        }
        return res.status(400).json({ ok: false, reason: 'نوع استجابةٍ غير معروف.' });
    } catch (err) {
        return res.status(400).json({ ok: false, reason: String(err.message || 'error') });
    }
});

// POST /api/engine/arcgis/save  { name, url, serviceType, layers:[{id,name,geometryType}] }
router.post('/arcgis/save', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const b = req.body || {};
        const name = (b.name || 'خادم ArcGIS').toString().slice(0, 160);
        const serviceUrl = (b.url || '').toString().trim().replace(/[?#].*$/, '');
        const serviceType = ['MapServer', 'FeatureServer', 'ImageServer'].includes(b.serviceType) ? b.serviceType : 'MapServer';
        if (!/\/rest\/services/i.test(serviceUrl)) return res.status(400).json({ ok: false, reason: 'رابط خدمة ArcGIS غير صالح.' });
        await assertPublicHttpUrl(serviceUrl);
        const layers = Array.isArray(b.layers) ? b.layers.slice(0, 80).map((l) => ({
            id: Number(l.id), name: (l.name || '').toString().slice(0, 220), geometryType: l.geometryType || null
        })).filter((l) => Number.isFinite(l.id)) : [];
        const content = JSON.stringify({ serviceUrl, serviceType, layers });
        const meta = { arcgis: true, serviceUrl, serviceType, layers };
        const ownerId = ownerOf(req);
        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_datasets (slug, name, kind, content, feature_count, owner_id, meta)
                     VALUES ($1,$2,'arcgis',$3,$4,$5,$6::jsonb) RETURNING id, slug, name, kind, feature_count, meta, created_at`,
                    [slug, name, content, layers.length, ownerId, JSON.stringify(meta)]
                );
                saved = r.rows[0]; break;
            } catch (e) { if (/unique/i.test(e.message)) { slug = makeSlug(); continue; } throw e; }
        }
        if (!saved) throw new Error('slug conflict');
        return res.json({ ok: true, dataset: saved });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ موصّل HDX (Humanitarian Data Exchange) ============================ */
// GET /api/engine/hdx/search?q=&page=  — بحث CKAN مُصفّى على فلسطين (groups:pse)
router.get('/hdx/search', optionalAuth, async (req, res) => {
    try {
        const q = (req.query.q || '').toString().trim().slice(0, 160);
        const page = Math.max(1, Math.min(50, parseInt(req.query.page, 10) || 1));
        const rows = 20, start = (page - 1) * rows;
        const params = new URLSearchParams();
        params.set('fq', 'groups:pse');
        if (q) params.set('q', q);
        params.set('rows', String(rows));
        params.set('start', String(start));
        const { status, body } = await httpGetText('https://data.humdata.org/api/3/action/package_search?' + params.toString(), 20000, 8_000_000);
        if (status >= 400) return res.status(502).json({ ok: false, reason: `HDX ${status}` });
        const j = JSON.parse(body);
        if (!j.success) return res.status(502).json({ ok: false, reason: 'فشل بحث HDX' });
        const datasets = (j.result.results || []).map((d) => ({
            id: d.name, title: d.title || d.name,
            org: d.organization?.title || '',
            notes: (d.notes || '').replace(/\s+/g, ' ').slice(0, 240),
            updated: d.metadata_modified || null,
            url: 'https://data.humdata.org/dataset/' + d.name,
            resources: (d.resources || []).map((r) => ({
                name: r.name || r.format || 'مورد', format: (r.format || '').toUpperCase(),
                url: r.url, size: r.size || null
            })).filter((r) => r.url && /^https?:\/\//i.test(r.url)).slice(0, 30)
        }));
        return res.json({ ok: true, count: j.result.count || 0, page, datasets });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'error') });
    }
});

// POST /api/engine/hdx/attach  { url, name, format }  — ينزّل مورد GeoJSON/CSV ويحفظه كمصدر بيانات
router.post('/hdx/attach', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const b = req.body || {};
        const url = (b.url || '').toString().trim();
        const name = (b.name || 'HDX').toString().slice(0, 160);
        const fmt = (b.format || '').toString().toLowerCase();
        let host; try { host = new URL(url).hostname; } catch { return res.status(400).json({ ok: false, reason: 'رابط غير صالح' }); }
        if (!/(^|\.)humdata\.org$/i.test(host)) return res.status(400).json({ ok: false, reason: 'يُسمح بإضافة موارد HDX فقط' });
        const urlPath = (() => { try { return new URL(url).pathname.toLowerCase().split('?')[0]; } catch { return ''; } })();
        if (/\.zip$/.test(urlPath)) return res.status(400).json({ ok: false, reason: 'الملفّ مضغوط (zip) — استخدم التنزيل على الجهاز.' });
        if (!/\.(geojson|json|csv)$/.test(urlPath) && !/geojson|^json$|csv/i.test(fmt)) return res.status(400).json({ ok: false, reason: 'الإضافة التلقائيّة تدعم GeoJSON و CSV فقط — استخدم التنزيل للصيغ الأخرى.' });

        const { status, body } = await httpGetFollow(url, { maxRedirects: 5, timeoutMs: 45000, maxBytes: MAX_GEOJSON_BYTES + 1024 });
        if (status >= 400) return res.status(502).json({ ok: false, reason: `تعذّر جلب المورد (HDX ${status})` });
        if (status !== 200 || !body.trim()) return res.status(502).json({ ok: false, reason: 'المورد غير متاح للجلب المباشر — استخدم التنزيل على الجهاز.' });
        if (body.charCodeAt(0) === 0x50 && body.charCodeAt(1) === 0x4b) return res.status(400).json({ ok: false, reason: 'المورد مضغوط (zip) — استخدم التنزيل على الجهاز.' });

        let kind = /geojson/i.test(fmt) ? 'geojson' : (fmt === 'csv' ? 'csv' : (/^\s*[{[]/.test(body) ? 'geojson' : 'csv'));
        try {
            const saved = await createDatasetFromContent({ name, kind, content: body, ownerId: ownerOf(req) });
            return res.json({ ok: true, dataset: saved });
        } catch (e) {
            if (e.code === 413) return res.status(413).json({ ok: false, reason: e.message });
            return res.status(400).json({ ok: false, reason: String(e.message || 'المحتوى غير صالح') });
        }
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ البيانات (datasets) ============================ */
/* رفع الملفّات الكبيرة مباشرةً إلى R2 (تجاوز حدّ جسم طلب Vercel ~4.5MB) */
let r2CorsEnsured = false;
async function ensureR2Cors() {
    if (r2CorsEnsured || !R2_ON) return;
    try {
        await r2Client.send(new PutBucketCorsCommand({
            Bucket: R2_BUCKET,
            CORSConfiguration: { CORSRules: [{ AllowedMethods: ['GET', 'PUT', 'HEAD'], AllowedOrigins: ['*'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }] }
        }));
        r2CorsEnsured = true;
    } catch (e) { console.warn('engine: R2 CORS set failed:', e.message); }
}

// POST /api/engine/datasets/presign  { name, kind, bytes } → رابط رفع مباشر موقّع
router.post('/datasets/presign', optionalAuth, async (req, res) => {
    try {
        if (!R2_ON || !r2Base) return res.json({ ok: false, reason: 'الرفع الكبير يتطلّب تفعيل التخزين السحابيّ (R2).' });
        const b = req.body || {};
        let kind = (b.kind || '').toString().toLowerCase(); if (!['geojson', 'csv', 'geotiff'].includes(kind)) kind = 'geojson';
        const bytes = parseInt(b.bytes, 10) || 0;
        if (bytes <= 0) return res.status(400).json({ ok: false, reason: 'حجمٌ غير صالح' });
        const cap = kind === 'geotiff' ? MAX_GEOTIFF_BYTES : MAX_GEOJSON_BYTES;
        if (bytes > cap) return res.status(413).json({ ok: false, reason: `الملفّ كبيرٌ جداً (الحدّ ${Math.floor(cap / 1048576)}MB).` });
        await ensureR2Cors();
        const slug = makeSlug();
        const ext = kind === 'geojson' ? 'geojson' : (kind === 'csv' ? 'csv' : 'tif');
        const key = `data/${slug}.${ext}`;
        const contentType = kind === 'geojson' ? 'application/geo+json' : (kind === 'csv' ? 'text/csv' : 'image/tiff');
        const uploadUrl = await getSignedUrl(r2Client, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 900 });
        return res.json({ ok: true, slug, key, kind, uploadUrl, contentType, publicUrl: `${r2Base}/${key}` });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'error') });
    }
});

// POST /api/engine/datasets/finalize  { slug, name, kind } → يقرأ من R2 ويحلّل ويحفظ
router.post('/datasets/finalize', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        if (!R2_ON || !r2Base) return res.status(400).json({ ok: false, reason: 'التخزين السحابيّ غير مُفعّل.' });
        const b = req.body || {};
        const slug = (b.slug || '').toString();
        if (!/^[a-z0-9]{5,12}$/i.test(slug)) return res.status(400).json({ ok: false, reason: 'معرّف غير صالح' });
        const name = (b.name || 'بيانات').toString().slice(0, 160);
        let kind = (b.kind || '').toString().toLowerCase(); if (!['geojson', 'csv', 'geotiff'].includes(kind)) kind = 'geojson';
        const ext = kind === 'geojson' ? 'geojson' : (kind === 'csv' ? 'csv' : 'tif');
        const publicUrl = `${r2Base}/data/${slug}.${ext}`;
        const r2Host = (() => { try { return new URL(r2Base).hostname; } catch { return ''; } })();
        if (new URL(publicUrl).hostname !== r2Host) return res.status(400).json({ ok: false, reason: 'مصدرٌ غير متوقّع' });

        // GeoTIFF: ملفٌّ ثنائيّ يبقى في R2، نقرأ ترويسته فقط ونخزّن البيانات الوصفيّة
        if (kind === 'geotiff') {
            let meta;
            try { meta = await analyzeGeoTIFF(publicUrl, parseInt(b.bytes, 10) || null); }
            catch (e) { return res.status(400).json({ ok: false, reason: 'تعذّر قراءة GeoTIFF (تأكّد من صحّة الملفّ): ' + String(e.message || '').slice(0, 50) }); }
            const ownerId = ownerOf(req);
            try {
                const r = await pool.query(
                    `INSERT INTO engine_datasets (slug, name, kind, content, feature_count, owner_id, meta, url)
                     VALUES ($1,$2,'geotiff',NULL,0,$3,$4::jsonb,$5) RETURNING id, slug, name, kind, feature_count, meta, url, created_at`,
                    [slug, name, ownerId, JSON.stringify(meta), publicUrl]
                );
                return res.json({ ok: true, dataset: r.rows[0] });
            } catch (e) { return res.status(500).json({ ok: false, reason: String(e.message || 'db error') }); }
        }

        const { status, body } = await httpGetFollow(publicUrl, { maxRedirects: 3, timeoutMs: 45000, maxBytes: MAX_GEOJSON_BYTES + 1024 });
        if (status !== 200 || !body) return res.status(502).json({ ok: false, reason: 'تعذّر قراءة الملفّ المرفوع — أعِد المحاولة.' });
        try {
            const saved = await createDatasetFromContent({ name, kind, content: body, ownerId: ownerOf(req), skipR2: true, publicUrl, slug });
            return res.json({ ok: true, dataset: saved });
        } catch (e) {
            if (e.code === 413) return res.status(413).json({ ok: false, reason: e.message });
            return res.status(400).json({ ok: false, reason: String(e.message || 'المحتوى غير صالح') });
        }
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'error') });
    }
});

// POST /api/engine/datasets  { name, kind, content }
router.post('/datasets', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const b = req.body || {};
        const name = (b.name || 'بيانات').toString().slice(0, 160);
        let kind = (b.kind || '').toString().toLowerCase();
        const content = (b.content || '').toString();
        if (!['geojson', 'csv'].includes(kind)) kind = /^\s*[{[]/.test(content) ? 'geojson' : 'csv';
        if (!content) return res.status(400).json({ ok: false, reason: 'empty content' });
        if (Buffer.byteLength(content, 'utf8') > MAX_DATASET_BYTES) return res.status(413).json({ ok: false, reason: `الملفّ كبيرٌ جداً للرفع المباشر (الحدّ ${Math.floor(MAX_DATASET_BYTES / 1048576)}MB) — سيُضاف الرفع الكبير قريباً عبر التخزين السحابيّ.` });
        try {
            const saved = await createDatasetFromContent({ name, kind, content, ownerId: ownerOf(req) });
            return res.json({ ok: true, dataset: saved });
        } catch (e) {
            if (e.code === 413) return res.status(413).json({ ok: false, reason: e.message });
            return res.status(400).json({ ok: false, reason: String(e.message || 'GeoJSON غير صالح.') });
        }
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// GET /api/engine/datasets  — قائمة
router.get('/datasets', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const ownerId = ownerOf(req);
        const r = ownerId
            ? await pool.query(`SELECT slug, name, kind, feature_count, url, meta, created_at FROM engine_datasets WHERE owner_id=$1 ORDER BY id DESC LIMIT 100`, [ownerId])
            : await pool.query(`SELECT slug, name, kind, feature_count, url, meta, created_at FROM engine_datasets WHERE owner_id IS NULL ORDER BY id DESC LIMIT 50`);
        return res.json({ ok: true, datasets: r.rows });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error'), datasets: [] });
    }
});

// GET /api/engine/datasets/:slug/data  — تقديم المحتوى (CORS) لتجلبه التطبيقات المولَّدة
router.get('/datasets/:slug/data', async (req, res) => {
    try {
        await ensureTable();
        const r = await pool.query(`SELECT kind, content FROM engine_datasets WHERE slug=$1`, [req.params.slug]);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=120');
        if (!r.rows.length) return res.status(404).json({ error: 'not found' });
        const d = r.rows[0];
        res.setHeader('Content-Type', d.kind === 'geojson' ? 'application/geo+json; charset=utf-8' : 'text/csv; charset=utf-8');
        return res.send(d.content || '');
    } catch (err) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: String(err.message || 'error') });
    }
});

// GET /api/engine/datasets/:slug/tiles/:z/:x/:y.pbf  — تايلز متّجهة (MVT) للـGeoJSON الكبير (CORS)
router.get('/datasets/:slug/tiles/:z/:x/:y', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const z = parseInt(req.params.z, 10), x = parseInt(req.params.x, 10), y = parseInt(req.params.y, 10);
        if (![z, x, y].every(Number.isFinite) || z < 0 || z > 24) return res.status(400).end();
        await ensureTable();
        const entry = await getTileIndex(req.params.slug);
        res.setHeader('Content-Type', 'application/x-protobuf');
        res.setHeader('Cache-Control', 'public, max-age=600');
        if (!entry) return res.status(404).end();
        const tile = entry.index.getTile(z, x, y);
        if (!tile || !tile.features || !tile.features.length) return res.status(204).end();
        const buf = vtpbf.fromGeojsonVt({ data: tile }, { version: 2 });
        return res.status(200).send(Buffer.from(buf));
    } catch (err) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).end();
    }
});

// DELETE /api/engine/datasets/:slug
router.delete('/datasets/:slug', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const cur = await pool.query(`SELECT owner_id FROM engine_datasets WHERE slug=$1`, [req.params.slug]);
        if (cur.rows.length && cur.rows[0].owner_id && String(cur.rows[0].owner_id) !== String(ownerOf(req))) return res.status(403).json({ ok: false, reason: 'forbidden' });
        await pool.query(`DELETE FROM engine_datasets WHERE slug=$1`, [req.params.slug]);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

/* ============================ إعداد الدفع (عامّ) ============================ */
// GET /api/engine/billing-config — قيمٌ عامّة لتهيئة Paddle.js في المتصفّح
router.get('/templates', (req, res) => {
    res.json({ ok: true, templates: TEMPLATES });
});

router.get('/billing-config', (req, res) => {
    res.json({
        ok: true,
        provider: GUMROAD_PRODUCT_URL ? 'gumroad' : (process.env.PADDLE_CLIENT_TOKEN ? 'paddle' : 'none'),
        gumroadUrl: GUMROAD_PRODUCT_URL,
        token: process.env.PADDLE_CLIENT_TOKEN || '',
        priceId: process.env.PADDLE_PRO_PRICE || '',
        env: process.env.PADDLE_ENV || 'production'
    });
});

/* ============================ Gumroad Webhook (Ping) ============================ */
// POST /api/engine/gumroad/webhook — يُفعّل Pro عند الشراء؛ يتجدّد مع كلّ دفعة، وينتهي تلقائياً عند توقّف الدفع
router.post('/gumroad/webhook', async (req, res) => {
    try {
        const b = req.body || {};
        if (GUMROAD_SELLER_ID && b.seller_id && String(b.seller_id) !== String(GUMROAD_SELLER_ID)) return res.status(401).json({ ok: false, reason: 'bad seller' });
        await ensureTable();

        // تحديد المستخدم: من url_params.ident المُمرَّر وقت الدفع، أو بالبريد
        let ident = (b.url_params && (b.url_params.ident || b.url_params.Ident)) ? String(b.url_params.ident || b.url_params.Ident) : null;
        const email = b.email || b.purchaser_email || null;
        if (!ident && email) { try { const u = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]); if (u.rows.length) ident = 'u:' + u.rows[0].id; } catch { /* */ } }
        if (!ident) return res.status(200).json({ ok: true, note: 'no ident — تعذّر الربط' });

        // تحقّق اختياريّ من صحّة البيع عبر واجهة Gumroad
        if (GUMROAD_ACCESS_TOKEN && b.sale_id) {
            try {
                const v = await httpGetText(`https://api.gumroad.com/v2/sales/${encodeURIComponent(b.sale_id)}?access_token=${encodeURIComponent(GUMROAD_ACCESS_TOKEN)}`, 15000, 500000);
                const vj = JSON.parse(v.body);
                if (!vj || vj.success !== true) return res.status(200).json({ ok: true, note: 'unverified' });
            } catch { /* لو فشل التحقّق نُكمل بحذر اعتماداً على seller_id */ }
        }

        const refunded = b.refunded === 'true' || b.disputed === 'true' || b.chargebacked === 'true';
        if (refunded) {
            await pool.query(`UPDATE engine_accounts SET plan='free', allowance_micro=$2 WHERE ident=$1`, [ident, FREE_MICRO]);
            return res.json({ ok: true, downgraded: true });
        }

        // تفاصيل البيع (المبلغ بالسنت + العملة) — لصفحة إدارة الدفع
        const priceCents = Number.isFinite(+b.price) ? Math.round(+b.price) : null;
        const currency = (b.currency || 'usd').toString().toUpperCase();

        // تفعيل Pro ~33 يوماً (يتجدّد مع كلّ دفعة شهريّة؛ وينتهي تلقائياً إن توقّف الدفع)
        const periodEnd = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString();
        await pool.query(
            `INSERT INTO engine_accounts (ident, plan, allowance_micro, used_micro, period_end, paddle_sub, email, provider, price_cents, currency, last_sale_at, updated_at)
             VALUES ($1,'pro',$2,0,$3,$4,$5,'gumroad',$6,$7,now(),now())
             ON CONFLICT (ident) DO UPDATE SET plan='pro', allowance_micro=$2, used_micro=0, period_end=$3, paddle_sub=COALESCE($4, engine_accounts.paddle_sub), email=COALESCE($5, engine_accounts.email), provider='gumroad', price_cents=COALESCE($6, engine_accounts.price_cents), currency=COALESCE($7, engine_accounts.currency), last_sale_at=now(), updated_at=now()`,
            [ident, PRO_MICRO, periodEnd, b.subscription_id || b.sale_id || null, email, priceCents, currency]);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: false, reason: String(err.message || 'error') });
    }
});

/* ============================ الرصيد (balance) ============================ */
// GET /api/engine/balance — رصيد المستخدم الحاليّ على المفتاح المشترك
router.get('/balance', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const acct = await getAccount(identOf(req));
        return res.json({ ok: true, balance: balanceOf(acct) });
    } catch (err) {
        return res.json({ ok: false, reason: String(err.message || 'error') });
    }
});

/* ============================ Paddle Webhook ============================ */
function verifyPaddle(sigHeader, raw, secret) {
    try {
        const parts = {};
        String(sigHeader || '').split(';').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1); });
        if (!parts.ts || !parts.h1) return false;
        const digest = crypto.createHmac('sha256', secret).update(parts.ts + ':' + raw).digest('hex');
        const a = Buffer.from(digest), b = Buffer.from(parts.h1);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { return false; }
}

// POST /api/engine/webhook  (Paddle Billing) — خامِلٌ حتى ضبط PADDLE_WEBHOOK_SECRET
router.post('/webhook', async (req, res) => {
    try {
        if (!PADDLE_WEBHOOK_SECRET) return res.status(200).json({ ok: true, dormant: true });
        const raw = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
        if (!verifyPaddle(req.headers['paddle-signature'], raw, PADDLE_WEBHOOK_SECRET)) return res.status(401).json({ ok: false, reason: 'bad signature' });
        await ensureTable();

        const ev = req.body || {}; const type = ev.event_type || ''; const data = ev.data || {};
        const email = data.customer?.email || data.billing_details?.email || data.customer_email || null;
        let ident = data.custom_data?.ident || null;
        if (!ident && email) { const u = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]); if (u.rows.length) ident = 'u:' + u.rows[0].id; }

        if (/^subscription\.(created|updated|activated)$/.test(type) || type === 'transaction.completed') {
            if (ident) {
                const periodEnd = data.current_billing_period?.ends_at || data.next_billed_at || null;
                const sub = data.subscription_id || data.id || null;
                await pool.query(
                    `INSERT INTO engine_accounts (ident, plan, allowance_micro, used_micro, period_end, paddle_sub, email, updated_at)
                     VALUES ($1,'pro',$2,0,$3,$4,$5,now())
                     ON CONFLICT (ident) DO UPDATE SET plan='pro', allowance_micro=$2, used_micro=0, period_end=$3, paddle_sub=$4, email=COALESCE($5, engine_accounts.email), updated_at=now()`,
                    [ident, PRO_MICRO, periodEnd, sub, email]);
            }
        } else if (type === 'subscription.canceled' || type === 'subscription.paused') {
            const sub = data.id || data.subscription_id || null;
            if (sub) await pool.query(`UPDATE engine_accounts SET plan='free', allowance_micro=$2 WHERE paddle_sub=$1`, [sub, FREE_MICRO]);
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(200).json({ ok: false, reason: String(err.message || 'error') });
    }
});

/* ============================ إدارة الدفع (للأدمن) ============================ */
// GET /api/engine/admin/payments — قائمة المشتركين ومن دفع + تفاصيله والمبالغ
router.get('/admin/payments', authenticateToken, isAdmin, async (req, res) => {
    try {
        await ensureTable();
        const r = await pool.query(
            `SELECT a.ident, a.plan, a.email AS billing_email, a.provider, a.price_cents, a.currency,
                    a.period_end, a.last_sale_at, a.paddle_sub, a.updated_at,
                    u.id AS user_id, u.username, u.full_name, u.email AS user_email
             FROM engine_accounts a
             LEFT JOIN users u ON a.ident = ('u:' || u.id::text)
             WHERE a.plan = 'pro' OR a.last_sale_at IS NOT NULL OR a.paddle_sub IS NOT NULL
             ORDER BY a.last_sale_at DESC NULLS LAST, a.updated_at DESC
             LIMIT 500`
        );
        const now = Date.now();
        const rows = r.rows.map((x) => {
            const active = x.plan === 'pro' && (!x.period_end || new Date(x.period_end).getTime() > now);
            return {
                ident: x.ident,
                userId: x.user_id || null,
                name: x.full_name || x.username || null,
                email: x.user_email || x.billing_email || null,
                plan: x.plan,
                active,
                provider: x.provider || (x.paddle_sub ? 'paddle' : null),
                amount: x.price_cents != null ? +(x.price_cents / 100).toFixed(2) : null,
                currency: x.currency || (x.price_cents != null ? 'USD' : null),
                subscriptionId: x.paddle_sub || null,
                lastSaleAt: x.last_sale_at || null,
                periodEnd: x.period_end || null,
                updatedAt: x.updated_at || null
            };
        });
        // ملخّصٌ سريع
        const activeCount = rows.filter((x) => x.active).length;
        const revenueUsd = +rows.reduce((s, x) => s + (x.currency === 'USD' || !x.currency ? (x.amount || 0) : 0), 0).toFixed(2);
        return res.json({ ok: true, count: rows.length, activeCount, revenueUsd, rows });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'error') });
    }
});

/* ============================ مركز المستندات (Docs) ============================ */
const docRow = (r, full) => ({
  slug: r.slug, title: r.title, excerpt: r.excerpt || '', cover_url: r.cover_url || '',
  kind: r.kind || 'article', file_url: r.file_url || '', file_name: r.file_name || '',
  published: r.published, sort_order: r.sort_order || 0, created_at: r.created_at, updated_at: r.updated_at,
  ...(full ? { body: r.body || '' } : {}),
});

// GET /api/engine/docs — القائمة (الأدمن يرى الكلّ، غيره المنشور فقط)
router.get('/docs', optionalAuth, async (req, res) => {
  try {
    await ensureTable();
    const isAdm = !!(req.user && req.user.role === 'admin');
    const r = await pool.query(
      `SELECT slug,title,excerpt,cover_url,kind,file_url,file_name,published,sort_order,created_at,updated_at
       FROM engine_docs ${isAdm ? '' : 'WHERE published = true'}
       ORDER BY sort_order DESC, created_at DESC LIMIT 300`
    );
    return res.json({ ok: true, admin: isAdm, docs: r.rows.map((x) => docRow(x, false)) });
  } catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// GET /api/engine/docs/:slug
router.get('/docs/:slug', optionalAuth, async (req, res) => {
  try {
    await ensureTable();
    const isAdm = !!(req.user && req.user.role === 'admin');
    const r = await pool.query('SELECT * FROM engine_docs WHERE slug=$1', [req.params.slug]);
    if (!r.rows.length || (!r.rows[0].published && !isAdm)) return res.status(404).json({ ok: false, reason: 'not_found' });
    return res.json({ ok: true, doc: docRow(r.rows[0], true) });
  } catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// POST /api/engine/docs (admin) — إنشاء
router.post('/docs', authenticateToken, isAdmin, async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const title = (b.title || '').toString().trim().slice(0, 200);
    if (!title) return res.status(400).json({ ok: false, reason: 'العنوان مطلوب' });
    const slug = makeSlug();
    await pool.query(
      `INSERT INTO engine_docs (slug,title,excerpt,cover_url,body,file_url,file_name,kind,published,sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [slug, title, (b.excerpt || '').slice(0, 500), b.cover_url || '', b.body || '', b.file_url || '', (b.file_name || '').slice(0, 160), b.kind || 'article', b.published !== false, parseInt(b.sort_order, 10) || 0]
    );
    return res.json({ ok: true, slug });
  } catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// PUT /api/engine/docs/:slug (admin) — تعديل
router.put('/docs/:slug', authenticateToken, isAdmin, async (req, res) => {
  try {
    await ensureTable();
    const b = req.body || {};
    const r = await pool.query(
      `UPDATE engine_docs SET title=COALESCE($2,title), excerpt=$3, cover_url=$4, body=$5,
         file_url=$6, file_name=$7, kind=$8, published=$9, sort_order=$10, updated_at=now()
       WHERE slug=$1 RETURNING slug`,
      [req.params.slug, (b.title || '').slice(0, 200) || null, (b.excerpt || '').slice(0, 500), b.cover_url || '', b.body || '', b.file_url || '', (b.file_name || '').slice(0, 160), b.kind || 'article', b.published !== false, parseInt(b.sort_order, 10) || 0]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, reason: 'not_found' });
    return res.json({ ok: true, slug: r.rows[0].slug });
  } catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// DELETE /api/engine/docs/:slug (admin)
router.delete('/docs/:slug', authenticateToken, isAdmin, async (req, res) => {
  try { await ensureTable(); await pool.query('DELETE FROM engine_docs WHERE slug=$1', [req.params.slug]); return res.json({ ok: true }); }
  catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// POST /api/engine/docs/presign (admin) — رفع غلافٍ أو ملفٍّ إلى R2
router.post('/docs/presign', authenticateToken, isAdmin, async (req, res) => {
  try {
    if (!R2_ON || !r2Base) return res.json({ ok: false, reason: 'التخزين السحابيّ غير مُفعّل (R2).' });
    const name = (req.body?.filename || 'file').toString().replace(/[^\w.\-؀-ۿ]+/g, '_').slice(0, 90);
    const contentType = (req.body?.contentType || 'application/octet-stream').toString().slice(0, 100);
    const key = `docs/${makeSlug()}/${name}`;
    const uploadUrl = await getSignedUrl(r2Client, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 900 });
    return res.json({ ok: true, uploadUrl, publicUrl: `${r2Base}/${key}`, contentType });
  } catch (err) { return res.status(500).json({ ok: false, reason: String(err.message || 'error') }); }
});

// POST /api/engine/docs/:slug/attach — إضافة ملفّ المستند لبيانات المستخدم (يظهر في «بياناتك»)
router.post('/docs/:slug/attach', optionalAuth, async (req, res) => {
  try {
    await ensureTable();
    const r = await pool.query('SELECT * FROM engine_docs WHERE slug=$1 AND published=true', [req.params.slug]);
    if (!r.rows.length) return res.status(404).json({ ok: false, reason: 'not_found' });
    const d = r.rows[0];
    if (!d.file_url) return res.status(400).json({ ok: false, reason: 'لا ملفّ قابلٌ للإضافة في هذا المستند' });
    const low = (d.file_url + ' ' + (d.file_name || '')).toLowerCase();
    const kind = (/\.csv(\?|$)/.test(low) || low.includes('.csv')) ? 'csv' : 'geojson';
    const { body } = await httpGetFollow(d.file_url, { maxRedirects: 4, timeoutMs: 45000, maxBytes: MAX_GEOJSON_BYTES + 1024 });
    if (!body || body.length < 2) return res.status(400).json({ ok: false, reason: 'تعذّر جلب الملفّ' });
    const saved = await createDatasetFromContent({ name: (d.title || 'مستند').slice(0, 60), kind, content: body, ownerId: ownerOf(req) });
    return res.json({ ok: true, dataset: saved });
  } catch (err) { return res.json({ ok: false, reason: String(err.message || 'error') }); }
});

module.exports = router;
