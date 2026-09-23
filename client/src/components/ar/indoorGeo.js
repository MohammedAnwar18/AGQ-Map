/* ============================================================
   هندسة الملاحة الداخلية

   كل ما في هذه الطبقة حساب خالص: لا DOM ولا كاميرا ولا React.
   ولذلك تُختبر في Node وحدها — وهي الطبقة التي إن أخطأت فيها
   بدرجةٍ واحدة انحرف السهم متراً بعد عشرة أمتار.

   ── الفكرة المركزية ──

   الهاتف لا يعرف أين هو داخل مبنى: لا GPS يخترق السقف، ولا تتبّع
   مواضع في متصفّح الجوال عموماً. لكنه يعرف **اتجاهه** بدقّة —
   البوصلة والميل والدوران — ويعرف **ارتفاع العين** لأننا نسأل عنه.

   ومن هذين وحدهما ينشأ كل شيء: كل نقطة على الشاشة تحت خطّ الأفق
   تقابل نقطة واحدة معيّنة على الأرض. فالإصبع الذي يرسم على الشاشة
   يرسم على الأرض فعلاً، والسهم الذي نضعه على الأرض يبقى ملتصقاً
   بها حين تدير الهاتف.

   ── الإطار المرجعي ──

   x = شرق، y = أعلى، z = شمال. بالأمتار. الأصل نقطة يختارها الأدمن
   عند إنشاء المشروع، وكل شيء بعدها يُقاس منها.
   ============================================================ */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export const toRad = (deg) => deg * D2R;
export const toDeg = (rad) => rad * R2D;

/** يُعيد الزاوية إلى المدى ‎[0, 360)‎ */
export const normalizeAngle = (deg) => ((deg % 360) + 360) % 360;

/** أقصر فرق بين زاويتين — في المدى ‎(-180, 180]‎ */
export const angleDelta = (from, to) => {
    let d = normalizeAngle(to - from);
    if (d > 180) d -= 360;
    return d;
};

// ── وضعية الجهاز ────────────────────────────────────────────

/**
 * الوضعية: اتجاه الكاميرا وميلها ودورانها.
 *
 * heading: اتجاه بوصلي للكاميرا (٠ شمال، يزيد مع عقارب الساعة)
 * pitch:   ارتفاع محور الكاميرا عن الأفق (سالب = ينظر للأرض)
 * roll:    ميل الجهاز حول محور نظره
 */
export const DEFAULT_POSE = { heading: 0, pitch: 0, roll: 0 };

/**
 * يحوّل قراءة مستشعر الاتّجاه إلى وضعية.
 *
 * ‎beta‎ تساوي تسعين حين يُمسك الهاتف قائماً والكاميرا تنظر إلى
 * الأفق، فالميل هو ‎beta − 90‎. و‎webkitCompassHeading‎ على iOS
 * اتّجاه جاهز، أما ‎alpha‎ على أندرويد فتُقاس عكس عقارب الساعة
 * فنطرحها من ٣٦٠.
 */
export const poseFromOrientation = (event, screenAngle = 0) => {
    if (!event) return { ...DEFAULT_POSE };

    const alpha = Number(event.alpha) || 0;
    const beta = Number(event.beta) || 0;
    const gamma = Number(event.gamma) || 0;

    const compass = Number.isFinite(event.webkitCompassHeading)
        ? event.webkitCompassHeading
        : normalizeAngle(360 - alpha);

    // دوران الشاشة يُزيح البوصلة بنفس المقدار: هاتف ممسوك بالعرض
    // يرى نفس المشهد لكن قراءته انزاحت تسعين درجة
    return {
        heading: normalizeAngle(compass + screenAngle),
        pitch: clamp(beta - 90, -89.5, 89.5),
        roll: gamma
    };
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ── قاعدة الكاميرا ──────────────────────────────────────────

/**
 * متّجهات الكاميرا الثلاثة من وضعيّتها.
 *
 * مبنيّة صراحةً لا بالضرب الاتّجاهي: الضرب الاتّجاهي يُخطئ إشارته
 * بسهولة في إطار غير قياسي، والصيغة الصريحة تُختبر عدديّاً.
 *
 *   forward  اتجاه نظر الكاميرا
 *   right    يمين المشاهد، أفقيّ دائماً
 *   up       أعلى الصورة، عموديّ على النظر
 */
export const cameraBasis = ({ heading = 0, pitch = 0 } = {}) => {
    const h = toRad(heading);
    const p = toRad(pitch);

    const sh = Math.sin(h);
    const ch = Math.cos(h);
    const sp = Math.sin(p);
    const cp = Math.cos(p);

    return {
        forward: [sh * cp, sp, ch * cp],
        right: [ch, 0, -sh],
        up: [-sh * sp, cp, -ch * sp]
    };
};

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ── مجال الرؤية ─────────────────────────────────────────────

/**
 * ظلّ نصف مجال الرؤية أفقياً ورأسياً.
 *
 * getUserMedia لا تُفصح عن مجال رؤية الكاميرا — لا في المواصفة ولا
 * في أي متصفّح. فنأخذه إعداداً للمشروع يُعايره الأدمن مرّة، ونشتقّ
 * الرأسي من نسبة العرض إلى الارتفاع: شاشة أطول ترى رأسياً أكثر.
 *
 * @param aspect العرض ÷ الارتفاع (٠٫٥٦ لهاتف قائم)
 */
export const tangents = (fovHorizontalDeg = 65, aspect = 0.5625) => {
    const tanH = Math.tan(toRad(clamp(fovHorizontalDeg, 25, 120)) / 2);
    return { tanH, tanV: tanH / Math.max(0.2, aspect) };
};

// ── الإسقاط على الأرض ───────────────────────────────────────

/**
 * نقطة على الشاشة ← نقطة على الأرض.
 *
 * @param sx,sy  إحداثيات مُطبّعة: ‎-1..1‎ يميناً و‎-1..1‎ لأعلى
 * @param pose   وضعية الجهاز
 * @param origin موضع الواقف ‎{x, z}‎ بالأمتار
 * @param eye    ارتفاع الكاميرا عن الأرض بالأمتار
 * @returns ‎{x, z, distance}‎ أو null إن كانت النقطة فوق الأفق
 *
 * النقطة فوق الأفق لا تُقابل شيئاً على الأرض: شعاعها يصعد ولا يلتقي
 * بالمستوى أبداً. وإعادة null هنا أصدق من إعادة رقم ضخم.
 */
export const screenToFloor = (sx, sy, pose, origin = { x: 0, z: 0 }, eye = 1.5, fov = 65, aspect = 0.5625) => {
    const { tanH, tanV } = tangents(fov, aspect);
    const { forward, right, up } = cameraBasis(pose);

    // فكّ دوران الجهاز: الإصبع يلمس الشاشة المائلة، والحساب يريد
    // إحداثيات صورة مستوية
    const r = toRad(pose.roll || 0);
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const ix = sx * cr - sy * sr;
    const iy = sx * sr + sy * cr;

    const dx = forward[0] + right[0] * ix * tanH + up[0] * iy * tanV;
    const dy = forward[1] + right[1] * ix * tanH + up[1] * iy * tanV;
    const dz = forward[2] + right[2] * ix * tanH + up[2] * iy * tanV;

    // الشعاع يجب أن ينزل ليلتقي بالأرض، وبفارق معتبر: شعاع يكاد
    // يوازي الأرض يلتقي بها على بُعد كيلومتر — رقم صحيح رياضياً
    // وعديم المعنى هنا
    if (dy > -0.02) return null;

    const t = eye / -dy;
    const len = Math.hypot(dx, dy, dz) * t;

    return {
        x: origin.x + dx * t,
        z: origin.z + dz * t,
        distance: Math.hypot(dx * t, dz * t),
        ray: len
    };
};

/**
 * اتّجاه الشعاع الخارج من نقطة على الشاشة — متّجه وحدة.
 *
 * مفصول عن إسقاط الأرض لأن ليس كل ما نُشير إليه على الأرض: رفّ على
 * جدار، ولافتة محلّ، وباب مصعد — كلّها فوقها. وهذه تُعطي الاتّجاه
 * وحده، والمسافة تأتي من مكان آخر.
 */
export const screenRay = (sx, sy, pose, fov = 65, aspect = 0.5625) => {
    const { tanH, tanV } = tangents(fov, aspect);
    const { forward, right, up } = cameraBasis(pose);

    const r = toRad(pose.roll || 0);
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const ix = sx * cr - sy * sr;
    const iy = sx * sr + sy * cr;

    const dx = forward[0] + right[0] * ix * tanH + up[0] * iy * tanV;
    const dy = forward[1] + right[1] * ix * tanH + up[1] * iy * tanV;
    const dz = forward[2] + right[2] * ix * tanH + up[2] * iy * tanV;

    const len = Math.hypot(dx, dy, dz) || 1;
    return [dx / len, dy / len, dz / len];
};

/**
 * النقطة التي تقع على مسافة معيّنة في اتّجاه النظر.
 *
 * هذه هي طريقة تحديد ما ليس على الأرض: توجّه الكاميرا إلى الشيء،
 * وتضبط المسافة حتى تستقرّ الحلقة عليه. لا عمق في كاميرا الهاتف
 * عبر المتصفّح، فالمسافة يقولها من يرى — وهو أصدق من تخمينها.
 *
 * @returns ‎{x, y, z, distance}‎ — y ارتفاعها عن الأرض
 */
export const pointAlongRay = (sx, sy, pose, origin = { x: 0, z: 0 }, eye = 1.5, distance = 3, fov = 65, aspect = 0.5625) => {
    const [dx, dy, dz] = screenRay(sx, sy, pose, fov, aspect);
    const d = Math.max(0.2, distance);

    return {
        x: origin.x + dx * d,
        y: Math.max(0, eye + dy * d),
        z: origin.z + dz * d,
        distance: d
    };
};

/**
 * ما تُشير إليه الكاميرا الآن.
 *
 * تُفضّل الأرض حين تكون في المدى المعقول — فهي مقاسة لا مُخمَّنة —
 * وإلا فنقطة على الشعاع بالمسافة التي يختارها المستخدم.
 */
export const aimPoint = (pose, origin, eye, fallbackDistance, fov, aspect, { preferRay = false, maxFloor = 22 } = {}) => {
    if (!preferRay) {
        const floor = screenToFloor(0, 0, pose, origin, eye, fov, aspect);
        if (floor && floor.distance <= maxFloor) {
            return { x: floor.x, y: 0, z: floor.z, distance: floor.distance, onFloor: true };
        }
    }

    return { ...pointAlongRay(0, 0, pose, origin, eye, fallbackDistance, fov, aspect), onFloor: false };
};

/**
 * نقطة في العالم ← نقطة على الشاشة.
 *
 * عكس الدالة أعلاه تماماً، وهي ما يرسم المسار على الأرض: كل نقطة
 * من خطّ المسار تُسقَط على الصورة، فيبدو الخطّ مفروشاً على البلاط.
 *
 * @param y ارتفاع النقطة عن الأرض (صفر = على الأرض)
 * @returns ‎{sx, sy, depth}‎ أو null إن كانت خلف الكاميرا
 */
export const worldToScreen = (point, pose, origin = { x: 0, z: 0 }, eye = 1.5, fov = 65, aspect = 0.5625) => {
    const { tanH, tanV } = tangents(fov, aspect);
    const { forward, right, up } = cameraBasis(pose);

    const v = [
        point.x - origin.x,
        (point.y || 0) - eye,
        point.z - origin.z
    ];

    const depth = dot3(v, forward);
    if (depth <= 0.08) return null;   // خلف الكاميرا أو ملتصق بها

    const ix = dot3(v, right) / (depth * tanH);
    const iy = dot3(v, up) / (depth * tanV);

    // وإعادة دوران الجهاز، فما يُرسم يوافق ما يُرى
    const r = toRad(pose.roll || 0);
    const cr = Math.cos(r);
    const sr = Math.sin(r);

    return {
        sx: ix * cr + iy * sr,
        sy: -ix * sr + iy * cr,
        depth
    };
};

/** من الإحداثيات المُطبّعة إلى بكسلات اللوحة */
export const toPixels = ({ sx, sy }, width, height) => ({
    x: (sx * 0.5 + 0.5) * width,
    y: (0.5 - sy * 0.5) * height
});

/** ومن بكسلات اللمس إلى المُطبّعة */
export const fromPixels = (px, py, width, height) => ({
    sx: (px / width) * 2 - 1,
    sy: 1 - (py / height) * 2
});

// ── قياسات على الأرض ────────────────────────────────────────

export const distance2D = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

/** الاتّجاه البوصلي من نقطة إلى أخرى */
export const bearingTo = (from, to) =>
    normalizeAngle(toDeg(Math.atan2(to.x - from.x, to.z - from.z)));

/** طول خطّ متعدّد المقاطع */
export const polylineLength = (points) => {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += distance2D(points[i - 1], points[i]);
    return total;
};

/**
 * يُقلّل نقاط خطّ مرسوم بالإصبع.
 *
 * Ramer–Douglas–Peucker: الإصبع يترك مئتي نقطة في مسحة واحدة،
 * وعشرٌ منها تصف نفس الشكل. والفرق يظهر في حجم ما يُحفظ وفي زمن
 * رسمه في كل إطار.
 */
export const simplifyPath = (points, tolerance = 0.25) => {
    if (points.length <= 2) return points.slice();

    const sqTol = tolerance * tolerance;

    const sqSegDistance = (p, a, b) => {
        let x = a.x;
        let z = a.z;
        let dx = b.x - x;
        let dz = b.z - z;

        if (dx !== 0 || dz !== 0) {
            const t = ((p.x - x) * dx + (p.z - z) * dz) / (dx * dx + dz * dz);
            if (t > 1) { x = b.x; z = b.z; }
            else if (t > 0) { x += dx * t; z += dz * t; }
        }

        dx = p.x - x;
        dz = p.z - z;
        return dx * dx + dz * dz;
    };

    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;

    const stack = [[0, points.length - 1]];

    while (stack.length) {
        const [first, last] = stack.pop();
        let maxSq = 0;
        let index = -1;

        for (let i = first + 1; i < last; i++) {
            const sq = sqSegDistance(points[i], points[first], points[last]);
            if (sq > maxSq) { maxSq = sq; index = i; }
        }

        if (maxSq > sqTol && index > 0) {
            keep[index] = true;
            stack.push([first, index], [index, last]);
        }
    }

    return points.filter((_, i) => keep[i]);
};

/**
 * أقرب نقطة على خطّ المسار، وكم قُطع منه.
 *
 * هي أساس التوجيه: تُخبرنا أين المستخدم من المسار، وكم بقي،
 * وهل انحرف عنه.
 */
export const projectOnPath = (points, p) => {
    if (!points.length) return null;
    if (points.length === 1) {
        return { index: 0, point: points[0], along: 0, offset: distance2D(points[0], p) };
    }

    let best = { index: 0, point: points[0], along: 0, offset: Infinity };
    let travelled = 0;

    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lenSq = dx * dx + dz * dz;
        const segLen = Math.sqrt(lenSq);

        let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq : 0;
        t = clamp(t, 0, 1);

        const point = { x: a.x + dx * t, z: a.z + dz * t };
        const offset = distance2D(point, p);

        if (offset < best.offset) {
            best = { index: i - 1, point, along: travelled + segLen * t, offset };
        }
        travelled += segLen;
    }

    best.total = travelled;
    best.remaining = Math.max(0, travelled - best.along);
    return best;
};

/**
 * التعليمة التالية: إلى أين تتّجه، ومتى تنعطف.
 *
 * نقرأ المسار من موضعك إلى الأمام حتى نجد انعطافاً يستحقّ الذكر —
 * أقلّ من عشرين درجة ليس انعطافاً بل انحناءة ممشى.
 */
export const nextInstruction = (points, along, turnThreshold = 22) => {
    if (points.length < 2) return null;

    // نجمع أطوال المقاطع مرّة
    const cum = [0];
    for (let i = 1; i < points.length; i++) {
        cum.push(cum[i - 1] + distance2D(points[i - 1], points[i]));
    }
    const total = cum[cum.length - 1];

    // المقطع الذي نحن فيه
    let seg = 0;
    while (seg < points.length - 2 && cum[seg + 1] <= along) seg++;

    const heading = bearingTo(points[seg], points[seg + 1]);

    for (let i = seg + 1; i < points.length - 1; i++) {
        const next = bearingTo(points[i], points[i + 1]);
        const turn = angleDelta(bearingTo(points[i - 1], points[i]), next);

        if (Math.abs(turn) >= turnThreshold) {
            return {
                heading,
                turn,
                side: turn > 0 ? 'right' : 'left',
                distance: Math.max(0, cum[i] - along),
                at: points[i],
                arrive: false
            };
        }
    }

    return {
        heading,
        turn: 0,
        side: null,
        distance: Math.max(0, total - along),
        at: points[points.length - 1],
        arrive: true
    };
};

// ── الرسم البياني والمسار الأقصر ────────────────────────────

/**
 * أقصر طريق بين عقدتين — Dijkstra.
 *
 * الشبكة صغيرة (عشرات العقد في مبنى)، فلا داعي لـ A* ولا لطابور
 * أولويات: مسح خطّي على كل خطوة أبسط وأسرع عند هذا الحجم.
 *
 * وزن الحافّة طول خطّها المرسوم لا المسافة المستقيمة: ممرّ ملتوٍ
 * أطول ممّا يبدو، واختيار الأقصر يجب أن يعرف ذلك.
 */
export const shortestRoute = (nodes, edges, fromId, toId) => {
    if (fromId === toId) return { nodes: [fromId], edges: [], length: 0 };

    const byId = new Map(nodes.map(n => [n.id, n]));
    if (!byId.has(fromId) || !byId.has(toId)) return null;

    // قائمة الجوار: الحافّة تعمل في الاتّجاهين ما لم تُعلَّم بغير ذلك
    const neighbours = new Map(nodes.map(n => [n.id, []]));

    for (const edge of edges) {
        const weight = edgeLength(edge, byId);
        if (!Number.isFinite(weight)) continue;

        neighbours.get(edge.from)?.push({ to: edge.to, edge, weight });
        if (!edge.oneWay) neighbours.get(edge.to)?.push({ to: edge.from, edge, weight, reversed: true });
    }

    const dist = new Map(nodes.map(n => [n.id, Infinity]));
    const prev = new Map();
    const done = new Set();
    dist.set(fromId, 0);

    while (done.size < nodes.length) {
        let current = null;
        let best = Infinity;

        for (const [id, d] of dist) {
            if (!done.has(id) && d < best) { best = d; current = id; }
        }

        if (current === null) break;      // ما بقي غير موصول
        if (current === toId) break;
        done.add(current);

        for (const link of neighbours.get(current) || []) {
            if (done.has(link.to)) continue;
            const candidate = best + link.weight;
            if (candidate < (dist.get(link.to) ?? Infinity)) {
                dist.set(link.to, candidate);
                // الحافّة نفسها لا غلافها: من يقرأ المسار يحتاج
                // ‎from‎ و‎to‎ و‎path‎، والغلاف لا يحمل منها إلا الوجهة
                prev.set(link.to, { from: current, edge: link.edge });
            }
        }
    }

    if (!Number.isFinite(dist.get(toId))) return null;

    const path = [];
    const used = [];
    let cursor = toId;

    while (cursor !== fromId) {
        const step = prev.get(cursor);
        if (!step) return null;
        path.unshift(cursor);
        used.unshift(step.edge);
        cursor = step.from;
    }
    path.unshift(fromId);

    return { nodes: path, edges: used, length: dist.get(toId) };
};

/** طول الحافّة: خطّها المرسوم إن وُجد، وإلا المسافة المستقيمة */
export const edgeLength = (edge, byId) => {
    if (Array.isArray(edge.path) && edge.path.length > 1) return polylineLength(edge.path);

    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    return a && b ? distance2D(a, b) : Infinity;
};

/**
 * يفرد المسار إلى خطّ واحد متّصل.
 *
 * كل حافّة تُقرأ في اتجاه سيرنا: الحافّة المرسومة من ب إلى أ تُعكس
 * حين نمرّ بها من أ إلى ب، وإلا انقلب المسار على نفسه.
 */
export const routePolyline = (route, nodes, edges) => {
    if (!route) return [];

    const byId = new Map(nodes.map(n => [n.id, n]));
    const points = [];

    const push = (p) => {
        // حافّة تشير إلى عقدة محذوفة تُعطي undefined: نتخطّاها ولا
        // نُسقط الملاحة كلّها لأجل رابط يتيم
        if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;

        const last = points[points.length - 1];
        if (!last || distance2D(last, p) > 0.05) points.push({ x: p.x, z: p.z });
    };

    push(byId.get(route.nodes[0]));

    for (let i = 0; i < route.edges.length; i++) {
        const edge = route.edges[i];
        const goingTo = route.nodes[i + 1];

        const line = Array.isArray(edge.path) && edge.path.length > 1
            ? edge.path.slice()
            : [byId.get(edge.from), byId.get(edge.to)].filter(Boolean);

        // الحافّة مخزّنة من ‎from‎ إلى ‎to‎؛ إن كنّا نسير عكسها نقلبها
        if (edge.to !== goingTo) line.reverse();

        line.forEach(push);
        push(byId.get(goingTo));
    }

    return points;
};

// ── تتبّع الخطوات ───────────────────────────────────────────

/**
 * طول الخطوة من طول القامة.
 *
 * نسبة معروفة في قياسات المشي: الخطوة نحو ٤١٪ من الطول للرجال
 * و٤٢٪ للنساء. نأخذ وسطاً، ويبقى قابلاً للمعايرة.
 */
export const strideFor = (heightMeters = 1.7) => clamp(heightMeters * 0.415, 0.45, 0.95);

/**
 * كاشف خطوات من مقياس التسارع.
 *
 * قمّة في مقدار التسارع تعني وقع قدم. والمرشّح ضروري: الإشارة
 * الخام مليئة برجفات تُعدّ كلّها خطوات. ومهلة بين الخطوتين تمنع
 * عدّ القمّة الواحدة مرّتين — أسرع مشية بشرية نحو خطوتين ونصف
 * في الثانية.
 */
export const createStepDetector = ({
    threshold = 1.15,
    minInterval = 280,
    smoothing = 0.22
} = {}) => {
    let filtered = 9.81;
    let baseline = 9.81;
    let rising = false;
    let lastStep = 0;
    let steps = 0;

    return {
        /** @returns true إن كانت هذه القراءة خطوة جديدة */
        push(magnitude, now) {
            if (!Number.isFinite(magnitude)) return false;

            filtered += (magnitude - filtered) * smoothing;
            baseline += (filtered - baseline) * 0.012;   // خطّ أساس بطيء يتتبّع الجاذبية

            const delta = filtered - baseline;

            if (!rising && delta > threshold) {
                rising = true;

                if (now - lastStep >= minInterval) {
                    lastStep = now;
                    steps++;
                    return true;
                }
            } else if (rising && delta < threshold * 0.4) {
                rising = false;
            }

            return false;
        },
        get count() { return steps; },
        reset() { steps = 0; rising = false; lastStep = 0; }
    };
};

/**
 * مُنعّم اتّجاه دائري.
 *
 * البوصلة ترتجف بضع درجات، والسهم يرتجف معها. والتنعيم الحسابي
 * العادي يُخطئ عند عبور الشمال — متوسّط ٣٥٩ و١ ليس ١٨٠ — فنُنعّم
 * جيبها وجيب تمامها بدل الزاوية نفسها.
 */
export const createHeadingFilter = (factor = 0.18) => {
    let sin = null;
    let cos = null;

    return {
        push(headingDeg) {
            const r = toRad(headingDeg);
            if (sin === null) { sin = Math.sin(r); cos = Math.cos(r); }
            else {
                sin += (Math.sin(r) - sin) * factor;
                cos += (Math.cos(r) - cos) * factor;
            }
            return normalizeAngle(toDeg(Math.atan2(sin, cos)));
        },
        reset() { sin = null; cos = null; }
    };
};

/** خطوة إلى الأمام: يُعيد الموضع الجديد */
export const advance = (position, headingDeg, metres) => {
    const h = toRad(headingDeg);
    return {
        x: position.x + Math.sin(h) * metres,
        z: position.z + Math.cos(h) * metres
    };
};

/** مسافة مقروءة: أمتار قريبة وأرقام مستديرة بعيداً */
export const readableDistance = (metres) => {
    if (!Number.isFinite(metres)) return '—';
    if (metres < 1) return 'أقل من متر';
    if (metres < 10) return `${metres.toFixed(1)} م`;
    return `${Math.round(metres)} م`;
};
