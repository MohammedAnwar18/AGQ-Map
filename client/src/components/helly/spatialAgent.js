/* ============================================================
   الوكيل المكاني — محرّك التحليل

   وكيلٌ يقرأ حدثاً وموقعه، ويقرؤه على أرض الواقع كما هي على
   الخريطة: المحلّات والمرافق والمعالم بأصنافها، ثم يربط المتغيّرات
   ويُخرج تحليلاً مرتّباً وقراراً مُسبَّباً.

   ولا مفتاح ولا نموذج لغوي: كل رقم هنا محسوب من البيانات نفسها
   بإحصاء مكاني معروف. وهذا اختيار لا عجز —

     · يعمل بلا إنترنت وبلا حساب عند أحد، ولا يتوقّف بانتهاء حصّة
     · نتيجته واحدة لنفس المُدخل، فتُراجَع وتُراجَع عليها القرارات
     · ولا يخترع معلماً لا وجود له: ما لا يُقاس لا يُقال

   وما يُحسب هنا هو ما يُبنى عليه قرار، فيُختبَر وحده بالأرقام.
   ============================================================ */

/* نصف قطر الأرض المتوسّط بالأمتار — ‎WGS84‎ */
const EARTH = 6371008.8;

const toRad = (deg) => (deg * Math.PI) / 180;

/* ============================================================
   القياس
   ============================================================ */

/**
 * المسافة بين موضعين على سطح الأرض.
 *
 * ‎haversine‎ لا فيثاغورس على الدرجات: درجة الطول تضيق مع الاتجاه
 * شمالاً، وعند خطّ عرض فلسطين نحو ‎٣٢°‎ هي ‎٨٥٪‎ من درجة العرض. فحسابٌ
 * مستوٍ على الدرجات يُخطئ المسافة شرقاً بسُدسها.
 */
export const haversine = (a, b) => {
    if (!a || !b) return Infinity;

    const lat1 = toRad(+a.latitude);
    const lat2 = toRad(+b.latitude);
    const dLat = lat2 - lat1;
    const dLon = toRad(+b.longitude - +a.longitude);

    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** الاتّجاه البوصلي من موضع إلى آخر — يُستعمل في وصف الجهة */
export const bearing = (a, b) => {
    const lat1 = toRad(+a.latitude);
    const lat2 = toRad(+b.latitude);
    const dLon = toRad(+b.longitude - +a.longitude);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const COMPASS = ['شمالاً', 'شمالاً شرقاً', 'شرقاً', 'جنوباً شرقاً',
                 'جنوباً', 'جنوباً غرباً', 'غرباً', 'شمالاً غرباً'];

export const compassOf = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

/** مسافة مقروءة — لا «1847.3 متر» في تقرير يُقرأ */
export const readable = (metres) => {
    if (!Number.isFinite(metres)) return '—';
    if (metres < 950) return `${Math.round(metres / 10) * 10} م`;
    return `${(metres / 1000).toFixed(metres < 9500 ? 1 : 0)} كم`;
};

/* ============================================================
   المركزية والتشتّت
   ============================================================ */

/** المركز المتوسّط للمعالم — نقطة ثقل التوزيع */
export const meanCentre = (points) => {
    const live = (points || []).filter(p => Number.isFinite(+p?.latitude) && Number.isFinite(+p?.longitude));
    if (!live.length) return null;

    let lat = 0;
    let lon = 0;
    for (const p of live) { lat += +p.latitude; lon += +p.longitude; }

    return { latitude: lat / live.length, longitude: lon / live.length };
};

/**
 * المسافة المعيارية — انتشار التوزيع بالأمتار.
 *
 * نظيرُ الانحراف المعياري في بعدين: جذر متوسّط مربّعات المسافات عن
 * المركز. وهي الرقم الذي يقول «هذا الحيّ مركّز في ٤٠٠ م» أو
 * «مبثوث على ٣ كم».
 */
export const standardDistance = (points) => {
    const centre = meanCentre(points);
    if (!centre) return 0;

    const live = points.filter(p => Number.isFinite(+p?.latitude));
    if (live.length < 2) return 0;

    let sum = 0;
    for (const p of live) sum += haversine(centre, p) ** 2;

    return Math.sqrt(sum / live.length);
};

/**
 * دليل أقرب جار — هل التوزيع متجمّع أم عشوائي أم متباعد؟
 *
 *     R = متوسّط مسافة أقرب جار ÷ المتوقّع عشوائياً
 *     المتوقّع = 1 / (2·√(n/A))
 *
 * ‎R < 1‎ تجمّع، و‎R ≈ 1‎ عشوائية، و‎R > 1‎ تباعد منتظم. وهذا هو
 * الفرق بين «سوق» و«محلّات مبثوثة» — وهو حكمٌ يُقاس لا يُقال بالعين.
 */
export const nearestNeighbourIndex = (points, areaM2) => {
    const live = (points || []).filter(p => Number.isFinite(+p?.latitude));
    const n = live.length;

    if (n < 3 || !(areaM2 > 0)) return null;

    let total = 0;
    for (let i = 0; i < n; i++) {
        let best = Infinity;
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const d = haversine(live[i], live[j]);
            if (d < best) best = d;
        }
        if (Number.isFinite(best)) total += best;
    }

    const observed = total / n;
    const expected = 1 / (2 * Math.sqrt(n / areaM2));
    if (!(expected > 0)) return null;

    const ratio = observed / expected;

    return {
        observed,
        expected,
        ratio,
        verdict: ratio < 0.8 ? 'clustered' : ratio > 1.2 ? 'dispersed' : 'random'
    };
};

/* ============================================================
   التنوّع
   ============================================================ */

/**
 * دليل شانون للتنوّع الوظيفي.
 *
 *     H = −Σ pᵢ·ln(pᵢ)
 *
 * يقيس خلط الأصناف: صفرٌ يعني صنفاً واحداً، والأعلى يعني توازناً.
 * ونُعيد معه النسبة إلى الأقصى ‎ln(k)‎ كي يُقارَن بين منطقتين
 * مختلفتي عدد الأصناف.
 */
export const shannon = (counts) => {
    const values = Object.values(counts || {}).filter(n => n > 0);
    const total = values.reduce((a, b) => a + b, 0);

    if (!total || values.length < 1) return { h: 0, evenness: 0, kinds: 0 };

    let h = 0;
    for (const n of values) {
        const p = n / total;
        h -= p * Math.log(p);
    }

    const max = Math.log(values.length);
    return {
        h,
        evenness: max > 0 ? h / max : 0,
        kinds: values.length
    };
};

/** عدّ الأصناف — أساس كل مقياس تنوّع */
export const countBy = (items, key = 'category') => {
    const out = {};
    for (const item of items || []) {
        const k = String(item?.[key] || 'غير مصنّف').trim() || 'غير مصنّف';
        out[k] = (out[k] || 0) + 1;
    }
    return out;
};

/* ============================================================
   الوصول والفجوات
   ============================================================ */

/** أقرب معلم من مجموعة، ومسافته */
export const nearestOf = (from, items) => {
    let best = null;
    let bestD = Infinity;

    for (const item of items || []) {
        const d = haversine(from, item);
        if (d < bestD) { bestD = d; best = item; }
    }

    return best ? { item: best, distance: bestD } : null;
};

/**
 * شبكة تُغطّي حدوداً بخلايا بالأمتار.
 *
 * خطوة العرض ثابتة، وخطوة الطول تُقسَم على جيب تمام العرض: وإلّا
 * صارت الخلايا مستطيلات ضيّقة شمالاً وحُسبت الكثافة خطأً.
 */
export const gridOver = (bounds, cellM) => {
    const { south, north, west, east } = bounds || {};
    if (![south, north, west, east].every(Number.isFinite) || !(cellM > 0)) return [];
    if (north <= south || east <= west) return [];

    const latStep = (cellM / EARTH) * (180 / Math.PI);
    const midLat = (south + north) / 2;
    const lonStep = latStep / Math.max(0.1, Math.cos(toRad(midLat)));

    const cells = [];
    const rows = Math.min(400, Math.ceil((north - south) / latStep));
    const cols = Math.min(400, Math.ceil((east - west) / lonStep));

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            cells.push({
                latitude: south + (r + 0.5) * latStep,
                longitude: west + (c + 0.5) * lonStep,
                row: r,
                col: c
            });
        }
    }

    return cells;
};

/**
 * فجوات الخدمة — أين تنقص خدمةٌ بعينها.
 *
 * نمسح الشبكة ونقيس من كل خلية إلى أقرب مَرفِق. ما تجاوز الحدّ فهو
 * فجوة. وهذا ما يُجيب «أين يلزم صيدلية؟» بدل أن يُجاب بالظنّ.
 *
 * والخلايا الفارغة من السكّان لا تُستثنى — لا نملك بيانات سكّانية،
 * فيُقال صريحاً إنّ القياس جغرافيّ لا سكّانيّ.
 */
export const serviceGaps = (bounds, facilities, { cellM = 400, thresholdM = 1000 } = {}) => {
    const cells = gridOver(bounds, cellM);
    if (!cells.length) return { gaps: [], worst: null, covered: 0, total: 0 };

    const gaps = [];
    let covered = 0;
    let worst = null;

    for (const cell of cells) {
        const near = nearestOf(cell, facilities);
        const d = near ? near.distance : Infinity;

        if (d <= thresholdM) { covered += 1; continue; }

        const gap = { ...cell, distance: d, nearest: near?.item || null };
        gaps.push(gap);
        if (!worst || d > worst.distance) worst = gap;
    }

    return {
        gaps,
        worst,
        covered,
        total: cells.length,
        coverage: cells.length ? covered / cells.length : 0
    };
};

/**
 * بؤر الكثافة — أعلى الخلايا تركيزاً.
 *
 * عدٌّ داخل نصف قطر لا عدٌّ داخل الخلية: العدّ داخل الخلية يقسم
 * تجمّعاً واقعاً على حدّ خلّيتين فيُخفيه. ونصف القطر يجمعه.
 */
export const hotspots = (bounds, points, { cellM = 300, radiusM = 350, top = 5 } = {}) => {
    const cells = gridOver(bounds, cellM);
    if (!cells.length || !points?.length) return [];

    const scored = cells.map(cell => {
        let n = 0;
        for (const p of points) if (haversine(cell, p) <= radiusM) n += 1;
        return { ...cell, count: n };
    }).filter(cell => cell.count > 0);

    scored.sort((a, b) => b.count - a.count);

    /* البؤر المتجاورة تُدمج: خلايا متلاصقة حول نفس التجمّع ليست
       خمس بؤر بل واحدة */
    const picked = [];
    for (const cell of scored) {
        if (picked.length >= top) break;
        if (picked.some(got => haversine(got, cell) < radiusM)) continue;
        picked.push(cell);
    }

    return picked;
};

/* ============================================================
   أهمّية المعالم
   ============================================================ */

/*
 * وزن الحرج لكل صنف.
 *
 * ليس كل معلم سواءً في حدث: تعطيلُ مستشفى ليس كتعطيل محلّ ملابس.
 * والأوزان صريحة في جدول يُقرأ ويُعدَّل، لا مدفونة في شروط — فمن
 * يُراجع التحليل يستطيع أن يُراجع أساسه.
 */
export const CRITICALITY = {
    'مستشفى': 10,
    'مركز طبي': 9,
    'عيادة': 7,
    'صيدلية': 8,
    'محطة وقود': 7,
    'بلدية': 6,
    'وزارة': 6,
    'مدرسة': 7,
    'University': 7,
    'بنك': 5,
    'صراف آلي': 4,
    'Supermarket': 5,
    'مركز تسوق': 4,
    'مجمع تجاري': 4,
    'مسجد': 4,
    'كنيسة': 4,
    'Restaurant': 3,
    'Cafe': 2,
    'ملعب': 3,
    'حديقة': 2,
    'منتزه': 2,
    'دوار': 1
};

export const criticalityOf = (category) => CRITICALITY[category] ?? 2;

/* أصناف تُعدّ خدمةً حياتية — تُفحص فجواتها في كل حدث */
export const LIFELINE = ['مستشفى', 'مركز طبي', 'صيدلية', 'محطة وقود'];

/* ============================================================
   الحدث وأثره
   ============================================================ */

/*
 * أنماط الأحداث.
 *
 * لكل نمط نصف قطر افتراضي وما يُعنيه: حريقٌ يُخلي، وإغلاقُ شارع
 * يُحوّل المسار، وانقطاعُ كهرباء يُعطّل التبريد والصرّافات. والنمط
 * يُغيّر الترجيح لا النصّ وحده.
 */
export const EVENT_KINDS = {
    closure: {
        label: 'إغلاق طريق',
        radius: 500,
        weigh: (cat) => (cat === 'محطة وقود' || cat === 'مستشفى' ? 1.4 : 1),
        asks: ['البدائل المروريّة', 'وصول الإسعاف', 'المحلّات المعزولة']
    },
    fire: {
        label: 'حريق',
        radius: 300,
        weigh: (cat) => (cat === 'محطة وقود' ? 3 : cat === 'مستشفى' || cat === 'مدرسة' ? 2 : 1),
        asks: ['مصادر الاشتعال القريبة', 'الإخلاء', 'أقرب رعاية طبية']
    },
    power: {
        label: 'انقطاع كهرباء',
        radius: 900,
        weigh: (cat) => (cat === 'مستشفى' ? 2.5 : cat === 'Supermarket' ? 1.6 : cat === 'صراف آلي' ? 1.5 : 1),
        asks: ['التبريد والمخزون', 'الأجهزة الطبية', 'الصرّافات']
    },
    crowd: {
        label: 'تجمّع كثيف',
        radius: 400,
        weigh: (cat) => (cat === 'مسجد' || cat === 'ملعب' || cat === 'مركز تسوق' ? 1.6 : 1),
        asks: ['منافذ الخروج', 'الطاقة الاستيعابية', 'الرعاية الطبية القريبة']
    },
    water: {
        label: 'انقطاع مياه',
        radius: 1200,
        weigh: (cat) => (cat === 'مستشفى' ? 2.2 : cat === 'Restaurant' || cat === 'Cafe' ? 1.5 : 1),
        asks: ['المرافق الحسّاسة', 'بدائل التزويد']
    },
    medical: {
        label: 'طارئ طبّي',
        radius: 1500,
        weigh: (cat) => (cat === 'مستشفى' ? 3 : cat === 'مركز طبي' ? 2.4 : cat === 'صيدلية' ? 1.8 : 0.4),
        asks: ['أقرب رعاية', 'زمن الوصول', 'الصيدليات المفتوحة']
    }
};

/**
 * ما يتأثّر بالحدث، مرتّباً بالأثر لا بالمسافة.
 *
 *     الأثر = الحرج × وزن النمط × تضاؤل المسافة
 *
 * والتضاؤل خطّيّ من المركز إلى الحافّة: معلمٌ على الحافّة يتأثّر
 * قليلاً لا كما في المركز. وترتيبُ النتائج بالمسافة وحدها يضع
 * مقهىً ملاصقاً فوق مستشفى على بُعد مئتي متر — وهو ترتيبٌ لا يُفيد
 * من يتّخذ قراراً.
 */
export const impactOf = (event, landmarks) => {
    const kind = EVENT_KINDS[event?.kind] || EVENT_KINDS.closure;
    const radius = Number.isFinite(+event?.radius) ? +event.radius : kind.radius;

    const inside = [];

    for (const item of landmarks || []) {
        const d = haversine(event, item);
        if (!Number.isFinite(d) || d > radius) continue;

        const base = criticalityOf(item.category);
        const fade = 1 - (d / radius) * 0.65;      // الحافّة تبقى ٣٥٪
        const score = base * kind.weigh(item.category) * fade;

        inside.push({
            ...item,
            distance: d,
            bearing: bearing(event, item),
            criticality: base,
            impact: score
        });
    }

    inside.sort((a, b) => b.impact - a.impact);

    return { kind, radius, affected: inside };
};

/* ============================================================
   القرار
   ============================================================ */

/**
 * يبني قراراً مُسبَّباً من الأرقام.
 *
 * كل توصية تحمل سببها ودرجتها، ولا توصية بلا رقم تحتها: التوصية
 * بلا سبب رأيٌ، ومع السبب قرارٌ يُراجَع.
 */
export const decide = (event, landmarks, bounds) => {
    const { kind, radius, affected } = impactOf(event, landmarks);

    const moves = [];
    const push = (level, title, why, data) => moves.push({ level, title, why, data });

    // ── ١) الخدمات الحياتية داخل النطاق ──
    const lifelinesHit = affected.filter(a => LIFELINE.includes(a.category));
    if (lifelinesHit.length) {
        push('high',
            `${lifelinesHit.length} خدمة حياتية داخل النطاق`,
            `أعلاها ${lifelinesHit[0].name} على ${readable(lifelinesHit[0].distance)} ${compassOf(lifelinesHit[0].bearing)}`,
            lifelinesHit.slice(0, 6));
    }

    // ── ٢) أقرب رعاية طبية خارج النطاق — البديل ──
    const care = (landmarks || []).filter(l => ['مستشفى', 'مركز طبي'].includes(l.category));
    const nearCare = nearestOf(event, care);

    if (nearCare) {
        const outside = nearCare.distance > radius;
        push(outside ? 'info' : 'high',
            `أقرب رعاية: ${nearCare.item.name}`,
            `${readable(nearCare.distance)} ${compassOf(bearing(event, nearCare.item))}`
            + (outside ? ' — خارج النطاق فتصلح مقصداً' : ' — داخل النطاق فقد تتأثّر هي نفسها'),
            [nearCare.item]);
    } else if (care.length === 0) {
        push('warn', 'لا رعاية طبية في البيانات',
            'لا مستشفى ولا مركز طبي مسجّل على الخريطة — التوصية الطبية غير ممكنة من هذه البيانات', []);
    }

    // ── ٣) الخطر المضاعِف: وقود قريب ──
    const fuel = affected.filter(a => a.category === 'محطة وقود');
    if (fuel.length && (event.kind === 'fire' || event.kind === 'closure')) {
        push('high', `${fuel.length} محطّة وقود في النطاق`,
            `أقربها ${readable(fuel[0].distance)} — خطر مضاعِف يسبق غيره في الترتيب`,
            fuel);
    }

    // ── ٤) الكثافة: هل النطاق مزدحم؟ ──
    if (affected.length) {
        const area = Math.PI * radius * radius;
        const perKm2 = affected.length / (area / 1e6);
        push(perKm2 > 120 ? 'warn' : 'info',
            `كثافة ${Math.round(perKm2)} معلماً لكل كم²`,
            perKm2 > 120
                ? 'نطاق مزدحم — الإخلاء يحتاج منافذ متعدّدة'
                : 'كثافة معتدلة في النطاق',
            []);
    }

    // ── ٥) فجوة الخدمة الحياتية الأهمّ للنمط ──
    const gapCat = event.kind === 'medical' ? 'صيدلية'
        : event.kind === 'fire' ? 'مستشفى'
            : event.kind === 'power' ? 'محطة وقود' : 'صيدلية';

    const gapFacilities = (landmarks || []).filter(l => l.category === gapCat);
    if (bounds && gapFacilities.length) {
        const gaps = serviceGaps(bounds, gapFacilities, { cellM: 500, thresholdM: 1200 });
        if (gaps.worst) {
            push('info', `أبعد موضع عن أقرب ${gapCat}`,
                `${readable(gaps.worst.distance)} — وتغطية ${Math.round(gaps.coverage * 100)}٪ من المساحة داخل ١٫٢ كم`,
                []);
        }
    }

    // ── ٦) لا شيء داخل النطاق ──
    if (!affected.length) {
        push('info', 'لا معلم داخل النطاق',
            `لا شيء مسجّل على الخريطة داخل ${readable(radius)} من الموضع — وسّع النطاق أو راجع اكتمال البيانات`, []);
    }

    const order = { high: 0, warn: 1, info: 2 };
    moves.sort((a, b) => order[a.level] - order[b.level]);

    return { kind, radius, affected, moves };
};

/* ============================================================
   التقرير
   ============================================================ */

/**
 * يجمع التحليل كلّه في بنية واحدة يرسمها التقرير.
 *
 * الحساب مرّة واحدة هنا لا في كل رسم: الرسوم والجداول والقرار
 * تقرأ من هذه البنية، فلا تتفاوت أرقام بين قسمٍ وقسم في تقرير
 * واحد — وهو أسوأ ما قد يحدث لتقرير.
 */
export const analyse = (event, landmarks, bounds) => {
    const made = decide(event, landmarks, bounds);
    const { affected, radius } = made;

    const insideCounts = countBy(affected);
    const allCounts = countBy(landmarks);

    const diversity = shannon(insideCounts);
    const spread = standardDistance(affected);
    const centre = meanCentre(affected);

    const area = Math.PI * radius * radius;
    const nni = nearestNeighbourIndex(affected, area);

    /* أقرب خدمة لكل صنف حياتي — جدول الوصول */
    const reach = LIFELINE.map(cat => {
        const found = nearestOf(event, (landmarks || []).filter(l => l.category === cat));
        return {
            category: cat,
            distance: found ? found.distance : null,
            name: found ? found.item.name : null,
            inside: found ? found.distance <= radius : false
        };
    });

    const weight = affected.reduce((sum, a) => sum + a.impact, 0);

    return {
        ...made,
        counts: insideCounts,
        allCounts,
        diversity,
        spread,
        centre,
        nni,
        reach,
        totals: {
            affected: affected.length,
            landmarks: (landmarks || []).length,
            weight,
            perKm2: area > 0 ? affected.length / (area / 1e6) : 0,
            critical: affected.filter(a => a.criticality >= 7).length
        }
    };
};

/**
 * درجة الخطورة من صفر إلى مئة.
 *
 * مركّبة من ثلاثة: مجموع الأثر، وعدد الحرج، والكثافة. ومسقوفة
 * بـ‎tanh‎ لا بقصٍّ عند مئة: القصُّ يجعل كل حدث كبير «مئة» فلا
 * يُفرَّق بينها، و‎tanh‎ يُبقي الفرق محسوساً عند الأطراف.
 */
export const severityOf = (report) => {
    if (!report) return { score: 0, band: 'low' };

    const { totals } = report;
    const raw = totals.weight / 40 + totals.critical / 3 + Math.min(3, totals.perKm2 / 60);
    const score = Math.round(100 * Math.tanh(raw / 3));

    return {
        score,
        band: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
    };
};
