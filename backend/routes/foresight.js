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

module.exports = router;
