/* ============================================================================
   مُستخرِج ArcGIS REST — اكتشافٌ وسحبٌ مُرقَّم
   يُستعمَل من عامل الترحيل (لا من دوالّ Vercel)، فقد يعمل دقائق.
   ============================================================================ */

const UA = 'PalNovaaDataEngine/1.0';

/* جلبُ JSON مع مهلةٍ وإعادةِ محاولة — خوادم الجهات الحكوميّة تتقطّع أحياناً */
async function getJSON(url, { timeoutMs = 90000, retries = 2 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), timeoutMs);
        try {
            const r = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } });
            clearTimeout(timer);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const j = await r.json();
            if (j && j.error) throw new Error(j.error.message || 'خطأ من خادم ArcGIS');
            return j;
        } catch (e) {
            clearTimeout(timer);
            lastErr = e;
            if (attempt < retries) await new Promise((s) => setTimeout(s, 1500 * (attempt + 1)));
        }
    }
    throw lastErr;
}

const clean = (u) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');

/* ---- اكتشاف: دليلُ خدماتٍ أو خدمةٌ مفردة ---- */
async function discover(rawUrl) {
    const url = clean(rawUrl);
    if (!/\/rest\/services/i.test(url)) throw new Error('الرابط يجب أن يكون ArcGIS REST (يحوي /rest/services)');
    const j = await getJSON(url + '?f=json');

    if (Array.isArray(j.layers) || j.mapName || j.serviceDataType) {
        const m = url.match(/\/(MapServer|FeatureServer|ImageServer)$/i);
        return {
            kind: 'service', url, serviceType: m ? m[1] : 'MapServer',
            name: j.mapName || url.split('/services/').pop(),
            description: (j.serviceDescription || j.description || '').slice(0, 400),
            layers: (j.layers || []).map((l) => ({ id: l.id, name: l.name, geometryType: l.geometryType || null })),
        };
    }
    if (Array.isArray(j.services) || Array.isArray(j.folders)) {
        return {
            kind: 'directory', url,
            folders: (j.folders || []).map((f) => ({ name: f, url: `${url}/${f}` })),
            services: (j.services || []).map((s) => {
                // من الجذر يُعيد ArcGIS الاسم «مجلّد/خدمة»؛ فقصُّ المجلّد يبني
                // رابطاً لا وجود له. نبني من جذر services بالاسم كاملاً.
                const full = String(s.name);
                const root = url.replace(/(\/rest\/services).*$/i, '$1');
                return { name: full.split('/').pop(), type: s.type, url: `${root}/${full}/${s.type}` };
            }),
        };
    }
    throw new Error('استجابةٌ غير معروفة من الخادم');
}

/* ---- وصفُ طبقة: الحقول والهندسة والعدد ---- */
async function describeLayer(serviceUrl, layerId) {
    const sv = clean(serviceUrl);
    if (!/\/(MapServer|FeatureServer|ImageServer)$/i.test(sv)) {
        throw new Error(`رابطُ خدمةٍ غير صالح: «${sv}» — يجب أن ينتهي بـMapServer أو FeatureServer`);
    }
    const base = `${sv}/${String(layerId).replace(/\D/g, '')}`;
    let j;
    try { j = await getJSON(base + '?f=json'); }
    catch (e) { throw new Error(`${e.message} — عند قراءة ${base}`); }
    const fields = (j.fields || [])
        .filter((f) => f && f.name && !/^(shape|st_area|st_length|shape_)/i.test(f.name))
        .map((f) => ({ name: f.name, alias: f.alias || f.name, type: String(f.type || '').replace('esriFieldType', '') }));

    let count = null;
    try {
        const c = await getJSON(`${base}/query?where=1%3D1&returnCountOnly=true&f=json`, { timeoutMs: 60000 });
        count = c.count != null ? c.count : (c.properties && c.properties.count);
    } catch { /* بعض الخوادم لا تدعمه */ }

    return {
        url: base, name: j.name || `layer ${layerId}`,
        geometryType: String(j.geometryType || '').replace('esriGeometry', '') || null,
        objectIdField: j.objectIdField || 'OBJECTID',
        maxRecordCount: j.maxRecordCount || 1000,
        fields, count,
    };
}

/* ---- السحب المُرقَّم: يُسلّم دفعاتٍ عبر onBatch بدل تجميع كلّ شيءٍ في الذاكرة ----
   نرقّم بـresultOffset ما أمكن؛ وإن لم يدعمه الخادم نرقّم بمعرّفات الكائنات. */
async function* fetchFeatures(layerUrl, { where = '1=1', pageSize = 2000, maxFeatures = Infinity } = {}) {
    const base = clean(layerUrl);
    const w = encodeURIComponent(where || '1=1');
    let offset = 0, yielded = 0, guard = 0;

    while (guard++ < 5000 && yielded < maxFeatures) {
        const url = `${base}/query?where=${w}&outFields=*&outSR=4326&f=geojson&returnGeometry=true`
            + `&resultOffset=${offset}&resultRecordCount=${pageSize}`;
        const j = await getJSON(url);
        const feats = Array.isArray(j.features) ? j.features : [];
        if (!feats.length) return;

        yield feats;
        yielded += feats.length;
        offset += feats.length;

        const more = j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit);
        if (!more && feats.length < pageSize) return;
    }
}

/* قيمُ حقلٍ مع أعدادها — ليختار المستخدمَ منها بدل كتابة SQL.
   ثلاثُ محاولاتٍ متدرّجة، لأنّ خوادم ArcGIS تختلف في ما تدعمه:
     ١) إحصاءٌ مجمّع (groupBy + count) — الأفضل: قيمةٌ وعددُها.
     ٢) returnDistinctValues — قيمٌ بلا أعداد.
     ٣) مسحُ صفحةٍ وتفريدٌ محلّيّ — تقريبيٌّ، ويُعلَّم بذلك صراحةً. */
async function fieldValues(layerUrl, field, { limit = 500, sample = 4000 } = {}) {
    const u = clean(layerUrl).replace(/\/query.*$/i, '');
    const f = String(field || '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(f)) throw new Error('اسمُ حقلٍ غير صالح');
    const q = (p) => `${u}/query?${p}&f=json`;
    const oops = (j) => { if (j && j.error) throw new Error(j.error.message || 'خطأٌ من الخادم'); return j; };

    // ١) مجمّعٌ بالعدد
    try {
        const stats = encodeURIComponent(JSON.stringify([
            { statisticType: 'count', onStatisticField: f, outStatisticFieldName: 'n' }]));
        const j = oops(await getJSON(q(
            `where=1%3D1&groupByFieldsForStatistics=${encodeURIComponent(f)}&outStatistics=${stats}`
            + `&orderByFields=n%20DESC&returnGeometry=false&resultRecordCount=${limit}`), { timeoutMs: 90000 }));
        const rows = (j.features || []).map((x) => x.attributes || {});
        const vals = rows.map((a) => ({ value: a[f], count: Number(a.n) || 0 }))
            .filter((v) => v.value != null && String(v.value).trim() !== '');
        if (vals.length) return { field: f, values: vals, method: 'count', exact: true };
    } catch { /* نُجرّب التالي */ }

    // ٢) قيمٌ مميّزةٌ بلا أعداد
    try {
        const j = oops(await getJSON(q(
            `where=1%3D1&outFields=${encodeURIComponent(f)}&returnDistinctValues=true`
            + `&returnGeometry=false&orderByFields=${encodeURIComponent(f)}&resultRecordCount=${limit}`),
            { timeoutMs: 90000 }));
        const seen = new Set();
        (j.features || []).forEach((x) => {
            const v = (x.attributes || {})[f];
            if (v != null && String(v).trim() !== '') seen.add(v);
        });
        if (seen.size) {
            return { field: f, values: [...seen].map((value) => ({ value, count: null })),
                method: 'distinct', exact: true };
        }
    } catch { /* نُجرّب التالي */ }

    // ٣) عيّنةٌ وتفريدٌ محلّيّ — تقريبيّ
    const j = oops(await getJSON(q(
        `where=1%3D1&outFields=${encodeURIComponent(f)}&returnGeometry=false&resultRecordCount=${sample}`),
        { timeoutMs: 120000 }));
    const m = new Map();
    (j.features || []).forEach((x) => {
        const v = (x.attributes || {})[f];
        if (v == null || String(v).trim() === '') return;
        m.set(v, (m.get(v) || 0) + 1);
    });
    const values = [...m.entries()].map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count).slice(0, limit);
    return { field: f, values, method: 'sample', exact: false, sampled: (j.features || []).length };
}

module.exports = { discover, describeLayer, fetchFeatures, fieldValues, getJSON };
