const express = require('express');
const https = require('https');
const pool = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../config/r2');
const router = express.Router();

/* ============================================================================
   PalNovaa Engine — محرّك بالنوفا
   ----------------------------------------------------------------------------
   محرّكٌ يبني تطبيقات GIS من وصفٍ نصّيّ. المستخدم يكتب ما يريد، فيردّ الموديل
   «PalNovaa 1.0» بتطبيقٍ كامل (HTML مستقلّ، Leaflet + Turf)، يُحفَظ في قاعدة
   البيانات ويُعطى رابطاً دائماً يعمل في أيّ وقت (مثل Replit).

   «PalNovaa 1.0» اسمٌ تجاريّ لنا؛ محرّكه الفعليّ قابلٌ للتبديل بلا تعديل كود:
     • Anthropic Claude (Sonnet) أصلاً   — مفتاح يبدأ بـ sk-ant-  ★ الموصى به
     • أيّ نقطةٍ متوافقة مع OpenAI (OpenRouter/Groq/NVIDIA) عبر PALNOVAA_API_URL
     • Google Gemini افتراضاً
   المفتاح يبقى في الخادم (متغيّر بيئة) فلا يُكشف في حزمة المتصفّح.

   متغيّرات البيئة:
     PALNOVAA_MODEL_KEY   مفتاح الموديل الخادِم (sk-ant-… أو sk-or-… أو AIza… …)
     PALNOVAA_MODEL       اسم الموديل (مثلاً claude-sonnet-5-5)
     PALNOVAA_API_URL     (اختياريّ) نقطة OpenAI-compatible
     PALNOVAA_API_KEY     (اختياريّ) مفتاح تلك النقطة
     PALNOVAA_MAX_TOKENS  حدّ التوكِنات لكلّ جولة (افتراضيّ 16000)
   ============================================================================ */

const MODEL_NAME = 'PalNovaa 1.0';

const OAI_URL = (process.env.PALNOVAA_API_URL || '').trim();         // مثال: https://openrouter.ai/api/v1/chat/completions
const USE_OAI = !!OAI_URL;
const OAI_KEY = process.env.PALNOVAA_API_KEY || '';
const GEMINI_MODEL = process.env.PALNOVAA_MODEL || 'gemini-3.8-flash';
const OAI_MODEL = process.env.PALNOVAA_MODEL || 'deepseek/deepseek-chat-v3:free';
const ANTHROPIC_MODEL = process.env.PALNOVAA_MODEL || 'claude-sonnet-5-5';
const SERVER_KEY = process.env.PALNOVAA_MODEL_KEY || process.env.GEMINI_API_KEY || '';
const MAXTOK = parseInt(process.env.PALNOVAA_MAX_TOKENS, 10) || 16000;

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

/* ---- ضمان وجود الجدول ---- */
let tableReady = null;
function ensureTable() {
    if (!tableReady) {
        tableReady = pool.query(`
            CREATE TABLE IF NOT EXISTS engine_projects (
                id          SERIAL PRIMARY KEY,
                slug        TEXT UNIQUE NOT NULL,
                title       TEXT NOT NULL,
                prompt      TEXT,
                summary     TEXT,
                html        TEXT NOT NULL,
                public_url  TEXT,
                owner_id    INTEGER,
                created_at  TIMESTAMPTZ DEFAULT now(),
                updated_at  TIMESTAMPTZ DEFAULT now()
            );
        `)
            .then(() => pool.query(`ALTER TABLE engine_projects ADD COLUMN IF NOT EXISTS public_url TEXT;`))
            .catch((e) => { tableReady = null; throw e; });
    }
    return tableReady;
}

const makeSlug = () => Math.random().toString(36).slice(2, 9);

/* ---- التخزين: Cloudflare R2 ----
   نرفع نسخة التطبيق المنشورة إلى R2 لتُقدَّم من دومين R2 المنفصل، فتعمل معزولةً
   عن كوكيز/جلسات المنصّة (عزلٌ أمنيّ). تبقى نسخة Postgres هي المصدر القابل للتعديل
   واحتياطيّاً إن لم يُضبَط R2. الرفع غير حرِج: فشله لا يُفشِل الحفظ. */
const R2_BUCKET = process.env.R2_BUCKET_NAME || process.env.R2_GIS_BUCKET_NAME || '';
const R2_PUBLIC_RAW = (process.env.R2_PUBLIC_URL || process.env.R2_GIS_PUBLIC_URL || '').trim();
const R2_ON = !!(R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT);
const r2Base = R2_PUBLIC_RAW
    ? (R2_PUBLIC_RAW.startsWith('http') ? R2_PUBLIC_RAW : `https://${R2_PUBLIC_RAW}`).replace(/\/+$/, '')
    : '';
const appKey = (slug) => `apps/${slug}/index.html`;

async function publishToR2(slug, html) {
    if (!R2_ON) return null;
    try {
        // نُخفي بياناتنا الوصفيّة الداخليّة من النسخة العامّة.
        const published = String(html).replace(/<!--PNE:[\s\S]*?-->\s*/, '');
        await r2Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: appKey(slug),
            Body: published,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: 'public, max-age=60'
        }));
        return r2Base ? `${r2Base}/${appKey(slug)}` : null;
    } catch (e) {
        console.warn('engine: R2 publish failed:', e.message);
        return null;
    }
}

async function removeFromR2(slug) {
    if (!R2_ON) return;
    try { await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: appKey(slug) })); }
    catch (e) { console.warn('engine: R2 delete failed:', e.message); }
}

/* ---- تعليمات الموديل: يبني تطبيق GIS كاملاً في ملفٍ واحد ----
   هذا النصّ ثابتٌ لكلّ الطلبات، لذا يُكاش (prompt caching) على Claude بتكلفةٍ
   تقارب 10% من الإدخال العاديّ؛ فنجعله مفصّلاً بأمثلةٍ جاهزة بلا قلقٍ من الكلفة. */
const SYSTEM_INSTRUCTION = [
    'أنت «PalNovaa 1.0»، محرّكٌ خبيرٌ من الطراز الأوّل يبني تطبيقات نظم المعلومات الجغرافية (GIS) تفاعليّة واحترافيّة.',
    'مهمّتك: من وصف المستخدم، تُنتج تطبيق ويب كاملاً في ملفٍ واحد (single-file HTML) جاهزاً للتشغيل فوراً دون أيّ خطوةٍ إضافيّة.',
    '',
    '— قواعد الإخراج (صارمة) —',
    '1) أخرِج مستند HTML كاملاً فقط: يبدأ بـ <!doctype html> وينتهي بـ </html>. لا شرح ولا نصّ قبله ولا بعده، ولا تضعه داخل أسوار ```.',
    '2) اكتب الكود كاملاً فعليّاً. ممنوع منعاً باتّاً ترك عناصر نائبة مثل «... بقيّة الكود» أو «أضف المزيد هنا» أو دوالّ فارغة. كلّ دالّة مُنفَّذة بالكامل، وكلّ زرّ موصولٌ بوظيفةٍ حقيقيّة.',
    '3) ملفٌ واحد مكتفٍ ذاتيّاً: كلّ الـCSS و JavaScript داخل الصفحة. لا ملفات خارجيّة سوى مكتبات CDN موثوقة.',
    '4) في أوّل سطرٍ بعد <!doctype html> ضع تعليقاً واحداً بهذا الشكل بالضبط: <!--PNE:{"title":"عنوان قصير للمشروع","summary":"جملة تصف ما بُني"}-->',
    '5) اجعل <title> مطابقاً للعنوان.',
    '',
    '— الخرائط والتحليل المكانيّ —',
    '• استخدم Leaflet 1.9.4 من cdnjs: ضمّن leaflet.css و leaflet.js.',
    '• بلاط الخريطة الأساس: خرائط Google عبر L.tileLayer(\'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}\', {subdomains:[\'mt0\',\'mt1\',\'mt2\',\'mt3\'], maxZoom:20}). يمكنك عرض بلاط أقمار صناعيّة بـ lyrs=s عند الحاجة.',
    '• للتحليل المكانيّ استخدم Turf.js 6.5.0 من cdnjs عند الحاجة: buffer, union, intersect, area, centroid, distance, nearestPoint, pointsWithinPolygon, voronoi, bbox, booleanPointInPolygon.',
    '• هيّئ الخريطة بعد تحميل DOM، واضبط setView على منطقةٍ منطقيّة (فلسطين/الضفة الغربيّة افتراضاً: [31.95, 35.23], zoom 9، أو نابلس [32.22, 35.26]).',
    '• لا تستخدم أيّ خدمةٍ تتطلّب مفتاح API. كلّ شيء يعمل بلا مفاتيح وبلا تسجيل. للترميز الجغرافيّ استخدم Nominatim العامّ (https://nominatim.openstreetmap.org/search?format=json&q=...) باعتدال.',
    '',
    '— البيانات —',
    '• إن لم يُرفق المستخدم بيانات، ولّد بياناتٍ تجريبيّة منطقيّة وواقعيّة (GeoJSON مدمج) مناسبة لفلسطين (مدن، أحياء، قطع أراضٍ، طرق، نقاط خدمات) بأسماءٍ عربيّة صحيحة وإحداثيّاتٍ معقولة.',
    '• لوّن الطبقات ترميزاً متدرّجاً (choropleth) حسب قيمةٍ منطقيّة، وأضِف نافذة منبثقة (popup/tooltip) تعرض خصائص كلّ عنصر.',
    '',
    '— الواجهة والتصميم —',
    '• الواجهة عربيّة RTL، عصريّة واحترافيّة، متجاوبة مع الجوّال، بتصميمٍ داكنٍ أنيق افتراضاً (خلفيّة قرابة #0A0B0D، لمسة برتقاليّة #E07B39)، بخطوطٍ ومسافاتٍ مريحة وحوافٍّ ناعمة.',
    '• أضِف لوحةً جانبيّة للطبقات (تبديل الظهور)، ومفتاح ألوان (legend)، ومؤشّرات (KPIs)، وأدوات بحث/فلترة حين تناسب الطلب.',
    '• اجعل الخريطة تملأ المساحة، واللوحات فوقها أو بجانبها بشكلٍ مرتّب لا يعيق التفاعل.',
    '',
    '— الجودة —',
    '• فكّر في أفضل تصميمٍ وميزاتٍ للطلب ونفّذها بإتقان؛ لا تكتفِ بالحدّ الأدنى، لكن اجعل الكود سليماً ومتماسكاً وخالياً من الأخطاء البرمجيّة.',
    '• تحقّق ذهنيّاً أنّ التطبيق يعمل: لا متغيّرات غير معرّفة، لا استدعاءات لعناصر غير موجودة، ترتيب تحميل صحيح للمكتبات.',
    '',
    'عند التعديل على تطبيقٍ قائم: أعِد إخراج المستند الكامل بعد تطبيق التغيير المطلوب فقط، محافظاً على بقيّة الكود والميزات كما هي.'
].join('\n');

/* ---- استخلاص HTML + العنوان + الموجز من ردّ الموديل ---- */
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
    if (meta) { try { const j = JSON.parse(meta[1]); title = j.title || null; summary = j.summary || null; } catch { /* ignore */ } }
    if (!title) { const t = html.match(/<title>([\s\S]*?)<\/title>/i); if (t) title = t[1].trim(); }
    if (!title) title = (fallbackPrompt || 'تطبيق GIS').slice(0, 60);
    if (!summary) summary = (fallbackPrompt || '').slice(0, 160);
    return { html, title, summary };
}

/* ---- تحديد المزوّد: Claude أوّلاً من بادئة المفتاح، ثمّ OpenAI-compatible، ثمّ Gemini ---- */
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

/* ---- نداء الموديل: يوحّد المزوّدات، ويُكمل تلقائياً إذا قُطِع الكود. يعيد { text, usage } ---- */
async function callModel(KEY, prompt, currentHtml) {
    const prov = pickProvider(KEY);
    const usage = blankUsage();

    /* ===== Anthropic Claude (أصليّ) مع prompt caching ===== */
    if (prov.kind === 'anthropic') {
        // النظام ثابتٌ → نضع عليه cache_control فيُكاش (قراءةٌ بـ~10% من الكلفة).
        const system = [{ type: 'text', text: SYSTEM_INSTRUCTION, cache_control: { type: 'ephemeral' } }];
        const messages = [];
        if (currentHtml) {
            // الكود الحاليّ طويلٌ ويتكرّر مع كلّ تعديل → نكاشه أيضاً.
            messages.push({ role: 'user', content: [{ type: 'text', text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```', cache_control: { type: 'ephemeral' } }] });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
        const headers = { 'x-api-key': KEY, 'anthropic-version': '2023-06-01' };
        let full = '';
        for (let i = 0; i < 5; i++) {
            // لا نرسل temperature (قيمةٌ غير افتراضيّة تُرفَض على Sonnet 5.5).
            const data = await postJSON(prov.url, { model: prov.model, max_tokens: MAXTOK, system, messages }, headers, 290000);
            const blocks = Array.isArray(data?.content) ? data.content : [];
            const piece = blocks.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('');
            full += piece;
            const u = data?.usage || {};
            usage.input += u.input_tokens || 0;
            usage.output += u.output_tokens || 0;
            usage.cacheRead += u.cache_read_input_tokens || 0;
            usage.cacheWrite += u.cache_creation_input_tokens || 0;
            if (data?.stop_reason !== 'max_tokens' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    /* ===== OpenAI-compatible (OpenRouter / Groq / NVIDIA) ===== */
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
            usage.input += u.prompt_tokens || 0;
            usage.output += u.completion_tokens || 0;
            usage.cacheRead += u.prompt_tokens_details?.cached_tokens || 0;
            const fin = choice?.finish_reason || choice?.native_finish_reason;
            if (fin !== 'length' || looksComplete(full)) break;
            messages.push({ role: 'assistant', content: piece });
            messages.push({ role: 'user', content: CONTINUE_MSG });
        }
        return { text: full.trim(), usage };
    }

    /* ===== Google Gemini ===== */
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const contents = [];
    if (currentHtml) {
        contents.push({ role: 'user', parts: [{ text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' }] });
        contents.push({ role: 'model', parts: [{ text: 'تمام، ما التعديل المطلوب؟' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    let full = '';
    for (let i = 0; i < 5; i++) {
        const payload = {
            systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192, topP: 0.95 }
        };
        const data = await postJSON(url, payload, { 'x-goog-api-key': KEY }, 290000);
        const cand = data?.candidates?.[0];
        const piece = (cand?.content?.parts || []).map((p) => p?.text || '').join('');
        full += piece;
        const u = data?.usageMetadata || {};
        usage.input += u.promptTokenCount || 0;
        usage.output += u.candidatesTokenCount || 0;
        usage.cacheRead += u.cachedContentTokenCount || 0;
        if (cand?.finishReason !== 'MAX_TOKENS' || looksComplete(full)) break;
        contents.push({ role: 'model', parts: [{ text: piece }] });
        contents.push({ role: 'user', parts: [{ text: CONTINUE_MSG }] });
    }
    return { text: full.trim(), usage };
}

/* ============================ التوليد ============================ */
// POST /api/engine/generate  { prompt, currentHtml?, key? }
router.post('/generate', optionalAuth, async (req, res) => {
    const b = req.body || {};
    const prompt = (b.prompt || '').toString().trim().slice(0, 4000);
    const currentHtml = typeof b.currentHtml === 'string' ? b.currentHtml.slice(0, 160000) : '';
    if (!prompt) return res.status(400).json({ ok: false, reason: 'empty prompt' });

    const reqKey = typeof b.key === 'string' ? b.key.trim() : '';
    const KEY = reqKey || (USE_OAI ? (OAI_KEY || SERVER_KEY) : SERVER_KEY);
    if (!KEY) return res.json({ ok: false, reason: 'missing_key', model: MODEL_NAME });

    const isTransient = (m) => /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m || '');
    let lastErr = 'unavailable';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt));
        try {
            const { text, usage } = await callModel(KEY, prompt, currentHtml);
            if (!text) { lastErr = 'empty'; continue; }
            const out = parseGenerated(text, prompt);
            if (!out.html || out.html.length < 60) { lastErr = 'no_html'; continue; }
            return res.json({ ok: true, model: MODEL_NAME, usage, ...out });
        } catch (err) {
            lastErr = String(err.message || 'unavailable');
            if (!isTransient(lastErr)) break;
        }
    }
    const reason = isTransient(lastErr) ? 'الموديل مزدحمٌ الآن (ضغطٌ مؤقّت من المزوّد). جرّب بعد لحظات.' : lastErr;
    return res.json({ ok: false, reason, model: MODEL_NAME });
});

/* ============================ المشاريع ============================ */
// POST /api/engine/projects  { title, prompt, summary, html }
router.post('/projects', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const b = req.body || {};
        const title = (b.title || 'تطبيق GIS').toString().slice(0, 160);
        const prompt = (b.prompt || '').toString().slice(0, 4000);
        const summary = (b.summary || '').toString().slice(0, 300);
        const html = (b.html || '').toString();
        if (!html || html.length < 60) return res.status(400).json({ ok: false, reason: 'empty html' });
        const ownerId = req.user?.id || req.user?.userId || null;

        let slug = makeSlug(), saved = null;
        for (let i = 0; i < 5; i++) {
            try {
                const r = await pool.query(
                    `INSERT INTO engine_projects (slug, title, prompt, summary, html, owner_id)
                     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, slug, title, summary, created_at`,
                    [slug, title, prompt, summary, html, ownerId]
                );
                saved = r.rows[0]; break;
            } catch (e) { if (/unique/i.test(e.message)) { slug = makeSlug(); continue; } throw e; }
        }
        if (!saved) throw new Error('slug conflict');

        // رفع النسخة المنشورة إلى R2 (دومين منفصل = عزلٌ أمنيّ).
        const publicUrl = await publishToR2(saved.slug, html);
        if (publicUrl) { await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, saved.slug]); saved.public_url = publicUrl; }

        return res.json({ ok: true, project: saved, url: `/pe/${saved.slug}`, public_url: publicUrl });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// PUT /api/engine/projects/:slug  { title?, html?, summary?, prompt? }
router.put('/projects/:slug', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const slug = req.params.slug;
        const b = req.body || {};
        const fields = [], vals = []; let i = 1;
        ['title', 'summary', 'prompt', 'html'].forEach((k) => {
            if (typeof b[k] === 'string') { fields.push(`${k}=$${i++}`); vals.push(b[k]); }
        });
        if (!fields.length) return res.status(400).json({ ok: false, reason: 'nothing to update' });
        fields.push(`updated_at=now()`); vals.push(slug);
        const r = await pool.query(`UPDATE engine_projects SET ${fields.join(', ')} WHERE slug=$${i} RETURNING id, slug, title, summary, updated_at`, vals);
        if (!r.rows.length) return res.status(404).json({ ok: false, reason: 'not found' });

        // إن تغيّر الكود، أعِد نشر نسخة R2.
        let publicUrl = null;
        if (typeof b.html === 'string' && b.html.length >= 60) {
            publicUrl = await publishToR2(slug, b.html);
            if (publicUrl) { await pool.query(`UPDATE engine_projects SET public_url=$1 WHERE slug=$2`, [publicUrl, slug]); r.rows[0].public_url = publicUrl; }
        }

        return res.json({ ok: true, project: r.rows[0], url: `/pe/${slug}`, public_url: publicUrl });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

// GET /api/engine/projects  — قائمة (مشاريع المستخدم إن سجّل، وإلا الأحدث)
router.get('/projects', optionalAuth, async (req, res) => {
    try {
        await ensureTable();
        const ownerId = req.user?.id || req.user?.userId || null;
        const r = ownerId
            ? await pool.query(`SELECT id, slug, title, summary, updated_at FROM engine_projects WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 60`, [ownerId])
            : await pool.query(`SELECT id, slug, title, summary, updated_at FROM engine_projects ORDER BY updated_at DESC LIMIT 30`);
        return res.json({ ok: true, projects: r.rows });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error'), projects: [] });
    }
});

// GET /api/engine/projects/:slug  — مشروع كامل (عامّ، للعارض)
router.get('/projects/:slug', async (req, res) => {
    try {
        await ensureTable();
        const r = await pool.query(`SELECT id, slug, title, summary, prompt, html, public_url, created_at, updated_at FROM engine_projects WHERE slug=$1`, [req.params.slug]);
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
        await pool.query(`DELETE FROM engine_projects WHERE slug=$1`, [req.params.slug]);
        await removeFromR2(req.params.slug);
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

module.exports = router;
