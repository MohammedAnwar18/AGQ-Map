/* اختبارات قراءة GeoJSON — وأهمّها أن المعلم يقع حيث يجب */
import {
    pointOf, ringCentroid, insidePoint, pointInRing, looksProjected,
    guessName, guessCategory, crsOf, readGeoJson
} from '../src/utils/geojsonShops.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

const BZ = [35.1839, 31.9617];

// ── ١) النقطة ───────────────────────────────────────────────
head('١) النقطة');

ok('النقطة هي نفسها', (() => {
    const q = pointOf({ type: 'Point', coordinates: BZ });
    return near(q[0], BZ[0]) && near(q[1], BZ[1]);
})());

ok('والارتفاع الثالث يُهمل', (() => {
    const q = pointOf({ type: 'Point', coordinates: [35.18, 31.96, 820] });
    return q.length === 2 && near(q[0], 35.18) && near(q[1], 31.96);
})());

ok('ومتعدّد النقاط يأخذ أوّلها', (() => {
    const q = pointOf({ type: 'MultiPoint', coordinates: [BZ, [35.2, 31.97]] });
    return near(q[0], BZ[0]);
})());

ok('والنصّ بدل الرقم يُرفض', pointOf({ type: 'Point', coordinates: ['a', 'b'] }) === null);
ok('والفارغ يُرفض', pointOf({ type: 'Point', coordinates: [] }) === null);
ok('والنوع المجهول يُرفض', pointOf({ type: 'Spline', coordinates: [[0, 0]] }) === null);
ok('و‎null‎ يُرفض', pointOf(null) === null);

// ── ٢) مركز المضلّع ─────────────────────────────────────────
head('٢) مركز المضلّع');

// مربّع: مركزه مركزه
const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
ok('المربّع مركزه وسطه', (() => {
    const c = ringCentroid(square);
    return near(c[0], 5, 1e-9) && near(c[1], 5, 1e-9);
})());

ok('والاتّجاه المعاكس لا يُغيّره', (() => {
    const c = ringCentroid([...square].reverse());
    return near(c[0], 5, 1e-9) && near(c[1], 5, 1e-9);
})());

ok('والحلقة غير المغلقة كذلك', (() => {
    const c = ringCentroid([[0, 0], [10, 0], [10, 10], [0, 10]]);
    return near(c[0], 5, 1e-9) && near(c[1], 5, 1e-9);
})());

// مثلّث: مركز ثقله متوسّط رؤوسه
ok('المثلّث مركز ثقله متوسّط رؤوسه', (() => {
    const c = ringCentroid([[0, 0], [9, 0], [0, 9]]);
    return near(c[0], 3, 1e-9) && near(c[1], 3, 1e-9);
})());

/*
 * حرف ‎L‎ — وهذا هو سبب الموزون بالمساحة.
 *
 * مركز المستطيل المحيط ‎(3, 3)‎ يقع في الفراغ خارج الشكل. والموزون
 * يقع داخل الذراعين.
 */
const ell = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]];
const ellC = ringCentroid(ell);

ok('حرف ‎L‎: المركز ليس مركز المحيط', !(near(ellC[0], 3, 0.2) && near(ellC[1], 3, 0.2)),
    `${ellC[0].toFixed(2)},${ellC[1].toFixed(2)}`);

/*
 * ومركز الثقل هنا خارج الشكل فعلاً.
 *
 * ‎(2.2, 2.2)‎ صحيحٌ رياضياً — ‎(12·3 + 8·1)/20‎ — وواقعٌ في تجويف
 * الحرف. وهذا ما يضع علامة المحلّ على المبنى المجاور، فلزم أن
 * تُحسب نقطة مضمونة بدلاً منه.
 */
ok('ومركز الثقل يقع خارج الشكل المقعّر', pointInRing(ellC, ell) === false);
ok('والنقطة المضمونة داخله', pointInRing(insidePoint(ell), ell) === true,
    `${insidePoint(ell).map(v => v.toFixed(2)).join(',')}`);

// حرف ‎U‎: تجويف أوسع، ونفس المشكلة ونفس الحلّ
const yoo = [[0, 0], [8, 0], [8, 6], [6, 6], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]];
ok('وحرف ‎U‎ كذلك', pointInRing(ringCentroid(yoo), yoo) === false
    && pointInRing(insidePoint(yoo), yoo) === true);

// والمحدّب لا يتغيّر: النقطة المضمونة هي المركز نفسه
ok('والمحدّب يبقى مركزه مركزه', (() => {
    const q = insidePoint(square);
    return near(q[0], 5, 1e-9) && near(q[1], 5, 1e-9);
})());

ok('والمثلّث كذلك', (() => {
    const tri = [[0, 0], [9, 0], [0, 9]];
    const q = insidePoint(tri);
    return near(q[0], 3, 1e-9) && near(q[1], 3, 1e-9) && pointInRing(q, tri);
})());

// رمي الشعاع نفسه
ok('ورمي الشعاع يعرف الداخل من الخارج',
    pointInRing([5, 5], square) === true && pointInRing([15, 5], square) === false);
ok('وحلقة من نقطتين لا داخل لها', pointInRing([0, 0], [[0, 0], [1, 1]]) === false);

// حلقة منهارة على خطّ: مساحتها صفر فلا قسمة على صفر
ok('الحلقة المنهارة ترجع لمتوسّط الرؤوس', (() => {
    const c = ringCentroid([[0, 0], [4, 0], [8, 0]]);
    return c && near(c[0], 4) && near(c[1], 0);
})());

ok('ونقطتان ترجعان لمتوسّطهما', (() => {
    const c = ringCentroid([[0, 0], [4, 4]]);
    return near(c[0], 2) && near(c[1], 2);
})());

ok('والفارغة تُرفض', ringCentroid([]) === null);

// ── ٣) المضلّع والمتعدّد ────────────────────────────────────
head('٣) المضلّع والمتعدّد');

ok('المضلّع يأخذ حلقته الخارجية', (() => {
    const q = pointOf({ type: 'Polygon', coordinates: [square] });
    return near(q[0], 5, 1e-9) && near(q[1], 5, 1e-9);
})());

// الثقب لا يُحرّك المركز: الحلقة الأولى وحدها تُقرأ
ok('والثقب لا يُحرّكه', (() => {
    const hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    const q = pointOf({ type: 'Polygon', coordinates: [square, hole] });
    return near(q[0], 5, 1e-9) && near(q[1], 5, 1e-9);
})());

/*
 * المتعدّد يأخذ أكبر مضلّع لا أوّله.
 *
 * ملفّات ‎OSM‎ تُصدّر مبنىً كبيراً ومعه كشكٌ صغير في مضلّع واحد
 * متعدّد، وأخذُ الأوّل قد يضع المعلم على الكشك.
 */
ok('والمتعدّد يأخذ أكبر مضلّعاته', (() => {
    const tiny = [[100, 100], [101, 100], [101, 101], [100, 101], [100, 100]];
    const q = pointOf({ type: 'MultiPolygon', coordinates: [[tiny], [square]] });
    return near(q[0], 5, 1e-9) && near(q[1], 5, 1e-9);
})(), 'أخذ الصغير');

// ── ٤) الخطّ ────────────────────────────────────────────────
head('٤) الخطّ');

// منتصفه بالطول لا بعدد الرؤوس: رؤوس متكدّسة في طرف تُزيح المتوسّط
ok('منتصف الخطّ بطوله', (() => {
    const q = pointOf({ type: 'LineString', coordinates: [[0, 0], [1, 0], [2, 0], [10, 0]] });
    return near(q[0], 5, 1e-9) && near(q[1], 0);
})(), 'ليس منتصف الطول');

ok('ونقطة واحدة هي نفسها', (() => {
    const q = pointOf({ type: 'LineString', coordinates: [[3, 4]] });
    return near(q[0], 3) && near(q[1], 4);
})());

ok('وخطّ معدوم الطول لا يقسم على صفر', (() => {
    const q = pointOf({ type: 'LineString', coordinates: [[3, 4], [3, 4]] });
    return q && near(q[0], 3) && near(q[1], 4);
})());

ok('ومتعدّد الخطوط يأخذ أطولها', (() => {
    const q = pointOf({
        type: 'MultiLineString',
        coordinates: [[[0, 0], [1, 0]], [[0, 50], [0, 60], [0, 70]]]
    });
    return near(q[0], 0) && near(q[1], 60, 1e-9);
})());

// ── ٥) المجموعة ────────────────────────────────────────────
head('٥) مجموعة الأشكال');

ok('تأخذ أوّل شكل مفهوم', (() => {
    const q = pointOf({
        type: 'GeometryCollection',
        geometries: [{ type: 'Spline', coordinates: [] }, { type: 'Point', coordinates: BZ }]
    });
    return near(q[0], BZ[0]);
})());

// تداخل لا نهائي لا يُعلّق الحساب
ok('والتداخل العميق يتوقّف', (() => {
    let deep = { type: 'Point', coordinates: BZ };
    for (let i = 0; i < 12; i++) deep = { type: 'GeometryCollection', geometries: [deep] };
    return pointOf(deep) === null;
})());

// ── ٦) الإحداثيات المسقطة ──────────────────────────────────
head('٦) الإحداثيات المسقطة');

ok('الدرجات لا تبدو مسقطة', looksProjected(35.18, 31.96) === false);
ok('و‎UTM‎ يبدو مسقطاً', looksProjected(706388, 3538273) === true);
ok('والحدّ نفسه مقبول', looksProjected(180, 90) === false);
ok('وما تجاوزه يُرفض', looksProjected(180.1, 90) === true);

// ── ٧) الاسم ───────────────────────────────────────────────
head('٧) الاسم');

ok('العربيّ يسبق الإنجليزيّ',
    guessName({ name: 'Pharmacy', 'name:ar': 'صيدلية الشفاء' }) === 'صيدلية الشفاء');
ok('و‎name‎ حين لا عربيّ', guessName({ name: 'Al Quds' }) === 'Al Quds');
ok('و‎NAME‎ الكبير يُقرأ', guessName({ NAME: 'MARKET' }) === 'MARKET');
ok('والرقم يُقبل نصّاً', guessName({ name: 12 }) === '12');
ok('والفارغ لا يُؤخذ', guessName({ name: '   ', title: 'بديل' }) === 'بديل');
ok('وبلا خصائص لا اسم', guessName(null) === '');

// ── ٨) التصنيف ─────────────────────────────────────────────
head('٨) التصنيف');

ok('‎amenity=fuel‎ كازية', guessCategory({ amenity: 'fuel' }) === 'محطة وقود');
ok('و‎amenity=pharmacy‎ صيدلية', guessCategory({ amenity: 'pharmacy' }) === 'صيدلية');
ok('و‎shop=supermarket‎ سوبرماركت', guessCategory({ shop: 'supermarket' }) === 'Supermarket');
ok('و‎leisure=park‎ حديقة', guessCategory({ leisure: 'park' }) === 'حديقة');
ok('والحالة الكبيرة تُقبل', guessCategory({ amenity: 'FUEL' }) === 'محطة وقود');

// الوسم أدقّ من الكلمة الحرّة، فيسبقها عند التعارض
ok('الوسم يسبق الكلمة الحرّة',
    guessCategory({ amenity: 'fuel', category: 'restaurant' }) === 'محطة وقود');

ok('والكلمة الحرّة تُقرأ بلا وسم', guessCategory({ category: 'كازية' }) === 'محطة وقود');
ok('والعربيّة كذلك', guessCategory({ type: 'مطعم' }) === 'Restaurant');
ok('والمجهول يرجع للافتراضي', guessCategory({ amenity: 'telephone' }) === 'General');
ok('والافتراضي قابل للتغيير', guessCategory({}, 'مخصّص') === 'مخصّص');

// ── ٩) المرجع ──────────────────────────────────────────────
head('٩) مرجع الإحداثيات');

ok('يُقرأ من ‎urn‎',
    crsOf({ crs: { properties: { name: 'urn:ogc:def:crs:EPSG::32636' } } }) === 'EPSG:32636');
ok('ومن الشكل القصير',
    crsOf({ crs: { properties: { name: 'EPSG:4326' } } }) === 'EPSG:4326');
ok('وبلا عضو لا مرجع', crsOf({ type: 'FeatureCollection' }) === null);

// ── ١٠) الملفّ كلّه ────────────────────────────────────────
head('١٠) الملفّ كلّه');

const collection = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: BZ }, properties: { name: 'كازية بير زيت', amenity: 'fuel' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[35.18, 31.96], [35.19, 31.96], [35.19, 31.97], [35.18, 31.97], [35.18, 31.96]]] }, properties: { 'name:ar': 'مدرسة', amenity: 'school' } },
        { type: 'Feature', geometry: null, properties: { name: 'بلا هندسة' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [706388, 3538273] }, properties: { name: 'مسقط' } }
    ]
};

const read = readGeoJson(JSON.stringify(collection));
ok('يقرأ ما صحّ', read.items.length === 2, `${read.items?.length}`);
ok('ويُبقي ما فسد مع سببه', read.problems.length === 2, `${read.problems?.length}`);
ok('ويعدّ المسقطة', read.projected === 1);
ok('ويعدّ الكلّ', read.total === 4);

ok('والاسم والتصنيف مقترحان',
    read.items[0].name === 'كازية بير زيت' && read.items[0].category === 'محطة وقود');
ok('والمضلّع صار نقطة', read.items[1].kind === 'Polygon'
    && near(read.items[1].latitude, 31.965, 1e-6)
    && near(read.items[1].longitude, 35.185, 1e-6),
    `${read.items[1].longitude},${read.items[1].latitude}`);

// معلم واحد بلا مجموعة
const lone = readGeoJson(JSON.stringify({
    type: 'Feature', geometry: { type: 'Point', coordinates: BZ }, properties: { name: 'واحد' }
}));
ok('والمعلم الواحد يُقرأ', lone.items.length === 1 && lone.items[0].name === 'واحد');

// هندسة عارية بلا غلاف
const bare = readGeoJson(JSON.stringify({ type: 'Point', coordinates: BZ }));
ok('والهندسة العارية تُقرأ', bare.items.length === 1);

ok('والنصّ الفاسد يُرفض بوضوح', Boolean(readGeoJson('{ not json').error));
ok('والفارغ يُرفض', Boolean(readGeoJson('{}').error));
ok('والمجموعة الخالية تُرفض',
    Boolean(readGeoJson(JSON.stringify({ type: 'FeatureCollection', features: [] })).error));

// الإحداثيات تُقصّ إلى سبع منازل — سنتيمترات، وما بعدها ضجيج
ok('والإحداثيات مقصوصة بدقّة معقولة',
    String(read.items[0].latitude).split('.')[1].length <= 7);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
