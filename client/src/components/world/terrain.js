/* ============================================================
   نظام التضاريس — Heightmap

   الأرض ليست مستوى واحداً بل شبكة ارتفاعات: كل عقدة فيها رقم
   بالمتر، ومنها تُبنى شبكة المثلّثات المرئية وهيكل الاصطدام معاً.
   هذا هو ما يجعل الحفرة حفرة فعلاً — تراها العين وتسقط فيها
   الفيزياء — لا خدعة تلوين على سطح مستوٍ.

   الملف كلّه حساب خالص: لا React ولا three. لذلك يُستدعى من داخل
   حلقة الإطار بلا إعادة رسم، ويُختبر في Node وحده.

   ثلاث عمليات عليه:
     ١) توليد إجرائي  (fBm فوق ضجيج Simplex)
     ٢) نحت موضعي     (رفع/خفض/تسوية/تنعيم/حفر) — رؤوس فقط، بلا صور
     ٣) حفظ واسترجاع  (Int16 بالسنتيمتر ثم base64)
   ============================================================ */

// مساحة المنطقة القابلة للنحت بالمتر — مربّع مركزه نقطة الأصل
export const TERRAIN_SPAN = 256;

// عدد العقد على كل ضلع. ١٢٩ عقدة = ١٢٨ خليّة = مترّان للخليّة:
// دقّة تكفي لحفرة وطلعة، وتبقى الشبكة ١٦٦٤١ رأساً لا مئات الألوف.
export const TERRAIN_GRID = 129;

export const TERRAIN_CELL = TERRAIN_SPAN / (TERRAIN_GRID - 1);

// حدود الارتفاع — تمنع فرشاة عالقة من دفع الأرض إلى ما لا نهاية
export const HEIGHT_LIMIT = 30;
export const DEPTH_LIMIT = -18;

const COUNT = TERRAIN_GRID * TERRAIN_GRID;
const HALF = TERRAIN_SPAN / 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * حقل الارتفاعات — كائن وحيد قابل للتغيير خارج مخزن React.
 *
 * السحب بالفرشاة يكتب هنا ستّين مرّة في الثانية؛ لو مرّ من zustand
 * لأعاد بناء شجرة المكوّنات مع كل بكسل. المشهد يقرأ `revision`
 * في حلقته ويُعيد رفع الشبكة إلى كرت الرسم حين يتغيّر الرقم فقط.
 *
 * `x` يمشي مع الفهرس ix و`z` مع iz، والفهرس المسطّح هو iz*GRID+ix.
 */
export const field = {
    grid: TERRAIN_GRID,
    span: TERRAIN_SPAN,
    cell: TERRAIN_CELL,
    heights: new Float32Array(COUNT),
    revision: 0,
    touched: false,   // هل فارقت الأرض الاستواء؟ — ملف عالم قديم يبقى مستوياً
    min: 0,
    max: 0
};

export const bumpRevision = () => { field.revision++; };

/** أصغر وأكبر ارتفاع — للعرض في اللوحة ولضبط مستوى الماء تلقائياً */
export const measureField = () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < COUNT; i++) {
        const h = field.heights[i];
        if (h < min) min = h;
        if (h > max) max = h;
    }
    field.min = min === Infinity ? 0 : min;
    field.max = max === -Infinity ? 0 : max;
    return { min: field.min, max: field.max };
};

// ── ضجيج Simplex ثنائي الأبعاد ───────────────────────────────
//
// نكتبه هنا بدل جلب مكتبة: الدالة ثلاثون سطراً، وإضافة حزمة
// لأجلها تُثقل ما يُنزَّل بلا مقابل.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const GRAD2 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
];

/** جدول تبديل مبعثر ببذرة ثابتة: نفس البذرة تعطي نفس التضاريس دائماً */
export const makePermutation = (seed) => {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = (seed >>> 0) || 1;
    const rnd = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };

    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = p[i]; p[i] = p[j]; p[j] = t;
    }

    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
};

/** يُعيد دالة ضجيج مداها ‎[-1, 1]‎ تقريباً */
export const makeNoise2D = (seed) => {
    const perm = makePermutation(seed);

    const corner = (x, y, gi) => {
        let t = 0.5 - x * x - y * y;
        if (t < 0) return 0;
        t *= t;
        const g = GRAD2[gi & 7];
        return t * t * (g[0] * x + g[1] * y);
    };

    return (xin, yin) => {
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);

        const t = (i + j) * G2;
        const x0 = xin - (i - t);
        const y0 = yin - (j - t);

        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;

        const ii = i & 255;
        const jj = j & 255;

        return 70 * (
            corner(x0, y0, perm[ii + perm[jj]]) +
            corner(x1, y1, perm[ii + i1 + perm[jj + j1]]) +
            corner(x2, y2, perm[ii + 1 + perm[jj + 1]])
        );
    };
};

// ── التوليد الإجرائي ────────────────────────────────────────

export const DEFAULT_GENERATION = {
    seed: 20260919,
    amplitude: 7,      // متر — فرق الارتفاع بين أخفض نقطة وأعلاها تقريباً
    roughness: 0.5,    // 0 تلال ناعمة ← 1 أرض مكسّرة
    featureScale: 0.55, // 0 تفاصيل صغيرة ← 1 تلال عريضة
    corridor: 0        // نصف عرض شريط يُسطَّح حول محور الطريق (متر)
};

/**
 * يملأ الحقل بتضاريس مولّدة.
 *
 * fBm: أربع طبقات ضجيج، كل طبقة ضعف تردّد سابقتها وأقلّ سعة — وهي
 * الوصفة التي تُعطي تلالاً كبيرة عليها نتوءات صغيرة بدل موجة واحدة
 * منتظمة تُقرأ كقماش لا كأرض.
 *
 * `corridor` يُسطّح شريطاً حول محور الطريق: طريق حقيقي يُشقّ في
 * الأرض ولا يتسلّق كل نتوء تصادفه.
 */
export const generateTerrain = (options = {}) => {
    const o = { ...DEFAULT_GENERATION, ...options };
    const noise = makeNoise2D(o.seed);

    // تردّد أساسي: كلما كبر «مقاس التضاريس» اتّسعت التلّة الواحدة
    const baseFreq = 0.0042 / clamp(o.featureScale, 0.15, 1);
    const persistence = 0.34 + clamp(o.roughness, 0, 1) * 0.3;

    const h = field.heights;

    for (let iz = 0; iz < TERRAIN_GRID; iz++) {
        const z = iz * TERRAIN_CELL - HALF;

        for (let ix = 0; ix < TERRAIN_GRID; ix++) {
            const x = ix * TERRAIN_CELL - HALF;

            let amp = 1;
            let freq = baseFreq;
            let sum = 0;
            let norm = 0;

            for (let octave = 0; octave < 4; octave++) {
                sum += noise(x * freq, z * freq) * amp;
                norm += amp;
                amp *= persistence;
                freq *= 2.07;   // ليس ٢ تماماً: يكسر التكرار المرئي
            }

            let value = (sum / norm) * o.amplitude;

            if (o.corridor > 0) {
                const d = Math.abs(x) - o.corridor;
                const t = clamp(d / (o.corridor * 1.5), 0, 1);
                value *= t * t * (3 - 2 * t);   // انتقال ناعم من المسطّح للتلّة
            }

            h[iz * TERRAIN_GRID + ix] = clamp(value, DEPTH_LIMIT, HEIGHT_LIMIT);
        }
    }

    field.touched = true;
    measureField();
    bumpRevision();
    return field;
};

/** يُعيد الأرض مستوية تماماً — العودة إلى المشهد الأصلي */
export const flattenTerrain = () => {
    field.heights.fill(0);
    field.touched = false;
    field.min = 0;
    field.max = 0;
    bumpRevision();
    return field;
};

// ── القراءة ─────────────────────────────────────────────────

const sample = (ix, iz) => {
    const cx = ix < 0 ? 0 : ix > TERRAIN_GRID - 1 ? TERRAIN_GRID - 1 : ix;
    const cz = iz < 0 ? 0 : iz > TERRAIN_GRID - 1 ? TERRAIN_GRID - 1 : iz;
    return field.heights[cz * TERRAIN_GRID + cx];
};

/**
 * ارتفاع الأرض عند نقطة بالمتر — استيفاء ثنائي الخطّية بين أربع عقد.
 *
 * بلا استيفاء تقفز الشخصية درجةً كل مترين. وخارج المساحة المنحوتة
 * نُعيد ارتفاع الحافّة، فلا تهوي الأرض فجأة عند الحدّ.
 */
export const heightAt = (x, z) => {
    if (!field.touched) return 0;

    const gx = (x + HALF) / TERRAIN_CELL;
    const gz = (z + HALF) / TERRAIN_CELL;

    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;

    const h00 = sample(ix, iz);
    const h10 = sample(ix + 1, iz);
    const h01 = sample(ix, iz + 1);
    const h11 = sample(ix + 1, iz + 1);

    return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz);
};

/** ناظم السطح — منه تُشتقّ محاذاة المركبة لميل الأرض */
export const normalAt = (x, z) => {
    if (!field.touched) return [0, 1, 0];

    const d = TERRAIN_CELL;
    const dx = heightAt(x + d, z) - heightAt(x - d, z);
    const dz = heightAt(x, z + d) - heightAt(x, z - d);

    // ناظم مستوى مماسّ: (-dh/dx, 2d, -dh/dz) ثم تطبيع
    const nx = -dx;
    const ny = 2 * d;
    const nz = -dz;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
};

/** الميل بالراديان: صفر أرض مستوية، π/2 جدار قائم */
export const slopeAt = (x, z) => Math.acos(clamp(normalAt(x, z)[1], -1, 1));

// ── النحت ───────────────────────────────────────────────────

export const SCULPT_TOOLS = ['raise', 'lower', 'flatten', 'smooth', 'dig'];

/**
 * وزن الفرشاة عند بُعد d عن مركزها.
 * منحنى ناعم عند الحافّة: حوافّ حادّة تترك دَرَجاً يُقرأ كخطأ.
 */
const falloff = (d, radius) => {
    if (d >= radius) return 0;
    const t = 1 - d / radius;
    return t * t * (3 - 2 * t);
};

/**
 * يضرب الفرشاة مرّة واحدة عند نقطة.
 *
 * يعمل على منطقة محدودة حول النقطة لا على الشبكة كلّها: الضربة
 * الواحدة تلمس بضع مئات العقد مهما اتّسعت الأرض، وهذا وحده ما
 * يجعل النحت المباشر ممكناً في زمن الإطار.
 *
 * @returns عدد العقد التي تغيّرت
 */
export const sculptAt = (x, z, options = {}) => {
    const tool = options.tool || 'raise';
    const radius = clamp(options.radius ?? 12, TERRAIN_CELL, TERRAIN_SPAN / 2);
    const strength = clamp(options.strength ?? 0.7, 0, 1);
    const dt = clamp(options.dt ?? 0.016, 0, 0.1);
    const level = options.level;

    // متر في الثانية عند مركز الفرشاة
    const rate = strength * (tool === 'dig' ? 26 : 14) * dt;

    const gx = (x + HALF) / TERRAIN_CELL;
    const gz = (z + HALF) / TERRAIN_CELL;
    const gr = radius / TERRAIN_CELL;

    const x0 = Math.max(0, Math.floor(gx - gr));
    const x1 = Math.min(TERRAIN_GRID - 1, Math.ceil(gx + gr));
    const z0 = Math.max(0, Math.floor(gz - gr));
    const z1 = Math.min(TERRAIN_GRID - 1, Math.ceil(gz + gr));

    if (x1 < x0 || z1 < z0) return 0;

    const h = field.heights;

    // التنعيم يقرأ الجوار قبل أن يكتب، وإلا زحف المتوسّط مع اتجاه المرور
    const before = tool === 'smooth' ? Float32Array.from(h) : null;

    // «التسوية» تحتاج ارتفاعاً هدفاً: ما تحت مركز الفرشاة لحظة بدء
    // السحبة — تُمرَّر من الخارج كي تثبت طوال السحبة الواحدة
    const target = Number.isFinite(level) ? level : heightAt(x, z);

    let changed = 0;

    for (let iz = z0; iz <= z1; iz++) {
        const wz = iz * TERRAIN_CELL - HALF;

        for (let ix = x0; ix <= x1; ix++) {
            const wx = ix * TERRAIN_CELL - HALF;
            const w = falloff(Math.hypot(wx - x, wz - z), radius);
            if (w <= 0) continue;

            const i = iz * TERRAIN_GRID + ix;
            const current = h[i];
            let next = current;

            if (tool === 'raise') {
                next = current + rate * w;
            } else if (tool === 'lower' || tool === 'dig') {
                next = current - rate * w;
            } else if (tool === 'flatten') {
                next = lerp(current, target, clamp(w * strength * dt * 9, 0, 1));
            } else if (tool === 'smooth') {
                const avg = (
                    before[i] * 2 +
                    before[iz * TERRAIN_GRID + Math.max(0, ix - 1)] +
                    before[iz * TERRAIN_GRID + Math.min(TERRAIN_GRID - 1, ix + 1)] +
                    before[Math.max(0, iz - 1) * TERRAIN_GRID + ix] +
                    before[Math.min(TERRAIN_GRID - 1, iz + 1) * TERRAIN_GRID + ix]
                ) / 6;
                next = lerp(current, avg, clamp(w * strength * dt * 12, 0, 1));
            }

            next = clamp(next, DEPTH_LIMIT, HEIGHT_LIMIT);
            if (next !== current) { h[i] = next; changed++; }
        }
    }

    if (changed) {
        field.touched = true;
        bumpRevision();
    }
    return changed;
};

/**
 * يُسوّي مربّعاً من الأرض إلى ارتفاع واحد.
 *
 * تُستدعى حين تُرصف بلاطة شارع: البلاطة صفيحة مستوية، وإسقاطها على
 * منحدر يترك حافّة معلّقة في الهواء. نُسوّي ما تحتها ونُذيب الحافّة
 * في محيطها حتى لا يظهر مكعّب مقصوص.
 *
 * @returns الارتفاع الذي استقرّت عليه البلاطة
 */
export const flattenArea = (x, z, size, levelOverride) => {
    const half = size / 2;
    const feather = size * 0.55;   // هامش الذوبان حول المربّع

    const level = Number.isFinite(levelOverride) ? levelOverride : heightAt(x, z);

    const reach = half + feather;
    const gx = (x + HALF) / TERRAIN_CELL;
    const gz = (z + HALF) / TERRAIN_CELL;
    const gr = reach / TERRAIN_CELL;

    const x0 = Math.max(0, Math.floor(gx - gr));
    const x1 = Math.min(TERRAIN_GRID - 1, Math.ceil(gx + gr));
    const z0 = Math.max(0, Math.floor(gz - gr));
    const z1 = Math.min(TERRAIN_GRID - 1, Math.ceil(gz + gr));

    const h = field.heights;
    let changed = 0;

    for (let iz = z0; iz <= z1; iz++) {
        const wz = iz * TERRAIN_CELL - HALF;

        for (let ix = x0; ix <= x1; ix++) {
            const wx = ix * TERRAIN_CELL - HALF;

            // مسافة تشيبيشيف: المربّع يُسوّى بالكامل لا دائرة داخله
            const d = Math.max(Math.abs(wx - x), Math.abs(wz - z));
            if (d >= reach) continue;

            const t = d <= half ? 1 : 1 - (d - half) / feather;
            const w = t * t * (3 - 2 * t);

            const i = iz * TERRAIN_GRID + ix;
            const next = clamp(lerp(h[i], level, w), DEPTH_LIMIT, HEIGHT_LIMIT);
            if (next !== h[i]) { h[i] = next; changed++; }
        }
    }

    if (changed) {
        field.touched = true;
        bumpRevision();
    }
    return level;
};

// ── الحفظ والاسترجاع ────────────────────────────────────────
//
// Int16 بالسنتيمتر: دقّة سنتيمتر واحد تكفي أرضاً يمشي عليها إنسان،
// وتُنصّف حجم الملف مقابل Float32. ثم base64 كي يبقى JSON نصّاً.

const bytesToBase64 = (bytes) => {
    if (typeof btoa === 'function') {
        let binary = '';
        const CHUNK = 0x8000;   // دفعات: spread فوق ١٢٨ ألف وسيط يفجّر المكدّس
        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    throw new Error('لا مُرمِّز base64 في هذه البيئة');
};

const base64ToBytes = (text) => {
    if (typeof atob === 'function') {
        const binary = atob(text);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(text, 'base64'));
    throw new Error('لا مُفكِّك base64 في هذه البيئة');
};

/** يُعيد null إن كانت الأرض مستوية — فلا نُثقل الملف بستّة عشر ألف صفر */
export const serializeField = () => {
    if (!field.touched) return null;

    const ints = new Int16Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
        ints[i] = Math.round(clamp(field.heights[i], DEPTH_LIMIT, HEIGHT_LIMIT) * 100);
    }

    return {
        grid: TERRAIN_GRID,
        span: TERRAIN_SPAN,
        unit: 0.01,
        data: bytesToBase64(new Uint8Array(ints.buffer, ints.byteOffset, ints.byteLength))
    };
};

/**
 * يُحمّل حقلاً محفوظاً.
 *
 * ملف بشبكة مختلفة المقاس لا يُرفض: نُعيد أخذ عيّناته إلى شبكتنا.
 * وإلا فقد كل من حفظ عالماً قبل تغيير الدقّة أرضه كلّها.
 */
export const loadField = (saved) => {
    if (!saved || typeof saved !== 'object' || typeof saved.data !== 'string') {
        flattenTerrain();
        return false;
    }

    const bytes = base64ToBytes(saved.data);
    const ints = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);

    const srcGrid = Number(saved.grid) || TERRAIN_GRID;
    const srcSpan = Number(saved.span) || TERRAIN_SPAN;
    const unit = Number(saved.unit) || 0.01;

    if (ints.length < srcGrid * srcGrid) {
        flattenTerrain();
        return false;
    }

    const h = field.heights;

    if (srcGrid === TERRAIN_GRID && srcSpan === TERRAIN_SPAN) {
        for (let i = 0; i < COUNT; i++) h[i] = ints[i] * unit;
    } else {
        const srcHalf = srcSpan / 2;
        const srcCell = srcSpan / (srcGrid - 1);

        for (let iz = 0; iz < TERRAIN_GRID; iz++) {
            const z = iz * TERRAIN_CELL - HALF;

            for (let ix = 0; ix < TERRAIN_GRID; ix++) {
                const x = ix * TERRAIN_CELL - HALF;

                const sx = clamp((x + srcHalf) / srcCell, 0, srcGrid - 1);
                const sz = clamp((z + srcHalf) / srcCell, 0, srcGrid - 1);

                const i0 = Math.floor(sx);
                const j0 = Math.floor(sz);
                const i1 = Math.min(srcGrid - 1, i0 + 1);
                const j1 = Math.min(srcGrid - 1, j0 + 1);

                const a = ints[j0 * srcGrid + i0] * unit;
                const b = ints[j0 * srcGrid + i1] * unit;
                const c = ints[j1 * srcGrid + i0] * unit;
                const d = ints[j1 * srcGrid + i1] * unit;

                h[iz * TERRAIN_GRID + ix] = lerp(
                    lerp(a, b, sx - i0),
                    lerp(c, d, sx - i0),
                    sz - j0
                );
            }
        }
    }

    field.touched = true;
    measureField();
    bumpRevision();
    return true;
};

// ── مساعدات للمشهد ──────────────────────────────────────────

/**
 * ارتفاعات بترتيب Rapier للـ heightfield.
 *
 * Parry يخزّن مصفوفة الارتفاعات عموداً عموداً: الصفّ يتبع محور z
 * والعمود يتبع محور x، فالفهرس هو ‎iz + ix*grid‎ — منقول عن ترتيبنا
 * ‎iz*grid + ix‎. خطأ النقل هنا لا يُرى بالعين: الأرض تبدو سليمة
 * والسيارة تصطدم بتضاريس معكوسة.
 */
export const heightsForRapier = () => {
    const out = new Float32Array(COUNT);
    for (let iz = 0; iz < TERRAIN_GRID; iz++) {
        for (let ix = 0; ix < TERRAIN_GRID; ix++) {
            out[ix * TERRAIN_GRID + iz] = field.heights[iz * TERRAIN_GRID + ix];
        }
    }
    return out;
};

/** هل النقطة داخل المساحة المنحوتة؟ خارجها الأرض مستوية دائماً */
export const insideTerrain = (x, z) => Math.abs(x) <= HALF && Math.abs(z) <= HALF;

/** عمق الماء عند نقطة — سالب يعني أن الأرض فوق سطح الماء */
export const waterDepthAt = (x, z, level) => level - heightAt(x, z);
