const express = require('express');
const https = require('https');
const router = express.Router();

/* ============================================================
   Foresight — نقاطٌ عامّة بلا تسجيل

   صفحة التحليل المكانيّ الذكيّ يفتحها أيّ زائر، فنقاطها هنا عامّة.
   وأهمّها وسيطُ الأخبار: مصادر الأخبار لا تسمح بالطلب المباشر من
   المتصفّح (CORS)، فنجلبها هنا من الخادم ونردّها منسّقة — فتبقى
   الصفحة «حيّةً» بما يقع الآن قربَ الموضع، بلا مفتاحٍ ولا تسجيل.

   المصدر: GDELT DOC 2.0 API — فهرسٌ عالميّ مفتوحٌ للأخبار، يشمل
   العربية، ولا يتطلّب مفتاحاً.
   ============================================================ */

/* ذاكرةٌ قصيرة داخل النسخة الحارّة — تخفّف الضغط وتُسرّع التكرار */
const cache = new Map();
const TTL = 5 * 60 * 1000; // خمس دقائق

const postJSON = (url, bodyObj, headers = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(bodyObj), 'utf8');
    const u = new URL(url);
    const req = https.request({
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': body.length,
            Accept: 'application/json',
            ...headers
        }
    }, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; if (data.length > 6_000_000) req.destroy(); });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (res.statusCode && res.statusCode >= 400) {
                    return reject(new Error(json?.error?.message || `upstream ${res.statusCode}`));
                }
                resolve(json);
            } catch { reject(new Error(`bad json (${res.statusCode})`)); }
        });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
});

const getJSON = (url, timeoutMs = 9000) => new Promise((resolve, reject) => {
    const req = https.get(url, {
        headers: { 'User-Agent': 'PalNovaa-Foresight/1.0 (+https://palnovaa.com)', Accept: 'application/json' }
    }, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
            res.resume();
            return reject(new Error(`upstream ${res.statusCode}`));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; if (body.length > 4_000_000) req.destroy(); });
        res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('bad json')); }
        });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
});

/* تاريخ GDELT: ‎YYYYMMDDTHHMMSSZ‎ → ISO */
const parseSeen = (s) => {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(s || ''));
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
};

const buildQuery = (phrase) => {
    const clean = String(phrase || '').replace(/["]/g, ' ').trim();
    if (!clean) return null;
    /* عبارةٌ محصورةٌ بين علامتَي اقتباس — أدقّ من كلماتٍ مبعثرة */
    return clean.split(/\s+/).length > 1 ? `"${clean}"` : clean;
};

const gdeltURL = (q, limit) => {
    const params = new URLSearchParams({
        query: q,
        mode: 'ArtList',
        format: 'json',
        maxrecords: String(Math.min(50, Math.max(1, limit))),
        sort: 'DateDesc',
        timespan: '14d'
    });
    return `https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`;
};

const normalise = (data, limit) => {
    const rows = Array.isArray(data?.articles) ? data.articles : [];
    return rows.slice(0, limit).map(a => ({
        title: a.title || null,
        url: a.url || a.url_mobile || null,
        domain: a.domain || null,
        date: parseSeen(a.seendate),
        language: a.language || null,
        image: a.socialimage || null,
        country: a.sourcecountry || null
    })).filter(a => a.title && a.url);
};

// GET /api/foresight/news?q=&city=&kind=&limit=
router.get('/news', async (req, res) => {
    const q = (req.query.q || '').toString().trim();
    const city = (req.query.city || '').toString().trim();
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));

    /* نجرّب المدينة أوّلاً (أدقّ فهرسةً)، ثم وصفَ الموضع كبديل */
    const candidates = [];
    const cityQ = buildQuery(city);
    const qQ = buildQuery(q);
    if (cityQ) candidates.push(cityQ);
    if (qQ && qQ !== cityQ) candidates.push(qQ);

    if (!candidates.length) {
        return res.json({ articles: [], source: 'GDELT', query: null, reason: 'no query' });
    }

    const key = candidates.join('|') + `::${limit}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
        return res.json(hit.payload);
    }

    try {
        let articles = [];
        let used = null;
        for (const cand of candidates) {
            try {
                const data = await getJSON(gdeltURL(cand, limit));
                const got = normalise(data, limit);
                if (got.length) { articles = got; used = cand; break; }
                if (!used) used = cand;
            } catch {
                /* جرّب المرشّح التالي */
            }
        }
        const payload = { articles, source: 'GDELT DOC 2.0', query: used, count: articles.length };
        cache.set(key, { at: Date.now(), payload });
        return res.json(payload);
    } catch (err) {
        return res.json({ articles: [], source: 'GDELT', query: candidates[0], reason: 'upstream unavailable' });
    }
});

/* ============================================================
   الموجز الذكيّ — Gemini + Google Search grounding

   يفهم الحدث ومكانه، ويجلب ما يتّصل به من مصادرَ حيّة، ويربطه
   بموضع الوقوع والسيناريو. المفتاح يبقى في الخادم (متغيّر بيئة
   ‎GEMINI_API_KEY‎ مع قيمةٍ احتياطية) فلا يُكشف في حزمة المتصفّح.

   مفتاح ‎AQ.‎ الجديد من Google يعمل على النقطة الأصلية لا على
   النقاط المتوافقة مع OpenAI، ويُمرَّر عبر ترويسة ‎x-goog-api-key‎.
   ============================================================ */
/* المفتاح من متغيّر البيئة فقط — لا يُكتب في الشيفرة ولا في المستودع */
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const KIND_LABEL = {
    accident: 'حادث سير', closure: 'إغلاق طريق', fire: 'حريق',
    power: 'انقطاع كهرباء', crowd: 'تجمّع كثيف', medical: 'طارئ طبّي'
};

const briefCache = new Map();

router.post('/brief', async (req, res) => {
    const b = req.body || {};
    const place = (b.place || '').toString().slice(0, 160);
    const city = (b.city || '').toString().slice(0, 80);
    const kindLabel = KIND_LABEL[b.kind] || 'حدث';
    const hour = Number.isFinite(+b.hour) ? +b.hour : null;
    const lat = Number.isFinite(+b.lat) ? +b.lat : null;
    const lon = Number.isFinite(+b.lon) ? +b.lon : null;
    const cover = (b.cover || '').toString().slice(0, 60);
    const description = (b.description || '').toString().slice(0, 300);
    const nearby = Array.isArray(b.nearby) ? b.nearby.slice(0, 10).map(String) : [];

    const where = place || city || (lat != null ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : null);
    if (!where) return res.json({ ok: false, brief: null, sources: [], reason: 'no location' });

    /* المفتاح: من جسم الطلب (متصفّح المستخدم) أوّلاً، ثم متغيّر البيئة.
       لا يُسجَّل ولا يُخزَّن — يُستعمل لهذا الطلب فقط */
    const reqKey = typeof b.key === 'string' ? b.key.trim() : '';
    const KEY = reqKey || GEMINI_KEY;
    if (!KEY) return res.json({ ok: false, brief: null, sources: [], reason: 'missing GEMINI_API_KEY' });

    const key = `${where}::${b.kind}::${hour}`;
    const hit = briefCache.get(key);
    if (hit && Date.now() - hit.at < TTL) return res.json(hit.payload);

    const prompt = [
        `أنت محلّلٌ ميدانيّ خبيرٌ في إدارة الطوارئ ونظم المعلومات الجغرافية.`,
        `وقع سيناريو: «${kindLabel}» عند هذا الموضع: ${where}${city ? ` (${city})` : ''}.`,
        description ? `وصفه المستخدم هكذا: «${description}».` : '',
        lat != null ? `الإحداثيّات: ${lat.toFixed(5)}, ${lon.toFixed(5)}.` : '',
        cover ? `الغطاء الأرضيّ الغالب حوله: ${cover}.` : '',
        nearby.length ? `معالمُ قريبة مقروءة من الخريطة: ${nearby.join('، ')}.` : '',
        hour != null ? `ساعة الحدث تقريباً: ${hour}:00.` : '',
        ``,
        `ابحث في مصادرَ حيّة عن هذا المكان وما يحيط به وأيّ أحداثٍ أو ظروفٍ حديثة تتّصل بالسيناريو،`,
        `ثم اكتب موجزاً عمليّاً بالعربية الفصحى يربط السيناريو بهذا المكان تحديداً، بهذا الشكل بالضبط:`,
        `سطرٌ أوّل: «الموجز:» يتبعه ٢–٣ جُمَل مركّزة عمّا يعنيه هذا الحدث في هذا المكان الآن.`,
        `ثم ٣–٥ نقاطٍ عملية، كلُّ نقطةٍ تبدأ بـ«• »، تربط الحدث بما حوله فعلاً (طرق، مرافق حسّاسة، كثافة، ظروف راهنة).`,
        `كن دقيقاً وواقعيّاً، ولا تخترع أسماءً؛ إن لم تجد معلومةً موثوقة فقل ذلك. لا تتجاوز ١٢٠ كلمة.`
    ].filter(Boolean).join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    };

    try {
        const data = await postJSON(url, payload, { 'x-goog-api-key': KEY }, 22000);
        const cand = data?.candidates?.[0];
        const text = (cand?.content?.parts || [])
            .map(p => p?.text || '').join('').trim();

        /* مصادر الإسناد الحيّ — روابط ما اعتمد عليه النموذج */
        const chunks = cand?.groundingMetadata?.groundingChunks || [];
        const seen = new Set();
        const sources = [];
        for (const c of chunks) {
            const w = c?.web;
            if (w?.uri && !seen.has(w.uri)) {
                seen.add(w.uri);
                sources.push({ title: w.title || w.uri, uri: w.uri });
            }
        }

        if (!text) {
            return res.json({ ok: false, brief: null, sources: [], reason: 'empty', model: GEMINI_MODEL });
        }
        const payloadOut = { ok: true, brief: text, sources: sources.slice(0, 8), model: GEMINI_MODEL };
        briefCache.set(key, { at: Date.now(), payload: payloadOut });
        return res.json(payloadOut);
    } catch (err) {
        return res.json({ ok: false, brief: null, sources: [], reason: String(err.message || 'unavailable'), model: GEMINI_MODEL });
    }
});

module.exports = router;
