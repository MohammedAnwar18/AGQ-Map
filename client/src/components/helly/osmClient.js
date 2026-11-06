/* ============================================================
   عميل OpenStreetMap — مباشرةً من المتصفّح، بلا مفتاح ولا تسجيل

   صفحة Foresight عامّة يفتحها أي زائر، فلا تمرّ بنقاط الخادم
   المحميّة للأدمن. نقرأ هنا ما نحتاجه من مصادر OSM المفتوحة
   مباشرةً، وكلّها تسمح بالطلب عبر المتصفّح (CORS):

     Nominatim   ترميزٌ جغرافيّ: من وصفِ مكانٍ إلى إحداثيّات
     Overpass    كلُّ ما حول الموضع: شبكة الطرق كاملةً، واستعمالات
                 الأرض والغطاء الأرضي، والمعالم بأصنافها وأسمائها

   وأمّا الأخبار اللحظيّة فتُجلب عبر وسيطٍ عامّ في خادم المنصّة
   (‎/api/foresight/news‎) لأنّ مصادرها لا تسمح بالطلب المباشر من
   المتصفّح — والوسيط عامٌّ بلا تسجيل، فيعمل لأيّ زائر.

   وكل ما يُقرأ هنا بصيغةٍ تُغذّى مباشرةً إلى محرّك التحليل العلميّ
   (consequence.js): الطرق بالشكل الذي يتوقّعه describeRoad، والمعالم
   بمفردات الأصناف نفسها التي تعرفها جداول الامتلاء والحرج.
   ============================================================ */

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/* قاعدة واجهة المنصّة — نفس ما يستعمله بقيّة التطبيق */
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '/api';

const METRES_PER_DEG_LAT = 111320;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ============================================================
   أدوات هندسية صغيرة — كلّها في مستوٍ محلّي مسطّح يكفي للمحيط
   ============================================================ */

/* أقصر مسافة بالأمتار بين نقطة وقطعة */
const pointToSegmentM = (p, a, b) => {
    const kx = METRES_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
    const ky = METRES_PER_DEG_LAT;
    const px = p.lon * kx, py = p.lat * ky;
    const ax = a.lon * kx, ay = a.lat * ky;
    const bx = b.lon * kx, by = b.lat * ky;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const haversineM = (a, b) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const wayLengthM = (geom) => {
    let total = 0;
    for (let i = 0; i < geom.length - 1; i++) {
        const kx = METRES_PER_DEG_LAT * Math.cos((geom[i].lat * Math.PI) / 180);
        total += Math.hypot(
            (geom[i + 1].lon - geom[i].lon) * kx,
            (geom[i + 1].lat - geom[i].lat) * METRES_PER_DEG_LAT
        );
    }
    return total;
};

/* مساحة مضلّعٍ بالأمتار المربّعة — صيغة الحذّاء في مستوٍ محلّي */
const ringAreaM2 = (ring) => {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const lat0 = ring[0][1];
    const kx = METRES_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    const ky = METRES_PER_DEG_LAT;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        sum += (x1 * kx) * (y2 * ky) - (x2 * kx) * (y1 * ky);
    }
    return Math.abs(sum) / 2;
};

const centroidOf = (ring) => {
    let lat = 0, lon = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return { longitude: lon / ring.length, latitude: lat / ring.length };
};

const closeRing = (coords) => {
    if (!coords.length) return coords;
    const first = coords[0], last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) return [...coords, [first[0], first[1]]];
    return coords;
};

const parseSpeed = (raw) => {
    if (!raw) return null;
    const text = String(raw);
    const num = parseFloat(text);
    if (!Number.isFinite(num) || num <= 0) return null;
    return /mph/i.test(text) ? Math.round(num * 1.609344) : Math.round(num);
};

const parseLanes = (raw) => {
    const num = parseInt(raw, 10);
    return Number.isFinite(num) && num > 0 && num <= 12 ? num : null;
};

const baseClass = (highway) => String(highway || '').replace(/_link$/, '');

/* ============================================================
   تصنيف المعالم — من وسوم OSM إلى مفردات المحرّك العلميّ

   الأصناف هنا هي عينها مفاتيح جداول الامتلاء والحرج والخدمات
   الحياتية في hazardScience/consequence، كي تدخل الحساب مباشرة.
   ============================================================ */
const classifyPlace = (tags = {}) => {
    const a = tags.amenity;
    const h = tags.healthcare;
    if (a === 'hospital' || h === 'hospital') return 'مستشفى';
    if (a === 'clinic' || a === 'doctors' || h === 'clinic' || h === 'centre') return 'مركز طبي';
    if (a === 'pharmacy' || h === 'pharmacy') return 'صيدلية';
    if (a === 'dentist' || h === 'dentist') return 'عيادة';
    if (a === 'fuel') return 'محطة وقود';
    if (a === 'charging_station') return 'محطة وقود';
    if (a === 'school') return 'مدرسة';
    if (a === 'kindergarten') return 'حضانة';
    if (a === 'university' || a === 'college') return 'University';
    if (a === 'bank') return 'بنك';
    if (a === 'atm') return 'صراف آلي';
    if (a === 'police') return 'شرطة';
    if (a === 'fire_station') return 'دفاع مدني';
    if (a === 'townhall' || tags.office === 'government') return 'بلدية';
    if (a === 'courthouse' || a === 'post_office') return 'مرفق حكومي';
    if (a === 'marketplace') return 'سوق';
    if (a === 'bus_station') return 'محطة حافلات';
    if (a === 'restaurant' || a === 'fast_food') return 'Restaurant';
    if (a === 'cafe') return 'Cafe';
    if (a === 'place_of_worship') {
        return tags.religion === 'christian' ? 'كنيسة' : 'مسجد';
    }
    if (tags.shop === 'supermarket') return 'Supermarket';
    if (tags.shop === 'mall' || tags.shop === 'department_store') return 'مركز تسوق';
    if (tags.shop && tags.shop !== 'no' && tags.shop !== 'vacant') return 'محلّ تجاري';
    if (tags.office && tags.office !== 'no') return 'مكتب';
    if (tags.tourism === 'hotel' || tags.tourism === 'hostel' || tags.tourism === 'guest_house') return 'فندق';
    return null;
};

/* معالمُ صغيرةٌ لا تدخل الإحصاء (مقاعد، سلال، مواقف درّاجات…) */
const SKIP_AMENITY = new Set([
    'bench', 'waste_basket', 'bicycle_parking', 'drinking_water', 'fountain',
    'vending_machine', 'recycling', 'toilets', 'telephone', 'clock', 'post_box',
    'smoking_area', 'shelter', 'street_lamp', 'parking_entrance'
]);

/* ============================================================
   الطرق — كلُّ الشبكة تُقرأ، ثم تُصنَّف

   «قابلةٌ للمركبات» تدخل حساب السعة ومستوى الخدمة؛ و«مشاةٌ» تدخل
   الإخلاء والوصول؛ وما عداها غطاءٌ خطّيٌّ يُعرض لا يُحسب.
   ============================================================ */
const DRIVABLE = [
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'residential', 'unclassified', 'service', 'living_street', 'road'
];
const WALKABLE = ['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track', 'corridor', 'bridleway'];

const WALK_SAY = {
    pedestrian: 'ممرّ مشاة', footway: 'ممشى', path: 'مسلك', steps: 'درج',
    cycleway: 'مسار درّاجات', track: 'طريق ترابيّ', corridor: 'ممرّ', bridleway: 'مسلك'
};

/* ============================================================
   استعمالات الأرض والغطاء الأرضي — طبقةُ سياقٍ وتحليل

   «ماذا على الأرض» يُغيّر معنى الحدث: حريقٌ في نسيجٍ تجاريّ ليس
   كحريقٍ في أرضٍ زراعية، وحادثٌ في حيٍّ سكنيّ كثيف غيرُه في منطقةٍ
   صناعية. فنقرأ الغطاء مصنّفاً ونقيس الغالب منه مساحةً.
   ============================================================ */
const LANDUSE_RULES = {
    // نسيج مبنيّ
    residential: { say: 'سكنيّ', group: 'urban', weight: 1.0 },
    commercial: { say: 'تجاريّ', group: 'urban', weight: 1.15 },
    retail: { say: 'تجزئة', group: 'urban', weight: 1.2 },
    industrial: { say: 'صناعيّ', group: 'urban', weight: 0.9 },
    education: { say: 'تعليميّ', group: 'urban', weight: 1.1 },
    institutional: { say: 'مؤسّسيّ', group: 'urban', weight: 1.0 },
    construction: { say: 'قيد الإنشاء', group: 'bare', weight: 0.5 },
    military: { say: 'عسكريّ', group: 'urban', weight: 0.4 },
    garages: { say: 'مرائب', group: 'urban', weight: 0.4 },
    // مكشوفٌ ومعطّل
    brownfield: { say: 'أرض مهجورة', group: 'bare', weight: 0.3 },
    greenfield: { say: 'أرض فضاء', group: 'bare', weight: 0.3 },
    landfill: { say: 'مكبّ', group: 'bare', weight: 0.2 },
    quarry: { say: 'محجر', group: 'bare', weight: 0.2 },
    railway: { say: 'سكك', group: 'urban', weight: 0.5 },
    // زراعة وغطاء نباتيّ
    farmland: { say: 'أرض زراعية', group: 'veg', weight: 0.3 },
    farmyard: { say: 'حوش مزرعة', group: 'veg', weight: 0.3 },
    orchard: { say: 'بستان', group: 'veg', weight: 0.3 },
    vineyard: { say: 'كرم', group: 'veg', weight: 0.3 },
    greenhouse_horticulture: { say: 'بيوت زراعية', group: 'veg', weight: 0.3 },
    allotments: { say: 'حدائق منزلية', group: 'veg', weight: 0.4 },
    meadow: { say: 'مرج', group: 'veg', weight: 0.2 },
    grass: { say: 'مسطّح أخضر', group: 'veg', weight: 0.2 },
    forest: { say: 'غابة', group: 'veg', weight: 0.2 },
    recreation_ground: { say: 'أرض ترفيهية', group: 'veg', weight: 0.4 },
    village_green: { say: 'ساحة خضراء', group: 'veg', weight: 0.4 },
    cemetery: { say: 'مقبرة', group: 'veg', weight: 0.2 },
    // ماء
    basin: { say: 'حوض مائي', group: 'water', weight: 0.1 },
    reservoir: { say: 'خزّان', group: 'water', weight: 0.1 },
    salt_pond: { say: 'ملّاحة', group: 'water', weight: 0.1 }
};

/* الحدائق والمساحات المفتوحة (leisure) — نقاط تجمّعٍ وإخلاء */
const LEISURE_VEG = {
    park: 'حديقة عامّة', garden: 'حديقة', playground: 'ملعب أطفال',
    pitch: 'ملعب رياضي', sports_centre: 'منشأة رياضية', stadium: 'ملعب',
    nature_reserve: 'محمية طبيعية', dog_park: 'حديقة', common: 'أرض عامّة',
    golf_course: 'ملعب غولف', track: 'مضمار'
};

/* الطبيعة (natural) — غطاءٌ نباتيّ أو مائيّ */
const NATURAL_RULES = {
    wood: { say: 'حرج', group: 'veg' }, scrub: { say: 'أرض شُجَيرية', group: 'veg' },
    grassland: { say: 'مرج', group: 'veg' }, heath: { say: 'أرض عشبية', group: 'veg' },
    water: { say: 'مسطّح مائي', group: 'water' }, wetland: { say: 'أرض رطبة', group: 'water' },
    bare_rock: { say: 'صخر مكشوف', group: 'bare' }, sand: { say: 'رمال', group: 'bare' },
    scree: { say: 'حصى', group: 'bare' }
};

/* يصنّف مضلّعاً إلى غطاءٍ أرضيّ — من أيّ وسمٍ حمله */
const classifyCover = (tags = {}) => {
    if (tags.leisure && LEISURE_VEG[tags.leisure]) {
        return { say: LEISURE_VEG[tags.leisure], group: 'veg', use: tags.leisure, weight: 0.4 };
    }
    if (tags.landuse && LANDUSE_RULES[tags.landuse]) {
        return { ...LANDUSE_RULES[tags.landuse], use: tags.landuse };
    }
    if (tags.natural && NATURAL_RULES[tags.natural]) {
        return { ...NATURAL_RULES[tags.natural], use: tags.natural, weight: 0.2 };
    }
    if (tags.waterway || tags.natural === 'bay') return { say: 'مجرى مائي', group: 'water', use: 'waterway', weight: 0.1 };
    if (tags.amenity === 'parking') return { say: 'موقف سيّارات', group: 'bare', use: 'parking', weight: 0.5 };
    return null;
};

/* ============================================================
   Overpass — طلبٌ واحد يجلب كلّ المحيط، مع مهلةٍ صارمة

   المشكلة الأقدم كانت أنّ الطلب قد «يُعلَّق» بلا نهاية فيبقى
   المؤشّر يقول «يقرأ…» ولا يجيء شيء. فلكلّ خادمٍ هنا مهلةٌ من
   جانب المتصفّح (لا من الخادم وحده)، وإن تأخّر انتُقل إلى التالي.
   ============================================================ */

const runOverpass = async (query, signal, perTryMs = 20000) => {
    let lastError;
    for (const endpoint of OVERPASS_ENDPOINTS) {
        /* مهلةٌ محلّية لكل خادم — تُجهض الطلب المعلَّق فلا يبقى عالقاً */
        const local = new AbortController();
        const timer = setTimeout(() => local.abort(), perTryMs);
        const onAbort = () => local.abort();
        if (signal) {
            if (signal.aborted) { clearTimeout(timer); throw new DOMException('aborted', 'AbortError'); }
            signal.addEventListener('abort', onAbort, { once: true });
        }
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`,
                signal: local.signal
            });
            if (res.ok) {
                const data = await res.json();
                return data;
            }
            lastError = new Error(`Overpass ${res.status}`);
        } catch (e) {
            /* إلغاءٌ من المستخدم (تغيير الموضع) يُنهي كلّ شيء فوراً */
            if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
            lastError = e; // مهلةٌ محلّية أو خطأ شبكة — جرّب الخادم التالي
        } finally {
            clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onAbort);
        }
    }
    throw lastError || new Error('تعذّر الوصول إلى OpenStreetMap');
};

/**
 * يقرأ كلَّ محيط الموضع من OpenStreetMap في طلبٍ واحد.
 *
 * @returns {{
 *   at, radius,
 *   roads,   // طرقٌ قابلة للمركبات — بالشكل الذي يتوقّعه describeRoad
 *   walk,    // ممرّات مشاةٍ ومسالك — للإخلاء والوصول
 *   places,  // معالمُ بمفردات الأصناف العربية
 *   greens,  // مساحاتٌ خضراء/مائية — نقاط تجمّعٍ وإخلاء
 *   cover,   // مضلّعات الغطاء الأرضيّ مصنّفةً للعرض
 *   context, // خلاصة الغطاء: الغالب ونسب المزيج والكثافة المبنيّة
 *   counts
 * }}
 */
export const readSurroundings = async (lat, lon, radius = 600, { signal } = {}) => {
    const r = clamp(Math.round(radius), 150, 1500);
    const at = { latitude: Number(lat), longitude: Number(lon) };
    const g = `${r},${at.latitude.toFixed(6)},${at.longitude.toFixed(6)}`;

    /* نطلب ما يُفيد التحليل مُرشَّحاً — لا كلَّ وسمٍ في الأرض: شبكة
       الطرق (مركبات ومشاة)، والمعالم ذات الأثر، واستعمالات الأرض
       والطبيعة. والترشيح يُخفّف الحمولة فيعود الطلب أسرعَ وأوثق —
       وكان الطلب غير المرشَّح سببَ تأخّره حتى لا تظهر الطرق.
       مخرجٌ واحدٌ ‎geom‎: العُقَد تحمل إحداثيّها، والطرق والمضلّعات
       تحمل هندستها، ونحسب المراكز بأنفسنا */
    const roadRe = '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|road|pedestrian|footway|path|steps|cycleway|track)(_link)?$';
    const amenityRe = '^(hospital|clinic|doctors|dentist|pharmacy|fuel|charging_station|school|kindergarten|university|college|bank|atm|police|fire_station|townhall|courthouse|post_office|marketplace|bus_station|restaurant|fast_food|cafe|place_of_worship|parking|hotel)$';
    const query = `[out:json][timeout:22];
(
  way(around:${g})["highway"~"${roadRe}"];
  nwr(around:${g})["amenity"~"${amenityRe}"];
  nwr(around:${g})["shop"];
  nwr(around:${g})["office"="government"];
  nwr(around:${g})["healthcare"];
  nwr(around:${g})["tourism"~"^(hotel|hostel|guest_house|attraction|museum)$"];
  way(around:${g})["leisure"];
  way(around:${g})["landuse"];
  way(around:${g})["natural"];
);
out tags geom 2500;`;

    const data = await runOverpass(query, signal);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const roadMerge = new Map();
    const walk = [];
    const places = [];
    const greens = [];
    const cover = [];
    const seenPlace = new Set();
    const coverArea = {};      // مساحة كل غطاء
    const coverGroupArea = { urban: 0, veg: 0, water: 0, bare: 0 };
    let urbanWeighted = 0;     // مساحةٌ مبنيّة موزونة — لتقدير الكثافة

    for (const el of elements) {
        const tags = el.tags || {};
        const geom = Array.isArray(el.geometry)
            ? el.geometry.filter(p => p && Number.isFinite(p.lat))
            : [];

        /* ── طريق (قابل للمركبات) ── */
        if (tags.highway && DRIVABLE.includes(baseClass(tags.highway)) && geom.length >= 2) {
            const cls = baseClass(tags.highway);
            const name = tags.name || tags['name:ar'] || null;
            const key = name ? `${name}::${cls}` : `way::${el.id}`;

            let near = Infinity;
            for (let i = 0; i < geom.length - 1; i++) {
                const d = pointToSegmentM({ lat: at.latitude, lon: at.longitude }, geom[i], geom[i + 1]);
                if (d < near) near = d;
            }

            const coords = geom.map(p => [p.lon, p.lat]);
            const piece = {
                id: el.id, name, highway: cls,
                lanes: parseLanes(tags.lanes),
                maxspeed: parseSpeed(tags.maxspeed),
                oneway: tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === '-1',
                length: wayLengthM(geom),
                distance: near,
                coords
            };

            const found = roadMerge.get(key);
            if (!found) {
                roadMerge.set(key, { ...piece, lines: [coords] });
            } else {
                found.distance = Math.min(found.distance, piece.distance);
                found.length += piece.length;
                found.lanes = Math.max(found.lanes || 0, piece.lanes || 0) || null;
                found.maxspeed = Math.max(found.maxspeed || 0, piece.maxspeed || 0) || null;
                found.oneway = found.oneway && piece.oneway;
                found.lines.push(coords);
            }
            continue;
        }

        /* ── ممرّ مشاة ── */
        if (tags.highway && WALKABLE.includes(baseClass(tags.highway)) && geom.length >= 2) {
            let near = Infinity;
            for (let i = 0; i < geom.length - 1; i++) {
                const d = pointToSegmentM({ lat: at.latitude, lon: at.longitude }, geom[i], geom[i + 1]);
                if (d < near) near = d;
            }
            walk.push({
                id: `w${el.id}`,
                name: tags.name || null,
                say: WALK_SAY[baseClass(tags.highway)] || 'ممشى',
                distance: Math.round(near),
                lines: [geom.map(p => [p.lon, p.lat])]
            });
            continue;
        }

        /* ── غطاءٌ أرضيّ (مضلّع) ── */
        const coverDef = classifyCover(tags);
        if (coverDef && geom.length >= 3) {
            const ring = closeRing(geom.map(p => [p.lon, p.lat]));
            const c = centroidOf(ring);
            const areaM2 = ringAreaM2(ring);
            const dist = haversineM(at, c);
            const item = {
                id: `c${el.id}`,
                name: tags.name || tags['name:ar'] || null,
                use: coverDef.use, say: coverDef.say, group: coverDef.group,
                latitude: c.latitude, longitude: c.longitude,
                distance: dist, areaM2, ring
            };
            cover.push(item);

            /* تجميع المساحات — داخل النطاق فقط كي يصدق الغالب */
            if (dist <= r + Math.sqrt(areaM2)) {
                coverArea[coverDef.use] = (coverArea[coverDef.use] || 0) + areaM2;
                coverGroupArea[coverDef.group] = (coverGroupArea[coverDef.group] || 0) + areaM2;
                if (coverDef.group === 'urban') urbanWeighted += areaM2 * (coverDef.weight || 1);
            }

            /* الخضراء/المائية تبقى طبقةً مستقلّة للتحليل والعرض */
            if (coverDef.group === 'veg' || coverDef.group === 'water') {
                greens.push({
                    id: `g${el.id}`,
                    name: tags.name || tags['name:ar'] || null,
                    cls: coverDef.use || 'green',
                    group: coverDef.group,
                    say: coverDef.say,
                    latitude: c.latitude, longitude: c.longitude,
                    distance: dist, ring
                });
            }
            /* ليست «continue»: بعض المضلّعات معلمٌ أيضاً (مثلاً جامعة) */
        }

        /* ── معلم ── */
        if (SKIP_AMENITY.has(tags.amenity)) continue;
        const category = classifyPlace(tags);
        if (category) {
            let plat = el.lat ?? el.center?.lat;
            let plon = el.lon ?? el.center?.lon;
            if ((!Number.isFinite(plat) || !Number.isFinite(plon)) && geom.length) {
                const c = centroidOf(geom.map(p => [p.lon, p.lat]));
                plat = c.latitude; plon = c.longitude;
            }
            if (!Number.isFinite(plat) || !Number.isFinite(plon)) continue;
            const name = tags.name || tags['name:ar'] || null;
            const dedupe = `${category}:${Math.round(plat * 3000)}:${Math.round(plon * 3000)}`;
            if (seenPlace.has(dedupe)) continue;
            seenPlace.add(dedupe);
            places.push({
                id: `osm-${el.type}-${el.id}`,
                name: name || category,
                category,
                latitude: Number(plat),
                longitude: Number(plon),
                source: 'osm'
            });
        }
    }

    /* المركز: وسط أطول خطّ في كل طريق — لرسم الوسم عليه */
    const roads = [...roadMerge.values()].map(road => {
        const longest = road.lines.reduce((a, b) => (b.length > a.length ? b : a), road.lines[0]);
        const mid = longest[Math.floor(longest.length / 2)];
        return {
            ...road,
            coords: undefined,
            centre: { longitude: mid[0], latitude: mid[1] },
            distance: Math.round(road.distance),
            length: Math.round(road.length)
        };
    }).sort((a, b) => a.distance - b.distance).slice(0, 120);

    greens.sort((a, b) => a.distance - b.distance);
    cover.sort((a, b) => a.distance - b.distance);
    walk.sort((a, b) => a.distance - b.distance);

    /* خلاصة الغطاء الأرضيّ: الغالب مساحةً، ونِسَب المزيج، وتقدير
       الكثافة المبنيّة من نصيب النسيج المبنيّ من دائرة النطاق */
    const totalCover = Object.values(coverGroupArea).reduce((a, b) => a + b, 0);
    const scopeArea = Math.PI * r * r;
    const dominantUse = Object.entries(coverArea).sort((a, b) => b[1] - a[1])[0];
    const context = {
        dominant: dominantUse ? (LANDUSE_RULES[dominantUse[0]]?.say || LEISURE_VEG[dominantUse[0]] || NATURAL_RULES[dominantUse[0]]?.say || dominantUse[0]) : null,
        dominantUse: dominantUse ? dominantUse[0] : null,
        mix: {
            urban: totalCover ? coverGroupArea.urban / totalCover : 0,
            veg: totalCover ? coverGroupArea.veg / totalCover : 0,
            water: totalCover ? coverGroupArea.water / totalCover : 0,
            bare: totalCover ? coverGroupArea.bare / totalCover : 0
        },
        builtShare: clamp(urbanWeighted / scopeArea, 0, 1),
        coveredShare: clamp(totalCover / scopeArea, 0, 1)
    };

    const counts = {};
    for (const p of places) counts[p.category] = (counts[p.category] || 0) + 1;

    return {
        at, radius: r,
        roads,
        walk: walk.slice(0, 120),
        places,
        greens: greens.slice(0, 160),
        cover: cover.slice(0, 220),
        context,
        counts
    };
};

/* ============================================================
   الترميز الجغرافيّ — من وصفِ مكانٍ إلى إحداثيّات (Nominatim)
   ============================================================ */

export const geocode = async (text, { limit = 6, signal } = {}) => {
    const q = String(text || '').trim();
    if (q.length < 2) return [];
    const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&accept-language=ar&limit=${limit}&q=${encodeURIComponent(q)}`;
    try {
        const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        return (Array.isArray(data) ? data : []).map(item => {
            const a = item.address || {};
            const short = [a.neighbourhood, a.suburb, a.city || a.town || a.village, a.state]
                .filter(Boolean).slice(0, 3).join('، ');
            return {
                name: short || item.display_name,
                full: item.display_name,
                latitude: Number(item.lat),
                longitude: Number(item.lon),
                kind: item.type || item.category || null,
                city: a.city || a.town || a.village || a.municipality || a.county || a.state || null
            };
        }).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    } catch {
        return [];
    }
};

/* ترميزٌ عكسيّ خفيف: من إحداثيّةٍ إلى اسمِ مكانٍ مقروء */
export const reverseGeocode = async (lat, lon, { signal } = {}) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ar&lat=${lat}&lon=${lon}`;
        const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
        if (!res.ok) return null;
        const item = await res.json();
        const a = item.address || {};
        const short = [a.neighbourhood, a.suburb, a.city || a.town || a.village]
            .filter(Boolean).slice(0, 2).join('، ');
        return {
            name: short || item.display_name || null,
            full: item.display_name || null,
            city: a.city || a.town || a.village || a.municipality || a.state || null
        };
    } catch {
        return null;
    }
};

/* ============================================================
   فهم الحدث من وصفه — استدلال النوع من كلماتٍ دالّة

   المستخدم يصف الحدث بلغته، فنستدلّ نوعه من كلماتٍ مفتاحية.
   ليس تخميناً نهائياً: يُقترح والمستخدم يُصحّح بنقرةٍ على النوع.
   ============================================================ */
const KIND_HINTS = [
    { kind: 'fire', words: ['حريق', 'حرائق', 'نار', 'اشتعال', 'اشتعل', 'دخان', 'لهب', 'احتراق', 'fire', 'smoke', 'blaze'] },
    { kind: 'power', words: ['كهرباء', 'كهربائي', 'انقطاع التيار', 'انقطاع الكهرباء', 'تيار', 'فصل الكهرباء', 'عتمة', 'power', 'outage', 'blackout'] },
    { kind: 'closure', words: ['إغلاق', 'اغلاق', 'سكر الشارع', 'سكروا', 'مغلق', 'حاجز', 'اغلق', 'صيانة', 'أعمال', 'closure', 'roadblock', 'closed'] },
    { kind: 'crowd', words: ['تجمّع', 'تجمع', 'ازدحام', 'حشد', 'مظاهرة', 'مسيرة', 'زحمة', 'مهرجان', 'فعالية', 'crowd', 'rally', 'gathering', 'protest'] },
    { kind: 'medical', words: ['إسعاف', 'اسعاف', 'طبي', 'طبيّ', 'إصابة', 'اصابة', 'مريض', 'جريح', 'إغماء', 'medical', 'ambulance', 'injury'] },
    { kind: 'accident', words: ['حادث', 'تصادم', 'اصطدام', 'دهس', 'انقلاب', 'حادثة', 'accident', 'crash', 'collision'] }
];

export const inferKind = (text) => {
    const t = String(text || '').toLowerCase();
    for (const hint of KIND_HINTS) {
        if (hint.words.some(w => t.includes(w.toLowerCase()))) return hint.kind;
    }
    return null;
};

/* ============================================================
   الأخبار اللحظيّة — عبر وسيط المنصّة العامّ (بلا مفتاح)

   مصادر الأخبار لا تسمح بالطلب المباشر من المتصفّح، فنمرّ بوسيطٍ
   عامٍّ في الخادم يجلبها من GDELT ويردّها منسّقة. فالصفحة تبقى
   «حيّةً»: ما يقع الآن قربَ الموضع يظهر مع التحليل لا منفصلاً عنه.
   ============================================================ */
export const fetchNews = async (q, { kind = null, city = null, signal, limit = 10 } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', String(q).slice(0, 120));
    if (city) params.set('city', String(city).slice(0, 80));
    if (kind) params.set('kind', kind);
    params.set('limit', String(limit));
    try {
        const res = await fetch(`${API_BASE}/foresight/news?${params.toString()}`, {
            signal, headers: { Accept: 'application/json' }
        });
        if (!res.ok) return { articles: [], ok: false, reason: `HTTP ${res.status}` };
        const data = await res.json();
        return {
            ok: true,
            articles: Array.isArray(data?.articles) ? data.articles : [],
            query: data?.query || q,
            source: data?.source || 'GDELT'
        };
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return { articles: [], ok: false, reason: 'تعذّر الوصول إلى خدمة الأخبار' };
    }
};

/* ============================================================
   الموجز الذكيّ — تحليلٌ مسنودٌ بالبحث الحيّ (Gemini + Google Search)

   وسيطٌ في الخادم يستدعي نموذجاً ذكيّاً مزوّداً بالبحث: يفهم الحدث
   ومكانه، ويجلب ما يتّصل به من مصادرَ حيّة، ويربطه بموضع الوقوع
   والسيناريو — فيردّ موجزاً عربيّاً مع مصادره الموثّقة. والمفتاح
   يبقى في الخادم لا في المتصفّح، فلا يُكشف لكل زائر.
   ============================================================ */
export const fetchBrief = async (payload, { signal } = {}) => {
    try {
        const res = await fetch(`${API_BASE}/foresight/brief`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload || {}),
            signal
        });
        if (!res.ok) return { ok: false, brief: null, sources: [], reason: `HTTP ${res.status}` };
        const data = await res.json();
        return {
            ok: data?.ok !== false,
            brief: data?.brief || null,
            sources: Array.isArray(data?.sources) ? data.sources : [],
            model: data?.model || null,
            reason: data?.reason || null
        };
    } catch (e) {
        if (e?.name === 'AbortError') throw e;
        return { ok: false, brief: null, sources: [], reason: 'تعذّر الوصول إلى خدمة التحليل الذكيّ' };
    }
};

export default { readSurroundings, geocode, reverseGeocode, inferKind, fetchNews, fetchBrief };
