/* ============================================================
   قراءة GeoJSON إلى محلّات

   الملفّ يأتي من ‎QGIS‎ أو ‎OSM‎ أو ‎ArcGIS‎، فيحمل أشكالاً مختلفة:
   نقاطاً ومضلّعات وخطوطاً، وأسماءً في خصائص لا تتّفق على اسم واحد،
   وربّما إحداثيات مسقطة بالأمتار.

   والمحلّ على خريطتنا نقطةٌ واحدة بخطّ طول وعرض. فمهمّة هذا الملفّ
   أن يُخرج من أي شكلٍ نقطةً تمثّله، ومن أي خصائصَ اسماً وتصنيفاً
   مقترحاً — ثمّ يُراجع الأدمن ويُصحّح.

   وكل ما هنا خالص: لا شبكة ولا ‎DOM‎. ما يُحسب هنا هو ما إن أخطأ
   وُضع المعلم في مكان آخر، فيُختبَر وحده.
   ============================================================ */

/* حدود الدرجات. ما خرج عنها ليس خطّ طول وعرض — غالباً أمتار مسقطة */
const MAX_LON = 180;
const MAX_LAT = 90;

/** هل يبدو الزوج إحداثياتٍ مسقطة بالأمتار لا درجات؟ */
export const looksProjected = (x, y) =>
    Math.abs(x) > MAX_LON || Math.abs(y) > MAX_LAT;

/* ============================================================
   النقطة الممثّلة للشكل
   ============================================================ */

const isPair = (c) => Array.isArray(c) && Number.isFinite(+c[0]) && Number.isFinite(+c[1]);

/**
 * مركز مضلّع موزون بالمساحة.
 *
 * لا مركز المستطيل المحيط: مضلّع على شكل حرف ‎L‎ مركزُ محيطه يقع
 * خارجه. والموزون بالمساحة هو مركز ثقل الشكل، وهو الصحيح لمسقط
 * مبنى — وهو ما يأتي في هذه الملفّات عادةً.
 *
 * وحين تكون المساحة صفراً — حلقة منهارة على خطّ — نرجع إلى متوسّط
 * الرؤوس، فلا قسمة على صفر ولا نقطة معدومة.
 */
export const ringCentroid = (ring) => {
    const pts = (ring || []).filter(isPair);
    if (!pts.length) return null;
    if (pts.length < 3) return meanOf(pts);

    let twiceArea = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];

        const cross = x1 * y2 - x2 * y1;
        twiceArea += cross;
        cx += (x1 + x2) * cross;
        cy += (y1 + y2) * cross;
    }

    if (Math.abs(twiceArea) < 1e-12) return meanOf(pts);

    return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
};

const meanOf = (pts) => {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of pts) { sx += x; sy += y; }
    return [sx / pts.length, sy / pts.length];
};

/**
 * هل النقطة داخل الحلقة؟ — رمي شعاع.
 *
 * شعاع أفقيّ إلى ما لا نهاية، وعدّ ما يقطعه من أضلاع: فردٌ يعني
 * داخلاً وزوجٌ يعني خارجاً.
 */
export const pointInRing = ([x, y], ring) => {
    const pts = (ring || []).filter(isPair);
    if (pts.length < 3) return false;

    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];

        if ((yi > y) !== (yj > y)
            && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
};

/**
 * نقطة مضمونة داخل الحلقة.
 *
 * مركز الثقل صحيح رياضياً ويقع خارج الشكل المقعّر: مضلّع على شكل
 * حرف ‎L‎ مركزه ‎(2.2, 2.2)‎ وهو في التجويف — أي على المبنى المجاور
 * أو في الساحة. وعلامةُ محلٍّ في غير مبناه عطبٌ يُرى.
 *
 * فإن وقع المركز خارجاً، نقطع الحلقة بخطّ أفقيّ عند ارتفاعه ونأخذ
 * منتصف أوسع فجوة داخلية. وهي طريقة وسم المضلّعات المعروفة: تضمن
 * نقطةً داخل الشكل، وتختار أعرض موضع فيه عند ذلك الارتفاع.
 */
export const insidePoint = (ring) => {
    const centre = ringCentroid(ring);
    if (!centre) return null;

    const pts = (ring || []).filter(isPair);
    if (pts.length < 3) return centre;
    if (pointInRing(centre, pts)) return centre;

    const y = centre[1];

    // مواضع قطع الخطّ الأفقيّ للأضلاع
    const cuts = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];

        if ((yi > y) !== (yj > y)) {
            cuts.push(xi + ((xj - xi) * (y - yi)) / (yj - yi));
        }
    }

    if (cuts.length < 2) return centre;
    cuts.sort((a, b) => a - b);

    /* الفجوات بالتناوب: من الأولى إلى الثانية داخلٌ، ومن الثانية
       إلى الثالثة خارجٌ، وهكذا. فنأخذ أوسع فجوة زوجية الفهرس */
    let bestMid = centre[0];
    let bestSpan = -1;

    for (let i = 0; i + 1 < cuts.length; i += 2) {
        const span = cuts[i + 1] - cuts[i];
        if (span > bestSpan) {
            bestSpan = span;
            bestMid = (cuts[i] + cuts[i + 1]) / 2;
        }
    }

    return bestSpan > 0 ? [bestMid, y] : centre;
};

/** مساحة حلقة بالقيمة المطلقة — لاختيار أكبر مضلّع في المتعدّد */
const ringArea = (ring) => {
    const pts = (ring || []).filter(isPair);
    if (pts.length < 3) return 0;

    let twice = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        twice += x1 * y2 - x2 * y1;
    }
    return Math.abs(twice) / 2;
};

/** منتصف خطّ بطوله — لا منتصف رؤوسه */
const lineMidpoint = (coords) => {
    const pts = (coords || []).filter(isPair);
    if (!pts.length) return null;
    if (pts.length === 1) return pts[0];

    const spans = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
        const span = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        spans.push(span);
        total += span;
    }
    if (total === 0) return pts[0];

    let walked = 0;
    for (let i = 0; i < spans.length; i++) {
        if (walked + spans[i] >= total / 2) {
            const t = spans[i] > 0 ? (total / 2 - walked) / spans[i] : 0;
            return [
                pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
            ];
        }
        walked += spans[i];
    }
    return pts[pts.length - 1];
};

/**
 * نقطة تمثّل أي شكل.
 *
 * @returns ‎[lng, lat]‎ بترتيب ‎GeoJSON‎ — الطول قبل العرض
 */
export const pointOf = (geometry, depth = 0) => {
    if (!geometry || depth > 4) return null;

    const { type, coordinates } = geometry;

    switch (type) {
        case 'Point':
            return isPair(coordinates) ? [+coordinates[0], +coordinates[1]] : null;

        case 'MultiPoint': {
            const first = (coordinates || []).find(isPair);
            return first ? [+first[0], +first[1]] : null;
        }

        case 'LineString':
            return lineMidpoint(coordinates);

        case 'MultiLineString': {
            // أطول خطّ هو الأدلّ على الشكل
            const lines = (coordinates || []).filter(Array.isArray);
            if (!lines.length) return null;
            const longest = lines.reduce((best, line) => (
                line.length > (best?.length || 0) ? line : best
            ), null);
            return lineMidpoint(longest);
        }

        case 'Polygon':
            // الحلقة الأولى هي الخارجية، وما بعدها ثقوب
            return insidePoint((coordinates || [])[0]);

        case 'MultiPolygon': {
            const polys = (coordinates || []).filter(Array.isArray);
            if (!polys.length) return null;

            // أكبر مضلّع مساحةً: الباقي أجنحة صغيرة لا تمثّل المعلم
            let best = null;
            let bestArea = -1;
            for (const poly of polys) {
                const area = ringArea(poly[0]);
                if (area > bestArea) { bestArea = area; best = poly[0]; }
            }
            return insidePoint(best);
        }

        case 'GeometryCollection': {
            for (const inner of (geometry.geometries || [])) {
                const found = pointOf(inner, depth + 1);
                if (found) return found;
            }
            return null;
        }

        default:
            return null;
    }
};

/* ============================================================
   الاسم والتصنيف
   ============================================================ */

/* مفاتيح الاسم بترتيب الأفضلية. العربيّ أوّلاً لأنّ الواجهة عربية */
const NAME_KEYS = [
    'name:ar', 'name_ar', 'arabic_name', 'الاسم',
    'name', 'Name', 'NAME', 'title', 'label',
    'name:en', 'name_en', 'shop_name', 'brand'
];

export const guessName = (props) => {
    if (!props) return '';

    for (const key of NAME_KEYS) {
        const value = props[key];
        if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 200);
        if (typeof value === 'number') return String(value);
    }
    return '';
};

/*
 * وسوم ‎OSM‎ إلى تصنيفاتنا.
 *
 * أكثر ملفّات ‎GeoJSON‎ هنا مُصدَّرة من ‎OpenStreetMap‎، فوسومها
 * معروفة. والمقترح يوفّر على الأدمن اختيار التصنيف مئة مرّة — وهو
 * اقتراح يُراجَع لا حكمٌ يُنفَّذ.
 */
const TAG_MAP = {
    'amenity=fuel': 'محطة وقود',
    'amenity=pharmacy': 'صيدلية',
    'amenity=hospital': 'مستشفى',
    'amenity=clinic': 'عيادة',
    'amenity=doctors': 'عيادة',
    'amenity=restaurant': 'Restaurant',
    'amenity=fast_food': 'Restaurant',
    'amenity=cafe': 'Cafe',
    'amenity=bank': 'بنك',
    'amenity=atm': 'صراف آلي',
    'amenity=school': 'مدرسة',
    'amenity=college': 'مدرسة',
    'amenity=university': 'University',
    'amenity=library': 'مكتبة',
    'amenity=place_of_worship': 'مسجد',
    'amenity=grave_yard': 'مقبرة',
    'amenity=townhall': 'بلدية',
    'shop=supermarket': 'Supermarket',
    'shop=convenience': 'Supermarket',
    'shop=clothes': 'Clothing',
    'shop=shoes': 'احذية',
    'shop=electronics': 'Electronics',
    'shop=mobile_phone': 'Electronics',
    'shop=bakery': 'معجنات',
    'shop=pastry': 'حلويات',
    'shop=confectionery': 'حلويات',
    'shop=hairdresser': 'صالون رجالي',
    'shop=mall': 'مركز تسوق',
    'shop=books': 'مكتبة',
    'leisure=park': 'حديقة',
    'leisure=garden': 'حديقة',
    'leisure=pitch': 'ملعب',
    'leisure=stadium': 'ملعب',
    'leisure=fitness_centre': 'نادي رياضي',
    'tourism=hotel': 'فندق',
    'tourism=museum': 'مركز ثقافي',
    'landuse=cemetery': 'مقبرة',
    'office=government': 'وزارة',
    'highway=mini_roundabout': 'دوار',
    'junction=roundabout': 'دوار'
};

/* قيَم يكتبها الناس في حقل ‎category‎ أو ‎type‎ بلا وسوم ‎OSM‎ */
const WORD_MAP = {
    'fuel': 'محطة وقود', 'gas': 'محطة وقود', 'gas station': 'محطة وقود',
    'petrol': 'محطة وقود', 'كازية': 'محطة وقود', 'محطة وقود': 'محطة وقود',
    'بنزين': 'محطة وقود',
    'pharmacy': 'صيدلية', 'صيدلية': 'صيدلية',
    'restaurant': 'Restaurant', 'مطعم': 'Restaurant',
    'cafe': 'Cafe', 'مقهى': 'Cafe', 'كافيه': 'Cafe',
    'bank': 'بنك', 'بنك': 'بنك',
    'hospital': 'مستشفى', 'مستشفى': 'مستشفى',
    'school': 'مدرسة', 'مدرسة': 'مدرسة',
    'mosque': 'مسجد', 'مسجد': 'مسجد',
    'church': 'كنيسة', 'كنيسة': 'كنيسة',
    'park': 'حديقة', 'حديقة': 'حديقة',
    'hotel': 'فندق', 'فندق': 'فندق',
    'supermarket': 'Supermarket', 'سوبرماركت': 'Supermarket'
};

export const guessCategory = (props, fallback = 'General') => {
    if (!props) return fallback;

    // وسوم ‎OSM‎ أدقّ من الكلمات الحرّة، فتُفحص أوّلاً
    for (const [pair, category] of Object.entries(TAG_MAP)) {
        const [key, want] = pair.split('=');
        const got = props[key];
        if (typeof got === 'string' && got.trim().toLowerCase() === want) return category;
    }

    for (const key of ['category', 'type', 'kind', 'class', 'التصنيف', 'النوع']) {
        const value = props[key];
        if (typeof value !== 'string') continue;

        const word = value.trim().toLowerCase();
        if (WORD_MAP[word]) return WORD_MAP[word];
    }

    return fallback;
};

/* ============================================================
   الملفّ كلّه
   ============================================================ */

/** مرجع الإحداثيات إن ذكره الملفّ — وهو عضو مهجور لكنّه يرد */
export const crsOf = (data) => {
    const named = data?.crs?.properties?.name;
    if (typeof named !== 'string') return null;

    // ‎urn:ogc:def:crs:EPSG::32636‎ أو ‎EPSG:32636‎
    const found = /(\d{4,6})\s*$/.exec(named.trim());
    return found ? `EPSG:${found[1]}` : named.trim();
};

/**
 * يقرأ نصّ الملفّ ويُخرج معالم جاهزة للمراجعة.
 *
 * ولا يرفض الملفّ لأنّ معلماً واحداً فيه فاسد: ما صحّ يُعاد وما فسد
 * يُذكر سببه. فمن صدّر ألف معلم وفيها ثلاثة بلا هندسة يستحقّ
 * التسعمئة وسبعة والتسعين.
 */
export const readGeoJson = (text) => {
    let data;
    try {
        data = JSON.parse(text);
    } catch (error) {
        return { error: 'الملفّ ليس JSON صالحاً' };
    }

    if (!data || typeof data !== 'object') return { error: 'الملفّ فارغ' };

    const raw = data.type === 'FeatureCollection'
        ? (Array.isArray(data.features) ? data.features : [])
        : data.type === 'Feature'
            ? [data]
            : data.type
                ? [{ type: 'Feature', geometry: data, properties: {} }]
                : [];

    if (!raw.length) return { error: 'لا معالم في الملفّ' };

    const crs = crsOf(data);
    const items = [];
    const problems = [];
    let projected = 0;

    raw.forEach((feature, at) => {
        const geometry = feature?.geometry || (feature?.type && feature?.coordinates ? feature : null);
        const spot = pointOf(geometry);

        if (!spot) {
            problems.push({ at, why: 'بلا هندسة مفهومة' });
            return;
        }

        const [lng, lat] = spot;

        if (looksProjected(lng, lat)) {
            projected += 1;
            problems.push({ at, why: 'إحداثيات تبدو مسقطة بالأمتار لا درجات' });
            return;
        }

        const props = feature?.properties || {};

        items.push({
            key: `g${at}`,
            name: guessName(props),
            category: guessCategory(props),
            latitude: +lat.toFixed(7),
            longitude: +lng.toFixed(7),
            kind: geometry.type,
            props
        });
    });

    return {
        items,
        problems,
        crs,
        projected,
        total: raw.length
    };
};
