const express = require('express');
const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const pool = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
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
                if (res.statusCode && res.statusCode >= 400) return reject(new Error(json?.error?.message || `upstream ${res.statusCode}`));
                resolve(json);
            } catch { reject(new Error(`bad json (${res.statusCode})`)); }
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
    'استخدم فقط المكتبات التي يحتاجها التطبيق فعلاً — كلّها من cdnjs.cloudflare.com بإصدارٍ مثبّت، باستثناء Leaflet.VectorGrid و georaster فمن cdn.jsdelivr.net بالروابط أعلاه حرفيّاً.',
    '',
    '— الخرائط والتحليل المكانيّ (تخصّصك الأوّل) —',
    '• استخدم Leaflet 1.9.4 من cdnjs: ضمّن leaflet.css و leaflet.js.',
    "• بلاط الخريطة الأساس: خرائط Google عبر L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3'], maxZoom:20}). يمكنك lyrs=s للأقمار الصناعيّة.",
    '• هيّئ الخريطة بعد تحميل DOM، واضبط setView على منطقةٍ منطقيّة (فلسطين/الضفة: [31.95,35.23] zoom 9).',
    '• لا تستخدم أيّ خدمةٍ تتطلّب مفتاح API. للترميز الجغرافيّ استخدم Nominatim العامّ باعتدال.',
    '',
    '— البيانات والموصّلات —',
    '• إن زُوِّدت بروابط بياناتٍ حقيقيّة (datasets) فاجلبها فعليّاً عبر fetch واعرضها، وعالِج الفشل بلُطف (رسالة + زرّ إعادة).',
    '• إن لم تُزوَّد ببيانات: ولّد بياناتٍ تجريبيّة واقعيّة ومتنوّعة مناسبة للسياق بأسماءٍ عربيّة صحيحة.',
    '• موصّلات مجّانيّة بلا مفتاح: OpenStreetMap Overpass API (amenities, buildings, roads)، Open-Meteo (طقس)، Open-Elevation، Nominatim (ترميز جغرافيّ).',
    '• خدمات ArcGIS REST (مثل GeoMOLG الفلسطينيّ): حمّل esri-leaflet بعد leaflet.js. لطبقة MapServer ديناميكيّة (قسائم/مبانٍ/أورثوفوتو): L.esri.dynamicMapLayer({url:"<svc>/MapServer",opacity:0.8}).addTo(map). لطبقة FeatureServer متّجهة: L.esri.featureLayer({url:"<svc>/FeatureServer/<layerId>"}).addTo(map) مع bindPopup. الخوادم تعيد الإسقاط تلقائياً (PG1923 wkid:28191 → Web Mercator). استخدم رابط الخدمة المُعطى حرفيّاً دون تعديل.',
    '• لوّن الطبقات المكانيّة ترميزاً متدرّجاً (choropleth) وأضِف popup لخصائص كلّ عنصر.',
    '',
    '— الواجهة والتصميم —',
    '• الواجهة عربيّة RTL، عصريّة واحترافيّة، متجاوبة مع الجوّال (breakpoint ≤768px).',
    '• تصميمٌ داكنٌ أنيق: خلفيّة #0A0B0D، سطوح #12151A/#1A1E24، حدود #2B3038، نصّ #C8CDD4، لمسة برتقاليّة #E07B39.',
    '• مسافاتٌ مريحة (padding ≥16px)، حوافٍّ ناعمة (border-radius ≥8px)، أيقونات SVG مدمجة، خطّ system-ui.',
    '• أضِف تبويبات/أقسام/لوحات حسب الحاجة. بطاقات KPI لكلّ لوحة. مفتاح ألوان (legend) للخرائط.',
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
            const ls = (meta.layers || []).map((l) => `${l.id}:${l.name}${l.geometryType ? ` (${l.geometryType})` : ''}`).join('، ') || '—';
            return `• خادم ArcGIS REST «${d.name}» — النوع ${t} — رابط الخدمة: ${u} — الطبقات [${ls}] — استهلكها حيّةً مباشرةً عبر esri-leaflet (dynamicMapLayer للـMapServer، featureLayer لكلّ طبقة FeatureServer). لا تحوّلها إلى GeoJSON ثابت واستخدم الرابط حرفيّاً.`;
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
        + (hasArc ? 'خوادم ArcGIS تُستهلَك مباشرةً عبر esri-leaflet وتعيد الإسقاط تلقائياً من PG1923 إلى Web Mercator. ' : '')
        + (hasTiles ? 'للبيانات المُقسَّمة تايلز: ضمّن Leaflet أوّلاً ثمّ VectorGrid، واستعمل L.vectorGrid.protobuf(قالب_الرابط,{vectorTileLayerStyles:{data:{...}},interactive:true,maxNativeZoom:20}).addTo(map) وbindPopup من خصائص الميزة. ' : '')
        + (hasRaster ? 'لصور GeoTIFF: ضمّن <script src="https://cdn.jsdelivr.net/npm/georaster@1.6.0/dist/georaster.browser.bundle.min.js"></script> ثمّ <script src="https://cdn.jsdelivr.net/npm/georaster-layer-for-leaflet@3.10.0/dist/georaster-layer-for-leaflet.min.js"></script> بعد leaflet.js، و(للإسناد غير 4326) proj4 من cdnjs. ' : '')
        + 'اعرض البيانات فعلاً على الخريطة وعالِج فشل الجلب برسالةٍ واضحة وزرّ إعادة.]';
}

/* ---- المزوّد ---- */
function pickProvider(KEY) {
    const k = (KEY || '').trim();
    if (k.startsWith('sk-ant-')) return { kind: 'anthropic', url: 'https://api.anthropic.com/v1/messages', model: ANTHROPIC_MODEL };
    if (USE_OAI) return { kind: 'oai', url: OAI_URL, model: OAI_MODEL };
    if (k.startsWith('sk-or-')) return { kind: 'oai', url: 'https://openrouter.ai/api/v1/chat/completions', model: process.env.PALNOVAA_MODEL || 'deepseek/deepseek-chat-v3:free' };
    if (k.startsWith('gsk_')) return { kind: 'oai', url: 'https://api.groq.com/openai/v1/chat/completions', model: process.env.PALNOVAA_MODEL || 'llama-3.3-70b-versatile' };
    if (k.startsWith('nvapi-')) return { kind: 'oai', url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: process.env.PALNOVAA_MODEL || 'deepseek-ai/deepseek-v3' };
    return { kind: 'gemini', url: '', model: GEMINI_MODEL };
}

const CONTINUE_MSG = 'أكمل بقيّة الكود من حيث توقّفت بالضبط (حرفٌ بحرف)، بلا إعادة أيّ جزءٍ سابق وبلا أيّ شرح. إن كان المستند قد اكتمل بـ</html> فاكتب "تمّ".';
const looksComplete = (s) => /<\/html>\s*$/i.test((s || '').trim());
const blankUsage = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

async function callModel(KEY, prompt, currentHtml, skillsCtx) {
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
            messages.push({ role: 'user', content: [{ type: 'text', text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```', cache_control: { type: 'ephemeral' } }] });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
        const headers = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
        let full = '';
        for (let i = 0; i < 5; i++) {
            const data = await postJSON(prov.url, { model: prov.model, max_tokens: MAXTOK, system, messages }, headers, 290000);
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
            messages.push({ role: 'user', content: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
        const headers = { Authorization: `Bearer ${KEY}` };
        if (/openrouter/i.test(prov.url)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        let full = '';
        for (let i = 0; i < 5; i++) {
            const data = await postJSON(prov.url, { model: prov.model, messages, temperature: 0.3, max_tokens: MAXTOK }, headers, 290000);
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const contents = [];
    if (currentHtml) {
        contents.push({ role: 'user', parts: [{ text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' }] });
        contents.push({ role: 'model', parts: [{ text: 'تمام، ما التعديل المطلوب؟' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    let full = '';
    for (let i = 0; i < 5; i++) {
        const payload = { systemInstruction: { role: 'system', parts: [{ text: fullSys }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.95 } };
        const data = await postJSON(url, payload, { 'x-goog-api-key': KEY }, 290000);
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
function streamHTTPS(url, body, headers, onEvent, timeoutMs = 290000) {
    return new Promise((resolve, reject) => {
        const payload = Buffer.from(JSON.stringify(body), 'utf8');
        const u = new URL(url);
        const req = https.request({
            method: 'POST', hostname: u.hostname, path: u.pathname + u.search,
            headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length, Accept: 'text/event-stream', ...headers }
        }, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                let e = ''; res.setEncoding('utf8'); res.on('data', (c) => { e += c; });
                res.on('end', () => { try { const j = JSON.parse(e); reject(new Error(j?.error?.message || `upstream ${res.statusCode}`)); } catch { reject(new Error(`upstream ${res.statusCode}`)); } });
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
async function streamModel(KEY, prompt, currentHtml, onDelta, skillsCtx) {
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
            messages.push({ role: 'user', content: [{ type: 'text', text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```', cache_control: { type: 'ephemeral' } }] });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
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
            messages.push({ role: 'user', content: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
        const headers = { Authorization: `Bearer ${KEY}` };
        if (/openrouter/i.test(prov.url)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        for (let round = 0; round < 5; round++) {
            let piece = '', finish = '';
            await streamHTTPS(prov.url, { model: prov.model, messages, temperature: 0.3, max_tokens: MAXTOK, stream: true, stream_options: { include_usage: true } }, headers, (ev, data) => {
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
    const r = await callModel(KEY, prompt, currentHtml);
    if (r.text) onDelta(r.text);
    return r;
}

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

        const skillIds = detectSkills(prompt);
        const skillsCtx = buildSkillsContext(skillIds);
        const { text, usage } = await streamModel(KEY, prompt, currentHtml, (t) => send({ type: 'delta', text: t }), skillsCtx);
        const out = parseGenerated(text, prompt);
        if (!out.html || out.html.length < 60) { send({ type: 'error', reason: 'no_html' }); return res.end(); }
        let balance = null;
        if (metered && acct) { const c = costMicro(usage); await addCost(ident, c); acct.used_micro = (acct.used_micro || 0) + c; balance = balanceOf(acct); }
        await recordUsage(ident, usage);
        send({ type: 'done', model: MODEL_NAME, html: out.html, title: out.title, summary: out.summary, usage, balance });
        return res.end();
    } catch (err) {
        const m = String(err.message || 'error');
        const transient = /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m);
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

    const skillIds = detectSkills(prompt);
    const skillsCtx = buildSkillsContext(skillIds);
    const isTransient = (m) => /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m || '');
    let lastErr = 'unavailable';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
        try {
            const { text, usage } = await callModel(KEY, prompt, currentHtml, skillsCtx);
            if (!text) { lastErr = 'empty'; continue; }
            const out = parseGenerated(text, prompt);
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
    const reason = isTransient(lastErr) ? 'الموديل مزدحمٌ الآن (ضغطٌ مؤقّت). جرّب بعد لحظات.' : lastErr;
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
        const ownerId = ownerOf(req);
        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_datasets (slug, name, kind, content, feature_count, owner_id)
                     VALUES ($1,$2,'arcgis',$3,$4,$5) RETURNING id, slug, name, kind, feature_count, created_at`,
                    [slug, name, content, layers.length, ownerId]
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
        token: process.env.PADDLE_CLIENT_TOKEN || '',
        priceId: process.env.PADDLE_PRO_PRICE || '',
        env: process.env.PADDLE_ENV || 'production'
    });
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

module.exports = router;
