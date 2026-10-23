/* ============================================================
   راستر — رياضيات التبليط

   صورة واحدة مسطّحة فوق الخريطة تبدو جيّدة حتى تُكبّر، ثم تتحلّل
   إلى مربّعات. والحلّ هرم بلاطات: نقطّع الراستر إلى مربّعات ٢٥٦×٢٥٦
   لكل مستوى تكبير، فلا يُحمَّل إلا ما يُرى، ويبقى حادّاً إلى آخر
   زوم في بياناته.

   وكل ما هنا خالص: لا ‎canvas‎ ولا ‎geotiff‎ ولا ‎DOM‎. ما يُحسب هنا
   هو ما إن أخطأ وقعت الصورة في بلد آخر — فيُختبَر وحده.

   الإطار: ‎Web Mercator‎ كما تتوقّعه ‎MapLibre‎ وكل مزوّدي البلاطات،
   و‎XYZ‎ بأصل أعلى اليسار (لا ‎TMS‎ المقلوب).
   ============================================================ */

export const TILE = 256;

/* حدّ ماسنريتور: ‎±85.0511°‎ هو ما يُسقَط إلى ‎±∞‎، فيُقصّ قبله */
export const MAX_LAT = 85.05112877980659;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ============================================================
   البلاطة ↔ الإحداثيات
   ============================================================ */

/** خطّ الطول عند حدّ بلاطة — ‎x‎ كسريّ مسموح لحساب داخل البلاطة */
export const tileToLon = (x, z) => (x / Math.pow(2, z)) * 360 - 180;

/** وخطّ العرض — عكس ماسنريتور */
export const tileToLat = (y, z) => {
    const n = Math.PI * (1 - (2 * y) / Math.pow(2, z));
    return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
};

export const lonToTile = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);

export const latToTile = (lat, z) => {
    const phi = (clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2;
    return y * Math.pow(2, z);
};

/**
 * البلاطات التي يلمسها مستطيل عند مستوى ما.
 *
 * الحدود مقصوصة إلى العالم: راستر يتجاوز حافّة ماسنريتور لا يُنتج
 * بلاطات سالبة تُرفع ولا تُقرأ أبداً.
 */
export const tileRange = (bounds, z) => {
    const span = Math.pow(2, z);
    const { west, south, east, north } = bounds;

    const x0 = clamp(Math.floor(lonToTile(west, z)), 0, span - 1);
    const x1 = clamp(Math.floor(lonToTile(east, z) - 1e-9), 0, span - 1);
    const y0 = clamp(Math.floor(latToTile(north, z)), 0, span - 1);
    const y1 = clamp(Math.floor(latToTile(south, z) - 1e-9), 0, span - 1);

    return {
        x0: Math.min(x0, x1),
        x1: Math.max(x0, x1),
        y0: Math.min(y0, y1),
        y1: Math.max(y0, y1)
    };
};

export const tileCountAt = (bounds, z) => {
    const r = tileRange(bounds, z);
    return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
};

/** حدود بلاطة بعينها — ما يُحوّل إليه كل بكسل فيها */
export const tileBounds = (z, x, y) => ({
    west: tileToLon(x, z),
    east: tileToLon(x + 1, z),
    north: tileToLat(y, z),
    south: tileToLat(y + 1, z)
});

/* ============================================================
   اختيار مستويات الهرم
   ============================================================ */

/**
 * المستوى الذي يصير فيه بكسل البلاطة بحجم بكسل المصدر.
 *
 * فوقه لا معلومة جديدة — تكبير فارغ يُضاعف البلاطات أربع مرّات
 * ولا يُضيف حدّة. وتحته نُهدر دقّة دفعنا ثمنها.
 */
export const nativeZoom = (bounds, sourceWidth) => {
    const degrees = Math.abs(bounds.east - bounds.west);
    if (!(degrees > 0) || !(sourceWidth > 0)) return 0;

    return Math.log2((360 * sourceWidth) / (TILE * degrees));
};

/**
 * يرسم الهرم: من مستوى يُظهر الراستر كلّه إلى مستوى دقّته الأصلية.
 *
 * والسقف هو عدد البلاطات لا عدد المستويات: المستوى الأعلى وحده
 * يساوي ثلاثة أرباع الهرم، فحين لا يتّسع نتنازل عن أعلى مستوى لا
 * عن أدناها — فيبقى الراستر مرئياً كاملاً، ويخسر حدّة آخر زوم.
 */
export const planPyramid = (bounds, sourceWidth, {
    maxTiles = 1200,
    hardMaxZoom = 22,
    minSpanTiles = 2
} = {}) => {
    const native = Math.min(hardMaxZoom, Math.max(0, Math.round(nativeZoom(bounds, sourceWidth))));

    // أدنى مستوى: أوّل ما يصير الراستر فيه بلاطتين أو أكثر عرضاً،
    // فلا نرفع بلاطة عالمية لأجل صورة بحجم حيّ
    let minZoom = 0;
    for (let z = 0; z <= native; z++) {
        const r = tileRange(bounds, z);
        if ((r.x1 - r.x0 + 1) >= minSpanTiles || (r.y1 - r.y0 + 1) >= minSpanTiles) { minZoom = z; break; }
        minZoom = z;
    }

    let maxZoom = minZoom;
    let count = tileCountAt(bounds, minZoom);

    while (maxZoom < native) {
        const next = tileCountAt(bounds, maxZoom + 1);
        if (count + next > maxTiles) break;
        maxZoom += 1;
        count += next;
    }

    return { minZoom, maxZoom, nativeZoom: native, count, capped: maxZoom < native };
};

/** كل البلاطات المطلوبة، مرتّبة من الأدنى تكبيراً — فيُرى شيء أوّلاً */
export const listTiles = (bounds, minZoom, maxZoom) => {
    const out = [];

    for (let z = minZoom; z <= maxZoom; z++) {
        const r = tileRange(bounds, z);
        for (let y = r.y0; y <= r.y1; y++) {
            for (let x = r.x0; x <= r.x1; x++) out.push({ z, x, y });
        }
    }

    return out;
};

/* ============================================================
   التحويل الهندسي للمصدر
   ============================================================ */

/**
 * يبني محوّلاً بين إحداثيات المصدر المسقطة وبكسلاته.
 *
 * تحويل أفيني كامل لا شمال-أعلى فقط:
 *
 *     projX = a·col + b·row + c
 *     projY = d·col + e·row + f
 *
 * وهذا شكل واحد يكفي مصادر الإحداثيات كلّها: وسوم
 * ‎GeoTIFF‎، ومصفوفة ‎ModelTransformation‎، وملفّ ‎.tfw‎،
 * و‎GeoTransform‎ في ‎aux.xml‎. وكان هنا شكل أضيق يرفض المدار
 * منها — والمدار ليس عطباً بل حالة تكتبها برامج ‎GIS‎ عادةً.
 *
 * ويُقبل الشكل المختصر ‎{ originX, originY, scaleX, scaleY }‎ كما هو،
 * لأنّ الغالب شمال-أعلى وكتابة ستّة معاملات لأجله تطويل بلا فائدة.
 */
export const makeTransform = (spec) => {
    if (!spec) return null;

    let a, b, c, d, e, f;

    if (spec.a !== undefined) {
        ({ a, b = 0, c, d = 0, e, f } = spec);
    } else {
        // الشكل المختصر: شمال-أعلى، والسطور تنزل فينقص الشمال
        a = spec.scaleX;
        b = 0;
        c = spec.originX;
        d = 0;
        e = -Math.abs(spec.scaleY);
        f = spec.originY;
    }

    if (![a, b, c, d, e, f].every(Number.isFinite)) return null;

    /* المحدّد صفراً يعني تحويلاً منهاراً: مقياس معدوم أو محوران
       متطابقان. ولا ينعكس، فلا يُقرأ منه بكسل */
    const det = a * e - b * d;
    if (!(Math.abs(det) > 0)) return null;

    return {
        a, b, c, d, e, f, det,

        toPixel: (projX, projY) => {
            const dx = projX - c;
            const dy = projY - f;
            return {
                col: (e * dx - b * dy) / det,
                row: (a * dy - d * dx) / det
            };
        },

        toProjected: (col, row) => ({
            x: a * col + b * row + c,
            y: d * col + e * row + f
        }),

        /* مقاس البكسل فعلاً — طول عمود المصفوفة لا المعامل وحده،
           فالمدار يوزّع المقياس بين معاملين */
        pixelWidth: Math.hypot(a, d),
        pixelHeight: Math.hypot(b, e),

        /* هل هو شمال-أعلى؟ يُعرض للأدمن لا يُرفض به */
        rotated: Math.abs(b) > 1e-12 || Math.abs(d) > 1e-12
    };
};

/**
 * من ملفّ ‎.tfw‎ — ستّة أرقام بترتيب ‎ESRI‎.
 *
 * وفيه فرق دقيق يُنسى فيُزيح الصورة نصف بكسل: أرقام ‎.tfw‎
 * تشير إلى مركز البكسل الأوّل، أمّا وسوم ‎GeoTIFF‎ و‎GDAL‎ فتشير
 * إلى زاويته. فنطرح نصف بكسل كما يفعل ‎GDAL‎ بالضبط.
 */
export const affineFromWorldFile = ([a, d, b, e, cx, fy]) => {
    if (![a, d, b, e, cx, fy].every(Number.isFinite)) return null;

    return makeTransform({
        a, b, d, e,
        c: cx - a * 0.5 - b * 0.5,
        f: fy - d * 0.5 - e * 0.5
    });
};

/**
 * من ‎GeoTransform‎ بترتيب ‎GDAL‎ — وهو ما يكتبه ‎aux.xml‎.
 *
 * ‎[originX, pixelWidth, rowRotation, originY, colRotation, pixelHeight]‎
 * وهو زاويّ أصلاً فلا إزاحة نصف بكسل هنا.
 */
export const affineFromGdal = ([c, a, b, f, d, e]) => {
    if (![c, a, b, f, d, e].every(Number.isFinite)) return null;
    return makeTransform({ a, b, c, d, e, f });
};

/** من مصفوفة ‎ModelTransformation‎ — أربع في أربع بترتيب السطور */
export const affineFromMatrix = (m) => {
    if (!m || m.length < 8) return null;
    return makeTransform({ a: m[0], b: m[1], c: m[3], d: m[4], e: m[5], f: m[7] });
};

/**
 * من حدود يكتبها الأدمن بيده — آخر ملاذ.
 *
 * حين لا يكون في الملفّ ولا بجانبه شيء، يبقى أن يقول أحدهم
 * أين هي. وشمال-أعلى بالضرورة: مستطيل لا يحمل دوراناً.
 */
export const affineFromBounds = (bounds, width, height) => {
    const { west, south, east, north } = bounds || {};
    if (![west, south, east, north, width, height].every(Number.isFinite)) return null;
    if (!(east > west) || !(north > south) || !(width > 0) || !(height > 0)) return null;

    return makeTransform({
        a: (east - west) / width,
        b: 0,
        c: west,
        d: 0,
        e: -(north - south) / height,
        f: north
    });
};

/** حدود الراستر بإحداثيات المصدر — الزوايا الأربع بترتيب الساعة */
export const sourceCorners = (transform, width, height) => [
    transform.toProjected(0, 0),
    transform.toProjected(width, 0),
    transform.toProjected(width, height),
    transform.toProjected(0, height)
];

/* ============================================================
   شبكة الاعتياض
   ============================================================ */

/**
 * شبكة تحويل خشنة تُستعمل بدل استدعاء ‎proj4‎ لكل بكسل.
 *
 * بلاطة واحدة ٦٥٥٣٦ بكسلاً، وهرم من مئتي بلاطة يعني ثلاثة عشر
 * مليون استدعاء — دقائق من الانتظار. وشبكة ‎17×17‎ تعني ٢٨٩ استدعاءً
 * للبلاطة، والباقي اعتياض خطّي بين عقدها.
 *
 * وهذا ما يفعله ‎GDAL‎ نفسه بمحوّله التقريبي: التحويل بين مرجعين
 * أملسُ على مساحة بلاطة، فالخطّ المستقيم بين عقدتين يخطئ أجزاءً من
 * البكسل — وهو ما يُثبته الاختبار لا ما نرجوه.
 */
export const buildWarpGrid = (z, x, y, steps, project) => {
    const nodes = new Float64Array((steps + 1) * (steps + 1) * 2);
    const bounds = tileBounds(z, x, y);

    for (let gy = 0; gy <= steps; gy++) {
        // الكسر في فضاء البلاطة لا في فضاء الدرجات: ماسنريتور غير
        // خطّي في العرض، فتقسيم الدرجات يُزيح العقد عن مواضعها
        const lat = tileToLat(y + gy / steps, z);

        for (let gx = 0; gx <= steps; gx++) {
            const lon = tileToLon(x + gx / steps, z);
            const [px, py] = project(lon, lat);

            const at = (gy * (steps + 1) + gx) * 2;
            nodes[at] = px;
            nodes[at + 1] = py;
        }
    }

    return { nodes, steps, bounds };
};

/**
 * يقرأ الشبكة عند موضع كسريّ داخل البلاطة.
 *
 * @param u,v نسبة ٠..١ داخل البلاطة — ‎u‎ شرقاً و‎v‎ جنوباً
 */
export const sampleWarpGrid = (grid, u, v) => {
    const { nodes, steps } = grid;

    const gx = clamp(u * steps, 0, steps);
    const gy = clamp(v * steps, 0, steps);

    const x0 = Math.min(steps - 1, Math.floor(gx));
    const y0 = Math.min(steps - 1, Math.floor(gy));
    const fx = gx - x0;
    const fy = gy - y0;

    const span = steps + 1;
    const a = (y0 * span + x0) * 2;
    const b = (y0 * span + x0 + 1) * 2;
    const c = ((y0 + 1) * span + x0) * 2;
    const d = ((y0 + 1) * span + x0 + 1) * 2;

    const lerp = (p, q, t) => p + (q - p) * t;

    return [
        lerp(lerp(nodes[a], nodes[b], fx), lerp(nodes[c], nodes[d], fx), fy),
        lerp(lerp(nodes[a + 1], nodes[b + 1], fx), lerp(nodes[c + 1], nodes[d + 1], fx), fy)
    ];
};

/* ============================================================
   تمدّد التبايُن
   ============================================================ */

/**
 * المدى الذي تُمدّ إليه القيم، بحذف الأطراف.
 *
 * القسمة على أكبر قيمة تجعل صور ١٦-بت غامقة: بكسل واحد لامع يسحب
 * المقياس كلّه. وحذف ٢٪ من كل طرف يُعيد الصورة إلى ما تراه العين
 * في أي برنامج ‎GIS‎.
 *
 * ونعدّ على مدرج لا على مصفوفة مرتّبة: ترتيب مئة مليون بكسل يُجمّد
 * المتصفّح، والمدرج مرور واحد.
 */
export const stretchRange = (values, {
    lowPct = 2,
    highPct = 98,
    bins = 1024,
    skip = 1,
    ignore = null
} = {}) => {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < values.length; i += skip) {
        const v = values[i];
        if (!Number.isFinite(v) || v === ignore) continue;
        if (v < min) min = v;
        if (v > max) max = v;
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return { low: 0, high: 1 };
    if (max === min) return { low: min, high: min + 1 };

    const hist = new Float64Array(bins);
    const scale = (bins - 1) / (max - min);
    let total = 0;

    for (let i = 0; i < values.length; i += skip) {
        const v = values[i];
        if (!Number.isFinite(v) || v === ignore) continue;
        hist[Math.round((v - min) * scale)] += 1;
        total += 1;
    }

    if (!total) return { low: min, high: max };

    const pick = (pct) => {
        const want = (pct / 100) * total;
        let seen = 0;
        for (let b = 0; b < bins; b++) {
            seen += hist[b];
            if (seen >= want) return min + b / scale;
        }
        return max;
    };

    const low = pick(lowPct);
    const high = pick(highPct);

    return high > low ? { low, high } : { low: min, high: max };
};

/** يقرأ حدود الراستر بالدرجات من زواياه المسقطة بعد إعادة الإسقاط */
export const boundsOfCorners = (corners) => {
    const lons = corners.map(c => c[0]);
    const lats = corners.map(c => c[1]);

    return {
        west: Math.min(...lons),
        east: Math.max(...lons),
        south: Math.min(...lats),
        north: Math.max(...lats)
    };
};
