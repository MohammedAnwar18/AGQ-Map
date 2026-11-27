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
                const short = String(s.name).split('/').pop();
                return { name: short, type: s.type, url: `${url}/${short}/${s.type}` };
            }),
        };
    }
    throw new Error('استجابةٌ غير معروفة من الخادم');
}

/* ---- وصفُ طبقة: الحقول والهندسة والعدد ---- */
async function describeLayer(serviceUrl, layerId) {
    const base = `${clean(serviceUrl)}/${String(layerId).replace(/\D/g, '')}`;
    const j = await getJSON(base + '?f=json');
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

module.exports = { discover, describeLayer, fetchFeatures, getJSON };
