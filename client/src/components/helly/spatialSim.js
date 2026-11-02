import { haversine } from './spatialAgent.js';
import { seeded, ARCHETYPES, stepCrowd, meanOf, clustersOf } from './simEngine.js';

/* ============================================================
   المحاكاة على الخريطة

   الفرق عن المحاكاة المجرّدة أنّ لكل وكيل مكاناً. فالرأي لا يبقى
   رقماً في جدول، بل يصير لوناً على نقطة في حيٍّ — ويُرى انتشاره
   كما يُرى انتشار أي شيء على خريطة.

   وثلاثة أشياء تتبع المكان:

     الجيرة     تسمع من حولك أكثر ممّا تسمع من بعيد
     الحدث      يبدأ من موضع ويخبو مع المسافة عنه
     القراءة    «الشمال معارض والوسط مؤيّد» لا «التباين 0.34»

   والجوار المكاني هو ما يُنتج المناطق: بلا مكان تتوزّع الآراء في
   المجتمع بلا شكل، ومع المكان تتكوّن جيوبٌ يُشار إليها.
   ============================================================ */

/* نصيب الروابط البعيدة. المجتمع ليس جيرةً محضة: فيه من يسمع من
   خارج حيّه — وبلا ذلك تبقى كل منطقة معزولة فلا تتأثّر بغيرها */
const FAR_SHARE = 0.12;

/* ============================================================
   التوزيع على الخريطة
   ============================================================ */

/**
 * يوزّع الوكلاء على معالم حقيقية.
 *
 * كل وكيل يسكن قريباً من معلم، لا في نقطة عشوائية: السكّان يتجمّعون
 * حيث الخدمات، وتوزيعٌ منتظم على المستطيل يضع ثلث المجتمع في أرض
 * خالية فتُقرأ الخريطة خطأً.
 *
 * والإزاحة عن المعلم تمنع تكدّس الوكلاء في نقطة واحدة فوق بعضهم.
 */
export const placeCrowd = (count, landmarks, { seed = 1, split = 0.62, scatterM = 120 } = {}) => {
    const spots = (landmarks || []).filter(
        l => Number.isFinite(+l?.latitude) && Number.isFinite(+l?.longitude)
    );
    if (!spots.length) return [];

    const rand = seeded(seed);
    const n = Math.max(0, Math.min(500, Math.round(count) || 0));
    const kinds = Object.entries(ARCHETYPES);

    /* الإزاحة بالدرجات: خطوة العرض ثابتة، وخطوة الطول تُقسَم على
       جيب تمام العرض وإلّا صارت الإزاحة شرقاً أوسع ممّا طُلب */
    const latStep = scatterM / 111320;

    const agents = [];

    for (let i = 0; i < n; i++) {
        const home = spots[Math.floor(rand() * spots.length)];

        const roll = rand();
        let acc = 0;
        let kind = 'regular';
        for (const [key, def] of kinds) {
            acc += def.share;
            if (roll <= acc) { kind = key; break; }
        }

        const def = ARCHETYPES[kind];
        const lat = +home.latitude;
        const lonStep = latStep / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

        /*
         * الرأي الابتدائي يتبع المكان قليلاً.
         *
         * الجيرة تتشابه آراؤها، فنُضيف ميلاً مشتقّاً من موضع المعلم
         * نفسه: نفس المعلم يُعطي نفس الميل لسكّانه. وبلا ذلك تُرشّ
         * الآراء عشوائياً على الخريطة فلا تظهر مناطق أصلاً — وظهورُ
         * المناطق هو كل الفائدة من ربط المحاكاة بالمكان.
         */
        const placeLean = Math.sin(lat * 97.3 + (+home.longitude) * 131.7) * 0.45;
        const side = rand() < 0.5 ? 1 : -1;
        const opinion = Math.max(-1, Math.min(1,
            side * split * 0.55 + placeLean + (rand() - 0.5) * 0.35
        ));

        const norm = (mean, spread) => Math.max(0.03, mean + (rand() - 0.5) * 2 * spread);

        agents.push({
            id: i,
            kind,
            label: def.label,
            latitude: lat + (rand() - 0.5) * 2 * latStep,
            longitude: +home.longitude + (rand() - 0.5) * 2 * lonStep,
            homeName: home.name || null,
            opinion,
            start: opinion,
            reach: norm(def.reach[0], def.reach[1]),
            stubborn: Math.min(0.95, norm(def.stubborn[0], def.stubborn[1])),
            tolerance: Math.min(1.6, norm(def.tolerance[0], def.tolerance[1])),
            moved: 0,
            swayed: 0
        });
    }

    return agents;
};

/**
 * شبكة الجيرة المكانية.
 *
 * كلٌّ يسمع أقرب الناس إليه، ومعهم قليلٌ من البعيدين. والبحث بفرز
 * المسافات لكل وكيل: ‎O(n²)‎ وهو مقبول عند خمس مئة وكيل — وبنية
 * مكانية أسرع ستُعقّد الكود لأجل حالة لا تحدث هنا.
 */
export const neighbourhood = (agents, { near = 6, seed = 3 } = {}) => {
    const n = agents.length;
    const links = agents.map(() => new Set());
    if (n < 2) return links.map(s => [...s]);

    const rand = seeded(seed);
    const far = Math.max(0, Math.round(near * FAR_SHARE * 8) / 8);

    for (let i = 0; i < n; i++) {
        const ranked = [];
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            ranked.push([haversine(agents[i], agents[j]), j]);
        }
        ranked.sort((a, b) => a[0] - b[0]);

        for (let k = 0; k < Math.min(near, ranked.length); k++) {
            const j = ranked[k][1];
            links[i].add(j);
            links[j].add(i);
        }

        // روابط بعيدة: من يسمع من خارج حيّه
        for (let k = 0; k < far; k++) {
            if (rand() > FAR_SHARE * 8) continue;
            const j = Math.floor(rand() * n);
            if (j !== i) { links[i].add(j); links[j].add(i); }
        }
    }

    return links.map(s => [...s]);
};

/* ============================================================
   المناطق
   ============================================================ */

/**
 * يقسم الخريطة إلى مناطق ويقيس رأي كل منطقة.
 *
 * هذه هي القراءة التي تُفهم: «الشمال الشرقي معارض بـ٧٠٪» لا
 * «التباين 0.34». وتُرسم مربّعات ملوّنة على الخريطة، فيُرى
 * الانقسام مكانياً لا رقمياً.
 *
 * والمنطقة التي فيها أقلّ من ثلاثة وكلاء تُهمل: رأي واحد لا يصف
 * منطقة، ولونُها يُوهم بدقّة ليست فيها.
 */
export const districtsOf = (agents, bounds, { cells = 6, least = 3 } = {}) => {
    const { south, north, west, east } = bounds || {};
    if (![south, north, west, east].every(Number.isFinite)) return [];
    if (north <= south || east <= west) return [];

    const rows = Math.max(1, Math.min(14, cells));
    const cols = rows;

    const latStep = (north - south) / rows;
    const lonStep = (east - west) / cols;

    const buckets = new Map();

    for (const a of agents || []) {
        const r = Math.min(rows - 1, Math.max(0, Math.floor((a.latitude - south) / latStep)));
        const c = Math.min(cols - 1, Math.max(0, Math.floor((a.longitude - west) / lonStep)));
        const key = `${r}:${c}`;

        if (!buckets.has(key)) buckets.set(key, { r, c, values: [] });
        buckets.get(key).values.push(a.opinion);
    }

    const out = [];

    for (const cell of buckets.values()) {
        if (cell.values.length < least) continue;

        const mean = meanOf(cell.values);
        const forShare = cell.values.filter(v => v > 0.15).length / cell.values.length;
        const againstShare = cell.values.filter(v => v < -0.15).length / cell.values.length;

        out.push({
            key: `${cell.r}:${cell.c}`,
            south: south + cell.r * latStep,
            north: south + (cell.r + 1) * latStep,
            west: west + cell.c * lonStep,
            east: west + (cell.c + 1) * lonStep,
            centre: {
                latitude: south + (cell.r + 0.5) * latStep,
                longitude: west + (cell.c + 0.5) * lonStep
            },
            count: cell.values.length,
            mean,
            forShare,
            againstShare,
            lean: mean > 0.15 ? 'for' : mean < -0.15 ? 'against' : 'split'
        });
    }

    return out.sort((a, b) => b.count - a.count);
};

/** اسم الجهة من موضع المنطقة داخل الحدود — «الشمال الغربي» */
export const sideName = (cell, bounds) => {
    const midLat = (bounds.south + bounds.north) / 2;
    const midLon = (bounds.west + bounds.east) / 2;
    const spanLat = (bounds.north - bounds.south) / 6;
    const spanLon = (bounds.east - bounds.west) / 6;

    const lat = cell.centre.latitude;
    const lon = cell.centre.longitude;

    const ns = lat > midLat + spanLat ? 'الشمال' : lat < midLat - spanLat ? 'الجنوب' : '';
    const ew = lon > midLon + spanLon ? 'الشرق' : lon < midLon - spanLon ? 'الغرب' : '';

    if (ns && ew) return `${ns} ${ew === 'الشرق' ? 'الشرقي' : 'الغربي'}`;
    if (ns) return ns;
    if (ew) return ew;
    return 'الوسط';
};

/* ============================================================
   التشغيل
   ============================================================ */

/**
 * يُشغّل المحاكاة على الخريطة ويحفظ كل جولة.
 *
 * الحدث له موضع ونطاق: من كان داخله تأثّر بقوّة تتضاءل مع بُعده
 * عن مركزه، ومن كان خارجه لم يسمع به إلّا من جيرانه. وهذا ما
 * يُنتج موجةً تنتشر على الخريطة بدل تغيّرٍ يصيب الجميع معاً.
 */
export const runOnMap = ({
    agents: seedAgents,
    bounds,
    rounds = 24,
    event = null,
    near = 6,
    seed = 11,
    cells = 6
} = {}) => {
    const start = seedAgents || [];
    if (!start.length) return null;

    const links = neighbourhood(start, { near, seed: seed + 1 });
    const rand = seeded(seed + 2);
    const total = Math.max(1, Math.min(120, Math.round(rounds) || 0));

    let live = start.map(a => ({ ...a, opinion: a.start, moved: 0, swayed: 0 }));

    const frames = [];

    const snap = (round, note) => {
        const values = live.map(a => a.opinion);
        const forN = values.filter(v => v > 0.15).length;
        const againstN = values.filter(v => v < -0.15).length;

        frames.push({
            round,
            note: note || null,
            mean: meanOf(values),
            forShare: forN / values.length,
            againstShare: againstN / values.length,
            neutralShare: (values.length - forN - againstN) / values.length,
            clusters: clustersOf(values, 0.22).length,
            districts: districtsOf(live, bounds, { cells }),
            agents: live.map(a => ({
                id: a.id,
                latitude: a.latitude,
                longitude: a.longitude,
                opinion: a.opinion,
                label: a.label
            }))
        });
    };

    snap(0, 'قبل الحدث');

    /*
     * قوّة الحدث على كل وكيل، محسوبة مرّة لا في كل جولة.
     *
     * تتضاءل خطّياً من المركز إلى حافّة النطاق، وتنعدم خارجه. فمن
     * بَعُد لا يتأثّر مباشرةً — ويبقى أن يصله الخبر من جيرانه، وهو
     * ما يُنتج الانتشار.
     */
    const exposure = live.map(a => {
        if (!event) return 0;
        const d = haversine(event, a);
        if (!Number.isFinite(d) || d > event.radius) return 0;
        return 1 - (d / event.radius) * 0.7;
    });

    const startAt = event ? Math.max(1, Math.min(total, Math.round(event.at) || 4)) : -1;
    let force = 0;

    for (let round = 1; round <= total; round++) {
        let note = null;

        if (round === startAt) {
            force = Math.max(0, Math.min(1, event.force ?? 0.6));
            note = event.label || 'الحدث';
        }

        if (force > 0.01) {
            /* الحقل لكل وكيل بقدر تعرّضه: ‎stepCrowd‎ يأخذ حقلاً
               واحداً، فنُطبّق التعرّض هنا ثم نُمرّر الباقي إليه */
            live = live.map((a, i) => {
                const give = force * exposure[i] * (1 - a.stubborn);
                if (give <= 0) return a;

                const pulled = a.opinion * (1 - give) + event.toward * give;
                return { ...a, opinion: Math.max(-1, Math.min(1, pulled)) };
            });
        }

        live = stepCrowd(live, links, { noise: 0, rand });
        snap(round, note);

        force *= 0.72;
        if (force < 0.01) force = 0;
    }

    const lastFrame = frames[frames.length - 1];
    const firstFrame = frames[0];

    /* أكثر منطقة تحوّلاً: الفرق بين رأيها أوّلاً وآخراً */
    const byKey = new Map(firstFrame.districts.map(d => [d.key, d.mean]));
    let swung = null;

    for (const d of lastFrame.districts) {
        const was = byKey.get(d.key);
        if (was === undefined) continue;

        const shift = d.mean - was;
        if (!swung || Math.abs(shift) > Math.abs(swung.shift)) swung = { ...d, was, shift };
    }

    return {
        links,
        frames,
        event: event ? { ...event, at: startAt } : null,
        outcome: {
            forShare: lastFrame.forShare,
            againstShare: lastFrame.againstShare,
            neutralShare: lastFrame.neutralShare,
            mean: lastFrame.mean,
            shift: lastFrame.mean - firstFrame.mean,
            clusters: lastFrame.clusters,
            swung,
            strongestFor: [...lastFrame.districts].sort((a, b) => b.mean - a.mean)[0] || null,
            strongestAgainst: [...lastFrame.districts].sort((a, b) => a.mean - b.mean)[0] || null
        }
    };
};

/** دائرة بالأمتار كمضلّع — ‎MapLibre‎ يرسم نصف القطر بالبكسلات لا بالأمتار */
export const circlePolygon = (centre, radiusM, steps = 64) => {
    const lat = +centre.latitude;
    const lon = +centre.longitude;

    const latR = radiusM / 111320;
    const lonR = latR / Math.max(0.1, Math.cos((lat * Math.PI) / 180));

    const ring = [];
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        ring.push([lon + Math.cos(t) * lonR, lat + Math.sin(t) * latR]);
    }

    return { type: 'Polygon', coordinates: [ring] };
};
