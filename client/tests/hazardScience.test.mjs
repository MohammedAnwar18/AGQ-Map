/* اختبارات فيزياء الأحداث — كل رقم يُقارَن بحسابٍ يدويّ أو بعتبة في معيار */
import {
    HEAT_FLUX, FIRE_LOAD, heatRadius, heatRings,
    ROAD_CLASS, roadClassOf, LOS_BANDS, losOf,
    queueLength, detourDelay,
    RESPONSE, travelMinutes, responseVerdict,
    EGRESS, evacuationMinutes,
    WALK_BANDS, walkVerdict,
    OUTAGE, SIGNAL_FAILURE_CAPACITY_LOSS,
    HOUR_SHARE, PEAK_HOURS, hourlyFlow,
    OCCUPANCY, occupancyOf, hourLabel,
    FIRE_ZONES, fireZoneOf, AIR, PLUME_SPREAD_DEG
} from '../src/components/helly/hazardScience.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

// ── ١) الإشعاع الحراري ──────────────────────────────────────
head('١) الإشعاع الحراري — نموذج المصدر النقطي');

/* r = √( χQ / 4πq" ) ، χ=0.3 ، Q=30 MW=30000 kW ، q"=4.7
   χQ = 9000 ، 4π·4.7 = 59.061944 ، 9000/59.061944 = 152.38278
   r = 12.344342 م */
ok('مبنى ٣٠ م.و عند ٤٧ ك.و/م² ⇒ ١٢٫٣٤ م',
    near(heatRadius(30, 4.7), 12.344326321109, 1e-9),
    String(heatRadius(30, 4.7)));

/* q" = 37.5 ⇒ 9000/(4π·37.5) = 9000/471.23890 = 19.09859 ، r = 4.370193 */
ok('عتبة التلف الإنشائي ٣٧٫٥ ⇒ ٤٫٣٧ م',
    near(heatRadius(30, 37.5), 4.3701934, 1e-6),
    String(heatRadius(30, 37.5)));

ok('العتبة الأشدّ أقرب مدىً من العتبة الأخفّ',
    heatRadius(30, 37.5) < heatRadius(30, 12.5)
    && heatRadius(30, 12.5) < heatRadius(30, 4.7)
    && heatRadius(30, 4.7) < heatRadius(30, 1.6));

/* المدى يتناسب مع الجذر: مضاعفة القدرة تضرب المدى في √2 */
ok('مضاعفة القدرة تضرب المدى في ١٫٤١٤ لا في ٢',
    near(heatRadius(60, 4.7) / heatRadius(30, 4.7), Math.SQRT2, 1e-12));

ok('قدرة صفر ⇒ مدى صفر', heatRadius(0, 4.7) === 0);
ok('قدرة سالبة تُقصّ إلى صفر', heatRadius(-50, 4.7) === 0);
ok('تدفّق صفر لا يُقسم على صفر', Number.isFinite(heatRadius(30, 0)));

ok('نصيب الإشعاع يرفع المدى', heatRadius(30, 4.7, 0.5) > heatRadius(30, 4.7, 0.3));

head('حلقات الحريق');
const rings = heatRings(30);
ok('أربع حلقات', rings.length === 4);
ok('مرتّبة بالمدى تصاعدياً',
    rings.every((r, i) => i === 0 || rings[i - 1].radius <= r.radius));
ok('أوّلها التلف الإنشائي وآخرها الآمن',
    rings[0].key === 'structural' && rings[3].key === 'safe');
ok('كل حلقة تحمل عتبتها ونبرتها',
    rings.every(r => Number.isFinite(r.kw) && typeof r.say === 'string' && r.tone));

ok('عتبات التدفّق مرتّبة تنازلياً بالشدّة',
    HEAT_FLUX.structural.kw > HEAT_FLUX.ignition.kw
    && HEAT_FLUX.ignition.kw > HEAT_FLUX.escape.kw
    && HEAT_FLUX.escape.kw > HEAT_FLUX.safe.kw);

ok('حمولة الوقود أقوى من حمولة المركبة', FIRE_LOAD.fuel.mw > FIRE_LOAD.vehicle.mw);
ok('حريق وقود يُوسّع حلقة الإخلاء على حريق مبنى',
    heatRadius(FIRE_LOAD.fuel.mw, 4.7) > heatRadius(FIRE_LOAD.building.mw, 4.7));

// ── ٢) نطاق الحريق الميدانيّ ────────────────────────────────
head('٢) نطاق العزل الميدانيّ — ERG');

ok('العزل يتدرّج مع الحمولة',
    FIRE_ZONES.vehicle.isolate < FIRE_ZONES.shop.isolate
    && FIRE_ZONES.shop.isolate < FIRE_ZONES.building.isolate
    && FIRE_ZONES.building.isolate < FIRE_ZONES.fuel.isolate);

ok('مسافة الريح أبعد من العزل في كل حمولة',
    Object.values(FIRE_ZONES).every(z => z.downwind > z.isolate));

ok('نطاق العزل أوسع من حلقة الحرارة — فالدخان لا الحرارة هو ما يُخلي',
    FIRE_ZONES.building.isolate > heatRadius(FIRE_LOAD.building.mw, HEAT_FLUX.escape.kw));

ok('حمولة مجهولة تُعامَل كحريق مبنى', fireZoneOf('لا شيء') === FIRE_ZONES.building);
ok('حمولة الوقود تُعزل ٣٠٠ م', fireZoneOf('fuel').isolate === 300);

ok('حدّ WHO اليوميّ لـ PM2.5 خمسة عشر', AIR.pm25Daily.value === 15);
ok('العتبة الحادّة أعلى من اليومية', AIR.pm25Hourly.value > AIR.pm25Daily.value);
ok('انتشار العمود ثلاثون درجة', PLUME_SPREAD_DEG === 30);

// ── ٣) سعة الطرق ومستوى الخدمة ──────────────────────────────
head('٣) سعة الطرق ومستوى الخدمة — HCM');

ok('السعة تنزل مع نزول التصنيف',
    ROAD_CLASS.motorway.capacity > ROAD_CLASS.primary.capacity
    && ROAD_CLASS.primary.capacity > ROAD_CLASS.residential.capacity
    && ROAD_CLASS.residential.capacity > ROAD_CLASS.service.capacity);

ok('السرعة تنزل مع نزول التصنيف',
    ROAD_CLASS.motorway.speed > ROAD_CLASS.secondary.speed
    && ROAD_CLASS.secondary.speed > ROAD_CLASS.living_street.speed);

ok('الشريان الأوّلي ١٦٠٠ مركبة/ساعة للمسار', roadClassOf('primary').capacity === 1600);
ok('تصنيف غير معروف يُعامَل كغير مصنّف', roadClassOf('footway') === ROAD_CLASS.unclassified);
ok('تصنيف غائب لا يرمي', roadClassOf(undefined) === ROAD_CLASS.unclassified);

head('مستوى الخدمة');
ok('نسبة ٠٫٦٠ ⇒ A (الحدّ ضمن النطاق)', losOf(0.60).grade === 'A');
ok('نسبة ٠٫٦٠١ ⇒ B', losOf(0.601).grade === 'B');
ok('نسبة ٠٫٧٠ ⇒ B', losOf(0.70).grade === 'B');
ok('نسبة ٠٫٨٥ ⇒ D', losOf(0.85).grade === 'D');
ok('نسبة ١٫٠٠ ⇒ E', losOf(1.00).grade === 'E');
ok('نسبة ١٫٠١ ⇒ F', losOf(1.01).grade === 'F');
ok('نسبة هائلة ⇒ F لا خطأ', losOf(99).grade === 'F');
ok('نسبة سالبة تُقصّ إلى A', losOf(-1).grade === 'A');
ok('نسبة غائبة ⇒ A', losOf(undefined).grade === 'A');

ok('عتبات النطاقات تصاعدية',
    LOS_BANDS.every((b, i) => i === 0 || LOS_BANDS[i - 1].upto < b.upto));
ok('A–C معلومات و D–E تحذير و F عاجل',
    LOS_BANDS[0].tone === 'info' && LOS_BANDS[2].tone === 'info'
    && LOS_BANDS[3].tone === 'warn' && LOS_BANDS[4].tone === 'warn'
    && LOS_BANDS[5].tone === 'high');

// ── ٤) الطوابير ─────────────────────────────────────────────
head('٤) الطوابير المُحتّمة');

/* وارد 2900 وسعة 1600 ⇒ فائض 1300/ساعة
   في ١٥ دقيقة: 1300×15/60 = 325 مركبة
   على مسارين: 325×7/2 = 1137.5 م
   النموّ: (1300/60)×7/2 = 75.8333 م/دقيقة */
const q = queueLength(2900, 1600, 15, 2);
ok('٣٢٥ مركبة بعد ربع ساعة', near(q.vehicles, 325, 1e-9), String(q.vehicles));
ok('١١٣٧٫٥ متراً على مسارين', near(q.metres, 1137.5, 1e-9), String(q.metres));
ok('النموّ ٧٥٫٨٣ متراً كل دقيقة', near(q.perMinute, 1300 / 60 * 7 / 2, 1e-9), String(q.perMinute));
ok('الطابور نامٍ', q.growing === true);

ok('الطابور ينمو خطّياً بالزمن',
    near(queueLength(2900, 1600, 30, 2).metres, 2 * q.metres, 1e-9));
ok('مضاعفة المسارات تنصّف الطول',
    near(queueLength(2900, 1600, 15, 4).metres, q.metres / 2, 1e-9));

ok('وارد أقلّ من السعة ⇒ لا طابور',
    queueLength(1200, 1600, 15, 2).growing === false
    && queueLength(1200, 1600, 15, 2).metres === 0);
ok('وارد يساوي السعة ⇒ لا طابور', queueLength(1600, 1600, 15, 2).vehicles === 0);
ok('سعة صفر ⇒ كل الوارد يقف',
    near(queueLength(1200, 0, 60, 1).vehicles, 1200, 1e-9));
ok('سعة سالبة لا تُولّد فائضاً وهمياً',
    near(queueLength(1200, -500, 60, 1).vehicles, 1200, 1e-9));
ok('زمن سالب لا يُولّد طابوراً سالباً', queueLength(2900, 1600, -5, 2).vehicles === 0);

// ── ٥) الالتفاف وزمن الوصول ─────────────────────────────────
head('٥) الالتفاف وزمن السير');

/* 1000 م على طريق سرعته الحرّة 50 ⇒ الفعلية 35 كم/س
   (1/35)×60 = 1.714286 دقيقة */
ok('كيلومتر زائد على شريان ٥٠ ⇒ ١٫٧١ دقيقة',
    near(detourDelay(1000, 50), 60 / 35, 1e-9), String(detourDelay(1000, 50)));
ok('الالتفاف خطّيّ بالمسافة', near(detourDelay(2000, 50), 2 * detourDelay(1000, 50), 1e-9));
/* سرعة غائبة أو صفر بيانٌ ناقص لا سرعةٌ حقيقية، فتُؤخذ ٣٠ كم/س
   الافتراضية ⇒ الفعلية ٢١ ⇒ (1/21)×60 = 2.857143 دقيقة */
ok('سرعة صفر تُعامَل كبيانٍ غائب ⇒ ٣٠ كم/س الافتراضية',
    near(detourDelay(1000, 0), 60 / 21, 1e-9), String(detourDelay(1000, 0)));
ok('سرعة غائبة تُعطي ما تُعطيه سرعة صفر',
    near(detourDelay(1000, undefined), detourDelay(1000, 0), 1e-12));
ok('سرعة زاحفة تُقصّ عند خمسة لا تهوي بالزمن',
    near(detourDelay(1000, 1), 12, 1e-9), String(detourDelay(1000, 1)));
ok('لا مسافة زائدة ⇒ لا تأخير', detourDelay(0, 50) === 0);

/* 4000 م هوائية × 1.3 = 5200 م على 40 كم/س ⇒ 7.8 دقيقة */
ok('٤ كم هوائية على ٤٠ كم/س ⇒ ٧٫٨ دقيقة',
    near(travelMinutes(4000, 40), 7.8, 1e-9), String(travelMinutes(4000, 40)));
ok('معامل الالتفاف يزيد الزمن على المستقيم',
    travelMinutes(4000, 40, 1.3) > travelMinutes(4000, 40, 1.0));
ok('تنصيف السرعة يُضاعف الزمن',
    near(travelMinutes(4000, 20), 2 * travelMinutes(4000, 40), 1e-9));

head('حكم NFPA 1710');
ok('حدّ أوّل مركبة ٢٤٠ ثانية', RESPONSE.first.seconds === 240);
ok('حدّ الطاقم الكامل ٤٨٠ ثانية', RESPONSE.full.seconds === 480);
ok('أربع دقائق بالضبط ⇒ ضمن الحدّ', responseVerdict(4).ok === true);
ok('٤٫١ دقيقة ⇒ تجاوز أوّل مركبة',
    responseVerdict(4.1).ok === false && responseVerdict(4.1).tone === 'warn');
ok('ثماني دقائق بالضبط ⇒ ما زال دون حدّ الطاقم', responseVerdict(8).tone === 'warn');
ok('٨٫١ دقيقة ⇒ تجاوز الطاقم الكامل', responseVerdict(8.1).tone === 'high');
ok('كل حكم يذكر معياره', [1, 5, 9].every(m => typeof responseVerdict(m).standard === 'string'));

// ── ٦) الإخلاء ──────────────────────────────────────────────
head('٦) الإخلاء — NFPA 101 / SFPE');

ok('سرعة المشي ١٫٢ م/ث', EGRESS.walkSpeed === 1.2);
ok('تدفّق المنفذ ١٫٣ شخص/م·ث', EGRESS.flowPerMetreSecond === 1.3);

/* مشي 100/1.2 = 83.3333 ث ، تدفّق 200/(1.3×12) = 12.8205 ث
   المجموع (83.3333+12.8205)/60 = 1.602564 دقيقة ، والعنق المسافة */
const ev = evacuationMinutes(100, 200, 12);
ok('مشي ٨٣٫٣٣ ثانية', near(ev.walkSeconds, 100 / 1.2, 1e-9));
ok('تدفّق ١٢٫٨٢ ثانية', near(ev.flowSeconds, 200 / 15.6, 1e-9));
ok('المجموع ١٫٦٠ دقيقة', near(ev.totalMinutes, (100 / 1.2 + 200 / 15.6) / 60, 1e-9));
ok('العنق هو المسافة حين الناس قليل', ev.bottleneck === 'المسافة');

ok('العنق ينتقل إلى المنافذ حين يكثر الناس',
    evacuationMinutes(100, 5000, 12).bottleneck === 'المنافذ');
ok('توسيع المنافذ يُقصّر زمن التدفّق',
    evacuationMinutes(100, 5000, 24).flowSeconds < evacuationMinutes(100, 5000, 12).flowSeconds);
ok('بلا منافذ لا يُحسب تدفّق وهميّ', evacuationMinutes(100, 500, 0).flowSeconds === 0);
ok('زمن الإخلاء يطول بطول النطاق',
    evacuationMinutes(300, 200, 12).totalMinutes > ev.totalMinutes);

// ── ٧) الوصول مشياً ─────────────────────────────────────────
head('٧) الوصول — UN-Habitat');

ok('٥٠٠ م ضمن الحدّ المريح', walkVerdict(500) === WALK_BANDS[0]);
ok('٥٠١ م تتجاوزه إلى المقبول', walkVerdict(501) === WALK_BANDS[1]);
ok('١٠٠٠ م آخر المقبول', walkVerdict(1000) === WALK_BANDS[1]);
ok('١٥٠٠ م تحذير', walkVerdict(1500).tone === 'warn');
ok('٥٠٠٠ م خارج النطاق المعقول', walkVerdict(5000).tone === 'high');
ok('نطاقات المشي تصاعدية',
    WALK_BANDS.every((b, i) => i === 0 || WALK_BANDS[i - 1].upto < b.upto));

// ── ٨) انقطاع التيّار ───────────────────────────────────────
head('٨) انقطاع التيّار');

ok('اللقاح أقصر حدّاً من الثلاجة ومن المجمّد',
    OUTAGE.vaccine.hours < OUTAGE.fridge.hours
    && OUTAGE.fridge.hours < OUTAGE.freezer.hours);
ok('حدّ اللقاح ساعتان', OUTAGE.vaccine.hours === 2);
ok('حدّ الثلاجة أربع ساعات', OUTAGE.fridge.hours === 4);
ok('كل عتبة تذكر مصدرها', Object.values(OUTAGE).every(o => typeof o.say === 'string' && o.say.length));
ok('فقد السعة عند تعطّل الإشارة نصف',
    SIGNAL_FAILURE_CAPACITY_LOSS === 0.5
    && SIGNAL_FAILURE_CAPACITY_LOSS > 0 && SIGNAL_FAILURE_CAPACITY_LOSS < 1);

// ── ٩) الزمن من اليوم ───────────────────────────────────────
head('٩) الزمن من اليوم');

ok('أربع وعشرون ساعة', HOUR_SHARE.length === 24);
ok('مجموع الأنصبة واحد صحيح',
    near(HOUR_SHARE.reduce((a, b) => a + b, 0), 1, 1e-12),
    String(HOUR_SHARE.reduce((a, b) => a + b, 0)));
ok('لا نصيب سالب ولا صفر', HOUR_SHARE.every(h => h > 0));

/* ساعات الذروة المعلنة هي فعلاً الأربع الأعلى في المنحنى —
   لا تُكتب يدويّاً مخالفةً للأرقام */
const topFour = HOUR_SHARE
    .map((share, hour) => ({ share, hour }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 4)
    .map(x => x.hour)
    .sort((a, b) => a - b);
ok('الذروة المعلنة = الأربع الأعلى حسابياً',
    JSON.stringify(topFour) === JSON.stringify([...PEAK_HOURS].sort((a, b) => a - b)),
    JSON.stringify(topFour));

ok('الثامنة أعلى من الثالثة فجراً بأضعاف',
    HOUR_SHARE[8] / HOUR_SHARE[3] > 20);

/* 10000 مركبة يومياً × نصيب الثامنة 0.095 = 950 */
ok('١٠٠٠٠ يومياً ⇒ ٩٥٠ في الثامنة',
    near(hourlyFlow(10000, 8), 950, 1e-9), String(hourlyFlow(10000, 8)));
ok('الثالثة فجراً تحمل جزءاً يسيراً', hourlyFlow(10000, 3) < 50);
ok('الساعة ٢٥ تلتفّ إلى الواحدة', hourlyFlow(10000, 25) === hourlyFlow(10000, 1));
ok('الساعة −١ تلتفّ إلى ٢٣', hourlyFlow(10000, -1) === hourlyFlow(10000, 23));
ok('بلا حركة يومية ⇒ صفر', hourlyFlow(0, 8) === 0 && hourlyFlow(undefined, 8) === 0);

head('الامتلاء حسب الساعة');
ok('المدرسة العاشرة صباحاً ممتلئة', occupancyOf('مدرسة', 10).share > 0.9);
ok('المدرسة العاشرة مفتوحة', occupancyOf('مدرسة', 10).open === true);
ok('المدرسة العاشرة ليلاً خاوية',
    occupancyOf('مدرسة', 22).share <= 0.03 && occupancyOf('مدرسة', 22).open === false);
ok('المدرسة الثالثة بعد الظهر خاوية — انتهى الدوام',
    occupancyOf('مدرسة', 15).open === false);
ok('المستشفى الثالثة فجراً ما زال عامراً',
    occupancyOf('مستشفى', 3).share > 0.7 && occupancyOf('مستشفى', 3).open === true);
ok('المستشفى ليلاً أعمر من المدرسة ليلاً',
    occupancyOf('مستشفى', 3).share > occupancyOf('مدرسة', 3).share * 10);
ok('البنك الواحدة ظهراً عامر والسادسة مساءً مغلق',
    occupancyOf('بنك', 13).open === true && occupancyOf('بنك', 18).open === false);
ok('المطعم الثامنة مساءً عامر', occupancyOf('Restaurant', 20).open === true);
ok('المطعم الثامنة صباحاً مغلق', occupancyOf('Restaurant', 8).open === false);
ok('صنف مجهول يُعامَل بدوام نهاريّ',
    occupancyOf('لا صنف', 12).open === true && occupancyOf('لا صنف', 4).open === false);
ok('وسط الدوام أعمر من طرفه',
    occupancyOf('مدرسة', 10).share > occupancyOf('مدرسة', 7).share);
ok('طرف الدوام لا ينزل إلى الصفر — أرضيّة الربع',
    occupancyOf('مدرسة', 7).share >= 0.25);
ok('النصيب لا يتجاوز الواحد أبداً',
    Object.keys(OCCUPANCY).every(cat =>
        Array.from({ length: 24 }, (_, h) => occupancyOf(cat, h).share)
            .every(s => s >= 0 && s <= 1)));
ok('ساعة خارج النطاق تلتفّ',
    occupancyOf('مدرسة', 34).share === occupancyOf('مدرسة', 10).share);

head('وصف الساعة');
ok('الثامنة صباحاً ذروة', hourLabel(8).peak === true && hourLabel(8).text.includes('صباحاً'));
ok('الواحدة ظهراً ذروة', hourLabel(13).peak === true && hourLabel(13).text.startsWith('1:00'));
ok('منتصف الليل ١٢ ليلاً', hourLabel(0).text === '12:00 ليلاً');
ok('الظهر ١٢ ظهراً', hourLabel(12).text === '12:00 ظهراً');
ok('العاشرة مساءً تُقال ليلاً', hourLabel(22).text === '10:00 ليلاً');
ok('السادسة مساءً ليست ذروة', hourLabel(18).peak === false);
ok('الوصف يحمل نصيب الساعة', near(hourLabel(8).share, HOUR_SHARE[8], 1e-12));

console.log(`\n${p} نجحت · ${f} سقطت`);
process.exit(f ? 1 : 0);
