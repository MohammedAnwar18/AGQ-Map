/* اختبارات سلاسل الأثر — أنّ الحدث يُحلَّل بطبيعته، وأنّ كل رقمٍ يُرَدّ إلى نموذج */
import {
    STANDARDS, standardsFor,
    describeRoad, roadImpact, alternatives,
    exposedPlaces, sectorPolygon, trimLine,
    HAZARDS, KNOBS, analyseEvent, severityOfEvent
} from '../src/components/helly/consequence.js';
import { FIRE_LOAD, FIRE_ZONES, SIGNAL_FAILURE_CAPACITY_LOSS, hourlyFlow } from '../src/components/helly/hazardScience.js';
import { haversine } from '../src/components/helly/spatialAgent.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

/* موضعٌ حقيقيّ: بيرزيت. والمسافات هنا محسوبة لا مقدَّرة */
const at = (lat, lon) => ({ latitude: lat, longitude: lon });
const BZ = at(31.9617, 35.1839);

/* 0.001° من خط العرض ≈ 111.2 م ، ومن خط الطول هنا ≈ 94.3 م */
const north = (m) => at(BZ.latitude + m / 111320, BZ.longitude);
const east = (m) => at(BZ.latitude, BZ.longitude + m / (111320 * Math.cos(BZ.latitude * Math.PI / 180)));

const place = (name, category, at_) => ({ name, category, ...at_ });

/* شارعٌ ممتدّ شرقاً من موضع الحدث — خطّه حقيقيّ كي يُقاس عليه */
const lineEast = (metres, steps = 10) => Array.from({ length: steps + 1 }, (_, i) => {
    const pt = east((metres * i) / steps);
    return [pt.longitude, pt.latitude];
});

const road = (over = {}) => ({
    id: 1, name: 'شارع رئيسي', highway: 'primary', lanes: '2',
    distance: 10, length: 800,
    centre: { latitude: BZ.latitude, longitude: BZ.longitude + 0.002 },
    lines: [lineEast(800)],
    ...over
});

// ── ١) وصف الطريق ───────────────────────────────────────────
head('١) وصف الطريق — ما يدخل الحساب');

const r1 = describeRoad(road());
ok('شريان أوّلي بمسارين ⇒ سعة ٣٢٠٠', r1.capacity === 3200, String(r1.capacity));
ok('المسارات موسومة فيُعلَن ذلك', r1.lanesTagged === true);
ok('السرعة من التصنيف حين لا وسم', r1.speed === 60 && r1.speedTagged === false);
ok('السرعة الموسومة تُقدَّم على التصنيف',
    describeRoad(road({ maxspeed: 80 })).speed === 80
    && describeRoad(road({ maxspeed: 80 })).speedTagged === true);
ok('مسارات غير موسومة تُستكمَل من التصنيف',
    describeRoad(road({ lanes: null })).lanes === 2
    && describeRoad(road({ lanes: null })).lanesTagged === false);
ok('شارع سكنيّ بلا وسم ⇒ مسار واحد',
    describeRoad(road({ highway: 'residential', lanes: null })).lanes === 1);
ok('تصنيف مجهول لا يُسقط الحساب',
    describeRoad(road({ highway: 'raceway', lanes: null })).capacity > 0);
ok('خطّ واحد في coords يُقرأ كما تُقرأ lines',
    describeRoad({ highway: 'primary', coords: lineEast(400) }).lines.length === 1);
ok('بلا هندسة ⇒ لا خطوط ولا خطأ',
    describeRoad({ highway: 'primary' }).lines.length === 0);
ok('الحركة اليومية تتدرّج مع التصنيف',
    describeRoad(road({ highway: 'motorway' })).daily
    > describeRoad(road({ highway: 'residential' })).daily);

// ── ٢) أثر الحدث على الطريق — يختلف بنوعه ───────────────────
head('٢) أثر الحدث على الطريق — لكلّ حدثٍ نصيبه من السعة');

const crash = roadImpact(road(), { kind: 'accident', blockedLanes: 1, hour: 8 });
/* مسارٌ من اثنين مغلق ⇒ الباقي 1600×1 = 1600 */
ok('إغلاق مسار من اثنين ⇒ السعة ١٦٠٠', crash.capacityAfter === 1600, String(crash.capacityAfter));
ok('المفقود ١٦٠٠ أيضاً', crash.lost === 1600);
ok('السبب يذكر العدد', crash.cause.includes('1 من 2'));

/* الوارد: 11000×2 مسار = 22000 يومياً × نصيب الثامنة 0.095 = 2090 */
ok('الوارد في الثامنة ٢٠٩٠ مركبة/ساعة',
    near(crash.arriving, 2090, 1e-9), String(crash.arriving));
ok('النسبة قبل ٢٠٩٠/٣٢٠٠ = ٠٫٦٥٣ ⇒ B',
    near(crash.ratioBefore, 2090 / 3200, 1e-12) && crash.losBefore.grade === 'B');
ok('النسبة بعد ٢٠٩٠/١٦٠٠ = ١٫٣٠٦ ⇒ F',
    near(crash.ratioAfter, 2090 / 1600, 1e-12) && crash.losAfter.grade === 'F');
ok('الطابور ينمو لأنّ الوارد تجاوز المنصرف', crash.queue.growing === true);
/* الفائض 490/ساعة ⇒ في ١٥ دقيقة 122.5 مركبة ⇒ 122.5×7/2 = 428.75 م */
ok('الطابور ٤٢٨٫٧٥ متراً بعد ربع ساعة',
    near(crash.queue.metres, 428.75, 1e-9), String(crash.queue.metres));

ok('إغلاق المسارين كلّها ⇒ سعة صفر ونسبة لا نهائية',
    roadImpact(road(), { kind: 'accident', blockedLanes: 2, hour: 8 }).capacityAfter === 0
    && !Number.isFinite(roadImpact(road(), { kind: 'accident', blockedLanes: 2, hour: 8 }).ratioAfter));
ok('إغلاق أكثر من المسارات الموجودة لا يُنتج سعة سالبة',
    roadImpact(road(), { kind: 'accident', blockedLanes: 9, hour: 8 }).capacityAfter === 0);
ok('السبب يقول «مغلق كلّياً» حين تُغلق كلّها',
    roadImpact(road(), { kind: 'accident', blockedLanes: 2, hour: 8 }).cause.includes('كلّياً'));

const fireHit = roadImpact(road(), { kind: 'fire', hour: 8 });
const powerHit = roadImpact(road(), { kind: 'power', hour: 8 });
const crowdHit = roadImpact(road(), { kind: 'crowd', hour: 8 });

ok('الحريق يُغلق الطريق كلّه — لا مسارات معدودة', fireHit.capacityAfter === 0);
ok('الانقطاع يُسقط نصف السعة بالضبط',
    powerHit.capacityAfter === 3200 * (1 - SIGNAL_FAILURE_CAPACITY_LOSS));
ok('ما يُبقيه التجمّع أقلّ من نصف — أشدّ من تعطّل الإشارة',
    crowdHit.capacityAfter < powerHit.capacityAfter);
/* لكل حدثٍ قاعدته في السعة الباقية — والقاعدة هي الحكم، لا تمايز
   الأرقام: إغلاق مسارٍ من اثنين يُصادف أن يساوي نصف السعة، فيوافق
   ناتجُه ناتجَ تعطّل الإشارة مصادفةً لا اتّفاقاً في النموذج */
ok('الحريق: السعة صفر مهما كانت المسارات', fireHit.capacityAfter === 0);
ok('الانقطاع: نصف السعة بالضبط', powerHit.capacityAfter === 3200 * 0.5);
ok('التجمّع: ٤٠٪ من السعة بالضبط', near(crowdHit.capacityAfter, 3200 * 0.4, 1e-9));
ok('الحادث: سعة المسار مضروبةً في الباقي', crash.capacityAfter === 1600 * 1);
ok('وثلاث قواعد تُعطي ثلاث نتائج مختلفة على الطريق نفسه',
    new Set([fireHit.capacityAfter, powerHit.capacityAfter, crowdHit.capacityAfter]).size === 3);
ok('إغلاق مسارٍ من ثلاثة يُفرّق الحادث عن تعطّل الإشارة',
    roadImpact(road({ lanes: '3' }), { kind: 'accident', blockedLanes: 1, hour: 8 }).capacityAfter
    !== roadImpact(road({ lanes: '3' }), { kind: 'power', hour: 8 }).capacityAfter);
ok('وكل حدث يذكر سببه بنصٍّ مختلف',
    new Set([crash.cause, fireHit.cause, powerHit.cause, crowdHit.cause]).size === 4);

head('الزمن يُغيّر الأثر على الطريق نفسه');
const night = roadImpact(road(), { kind: 'accident', blockedLanes: 1, hour: 3 });
ok('نفس الحادث الثالثة فجراً: لا طابور', night.queue.growing === false);
ok('ومستوى الخدمة يبقى A ليلاً', night.losAfter.grade === 'A');
ok('والوارد ليلاً أقلّ من ربع وارد الذروة', night.arriving < crash.arriving / 4);
ok('السعة الباقية هي هي — الزمن يُغيّر الطلب لا الطريق',
    night.capacityAfter === crash.capacityAfter);

// ── ٣) البدائل ──────────────────────────────────────────────
head('٣) البدائل — القرب لا يكفي');

/* الشبكة كما يردّها الخادم: مع كل طريق أقرب مسافةٍ منه إلى موضع
   الاستعلام — وهي ما يُحسب عليها الالتفاف */
const network = [
    road(),
    road({ id: 2, name: 'شارع ثانوي', highway: 'secondary', lanes: '2', distance: 300, centre: east(300) }),
    road({ id: 3, name: 'ممرّ خدمة', highway: 'service', lanes: '1', distance: 80, centre: east(80) }),
    road({ id: 4, name: 'شارع فرعي', highway: 'tertiary', lanes: '1', distance: 900, centre: east(900) })
];

const alts = alternatives(network[0], network, { need: 1600 });
ok('الطريق المتأثّر لا يُعدّ بديلاً لنفسه', alts.every(a => a.id !== 1));
ok('ممرّ الخدمة يُستبعد — سعته ٤٠٠ دون نصف المفقود ٨٠٠',
    alts.every(a => a.id !== 3), JSON.stringify(alts.map(a => a.name)));
ok('الشارع الثانوي بديلٌ مقبول', alts.some(a => a.id === 2));
ok('البدائل مرتّبة بالأقلّ تأخيراً',
    alts.every((a, i) => i === 0 || alts[i - 1].addedMinutes <= a.addedMinutes));
ok('البديل الأقرب يُضيف زمناً أقلّ', alts[0].id === 2);

/* البديل على ٣٠٠ م ⇒ التفاف ٦٠٠ م على سرعة 50×0.7=35 ⇒ (0.6/35)×60 = 1.0286 د */
ok('بديل على ٣٠٠ م ⇒ ١٫٠٣ دقيقة إضافية',
    near(alts[0].addedMinutes, (0.6 / 35) * 60, 1e-6), String(alts[0].addedMinutes));
ok('المسافة تُؤخذ من وسم OSM لا من مركز الطريق', alts[0].gap === 300);
ok('وبلا وسم مسافةٍ تُحسب إلى مركز الطريق',
    alternatives(road(), [road({ id: 7, distance: null, centre: east(400) })],
        { need: 0, from: BZ })[0].gap > 350);
ok('حاجةٌ هائلة تُفرّغ قائمة البدائل',
    alternatives(network[0], network, { need: 999999 }).length === 0);
ok('بلا حاجةٍ محدّدة تُقبل كل الطرق',
    alternatives(network[0], network, { need: 0 }).length === 3);
ok('الاتجاه الواحد يُعلَن لا يُخمَّن',
    alternatives(network[0], [road({ id: 9, oneway: true, centre: east(200) })], { need: 0 })[0].oneway === true);
ok('شبكة فارغة ⇒ لا بدائل ولا خطأ', alternatives(network[0], [], { need: 100 }).length === 0);
ok('شبكة غائبة ⇒ لا بدائل ولا خطأ', alternatives(network[0], null, { need: 100 }).length === 0);

// ── ٤) المعالم المعرَّضة ────────────────────────────────────
head('٤) المعالم المعرَّضة — من يقع في النطاق ومن فيه');

const landmarks = [
    place('مدرسة بيرزيت', 'مدرسة', north(120)),
    place('مستشفى الحكومي', 'مستشفى', north(900)),
    place('صيدلية النور', 'صيدلية', east(200)),
    place('كازية الوفاء', 'محطة وقود', east(60)),
    place('بقالة الحي', 'Supermarket', north(2500))
];

const exposed = exposedPlaces(BZ, landmarks, 1000, 10);
ok('ما خرج عن النطاق لا يُحسب', exposed.length === 4 && !exposed.some(x => x.category === 'Supermarket'));
ok('مرتّبة بالأقرب', exposed[0].name === 'كازية الوفاء');
ok('كل معلمٍ يحمل مسافته واتجاهه', exposed.every(x => Number.isFinite(x.distance) && Number.isFinite(x.bearing)));
ok('المدرسة شمال الحدث', exposed.find(x => x.category === 'مدرسة').bearing < 1);
ok('الكازية شرق الحدث', near(exposed.find(x => x.category === 'محطة وقود').bearing, 90, 0.5));

ok('الخدمات الحياتية مُعلَّمة',
    exposed.filter(x => x.lifeline).length === 3);
ok('الحسّاسون للدخان مُعلَّمون',
    exposed.filter(x => x.sensitive).map(x => x.category).sort().join() === 'مدرسة,مستشفى');

head('الرؤوس تتبع الساعة');
const atTen = exposedPlaces(BZ, landmarks, 1000, 10);
const atTen_school = atTen.find(x => x.category === 'مدرسة');
const atTwo = exposedPlaces(BZ, landmarks, 1000, 2).find(x => x.category === 'مدرسة');

ok('المدرسة العاشرة صباحاً تحمل مئاتاً', atTen_school.heads > 350, String(atTen_school.heads));
ok('وهي الثانية فجراً تحمل العشرات', atTwo.heads < 15, String(atTwo.heads));
ok('نسبة الرؤوس = نسبة الامتلاء بالضبط',
    near(atTen_school.heads / atTwo.heads,
        atTen_school.occupancy.share / atTwo.occupancy.share, 1e-9));
ok('المستشفى لا يخلو ليلاً',
    exposedPlaces(BZ, landmarks, 1000, 3).find(x => x.category === 'مستشفى').occupancy.open === true);
ok('نطاق صفر ⇒ لا شيء معرَّض', exposedPlaces(BZ, landmarks, 0, 10).length === 0);
ok('معالم غائبة ⇒ لا شيء ولا خطأ', exposedPlaces(BZ, null, 1000, 10).length === 0);
ok('معلمٌ بلا إحداثيات يُستبعد لا يُسقط',
    exposedPlaces(BZ, [{ name: 'بلا موضع', category: 'مدرسة' }], 1000, 10).length === 0);

// ── ٥) هندسة العرض ─────────────────────────────────────────
head('٥) هندسة العرض — ما يُرسم على الخريطة');

const sector = sectorPolygon(BZ, 90, 500, 30);
ok('القطاع حلقةٌ مغلقة',
    JSON.stringify(sector.coordinates[0][0])
    === JSON.stringify(sector.coordinates[0][sector.coordinates[0].length - 1]));
ok('يبدأ من المركز', near(sector.coordinates[0][0][1], BZ.latitude, 1e-12));
ok('مضلّعٌ صالح', sector.type === 'Polygon' && sector.coordinates[0].length > 10);

const rim = sector.coordinates[0].slice(1, -1).map(c => at(c[1], c[0]));
ok('كل نقاط الحافّة على ٥٠٠ م تقريباً من المركز',
    rim.every(pt => Math.abs(haversine(BZ, pt) - 500) < 6),
    String(Math.max(...rim.map(pt => Math.abs(haversine(BZ, pt) - 500)))));

/* قطاع شرقيّ بانتشار ٣٠°: كل نقطة بين ٧٥° و١٠٥° */
const rimBearings = rim.map(pt => {
    const dLon = pt.longitude - BZ.longitude;
    const dLat = pt.latitude - BZ.latitude;
    return (Math.atan2(dLon * Math.cos(BZ.latitude * Math.PI / 180), dLat) * 180 / Math.PI + 360) % 360;
});
ok('القطاع محصور بين ٧٥° و١٠٥° — لا دائرة',
    rimBearings.every(b => b >= 74.5 && b <= 105.5),
    `${Math.min(...rimBearings).toFixed(1)}–${Math.max(...rimBearings).toFixed(1)}`);
ok('اتجاه الريح يُحرّك القطاع',
    sectorPolygon(BZ, 270, 500, 30).coordinates[0][5][0] < BZ.longitude
    && sector.coordinates[0][5][0] > BZ.longitude);
ok('انتشارٌ أوسع يُوسّع القطاع',
    sectorPolygon(BZ, 90, 500, 90).coordinates[0].length === sector.coordinates[0].length);

head('قصّ الخطّ — الطابور يُرى على الشارع');
const long = lineEast(1000, 20);          // خطّ ألف متر بعشرين قطعة
const cut = trimLine(long, BZ, 300);
ok('القصّ يُنتج خطّاً', cut && cut.type === 'LineString');
ok('يبدأ من أقرب نقطة إلى الحدث', near(cut.coordinates[0][0], BZ.longitude, 1e-9));

const cutLength = cut.coordinates.slice(1).reduce((sum, c, i) => {
    const a = at(cut.coordinates[i][1], cut.coordinates[i][0]);
    return sum + haversine(a, at(c[1], c[0]));
}, 0);
ok('طوله يبلغ المطلوب ولا يُجاوزه بأكثر من قطعة',
    cutLength >= 300 && cutLength <= 300 + 55, String(cutLength));
ok('طلبٌ أطول من الخطّ يُعطي الخطّ كلّه',
    trimLine(long, BZ, 99999).coordinates.length === long.length);
ok('خطٌّ من نقطةٍ واحدة لا يُقصّ', trimLine([[35, 31]], BZ, 100) === null);
ok('خطٌّ غائب لا يُسقط', trimLine(null, BZ, 100) === null);

/* البداية في وسط الخطّ: يسير في الجهة الأطول — وهي الأمامية هنا */
const midStart = trimLine(long, east(500), 200);
ok('بدايةٌ من الوسط تسير في الجهة الأطول', midStart.coordinates.length > 1);

// ── ٦) المعايير ────────────────────────────────────────────
head('٦) المعايير المعروضة');

ok('كل معيار يحمل رمزه وجهته وما يُفيده',
    STANDARDS.every(s => s.code && s.body && s.about && s.chains?.length));
ok('المرور يُستدعي HCM لا NFPA',
    standardsFor(['traffic']).some(s => s.code.startsWith('HCM'))
    && !standardsFor(['traffic']).some(s => s.code === 'NFPA 1710'));
ok('الحريق يُستدعي SFPE وERG وWHO',
    ['SFPE Handbook', 'ERG 2024', 'WHO AQG 2021']
        .every(c => standardsFor(['fire']).some(s => s.code === c)));
ok('الانقطاع يُستدعي FDA وWHO EVM',
    ['FDA Food Code', 'WHO EVM'].every(c => standardsFor(['power']).some(s => s.code === c)));
ok('الوصول يُستدعي NFPA 1710 وUN-Habitat',
    ['NFPA 1710', 'UN-Habitat'].every(c => standardsFor(['access']).some(s => s.code === c)));
ok('بلا سلاسل ⇒ لا معايير', standardsFor([]).length === 0 && standardsFor(null).length === 0);
ok('المعايير لا تتكرّر لسلسلتين',
    new Set(standardsFor(['traffic', 'access']).map(s => s.code)).size
    === standardsFor(['traffic', 'access']).length);

// ── ٧) أنواع الأحداث ───────────────────────────────────────
head('٧) أنواع الأحداث — لكلٍّ طبيعته');

ok('ستّة أنواع', Object.keys(HAZARDS).length === 6);
ok('كلٌّ يحمل اسمه ونطاقه وفيزياءه وسلاسله',
    Object.values(HAZARDS).every(h => h.label && h.radius > 0 && h.physics && h.chains?.length));
ok('الحريق وحده يُشغّل سلسلة الحرارة',
    Object.entries(HAZARDS).filter(([, h]) => h.chains.includes('fire')).map(([k]) => k).join() === 'fire');
ok('الانقطاع وحده يُشغّل سلسلة التيّار',
    Object.entries(HAZARDS).filter(([, h]) => h.chains.includes('power')).map(([k]) => k).join() === 'power');
ok('الوصول يُفحص في كل حدث',
    Object.values(HAZARDS).every(h => h.chains.includes('access')));
ok('الناس يُحسبون في كل حدث',
    Object.values(HAZARDS).every(h => h.chains.includes('people')));
ok('الطارئ الطبّي لا يُحلَّل مروريّاً — كلّه زمن وصول',
    !HAZARDS.medical.chains.includes('traffic'));
ok('كل مقبضٍ مذكور له تعريف',
    Object.values(HAZARDS).every(h => h.knobs.every(k => KNOBS[k])));
ok('كل مقبض يُعلّل سببه', Object.values(KNOBS).every(k => k.label && k.why));
ok('مقابض الحريق هي الحمولة والريح',
    HAZARDS.fire.knobs.sort().join() === 'load,windToward');
ok('حمولات المقبض هي حمولات الحريق نفسها',
    KNOBS.load.options.join() === Object.keys(FIRE_LOAD).join());

// ── ٨) التحليل الكامل ──────────────────────────────────────
head('٨) التحليل الكامل');

const peak = analyseEvent(
    { ...BZ, kind: 'accident', hour: 8, blockedLanes: 2, radius: 1000 }, landmarks, network);

ok('يردّ سطوراً مقروءة', peak.findings.length > 0);
ok('كل سطر له نبرة وعنوان ونصّ',
    peak.findings.every(x => ['high', 'warn', 'info'].includes(x.tone) && x.head && x.body));
ok('العاجل يتقدّم على التحذير على المعلومة',
    peak.findings.map(x => ({ high: 0, warn: 1, info: 2 }[x.tone]))
        .every((v, i, a) => i === 0 || a[i - 1] <= v));
ok('الأشكال مجموعة GeoJSON صالحة',
    peak.shapes.type === 'FeatureCollection'
    && peak.shapes.features.every(ft => ft.type === 'Feature' && ft.geometry && ft.properties.layer));
ok('نطاق الدراسة مرسوم في كل حال',
    peak.shapes.features.some(ft => ft.properties.layer === 'scope'));
ok('الطريق المتأثّر مرسوم', peak.shapes.features.some(ft => ft.properties.layer === 'road'));
ok('الطابور مرسوم حين ينمو', peak.shapes.features.some(ft => ft.properties.layer === 'queue'));
ok('البدائل مرسومة', peak.shapes.features.some(ft => ft.properties.layer === 'alternative'));
ok('كل شكلٍ يحمل وسماً يُقرأ', peak.shapes.features.every(ft => ft.properties.label));
ok('المعايير مرفقة بالتحليل', peak.standards.length > 0);
ok('الساعة مقروءة', peak.clock.text.includes('صباحاً') && peak.clock.peak === true);
ok('المجاميع محسوبة',
    peak.totals.places === 4 && peak.totals.lifeline === 3 && peak.totals.heads > 0);
ok('الأسوأ معروف', peak.totals.worst && peak.totals.worst.tone === 'high');
ok('النوع والموضع محفوظان',
    peak.kind === 'accident' && near(peak.at.latitude, BZ.latitude, 1e-12));

head('الحدث نفسه في ساعتين ⇒ تحليلان');
const quiet = analyseEvent(
    { ...BZ, kind: 'accident', hour: 3, blockedLanes: 2, radius: 1000 }, landmarks, network);

ok('الرؤوس ليلاً أقلّ بكثير', quiet.totals.heads < peak.totals.heads * 0.6,
    `${quiet.totals.heads} مقابل ${peak.totals.heads}`);

/* والأهمّ من نقصان المجموع: تغيّر تركيبه. فالمستشفى وحده يحمل
   معظم الرؤوس ليلاً، والمدرسة تحمل نصيبها نهاراً — وهذا ما يُغيّر
   طبيعة الاستجابة لا حجمها */
const shareOf = (rep, category) => {
    const found = rep.places.find(x => x.category === category);
    return found ? found.heads / rep.totals.heads : 0;
};
ok('المستشفى يحمل أكثر من ٩٠٪ من رؤوس الليل',
    shareOf(quiet, 'مستشفى') > 0.9, String(shareOf(quiet, 'مستشفى')));
ok('والمدرسة تحمل أكثر من ثلث رؤوس الصباح',
    shareOf(peak, 'مدرسة') > 0.33, String(shareOf(peak, 'مدرسة')));
ok('ونصيب المدرسة ليلاً يسقط إلى ما دون ٧٪',
    shareOf(quiet, 'مدرسة') < 0.07, String(shareOf(quiet, 'مدرسة')));
ok('العامل ليلاً أقلّ عدداً', quiet.totals.openNow < peak.totals.openNow);
ok('سطور التحليل تختلف نصّاً لا ترتيباً فقط',
    JSON.stringify(quiet.findings) !== JSON.stringify(peak.findings));
ok('ذروة الصباح تُذكر صراحة ولا تُذكر ليلاً',
    peak.findings.some(x => x.head.includes('ذروة'))
    && !quiet.findings.some(x => x.head.includes('ذروة')));
ok('الشدّة ليلاً أدنى',
    severityOfEvent(quiet).score < severityOfEvent(peak).score,
    `${severityOfEvent(quiet).score} مقابل ${severityOfEvent(peak).score}`);

head('الأحداث تختلف في طبيعتها');
const kinds = ['accident', 'fire', 'power', 'crowd', 'medical', 'closure']
    .map(kind => ({ kind, report: analyseEvent({ ...BZ, kind, hour: 10 }, landmarks, network) }));

ok('كل نوعٍ يُعطي تحليلاً مختلفاً',
    new Set(kinds.map(k => JSON.stringify(k.report.findings))).size === 6);
ok('الإغلاق المخطَّط يُحسب له ما لا يُحسب للحادث: كلفةٌ ونافذة',
    kinds.find(k => k.kind === 'closure').report.findings.some(x => x.head.includes('ساعة-مركبة'))
    && kinds.find(k => k.kind === 'closure').report.findings.some(x => x.head.includes('نافذة'))
    && !kinds.find(k => k.kind === 'accident').report.findings.some(x => x.head.includes('نافذة')));
ok('الحريق وحده يرسم حلقات الحرارة',
    kinds.filter(k => k.report.shapes.features.some(ft => ft.properties.layer === 'heat'))
        .map(k => k.kind).join() === 'fire');
ok('الحريق وحده يرسم ممرّ الدخان',
    kinds.filter(k => k.report.shapes.features.some(ft => ft.properties.layer === 'plume'))
        .map(k => k.kind).join() === 'fire');
ok('الطارئ الطبّي لا يرسم طريقاً ولا طابوراً',
    !kinds.find(k => k.kind === 'medical').report.shapes.features
        .some(ft => ['road', 'queue'].includes(ft.properties.layer)));
ok('الانقطاع يتحدّث عن التبريد والحادث لا',
    kinds.find(k => k.kind === 'power').report.findings.some(x => x.body.includes('تبريد'))
    && !kinds.find(k => k.kind === 'accident').report.findings.some(x => x.body.includes('تبريد')));
ok('نطاق كل حدث هو نطاق نوعه حين لا يُحدَّد',
    kinds.every(k => k.report.radius === HAZARDS[k.kind].radius));
ok('كل تحليلٍ يُرفق معاييره هو',
    new Set(kinds.map(k => k.report.standards.map(s => s.code).sort().join())).size > 1);

head('الحريق — مقابضه تُغيّر نتيجته');
const smallFire = analyseEvent({ ...BZ, kind: 'fire', hour: 10, load: 'vehicle' }, landmarks, network);
const bigFire = analyseEvent({ ...BZ, kind: 'fire', hour: 10, load: 'fuel' }, landmarks, network);
const windEastFire = analyseEvent({ ...BZ, kind: 'fire', hour: 10, windToward: 90 }, landmarks, network);

const isolateOf = (rep) => rep.shapes.features.find(ft => ft.properties.layer === 'isolate').properties.radius;
ok('حريق مركبة يُعزل ٣٠ م وحريق وقود ٣٠٠',
    isolateOf(smallFire) === FIRE_ZONES.vehicle.isolate
    && isolateOf(bigFire) === FIRE_ZONES.fuel.isolate);
ok('حلقات الحرارة تتّسع مع الحمولة',
    bigFire.shapes.features.find(ft => ft.properties.key === 'escape').properties.radius
    > smallFire.shapes.features.find(ft => ft.properties.key === 'escape').properties.radius);
/* الكازية على ٦٠ م: خارج عزل حريق المركبة (٣٠ م) وداخل عزل حريق
   المبنى (١٠٠ م). فالتنبيه يتبع حجم الحريق لا مجرّد وجود الكازية */
ok('حريق مركبة لا يُصعّد على كازيةٍ خارج عزله',
    !smallFire.findings.some(x => x.head.includes('تصعيد')));
ok('حريق مبنى يُصعّد على الكازية نفسها — عزله يبلغها',
    windEastFire.findings.some(x => x.head.includes('تصعيد')));
ok('حريق وقود يُصعّد كذلك', bigFire.findings.some(x => x.head.includes('تصعيد')));

const windEast = windEastFire;
const windNorth = analyseEvent({ ...BZ, kind: 'fire', hour: 10, windToward: 0 }, landmarks, network);
const plumeOf = (rep) => rep.shapes.features.find(ft => ft.properties.layer === 'plume').geometry.coordinates[0][5];

ok('ريحٌ شرقية تُرسل الممرّ شرقاً وشماليةٌ شمالاً',
    plumeOf(windEast)[0] > BZ.longitude && plumeOf(windNorth)[1] > BZ.latitude);
ok('الريح الشمالية تُدخل المدرسة في الممرّ لا الريح الشرقية',
    windNorth.findings.some(x => x.head.includes('حسّاسة'))
    && !windEast.findings.some(x => x.head.includes('حسّاسة')),
    JSON.stringify([windNorth.findings.map(x => x.head), windEast.findings.map(x => x.head)]));

head('الانقطاع — مدّته تُغيّر حكمه');
const shortCut = analyseEvent({ ...BZ, kind: 'power', hour: 10, durationHours: 1 }, landmarks, network);
const longCut = analyseEvent({ ...BZ, kind: 'power', hour: 10, durationHours: 12 }, landmarks, network);

ok('ساعة واحدة لا تتجاوز أيّ حدّ',
    !shortCut.findings.some(x => x.head.includes('تتجاوز')));
ok('اثنتا عشرة ساعة تتجاوز حدود الصيدلية والمستشفى',
    longCut.findings.some(x => x.head.includes('تتجاوز')));
ok('الأطول أشدّ',
    severityOfEvent(longCut).score >= severityOfEvent(shortCut).score);

head('غياب البيانات يُقال صريحاً');
const noRoads = analyseEvent({ ...BZ, kind: 'accident', hour: 8 }, landmarks, []);
ok('بلا شبكة طرق يُطلب تحميلها ولا يُخمَّن',
    noRoads.findings.some(x => x.head.includes('لا شبكة طرق')));
ok('ولا يُرسم طريقٌ لم يُقرأ',
    !noRoads.shapes.features.some(ft => ft.properties.layer === 'road'));
ok('بلا معالم رعاية يُقال إنّه نقص بيانات لا نقص خدمة',
    analyseEvent({ ...BZ, kind: 'medical', hour: 8 }, [landmarks[0]], network)
        .findings.some(x => x.body.includes('نقصُ بيانات')));
ok('بلا معالم أصلاً لا يسقط التحليل',
    analyseEvent({ ...BZ, kind: 'accident', hour: 8 }, [], network).findings.length > 0);
ok('بلا معالم ولا طرق لا يسقط التحليل',
    analyseEvent({ ...BZ, kind: 'fire', hour: 8 }, null, null).findings.length > 0);
ok('نوعٌ مجهول يُعامَل كحادث سير',
    analyseEvent({ ...BZ, kind: 'لا نوع', hour: 8 }, landmarks, network).hazard === HAZARDS.accident);
ok('ساعةٌ خارج النطاق تلتفّ',
    analyseEvent({ ...BZ, kind: 'accident', hour: 32 }, landmarks, network).hour === 8);
ok('نطاقٌ مُعطى يُقدَّم على نطاق النوع',
    analyseEvent({ ...BZ, kind: 'accident', hour: 8, radius: 250 }, landmarks, network).radius === 250);

// ── ٩) الشدّة ──────────────────────────────────────────────
head('٩) الشدّة — من النتائج لا من الحجم');

ok('الشدّة بين صفر ومئة',
    kinds.every(k => {
        const s = severityOfEvent(k.report);
        return s.score >= 0 && s.score <= 100;
    }));
ok('كل شدّةٍ تحمل نطاقها ووصفها',
    kinds.every(k => ['low', 'medium', 'high'].includes(severityOfEvent(k.report).band)
        && severityOfEvent(k.report).say));
ok('بلا تقرير ⇒ صفر لا خطأ', severityOfEvent(null).score === 0);
ok('وبلا تقرير يُردّ تفصيلٌ فارغ لا غائب',
    Array.isArray(severityOfEvent(null).parts) && severityOfEvent(null).parts.length === 0);

head('تفصيل الشدّة — من أين جاءت كل نقطة');
const sev = severityOfEvent(peak);

ok('أربعة أوجهٍ للشدّة', sev.parts.length === 4);
ok('كلٌّ يحمل قيمته ومرجعه ونصيبه ونقاطه',
    sev.parts.every(x => Number.isFinite(x.value) && x.per > 0
        && x.share >= 0 && x.share <= 1 && Number.isFinite(x.points) && x.say));
ok('مجموع النقاط هو الدرجة',
    near(sev.parts.reduce((a, b) => a + b.points, 0), sev.score, 0.5),
    `${sev.parts.reduce((a, b) => a + b.points, 0)} مقابل ${sev.score}`);
ok('مجموع الأوزان واحدٌ صحيح — فالسقف مئة',
    near(sev.parts.reduce((a, b) => a + b.weight, 0), 1, 1e-12));
ok('لا وجهٍ يتجاوز وزنه مهما كبرت قيمته',
    sev.parts.every(x => x.points <= x.weight * 100 + 1e-9));
ok('النتائج العاجلة أثقل الأوجه',
    sev.parts.find(x => x.of === 'urgent').weight
    === Math.max(...sev.parts.map(x => x.weight)));

/* المقصود من تغيير المقياس: أن تُقرأ الفروق. فالمجموع المضغوط بـ‎tanh‎
   كان يُشبع عند المئة، فيُعطي الثامنة ٩٨ والثالثة فجراً ٩٥ — وفرقُ ثلاث
   نقاط بين حدثٍ في الذروة وحدثٍ في جوف الليل لا يُقرأ */
ok('الفرق بين الذروة وجوف الليل يُقرأ — أكثر من عشر نقاط',
    severityOfEvent(peak).score - severityOfEvent(quiet).score > 10,
    `${severityOfEvent(peak).score} مقابل ${severityOfEvent(quiet).score}`);
ok('ولا يُشبع المقياس عند المئة في الأحداث المعتادة',
    kinds.every(k => severityOfEvent(k.report).score < 95),
    JSON.stringify(kinds.map(k => `${k.kind}:${severityOfEvent(k.report).score}`)));
ok('وأحداثٌ مختلفة تُعطي درجاتٍ مختلفة لا درجةً واحدة',
    new Set(kinds.map(k => severityOfEvent(k.report).score)).size >= 4,
    JSON.stringify(kinds.map(k => `${k.kind}:${severityOfEvent(k.report).score}`)));

/* سقفٌ محصور: تقريرٌ مُتخم لا يتجاوز المئة ولا ينزل عن الصفر */
const stuffed = severityOfEvent({ totals: { urgent: 99, warn: 99, lifeline: 99, heads: 99999 } });
ok('تقريرٌ مُتخم ⇒ مئة بالضبط لا أكثر', stuffed.score === 100, String(stuffed.score));
ok('وبنطاق «عالية»', stuffed.band === 'high');
const barren = severityOfEvent({ totals: { urgent: 0, warn: 0, lifeline: 0, heads: 0 } });
ok('تقريرٌ خالٍ ⇒ صفر بالضبط ونطاق «محدودة»',
    barren.score === 0 && barren.band === 'low');
ok('العدّ يوافق سطور التقرير',
    severityOfEvent(peak).urgent === peak.findings.filter(x => x.tone === 'high').length);

/* حدثٌ بعيد عن كل شيء ليلاً: لا ناس ولا معالم ولا طرق. ومع ذلك
   شدّتُه ليست دنيا — لأنّ بُعد الرعاية عنه نتيجةٌ شديدة بنفسها،
   وهذا ما يجب أن يقوله النموذج لا أن يُخفيه */
const empty = analyseEvent({ ...at(32.5, 35.9), kind: 'accident', hour: 3 }, landmarks, []);
ok('حدثٌ في فراغٍ ليلاً: لا ناس ولا معالم',
    empty.totals.places === 0 && empty.totals.heads === 0);
ok('وشدّتُه آتيةٌ من بُعد الرعاية لا من الازدحام',
    empty.findings.some(x => x.tone === 'high' && x.head.includes('رعاية')));
ok('ولا يُدّعى فيه تحليلٌ مروريّ بلا بيانات',
    empty.findings.some(x => x.head.includes('لا شبكة طرق')));
ok('حدثٌ عند مدرسةٍ وقت الدوام أشدّ من مثله في الفراغ',
    severityOfEvent(peak).score > severityOfEvent(empty).score,
    severityOfEvent(peak).score + ' مقابل ' + severityOfEvent(empty).score);

console.log(`\n${p} نجحت · ${f} سقطت`);
process.exit(f ? 1 : 0);
