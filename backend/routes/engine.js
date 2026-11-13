const express = require('express');
const https = require('https');
const pool = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

/* ============================================================================
   PalNovaa Engine — محرّك بالنوفا
   ----------------------------------------------------------------------------
   محرّكٌ يبني تطبيقات GIS من وصفٍ نصّيّ. المستخدم يكتب ما يريد، فيردّ الموديل
   «PalNovaa 1.0» بتطبيقٍ كامل (HTML مستقلّ، Leaflet + Turf)، يُحفَظ في قاعدة
   البيانات ويُعطى رابطاً دائماً يعمل في أيّ وقت (مثل Replit).

   «PalNovaa 1.0» اسمٌ تجاريّ لنا؛ محرّكه الفعليّ Google Gemini، ومفتاحه يبقى
   في الخادم (متغيّر بيئة) فلا يُكشف في حزمة المتصفّح.
   ============================================================================ */

const MODEL_NAME = 'PalNovaa 1.0';

/* المزوّد: إمّا نقطةٌ متوافقة مع OpenAI (OpenRouter/Groq/NVIDIA NIM/Mistral…)
   عبر PALNOVAA_API_URL، وإلّا Google Gemini افتراضاً. يُبدَّل بلا تعديل كود. */
const OAI_URL = (process.env.PALNOVAA_API_URL || '').trim();         // مثال: https://openrouter.ai/api/v1/chat/completions
const USE_OAI = !!OAI_URL;
const OAI_KEY = process.env.PALNOVAA_API_KEY || '';
const GEMINI_MODEL = process.env.PALNOVAA_MODEL || 'gemini-3.8-flash';
const OAI_MODEL = process.env.PALNOVAA_MODEL || 'deepseek/deepseek-chat-v3:free';
const SERVER_KEY = process.env.PALNOVAA_MODEL_KEY || process.env.GEMINI_API_KEY || '';

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
                owner_id    INTEGER,
                created_at  TIMESTAMPTZ DEFAULT now(),
                updated_at  TIMESTAMPTZ DEFAULT now()
            );
        `).catch((e) => { tableReady = null; throw e; });
    }
    return tableReady;
}

const makeSlug = () => Math.random().toString(36).slice(2, 9);

/* ---- تعليمات الموديل: يبني تطبيق GIS كاملاً في ملفٍ واحد ---- */
const SYSTEM_INSTRUCTION = [
    'أنت «PalNovaa 1.0»، محرّكٌ خبيرٌ يبني تطبيقات نظم المعلومات الجغرافية (GIS) تفاعليّة.',
    'مهمّتك: من وصف المستخدم، تُنتج تطبيق ويب كاملاً في ملفٍ واحد (single-file HTML) جاهزاً للتشغيل فوراً.',
    '',
    'قواعد صارمة:',
    '1) أخرِج مستند HTML كاملاً فقط: يبدأ بـ <!doctype html> وينتهي بـ </html>. لا شرح قبله ولا بعده.',
    '2) ملفٌ واحد مكتفٍ ذاتيّاً: CSS و JavaScript داخل الصفحة. لا ملفات خارجية سوى مكتبات CDN موثوقة.',
    '3) للخرائط استخدم Leaflet 1.9.4 من cdnjs، وبلاط خرائط Google عبر الرابط:',
    '   https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}  (subdomains: mt0,mt1,mt2,mt3).',
    '   وللتحليل المكانيّ استخدم Turf.js 6.5.0 من cdnjs عند الحاجة.',
    '4) لا تستخدم أيّ خدمةٍ تتطلّب مفتاح API. كلّ شيء يعمل بلا مفاتيح وبلا تسجيل.',
    '5) الواجهة عربيّة باتجاه RTL، عصريّة واحترافيّة، متجاوبة مع الجوّال، بتصميمٍ داكنٍ أنيق افتراضاً.',
    '6) اجعل التطبيق فعليّاً ويعمل: أزرار حقيقيّة، طبقات، تحليل، بيانات تجريبيّة منطقيّة إن لزم (فلسطين/الضفة افتراضاً).',
    '7) في أوّل سطرٍ بعد <!doctype html> ضع تعليقاً واحداً بهذا الشكل بالضبط:',
    '   <!--PNE:{"title":"عنوان قصير للمشروع","summary":"جملة تصف ما بُني"}-->',
    '8) اجعل <title> مطابقاً للعنوان. لا تتجاوز المعقول في الحجم؛ ركّز على جودة التنفيذ.',
    'عند التعديل على تطبيقٍ قائم: أعِد إخراج المستند الكامل بعد تطبيق التغيير المطلوب فقط، محافظاً على الباقي.'
].join('\n');

/* ---- استخلاص HTML + العنوان + الموجز من ردّ الموديل ---- */
function parseGenerated(text, fallbackPrompt) {
    let html = (text || '').trim();
    const fence = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fence) html = fence[1].trim();
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

/* ---- نداء الموديل: يوحّد مزوّد OpenAI-compatible و Gemini، ويُعيد نصّ الردّ ---- */
async function callModel(KEY, prompt, currentHtml) {
    if (USE_OAI) {
        const messages = [{ role: 'system', content: SYSTEM_INSTRUCTION }];
        if (currentHtml) {
            messages.push({ role: 'user', content: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' });
            messages.push({ role: 'assistant', content: 'تمام، ما التعديل المطلوب؟' });
        }
        messages.push({ role: 'user', content: prompt });
        const headers = { Authorization: `Bearer ${KEY}` };
        // ترويسات يطلبها OpenRouter (اختياريّة لكن مفيدة)
        if (/openrouter/i.test(OAI_URL)) { headers['HTTP-Referer'] = 'https://palnovaa.com'; headers['X-Title'] = 'PalNovaa Engine'; }
        const data = await postJSON(OAI_URL, { model: OAI_MODEL, messages, temperature: 0.4, max_tokens: 8192 }, headers);
        const msg = data?.choices?.[0]?.message;
        return ((msg && (typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map((c) => c?.text || '').join('') : ''))) || '').trim();
    }
    // Gemini
    const contents = [];
    if (currentHtml) {
        contents.push({ role: 'user', parts: [{ text: 'هذا هو التطبيق الحاليّ:\n```html\n' + currentHtml + '\n```' }] });
        contents.push({ role: 'model', parts: [{ text: 'تمام، ما التعديل المطلوب؟' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const payload = {
        systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, topP: 0.95 }
    };
    const data = await postJSON(url, payload, { 'x-goog-api-key': KEY });
    return (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('').trim();
}

/* ============================ التوليد ============================ */
// POST /api/engine/generate  { prompt, currentHtml?, key? }
router.post('/generate', optionalAuth, async (req, res) => {
    const b = req.body || {};
    const prompt = (b.prompt || '').toString().trim().slice(0, 4000);
    const currentHtml = typeof b.currentHtml === 'string' ? b.currentHtml.slice(0, 120000) : '';
    if (!prompt) return res.status(400).json({ ok: false, reason: 'empty prompt' });

    const reqKey = typeof b.key === 'string' ? b.key.trim() : '';
    const KEY = reqKey || (USE_OAI ? (OAI_KEY || SERVER_KEY) : SERVER_KEY);
    if (!KEY) return res.json({ ok: false, reason: 'missing_key', model: MODEL_NAME });

    const isTransient = (m) => /high demand|overload|unavailable|try again|temporar|503|502|429|rate limit|quota|exhausted/i.test(m || '');
    let lastErr = 'unavailable';
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1200 * attempt)); // تأخّرٌ تصاعديّ قبل إعادة المحاولة
        try {
            const text = await callModel(KEY, prompt, currentHtml);
            if (!text) { lastErr = 'empty'; continue; }
            const out = parseGenerated(text, prompt);
            if (!out.html || out.html.length < 60) { lastErr = 'no_html'; continue; }
            return res.json({ ok: true, model: MODEL_NAME, ...out });
        } catch (err) {
            lastErr = String(err.message || 'unavailable');
            if (!isTransient(lastErr)) break; // خطأٌ غير مؤقّت: لا فائدة من التكرار
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
        return res.json({ ok: true, project: saved, url: `/pe/${saved.slug}` });
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
        return res.json({ ok: true, project: r.rows[0], url: `/pe/${slug}` });
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
        const r = await pool.query(`SELECT id, slug, title, summary, prompt, html, created_at, updated_at FROM engine_projects WHERE slug=$1`, [req.params.slug]);
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
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, reason: String(err.message || 'db error') });
    }
});

module.exports = router;
