/**
 * قراءة السياق المكاني من OpenStreetMap عبر Overpass API.
 *
 * حرّة ومجانية بلا مفتاح. نسأل عمّا يقع فعلاً داخل المضلّع الذي رسمه
 * المستخدم — محال، مقاهٍ، مدارس، مساجد، شوارع، مبانٍ — فيصير الوكلاء
 * سكّان ذلك المكان بعينه لا شخصيات عامّة.
 */

// خوادم Overpass العامّة تُحدّد المعدّل بسخاء متفاوت، فنوزّع عليها
const ENDPOINTS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const TIMEOUT_MS = 45000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Overpass يريد "lat lon lat lon…" — وGeoJSON يعطينا [lon, lat] */
const toPoly = (ring) => ring
    .map(([lon, lat]) => `${Number(lat).toFixed(6)} ${Number(lon).toFixed(6)}`)
    .join(' ');

/** مساحة المضلّع بالكيلومترات المربّعة (صيغة الحذاء مع تصحيح خط العرض) */
const polygonAreaKm2 = (ring) => {
    if (!ring || ring.length < 3) return 0;

    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    let total = 0;

    for (let i = 0; i < ring.length; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[(i + 1) % ring.length];
        total += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
    }
    return Math.abs((total * R * R) / 2);
};

const centroid = (ring) => {
    const sum = ring.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), { lon: 0, lat: 0 });
    return { lon: sum.lon / ring.length, lat: sum.lat / ring.length };
};

/** هل النقطة داخل المضلّع؟ (ray casting) — نستخدمه لتثبيت الوكلاء */
const pointInPolygon = ([lon, lat], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        const intersects = (yi > lat) !== (yj > lat)
            && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
};

/** نقاط موزّعة داخل المضلّع — مواقع الوكلاء */
const scatterInside = (ring, count) => {
    const lons = ring.map(p => p[0]);
    const lats = ring.map(p => p[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);

    const points = [];
    let guard = 0;

    while (points.length < count && guard < count * 300) {
        guard++;
        const candidate = [
            minLon + Math.random() * (maxLon - minLon),
            minLat + Math.random() * (maxLat - minLat)
        ];
        if (pointInPolygon(candidate, ring)) points.push(candidate);
    }

    // مضلّع نحيل جداً قد يُفشل العيّنة العشوائية: نرجع إلى المركز
    while (points.length < count) {
        const c = centroid(ring);
        points.push([c.lon, c.lat]);
    }
    return points;
};

const runOverpass = async (query) => {
    let lastError;

    // جولتان على كل الخوادم: الأولى فورية، والثانية بعد مهلة قصيرة
    // لأن ٤٢٩ (تجاوز المعدّل) غالباً ما ينقضي خلال ثوانٍ
    for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await sleep(2500);

        for (const endpoint of ENDPOINTS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'PalNovaa-HellyAgents/1.0'
                    },
                    body: `data=${encodeURIComponent(query)}`,
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (response.ok) return await response.json();

                lastError = new Error(`Overpass ${response.status}`);
                // ٤٢٩ و٥٠٤ عابران: ننتقل لخادم آخر فوراً
                if (response.status !== 429 && response.status !== 504) continue;
            } catch (e) {
                clearTimeout(timer);
                lastError = e;
            }
        }
    }

    throw new Error(
        lastError?.message?.includes('429')
            ? 'خوادم OpenStreetMap مشغولة الآن، أعد المحاولة بعد لحظات'
            : 'تعذّر الوصول إلى OpenStreetMap'
    );
};

// تصنيفات نلخّص بها المكان
const CATEGORY_LABELS = {
    shop: 'محال تجارية',
    restaurant: 'مطاعم',
    cafe: 'مقاهٍ',
    school: 'مدارس',
    university: 'جامعات وكليات',
    pharmacy: 'صيدليات',
    clinic: 'عيادات ومراكز صحية',
    hospital: 'مستشفيات',
    mosque: 'مساجد',
    church: 'كنائس',
    bank: 'بنوك وصرافات',
    fuel: 'محطات وقود',
    park: 'حدائق ومساحات عامة',
    parking: 'مواقف سيارات',
    bus: 'محطات نقل عام',
    residential: 'مبانٍ سكنية'
};

const classify = (tags = {}) => {
    if (tags.shop) return 'shop';
    const a = tags.amenity;
    if (a === 'restaurant' || a === 'fast_food') return 'restaurant';
    if (a === 'cafe') return 'cafe';
    if (a === 'school' || a === 'kindergarten') return 'school';
    if (a === 'university' || a === 'college') return 'university';
    if (a === 'pharmacy') return 'pharmacy';
    if (a === 'clinic' || a === 'doctors') return 'clinic';
    if (a === 'hospital') return 'hospital';
    if (a === 'bank' || a === 'atm') return 'bank';
    if (a === 'fuel') return 'fuel';
    if (a === 'parking') return 'parking';
    if (a === 'bus_station') return 'bus';
    if (tags.public_transport || tags.highway === 'bus_stop') return 'bus';
    if (tags.leisure === 'park' || tags.leisure === 'garden') return 'park';
    if (tags.amenity === 'place_of_worship') {
        return tags.religion === 'christian' ? 'church' : 'mosque';
    }
    if (tags.building === 'residential' || tags.building === 'apartments') return 'residential';
    return null;
};

/**
 * يقرأ ما بداخل المضلّع ويُرجع ملخّصاً صالحاً للعرض وللتغذية إلى النموذج.
 */
const probeArea = async (ring) => {
    const poly = toPoly(ring);

    const query = `[out:json][timeout:40];
(
  node(poly:"${poly}")["shop"];
  way(poly:"${poly}")["shop"];
  node(poly:"${poly}")["amenity"];
  way(poly:"${poly}")["amenity"];
  node(poly:"${poly}")["leisure"~"park|garden"];
  way(poly:"${poly}")["leisure"~"park|garden"];
  way(poly:"${poly}")["highway"]["name"];
  way(poly:"${poly}")["building"~"residential|apartments"];
);
out tags center 600;`;

    const data = await runOverpass(query);
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const counts = {};
    const places = [];
    const streets = new Set();

    for (const el of elements) {
        const tags = el.tags || {};

        if (tags.highway && tags.name) {
            streets.add(tags.name);
            continue;
        }

        const key = classify(tags);
        if (!key) continue;

        counts[key] = (counts[key] || 0) + 1;

        if (tags.name && places.length < 60) {
            places.push({
                name: tags.name,
                kind: CATEGORY_LABELS[key] || key,
                lat: el.lat ?? el.center?.lat ?? null,
                lon: el.lon ?? el.center?.lon ?? null
            });
        }
    }

    const areaKm2 = polygonAreaKm2(ring);

    return {
        area_km2: Math.round(areaKm2 * 1000) / 1000,
        centroid: centroid(ring),
        streets: [...streets].slice(0, 25),
        counts,
        labels: CATEGORY_LABELS,
        places,
        total_features: elements.length
    };
};

// ── التقاط شارع بالنقر عليه ──────────────────────────────────

const METERS_PER_DEG_LAT = 111320;

/** أقصر مسافة بالأمتار بين نقطة وقطعة مستقيمة، في مستوٍ محلّي مسطّح */
const pointToSegmentM = (p, a, b) => {
    const kx = METERS_PER_DEG_LAT * Math.cos((p.lat * Math.PI) / 180);
    const ky = METERS_PER_DEG_LAT;

    const px = p.lon * kx, py = p.lat * ky;
    const ax = a.lon * kx, ay = a.lat * ky;
    const bx = b.lon * kx, by = b.lat * ky;

    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;

    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/**
 * يُحوّل خطّ الشارع إلى شريط مغلق بعرض ثابت — نمشي على جانب ذهاباً
 * وعلى الجانب الآخر إياباً، فنحصل على حلقة صالحة لاستعلام المضلّع.
 */
const bufferLine = (coords, meters = 35) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const latRef = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const dLat = meters / METERS_PER_DEG_LAT;
    const dLon = meters / (METERS_PER_DEG_LAT * Math.cos((latRef * Math.PI) / 180) || 1);

    const offsets = coords.map(([lon, lat], i) => {
        const prev = coords[Math.max(0, i - 1)];
        const next = coords[Math.min(coords.length - 1, i + 1)];

        // عمودي على اتجاه السير، مقيساً بالأمتار ثم مُعاداً إلى الدرجات
        const vx = (next[0] - prev[0]) * Math.cos((latRef * Math.PI) / 180);
        const vy = next[1] - prev[1];
        const len = Math.hypot(vx, vy) || 1;

        return { lon, lat, nx: (-vy / len) * dLon, ny: (vx / len) * dLat };
    });

    const left = offsets.map(o => [o.lon + o.nx, o.lat + o.ny]);
    const right = offsets.map(o => [o.lon - o.nx, o.lat - o.ny]).reverse();

    const ring = [...left, ...right];
    ring.push([ring[0][0], ring[0][1]]);
    return ring;
};

/** أقرب شارع مسمّى إلى نقطة نقرها المستخدم */
const nearestStreet = async ({ lat, lon, radius = 70 }) => {
    const query = `[out:json][timeout:25];
way(around:${radius},${Number(lat).toFixed(6)},${Number(lon).toFixed(6)})["highway"]["name"];
out geom 40;`;

    const data = await runOverpass(query);
    const ways = Array.isArray(data?.elements) ? data.elements : [];

    let best = null;
    let bestD = Infinity;

    for (const way of ways) {
        const geom = way.geometry;
        if (!Array.isArray(geom) || geom.length < 2) continue;

        for (let i = 0; i < geom.length - 1; i++) {
            const d = pointToSegmentM({ lat, lon }, geom[i], geom[i + 1]);
            if (d < bestD) { bestD = d; best = way; }
        }
    }

    if (!best) return null;

    return {
        name: best.tags?.name || null,
        kind: best.tags?.highway || null,
        distance_m: Math.round(bestD),
        coords: best.geometry.map(g => [g.lon, g.lat])
    };
};

/** بحث بالاسم — Nominatim، للانتقال إلى مكان بدل التجوال يدوياً */
const searchPlaces = async (query, { limit = 6 } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const url = 'https://nominatim.openstreetmap.org/search'
            + `?format=json&addressdetails=1&accept-language=ar&limit=${limit}`
            + `&q=${encodeURIComponent(query)}`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'PalNovaa-HellyAgents/1.0' },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) return [];

        const data = await response.json();
        return (Array.isArray(data) ? data : []).map(item => ({
            name: item.display_name,
            lat: Number(item.lat),
            lon: Number(item.lon),
            kind: item.type || item.class || null,
            bbox: Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : null
        }));
    } catch {
        clearTimeout(timer);
        return [];
    }
};

/** اسم المكان من التسمية العكسية — Nominatim، مجاني كذلك */
const reverseName = async ({ lat, lon }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=ar&lat=${lat}&lon=${lon}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'PalNovaa-HellyAgents/1.0' },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) return null;

        const data = await response.json();
        const a = data.address || {};
        return [a.neighbourhood, a.suburb, a.city || a.town || a.village, a.state]
            .filter(Boolean)
            .slice(0, 3)
            .join('، ') || data.display_name || null;
    } catch {
        clearTimeout(timer);
        return null;
    }
};

/** نصّ مختصر يُغذّى إلى النموذج ليبني وكلاء من هذا المكان بعينه */
const contextToText = (context, placeName) => {
    if (!context) return '';

    const lines = [];
    if (placeName) lines.push(`المكان: ${placeName}`);
    lines.push(`مساحة المنطقة: ${context.area_km2} كم²`);

    if (context.streets?.length) {
        lines.push(`الشوارع: ${context.streets.slice(0, 12).join('، ')}`);
    }

    const counts = Object.entries(context.counts || {})
        .sort((a, b) => b[1] - a[1])
        .map(([key, n]) => `${CATEGORY_LABELS[key] || key}: ${n}`);
    if (counts.length) lines.push(`ما في المنطقة — ${counts.join(' · ')}`);

    if (context.places?.length) {
        lines.push(`أمثلة: ${context.places.slice(0, 15).map(p => p.name).join('، ')}`);
    }

    return lines.join('\n');
};

module.exports = {
    probeArea,
    nearestStreet,
    searchPlaces,
    bufferLine,
    reverseName,
    contextToText,
    scatterInside,
    pointInPolygon,
    polygonAreaKm2,
    centroid,
    CATEGORY_LABELS
};
