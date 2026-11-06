/* ============================================================
   عميل OpenStreetMap — مباشرةً من المتصفّح، بلا مفتاح ولا تسجيل

   صفحة Foresight عامّة يفتحها أي زائر، فلا تمرّ بنقاط الخادم
   المحميّة للأدمن. نقرأ هنا ما نحتاجه من مصادر OSM المفتوحة
   مباشرةً، وكلّها تسمح بالطلب عبر المتصفّح (CORS):

     Nominatim   ترميزٌ جغرافيّ: من وصفِ مكانٍ إلى إحداثيّات
     Overpass    ما حول الموضع: شبكة الطرق، المساحات الخضراء،
                 والمعالم بأصنافها وأسمائها

   وكل ما يُقرأ هنا بصيغةٍ تُغذّى مباشرةً إلى محرّك التحليل العلميّ
   (consequence.js): الطرق بالشكل الذي يتوقّعه describeRoad، والمعالم
   بمفردات الأصناف نفسها التي تعرفها جداول الامتلاط والحرج.
   ============================================================ */

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const METRES_PER_DEG_LAT = 111320;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* أقصر مسافة بالأمتار بين نقطة وقطعة — في مستوٍ محلّي مسطّح */
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
    if (a === 'hospital') return 'مستشفى';
    if (a === 'clinic' || a === 'doctors') return 'مركز طبي';
    if (a === 'pharmacy') return 'صيدلية';
    if (a === 'fuel') return 'محطة وقود';
    if (a === 'school') return 'مدرسة';
    if (a === 'kindergarten') return 'حضانة';
    if (a === 'university' || a === 'college') return 'University';
    if (a === 'bank') return 'بنك';
    if (a === 'restaurant' || a === 'fast_food') return 'Restaurant';
    if (a === 'cafe') return 'Cafe';
    if (a === 'place_of_worship') {
        return tags.religion === 'christian' ? 'كنيسة' : 'مسجد';
    }
    if (tags.shop === 'supermarket') return 'Supermarket';
    if (tags.shop === 'mall' || tags.shop === 'department_store') return 'مركز تسوق';
    return null;
};

/* ============================================================
   المساحات الخضراء والمائية — طبقة تحليلٍ وتسمية

   المساحات المفتوحة ليست زينةً على الخريطة: هي نقاط تجمّعٍ
   وإخلاءٍ وإسنادٍ ميدانيّ قرب الحوادث والحرائق والحشود. فنقرؤها
   مصنّفةً مسمّاةً، ونردّها بصيغةٍ تدخل التحليل.
   ============================================================ */
const GREEN_RULES = [
    { k: 'leisure', v: 'park', group: 'veg', say: 'حديقة عامّة' },
    { k: 'leisure', v: 'garden', group: 'veg', say: 'حديقة' },
    { k: 'leisure', v: 'playground', group: 'veg', say: 'ملعب أطفال' },
    { k: 'leisure', v: 'pitch', group: 'veg', say: 'ملعب رياضي' },
    { k: 'leisure', v: 'sports_centre', group: 'veg', say: 'منشأة رياضية' },
    { k: 'leisure', v: 'nature_reserve', group: 'veg', say: 'محمية طبيعية' },
    { k: 'landuse', v: 'grass', group: 'veg', say: 'مسطّح أخضر' },
    { k: 'landuse', v: 'recreation_ground', group: 'veg', say: 'أرض ترفيهية' },
    { k: 'landuse', v: 'village_green', group: 'veg', say: 'ساحة خضراء' },
    { k: 'landuse', v: 'forest', group: 'veg', say: 'غابة' },
    { k: 'landuse', v: 'meadow', group: 'veg', say: 'مرج' },
    { k: 'landuse', v: 'cemetery', group: 'veg', say: 'مقبرة' },
    { k: 'natural', v: 'wood', group: 'veg', say: 'حرج' },
    { k: 'natural', v: 'scrub', group: 'veg', say: 'أرض شُجَيرية' },
    { k: 'natural', v: 'grassland', group: 'veg', say: 'مرج' },
    { k: 'natural', v: 'water', group: 'water', say: 'مسطّح مائي' },
    { k: 'natural', v: 'wetland', group: 'water', say: 'أرض رطبة' },
    { k: 'landuse', v: 'basin', group: 'water', say: 'حوض مائي' }
];

const classifyGreen = (tags = {}) => {
    for (const rule of GREEN_RULES) {
        if (tags[rule.k] === rule.v) return rule;
    }
    if (tags.natural === 'bay' || tags.waterway) return { group: 'water', say: 'مجرى مائي' };
    return null;
};

/* تصنيفات الطرق التي تحمل حركة مركبات — ما عداها لا سعة له */
const DRIVABLE = [
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'residential', 'unclassified', 'service', 'living_street'
];

/* ============================================================
   Overpass — طلبٌ واحد يجلب الطرق والمعالم والمساحات الخضراء
   ============================================================ */

const runOverpass = async (query, signal) => {
    let lastError;
    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `data=${encodeURIComponent(query)}`,
                signal
            });
            if (res.ok) return await res.json();
            lastError = new Error(`Overpass ${res.status}`);
        } catch (e) {
            lastError = e;
            if (e?.name === 'AbortError') throw e;
        }
    }
    throw lastError || new Error('تعذّر الوصول إلى OpenStreetMap');
};

const centroidOf = (ring) => {
    let lat = 0, lon = 0;
    for (const [x, y] of ring) { lon += x; lat += y; }
    return { longitude: lon / ring.length, latitude: lat / ring.length };
};

/**
 * يقرأ محيط الموضع من OpenStreetMap في طلبٍ واحد.
 *
 * @returns { roads, places, greens, counts }
 *   roads  بالشكل الذي يتوقّعه describeRoad (lines/lanes/maxspeed/oneway…)
 *   places بمفردات الأصناف العربية (مستشفى، صيدلية، مدرسة…)
 *   greens مضلّعاتٌ مصنّفة مسمّاة للعرض وللتحليل
 */
export const readSurroundings = async (lat, lon, radius = 600, { signal } = {}) => {
    const r = clamp(Math.round(radius), 150, 1500);
    const at = { latitude: Number(lat), longitude: Number(lon) };
    const highwayFilter = DRIVABLE.join('|');
    const poiAmenity = 'hospital|clinic|doctors|pharmacy|fuel|school|kindergarten|university|college|bank|restaurant|fast_food|cafe|place_of_worship';
    const greenLeisure = 'park|garden|playground|pitch|sports_centre|nature_reserve';
    const greenLanduse = 'grass|recreation_ground|village_green|forest|meadow|cemetery|basin';
    const greenNatural = 'wood|scrub|grassland|water|wetland';

    const g = `${r},${at.latitude.toFixed(6)},${at.longitude.toFixed(6)}`;
    const query = `[out:json][timeout:30];
(
  way(around:${g})["highway"~"^(${highwayFilter})(_link)?$"];
  node(around:${g})["amenity"~"^(${poiAmenity})$"];
  way(around:${g})["amenity"~"^(${poiAmenity})$"];
  node(around:${g})["shop"~"^(supermarket|mall|department_store)$"];
  way(around:${g})["shop"~"^(supermarket|mall|department_store)$"];
  way(around:${g})["leisure"~"^(${greenLeisure})$"];
  way(around:${g})["landuse"~"^(${greenLanduse})$"];
  way(around:${g})["natural"~"^(${greenNatural})$"];
);
out tags geom center 500;`;

    const data = await runOverpass(query, signal);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const roadMerge = new Map();
    const places = [];
    const greens = [];
    const seenPlace = new Set();

    for (const el of elements) {
        const tags = el.tags || {};
        const geom = Array.isArray(el.geometry)
            ? el.geometry.filter(p => p && Number.isFinite(p.lat))
            : [];

        /* ── طريق ── */
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

        /* ── مساحة خضراء/مائية ── */
        const green = classifyGreen(tags);
        if (green && geom.length >= 3) {
            const ring = geom.map(p => [p.lon, p.lat]);
            const first = ring[0], last = ring[ring.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
            const c = centroidOf(ring);
            greens.push({
                id: `g${el.id}`,
                name: tags.name || tags['name:ar'] || null,
                cls: green.v || 'green',
                group: green.group,
                say: green.say,
                latitude: c.latitude,
                longitude: c.longitude,
                distance: haversineM(at, c),
                ring
            });
            continue;
        }

        /* ── معلم ── */
        const category = classifyPlace(tags);
        if (category) {
            const plat = el.lat ?? el.center?.lat;
            const plon = el.lon ?? el.center?.lon;
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
    }).sort((a, b) => a.distance - b.distance).slice(0, 80);

    greens.sort((a, b) => a.distance - b.distance);

    const counts = {};
    for (const p of places) counts[p.category] = (counts[p.category] || 0) + 1;

    return {
        at, radius: r,
        roads,
        places,
        greens: greens.slice(0, 120),
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
                kind: item.type || item.category || null
            };
        }).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    } catch {
        return [];
    }
};

/* ============================================================
   فهم الحدث من وصفه — استدلال النوع من كلماتٍ دالّة

   المستخدم يصف الحدث بلغته، فنستدلّ نوعه من كلماتٍ مفتاحية.
   ليس تخميناً نهائياً: يُقترح والمستخدم يُصحّح بنقرةٍ على النوع.
   ============================================================ */
const KIND_HINTS = [
    { kind: 'fire', words: ['حريق', 'حرائق', 'نار', 'اشتعال', 'اشتعل', 'دخان', 'لهب', 'fire', 'smoke', 'blaze'] },
    { kind: 'power', words: ['كهرباء', 'كهربائي', 'انقطاع التيار', 'انقطاع الكهرباء', 'تيار', 'فصل الكهرباء', 'power', 'outage', 'blackout'] },
    { kind: 'closure', words: ['إغلاق', 'اغلاق', 'سكر الشارع', 'سكروا', 'مغلق', 'حاجز', 'closure', 'roadblock', 'closed'] },
    { kind: 'crowd', words: ['تجمّع', 'تجمع', 'ازدحام', 'حشد', 'مظاهرة', 'مسيرة', 'زحمة', 'crowd', 'rally', 'gathering'] },
    { kind: 'medical', words: ['إسعاف', 'اسعاف', 'طبي', 'طبيّ', 'إصابة', 'اصابة', 'مريض', 'جريح', 'medical', 'ambulance', 'injury'] },
    { kind: 'accident', words: ['حادث', 'تصادم', 'اصطدام', 'دهس', 'انقلاب', 'accident', 'crash', 'collision'] }
];

export const inferKind = (text) => {
    const t = String(text || '').toLowerCase();
    for (const hint of KIND_HINTS) {
        if (hint.words.some(w => t.includes(w.toLowerCase()))) return hint.kind;
    }
    return null;
};

export default { readSurroundings, geocode, inferKind };
