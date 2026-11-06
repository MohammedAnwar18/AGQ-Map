import { haversine, bearing, compassOf, readable, criticalityOf } from './spatialAgent.js';
import { circlePolygon } from './spatialSim.js';
import {
    heatRings, FIRE_LOAD, HEAT_FLUX, FIRE_ZONES, fireZoneOf,
    AIR, PLUME_SPREAD_DEG,
    roadClassOf, losOf, queueLength, detourDelay,
    travelMinutes, responseVerdict, RESPONSE,
    walkVerdict, OUTAGE, SIGNAL_FAILURE_CAPACITY_LOSS,
    hourlyFlow, occupancyOf, hourLabel, evacuationMinutes
} from './hazardScience.js';

/* ============================================================
   سلاسل الأثر — ماذا يفعل الحدث بالمعالم

   لا «رأي» ولا «استقطاب»: ما يُعرض هنا ما يحدث ماديّاً، وكل سطرٍ
   منه رقمٌ محسوب ومعه معياره.

   حادثٌ يُغلق مسارين على شريان عند الثامنة صباحاً لا يُقال عنه
   «أثرٌ عالٍ»، بل:

     السعة تنزل من ‎3200‎ إلى ‎1600‎ مركبة/ساعة
     والوارد في هذه الساعة ‎2090‎ ⇒ مستوى الخدمة ينهار إلى ‎F‎
     والطابور ينمو ‎29‎ متراً كل دقيقة
     والبديل عبر «شارع كذا» يُضيف ‎2.4‎ دقيقة
     وأقرب مستشفى يصير على ‎6.1‎ دقيقة — يتجاوز حدّ ‎NFPA 1710‎

   والسلسلة تختلف باختلاف الحدث في طبيعته: الحريق يُشعّ ويُدخّن
   فيُخلي، والانقطاع يُعطّل التبريد والإشارات، والحادث يُفقد سعةً
   فيُزحم. فلكلٍّ نموذجه وسلاسله ومعاييره.
   ============================================================ */

/* ============================================================
   المعايير المستعملة — تُعرض في الواجهة
   ============================================================ */

export const STANDARDS = [
    {
        code: 'HCM 6th Edition',
        body: 'Transportation Research Board — الولايات المتحدة',
        about: 'سعة المسار ومستوى الخدمة A–F من نسبة الحجم إلى السعة',
        chains: ['traffic']
    },
    {
        code: 'نظرية الطوابير المُحتّمة',
        body: 'ملحق HCM — تحليل الطوابير',
        about: 'الطابور ينمو بفارق الوارد عن المنصرف مضروباً في الزمن',
        chains: ['traffic']
    },
    {
        code: 'HCM — كلفة تأخير المستخدم',
        body: 'Transportation Research Board',
        about: 'ساعة-مركبة: مجموع التأخير على المارّين، وحدة مقارنة الخيارات',
        chains: ['planned']
    },
    {
        code: 'NFPA 1710',
        body: 'National Fire Protection Association',
        about: 'زمن سير أوّل مركبة ٢٤٠ ثانية، واكتمال الطاقم ٤٨٠ ثانية',
        chains: ['access']
    },
    {
        code: 'SFPE Handbook',
        body: 'Society of Fire Protection Engineers',
        about: 'الإشعاع الحراريّ بنموذج المصدر النقطي وعتبات التدفّق',
        chains: ['fire']
    },
    {
        code: 'ERG 2024',
        body: 'US DOT وTransport Canada وSCT المكسيك',
        about: 'مسافة العزل الأوّلي ومسافة الإجراء الوقائي مع الريح',
        chains: ['fire']
    },
    {
        code: 'NFPA 101',
        body: 'National Fire Protection Association',
        about: 'سرعة المشي ١٫٢ م/ث وتدفّق المنفذ ١٫٣ شخص/م·ث',
        chains: ['fire']
    },
    {
        code: 'WHO AQG 2021',
        body: 'منظّمة الصحّة العالمية',
        about: 'حدّ PM2.5 اليوميّ ١٥ ميكروغرام/م³ — عتبة إخلاء الحسّاسين',
        chains: ['fire']
    },
    {
        code: 'FDA Food Code',
        body: 'إدارة الغذاء والدواء الأمريكية',
        about: 'الثلاجة تحفظ الطعام ٤ ساعات مغلقة بلا تيّار',
        chains: ['power']
    },
    {
        code: 'WHO EVM',
        body: 'منظّمة الصحّة العالمية — إدارة فعّالة للّقاحات',
        about: 'سلسلة التبريد ‎2–8‎ °م، وتجاوز ساعتين يُفسد الدفعة',
        chains: ['power']
    },
    {
        code: 'UN-Habitat',
        body: 'الأمم المتحدة — برنامج المستوطنات البشرية',
        about: 'الوصول مشياً: ٥٠٠ م مريح، و١٠٠٠ م مقبول',
        chains: ['access']
    },
    {
        code: 'OpenStreetMap',
        body: 'OSM Foundation — بيانات مفتوحة',
        about: 'تصنيف الطرق وعدد المسارات والسرعة والاتجاه الواحد',
        chains: ['traffic', 'access']
    }
];

export const standardsFor = (chains) => STANDARDS
    .filter(s => s.chains.some(c => (chains || []).includes(c)));

/* ============================================================
   وصف الطريق
   ============================================================ */

/* عدد المسارات حين لا يذكره ‎OSM‎ — قيمة تحفّظية لكل تصنيف */
const DEFAULT_LANES = {
    motorway: 3, trunk: 2, primary: 2, secondary: 2,
    tertiary: 1, residential: 1, service: 1, unclassified: 1, living_street: 1
};

/*
 * الحركة اليومية التقديرية لكل مسار — ‎AADT‎ تقريبيّ للمدن المتوسّطة.
 *
 * يُستعمل حين لا تتوفّر عدّادات حقيقية، وهو الحال في أكثر المدن.
 * والرقم تقديريّ معلَن لا مقيس، فيُذكر كذلك في التقرير.
 */
const DAILY_PER_LANE = {
    motorway: 18000, trunk: 14000, primary: 11000, secondary: 8000,
    tertiary: 5000, residential: 2000, service: 800,
    unclassified: 2500, living_street: 500
};

const lanesOf = (road) => {
    const tagged = parseInt(road?.lanes, 10);
    if (Number.isFinite(tagged) && tagged > 0) return tagged;
    return DEFAULT_LANES[road?.highway] || 1;
};

/** خطوط الطريق مهما جاءت: ‎lines‎ من الخادم أو ‎coords‎ لخطٍّ واحد */
const linesOf = (road) => {
    if (Array.isArray(road?.lines) && road.lines.length) return road.lines;
    if (Array.isArray(road?.coords) && road.coords.length > 1) return [road.coords];
    return [];
};

/**
 * الطريق كما يدخل الحساب: تصنيفه وسعته وسرعته وحركته.
 *
 * السرعة الموسومة في ‎OSM‎ تُقدَّم على سرعة التصنيف — فهي الواقع
 * المحلّي، وتصنيف ‎HCM‎ إنّما يُستكمل به ما لم يُوسم. ويُعلَن في
 * التقرير أيّهما استُعمل، كي لا يُحسب التقدير قياساً.
 */
export const describeRoad = (road) => {
    const cls = roadClassOf(road?.highway);
    const lanes = lanesOf(road);
    const speedTagged = Number.isFinite(+road?.maxspeed) && +road.maxspeed > 0;

    return {
        ...road,
        lanes,
        lanesTagged: Number.isFinite(parseInt(road?.lanes, 10)),
        cls,
        speed: speedTagged ? +road.maxspeed : cls.speed,
        speedTagged,
        capacity: cls.capacity * lanes,
        daily: (DAILY_PER_LANE[road?.highway] || 2000) * lanes,
        lines: linesOf(road)
    };
};

/* ============================================================
   أثر الحدث على الطريق
   ============================================================ */

/**
 * ماذا يفعل الحدث بالطريق — والجواب يختلف باختلاف الحدث.
 *
 * الحادث يُغلق مسارات معدودة، والحريق يُغلق الطريق كلّه داخل نطاق
 * العزل، والانقطاع يُعطّل الإشارات فيفقد التقاطع نصف سعته،
 * والتجمّع يقطع المسار بالمشاة. فنصيب السعة الباقية ليس رقماً
 * واحداً يُطبَّق على كل شيء.
 */
export const roadImpact = (road, { kind, blockedLanes = 2, hour = 8 }) => {
    const r = describeRoad(road);

    let left = r.capacity;
    let cause = '';

    if (kind === 'accident' || kind === 'closure') {
        const blocked = Math.min(r.lanes, Math.max(0, Math.round(blockedLanes)));
        left = r.cls.capacity * (r.lanes - blocked);
        cause = blocked >= r.lanes
            ? 'الطريق مغلق كلّياً'
            : `${blocked} من ${r.lanes} مسار مغلق`;
    } else if (kind === 'fire' || kind === 'hazmat') {
        left = 0;
        cause = 'إغلاق كامل — الطريق داخل نطاق العزل';
    } else if (kind === 'power') {
        left = r.capacity * (1 - SIGNAL_FAILURE_CAPACITY_LOSS);
        cause = 'إشارات معطّلة — التقاطع غير محكوم';
    } else if (kind === 'crowd') {
        left = r.capacity * 0.4;
        cause = 'ازدحام مشاة يقطع المسار';
    } else {
        left = r.capacity * 0.8;
        cause = 'إعاقة جزئية';
    }

    const arriving = hourlyFlow(r.daily, hour);
    const before = arriving / Math.max(1, r.capacity);
    const after = left > 0 ? arriving / left : Infinity;

    return {
        road: r,
        cause,
        arriving,
        capacityBefore: r.capacity,
        capacityAfter: left,
        lost: r.capacity - left,
        losBefore: losOf(before),
        losAfter: losOf(left > 0 ? after : 99),
        ratioBefore: before,
        ratioAfter: after,
        queue: queueLength(arriving, left, 15, Math.max(1, r.lanes))
    };
};

/**
 * البدائل الصالحة للتحويل.
 *
 * ولا يكفي القرب: ممرّ خدمة لا يستقبل تحويل شريان، فنشترط سعةً لا
 * تقلّ عن نصف المفقود. والاتجاه الواحد يُذكر لأنّ الالتفاف عبره قد
 * يكون ممنوعاً — وهو وسمٌ نقرأه من ‎OSM‎ لا نخمّنه.
 */
export const alternatives = (blocked, roads, { need = 0, limit = 3, from = null } = {}) => {
    const want = need * 0.5;
    const at = from || blocked?.centre || blocked;

    return (roads || [])
        .filter(r => r.id !== blocked?.id)
        .map(describeRoad)
        .filter(r => r.capacity >= want)
        .map(r => {
            /* ‎OSM‎ يردّ مع كل طريق أقرب مسافةٍ منه إلى موضع الاستعلام،
               وهي أصدق من المسافة إلى مركزه — فالشارع خطٌّ لا نقطة.
               وإن غابت حُسبت إلى المركز */
            const tagged = distanceOf(r);
            const gap = tagged === null ? haversine(at, r.centre || r) : tagged;
            /* الالتفاف تقريباً ضعف المسافة إلى البديل: خروجاً إليه
               ورجوعاً إلى المسار الأصلي */
            const extra = gap * 2;

            return {
                ...r,
                gap,
                extraMetres: extra,
                addedMinutes: detourDelay(extra, r.speed),
                oneway: !!r.oneway
            };
        })
        .sort((a, b) => a.addedMinutes - b.addedMinutes)
        .slice(0, limit);
};

/* ============================================================
   أثر الحدث على المعالم
   ============================================================ */

const CARE = ['مستشفى', 'مركز طبي', 'عيادة'];
const LIFELINE = ['مستشفى', 'مركز طبي', 'عيادة', 'صيدلية', 'محطة وقود'];

/* الحسّاسون للدخان — ‎WHO‎ تُقدّمهم في الإخلاء */
const SMOKE_SENSITIVE = ['مدرسة', 'مستشفى', 'مركز طبي', 'University', 'حضانة', 'دار رعاية'];

/* ماذا يتعطّل عند انقطاع التيّار، ومتى يصير الضرر دائماً */
const POWER_SENSITIVE = {
    'مستشفى': { why: 'أجهزة طبية وتبريد أدوية', limit: OUTAGE.vaccine },
    'مركز طبي': { why: 'تبريد لقاحات', limit: OUTAGE.vaccine },
    'عيادة': { why: 'تبريد أدوية', limit: OUTAGE.vaccine },
    'صيدلية': { why: 'تبريد أدوية ولقاحات', limit: OUTAGE.vaccine },
    'Supermarket': { why: 'تبريد أطعمة', limit: OUTAGE.fridge },
    'Restaurant': { why: 'تبريد أطعمة', limit: OUTAGE.fridge },
    'Cafe': { why: 'تبريد أطعمة', limit: OUTAGE.fridge },
    'محطة وقود': { why: 'مضخّات تعمل بالكهرباء', limit: OUTAGE.fridge },
    'بنك': { why: 'توقّف الخدمة والصرّاف', limit: OUTAGE.fridge }
};

/* تقدير الرؤوس في المعلم الممتلئ، حسب صنفه */
const HEADS = {
    'مدرسة': 400, 'University': 900, 'مستشفى': 250, 'مركز طبي': 40,
    'مركز تسوق': 300, 'Supermarket': 60, 'Restaurant': 40, 'Cafe': 30,
    'مسجد': 150, 'بنك': 30, 'صيدلية': 10, 'محطة وقود': 15
};

const headsOf = (place) => (HEADS[place?.category] || 25) * (place?.occupancy?.share ?? 1);

/** ما يقع داخل نطاق، ومن فيه في هذه الساعة */
export const exposedPlaces = (event, landmarks, radius, hour) => (landmarks || [])
    .map(place => {
        const d = haversine(event, place);
        if (!Number.isFinite(d) || d > radius) return null;

        const occupancy = occupancyOf(place.category, hour);
        const enriched = { ...place, distance: d, occupancy };

        return {
            ...enriched,
            bearing: bearing(event, place),
            heads: headsOf(enriched),
            lifeline: LIFELINE.includes(place.category),
            sensitive: SMOKE_SENSITIVE.includes(place.category)
        };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

/* ============================================================
   هندسة العرض على الخريطة
   ============================================================ */

const METRES_PER_DEG = 111320;

/**
 * قطاعٌ في اتجاه الريح — ممرّ الدخان.
 *
 * الدخان لا يسير في دائرة: يُحمل مع الريح ويتمدّد جانبيّاً بزاوية
 * تقارب ‎30°‎ في الجوّ المحايد. فالممرّ قطاعٌ لا حلقة، وهذا ما
 * يُفرّق الحريق عن غيره على الخريطة.
 */
export const sectorPolygon = (centre, towardDeg, radiusM, spreadDeg = PLUME_SPREAD_DEG, steps = 24) => {
    const lat = +centre.latitude;
    const lon = +centre.longitude;

    const latR = radiusM / METRES_PER_DEG;
    const lonR = latR / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

    const half = spreadDeg / 2;
    const ring = [[lon, lat]];

    for (let i = 0; i <= steps; i++) {
        const deg = towardDeg - half + (spreadDeg * i) / steps;
        const rad = (deg * Math.PI) / 180;
        // الاتجاه بالبوصلة: صفرٌ شمالاً ويزيد شرقاً
        ring.push([lon + Math.sin(rad) * lonR, lat + Math.cos(rad) * latR]);
    }

    ring.push([lon, lat]);
    return { type: 'Polygon', coordinates: [ring] };
};

/**
 * جزءٌ من خطٍّ بطول معيّن، يبدأ من أقرب نقطةٍ إلى الموضع.
 *
 * يُستعمل لرسم الطابور على الطريق: ‎1137‎ متراً من الطابور تُرى
 * ممتدّةً على الشارع نفسه، لا كرقمٍ في جدول.
 */
export const trimLine = (coords, from, metres) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const at = (c) => ({ longitude: c[0], latitude: c[1] });

    let start = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i++) {
        const d = haversine(from, at(coords[i]));
        if (d < bestD) { bestD = d; start = i; }
    }

    /* نسير في الجهة الأطول من نقطة البداية — الطابور يمتدّ خلف
       موضع الإعاقة، وأطول الجهتين هي التي تتّسع له */
    const forward = coords.length - 1 - start;
    const step = forward >= start ? 1 : -1;

    const out = [coords[start]];
    let run = 0;

    for (let i = start + step; i >= 0 && i < coords.length; i += step) {
        run += haversine(at(coords[i - step]), at(coords[i]));
        out.push(coords[i]);
        if (run >= metres) break;
    }

    return out.length > 1 ? { type: 'LineString', coordinates: out } : null;
};

const feature = (geometry, properties) => ({ type: 'Feature', geometry, properties });

/* ============================================================
   السلاسل — لكل حدثٍ سلاسله
   ============================================================ */

/*
 * مسافة الطريق من موضع الاستعلام كما وسمها الخادم.
 *
 * و‎null‎ ليست صفراً: ‎+null‎ صفرٌ في جافاسكربت و‎Number.isFinite(0)‎
 * صحيح، فطريقٌ بلا مسافةٍ موسومة كان سيُحسب ملاصقاً للحدث. فنفصل
 * «غير معروف» عن «على بعد صفر» فصلاً صريحاً.
 */
const distanceOf = (road) => {
    if (road?.distance === null || road?.distance === undefined || road.distance === '') return null;
    const d = +road.distance;
    return Number.isFinite(d) ? d : null;
};

/**
 * الطريق المتأثّر: الأوسع سعةً بين ما يُلامس موضع الحدث.
 *
 * ولا يُؤخذ الأوسع في الشبكة مطلقاً — فشريانٌ على أربعمئة متر لا
 * يُغلقه حادثٌ هنا. وإن لم يُلامس الحدثَ شيءٌ أُخذ الأقرب، وقيل
 * في التقرير على أيّ طريق جرى الحساب.
 */
const affectedRoad = (described) => {
    const touching = described
        .filter(r => {
            const d = distanceOf(r);
            return d === null || d <= 120;
        })
        .sort((a, b) => b.capacity - a.capacity);

    return touching[0]
        || [...described].sort((a, b) => (distanceOf(a) ?? 0) - (distanceOf(b) ?? 0))[0];
};

const line = (tone, head, body, cite) => ({ tone, head, body, cite: cite || null });

/**
 * سلسلة الحريق.
 *
 * ثلاث طبقات: حلقات الحرارة المحسوبة (أمتار معدودة — فالإشعاع
 * يسقط بمربّع المسافة)، ونطاق العزل الميدانيّ من ‎ERG‎ (مئات
 * الأمتار — وهو ما تُفرّغه فرق الإطفاء فعلاً)، وممرّ الدخان مع
 * الريح (وهو الأبعد، وهو الذي يُخلي المدارس والمستشفيات).
 *
 * ووجود وقود داخل الحلقة القريبة يُحوّل الحدث إلى حدثٍ آخر، فيُقدَّم.
 */
const fireChain = (event, places, roads, hour, out, shapes) => {
    const loadKey = event.load || 'building';
    const load = FIRE_LOAD[loadKey] || FIRE_LOAD.building;
    const zone = fireZoneOf(loadKey);
    const rings = heatRings(load.mw);
    const ring = (key) => rings.find(r => r.key === key);
    const wind = Number.isFinite(+event.windToward) ? +event.windToward : 90;

    out.push(line('info',
        `${zone.say} بقدرة ${load.mw} ميغاواط`,
        'نموذج المصدر النقطي يُعطي حلقات الحرارة: تلفٌ إنشائيّ حتى '
        + `${readable(ring('structural').radius)}، واشتعالٌ بمصدر حتى `
        + `${readable(ring('ignition').radius)}، وحدّ الإخلاء الآمن `
        + `${readable(ring('escape').radius)}. والإشعاع يسقط بمربّع المسافة، `
        + 'فالحرارة قريبة — والذي يبلغ بعيداً هو الدخان.',
        'SFPE Handbook — عتبات ‎37.5 / 12.5 / 4.7‎ ك.و/م²'));

    for (const r of rings) {
        if (r.key === 'safe') continue;
        shapes.push(feature(circlePolygon(event, r.radius, 48), {
            layer: 'heat', key: r.key, tone: r.tone,
            label: `${r.kw} ك.و/م² — ${r.say}`, radius: Math.round(r.radius)
        }));
    }

    out.push(line('high',
        `نطاق العزل الأوّلي ${readable(zone.isolate)} في كل اتجاه`,
        `ومسافة الإجراء الوقائي مع الريح ${readable(zone.downwind)} `
        + `(${compassOf(wind)}). وهذه مسافات ميدانية لا حرارية: الدخان والشظايا `
        + 'واحتمال الامتداد هي ما يُحدّدها.',
        'ERG 2024 — مسافة العزل الأوّلي والإجراء الوقائي'));

    shapes.push(feature(circlePolygon(event, zone.isolate, 48), {
        layer: 'isolate', tone: 'high',
        label: `عزل أوّلي ${readable(zone.isolate)}`, radius: zone.isolate
    }));
    shapes.push(feature(sectorPolygon(event, wind, zone.downwind), {
        layer: 'plume', tone: 'warn',
        label: `ممرّ الدخان ${compassOf(wind)} — ${readable(zone.downwind)}`,
        radius: zone.downwind
    }));

    /* الوقود أوّلاً: وجوده قريباً تصعيدٌ يُغيّر الحدث كلّه */
    const fuel = places.filter(p => p.category === 'محطة وقود'
        && p.distance <= Math.max(ring('ignition').radius, zone.isolate));

    if (fuel.length) {
        const escalated = heatRings(FIRE_LOAD.fuel.mw).find(r => r.key === 'escape');
        out.push(line('high',
            `خطر تصعيد: ${fuel.length} محطّة وقود في النطاق القريب`,
            `أقربها ${fuel[0].name} على ${readable(fuel[0].distance)} ${compassOf(fuel[0].bearing)}. `
            + `إن اشتعلت صارت القدرة ${FIRE_LOAD.fuel.mw} ميغاواط، فتتّسع حلقة الإخلاء إلى `
            + `${readable(escalated.radius)} والعزل الميدانيّ إلى ${readable(FIRE_ZONES.fuel.isolate)}.`,
            `NFPA — عتبة ${HEAT_FLUX.ignition.kw} ك.و/م² للاشتعال بمصدر`));
    }

    /* من يُخلى: ما داخل نطاق العزل، وزمن إخلائه محسوب */
    const toEvacuate = places.filter(p => p.distance <= zone.isolate);
    if (toEvacuate.length) {
        const heads = toEvacuate.reduce((sum, p) => sum + p.heads, 0);
        const evac = evacuationMinutes(zone.isolate, heads, 12);

        out.push(line('high',
            `${toEvacuate.length} معلماً يُخلى — نحو ${Math.round(heads)} شخصاً`,
            'العدد مقدَّرٌ من امتلاء كل معلم في هذه الساعة. زمن الإخلاء '
            + `${evac.totalMinutes.toFixed(1)} دقيقة بعرض منافذ ١٢ م، والعنق فيه ${evac.bottleneck}. `
            + `أكثرها احتياجاً: ${toEvacuate.slice(0, 3).map(p => p.name).join(' · ')}.`,
            'NFPA 101 / SFPE — ١٫٢ م/ث مشياً و١٫٣ شخص/م·ث عبر المنافذ'));
    }

    /* الدخان: من في الممرّ، والحسّاسون منهم أوّلاً */
    const inPlume = places.filter(p => {
        if (p.distance > zone.downwind) return false;
        /* الفرق الزاويّ الموقَّع إلى [−180, 180) ثمّ مطلقه: الصفر
           يعني أنّ المعلم في عين اتجاه الريح */
        const off = Math.abs(((p.bearing - wind + 540) % 360) - 180);
        return off <= PLUME_SPREAD_DEG / 2;
    });

    const sensitive = inPlume.filter(p => p.sensitive && p.occupancy.open);

    if (sensitive.length) {
        out.push(line('high',
            `${sensitive.length} منشأة حسّاسة في ممرّ الدخان وهي عامرة الآن`,
            sensitive.slice(0, 4).map(p =>
                `${p.name} على ${readable(p.distance)} (امتلاء ${Math.round(p.occupancy.share * 100)}٪)`
            ).join(' · ')
            + `. تجاوز ${AIR.pm25Daily.value} ${AIR.pm25Daily.unit} يستوجب الإخلاء أو البقاء في الداخل `
            + 'مع إغلاق المنافذ.',
            `WHO AQG 2021 — ${AIR.pm25Daily.say}`));
    } else if (inPlume.length) {
        out.push(line('warn',
            `${inPlume.length} معلماً في ممرّ الدخان ${compassOf(wind)}`,
            'لا منشأة حسّاسة عامرة بينها في هذه الساعة. وتغيّر اتجاه الريح يُغيّر هذه القائمة كلّها.',
            `WHO AQG 2021 — ${AIR.pm25Daily.say}`));
    }

    return out;
};

/**
 * سلسلة المرور — أطول السلاسل، لأنّ أثر الطريق شبكيّ لا موضعيّ.
 *
 * فقدُ السعة يرفع نسبة الحجم إلى السعة، فينهار مستوى الخدمة،
 * فينمو طابور بطولٍ محسوب، فيتأخّر كل من يمرّ — ومنهم الإسعاف.
 * ثمّ يُسأل: وأين البديل، وكم يُضيف؟
 */
const trafficChain = (event, places, roads, hour, out, shapes, kind) => {
    const label = hourLabel(hour);

    if (!roads?.length) {
        out.push(line('warn',
            'لا شبكة طرق محمَّلة لهذا الموضع',
            'التحليل المروريّ يُبنى على تصنيف الشارع وعدد مساراته من OpenStreetMap. '
            + 'اضغط «اقرأ الشبكة» لجلبها، فتُحسب السعة والطابور والبدائل على الشوارع بأسمائها.',
            'OpenStreetMap — بيانات مفتوحة'));
        return out;
    }

    const described = roads.map(describeRoad);
    const main = affectedRoad(described);
    const hit = roadImpact(main, { kind, blockedLanes: event.blockedLanes ?? 2, hour });

    const sourced = [
        hit.road.lanesTagged ? 'عدد المسارات موسوم في OSM' : 'عدد المسارات مُستكمَل من التصنيف',
        hit.road.speedTagged ? `السرعة موسومة ${hit.road.speed} كم/س` : `السرعة من تصنيف HCM ${hit.road.speed} كم/س`
    ].join('، ');

    out.push(line(hit.losAfter.tone,
        `${main.name || main.cls.say}: مستوى الخدمة ${hit.losBefore.grade} ← ${hit.losAfter.grade}`,
        `${hit.cause}. السعة تنزل من ${Math.round(hit.capacityBefore)} إلى `
        + `${Math.round(hit.capacityAfter)} مركبة/ساعة، والوارد ${label.text} نحو `
        + `${Math.round(hit.arriving)} مركبة/ساعة ⇒ النسبة ${hit.ratioBefore.toFixed(2)} ← `
        + `${Number.isFinite(hit.ratioAfter) ? hit.ratioAfter.toFixed(2) : '∞'}. `
        + `${hit.losAfter.say}. (${sourced})`,
        'HCM 6th Edition — سعة ومستوى خدمة'));

    for (const coords of hit.road.lines) {
        shapes.push(feature({ type: 'LineString', coordinates: coords }, {
            layer: 'road', tone: hit.losAfter.tone, grade: hit.losAfter.grade,
            label: `${main.name || main.cls.say} — مستوى ${hit.losAfter.grade}`
        }));
    }

    if (hit.queue.growing) {
        /* النبرة من الطول لا من مجرّد النموّ: طابورٌ أربعون متراً
           ينمو ثلاثة أمتار في الدقيقة ليلاً ليس حدثاً عاجلاً، وقولُه
           عاجلاً يُفقد كلمة «عاجل» معناها في بقيّة التقرير */
        const grade = hit.queue.metres > 300 ? 'high'
            : hit.queue.metres > 80 ? 'warn' : 'info';

        out.push(line(grade,
            `طابور ينمو ${Math.round(hit.queue.perMinute)} متراً كل دقيقة`,
            `بعد ربع ساعة يبلغ نحو ${readable(hit.queue.metres)} `
            + `(${Math.round(hit.queue.vehicles)} مركبة على ${hit.road.lanes} مسار). `
            + 'والنموّ لا يتوقّف ما دام الوارد يتجاوز المنصرف — فالفتح المبكّر هو ما يُقصّره لا الصبر.'
            + (grade === 'info' ? ' وهذا الطول محدود في هذه الساعة.' : ''),
            'نظرية الطوابير المُحتّمة — ملحق HCM'));

        const longest = hit.road.lines.reduce(
            (a, b) => (b.length > a.length ? b : a), hit.road.lines[0] || []);
        const drawn = trimLine(longest, event, hit.queue.metres);
        if (drawn) {
            shapes.push(feature(drawn, {
                layer: 'queue', tone: 'high',
                label: `طابور ${readable(hit.queue.metres)} بعد ١٥ دقيقة`
            }));
        }
    } else {
        out.push(line('info',
            'لا طابور متنامٍ في هذه الساعة',
            `السعة الباقية ${Math.round(hit.capacityAfter)} تكفي الوارد ${Math.round(hit.arriving)}. `
            + 'ووقوع الحدث نفسه في ساعة الذروة كان سيُولّد طابوراً.',
            'نظرية الطوابير المُحتّمة — ملحق HCM'));
    }

    const alts = alternatives(main, described, { need: hit.lost, from: event });
    if (alts.length) {
        out.push(line('info',
            `${alts.length} بديل يستقبل التحويل`,
            alts.map(a => `${a.name || a.cls.say} (${a.cls.say}، سعة ${Math.round(a.capacity)}`
                + `${a.oneway ? '، اتجاه واحد' : ''}) على ${readable(a.gap)} يُضيف `
                + `${a.addedMinutes.toFixed(1)} دقيقة`).join(' · '),
            'زمن الالتفاف = المسافة الزائدة ÷ ٧٠٪ من السرعة الحرّة'));

        alts.forEach((a, i) => {
            for (const coords of a.lines) {
                shapes.push(feature({ type: 'LineString', coordinates: coords }, {
                    layer: 'alternative', tone: 'info', rank: i + 1,
                    label: `بديل ${i + 1}: ${a.name || a.cls.say} (+${a.addedMinutes.toFixed(1)} د)`
                }));
            }
        });
    } else {
        out.push(line('high',
            'لا بديل بسعة كافية',
            `المفقود ${Math.round(hit.lost)} مركبة/ساعة، ولا طريق قريب يحمل نصفه. `
            + 'فالازدحام لن يُحتوى محليّاً بل سينتشر إلى الشبكة المحيطة.',
            'HCM — تحليل الشبكة لا الوصلة وحدها'));
    }

    if (label.peak) {
        out.push(line('warn',
            `الوقت ذروة — ${label.text}`,
            `هذه الساعة تحمل ${(label.share * 100).toFixed(1)}٪ من حركة اليوم، `
            + `أي ${(label.share / hourLabel(3).share).toFixed(0)} ضعفاً عن الثالثة فجراً. `
            + 'ونفس الحدث ليلاً أثرٌ آخر تماماً.',
            'منحنى التوزيع الساعيّ للحركة الحضرية'));
    }

    return out;
};

/**
 * سلسلة الإغلاق المخطَّط.
 *
 * الإغلاق المخطَّط أثره المروريّ أثرُ الحادث نفسه — فالفيزياء واحدة.
 * لكنّ السؤال عنه مختلف: الحادث يُسأل «ماذا نفعل الآن؟»، والإغلاق
 * يُسأل «متى نفعله، وكم يُكلّف؟».
 *
 * فيُحسب له ما لا يُحسب للحادث: مجموع التأخير على كل من يمرّ خلال
 * مدّته (ساعات-مركبة، وهي وحدة تحليل كلفة المستخدم في ‎HCM‎)، وأرخص
 * نافذةٍ لتنفيذه — وهي حسابٌ بحت على منحنى الحركة الساعيّ.
 */
const plannedChain = (event, places, roads, hour, out) => {
    if (!roads?.length) return out;

    const hours = Math.max(1, Math.min(24, Math.round(event.durationHours ?? 4)));
    const described = roads.map(describeRoad);
    const main = affectedRoad(described);
    const hit = roadImpact(main, { kind: 'closure', blockedLanes: event.blockedLanes ?? 2, hour });
    const alts = alternatives(main, described, { need: hit.lost, from: event });

    /* المركبات المتأثّرة: مجموع الوارد في ساعات الإغلاق كلّها */
    let vehicles = 0;
    for (let i = 0; i < hours; i++) vehicles += hourlyFlow(hit.road.daily, hour + i);

    if (alts.length) {
        const perVehicle = alts[0].addedMinutes;
        const vehicleHours = (vehicles * perVehicle) / 60;

        out.push(line(vehicleHours > 500 ? 'high' : vehicleHours > 100 ? 'warn' : 'info',
            `كلفة الإغلاق ${Math.round(vehicleHours)} ساعة-مركبة`,
            `${Math.round(vehicles)} مركبة تمرّ خلال ${hours} ساعة، وكلٌّ منها يُضيف `
            + `${perVehicle.toFixed(1)} دقيقة عبر ${alts[0].name || alts[0].cls.say}. `
            + 'وساعة-المركبة هي وحدة كلفة المستخدم: بها تُقارَن خيارات التنفيذ بالأرقام.',
            'HCM — تحليل كلفة تأخير المستخدم'));
    } else {
        out.push(line('high',
            `${Math.round(vehicles)} مركبة بلا بديل خلال ${hours} ساعة`,
            'لا طريق قريب يحمل نصف المفقود، فالإغلاق بهذا الطول يحتاج تحويلاً مُخطَّطاً '
            + 'إلى خارج الحيّ لا التفافاً محلّياً.',
            'HCM — تحليل الشبكة لا الوصلة وحدها'));
    }

    /* أرخص نافذة: الساعة التي يبدأ عندها الإغلاق فيكون مجموع
       الوارد خلاله أقلّ ما يُمكن. حسابٌ على منحنى الحركة لا رأي */
    let bestStart = 0;
    let bestSum = Infinity;
    for (let start = 0; start < 24; start++) {
        let sum = 0;
        for (let i = 0; i < hours; i++) sum += hourlyFlow(hit.road.daily, start + i);
        if (sum < bestSum) { bestSum = sum; bestStart = start; }
    }

    const saving = vehicles > 0 ? 1 - bestSum / vehicles : 0;

    out.push(line('info',
        `أرخص نافذة للتنفيذ تبدأ ${hourLabel(bestStart).text}`,
        `يمرّ خلالها ${Math.round(bestSum)} مركبة بدل ${Math.round(vehicles)}`
        + `${saving > 0.02 ? ` — أي ${Math.round(saving * 100)}٪ أقلّ تأثّراً` : ' — وهي النافذة المختارة فعلاً'}. `
        + 'والنافذة محسوبة على منحنى الحركة الساعيّ لهذا التصنيف.',
        'منحنى التوزيع الساعيّ للحركة الحضرية'));

    return out;
};

/** سلسلة انقطاع التيّار: ما يتعطّل، ومتى يصير الضرر دائماً */
const powerChain = (event, places, roads, hour, out, shapes) => {
    const hours = Number.isFinite(+event.durationHours) ? +event.durationHours : 6;

    const sensitive = places
        .map(p => ({ place: p, rule: POWER_SENSITIVE[p.category] }))
        .filter(x => x.rule)
        .sort((a, b) => a.rule.limit.hours - b.rule.limit.hours);

    const breached = sensitive.filter(x => hours > x.rule.limit.hours);

    if (breached.length) {
        out.push(line('high',
            `${breached.length} منشأة تتجاوز حدّها الزمنيّ عند ${hours} ساعة`,
            breached.slice(0, 5).map(x =>
                `${x.place.name} — ${x.rule.why} (الحدّ ${x.rule.limit.hours} ساعة)`).join(' · ')
            + '. وما بعد الحدّ ليس إزعاجاً بل تلفاً: الدفعة تُعدَم والطعام يُرمى.',
            `${OUTAGE.vaccine.say} · ${OUTAGE.fridge.say}`));
    } else if (sensitive.length) {
        const shortest = sensitive[0].rule.limit.hours;
        out.push(line('warn',
            `${sensitive.length} منشأة حسّاسة — وكلّها ضمن حدّها`,
            `أقصر حدٍّ هنا ${shortest} ساعة (${sensitive[0].place.name})، والانقطاع ${hours} ساعة. `
            + `فإن طال إلى ${shortest + 1} ساعة بدأ التلف.`,
            'FDA Food Code · WHO EVM'));
    }

    const care = places.filter(p => CARE.includes(p.category));
    if (care.length) {
        out.push(line('high',
            `${care.length} منشأة رعاية بلا تيّار`,
            `${care.map(p => p.name).join(' · ')} — الأجهزة الحيوية على المولّد الاحتياطي، `
            + `ووقوده هو حدّ الصمود. وامتلاء أقربها الآن ${Math.round(care[0].occupancy.share * 100)}٪.`,
            'WHO — صمود المرافق الصحّية'));
    }

    if (roads?.length) {
        const described = roads.map(describeRoad);
        const main = [...described].sort((a, b) => b.capacity - a.capacity)[0];
        const hit = roadImpact(main, { kind: 'power', hour });

        out.push(line('warn',
            `الإشارات معطّلة — ${main.name || main.cls.say} يفقد نصف سعته`,
            `التقاطع غير المحكوم يفقد نحو ${Math.round(SIGNAL_FAILURE_CAPACITY_LOSS * 100)}٪ من سعته: `
            + `من ${Math.round(hit.capacityBefore)} إلى ${Math.round(hit.capacityAfter)} مركبة/ساعة، `
            + `فمستوى الخدمة ${hit.losBefore.grade} ← ${hit.losAfter.grade}.`,
            'دراسات أعطال الإشارات — فقد ٤٠–٦٠٪ من السعة'));

        for (const coords of hit.road.lines) {
            shapes.push(feature({ type: 'LineString', coordinates: coords }, {
                layer: 'road', tone: hit.losAfter.tone, grade: hit.losAfter.grade,
                label: `${main.name || main.cls.say} — إشارة معطّلة، مستوى ${hit.losAfter.grade}`
            }));
        }
    }

    const fuel = places.filter(p => p.category === 'محطة وقود');
    if (fuel.length) {
        out.push(line('warn',
            `${fuel.length} محطّة وقود تتوقّف مضخّاتها`,
            `${fuel.map(p => p.name).join(' · ')} — ولا تزوّد مركبات الطوارئ أيضاً. `
            + 'وهذا يُضاعف أثر الانقطاع: يُعطّل الخدمة ويُعطّل الاستجابة.',
            'المضخّات كهربائية — لا تعمل بلا تيّار'));
    }

    return out;
};

/** الوصول — يُفحص في كل حدث، لأنّه ما تُقاس عليه الأرواح */
const accessChain = (event, landmarks, radius, roads, out) => {
    const care = (landmarks || []).filter(l => CARE.includes(l.category));

    if (!care.length) {
        out.push(line('warn',
            'لا رعاية طبية في البيانات',
            'لا مستشفى ولا مركز طبيّ مسجّلٌ على الخريطة، فلا يُحسب زمن وصولٍ من هذه البيانات. '
            + 'وهذا نقصُ بياناتٍ لا نقصُ خدمة — فليس حكماً على المكان.',
            null));
        return out;
    }

    let best = null;
    for (const c of care) {
        const d = haversine(event, c);
        if (!best || d < best.d) best = { c, d };
    }

    const fastest = [...(roads || []).map(describeRoad)].sort((a, b) => b.speed - a.speed)[0];
    const speed = fastest ? fastest.speed : 40;

    const clear = travelMinutes(best.d, speed);
    const blocked = travelMinutes(best.d, speed * 0.45);
    const verdict = responseVerdict(blocked);
    const clearVerdict = responseVerdict(clear);

    out.push(line(verdict.tone,
        `أقرب رعاية: ${best.c.name} على ${readable(best.d)}`,
        `زمن السير ${clear.toFixed(1)} دقيقة في الظرف العادي (${clearVerdict.grade})، `
        + `و${blocked.toFixed(1)} دقيقة إن كان الطريق مزدحماً بالحدث (${verdict.grade}). `
        + `المسافة هوائية ${readable(best.d)} والطريق أطول منها ٣٠٪، على سرعة `
        + `${Math.round(speed)} كم/س${fastest?.speedTagged ? ' موسومة في OSM' : ' من تصنيف HCM'}.`,
        `NFPA 1710 — ${RESPONSE.first.seconds / 60} دقائق لأوّل مركبة`));

    const walk = walkVerdict(best.d);
    out.push(line(walk.tone,
        `مشياً إلى الرعاية: ${walk.say}`,
        `${readable(best.d)} تعني نحو ${Math.round(best.d / 1.2 / 60)} دقيقة مشياً بسرعة ١٫٢ م/ث. `
        + 'وهذا يَهُمّ من لا مركبة له — وهم أكثر من يُصاب في الحوادث الحضرية.',
        'UN-Habitat — الوصول إلى الخدمات الأساسية'));

    return out;
};

/** الناس الآن — يجعل الزمن من اليوم مرئيّاً في كل حدث */
const peopleChain = (event, places, hour, out) => {
    const label = hourLabel(hour);

    if (!places.length) {
        out.push(line('info',
            'لا معالم مسجّلة في النطاق',
            'النطاق خالٍ من المعالم في بيانات الخريطة، فالتحليل يقتصر على الطرق والفيزياء.',
            null));
        return out;
    }

    const open = places.filter(p => p.occupancy.open);
    const heads = places.reduce((sum, p) => sum + p.heads, 0);
    const top = [...places].sort((a, b) => b.heads - a.heads).slice(0, 3);

    out.push(line(heads > 500 ? 'high' : heads > 150 ? 'warn' : 'info',
        `نحو ${Math.round(heads)} شخصاً في النطاق ${label.text}`,
        `${open.length} من ${places.length} معلماً عامل في هذه الساعة. `
        + `أكثرها: ${top.map(p => `${p.name} (${Math.round(p.heads)})`).join(' · ')}. `
        + 'والعدد مقدَّر من صنف المعلم ودوامه، لا من عدّادٍ حقيقيّ.',
        'منحنى الامتلاء حسب صنف المنشأة ودوامها'));

    const closed = places.filter(p => !p.occupancy.open && p.lifeline);
    if (closed.length) {
        out.push(line('warn',
            `${closed.length} خدمة حياتية مغلقة في هذه الساعة`,
            `${closed.slice(0, 4).map(p => `${p.name} (${p.occupancy.say})`).join(' · ')} — `
            + 'فالاعتماد عليها في هذا التوقيت غير ممكن، ويجب أن يُحسب البديل الأبعد.',
            'دوام المنشآت — متغيّر زمنيّ لا ثابت'));
    }

    return out;
};

/**
 * المساحات المفتوحة — نقاط تجمّعٍ وإخلاءٍ وإسنادٍ ميدانيّ.
 *
 * المساحة الخضراء ليست زينةً على الخريطة: قرب حريقٍ أو حشدٍ أو
 * حادثٍ هي أقرب فضاءٍ آمنٍ يُجمَّع فيه المُخلَون وتُرابط فيه فرق
 * الإسناد. فنقيس أقربها ونقول إن كانت تكفي.
 */
const openSpaceChain = (event, greens, radius, kind, out) => {
    if (!greens?.length) return out;

    const near = greens
        .map(g => ({
            ...g,
            d: Number.isFinite(g.distance)
                ? g.distance
                : haversine(event, { latitude: g.latitude, longitude: g.longitude })
        }))
        .filter(g => Number.isFinite(g.d) && g.d <= radius)
        .sort((a, b) => a.d - b.d);

    const veg = near.filter(g => g.group === 'veg');
    const water = near.filter(g => g.group === 'water');

    const wants = ['fire', 'crowd', 'accident', 'medical', 'closure'].includes(kind);

    if (veg.length && wants) {
        const g = veg[0];
        const b = bearing(event, { latitude: g.latitude, longitude: g.longitude });
        out.push(line('info',
            `مساحة مفتوحة قريبة تصلح نقطة تجمّع/إخلاء: ${g.name || g.say}`,
            `${g.say} على ${readable(g.d)} ${compassOf(b)}. المساحات المفتوحة `
            + 'هي ما تُرابط فيه فرق الإسناد ويُجمَّع فيه المُخلَون بعيداً عن المباني، '
            + `و${veg.length > 1 ? `في النطاق ${veg.length} مساحة خضراء` : 'هذه أقربها'}. `
            + 'وقربها من الحدث قيمةٌ تشغيليّة لا جماليّة.',
            'OpenStreetMap — leisure/landuse (مساحات مفتوحة)'));
    }

    if (water.length && kind === 'fire') {
        const g = water[0];
        out.push(line('info',
            `مصدر مياه مفتوح قريب: ${g.name || g.say}`,
            `${g.say} على ${readable(g.d)} — قد يُفيد في الإسناد. والاعتماد عليه ميدانيّ لا مؤكَّد من الخريطة وحدها.`,
            'OpenStreetMap — natural=water'));
    }

    return out;
};

/* ============================================================
   حقل الشدّة الحراريّ — «خريطة حرارة» للأثر، لكل حدث

   الأثر لا يُقرأ حلقاتٍ صمّاء: يُقرأ سطحاً متدرّجاً كاللهب، أشدُّه
   عند المركز ويخبو مع المسافة — لكنّه لا يخبو بانتظام. فهو ينحرف:

     · مع الريح في الحريق (ممرّ الدخان)
     · نحو ما يُعظّم الأثر — مدرسةٌ عامرة، مستشفى، محطّة وقود
     · ويشتدّ في النسيج المبنيّ الكثيف ويخفّ في الأرض المكشوفة

   فالسطح الناتج ليس دائرةً بل «بصمةٌ» لهذا الحدث في هذا المكان في
   هذه الساعة — وهذا هو الربط المطلوب بين الحدث ومحيطه.
   ============================================================ */

/*
 * لكل نوع حدثٍ ملمحُ انتشارٍ مختلف: الحشد يتركّز، والانقطاع ينبسط،
 * والحريق ينحرف مع الريح، والطارئ الطبّي تجذبه مرافق الرعاية.
 */
const HEAT_PROFILE = {
    accident: { falloff: 1.6, directional: false, placePull: 1.0 },
    closure: { falloff: 1.3, directional: false, placePull: 1.0 },
    fire: { falloff: 1.1, directional: true, placePull: 0.8 },
    power: { falloff: 0.8, directional: false, placePull: 1.3 },
    crowd: { falloff: 2.2, directional: false, placePull: 0.7 },
    medical: { falloff: 1.0, directional: false, placePull: 1.5 },
    default: { falloff: 1.5, directional: false, placePull: 1.0 }
};

/* مستويات الشدّة — من الشديد إلى المنخفض، ولونٌ لكلٍّ لا يلتبس */
export const IMPACT_LEVELS = [
    { t: 0.70, color: '#dc2626', say: 'شديد' },
    { t: 0.45, color: '#f97316', say: 'مرتفع' },
    { t: 0.25, color: '#f59e0b', say: 'متوسّط' },
    { t: 0.12, color: '#facc15', say: 'منخفض' }
];

/** شدّة الأثر عند إزاحةٍ بالأمتار عن مركز الحدث */
const intensityAt = (dxm, dym, radius, prof, built, windToward, bumps) => {
    const d = Math.hypot(dxm, dym);
    let w = Math.pow(Math.max(0, 1 - d / radius), prof.falloff);

    if (prof.directional) {
        /* الاتّجاه بالبوصلة لهذه النقطة (صفرٌ شمالاً) مقابل الريح */
        const brg = (Math.atan2(dxm, dym) * 180 / Math.PI + 360) % 360;
        const off = Math.abs(((brg - windToward + 540) % 360) - 180);
        const along = Math.cos((Math.min(off, 90) * Math.PI) / 180);
        w *= 0.4 + 0.6 * Math.max(0, along);   // انحيازٌ مع الريح مع إبقاء أثرٍ حوليّ
    }

    w *= built;

    for (const b of bumps) {
        const dd = (dxm - b.ox) ** 2 + (dym - b.oy) ** 2;
        w += b.s * Math.exp(-dd / (2 * b.sigma * b.sigma));
    }
    return w;
};

/**
 * نطاقات الشدّة — مضلّعاتٌ متدرّجةٌ متّحدة المركز، لا دوائرُ صمّاء.
 *
 * لكل اتّجاهٍ حول الحدث نقيس إلى أين تبلغ كل عتبة شدّة، فينشأ لكل
 * مستوىً مضلّعٌ يلتفّ حول الأثر الحقيقيّ: ينتفخ مع الريح في الحريق،
 * وينتفخ نحو المدرسة العامرة والمستشفى ومحطّة الوقود، ويشتدّ في
 * النسيج المبنيّ. والألوان صريحةٌ مرتّبة — الأحمر أشدّ والأصفر أخفّ —
 * فلا يلتبس التدرّج ولا ينقلب.
 *
 * ويُردّ من الأوسع (الأخفّ) إلى الأضيق (الأشدّ) كي يُرسم الأشدُّ فوق
 * غيره، فتُقرأ البؤرة بوضوح.
 */
export const impactBands = (event, places, kind, radius, { windToward = 90 } = {}, context = null) => {
    const lat0 = +event.latitude;
    const lon0 = +event.longitude;
    if (!Number.isFinite(lat0) || !Number.isFinite(lon0) || !(radius > 0)) {
        return { type: 'FeatureCollection', features: [] };
    }

    const kx = METRES_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
    const ky = METRES_PER_DEG;
    const prof = HEAT_PROFILE[kind] || HEAT_PROFILE.default;
    const built = context ? 0.6 + 0.9 * Math.min(1, context.builtShare ?? 0.5) : 1;

    const bumps = (places || []).map(p => ({
        ox: ((+p.longitude) - lon0) * kx,
        oy: ((+p.latitude) - lat0) * ky,
        s: Math.min(2.2, (((p.heads || 25) / 280) * (criticalityOf(p.category) / 6)
            * (p.occupancy?.open ? 1 : 0.35)) * prof.placePull),
        sigma: Math.max(55, Math.min(170, radius * 0.11))
    })).filter(b => b.s > 0.02);

    const SECTORS = 60;
    const RSTEPS = 44;
    const rMax = radius * 1.06;
    const rStep = rMax / RSTEPS;

    /* مسحٌ أوّل: شدّةٌ لكل اتجاهٍ ومسافة، مع أقصى شدّةٍ للتسوية */
    const grid = [];
    let peak = 0;
    for (let s = 0; s < SECTORS; s++) {
        const theta = (s / SECTORS) * Math.PI * 2;
        const ux = Math.cos(theta);
        const uy = Math.sin(theta);
        const row = [];
        for (let k = 0; k <= RSTEPS; k++) {
            const r = k * rStep;
            const w = intensityAt(r * ux, r * uy, radius, prof, built, windToward, bumps);
            row.push(w);
            if (w > peak) peak = w;
        }
        grid.push({ ux, uy, row });
    }

    if (!(peak > 0)) return { type: 'FeatureCollection', features: [] };

    /* مسحٌ ثانٍ: لكل مستوى، أبعدُ مسافةٍ تبلغها عتبتُه في كل اتجاه */
    const feats = [];
    for (let li = IMPACT_LEVELS.length - 1; li >= 0; li--) {
        const level = IMPACT_LEVELS[li];
        const thresh = level.t * peak;
        const ring = [];
        let any = false;

        for (let s = 0; s < SECTORS; s++) {
            const { ux, uy, row } = grid[s];
            let reach = 0;
            for (let k = 0; k <= RSTEPS; k++) {
                if (row[k] >= thresh) reach = k * rStep;
            }
            if (reach > 0) any = true;
            const r = Math.max(reach, rStep * 0.6);   // حدٌّ أدنى كي لا ينهار المضلّع
            ring.push([lon0 + (r * ux) / kx, lat0 + (r * uy) / ky]);
        }

        if (!any) continue;
        ring.push([...ring[0]]);   // إغلاق الحلقة
        feats.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: { level: li, color: level.color, say: level.say, t: level.t }
        });
    }

    return { type: 'FeatureCollection', features: feats };
};

/* ============================================================
   الغطاء الأرضيّ واستعمال الأرض — ربط الحدث بما على الأرض فعلاً
   ============================================================ */

/* كثافةٌ سكّانية تقديرية لكل كم² حسب الغالب — لتقدير «المحيطين» */
const AMBIENT_DENSITY = {
    'سكنيّ': 9000, 'تجاريّ': 5000, 'تجزئة': 6000, 'تعليميّ': 4000,
    'مؤسّسيّ': 3000, 'صناعيّ': 1200, 'قيد الإنشاء': 300,
    'زراعيّ': 120, 'أرض زراعية': 120, 'بستان': 100, 'مرج': 60,
    'غابة': 30, 'أرض فضاء': 150, 'عسكريّ': 200
};

/**
 * يربط الحدث بالغطاء الأرضيّ: ماذا على الأرض، وكيف يُغيّر ذلك الحدث.
 *
 * فحريقٌ في نسيجٍ تجاريٍّ كثيفٍ غيرُ حريقٍ في أرضٍ زراعية، وتجمّعٌ
 * قرب نطاقٍ تجاريّ يُفسَّر، وانقطاعٌ في حيٍّ سكنيّ يمسّ البيوت لا
 * المصانع. وكلُّ ذلك من مساحاتٍ مقيسةٍ لا من ظنّ.
 */
const landContextChain = (event, context, kind, radius, out) => {
    if (!context || !(context.coveredShare > 0.05)) return out;

    const mix = context.mix || {};
    const pct = (x) => Math.round((x || 0) * 100);
    const parts = [];
    if (mix.urban > 0.02) parts.push(`نسيج مبنيّ ${pct(mix.urban)}٪`);
    if (mix.veg > 0.02) parts.push(`غطاء نباتيّ ${pct(mix.veg)}٪`);
    if (mix.water > 0.02) parts.push(`مياه ${pct(mix.water)}٪`);
    if (mix.bare > 0.02) parts.push(`أرض مكشوفة ${pct(mix.bare)}٪`);

    /* المحيطون: تقديرٌ من الكثافة المبنيّة لا من المعالم وحدها —
       فأكثر الناس في البيوت لا في المرافق المسجّلة */
    const scopeKm2 = (Math.PI * radius * radius) / 1e6;
    const dens = AMBIENT_DENSITY[context.dominant] || 2500;
    const ambient = Math.round(scopeKm2 * (context.builtShare || 0) * dens);

    out.push(line('info',
        `الغطاء الأرضيّ: الغالب ${context.dominant || 'غير محدَّد'}`,
        `${parts.join(' · ') || 'غطاءٌ قليل التسجيل'}. الكثافة المبنيّة نحو `
        + `${pct(context.builtShare)}٪ من النطاق، فالمحيطون تقديراً نحو ${ambient.toLocaleString('ar-EG')} نسمة `
        + '(من كثافة النسيج لا من عدّادٍ حقيقيّ). والغطاء يُغيّر قراءة الحدث لا شكله فقط.',
        'OpenStreetMap landuse/natural — قياس المساحات'));

    /* الربط النوعيّ: ماذا يعني هذا الغطاء لهذا الحدث */
    const veg = mix.veg || 0;
    const urban = mix.urban || 0;
    const dom = context.dominantUse || '';

    if (kind === 'fire') {
        if (veg > 0.3) out.push(line('high',
            'الغطاء النباتيّ يرفع خطر الامتداد',
            `أكثر من ${pct(veg)}٪ غطاءٌ نباتيّ في النطاق — في الطقس الجافّ يحمل النار أفقيّاً `
            + 'أسرع من المباني. فحزام العزل يُراعى من جهة النبات أوّلاً.',
            'سلوك حرائق الغطاء النباتيّ — الامتداد السطحيّ'));
        else if (urban > 0.5) out.push(line('warn',
            'نسيجٌ مبنيّ كثيف حول الحريق',
            `${pct(urban)}٪ نسيج مبنيّ متلاصق — الحمل الحراريّ عالٍ واحتمال الامتداد بين المباني `
            + 'قائم، والإخلاء يحتاج منافذ متعدّدة.',
            'SFPE — الحمل الحراريّ في النسيج الكثيف'));
    } else if (kind === 'crowd') {
        if (dom === 'retail' || dom === 'commercial') out.push(line('info',
            'نطاقٌ تجاريّ — جاذبٌ للحشود أصلاً',
            'الغالب تجاريّ/تجزئة، وهو ما يستقطب الكثافة في ساعات الذروة. '
            + 'فتقدير الحشد يُبنى على ذلك لا على الحدث وحده.',
            'استعمال الأرض — مولّدات الرحلات'));
    } else if (kind === 'accident') {
        if (dom === 'residential') out.push(line('warn',
            'حيٌّ سكنيّ — مشاةٌ وأطفالٌ على المحكّ',
            'الغالب سكنيّ، فالمخاطرة على المشاة والأطفال أعلى من طريقٍ تجاريّ، '
            + 'وأولويّة إبطاء الحركة وتأمين المعابر.',
            'UN-Habitat — سلامة الطرق في الأحياء السكنية'));
        else if (dom === 'industrial') out.push(line('warn',
            'نطاقٌ صناعيّ — مركباتٌ ثقيلة',
            'الغالب صناعيّ، فحركة الشاحنات أعلى، وأثر فقد المسار على الإمداد أكبر.',
            'HCM — تركيب المركبات الثقيلة يخفض السعة'));
    } else if (kind === 'power') {
        if (dom === 'residential') out.push(line('info',
            'انقطاعٌ في نسيجٍ سكنيّ',
            `نحو ${ambient.toLocaleString('ar-EG')} نسمة تقديراً في النطاق السكنيّ — `
            + 'الأثر منزليّ واسع (تبريدٌ وتدفئةٌ وأجهزةٌ طبّية منزلية) لا مؤسّسيٌّ فقط.',
            'أثر الانقطاع على الأسر في النسيج السكنيّ'));
    }

    return { out, ambient };
};

/* ============================================================
   أنواع الأحداث — لكلٍّ طبيعته
   ============================================================ */

/*
 * لكل حدثٍ نموذجه ونطاقه وسلاسله ومقابضه.
 *
 * فالحريق لا يُحلَّل كحادث سير، والانقطاع لا يُحسب له إشعاع حراريّ،
 * والطارئ الطبّي كلّه زمنُ وصول. و«المقابض» هي ما يُغيّره المستخدم
 * فيختلف الناتج اختلافاً حقيقياً لا تجميليّاً.
 */
export const HAZARDS = {
    accident: {
        label: 'حادث سير',
        icon: '🚗',
        radius: 600,
        say: 'فقدُ مسارات يرفع الازدحام ويؤخّر الإسعاف',
        physics: 'سعة الطريق ومستوى الخدمة ونموّ الطابور',
        chains: ['traffic', 'access', 'people'],
        knobs: ['blockedLanes']
    },
    closure: {
        label: 'إغلاق طريق',
        icon: '🚧',
        radius: 800,
        say: 'إغلاقٌ مخطَّط يُحوّل الحركة ويُكلّف ساعات-مركبة',
        physics: 'تحويل الحركة وكلفة التأخير وأرخص نافذة تنفيذ',
        chains: ['traffic', 'planned', 'access', 'people'],
        knobs: ['blockedLanes', 'durationHours']
    },
    fire: {
        label: 'حريق',
        icon: '🔥',
        radius: 500,
        say: 'إشعاعٌ حراريّ ودخانٌ يسير مع الريح',
        physics: 'المصدر النقطي وحلقات التدفّق ونطاق العزل وممرّ الدخان',
        chains: ['fire', 'traffic', 'access', 'people'],
        knobs: ['load', 'windToward']
    },
    power: {
        label: 'انقطاع كهرباء',
        icon: '⚡',
        radius: 1200,
        say: 'تعطّل تبريدٍ وإشاراتٍ وأجهزةٍ طبّية',
        physics: 'عتبات سلسلة التبريد وفقد سعة التقاطع',
        chains: ['power', 'access', 'people'],
        knobs: ['durationHours']
    },
    crowd: {
        label: 'تجمّع كثيف',
        icon: '👥',
        radius: 400,
        say: 'ضغطٌ على المنافذ والمسارات',
        physics: 'تدفّق المشاة وقطع المسار',
        chains: ['traffic', 'access', 'people'],
        knobs: []
    },
    medical: {
        label: 'طارئ طبّي',
        icon: '🚑',
        radius: 2000,
        say: 'زمن الوصول هو كل شيء',
        physics: 'زمن السير على الشبكة مقابل حدّ NFPA 1710',
        chains: ['access', 'people'],
        knobs: []
    }
};

/* مقابض الأحداث — ما يظهر في الواجهة، ونطاق كلٍّ منها وسببه */
export const KNOBS = {
    blockedLanes: {
        label: 'مسارات مغلقة', min: 1, max: 4, step: 1, unit: 'مسار', fallback: 2,
        why: 'كل مسارٍ مغلق يُسقط سعة الطريق بمقدار سعة المسار الواحد في HCM'
    },
    durationHours: {
        label: 'مدّة الانقطاع', min: 1, max: 24, step: 1, unit: 'ساعة', fallback: 6,
        why: 'العتبات زمنية: ساعتان للّقاح وأربع للثلاجة'
    },
    windToward: {
        label: 'اتجاه الريح', min: 0, max: 345, step: 15, unit: '°', fallback: 90,
        why: 'ممرّ الدخان يتبع الريح — وتغيّرها يُغيّر من يُخلى'
    },
    load: {
        label: 'ما يحترق', options: Object.keys(FIRE_LOAD), fallback: 'building',
        why: 'القدرة بالميغاواط تُحدّد حلقات الحرارة ونطاق العزل'
    }
};

/* ============================================================
   التحليل الكامل
   ============================================================ */

/**
 * يُجري التحليل كلّه ويردّ ما يُعرض: سطورٌ مقروءة، وأشكالٌ على
 * الخريطة، ومعاييرٌ مذكورة، وأرقامٌ مجمَّعة.
 *
 * @param event     ‎{ latitude, longitude, kind, radius, hour, …مقابض }‎
 * @param landmarks معالم الخريطة
 * @param roads     شبكة الطرق من ‎OSM‎ — اختيارية، ودونها يُقال ذلك صريحاً
 */
export const analyseEvent = (event, landmarks, roads = [], greens = [], env = {}) => {
    const hazard = HAZARDS[event?.kind] || HAZARDS.accident;
    const radius = Number.isFinite(+event?.radius) ? +event.radius : hazard.radius;
    const hour = Number.isFinite(+event?.hour)
        ? ((Math.round(+event.hour) % 24) + 24) % 24
        : 8;

    const context = env?.context || null;
    const places = exposedPlaces(event, landmarks, radius, hour);
    const findings = [];
    const shapes = [];

    /* نطاق الدراسة — يُرسم في كل حالة */
    shapes.push(feature(circlePolygon(event, radius, 64), {
        layer: 'scope', tone: 'info',
        label: `نطاق الدراسة ${readable(radius)}`, radius
    }));

    for (const chain of hazard.chains) {
        if (chain === 'fire') fireChain(event, places, roads, hour, findings, shapes);
        if (chain === 'traffic') trafficChain(event, places, roads, hour, findings, shapes, event.kind);
        if (chain === 'planned') plannedChain(event, places, roads, hour, findings);
        if (chain === 'power') powerChain(event, places, roads, hour, findings, shapes);
        if (chain === 'access') accessChain(event, landmarks, radius, roads, findings);
        if (chain === 'people') peopleChain(event, places, hour, findings);
    }

    /* المساحات المفتوحة — تُفحص في كل حدثٍ له مُخلَون أو إسناد */
    openSpaceChain(event, greens, radius, event?.kind, findings);

    /* الغطاء الأرضيّ — يربط الحدث بما على الأرض فعلاً */
    const land = landContextChain(event, context, event?.kind, radius, findings);
    const ambient = land?.ambient || 0;

    const order = { high: 0, warn: 1, info: 2 };
    findings.sort((a, b) => order[a.tone] - order[b.tone]);

    const heads = places.reduce((sum, p) => sum + p.heads, 0);

    /* نطاقات الشدّة — مضلّعاتٌ متدرّجة منحازةٌ إلى المحيط الحقيقيّ */
    const impact = impactBands(
        event, places, event?.kind, radius,
        { windToward: event?.windToward }, context
    );

    return {
        hazard,
        kind: event?.kind || 'accident',
        at: { latitude: +event.latitude, longitude: +event.longitude },
        radius,
        hour,
        clock: hourLabel(hour),
        places,
        roads: (roads || []).map(describeRoad),
        findings,
        shapes: { type: 'FeatureCollection', features: shapes },
        impact,
        context,
        standards: standardsFor(hazard.chains),
        totals: {
            places: places.length,
            greens: (greens || []).filter(g => Number.isFinite(g.distance) && g.distance <= radius).length,
            lifeline: places.filter(p => p.lifeline).length,
            openNow: places.filter(p => p.occupancy.open).length,
            heads: Math.round(heads),
            ambient,
            urgent: findings.filter(f => f.tone === 'high').length,
            warn: findings.filter(f => f.tone === 'warn').length,
            worst: findings.find(f => f.tone === 'high') || null
        }
    };
};

/*
 * أوزان الشدّة ومراجعها.
 *
 * ولا يُجمع المجموع ثمّ يُضغط بـ‎tanh‎: ذاك كان يُشبع عند المئة
 * فيصير كل حدثٍ «شدّة عالية»، فلا يُفرّق بين الثامنة صباحاً
 * والثالثة فجراً إلّا بثلاث نقاط — ورقمٌ لا يُفرّق لا يُفيد.
 *
 * فيُقسَّم إلى أربعة أوجهٍ، كلٌّ منها نسبةٌ من مرجعه مقصوصةٌ عند
 * الواحد، ثمّ تُجمع بأوزانها. فالمقياس يبقى مفتوحاً في وسطه حيث
 * تُقرأ الفروق.
 */
const SEVERITY = [
    { of: 'urgent', per: 5, weight: 0.35, say: 'نتائج عاجلة' },
    { of: 'heads', per: 800, weight: 0.25, say: 'الناس في النطاق' },
    { of: 'warn', per: 5, weight: 0.20, say: 'نتائج تحذيرية' },
    { of: 'lifeline', per: 6, weight: 0.20, say: 'خدمات حياتية معرَّضة' }
];

/**
 * شدّة الحدث من نتائجه لا من حجمه.
 *
 * تُبنى على ما وقع فعلاً: النتائج العاجلة، والخدمات الحياتية
 * المعرَّضة، والناس الموجودون في تلك الساعة. فحدثٌ في ساحة فارغة
 * ليلاً شدّتُه أقلّ من مثله عند مدرسةٍ وقت الدوام — وهذا ما يجب أن
 * يظهر في الرقم، وإلّا كان الرقم زينة.
 *
 * ويُردّ مع الرقم تفصيلُه، فيُعرف من أين جاء لا أن يُقبَل مجرّداً.
 */
export const severityOfEvent = (report) => {
    if (!report) return { score: 0, band: 'low', urgent: 0, warn: 0, parts: [] };

    const parts = SEVERITY.map(part => {
        const value = report.totals[part.of] || 0;
        const share = Math.min(1, value / part.per);

        return { ...part, value, share, points: share * part.weight * 100 };
    });

    const score = Math.round(parts.reduce((sum, x) => sum + x.points, 0));

    return {
        score,
        band: score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low',
        say: score >= 65 ? 'شدّة عالية' : score >= 35 ? 'شدّة متوسّطة' : 'شدّة محدودة',
        urgent: report.totals.urgent,
        warn: report.totals.warn,
        parts
    };
};
