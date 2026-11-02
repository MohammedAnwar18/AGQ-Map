/* ============================================================
   فيزياء الأحداث — النماذج والمعايير

   لا آراء هنا ولا تخمين: كل رقم يخرج من نموذج منشور أو عتبة في
   معيار عالميّ، ومعه مرجعه مكتوباً كي يُراجَع.

   والأحداث تختلف في طبيعتها لا في شدّتها فقط: الحريق يُؤذي
   بالإشعاع الحراري فمداه يُحسب من قدرته، وحادث السير يُؤذي بفقد
   سعة الطريق فمداه طابور ينمو بالزمن، وانقطاع الكهرباء يُؤذي
   بتعطيل أجهزة فمداه شبكة التغذية. فلكلٍّ نموذجه.

   المراجع المستعملة:

     HCM 6th Edition        سعة الطرق ومستوى الخدمة (LOS)
     NFPA 1710              زمن وصول أوّل مركبة إطفاء/إسعاف
     SFPE Handbook          الإشعاع الحراري من حريق بركة
     NFPA 101 / SFPE        تدفّق الإخلاء وسرعة المشي
     WHO / UN-Habitat       مسافة الوصول إلى الخدمات الأساسية
     FDA Food Code          سلامة التبريد عند انقطاع التيّار
     WHO EVM                سلسلة التبريد للّقاحات
   ============================================================ */

/* ============================================================
   ١) الإشعاع الحراري — حرائق
   ============================================================ */

/*
 * عتبات التدفّق الحراريّ بالكيلوواط للمتر المربّع.
 *
 * من ‎SFPE Handbook‎ وملحق ‎NFPA 59A‎. وهي عتبات أثرٍ على الإنسان
 * والمنشأة، لا أرقاماً اصطلاحية: عندها يقع فعلٌ محدّد.
 */
export const HEAT_FLUX = {
    structural: { kw: 37.5, say: 'تلف إنشائي واشتعال المنشآت', tone: 'high' },
    ignition: { kw: 12.5, say: 'اشتعال الخشب بمصدر، وحروق خلال ثوانٍ', tone: 'high' },
    escape: { kw: 4.7, say: 'ألمٌ خلال ١٥–٢٠ ثانية — حدّ الإخلاء الآمن', tone: 'warn' },
    safe: { kw: 1.6, say: 'بلا أذى لتعرّض طويل', tone: 'info' }
};

/*
 * قدرة الحريق بالميغاواط حسب ما يحترق.
 *
 * من جداول ‎SFPE‎ لمعدّل إطلاق الحرارة. ومساحة الحريق هي ما يُحدّد
 * القدرة: متر مربّع من وقود سائل يُطلق نحو ‎2.5 MW‎، ومن أثاث نحو
 * ‎0.5 MW‎.
 */
export const FIRE_LOAD = {
    vehicle: { mw: 5, say: 'مركبة واحدة' },
    shop: { mw: 12, say: 'محلّ تجاري' },
    building: { mw: 30, say: 'مبنى' },
    fuel: { mw: 80, say: 'محطّة وقود' }
};

/**
 * نصف قطر عتبة حرارية — نموذج المصدر النقطي.
 *
 *     q" = χ·Q / (4π·r²)   ⇒   r = √( χ·Q / (4π·q") )
 *
 * حيث ‎Q‎ القدرة الكلّية و‎χ‎ نصيب الإشعاع منها — ويُؤخذ ‎0.3‎ لحرائق
 * الوقود المفتوحة في ‎SFPE‎.
 *
 * ونموذج المصدر النقطي يُبالغ قريباً من اللهب ويصدق بعيداً عنه،
 * وهو المستعمل في الفحص الأوّليّ لمسافات الفصل — وهذا موضعه هنا.
 */
export const heatRadius = (megawatts, fluxKw, radiative = 0.3) => {
    const Q = Math.max(0, megawatts) * 1000;          // كيلوواط
    const q = Math.max(0.01, fluxKw);

    return Math.sqrt((radiative * Q) / (4 * Math.PI * q));
};

/** حلقات العتبات كلّها لحريق بقدرة معيّنة */
export const heatRings = (megawatts) => Object.entries(HEAT_FLUX)
    .map(([key, def]) => ({
        key,
        ...def,
        radius: heatRadius(megawatts, def.kw)
    }))
    .sort((a, b) => a.radius - b.radius);

/* ============================================================
   ٢) سعة الطرق ومستوى الخدمة — HCM
   ============================================================ */

/*
 * سعة المسار الواحد بالمركبة/ساعة، وسرعته الحرّة بالكم/ساعة.
 *
 * قيَم ‎HCM 6th Edition‎ للطرق الحضرية، مُسنَدة إلى تصنيف ‎OSM‎.
 * والسعة تنخفض كلّما نزل التصنيف: الطريق المحلّي فيه تقاطعات
 * ووقوف ومشاة.
 */
export const ROAD_CLASS = {
    motorway: { capacity: 2000, speed: 100, say: 'طريق سريع' },
    trunk: { capacity: 1800, speed: 80, say: 'طريق رئيسي' },
    primary: { capacity: 1600, speed: 60, say: 'شريان أوّلي' },
    secondary: { capacity: 1400, speed: 50, say: 'شريان ثانوي' },
    tertiary: { capacity: 1100, speed: 40, say: 'طريق فرعي' },
    residential: { capacity: 700, speed: 30, say: 'شارع سكني' },
    service: { capacity: 400, speed: 20, say: 'ممرّ خدمة' },
    unclassified: { capacity: 700, speed: 30, say: 'غير مصنّف' },
    living_street: { capacity: 300, speed: 15, say: 'شارع معيشة' }
};

export const roadClassOf = (highway) => ROAD_CLASS[highway] || ROAD_CLASS.unclassified;

/*
 * مستوى الخدمة من نسبة الحجم إلى السعة — ‎HCM‎.
 *
 * ‎A‎ انسياب حرّ، و‎F‎ انهيار وطوابير. والعتبات هي المنشورة في
 * الدليل للطرق الحضرية.
 */
export const LOS_BANDS = [
    { grade: 'A', upto: 0.60, say: 'انسياب حرّ', tone: 'info' },
    { grade: 'B', upto: 0.70, say: 'انسياب مستقرّ', tone: 'info' },
    { grade: 'C', upto: 0.80, say: 'مستقرّ مع تأثّر بالازدحام', tone: 'info' },
    { grade: 'D', upto: 0.90, say: 'يقترب من عدم الاستقرار', tone: 'warn' },
    { grade: 'E', upto: 1.00, say: 'عند السعة — أي خلل يُسبّب توقّفاً', tone: 'warn' },
    { grade: 'F', upto: Infinity, say: 'انهيار وطوابير متنامية', tone: 'high' }
];

export const losOf = (vOverC) => {
    const ratio = Math.max(0, vOverC || 0);
    return LOS_BANDS.find(b => ratio <= b.upto) || LOS_BANDS[LOS_BANDS.length - 1];
};

/**
 * طول الطابور حين يتجاوز الوارد المنصرف.
 *
 * نظرية الطوابير المُحتّمة: الطابور ينمو بفارق التدفّق في الزمن،
 * وطوله بالأمتار = عدد المركبات × المسافة بين المركبات.
 *
 *     N = (q_in − q_out) × t
 *     L = N × spacing ÷ lanes
 *
 * وسبعة أمتار للمركبة الواقفة قيمة ‎HCM‎ المعتادة (طول مركبة +
 * خلوص).
 */
export const queueLength = (arrivalPerHour, capacityPerHour, minutes, lanes = 1, spacingM = 7) => {
    const excess = Math.max(0, arrivalPerHour - Math.max(0, capacityPerHour));
    if (excess <= 0) return { vehicles: 0, metres: 0, growing: false };

    const vehicles = (excess * Math.max(0, minutes)) / 60;

    return {
        vehicles,
        metres: (vehicles * spacingM) / Math.max(1, lanes),
        growing: true,
        perMinute: (excess / 60) * spacingM / Math.max(1, lanes)
    };
};

/**
 * زمن التأخير الإضافي من الالتفاف.
 *
 *     t = المسافة الزائدة ÷ السرعة الفعلية
 *
 * والسرعة الفعلية أقلّ من الحرّة لأنّ البديل يستقبل تحويلاً: نأخذ
 * ‎70٪‎ منها، وهو ما يوافق مستوى خدمة ‎D‎ تقريباً.
 */
export const detourDelay = (extraMetres, freeSpeedKmh) => {
    const speed = Math.max(5, (freeSpeedKmh || 30) * 0.7);
    return (extraMetres / 1000 / speed) * 60;      // دقائق
};

/* ============================================================
   ٣) زمن الاستجابة — NFPA 1710
   ============================================================ */

/*
 * عتبات ‎NFPA 1710‎ لزمن السير (لا يشمل زمن التجهيز).
 *
 *   ٢٤٠ ثانية  أوّل مركبة إطفاء، وأوّل وحدة إسعاف أساسية
 *   ٤٨٠ ثانية  اكتمال الطاقم للإنذار الأوّل، والإسعاف المتقدّم
 */
export const RESPONSE = {
    first: { seconds: 240, say: 'أوّل مركبة — حدّ NFPA 1710' },
    full: { seconds: 480, say: 'اكتمال الطاقم — حدّ NFPA 1710' }
};

/**
 * زمن السير بين موضعين على شبكة طرق.
 *
 * المسافة الهوائية لا تكفي: الطرق تلتفّ. ومعامل الالتفاف الحضريّ
 * المعتاد ‎1.3‎ — أي أنّ مسار الطريق أطول من المستقيم بثلاثين
 * بالمئة. وهو ما تستعمله دراسات الوصول حين لا تتوفّر شبكة كاملة.
 */
export const travelMinutes = (straightM, speedKmh = 40, detourFactor = 1.3) => {
    const road = straightM * detourFactor;
    return (road / 1000 / Math.max(5, speedKmh)) * 60;
};

export const responseVerdict = (minutes) => {
    const seconds = minutes * 60;

    if (seconds <= RESPONSE.first.seconds) {
        return { ok: true, grade: 'ضمن الحدّ', tone: 'info', standard: RESPONSE.first.say };
    }
    if (seconds <= RESPONSE.full.seconds) {
        return { ok: false, grade: 'يتجاوز حدّ أوّل مركبة', tone: 'warn', standard: RESPONSE.full.say };
    }
    return { ok: false, grade: 'يتجاوز حدّ الطاقم الكامل', tone: 'high', standard: RESPONSE.full.say };
};

/* ============================================================
   ٤) الإخلاء — NFPA 101 / SFPE
   ============================================================ */

/*
 * ثوابت الإخلاء من ‎SFPE Handbook‎ و‎NFPA 101‎:
 *
 *   سرعة المشي غير المعاقة   ‎1.2 م/ث‎
 *   تدفّق المخرج             ‎1.3 شخص/متر-ثانية‎
 */
export const EGRESS = { walkSpeed: 1.2, flowPerMetreSecond: 1.3 };

/** زمن إخلاء منطقة: المشي إلى الحافّة ثمّ المرور من المنافذ */
export const evacuationMinutes = (radiusM, people, exitWidthM) => {
    const walk = radiusM / EGRESS.walkSpeed;
    const flow = exitWidthM > 0
        ? people / (EGRESS.flowPerMetreSecond * exitWidthM)
        : 0;

    return {
        walkSeconds: walk,
        flowSeconds: flow,
        totalMinutes: (walk + flow) / 60,
        bottleneck: flow > walk ? 'المنافذ' : 'المسافة'
    };
};

/* ============================================================
   ٥) الوصول إلى الخدمات — WHO / UN-Habitat
   ============================================================ */

/*
 * عتبات المشي إلى الخدمات الأساسية.
 *
 * ‎UN-Habitat‎ ومبدأ «مدينة الربع ساعة»: ‎500‎ م مشياً (نحو ٧ دقائق)
 * حدٌّ مريح، و‎1000‎ م (١٥ دقيقة) حدٌّ مقبول، وما فوقه يُعدّ حرماناً.
 */
export const WALK_BANDS = [
    { upto: 500, say: 'ضمن مسافة مشي مريحة', tone: 'info' },
    { upto: 1000, say: 'مسافة مشي مقبولة — نحو ١٥ دقيقة', tone: 'info' },
    { upto: 2000, say: 'بعيد مشياً — يحتاج مركبة', tone: 'warn' },
    { upto: Infinity, say: 'خارج نطاق الوصول المعقول', tone: 'high' }
];

export const walkVerdict = (metres) =>
    WALK_BANDS.find(b => metres <= b.upto) || WALK_BANDS[WALK_BANDS.length - 1];

/* ============================================================
   ٦) انقطاع التيّار
   ============================================================ */

/*
 * عتبات زمنية عند انقطاع الكهرباء:
 *
 *   ‎FDA Food Code‎   الثلاجة تحفظ الطعام ٤ ساعات مغلقة، والمجمّد ٤٨
 *   ‎WHO EVM‎          اللقاحات ‎2–8‎ °م، وتجاوزها يُفسد الدفعة
 *   إشارات المرور     تتعطّل فيصير التقاطع غير محكوم
 */
export const OUTAGE = {
    fridge: { hours: 4, say: 'حدّ سلامة التبريد — FDA Food Code' },
    freezer: { hours: 48, say: 'حدّ المجمّد الممتلئ المغلق' },
    vaccine: { hours: 2, say: 'سلسلة تبريد اللقاحات — WHO EVM' }
};

/*
 * التقاطع المُشار غير المحكوم يفقد نحو نصف سعته.
 *
 * دراسات أعطال الإشارات تُقدّر الفقد بين ‎40٪‎ و‎60٪‎ حسب التوزيع
 * بين المداخل، ونأخذ الوسط.
 */
export const SIGNAL_FAILURE_CAPACITY_LOSS = 0.5;

/* ============================================================
   ٧) الزمن من اليوم
   ============================================================ */

/*
 * نصيب كل ساعة من حركة اليوم.
 *
 * منحنىً حضريّ نموذجي بذروتين: صباحية عند الثامنة ومسائية عند
 * الثانية والرابعة — وهو نمط المدن ذات دوام صباحيّ ينتهي ظهراً.
 * والمجموع واحد صحيح.
 */
export const HOUR_SHARE = [
    0.005, 0.003, 0.002, 0.002, 0.005, 0.013, 0.036, 0.074,
    0.095, 0.070, 0.054, 0.052, 0.060, 0.083, 0.078, 0.064,
    0.057, 0.060, 0.057, 0.047, 0.036, 0.025, 0.014, 0.008
];

export const PEAK_HOURS = [7, 8, 13, 14];

/** حركة الساعة بالمركبات من حركة اليوم الكلّية */
export const hourlyFlow = (dailyTotal, hour) => {
    const at = ((Math.round(hour) % 24) + 24) % 24;
    return (dailyTotal || 0) * HOUR_SHARE[at];
};

/*
 * من يكون في المكان في هذه الساعة.
 *
 * ليس الناس في كل ساعة سواءً: المدارس تمتلئ صباحاً وتخلو ظهراً،
 * والمحلّات تعمل نهاراً، والمستشفى لا ينام. وهذا ما يجعل أثر
 * الحدث يختلف باختلاف ساعته — وهو مطلوب صريح في التحليل.
 */
export const OCCUPANCY = {
    'مدرسة': { from: 7, to: 14, peak: 1, off: 0.03, say: 'دوام مدرسيّ صباحيّ' },
    'University': { from: 8, to: 17, peak: 1, off: 0.05, say: 'دوام جامعيّ' },
    'مستشفى': { from: 0, to: 24, peak: 1, off: 0.75, say: 'يعمل على مدار الساعة' },
    'مركز طبي': { from: 8, to: 20, peak: 1, off: 0.1, say: 'دوام نهاريّ ممتدّ' },
    'صيدلية': { from: 8, to: 22, peak: 1, off: 0.08, say: 'دوام نهاريّ ممتدّ' },
    'بنك': { from: 8, to: 15, peak: 1, off: 0.02, say: 'دوام مصرفيّ صباحيّ' },
    'بلدية': { from: 8, to: 15, peak: 1, off: 0.02, say: 'دوام رسميّ' },
    'وزارة': { from: 8, to: 15, peak: 1, off: 0.02, say: 'دوام رسميّ' },
    'Restaurant': { from: 11, to: 23, peak: 1, off: 0.05, say: 'ذروة الغداء والعشاء' },
    'Cafe': { from: 8, to: 23, peak: 1, off: 0.05, say: 'نهاراً ومساءً' },
    'Supermarket': { from: 8, to: 22, peak: 1, off: 0.05, say: 'دوام تجاريّ' },
    'مركز تسوق': { from: 10, to: 22, peak: 1, off: 0.04, say: 'دوام تجاريّ مسائيّ' },
    'محطة وقود': { from: 5, to: 24, peak: 1, off: 0.25, say: 'تعمل معظم اليوم' },
    'مسجد': { from: 4, to: 21, peak: 1, off: 0.1, say: 'أوقات الصلاة' }
};

const DEFAULT_OCCUPANCY = { from: 8, to: 20, peak: 1, off: 0.06, say: 'دوام نهاريّ' };

export const occupancyOf = (category, hour) => {
    const def = OCCUPANCY[category] || DEFAULT_OCCUPANCY;
    const at = ((Math.round(hour) % 24) + 24) % 24;

    const open = def.from <= def.to
        ? at >= def.from && at < def.to
        : at >= def.from || at < def.to;

    if (!open) return { share: def.off, open: false, say: def.say };

    /*
     * داخل الدوام: الامتلاء أعلى في وسطه وأقلّ عند طرفيه. جيبٌ
     * نصف موجة عبر ساعات الدوام — فالمدرسة الساعة العاشرة أكثر
     * امتلاءً منها السابعة أو الواحدة.
     */
    const span = (def.to - def.from + 24) % 24 || 24;
    const into = (at - def.from + 24) % 24;
    const curve = Math.sin((into / span) * Math.PI);

    return {
        share: def.off + (def.peak - def.off) * Math.max(0.25, curve),
        open: true,
        say: def.say
    };
};

/** وصفٌ للساعة يُقرأ */
export const hourLabel = (hour) => {
    const at = ((Math.round(hour) % 24) + 24) % 24;
    const band = at < 6 ? 'ليلاً' : at < 12 ? 'صباحاً' : at < 17 ? 'ظهراً' : at < 21 ? 'مساءً' : 'ليلاً';
    const twelve = at % 12 === 0 ? 12 : at % 12;

    return {
        text: `${twelve}:00 ${band}`,
        peak: PEAK_HOURS.includes(at),
        share: HOUR_SHARE[at]
    };
};

/* ============================================================
   ٨) نطاق الحريق الميدانيّ — ERG / WHO
   ============================================================ */

/*
 * الإشعاع الحراريّ وحده لا يُعطي نطاق الحدث.
 *
 * نموذج المصدر النقطي يُعطي أمتاراً معدودة لأنّ الإشعاع يسقط
 * بمربّع المسافة — وهو صادق فيما يخصّ الحرارة. لكنّ الذي يُخلي
 * الأحياء هو الدخان، وهو يسير مع الريح مئات الأمتار.
 *
 * فلكلّ حريق نطاقان: نطاق حرارةٍ صغير محسوب، ونطاق عزلٍ ميدانيّ
 * من «دليل الاستجابة للطوارئ» ‎ERG 2024‎ — وهو المرجع الذي تعمل
 * به فرق الإطفاء فعلاً:
 *
 *   مسافة العزل الأوّلي     تُفرَّغ في كل اتجاه
 *   مسافة الإجراء الوقائي   مع الريح — إخلاء أو بقاء في الداخل
 */
export const FIRE_ZONES = {
    vehicle: { isolate: 30, downwind: 100, say: 'حريق مركبة' },
    shop: { isolate: 60, downwind: 300, say: 'حريق محلّ' },
    building: { isolate: 100, downwind: 500, say: 'حريق مبنى' },
    fuel: { isolate: 300, downwind: 800, say: 'حريق وقود — تصعيد' }
};

export const fireZoneOf = (load) => FIRE_ZONES[load] || FIRE_ZONES.building;

/*
 * جودة الهواء — ‎WHO Global Air Quality Guidelines 2021‎.
 *
 * الحدّ اليوميّ للجزيئات الدقيقة ‎PM2.5‎ هو ‎15‎ ميكروغرام/م³،
 * ودخان الحرائق يتجاوزه أضعافاً داخل الممرّ. وهذه العتبة هي ما
 * يُبرّر إخلاء الحسّاسين — المدارس والمستشفيات — من الممرّ.
 */
export const AIR = {
    pm25Daily: { value: 15, unit: 'ميكروغرام/م³', say: 'حدّ WHO اليوميّ لـ PM2.5' },
    pm25Hourly: { value: 75, unit: 'ميكروغرام/م³', say: 'عتبة تأثّر حادّ' }
};

/*
 * انتشار الدخان جانبيّاً.
 *
 * عمود الدخان يتمدّد بزاوية تقارب ‎30°‎ حول اتجاه الريح في الجوّ
 * المحايد (صنف ‎Pasquill D‎). فالممرّ قطاعٌ لا خطّ.
 */
export const PLUME_SPREAD_DEG = 30;
