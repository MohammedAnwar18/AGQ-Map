/* ============================================================
   مولّد المدينة

   يُخرج مخطّطاً كاملاً — شوارع وأحياء ومبانٍ وأثاث ومركبات — من
   بذرة واحدة. وهذا هو بيت القصيد: المدينة لا تُحفظ في ملف العالم
   بل تُولَّد من رقم. مئات المباني تُصبح سطراً واحداً في ‎world.json‎،
   ومن يفتح عالمك يرى المدينة نفسها التي تراها بلا أن يُنزّل شيئاً.

   ما يضعه المستخدم بيده يبقى منفصلاً في ‎placed‎: المدينة خلفية،
   وتعديلاته فوقها.

   الملف حساب خالص بلا React وبلا three — يُختبر في Node وحده.
   ============================================================ */

// شبكة المربّعات السكنية. المربّع ٥٤ متراً والشارع ١٤ — عرض يكفي
// مسربين ورصيفين، وهو ما يجعل الشارع يُقرأ شارعاً لا ممرّاً.
export const BLOCK = 54;
export const ROAD = 14;
export const LANE = 3.4;          // نصف عرض الإسفلت بلا الرصيف
export const SIDEWALK = 2.6;
export const CITY_GRID = 6;       // مربّعات على الضلع

/** عرض المدينة الكامل بالمتر */
export const CITY_SPAN = CITY_GRID * BLOCK + (CITY_GRID + 1) * ROAD;
const HALF = CITY_SPAN / 2;

export const DISTRICTS = {
    downtown: { name: 'وسط البلد', tone: '#8FA3BF', short: 'المركز' },
    commercial: { name: 'السوق التجاري', tone: '#D9A15B', short: 'السوق' },
    residential: { name: 'الحيّ السكني', tone: '#8FC46A', short: 'الأحياء' },
    park: { name: 'الحديقة العامّة', tone: '#4FA85C', short: 'الحديقة' },
    industrial: { name: 'المنطقة الصناعية', tone: '#98A2B0', short: 'الصناعية' }
};

// ── عشوائية حتمية ───────────────────────────────────────────

const rng = (seed) => {
    let s = (seed >>> 0) || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
};

const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

// ── حدود المربّع ────────────────────────────────────────────

/** الركن الأدنى لمربّع سكني بفهرسه في الشبكة */
const blockOrigin = (index) => -HALF + ROAD + index * (BLOCK + ROAD);

/** مركز المربّع في إحداثيات العالم */
export const blockCenter = (bx, bz) => ({
    x: blockOrigin(bx) + BLOCK / 2,
    z: blockOrigin(bz) + BLOCK / 2
});

// ── توزيع الأحياء ───────────────────────────────────────────

/**
 * يُسمّي كل مربّع حيّاً.
 *
 * حلقات من المركز إلى الأطراف كما تنمو المدن فعلاً: الأبراج في
 * القلب حيث الأرض أغلى، ثم التجاري، ثم السكن. والحديقة والصناعة
 * تُزرعان في الحلقة الخارجية بمواضع ثابتة من البذرة، فلا تتكرّر
 * المدينة نفسها مع كل بذرة ولا تختلف مع كل فتح.
 */
const zoneFor = (bx, bz, r) => {
    const c = (CITY_GRID - 1) / 2;
    const ring = Math.max(Math.abs(bx - c), Math.abs(bz - c));

    if (ring <= 1) return 'downtown';
    if (ring <= 2) return r() > 0.25 ? 'commercial' : 'downtown';
    return r() > 0.82 ? 'commercial' : 'residential';
};

// ── سجلّ المباني لكل حيّ ────────────────────────────────────
//
// depth هو بُعد المبنى عن الشارع، وهو ما يُحدّد ارتدادَه عن الرصيف.
// spacing المسافة بين مبنيين على نفس الضلع.

const CATALOG = {
    downtown: [
        { type: 'tower_glass', depth: 15, spacing: 20, scale: [0.9, 1.4] },
        { type: 'tower_brick', depth: 14, spacing: 19, scale: [0.85, 1.25] },
        { type: 'tower', depth: 12, spacing: 17, scale: [0.9, 1.3] }
    ],
    commercial: [
        { type: 'shop_row', depth: 12, spacing: 17, scale: [0.95, 1.15] },
        { type: 'market_hall', depth: 14, spacing: 22, scale: [0.9, 1.1] },
        { type: 'shop', depth: 10, spacing: 14, scale: [0.95, 1.2] },
        { type: 'kiosk', depth: 5, spacing: 9, scale: [0.9, 1.1] }
    ],
    residential: [
        { type: 'apartment', depth: 12, spacing: 17, scale: [0.9, 1.2] },
        { type: 'villa', depth: 11, spacing: 16, scale: [0.9, 1.15] },
        { type: 'house', depth: 9, spacing: 14, scale: [0.9, 1.15] },
        { type: 'cottage', depth: 8, spacing: 13, scale: [0.9, 1.1] }
    ],
    industrial: [
        { type: 'warehouse', depth: 18, spacing: 28, scale: [0.95, 1.25] },
        { type: 'warehouse', depth: 16, spacing: 24, scale: [0.9, 1.1] }
    ],
    park: []
};

// معالم تُوضع مرّة واحدة في المدينة كلّها — بها يُعرف المكان
const LANDMARKS = ['mosque', 'school', 'clinic'];

// ── أضلاع المربّع ───────────────────────────────────────────
//
// المبنى في سجلّ الأصول ينظر إلى ‎+Z‎، فالدوران هنا يُديره ليواجه
// الشارع لا ظهره إليه.

const EDGES = [
    { key: 'n', rotation: Math.PI, along: 'x', fixed: 'z', side: -1 },
    { key: 's', rotation: 0, along: 'x', fixed: 'z', side: 1 },
    { key: 'w', rotation: -Math.PI / 2, along: 'z', fixed: 'x', side: -1 },
    { key: 'e', rotation: Math.PI / 2, along: 'z', fixed: 'x', side: 1 }
];

/**
 * يصفّ المباني على ضلع واحد من المربّع.
 *
 * تُترك فجوة عند الطرفين: مبنى يلتصق بركن المربّع يحجب الرؤية عند
 * التقاطع ويبدو مقصوصاً، والمدن الحقيقية تترك أركانها أوسع.
 */
const fillEdge = (block, edge, catalog, r, out, idFor) => {
    const { x0, z0, x1, z1 } = block;
    const margin = 7;

    const start = (edge.along === 'x' ? x0 : z0) + margin;
    const end = (edge.along === 'x' ? x1 : z1) - margin;
    const length = end - start;
    if (length <= 0) return;

    // نختار طرازاً للضلع كلّه: الشارع الواحد بطراز واحد يُقرأ حيّاً،
    // وخليط عشوائي في كل مبنى يُقرأ فوضى
    const kind = pick(r, catalog);
    const count = Math.max(1, Math.floor(length / kind.spacing));
    const step = length / count;

    for (let i = 0; i < count; i++) {
        const t = start + step * (i + 0.5) + (r() - 0.5) * step * 0.16;

        // الارتداد عن الرصيف: نصف عمق المبنى زائد هامش صغير
        const inset = kind.depth / 2 + 1.6;
        const fixedValue = edge.side < 0
            ? (edge.fixed === 'x' ? x0 : z0) + inset
            : (edge.fixed === 'x' ? x1 : z1) - inset;

        // لا يُملأ كل موضع: الفراغ بين المباني هو ما يجعلها مبانيَ
        // لا جداراً واحداً طويلاً
        if (r() > 0.93) continue;

        const scale = kind.scale[0] + r() * (kind.scale[1] - kind.scale[0]);

        out.push({
            id: idFor(),
            type: kind.type,
            x: +(edge.along === 'x' ? t : fixedValue).toFixed(2),
            z: +(edge.along === 'x' ? fixedValue : t).toFixed(2),
            rotation: +edge.rotation.toFixed(4),
            scale: +scale.toFixed(3),
            district: block.district
        });
    }
};

// ── الحديقة ─────────────────────────────────────────────────

const fillPark = (block, r, out, idFor) => {
    const { cx, cz } = block;

    out.push({ id: idFor(), type: 'fountain', x: cx, z: cz, rotation: 0, scale: 1.3, district: 'park' });

    // أشجار في حلقتين حول النافورة، بزاوية مزاحة قليلاً كي لا تصطفّ
    for (const [radius, n, kinds] of [[13, 8, ['tree', 'pine']], [21, 12, ['tree', 'palm', 'pine']]]) {
        for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2 + r() * 0.3;
            out.push({
                id: idFor(),
                type: pick(r, kinds),
                x: +(cx + Math.cos(angle) * (radius + r() * 3)).toFixed(2),
                z: +(cz + Math.sin(angle) * (radius + r() * 3)).toFixed(2),
                rotation: +(r() * Math.PI * 2).toFixed(3),
                scale: +(0.9 + r() * 0.5).toFixed(3),
                district: 'park'
            });
        }
    }

    // مقاعد تواجه النافورة
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        out.push({
            id: idFor(),
            type: 'bench',
            x: +(cx + Math.cos(angle) * 8).toFixed(2),
            z: +(cz + Math.sin(angle) * 8).toFixed(2),
            rotation: +(-angle + Math.PI / 2).toFixed(3),
            scale: 1,
            district: 'park'
        });
    }
};

// ── البناء ──────────────────────────────────────────────────

/**
 * يبني المدينة كاملة.
 *
 * @param seed     بذرة ثابتة — نفس الرقم يُعطي نفس المدينة دائماً
 * @param density  0.4 إلى 1 — تُقلّل عدد المباني على الأجهزة الضعيفة
 */
export const buildCity = ({ seed = 20260920, density = 1 } = {}) => {
    const r = rng(seed);
    let n = 0;
    const idFor = () => `c${(++n).toString(36)}`;

    const blocks = [];
    const buildings = [];
    const props = [];
    const cars = [];

    // ١) تسمية المربّعات
    const c = (CITY_GRID - 1) / 2;
    for (let bz = 0; bz < CITY_GRID; bz++) {
        for (let bx = 0; bx < CITY_GRID; bx++) {
            const x0 = blockOrigin(bx);
            const z0 = blockOrigin(bz);
            blocks.push({
                bx, bz,
                x0, z0,
                x1: x0 + BLOCK,
                z1: z0 + BLOCK,
                cx: +(x0 + BLOCK / 2).toFixed(2),
                cz: +(z0 + BLOCK / 2).toFixed(2),
                ring: Math.max(Math.abs(bx - c), Math.abs(bz - c)),
                district: zoneFor(bx, bz, r)
            });
        }
    }

    // ٢) حديقة وصناعة في الحلقة الخارجية — المدينة بلا متنفّس
    //    ولا ظهرٍ صناعي ليست مدينة
    const outer = blocks.filter(b => b.ring > 2);
    const shuffled = outer.slice().sort(() => r() - 0.5);
    shuffled.slice(0, 2).forEach(b => { b.district = 'park'; });
    shuffled.slice(2, 5).forEach(b => { b.district = 'industrial'; });

    // ٣) المعالم: مربّع لكل معلم، يُنتزع من السكني
    const hosts = blocks.filter(b => b.district === 'residential').slice(0, 30);
    LANDMARKS.forEach((type, i) => {
        const host = hosts[Math.floor(r() * hosts.length)];
        if (!host || host.landmark) return;
        host.landmark = type;
        buildings.push({
            id: idFor(),
            type,
            x: host.cx,
            z: host.cz,
            rotation: +(Math.round(r() * 3) * (Math.PI / 2)).toFixed(4),
            scale: 1,
            district: host.district,
            landmark: true,
            index: i
        });
    });

    // ٤) ملء المربّعات
    for (const block of blocks) {
        if (block.district === 'park') { fillPark(block, r, props, idFor); continue; }

        const catalog = CATALOG[block.district] || CATALOG.residential;
        if (!catalog.length) continue;

        for (const edge of EDGES) {
            // الكثافة تُسقط أضلاعاً كاملة لا مبانيَ متفرّقة: الضلع
            // الفارغ يُقرأ أرضاً خالية، والمبنى الناقص يُقرأ خطأً
            if (density < 1 && r() > density + 0.12) continue;
            fillEdge(block, edge, catalog, r, buildings, idFor);
        }

        // شجرة أو اثنتان في فناء المربّع
        const inner = block.district === 'residential' ? 3 : 1;
        for (let i = 0; i < inner; i++) {
            props.push({
                id: idFor(),
                type: pick(r, ['tree', 'bush', 'pine']),
                x: +(block.cx + (r() - 0.5) * (BLOCK - 28)).toFixed(2),
                z: +(block.cz + (r() - 0.5) * (BLOCK - 28)).toFixed(2),
                rotation: +(r() * Math.PI * 2).toFixed(3),
                scale: +(0.85 + r() * 0.5).toFixed(3),
                district: block.district
            });
        }
    }

    // ٥) الشوارع: خطوط الشبكة كاملة العرض
    const roads = [];
    for (let i = 0; i <= CITY_GRID; i++) {
        const at = -HALF + ROAD / 2 + i * (BLOCK + ROAD);
        roads.push({ axis: 'x', at: +at.toFixed(2), from: -HALF, to: HALF });
        roads.push({ axis: 'z', at: +at.toFixed(2), from: -HALF, to: HALF });
    }

    // ٦) أعمدة الإنارة.
    //
    // كل أربعة وثلاثين متراً وعلى جانب واحد يتناوب — وهكذا تُنار
    // الشوارع فعلاً. العمودان المتقابلان في كل موضع يعنيان ضِعف
    // الرسمات لإنارة لا تزيد، وهو أثقل ما كان في المدينة.
    const lampStep = 34;
    for (let i = 0; i <= CITY_GRID; i++) {
        const at = -HALF + ROAD / 2 + i * (BLOCK + ROAD);
        const off = LANE + SIDEWALK * 0.55;

        let turn = i % 2 === 0 ? 1 : -1;
        for (let t = -HALF + 14; t < HALF - 14; t += lampStep) {
            props.push({
                id: idFor(), type: 'lamp',
                x: +(at + turn * off).toFixed(2), z: +t.toFixed(2),
                rotation: turn > 0 ? 0 : Math.PI, scale: 1, district: 'street'
            });
            props.push({
                id: idFor(), type: 'lamp',
                x: +t.toFixed(2), z: +(at - turn * off).toFixed(2),
                rotation: turn > 0 ? -Math.PI / 2 : Math.PI / 2, scale: 1, district: 'street'
            });
            turn = -turn;
        }
    }

    // ٧) إشارات المرور عند التقاطعات الداخلية وحدها
    for (let i = 1; i < CITY_GRID; i++) {
        for (let j = 1; j < CITY_GRID; j++) {
            const x = -HALF + ROAD / 2 + i * (BLOCK + ROAD);
            const z = -HALF + ROAD / 2 + j * (BLOCK + ROAD);
            const corner = LANE + SIDEWALK * 0.6;

            // إشارة على ركنين متقابلين — أربع إشارات لكل تقاطع
            // تُضاعف الرسم ولا تُضيف قراءةً
            props.push({ id: idFor(), type: 'traffic_light', x: +(x - corner).toFixed(2), z: +(z - corner).toFixed(2), rotation: 0, scale: 1, district: 'street' });
            if ((i + j) % 2 === 0) {
                props.push({ id: idFor(), type: 'traffic_light', x: +(x + corner).toFixed(2), z: +(z + corner).toFixed(2), rotation: Math.PI, scale: 1, district: 'street' });
            }
        }
    }

    // ٨) مركبات متوقّفة على الأرصفة — وهي ما يُركَب فعلاً
    const PAINT = ['#D45B4A', '#4E8FC0', '#E8C15A', '#EDEDED', '#2F3742', '#5B9B6E', '#9B5BA8'];
    const KINDS = ['car', 'car', 'car', 'van', 'pickup', 'taxi'];

    for (const block of blocks) {
        if (block.district === 'park') continue;

        const slots = block.district === 'downtown' ? 3 : 2;
        for (let i = 0; i < slots; i++) {
            const edge = EDGES[Math.floor(r() * 4)];
            const t = (edge.along === 'x' ? block.x0 : block.z0) + 10 + r() * (BLOCK - 20);
            const curb = edge.side < 0
                ? (edge.fixed === 'x' ? block.x0 : block.z0) - (SIDEWALK + 1.9)
                : (edge.fixed === 'x' ? block.x1 : block.z1) + (SIDEWALK + 1.9);

            // المركبة تصطفّ موازيةً للرصيف لا عموديّة عليه
            const heading = edge.along === 'x'
                ? (r() > 0.5 ? 0 : Math.PI)
                : (r() > 0.5 ? Math.PI / 2 : -Math.PI / 2);

            cars.push({
                id: `v${cars.length + 1}`,
                type: pick(r, KINDS),
                x: +(edge.along === 'x' ? t : curb).toFixed(2),
                z: +(edge.along === 'x' ? curb : t).toFixed(2),
                rotation: +heading.toFixed(4),
                color: pick(r, PAINT),
                district: block.district
            });
        }
    }

    return {
        seed,
        span: CITY_SPAN,
        grid: CITY_GRID,
        blocks,
        roads,
        buildings,
        props,
        cars,
        counts: {
            buildings: buildings.length,
            props: props.length,
            cars: cars.length
        }
    };
};

// ── الاستعلام المكاني ───────────────────────────────────────

/**
 * الحيّ الذي تقف فيه نقطة.
 *
 * يُعرض في الواجهة: «أنت في السوق التجاري». المعرفة بالمكان هي ما
 * يحوّل شبكة مبانٍ إلى مدينة لها أجزاء يعرفها من يسير فيها.
 */
export const districtAt = (city, x, z) => {
    if (!city) return null;

    // على الشارع لا داخل مربّع؟ ننسبه لأقرب مربّع
    let best = null;
    let bestDist = Infinity;

    for (const b of city.blocks) {
        const dx = Math.max(b.x0 - x, 0, x - b.x1);
        const dz = Math.max(b.z0 - z, 0, z - b.z1);
        const d = dx * dx + dz * dz;
        if (d < bestDist) { bestDist = d; best = b; }
        if (d === 0) break;
    }

    return best ? { key: best.district, ...DISTRICTS[best.district], block: best } : null;
};

/** هل النقطة داخل شارع؟ — يُستعمل لمنع الوضع فوق الإسفلت */
export const onRoad = (x, z) => {
    const near = (v) => {
        const period = BLOCK + ROAD;
        const shifted = v + HALF - ROAD / 2;
        const offset = ((shifted % period) + period) % period;
        return Math.min(offset, period - offset) <= ROAD / 2;
    };
    return near(x) || near(z);
};

/**
 * فهرس مكاني للأجسام الصلبة.
 *
 * المشي يسأل «ما الصلب حولي؟» في كل إطار. المرور على ثلاثمئة مبنى
 * ستّين مرّة في الثانية هدر؛ فنُقسّمها على خلايا مرّة واحدة، ثم لا
 * نقرأ إلا الخلايا التسع المحيطة.
 */
export const buildSolidIndex = (items, radiusOf, cell = 24) => {
    const map = new Map();
    const key = (ix, iz) => `${ix},${iz}`;

    for (const item of items) {
        const radius = radiusOf(item);
        if (!radius) continue;

        const ix = Math.floor(item.x / cell);
        const iz = Math.floor(item.z / cell);
        const bucket = key(ix, iz);

        if (!map.has(bucket)) map.set(bucket, []);
        map.get(bucket).push({ x: item.x, z: item.z, radius });
    }

    return {
        cell,
        near(x, z) {
            const ix = Math.floor(x / cell);
            const iz = Math.floor(z / cell);
            const out = [];
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const bucket = map.get(key(ix + dx, iz + dz));
                    if (bucket) out.push(...bucket);
                }
            }
            return out;
        },
        size: map.size
    };
};

// ── الخطّة المشتركة ─────────────────────────────────────────

let cached = null;

/**
 * خطّة المدينة الجارية.
 *
 * المشهد والفيزياء والخريطة والمشي — كلّها تسأل عن نفس المدينة.
 * بناؤها في كل واحد منها يعني أربع مدن متطابقة في الذاكرة وأربع
 * عمليات توليد. فنبنيها مرّة ونُعيدها ما دامت البذرة والكثافة
 * كما هما، ونُعيد البناء حين تتغيّران.
 */
export const cityPlan = ({ enabled = true, seed = 20260920, density = 1 } = {}) => {
    if (!enabled) return null;
    if (cached && cached.seed === seed && cached.density === density) return cached.plan;

    cached = { seed, density, plan: buildCity({ seed, density }) };
    return cached.plan;
};
