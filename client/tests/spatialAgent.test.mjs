/* اختبارات الوكيل المكاني — كل رقم هنا يُبنى عليه قرار */
import {
    haversine, bearing, compassOf, readable,
    meanCentre, standardDistance, nearestNeighbourIndex,
    shannon, countBy, nearestOf, gridOver, serviceGaps, hotspots,
    criticalityOf, impactOf, decide, analyse, severityOf,
    EVENT_KINDS, LIFELINE
} from '../src/components/helly/spatialAgent.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

const at = (lat, lon) => ({ latitude: lat, longitude: lon });
const BZ = at(31.9617, 35.1839);

// ── ١) القياس ───────────────────────────────────────────────
head('١) القياس');

ok('الموضع نفسه صفر', near(haversine(BZ, BZ), 0, 1e-9));

/*
 * درجة عرض واحدة ≈ ١١١٫٢ كم في كل مكان.
 * وهذا المرجع الذي يُكشف به أي خطأ في الصيغة.
 */
const oneLat = haversine(at(31, 35), at(32, 35));
ok('درجة عرض ≈ ١١١ كم', oneLat > 111000 && oneLat < 111400, `${Math.round(oneLat)} م`);

/*
 * ودرجة الطول تضيق مع الاتجاه شمالاً: عند ‎٣٢°‎ هي ‎cos(32) ≈ 0.848‎
 * من درجة العرض. وهذا بالضبط ما يُخطئه الحساب المستوي على الدرجات.
 */
const oneLon = haversine(at(32, 35), at(32, 36));
ok('ودرجة الطول عند ٣٢° أضيق', near(oneLon / oneLat, Math.cos(32 * Math.PI / 180), 0.004),
    `${(oneLon / oneLat).toFixed(4)} مقابل ${Math.cos(32 * Math.PI / 180).toFixed(4)}`);

ok('ومتماثلة في الاتجاهين', near(haversine(BZ, at(32, 35)), haversine(at(32, 35), BZ), 1e-9));
ok('والناقص لانهاية', haversine(BZ, null) === Infinity);

// مسافة قصيرة معروفة: ‎0.001°‎ عرضاً ≈ ١١١ م
ok('المسافة القصيرة دقيقة',
    near(haversine(at(31.9617, 35.1839), at(31.9627, 35.1839)), 111.2, 1.5),
    `${haversine(at(31.9617, 35.1839), at(31.9627, 35.1839)).toFixed(1)} م`);

// ── ٢) الاتّجاه ─────────────────────────────────────────────
head('٢) الاتّجاه');

ok('شمالاً صفر', near(bearing(BZ, at(32.1, 35.1839)), 0, 0.01));
ok('وشرقاً تسعون', near(bearing(at(0, 35), at(0, 36)), 90, 0.01));
ok('وجنوباً مئة وثمانون', near(bearing(BZ, at(31.5, 35.1839)), 180, 0.01));

ok('والبوصلة تُترجم', compassOf(0) === 'شمالاً' && compassOf(90) === 'شرقاً'
    && compassOf(180) === 'جنوباً' && compassOf(270) === 'غرباً');
ok('والزاوية الملتفّة تُطبّع', compassOf(360) === 'شمالاً' && compassOf(-90) === 'غرباً');

ok('المسافة تُقرأ بالأمتار تحت الكيلو', readable(480) === '480 م');
ok('وبالكيلومتر فوقه', readable(2400) === '2.4 كم');
ok('والكبيرة بلا كسر', readable(14000) === '14 كم');
ok('واللانهاية شرطة', readable(Infinity) === '—');

// ── ٣) المركزية والتشتّت ────────────────────────────────────
head('٣) المركزية والتشتّت');

const square = [at(31.96, 35.18), at(31.96, 35.19), at(31.97, 35.19), at(31.97, 35.18)];
const c = meanCentre(square);
ok('مركز المربّع وسطه', near(c.latitude, 31.965, 1e-9) && near(c.longitude, 35.185, 1e-9));
ok('والفارغ بلا مركز', meanCentre([]) === null);
ok('والفاسد يُستثنى', (() => {
    const q = meanCentre([at(31.96, 35.18), { latitude: 'x', longitude: 'y' }]);
    return near(q.latitude, 31.96);
})());

ok('التشتّت صفر لنقطة واحدة', standardDistance([BZ]) === 0);
ok('ويكبر مع الانتشار',
    standardDistance([at(31.9, 35.1), at(32.1, 35.3)]) > standardDistance(square));

// ── ٤) دليل أقرب جار ───────────────────────────────────────
// هذا هو الحكم «سوق متجمّع» أو «محلّات مبثوثة» — ويجب أن يُقاس.
head('٤) دليل أقرب جار');

ok('أقلّ من ثلاث نقاط لا حكم', nearestNeighbourIndex([BZ, at(32, 35)], 1e6) === null);
ok('والمساحة المعدومة كذلك', nearestNeighbourIndex(square, 0) === null);

// متجمّع: عشر نقاط متلاصقة في مساحة واسعة
const tight = [];
for (let i = 0; i < 10; i++) tight.push(at(31.9617 + i * 0.00008, 35.1839 + i * 0.00008));
const tightR = nearestNeighbourIndex(tight, 4e6);
ok('المتلاصق يُحكم عليه بالتجمّع', tightR.verdict === 'clustered', `R=${tightR.ratio.toFixed(3)}`);
ok('ونسبته أقلّ من واحد', tightR.ratio < 0.8);

// متباعد منتظم: شبكة
const even = [];
for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) even.push(at(31.95 + r * 0.01, 35.17 + k * 0.01));
const evenArea = haversine(at(31.95, 35.17), at(31.99, 35.17)) * haversine(at(31.95, 35.17), at(31.95, 35.21));
const evenR = nearestNeighbourIndex(even, evenArea);
ok('والمنتظم لا يُحكم عليه بالتجمّع', evenR.verdict !== 'clustered', `${evenR.verdict} R=${evenR.ratio.toFixed(3)}`);

// ── ٥) التنوّع ─────────────────────────────────────────────
head('٥) التنوّع');

ok('الصنف الواحد تنوّعه صفر', shannon({ a: 10 }).h === 0);
ok('والمتساويان أقصى توازن', near(shannon({ a: 5, b: 5 }).evenness, 1, 1e-9));
ok('وقيمته ‎ln2‎ لاثنين متساويين', near(shannon({ a: 5, b: 5 }).h, Math.log(2), 1e-9));
ok('والمائل أقلّ توازناً', shannon({ a: 99, b: 1 }).evenness < 0.2);
ok('ويعدّ الأصناف', shannon({ a: 1, b: 2, c: 3 }).kinds === 3);
ok('والفارغ آمن', shannon({}).h === 0 && shannon(null).h === 0);
ok('والأصفار تُستثنى', shannon({ a: 5, b: 0 }).kinds === 1);

ok('العدّ يجمع بالصنف', (() => {
    const got = countBy([{ category: 'صيدلية' }, { category: 'صيدلية' }, { category: 'بنك' }]);
    return got['صيدلية'] === 2 && got['بنك'] === 1;
})());
ok('وبلا صنف يصير غير مصنّف', countBy([{}])['غير مصنّف'] === 1);

// ── ٦) الأقرب والشبكة ──────────────────────────────────────
head('٦) الأقرب والشبكة');

const shops = [
    { id: 1, name: 'قريب', category: 'صيدلية', latitude: 31.9620, longitude: 35.1840 },
    { id: 2, name: 'بعيد', category: 'صيدلية', latitude: 31.9800, longitude: 35.2000 }
];
ok('يجد الأقرب', nearestOf(BZ, shops).item.name === 'قريب');
ok('والفارغ لا شيء', nearestOf(BZ, []) === null);

const bounds = { south: 31.95, north: 31.97, west: 35.17, east: 35.19 };
const cells = gridOver(bounds, 500);
ok('الشبكة تُغطّي الحدود', cells.length > 4, `${cells.length} خلية`);
ok('وكل خلية داخل الحدود', cells.every(cell =>
    cell.latitude >= bounds.south && cell.latitude <= bounds.north + 0.01
    && cell.longitude >= bounds.west && cell.longitude <= bounds.east + 0.01));

/*
 * الخلايا مربّعة على الأرض لا في الدرجات.
 *
 * خطوة الطول مقسومة على جيب تمام العرض، فلو أُهملت صارت الخلية
 * مستطيلاً ضيّقاً وحُسبت الكثافة خطأً بنحو ١٥٪ عند هذا العرض.
 */
const twoCols = cells.filter(x => x.row === 0).slice(0, 2);
const twoRows = cells.filter(x => x.col === 0).slice(0, 2);
if (twoCols.length === 2 && twoRows.length === 2) {
    const wide = haversine(twoCols[0], twoCols[1]);
    const tall = haversine(twoRows[0], twoRows[1]);
    ok('والخلية مربّعة بالأمتار', near(wide / tall, 1, 0.05), `${(wide / tall).toFixed(3)}`);
}

ok('والحدود المقلوبة تُرفض', gridOver({ south: 32, north: 31, west: 35, east: 36 }, 500).length === 0);
ok('والخطوة المعدومة تُرفض', gridOver(bounds, 0).length === 0);

// ── ٧) فجوات الخدمة ───────────────────────────────────────
head('٧) فجوات الخدمة');

// صيدلية واحدة في زاوية: الزاوية المقابلة فجوة
const corner = [{ name: 'وحيدة', category: 'صيدلية', latitude: 31.951, longitude: 35.171 }];
const gaps = serviceGaps(bounds, corner, { cellM: 500, thresholdM: 700 });
ok('يجد فجوات', gaps.gaps.length > 0, `${gaps.gaps.length}`);
ok('وأسوأها أبعدها', gaps.worst && gaps.gaps.every(g => g.distance <= gaps.worst.distance));
ok('والتغطية بين صفر وواحد', gaps.coverage >= 0 && gaps.coverage <= 1);

// تغطية كاملة: مَرفِق في كل خلية
const everywhere = gridOver(bounds, 500).map((cell, i) => ({
    name: `م${i}`, category: 'صيدلية', latitude: cell.latitude, longitude: cell.longitude
}));
const full = serviceGaps(bounds, everywhere, { cellM: 500, thresholdM: 700 });
ok('والتغطية الكاملة بلا فجوات', full.gaps.length === 0 && near(full.coverage, 1, 1e-9));

// بلا مرافق: كل شيء فجوة
const none = serviceGaps(bounds, [], { cellM: 500, thresholdM: 700 });
ok('وبلا مرافق كلّها فجوة', none.coverage === 0 && none.gaps.length === none.total);

// ── ٨) البؤر ───────────────────────────────────────────────
head('٨) بؤر الكثافة');

const cluster = [];
for (let i = 0; i < 14; i++) {
    cluster.push({ name: `c${i}`, category: 'Cafe', latitude: 31.9600 + (i % 4) * 0.0004, longitude: 35.1800 + Math.floor(i / 4) * 0.0004 });
}
cluster.push({ name: 'بعيد', category: 'Cafe', latitude: 31.9690, longitude: 35.1890 });

const spots = hotspots(bounds, cluster, { cellM: 300, radiusM: 350, top: 3 });
ok('يجد بؤرة', spots.length > 0);
ok('وأعلاها يشمل أكثر التجمّع', spots[0].count >= 10, `${spots[0]?.count}`);

/* البؤر المتجاورة تُدمج: خلايا حول نفس التجمّع ليست بؤراً عدّة */
if (spots.length > 1) {
    ok('والبؤر متباعدة لا متلاصقة', haversine(spots[0], spots[1]) >= 350);
} else {
    ok('والبؤر متباعدة لا متلاصقة', true);
}

ok('وبلا نقاط لا بؤر', hotspots(bounds, [], {}).length === 0);

// ── ٩) أثر الحدث ──────────────────────────────────────────
head('٩) أثر الحدث');

const town = [
    { id: 1, name: 'مستشفى بير زيت', category: 'مستشفى', latitude: 31.9637, longitude: 35.1839 },
    { id: 2, name: 'مقهى الزاوية', category: 'Cafe', latitude: 31.96175, longitude: 35.18395 },
    { id: 3, name: 'كازية الشمال', category: 'محطة وقود', latitude: 31.9625, longitude: 35.1845 },
    { id: 4, name: 'صيدلية الشفاء', category: 'صيدلية', latitude: 31.9610, longitude: 35.1830 },
    { id: 5, name: 'محل بعيد', category: 'Clothing', latitude: 32.0500, longitude: 35.3000 }
];

const hit = impactOf({ ...BZ, kind: 'fire', radius: 600 }, town);
ok('ما خرج عن النطاق يُستثنى', !hit.affected.some(a => a.id === 5));
ok('وما دخله يُحسب', hit.affected.length === 4, `${hit.affected.length}`);

/*
 * الترتيب بالأثر لا بالمسافة.
 *
 * المقهى ألصق بالموضع من المستشفى، ومع ذلك المستشفى أولى في
 * التقرير: حرجُه عشرة ومعامل الحريق له اثنان. وترتيبُ المسافة
 * وحدها يضع المقهى أوّلاً — وهو ترتيب لا يُفيد من يقرّر.
 */
const cafe = hit.affected.find(a => a.id === 2);
const hosp = hit.affected.find(a => a.id === 1);
ok('المقهى أقرب فعلاً', cafe.distance < hosp.distance,
    `${Math.round(cafe.distance)} < ${Math.round(hosp.distance)}`);
ok('والمستشفى أعلى أثراً رغم بعده', hosp.impact > cafe.impact,
    `${hosp.impact.toFixed(2)} > ${cafe.impact.toFixed(2)}`);
ok('والترتيب بالأثر نازلاً', hit.affected.every((a, i) =>
    i === 0 || hit.affected[i - 1].impact >= a.impact));

// الوقود في الحريق يُضاعف ثلاثاً
const fuelHit = hit.affected.find(a => a.id === 3);
ok('الوقود في الحريق مضاعَف', fuelHit.impact > fuelHit.criticality,
    `${fuelHit.impact.toFixed(2)} مقابل حرج ${fuelHit.criticality}`);

// التضاؤل: نفس المعلم أقلّ أثراً كلّما بَعُد
const closeHit = impactOf({ ...BZ, kind: 'closure', radius: 2000 }, [town[0]]);
const farEvent = impactOf({ latitude: 31.9700, longitude: 35.1839, kind: 'closure', radius: 2000 }, [town[0]]);
ok('والأثر يتضاءل مع المسافة', closeHit.affected[0].impact > farEvent.affected[0].impact);

ok('والحرج من الجدول', criticalityOf('مستشفى') === 10 && criticalityOf('Cafe') === 2);
ok('والمجهول له افتراضي', criticalityOf('شيء غريب') === 2);

ok('والنمط المجهول يرجع للإغلاق', impactOf({ ...BZ, kind: 'لا شيء' }, town).kind.label === EVENT_KINDS.closure.label);

// ── ١٠) القرار ────────────────────────────────────────────
head('١٠) القرار');

const made = decide({ ...BZ, kind: 'fire', radius: 600 }, town, bounds);
ok('يُخرج توصيات', made.moves.length > 0);
ok('وكلّها لها سبب', made.moves.every(m => m.why && m.title && m.level));
ok('والعالي قبل المعلوماتي', (() => {
    const rank = { high: 0, warn: 1, info: 2 };
    return made.moves.every((m, i) => i === 0 || rank[made.moves[i - 1].level] <= rank[m.level]);
})());

ok('ويذكر الخدمات الحياتية',
    made.moves.some(m => m.title.includes('حياتية')));
ok('ويذكر الوقود في الحريق',
    made.moves.some(m => m.title.includes('وقود')));

// بلا رعاية طبية: يُقال صريحاً لا يُخترع
const noCare = decide({ ...BZ, kind: 'medical', radius: 500 },
    [{ id: 9, name: 'مقهى', category: 'Cafe', latitude: 31.9618, longitude: 35.1840 }], bounds);
ok('وبلا رعاية يُقال لا يُخترع',
    noCare.moves.some(m => m.title.includes('لا رعاية')));

// نطاق خالٍ: يُقال
const empty = decide({ latitude: 30, longitude: 34, kind: 'closure', radius: 300 }, town, bounds);
ok('والنطاق الخالي يُقال', empty.moves.some(m => m.title.includes('لا معلم')));

// ── ١١) التقرير والخطورة ──────────────────────────────────
head('١١) التقرير والخطورة');

const report = analyse({ ...BZ, kind: 'fire', radius: 600 }, town, bounds);

ok('يعدّ المتأثّر', report.totals.affected === 4);
ok('ويعدّ الكلّ', report.totals.landmarks === 5);
ok('ويعدّ الحرج', report.totals.critical === 3, `${report.totals.critical}`);
ok('ويحسب الكثافة', report.totals.perKm2 > 0);
ok('ويحسب التنوّع', report.diversity.kinds === 4);
ok('ويحسب جدول الوصول', report.reach.length === LIFELINE.length);
ok('والوصول يذكر الأقرب',
    report.reach.find(r => r.category === 'مستشفى').name === 'مستشفى بير زيت');

/* صنف غائب يُعاد بلا مسافة لا بصفر: الصفر يُقرأ «ملاصق» */
const absent = analyse({ ...BZ, kind: 'closure', radius: 400 },
    [{ id: 1, name: 'مقهى', category: 'Cafe', latitude: 31.9618, longitude: 35.1840 }], bounds);
ok('والغائب بلا مسافة لا بصفر',
    absent.reach.every(r => r.distance === null));

ok('والخطورة بين صفر ومئة', (() => {
    const s = severityOf(report);
    return s.score >= 0 && s.score <= 100;
})(), `${severityOf(report).score}`);

ok('والحدث الأكبر أخطر', (() => {
    const big = severityOf(analyse({ ...BZ, kind: 'fire', radius: 1200 }, town, bounds));
    const small = severityOf(analyse({ latitude: 30, longitude: 34, kind: 'closure', radius: 200 }, town, bounds));
    return big.score > small.score;
})());

ok('والخالي خطورته صفر', severityOf(analyse({ latitude: 30, longitude: 34, kind: 'closure', radius: 200 }, town, bounds)).score === 0);
ok('والناقص آمن', severityOf(null).score === 0);

/* نفس المُدخل نفس المُخرج — وهذا ما يجعل التقرير يُراجَع */
ok('والنتيجة واحدة لنفس المُدخل', (() => {
    const a = severityOf(analyse({ ...BZ, kind: 'fire', radius: 600 }, town, bounds));
    const b = severityOf(analyse({ ...BZ, kind: 'fire', radius: 600 }, town, bounds));
    return a.score === b.score;
})());

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
