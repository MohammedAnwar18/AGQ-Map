const express = require('express');
const https = require('https');
const pool = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../config/r2');
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

const DAILY_ANON = parseInt(process.env.PALNOVAA_DAILY_ANON, 10) || 30;
const DAILY_USER = parseInt(process.env.PALNOVAA_DAILY_USER, 10) || 200;

const MAX_VERSIONS = 20;
const MAX_DATASET_BYTES = 6 * 1024 * 1024;

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
            await pool.query(`
                CREATE TABLE IF NOT EXISTS engine_quota (
                    ident TEXT NOT NULL, day DATE NOT NULL, count INTEGER DEFAULT 0,
                    tok_in BIGINT DEFAULT 0, tok_out BIGINT DEFAULT 0,
                    PRIMARY KEY (ident, day)
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

/* ---- الحدود اليوميّة وتتبّع التوكِنات ---- */
async function checkQuota(req) {
    const ident = identOf(req);
    const limit = ownerOf(req) ? DAILY_USER : DAILY_ANON;
    try {
        const r = await pool.query(
            `INSERT INTO engine_quota (ident, day, count) VALUES ($1, CURRENT_DATE, 0)
             ON CONFLICT (ident, day) DO UPDATE SET ident = EXCLUDED.ident RETURNING count`, [ident]);
        const used = r.rows[0]?.count || 0;
        return { ident, used, limit, ok: used < limit };
    } catch (e) { return { ident, used: 0, limit, ok: true }; } // fail-open
}
async function recordUsage(ident, usage) {
    try {
        const tin = (usage?.input || 0) + (usage?.cacheRead || 0) + (usage?.cacheWrite || 0);
        await pool.query(
            `UPDATE engine_quota SET count = count + 1, tok_in = tok_in + $2, tok_out = tok_out + $3
             WHERE ident = $1 AND day = CURRENT_DATE`, [ident, tin, usage?.output || 0]);
    } catch (e) { /* ignore */ }
}

/* ---- تعليمات الموديل (ثابتة → تُكاش على Claude) ---- */
const SYSTEM_INSTRUCTION = [
    'أنت «PalNovaa 1.0»، محرّكٌ خبيرٌ من الطراز الأوّل يبني تطبيقات نظم المعلومات الجغرافية (GIS) تفاعليّة واحترافيّة.',
    'مهمّتك: من وصف المستخدم، تُنتج تطبيق ويب كاملاً في ملفٍ واحد (single-file HTML) جاهزاً للتشغيل فوراً دون أيّ خطوةٍ إضافيّة.',
    '',
    '— قواعد الإخراج (صارمة) —',
    '1) أخرِج مستند HTML كاملاً فقط: يبدأ بـ <!doctype html> وينتهي بـ </html>. لا شرح ولا نصّ قبله ولا بعده، ولا تضعه داخل أسوار ```.',
    '2) اكتب الكود كاملاً فعليّاً. ممنوع منعاً باتّاً ترك عناصر نائبة مثل «... بقيّة الكود» أو دوالّ فارغة. كلّ دالّة مُنفَّذة بالكامل، وكلّ زرّ موصولٌ بوظيفةٍ حقيقيّة.',
    '3) ملفٌ واحد مكتفٍ ذاتيّاً: كلّ الـCSS و JavaScript داخل الصفحة. لا ملفات خارجيّة سوى مكتبات CDN موثوقة.',
    '4) في أوّل سطرٍ بعد <!doctype html> ضع تعليقاً واحداً بهذا الشكل بالضبط: <!--PNE:{"title":"عنوان قصير للمشروع","summary":"جملة تصف ما بُني"}-->',
    '5) اجعل <title> مطابقاً للعنوان.',
    '',
    '— الخرائط والتحليل المكانيّ —',
    '• استخدم Leaflet 1.9.4 من cdnjs: ضمّن leaflet.css و leaflet.js.',
    "• بلاط الخريطة الأساس: خرائط Google عبر L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3'], maxZoom:20}). يمكنك lyrs=s للأقمار الصناعيّة.",
    '• للتحليل المكانيّ استخدم Turf.js 6.5.0 من cdnjs: buffer, union, intersect, area, centroid, distance, nearestPoint, pointsWithinPolygon, voronoi, bbox, booleanPointInPolygon.',
    '• هيّئ الخريطة بعد تحميل DOM، واضبط setView على منطقةٍ منطقيّة (فلسطين/الضفة: [31.95,35.23] zoom 9، أو نابلس [32.22,35.26]).',
    '• لا تستخدم أيّ خدمةٍ تتطلّب مفتاح API. للترميز الجغرافيّ استخدم Nominatim العامّ باعتدال.',
    '',
    '— البيانات —',
    '• إن زُوِّدت بروابط بياناتٍ حقيقيّة (datasets) فاجلبها فعليّاً وقت التشغيل عبر fetch واعرضها، وعالِج فشل الجلب بلُطف.',
    '• إن لم تُزوَّد ببيانات، ولّد بياناتٍ تجريبيّة منطقيّة وواقعيّة (GeoJSON مدمج) مناسبة لفلسطين بأسماءٍ عربيّة صحيحة وإحداثيّاتٍ معقولة.',
    '• لوّن الطبقات ترميزاً متدرّجاً (choropleth) حسب قيمةٍ منطقيّة، وأضِف نافذة منبثقة تعرض خصائص كلّ عنصر.',
    '',
    '— الواجهة والتصميم —',
    '• الواجهة عربيّة RTL، عصريّة واحترافيّة، متجاوبة مع الجوّال، بتصميمٍ داكنٍ أنيق افتراضاً (خلفيّة ~#0A0B0D، لمسة برتقاليّة #E07B39)، بمسافاتٍ مريحة وحوافٍّ ناعمة.',
    '• أضِف لوحةً جانبيّة للطبقات (تبديل الظهور)، ومفتاح ألوان (legend)، ومؤشّرات (KPIs)، وبحث/فلترة حين تناسب.',
    '',
    '— الجودة —',
    '• نفّذ أفضل تصميمٍ وميزاتٍ للطلب بإتقان، واجعل الكود سليماً متماسكاً خالياً من الأخطاء البرمجيّة (لا متغيّرات غير معرّفة، ترتيب تحميل صحيح للمكتبات).',
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

async function callModel(KEY, prompt, currentHtml) {
    const prov = pickProvider(KEY);
    const usage = blankUsage();

    if (prov.kind === 'anthropic') {
        const system = [{ type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } }];
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
        const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
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
        const payload = { systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] }, contents, generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.95 } };
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
async function streamModel(KEY, prompt, currentHtml, onDelta) {
    const prov = pickProvider(KEY);
    const usage = blankUsage();
    let full = '';

    if (prov.kind === 'anthropic') {
        const system = [{ type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } }];
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
        const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
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
        const q = await checkQuota(req);
        if (!q.ok) { send({ type: 'error', reason: 'quota', message: `بلغتَ حدّ اليوم (${q.limit} توليدة). ${ownerOf(req) ? 'جرّب غداً.' : 'سجّل الدخول لحدٍّ أعلى.'}` }); return res.end(); }

        const dsSlugs = Array.isArray(b.datasets) ? b.datasets.slice(0, 8).filter((s) => typeof s === 'string') : [];
        if (dsSlugs.length) {
            try {
                const r = await pool.query(`SELECT slug, name, kind, content, feature_count FROM engine_datasets WHERE slug = ANY($1)`, [dsSlugs]);
                if (r.rows.length) {
                    const origin = (typeof b.origin === 'string' && /^https?:\/\//.test(b.origin)) ? b.origin.replace(/\/+$/, '') : 'https://palnovaa.com';
                    const lines = r.rows.map((d) => `• «${d.name}» — ${String(d.kind).toUpperCase()} — ${d.feature_count || countFeatures(d.kind, d.content || '')} عنصراً — اجلبها بـ fetch("${origin}/api/engine/datasets/${d.slug}/data") — ${datasetSchema(d.kind, d.content || '')}`);
                    prompt += '\n\n[بياناتٌ حقيقيّة مرفقة — استخدمها فعليّاً عبر fetch وقت التشغيل بدل أيّ بيانات تجريبيّة:\n' + lines.join('\n') + '\nملاحظة: الروابط تدعم CORS. اعرض البيانات فعلاً على الخريطة وعالِج فشل الجلب برسالةٍ واضحة.]';
                }
            } catch { /* */ }
        }

        const { text, usage } = await streamModel(KEY, prompt, currentHtml, (t) => send({ type: 'delta', text: t }));
        const out = parseGenerated(text, prompt);
        if (!out.html || out.html.length < 60) { send({ type: 'error', reason: 'no_html' }); return res.end(); }
        await recordUsage(q.ident, usage);
        send({ type: 'done', model: MODEL_NAME, html: out.html, title: out.title, summary: out.summary, usage, quota: { used: q.used + 1, limit: q.limit } });
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

    // حدّ الاستخدام اليوميّ
    await ensureTable().catch(() => {});
    const q = await checkQuota(req);
    if (!q.ok) return res.json({ ok: false, reason: 'quota', message: `بلغتَ حدّ اليوم (${q.limit} توليدة). ${ownerOf(req) ? 'جرّب غداً.' : 'سجّل الدخول لحدٍّ أعلى.'}`, model: MODEL_NAME });

    // حقن البيانات الحقيقيّة المرفقة
    const dsSlugs = Array.isArray(b.datasets) ? b.datasets.slice(0, 8).filter((s) => typeof s === 'string') : [];
    if (dsSlugs.length) {
        try {
            const r = await pool.query(`SELECT slug, name, kind, content, feature_count FROM engine_datasets WHERE slug = ANY($1)`, [dsSlugs]);
            if (r.rows.length) {
                const origin = (typeof b.origin === 'string' && /^https?:\/\//.test(b.origin)) ? b.origin.replace(/\/+$/, '') : 'https://palnovaa.com';
                const lines = r.rows.map((d) => `• «${d.name}» — ${String(d.kind).toUpperCase()} — ${d.feature_count || countFeatures(d.kind, d.content || '')} عنصراً — اجلبها بـ fetch("${origin}/api/engine/datasets/${d.slug}/data") — ${datasetSchema(d.kind, d.content || '')}`);
                prompt += '\n\n[بياناتٌ حقيقيّة مرفقة — استخدمها فعليّاً عبر fetch وقت التشغيل بدل أيّ بيانات تجريبيّة:\n' + lines.join('\n') + '\nملاحظة: الروابط تدعم CORS. اعرض البيانات فعلاً على الخريطة وعالِج فشل الجلب برسالةٍ واضحة.]';
            }
        } catch (e) { /* ignore dataset errors */ }
    }

    const isTransient = (m) => /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m || '');
    let lastErr = 'unavailable';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
        try {
            const { text, usage } = await callModel(KEY, prompt, currentHtml);
            if (!text) { lastErr = 'empty'; continue; }
            const out = parseGenerated(text, prompt);
            if (!out.html || out.html.length < 60) { lastErr = 'no_html'; continue; }
            await recordUsage(q.ident, usage);
            return res.json({ ok: true, model: MODEL_NAME, usage, quota: { used: q.used + 1, limit: q.limit }, ...out });
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

/* ============================ البيانات (datasets) ============================ */
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
        if (Buffer.byteLength(content, 'utf8') > MAX_DATASET_BYTES) return res.status(413).json({ ok: false, reason: 'الملفّ كبيرٌ جداً (الحدّ 6MB).' });
        if (kind === 'geojson') { try { JSON.parse(content); } catch { return res.status(400).json({ ok: false, reason: 'GeoJSON غير صالح.' }); } }
        const count = countFeatures(kind, content);
        const ownerId = ownerOf(req);

        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_datasets (slug, name, kind, content, feature_count, owner_id)
                     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, slug, name, kind, feature_count, created_at`,
                    [slug, name, kind, content, count, ownerId]
                );
                saved = r.rows[0]; break;
            } catch (e) { if (/unique/i.test(e.message)) { slug = makeSlug(); continue; } throw e; }
        }
        if (!saved) throw new Error('slug conflict');

        // رفعٌ اختياريّ إلى R2 أيضاً (للجلب المباشر)
        if (R2_ON) {
            try {
                const ext = kind === 'geojson' ? 'geojson' : 'csv';
                await r2Client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: `data/${slug}.${ext}`, Body: content, ContentType: kind === 'geojson' ? 'application/geo+json' : 'text/csv' }));
                if (r2Base) { const url = `${r2Base}/data/${slug}.${ext}`; await pool.query(`UPDATE engine_datasets SET url=$1 WHERE slug=$2`, [url, slug]); saved.url = url; }
            } catch (e) { /* ignore */ }
        }
        return res.json({ ok: true, dataset: saved });
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
            ? await pool.query(`SELECT slug, name, kind, feature_count, url, created_at FROM engine_datasets WHERE owner_id=$1 ORDER BY id DESC LIMIT 100`, [ownerId])
            : await pool.query(`SELECT slug, name, kind, feature_count, url, created_at FROM engine_datasets WHERE owner_id IS NULL ORDER BY id DESC LIMIT 50`);
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

module.exports = router;
