/* ============================================================
   التعرّف البصري على المكان

   ── ما هذا، وما ليس ──

   طلبتَ ما تفعله ARKit: خريطة نقاط للمكان، ومراسٍ عليها، وإعادة
   تعرّف عند العودة. وهذه واجهات أصلية لا يصل إليها متصفّح — وiOS
   لا يدعم WebXR أصلاً، فلا تتبّع ستّ درجات حرّية ولا ‎ARWorldMap‎
   في سفاري.

   لكن SLAM نصفان: تتبّع الحركة، و**التعرّف على المكان**. والنصف
   الثاني هو ما تريده فعلاً — «افتح الكاميرا في المطبخ فيعرف أنك
   في المطبخ» — وهو قابل للتنفيذ هنا بالكامل.

   ── كيف ──

   الأدمن يقف في موضع ويلتقط «بصمة» لما تراه الكاميرا. والزائر
   يلتقط بصمات متتالية من تيّاره الحيّ ويقارنها بالمحفوظ. أعلى
   تطابق فوق عتبة معيّنة يقول: أنت هنا، وبهذا الاتّجاه.

   ── لماذا هذه البصمة بالذات ──

   ليست الصورة نفسها: تختلف بأي تغيّر في الإضاءة أو زاوية الوقوف.

     • التدرّجات لا الألوان: اتّجاه الحافّة لا يتغيّر حين يُضاء
       المصباح — والحواف هي ما يصف شكل الغرفة.
     • التطبيع داخل كل خليّة: ما يُبطل أثر السطوع تماماً.
     • شبكة خشنة لا بكسلات: ٤٨ خليّة تصف «تركيب» المشهد وتتسامح
       مع خطوة إلى اليمين أو اليسار.
     • ولمحة لون خافتة معها: غرفتان بنفس الهندسة وألوان مختلفة
       تُميّزهما الألوان وحدها.

   كل ما هنا حساب خالص على مصفوفة بكسلات: لا DOM ولا كاميرا،
   فيُختبر في Node وحده.
   ============================================================ */

// شبكة البصمة — خشنة عمداً: الدقّة العالية تُفقد التسامح
export const CELLS_X = 8;
export const CELLS_Y = 6;
export const BINS = 8;                       // اتّجاهات الحافّة
export const GRAD_SIZE = CELLS_X * CELLS_Y * BINS;   // ٣٨٤
export const TINT_SIZE = CELLS_X * CELLS_Y * 3;      // ١٤٤

// مقاس الإطار المُصغَّر الذي تُحسب منه البصمة
export const FRAME_W = 64;
export const FRAME_H = 48;

const TAU = Math.PI * 2;

/**
 * بصمة من مصفوفة بكسلات ‎RGBA‎.
 *
 * @param data  ‎Uint8ClampedArray‎ بطول ‎w*h*4‎
 * @returns ‎{ grad: Float32Array, tint: Float32Array }‎ مُطبّعتان
 */
export const describeFrame = (data, w = FRAME_W, h = FRAME_H) => {
    const luma = new Float32Array(w * h);
    const tint = new Float32Array(TINT_SIZE);

    const cellW = w / CELLS_X;
    const cellH = h / CELLS_Y;
    const cells = CELLS_X * CELLS_Y;
    const counts = new Float32Array(cells);

    // ١) الإضاءة واللون في مرور واحد
    for (let y = 0; y < h; y++) {
        const cy = Math.min(CELLS_Y - 1, Math.floor(y / cellH));

        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            luma[y * w + x] = 0.299 * r + 0.587 * g + 0.114 * b;

            const cx = Math.min(CELLS_X - 1, Math.floor(x / cellW));
            const cell = cy * CELLS_X + cx;

            tint[cell * 3] += r;
            tint[cell * 3 + 1] += g;
            tint[cell * 3 + 2] += b;
            counts[cell]++;
        }
    }

    // ٢) اللون: نسبة القنوات لا شدّتها — القناة المطلقة تتغيّر مع
    //    السطوع، ونسبة الأحمر إلى الأخضر إلى الأزرق تبقى
    for (let cell = 0; cell < cells; cell++) {
        const n = counts[cell] || 1;
        const r = tint[cell * 3] / n;
        const g = tint[cell * 3 + 1] / n;
        const b = tint[cell * 3 + 2] / n;
        const sum = r + g + b + 1e-6;

        tint[cell * 3] = r / sum;
        tint[cell * 3 + 1] = g / sum;
        tint[cell * 3 + 2] = b / sum;
    }

    // ٣) تنعيم خفيف قبل اشتقاق الحوافّ.
    //
    //    ضجيج المستشعر يُنتج حوافّ في كل بكسل، وSobel يُضخّمها —
    //    فتمتلئ البصمة باتّجاهات عشوائية وتضيع حوافّ الغرفة بينها.
    //    مرشّح صندوقي ٣×٣ يكفي ولا يُذيب الحوافّ الحقيقية.
    //    والحدود تُنسخ كما هي لا تُترك أصفاراً: الصفر عند الحافّة
    //    يُقابل مئتين وثلاثين في الصفّ الذي يليه، فيرى Sobel جداراً
    //    وهمياً حول الصورة كلّها — حافّة ضخمة تدخل بصمة كل مشهد
    //    فتجعلها كلّها متشابهة، وتُغرق الحوافّ الحقيقية.
    const smooth = Float32Array.from(luma);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            smooth[i] = (
                luma[i - w - 1] + luma[i - w] + luma[i - w + 1] +
                luma[i - 1] + luma[i] + luma[i + 1] +
                luma[i + w - 1] + luma[i + w] + luma[i + w + 1]
            ) / 9;
        }
    }

    // ٤) مقادير التدرّج واتّجاهاتها
    const mags = new Float32Array(w * h);
    const dirs = new Float32Array(w * h);
    let magSum = 0;
    let magCount = 0;

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;

            const gx =
                -smooth[i - w - 1] + smooth[i - w + 1]
                - 2 * smooth[i - 1] + 2 * smooth[i + 1]
                - smooth[i + w - 1] + smooth[i + w + 1];

            const gy =
                -smooth[i - w - 1] - 2 * smooth[i - w] - smooth[i - w + 1]
                + smooth[i + w - 1] + 2 * smooth[i + w] + smooth[i + w + 1];

            const magnitude = Math.hypot(gx, gy);
            mags[i] = magnitude;
            magSum += magnitude;
            magCount++;

            // اتّجاه بلا إشارة: الحافّة الفاتحة على داكن والعكس
            // نفس الحافّة — وإلا انقلبت البصمة مع انقلاب الإضاءة
            let angle = Math.atan2(gy, gx);
            if (angle < 0) angle += Math.PI;

            // موضع كسري بين السلال لا سلّة واحدة: زاوية على حدّ
            // سلّتين تقفز بينهما مع أدنى ضجيج، فتختلف بصمتان لنفس
            // الحافّة. والتوزيع بينهما بالنسبة يُلغي القفزة.
            dirs[i] = (angle / Math.PI) * BINS;
        }
    }

    /*
     * عتبة نسبية لا ثابتة.
     *
     * العتبة الثابتة تنهار مع الإضاءة: صورة أسطع تتجاوزها في كل
     * بكسل، وصورة أخفت لا تتجاوزها في شيء — فتختلف البصمتان لنفس
     * المكان. والنسبة إلى متوسّط الصورة تجعل «ما يُعدّ حافّة» واحداً
     * مهما تغيّر السطوع.
     */
    const meanMag = magCount ? magSum / magCount : 0;
    const cut = Math.max(2, meanMag * 0.55);

    const grad = new Float32Array(GRAD_SIZE);

    for (let y = 1; y < h - 1; y++) {
        const cy = Math.min(CELLS_Y - 1, Math.floor(y / cellH));

        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            if (mags[i] < cut) continue;

            const cx = Math.min(CELLS_X - 1, Math.floor(x / cellW));
            const base = (cy * CELLS_X + cx) * BINS;

            // التوزيع الناعم: ما يقع عند ٢٫٧ يُعطي ٣٠٪ للسلّة ٢
            // و٧٠٪ للسلّة ٣. والالتفاف عند الطرف لأن الاتّجاه دائري
            // بلا إشارة: ما بعد الأخيرة هو الأولى.
            const slot = dirs[i];
            const lo = Math.floor(slot) % BINS;
            const hi = (lo + 1) % BINS;
            const frac = slot - Math.floor(slot);

            grad[base + lo] += mags[i] * (1 - frac);
            grad[base + hi] += mags[i] * frac;
        }
    }

    // ٥) تطبيع داخل كل خليّة — هنا يسقط أثر السطوع نهائياً
    for (let cell = 0; cell < cells; cell++) {
        let sum = 0;
        for (let b = 0; b < BINS; b++) sum += grad[cell * BINS + b] ** 2;

        const norm = Math.sqrt(sum) || 1;
        for (let b = 0; b < BINS; b++) grad[cell * BINS + b] /= norm;
    }

    /*
     * ٦) إزالة المتوسّط.
     *
     * بدونها يتشابه كل مشهدين طبيعيين بنحو سبعين بالمئة: الصور
     * كلّها تحتوي حوافّ أفقية ورأسية بنسب متقاربة، وكلّ الجدران
     * بيجية. فيصير «مختلف» أقرب إلى «مطابق» ممّا يجب، ويضيع الفرق
     * الذي نبحث عنه.
     *
     * وطرحُ المتوسّط يُحوّل جيب التمام إلى معامل ارتباط: المشهد مع
     * نفسه يبقى قرب الواحد، والمختلف ينزل إلى الصفر — فيتّسع
     * المدى الذي نضع فيه العتبة.
     */
    // الطاقة لا تدخل المطابقة، لكنها تقول إن كان في المشهد ما
    // يُميّزه أصلاً: جدار سادة طاقته صفر مهما طُبّعت بصمته
    return { grad: centre(grad), tint: centre(tint), energy: meanMag };
};

/** يطرح المتوسّط ثم يُطبّع — فيصير الضرب الداخلي ارتباطاً */
const centre = (v) => {
    let mean = 0;
    for (let i = 0; i < v.length; i++) mean += v[i];
    mean /= v.length || 1;

    for (let i = 0; i < v.length; i++) v[i] -= mean;
    return unit(v);
};

/** تطبيع المتّجه إلى طول واحد — يجعل التشابه جيبَ تمام الزاوية */
const unit = (v) => {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];

    const norm = Math.sqrt(sum);
    if (norm > 1e-9) for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
};

const dot = (a, b) => {
    let sum = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) sum += a[i] * b[i];
    return sum;
};

/**
 * تشابه بصمتين — من صفر إلى واحد.
 *
 * التدرّجات تحمل الوزن الأكبر لأنها الأصدق: هي شكل المكان. واللون
 * شاهد ثانٍ يفصل بين غرفتين متشابهتي الهندسة.
 */
export const similarity = (a, b, gradWeight = 0.68) => {
    if (!a || !b) return 0;

    const g = Math.max(0, dot(a.grad, b.grad));
    const t = Math.max(0, dot(a.tint, b.tint));

    return gradWeight * g + (1 - gradWeight) * t;
};

// ── الحفظ والاسترجاع ────────────────────────────────────────
//
// البصمة ٥٢٨ عدداً عشرياً — أكثر من كيلوبايتين لو حُفظت كما هي.
// والتكميم إلى بايت واحد لكل عدد يكفي تماماً: الفرق بين ٠٫٧٣١ و
// ٠٫٧٣٥ لا يُغيّر تطابقاً، ويُنصّف الحجم أربع مرّات.

const toBase64 = (bytes) => {
    if (typeof btoa === 'function') {
        let binary = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    throw new Error('لا مُرمِّز base64 في هذه البيئة');
};

const fromBase64 = (text) => {
    if (typeof atob === 'function') {
        const binary = atob(text);
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out;
    }
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(text, 'base64'));
    throw new Error('لا مُفكِّك base64 في هذه البيئة');
};

/*
 * القيم صارت موجبة وسالبة بعد إزالة المتوسّط، فنُزيحها إلى المنتصف
 * قبل التكميم. والمقياس ثابت لا يتبع الصورة: مقياسٌ لكل بصمة يعني
 * بصمتين لنفس المكان لا تُقارَنان.
 */
/*
 * التكميم بمقياس لكل بصمة لا بمقياس ثابت.
 *
 * مدى المركّبات يختلف بين مشهد غنيّ وآخر فقير: مقياس ثابت يقصّ
 * الأوّل ويُهدر دقّة الثاني. والمقياس الخاصّ لا يُفسد المقارنة لأن
 * الاسترجاع يُعيد التطبيع — فالاتّجاه هو ما يُقارَن لا الطول.
 *
 * ويُخزَّن في أوّل بايتين من النصّ نفسه، فتبقى البصمة قطعة واحدة
 * لا حقلين يمكن أن يفترقا في قاعدة البيانات.
 */
const quantize = (v) => {
    let peak = 0;
    for (let i = 0; i < v.length; i++) peak = Math.max(peak, Math.abs(v[i]));
    if (peak < 1e-6) peak = 1e-6;

    // المقياس بالألف من الوحدة — يسع حتى ٦٥ وهو أضعاف أي مركّبة
    const scaled = Math.min(65535, Math.max(1, Math.round(peak * 10000)));

    const out = new Uint8Array(v.length + 2);
    out[0] = scaled & 0xff;
    out[1] = (scaled >> 8) & 0xff;

    for (let i = 0; i < v.length; i++) {
        out[i + 2] = Math.max(0, Math.min(255, Math.round((v[i] / peak) * 127 + 128)));
    }
    return out;
};

const dequantize = (bytes) => {
    if (bytes.length < 3) return new Float32Array(0);

    const peak = ((bytes[0] | (bytes[1] << 8)) || 1) / 10000;
    const out = new Float32Array(bytes.length - 2);

    for (let i = 0; i < out.length; i++) {
        out[i] = ((bytes[i + 2] - 128) / 127) * peak;
    }
    return unit(out);
};

export const packDescriptor = (d) => ({
    grad: toBase64(quantize(d.grad)),
    tint: toBase64(quantize(d.tint))
});

export const unpackDescriptor = (packed) => {
    if (!packed?.grad || !packed?.tint) return null;

    const grad = dequantize(fromBase64(packed.grad));
    const tint = dequantize(fromBase64(packed.tint));

    if (grad.length !== GRAD_SIZE || tint.length !== TINT_SIZE) return null;
    return { grad, tint };
};

// ── المطابقة ────────────────────────────────────────────────

/** العتبات: دونها لا نُصدّق، وفوقها نُصدّق */
/*
 * العتبات على مقياس الارتباط لا جيب التمام.
 *
 * بعد إزالة المتوسّط صار المشهد مع نفسه فوق ٠٫٨ ولو تغيّرت إضاءته،
 * والمشهد المختلف تحت ٠٫٣ — فالعتبة تقع في فراغ واسع بينهما بدل
 * أن تُقحَم بين ٠٫٧٣ و٠٫٦٨ كما كانت.
 */
/*
 * مُعايَرة بالقياس لا بالتخمين.
 *
 * على مشاهد اختبارية: نفس المكان — مع تشبّع إضاءة أو ضجيج أو خطوة
 * جانبية — لا ينزل تحت ٠٫٦٦، ومكان مختلف لا يتجاوز ٠٫٤٣. فالعتبة
 * في منتصف الفراغ تماماً: أحد عشر جزءاً من مئة من كل طرف.
 *
 * والميل إلى الوسط مقصود: التطابق الكاذب ينقل المستخدم إلى غرفة
 * ليس فيها، وهو أسوأ من ألّا نتعرّف عليه فيبقى حيث كان.
 */
export const CONFIDENT = 0.55;
export const WEAK = 0.42;

/**
 * أفضل تطابق في مجموعة بصمات.
 *
 * ويُعيد الفارق عن الثاني: تطابقان متقاربان يعنيان أن المكان
 * ملتبس — ممرّان متشابهان مثلاً — والادّعاء حينها أسوأ من الصمت.
 */
export const matchBest = (query, entries) => {
    let best = null;
    let bestScore = 0;
    let runnerUp = 0;

    for (const entry of entries) {
        if (!entry.descriptor) continue;

        const score = similarity(query, entry.descriptor);
        if (score > bestScore) {
            runnerUp = bestScore;
            bestScore = score;
            best = entry;
        } else if (score > runnerUp) {
            runnerUp = score;
        }
    }

    if (!best) return null;

    return {
        entry: best,
        score: bestScore,
        margin: bestScore - runnerUp,
        confident: bestScore >= CONFIDENT && bestScore - runnerUp >= 0.035
    };
};

/**
 * مُطابق مستقرّ عبر الزمن.
 *
 * الإطار الواحد يخدع: يد تمرّ أمام العدسة، أو لمعة ضوء، فيقفز
 * الموضع إلى غرفة أخرى. فنشترط أن يتّفق عدد من الإطارات المتتالية
 * على نفس الموضع قبل أن نلتزم به — والثمن نصف ثانية، والمقابل
 * ألّا يقفز المسار أمام المستخدم بلا سبب.
 *
 * وحين نلتزم لا نتخلّى بسهولة: الخروج يحتاج تطابقاً أقوى في مكان
 * آخر، فالسير في غرفة معروفة لا يُلغي التعرّف عليها لأن العدسة
 * اتّجهت لحظةً إلى جدار فارغ.
 */
export const createRelocalizer = ({
    agree = 3,
    threshold = CONFIDENT,
    switchMargin = 0.05
} = {}) => {
    let committed = null;
    let candidate = null;
    let streak = 0;
    let lastScore = 0;

    return {
        /**
         * @returns ‎{ changed, place, score }‎ — place هو المُلتزم به
         */
        push(query, entries) {
            const match = matchBest(query, entries);
            lastScore = match?.score || 0;

            if (!match || match.score < WEAK) {
                streak = 0;
                candidate = null;
                return { changed: false, place: committed, score: lastScore };
            }

            // نفس المُلتزم به: نُجدّد الثقة ولا نُغيّر شيئاً
            if (committed && match.entry.id === committed.id) {
                streak = 0;
                candidate = null;
                return { changed: false, place: committed, score: match.score };
            }

            // مكان آخر: يحتاج ثقةً كافية، وتفوّقاً إن كان هناك ملتزَم به
            const strongEnough = match.score >= threshold
                && (!committed || match.score >= threshold + switchMargin);

            if (!strongEnough || !match.confident) {
                streak = 0;
                candidate = null;
                return { changed: false, place: committed, score: match.score };
            }

            if (candidate && candidate.id === match.entry.id) streak++;
            else { candidate = match.entry; streak = 1; }

            if (streak >= agree) {
                committed = match.entry;
                candidate = null;
                streak = 0;
                return { changed: true, place: committed, score: match.score };
            }

            return { changed: false, place: committed, score: match.score };
        },

        get place() { return committed; },
        get score() { return lastScore; },

        forget() { committed = null; candidate = null; streak = 0; }
    };
};

/**
 * هل هذا الإطار يصلح بصمة؟
 *
 * جدار أبيض سادة أو عدسة مغطّاة لا تحمل حوافّ تُميّزها، وحفظها
 * يعني بصمة تُطابق كل جدار أبيض في المبنى. نرفضها عند الالتقاط
 * بدل أن نكتشف ذلك عند الملاحة.
 */
export const frameQuality = (descriptor) => {
    if (!descriptor || !Number.isFinite(descriptor.energy)) return 0;

    /*
     * متوسّط مقدار التدرّج قبل أي تطبيع.
     *
     * المقاييس المحسوبة من البصمة المُطبّعة لا تصلح هنا: التطبيع
     * يُكبّر ضجيج الجدار السادة حتى يبدو مشهداً غنيّاً. أمّا الطاقة
     * الخام فتقول الحقيقة — جدار أبيض لا حوافّ فيه، نقطة.
     */
    return Math.min(1, descriptor.energy / 14);
};

/*
 * تحت الربع لا يصلح بصمة.
 *
 * ما يقابل متوسّط تدرّج ثلاث درجات ونصف على مئتين وخمس وخمسين —
 * أي مشهد فيه حافّة واحدة حقيقية على الأقلّ.
 */
export const MIN_QUALITY = 0.25;
