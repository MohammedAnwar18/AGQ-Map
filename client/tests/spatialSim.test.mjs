/* اختبارات المحاكاة على الخريطة — وأهمّها أن المكان يُغيّر النتيجة */
import {
    placeCrowd, neighbourhood, districtsOf, sideName, runOnMap, circlePolygon
} from '../src/components/helly/spatialSim.js';
import { haversine } from '../src/components/helly/spatialAgent.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

/* بلدة مُصطنعة: معالم على شبكة منتظمة حول بير زيت */
const town = [];
for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
        town.push({
            id: r * 6 + c,
            name: `معلم ${r}-${c}`,
            category: 'General',
            latitude: 31.955 + r * 0.003,
            longitude: 35.175 + c * 0.003
        });
    }
}

const BOUNDS = { south: 31.95, north: 31.977, west: 35.17, east: 35.197 };

// ── ١) التوزيع ──────────────────────────────────────────────
head('١) التوزيع على المعالم');

const crowd = placeCrowd(150, town, { seed: 5 });

ok('العدد كما طُلب', crowd.length === 150);
ok('ولكلٍّ موضع صالح', crowd.every(a =>
    Number.isFinite(a.latitude) && Number.isFinite(a.longitude)));
ok('والآراء في المدى', crowd.every(a => a.opinion >= -1 && a.opinion <= 1));
ok('والصفات موجبة', crowd.every(a => a.reach > 0 && a.tolerance > 0));

/* كلٌّ قريب من معلم: أبعد وكيل عن أقرب معلم له لا يتجاوز الإزاحة */
const worstHome = Math.max(...crowd.map(a =>
    Math.min(...town.map(t => haversine(a, t)))));
ok('وكلٌّ قريب من معلم', worstHome < 220, `${Math.round(worstHome)} م`);

ok('وبلا معالم لا وكلاء', placeCrowd(50, [], {}).length === 0);
ok('والمعالم الفاسدة تُستثنى',
    placeCrowd(10, [{ latitude: 'x', longitude: 'y' }], {}).length === 0);

ok('ونفس البذرة نفس التوزيع', (() => {
    const a = placeCrowd(40, town, { seed: 9 });
    const b = placeCrowd(40, town, { seed: 9 });
    return a.every((x, i) => x.latitude === b[i].latitude && x.opinion === b[i].opinion);
})());

/*
 * الرأي يتبع المكان.
 *
 * هذه هي الخصلة التي تجعل المناطق تظهر أصلاً: لو رُشّت الآراء
 * عشوائياً على الخريطة لتساوت كل المناطق ولم يكن للربط بالمكان
 * معنى. فنقيس تباين متوسّطات المناطق — ويجب أن يتجاوز الصفر بوضوح.
 */
const spreadOfDistricts = (agents) => {
    const cells = districtsOf(agents, BOUNDS, { cells: 4, least: 2 });
    const means = cells.map(c => c.mean);
    const m = means.reduce((a, b) => a + b, 0) / means.length;
    return means.reduce((a, b) => a + (b - m) ** 2, 0) / means.length;
};

ok('والمناطق تختلف آراؤها لا تتساوى',
    spreadOfDistricts(crowd) > 0.02, `${spreadOfDistricts(crowd).toFixed(4)}`);

// ── ٢) شبكة الجيرة ─────────────────────────────────────────
head('٢) شبكة الجيرة');

const small = placeCrowd(40, town, { seed: 7 });
const links = neighbourhood(small, { near: 5, seed: 7 });

ok('لكلٍّ روابط', links.length === 40 && links.every(l => l.length > 0));
ok('ولا يرتبط بنفسه', links.every((l, i) => !l.includes(i)));
ok('والروابط متبادلة', links.every((l, i) => l.every(j => links[j].includes(i))));

/*
 * الجيران أقرب من غيرهم.
 *
 * هذا هو شرط «الجيرة»: متوسّط مسافة من أسمع منهم أقلّ من متوسّط
 * مسافة الناس كلّهم. وبلا ذلك تكون الشبكة عشوائية لا مكانية،
 * ولا تظهر مناطق.
 */
const avgLinked = (() => {
    let sum = 0;
    let n = 0;
    links.forEach((l, i) => l.forEach(j => { sum += haversine(small[i], small[j]); n += 1; }));
    return sum / n;
})();

const avgAll = (() => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < small.length; i++) {
        for (let j = i + 1; j < small.length; j++) { sum += haversine(small[i], small[j]); n += 1; }
    }
    return sum / n;
})();

ok('والجيران أقرب من عموم الناس', avgLinked < avgAll * 0.6,
    `${Math.round(avgLinked)} م مقابل ${Math.round(avgAll)} م`);

ok('والواحد بلا روابط', neighbourhood([small[0]], {}).length === 1);

// ── ٣) المناطق ─────────────────────────────────────────────
head('٣) المناطق');

const cells = districtsOf(crowd, BOUNDS, { cells: 5, least: 3 });
ok('تُقسَم مناطق', cells.length > 1, `${cells.length}`);
ok('ولكلٍّ عدّة وكلاء', cells.every(c => c.count >= 3));
ok('ومجموعها لا يتجاوز الكلّ',
    cells.reduce((a, c) => a + c.count, 0) <= crowd.length);
ok('ولكلٍّ حدود صالحة', cells.every(c => c.north > c.south && c.east > c.west));
ok('ومركزها داخلها', cells.every(c =>
    c.centre.latitude > c.south && c.centre.latitude < c.north
    && c.centre.longitude > c.west && c.centre.longitude < c.east));
ok('والميل يوافق المتوسّط', cells.every(c =>
    (c.mean > 0.15 && c.lean === 'for')
    || (c.mean < -0.15 && c.lean === 'against')
    || (Math.abs(c.mean) <= 0.15 && c.lean === 'split')));

/* المنطقة القليلة تُهمل: رأي واحد لا يصف منطقة */
ok('والقليلة تُهمل', (() => {
    const lonely = [{ ...crowd[0], latitude: 31.9505, longitude: 35.1705 }];
    const got = districtsOf(lonely, BOUNDS, { cells: 5, least: 3 });
    return got.length === 0;
})());

ok('والحدود المقلوبة تُرفض',
    districtsOf(crowd, { south: 32, north: 31, west: 35, east: 36 }, {}).length === 0);

// الجهات
ok('الجهة تُسمّى', (() => {
    const topRight = { centre: { latitude: 31.976, longitude: 35.196 } };
    const middle = { centre: { latitude: 31.9635, longitude: 35.1835 } };
    return sideName(topRight, BOUNDS).includes('الشمال')
        && sideName(middle, BOUNDS) === 'الوسط';
})(), sideName({ centre: { latitude: 31.976, longitude: 35.196 } }, BOUNDS));

// ── ٤) التشغيل على الخريطة ─────────────────────────────────
head('٤) التشغيل على الخريطة');

const quiet = runOnMap({ agents: crowd, bounds: BOUNDS, rounds: 16, seed: 4 });

ok('يُعيد كل جولة ومعها الأولى', quiet.frames.length === 17);
ok('والجولة صفر قبل الحدث', quiet.frames[0].round === 0);
ok('ولكل جولة وكلاؤها بمواضعهم', quiet.frames.every(fr =>
    fr.agents.length === crowd.length
    && fr.agents.every(a => Number.isFinite(a.latitude) && Number.isFinite(a.opinion))));
ok('ولكل جولة مناطقها', quiet.frames.every(fr => Array.isArray(fr.districts)));

ok('والنِّسَب تجمع واحداً', quiet.frames.every(fr =>
    near(fr.forShare + fr.againstShare + fr.neutralShare, 1, 1e-9)));

ok('والمواضع لا تتغيّر — الناس تتحرّك آراؤهم لا بيوتهم', (() => {
    const a = quiet.frames[0].agents[7];
    const b = quiet.frames[16].agents[7];
    return a.latitude === b.latitude && a.longitude === b.longitude;
})());

ok('ونفس البذرة نفس المسار', (() => {
    const x = runOnMap({ agents: crowd, bounds: BOUNDS, rounds: 10, seed: 4 });
    const y = runOnMap({ agents: crowd, bounds: BOUNDS, rounds: 10, seed: 4 });
    return x.frames.every((fr, i) => near(fr.mean, y.frames[i].mean, 1e-15));
})());

ok('وبلا وكلاء لا نتيجة', runOnMap({ agents: [], bounds: BOUNDS }) === null);

// ── ٥) الحدث ينتشر من موضعه ────────────────────────────────
// وهذا هو جوهر الربط بالمكان: الحدث محلّي لا يصيب الجميع معاً.
head('٥) الحدث ينتشر من موضعه');

const corner = { latitude: 31.9555, longitude: 35.1755 };

const shaken = runOnMap({
    agents: crowd,
    bounds: BOUNDS,
    rounds: 16,
    seed: 4,
    event: { ...corner, radius: 500, toward: 1, force: 0.9, at: 3, label: 'حدث في الزاوية' }
});

ok('الحدث يُزيح الرأي نحوه',
    shaken.frames[4].mean > quiet.frames[4].mean,
    `${shaken.frames[4].mean.toFixed(3)} مقابل ${quiet.frames[4].mean.toFixed(3)}`);

ok('ويُعلَّم في جولته', shaken.frames[3].note === 'حدث في الزاوية');

/*
 * القريب يتأثّر أكثر من البعيد.
 *
 * هذا ما يُفرّق المحاكاة المكانية عن المجرّدة: لو تأثّر الجميع
 * بالقدر نفسه لما كان لموضع الحدث معنى.
 */
const movedBy = (id) => {
    const a = shaken.frames[4].agents.find(x => x.id === id);
    const b = quiet.frames[4].agents.find(x => x.id === id);
    return a.opinion - b.opinion;
};

const ranked = crowd
    .map(a => ({ id: a.id, d: haversine(corner, a) }))
    .sort((a, b) => a.d - b.d);

const closeMoved = ranked.slice(0, 12).reduce((s, r) => s + movedBy(r.id), 0) / 12;
const farMoved = ranked.slice(-12).reduce((s, r) => s + movedBy(r.id), 0) / 12;

ok('والقريب يتأثّر أكثر من البعيد',
    closeMoved > farMoved,
    `${closeMoved.toFixed(4)} مقابل ${farMoved.toFixed(4)}`);

/*
 * الانتشار يُقاس على فئة لا على فرد.
 *
 * وكيلٌ بعينه قد لا يتحرّك أبداً: الثقة المحدودة تجعل من لا يجد
 * جاراً يقاربه رأياً أصمَّ عن الجميع. فالحكم على «البعيدين» كفئة
 * هو الحكم الصحيح — والفرد الواحد قد يكون هو ذلك الأصمّ.
 */
const bandOf = (lo, hi) => ranked.filter(r => r.d >= lo && r.d < hi).map(r => r.id);
const movedAt = (round, ids) => ids.filter(id => Math.abs(
    shaken.frames[round].agents.find(x => x.id === id).opinion
    - quiet.frames[round].agents.find(x => x.id === id).opinion) > 1e-12).length;

const farBand = bandOf(1400, 99999);

/*
 * جمهورُ البعيدين لا يتأثّر في جولة الحدث — لا كلُّهم.
 *
 * فالشبكة فيها روابط بعيدة قليلة، فيسمع نفرٌ منهم فوراً كمن يُهاتفه
 * قريبٌ من موضع الحدث. وهذا مقصود: بلا تلك الروابط تبقى كل منطقة
 * معزولة ولا ينتشر شيء. فالحكم «الأكثرية» لا «الكلّ».
 */
ok('وجمهور البعيدين لا يتأثّر في جولة الحدث',
    movedAt(3, farBand) < farBand.length * 0.2,
    `${movedAt(3, farBand)} من ${farBand.length} — وهم أصحاب الروابط البعيدة`);

/* ثمّ ينتشر إليهم عبر الجيرة جولةً بعد جولة */
ok('ثمّ ينتشر إليهم عبر الجيرة',
    movedAt(15, farBand) > farBand.length * 0.8,
    `${movedAt(15, farBand)} من ${farBand.length}`);

ok('والقريبون يتأثّرون قبلهم',
    movedAt(3, bandOf(0, 500)) > 0,
    `${movedAt(3, bandOf(0, 500))} من ${bandOf(0, 500).length}`);

// ── ٦) المحصّلة ────────────────────────────────────────────
head('٦) المحصّلة');

ok('تُحسب النِّسَب', Number.isFinite(shaken.outcome.forShare)
    && Number.isFinite(shaken.outcome.againstShare));
ok('وأقوى منطقة تأييداً ومعارضةً',
    shaken.outcome.strongestFor && shaken.outcome.strongestAgainst
    && shaken.outcome.strongestFor.mean >= shaken.outcome.strongestAgainst.mean);
ok('وأكثر منطقة تحوّلاً تُذكر مع مقدار تحوّلها',
    shaken.outcome.swung && Number.isFinite(shaken.outcome.swung.shift));
ok('والإزاحة محسوبة', Number.isFinite(shaken.outcome.shift));

// ── ٧) دائرة الحدث ─────────────────────────────────────────
head('٧) دائرة الحدث');

const ring = circlePolygon(corner, 500, 48);
ok('مضلّع مغلق', ring.type === 'Polygon'
    && ring.coordinates[0].length === 49
    && near(ring.coordinates[0][0][0], ring.coordinates[0][48][0], 1e-12));

/* نصف القطر صحيح في الاتجاهين: وبلا تصحيح جيب التمام تصير
   الدائرة بيضوية ممتدّة شرقاً */
const centrePt = { latitude: corner.latitude, longitude: corner.longitude };
const dists = ring.coordinates[0].map(([lon, lat]) =>
    haversine(centrePt, { latitude: lat, longitude: lon }));

const minD = Math.min(...dists);
const maxD = Math.max(...dists);

ok('ونصف قطرها خمسمئة متر في كل اتجاه',
    minD > 470 && maxD < 530, `${Math.round(minD)}..${Math.round(maxD)} م`);
ok('وليست بيضوية', maxD / minD < 1.08, `${(maxD / minD).toFixed(3)}`);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
