/* ============================================================================
   جسرُ المحرّك ← مكتبة البيانات
   قبل التوليد نسأل المكتبة: أيُّ طبقاتٍ تناسب هذا الطلب، وأيُّ منطقةٍ ذُكرت؟
   ثمّ نحقن في البرومت **وصفاً وروابطَ جلبٍ جاهزة** — لا بيانات. فيبني النموذج
   تطبيقاً يجلب الحقيقيَّ بنفسه، وتبقى التوكِنز ثابتةً مهما كبرت الطبقات.
   كلّ شيءٍ هنا اختياريّ: أيُّ فشلٍ يُتجاهَل بصمتٍ ولا يُعطّل البناء.
   ============================================================================ */

const DATA_API = (process.env.PALNOVAA_DATA_API || 'https://data.palnovaa.com/api').replace(/\/+$/, '');
const ENABLED = String(process.env.PALNOVAA_LIBRARY || '1') !== '0';
const TIMEOUT = parseInt(process.env.PALNOVAA_LIBRARY_TIMEOUT_MS, 10) || 6000;

/* استعلامُ السياق. مهلةٌ قصيرة: المكتبة مُساعِدةٌ لا شرطٌ للبناء. */
async function resolveLibrary(text) {
    if (!ENABLED || !text) return null;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT);
    try {
        const r = await fetch(`${DATA_API}/data/resolve?text=${encodeURIComponent(String(text).slice(0, 1000))}`,
            { signal: ac.signal, headers: { Accept: 'application/json' } });
        clearTimeout(t);
        if (!r.ok) return null;
        const j = await r.json();
        if (!j || !j.ok) return null;
        if (!(j.layers || []).length && !j.place) return null;
        return j;
    } catch { clearTimeout(t); return null; }
}

/* رابطُ الجلب. تمييزٌ مهمّ:
   — طبقةٌ عاديّة + منطقةٌ مذكورة ⇒ &place=… فتُقصّ داخل حدود المنطقة.
   — طبقةُ الحدود نفسها ⇒ قصُّها بنفسها يُرجع المنطقةَ وكلَّ ما يلامسها،
     فنُرشّحها بحقل الاسم لنُخرج حدود تلك المنطقة وحدها. */
const qUrl = (l, place) => {
    const base = `${DATA_API}/data/query?layer=${encodeURIComponent(l.slug)}`;
    if (!place) return base + '&limit=5000';
    if (l.is_boundary && l.name_field) {
        const f = encodeURIComponent(JSON.stringify({ [l.name_field]: place.name }));
        return `${base}&filter=${f}&limit=1000`;
    }
    return `${base}&place=${encodeURIComponent(place.name)}&limit=5000`;
};

/* بناءُ كتلة الحقن. مكتوبةٌ لتكون قابلةً للتنفيذ حرفيّاً: روابطُ جاهزةٌ
   وشكلُ الاستجابة وسطرُ الرسم — فلا يخمّن النموذج شيئاً. */
function buildLibraryInjection(ctx) {
    if (!ctx) return '';
    const { layers = [], place } = ctx;
    if (!layers.length && !place) return '';

    const L = [];
    L.push('\n\n[مكتبة بيانات PalNovaa — بياناتٌ جغرافيّةٌ حقيقيّةٌ جاهزة]');
    L.push('مهمّ: استعمل هذه الواجهة لجلب البيانات. لا تخترع بياناتٍ تجريبيّةً لِما هو متاحٌ هنا.');
    L.push('الواجهة مفتوحةٌ بلا مفاتيح وتدعم CORS، وتُعيد GeoJSON مباشرةً.');

    if (place) {
        L.push(`\nالمنطقة المذكورة في الطلب: «${place.name}»`
            + (place.area_km2 ? ` (نحو ${place.area_km2} كم²)` : '')
            + ' — مرّرها في البارامتر place فتُقصّ الطبقة داخل حدودها، ولا تُجلَب إلّا معالمُها.');
    }

    if (layers.length) {
        L.push('\nالطبقات المناسبة لهذا الطلب:');
        layers.forEach((l, i) => {
            L.push(`${i + 1}) ${l.name} — slug: ${l.slug} — ${l.geometry || 'هندسة غير محدّدة'} — ${Number(l.count || 0).toLocaleString('en')} معلم`);
            if ((l.fields || []).length) L.push(`   الحقول: ${l.fields.join(', ')}`);
            L.push(`   رابطٌ جاهز: ${qUrl(l, place)}`);
            if ((l.count || 0) > 20000) {
                L.push(`   طبقةٌ ضخمة: للعرض الكامل استعمل البلاطات المتّجهة بدل الجلب الكامل —`);
                L.push(`   ${DATA_API}/data/tiles/${l.slug}/{z}/{x}/{y}.mvt  (أدنى تكبير ${l.minzoom ?? 10})`);
            }
        });
    }

    L.push('\nكيف تستعملها في الكود:');
    L.push("  const res = await fetch('<الرابط الجاهز أعلاه>');");
    L.push('  const data = await res.json();   // { ok, count, features: [ GeoJSON Feature ] }');
    L.push('  L.geoJSON({ type: "FeatureCollection", features: data.features }).addTo(map);');
    L.push('  // خصائصُ كلّ معلمٍ في feature.properties — استعملها في النوافذ والجداول والفلاتر.');

    L.push('\nبارامتراتٌ إضافيّةٌ اختياريّة على /query:');
    L.push('  &place=<اسم منطقة>            قصٌّ داخل حدود المنطقة');
    L.push('  &bbox=minx,miny,maxx,maxy     قصٌّ بمستطيل');
    L.push('  &filter={"الحقل":"القيمة"}     تصفيةٌ بالخصائص (JSON مُرمَّز)');
    L.push('  &limit=20000                  سقف النتائج');

    L.push('\nقواعدُ إلزاميّة:');
    L.push('- اجلب عند بدء التطبيق واعرض حالة تحميل، وعالِج فشل الشبكة برسالةٍ واضحةٍ وزرّ إعادة.');
    L.push('- كبّر الخريطة على نطاق البيانات المجلوبة (fitBounds) فتظهر فعلاً.');
    L.push('- إن لم تُغطِّ الطبقاتُ أعلاه ما طلبه المستخدم، قُل ذلك صراحةً في الواجهة ولا تختلق بيانات.');
    L.push('- لا ترسم حدوداً ولا مساحاتٍ تقريبيّةً من إحداثيّات النقاط (لا دائرةً ولا مُغلَّفاً محدّباً).');
    L.push('  الحدُّ الحقيقيّ يُجلَب من طبقة الحدود أعلاه كمضلّع GeoJSON ويُرسَم كما هو حرفيّاً.');

    return L.join('\n');
}

module.exports = { resolveLibrary, buildLibraryInjection, DATA_API };
