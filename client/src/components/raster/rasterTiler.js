import * as GeoTIFF from 'geotiff';

import {
    TILE, tileToLon, tileToLat, tileBounds,
    planPyramid, listTiles, makeTransform, affineFromMatrix, affineFromBounds, sourceCorners,
    buildWarpGrid, sampleWarpGrid, stretchRange, boundsOfCorners
} from './rasterGeo.js';
import { crsFromGeoKeys, guessCrs, transformer, isSupported } from './rasterCrs.js';

/* ============================================================
   راستر — من ملفّ تيف إلى هرم بلاطات

   يعمل كلّه في المتصفّح، وهذا قرار لا عجز:

     · ‎sharp‎ في الخادم يقرأ بكسلات التيف لكنّه يتجاهل وسوم
       ‎GeoTIFF‎ — فتضيع الإحداثيات وهي بيت القصيد
     · لا ‎GDAL‎ على ‎Vercel‎
     · وجسم الطلب هناك محدود بأربعة ميجا ونصف، والتيف الخام أكبر
       عادةً. والبلاطة الواحدة عشرات الكيلوبايتات — فالتبليط قبل
       الرفع هو ما يجعل الرفع ممكناً أصلاً

   والإعادة إلى الإسقاط هنا إعادةُ تشكيل حقيقية لا تمطيطَ زوايا:
   كل بكسل في كل بلاطة يُسأل عن موضعه بالدرجات، فيُحوّل إلى مرجع
   المصدر، فيُقرأ من بكسله. وهذا ما يجعل راستر ‎UTM‎ يقع على الخريطة
   بالسنتيمتر لا بالأمتار.
   ============================================================ */

/* عقد شبكة الاعتياض في البلاطة — مُقاسة: الخطأ عندها ٣ ميكرومتر */
const WARP_STEPS = 16;

/*
 * سقف ما نقرؤه إلى الذاكرة — بالبايتات لا بالبكسلات.
 *
 * ستّة عشر مليون بكسل تعني خمسين ميجابايتاً لصورة ‎RGB‎ ثمانية
 * بتّات، ومئة وعشرين لأربعة نطاقات ستّة عشر بتّاً. فالسقف بالبكسلات
 * يسمح لملفّ أن يسقط المتصفّح ويمنع ملفّاً أخفّ منه بلا داعٍ.
 */
const MAX_SOURCE_BYTES = 150 * 1024 * 1024;

/* ============================================================
   القراءة
   ============================================================ */

/**
 * يقرأ إحداثيات الملفّ من أيّ مصدر يحملها.
 *
 * بترتيب الأولوية:
 *
 *   ١) ‎ModelTiepoint‎ + ‎ModelPixelScale‎   الشكل الشائع
 *   ٢) ‎ModelTransformation‎                مصفوفة كاملة، تحمل الدوران
 *   ٣) ملفّ مجاور                       ‎.tfw‎ أو ‎aux.xml‎
 *   ٤) حدود يكتبها الأدمن               آخر ملاذ
 *
 * والمدار لا يُرفض بعد اليوم: التحويل أفيني كامل وينعكس،
 * والتبليط يمرّ على ‎toPixel‎ فلا يعلم أصلاً أمدارٌ هو أم لا.
 */
const readGeometry = (image, sidecar) => {
    const fd = image.getFileDirectory();

    // ١) الشكل الشائع
    if (fd.ModelPixelScale && fd.ModelTiepoint && fd.ModelTiepoint.length >= 6) {
        const [scaleX, scaleY] = fd.ModelPixelScale;
        const transform = makeTransform({
            originX: fd.ModelTiepoint[3],
            originY: fd.ModelTiepoint[4],
            scaleX,
            scaleY
        });
        if (transform) return { transform, geoFrom: 'وسوم GeoTIFF' };
    }

    // ٢) المصفوفة الكاملة
    if (fd.ModelTransformation) {
        const transform = affineFromMatrix(fd.ModelTransformation);
        if (transform) {
            return {
                transform,
                geoFrom: transform.rotated ? 'مصفوفة GeoTIFF (مُدارة)' : 'مصفوفة GeoTIFF'
            };
        }
    }

    // ٣) ملفّ مجاور
    if (sidecar?.transform) {
        return { transform: sidecar.transform, geoFrom: sidecar.from.join(' و') || 'ملفّ مجاور' };
    }

    /*
     * لا شيء. والرسالة تقول ما في الملفّ فعلاً لا «لا إحداثيات» وحدها:
     * من يرى ملفّه يُفتح في ‎Arc‎ ويُرفض هنا يستحقّ أن يعرف أين
     * يبحث — والجواب عادةً: بجانب التيف.
     */
    const present = Object.keys(fd)
        .filter(k => /^(Model|GeoKey|GeoAscii|GeoDouble)/.test(k));

    return {
        needsBounds: true,
        tags: present,
        error: present.length
            ? `الملفّ يحمل ${present.join(' و')} ولا يكفي لتحديد موضعه`
            : 'لا إحداثيات في الملفّ ولا بجانبه'
    };
};

/** قيمة الفراغ كما يكتبها ‎GDAL‎ — نصّ في وسم خاصّ */
const readNodata = (image) => {
    const raw = image.getFileDirectory()?.GDAL_NODATA;
    if (raw === undefined || raw === null) return null;

    const value = parseFloat(String(raw).replace(/\0/g, '').trim());
    return Number.isFinite(value) ? value : null;
};

/**
 * يفتح التيف ويُخرج كل ما يلزم للتبليط.
 *
 * ولا يقرأ البكسلات بعد: قراءتها تحتاج أن نعرف أوّلاً أيّ دقّة
 * سنُبلّط إليها، وذلك يحتاج الحدود — وهي هنا.
 */
export const openRaster = async (arrayBuffer, {
    crsOverride = null,
    sidecar = null,
    manualBounds = null
} = {}) => {
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();

    const width = image.getWidth();
    const height = image.getHeight();
    if (!(width > 0 && height > 0)) return { error: 'أبعاد الصورة غير صالحة' };

    let geometry = readGeometry(image, sidecar);

    /* لا شيء في الملفّ ولا بجانبه؟ فلنقبل حدوداً مكتوبة */
    if (geometry.needsBounds && manualBounds) {
        const transform = affineFromBounds(manualBounds, width, height);
        if (transform) geometry = { transform, geoFrom: 'حدود كتبتَها', manual: true };
    }

    if (!geometry.transform) {
        return {
            error: geometry.error,
            needsBounds: Boolean(geometry.needsBounds),
            tags: geometry.tags || [],
            width,
            height
        };
    }

    const { transform } = geometry;

    // ── المرجع: من الوسوم، ثم تخميناً، ومع إمكان أن يُجبره المستخدم ──
    let crs = crsOverride;
    let crsSource = 'override';
    let unsupported = null;

    if (!crs) {
        const found = crsFromGeoKeys(image.geoKeys);

        if (typeof found === 'string') {
            crs = found;
            crsSource = 'file';
        } else if (sidecar?.crs && isSupported(sidecar.crs)) {
            // ‎.prj‎ أو ‎SRS‎ في ‎aux.xml‎ — مكتوب لا مخمّن
            crs = sidecar.crs;
            crsSource = 'sidecar';
            if (found?.unsupported) unsupported = found.unsupported;
        } else {
            if (found?.unsupported) unsupported = found.unsupported;
            const at = transform.toProjected(width / 2, height / 2);
            crs = guessCrs(at.x, at.y);
            crsSource = 'guess';
        }
    }

    if (!isSupported(crs)) return { error: `مرجع إحداثيات غير مدعوم: ${crs}` };

    // ── الحدود بالدرجات، من الزوايا الأربع معاً لا من اثنتين ──
    const project = transformer(crs);
    const corners = sourceCorners(transform, width, height)
        .map(c => project.toLonLat(c.x, c.y));

    const bounds = boundsOfCorners(corners);

    if (![bounds.west, bounds.east, bounds.south, bounds.north].every(Number.isFinite)
        || bounds.east <= bounds.west || bounds.north <= bounds.south) {
        return { error: 'الإحداثيات الناتجة غير منطقية — راجع مرجع الملفّ' };
    }

    return {
        image,
        width,
        height,
        samples: image.getSamplesPerPixel(),
        transform,
        crs,
        crsSource,
        unsupported,
        corners,
        bounds,
        geoFrom: geometry.geoFrom,
        rotated: transform.rotated,
        manual: Boolean(geometry.manual),
        nodata: readNodata(image),
        /* دقّة المصدر بالأمتار تقريباً — تُعرض للمستخدم ليحكم */
        metresPerPixel: crs === 'EPSG:4326' ? null : transform.pixelWidth
    };
};

/* ============================================================
   البكسلات
   ============================================================ */

/**
 * يقرأ البكسلات بالدقّة التي يحتاجها أعلى مستوى، لا أكثر.
 *
 * ‎geotiff‎ يُعيد التشكيل عند القراءة، فنطلب الحجم الذي سنستعمله
 * ويقرأ هو ما يلزم من الملفّ. وهذا ما يجعل ملفّاً من عشرة آلاف
 * بكسل يُبلّط على هاتف: لا نُدخل إلى الذاكرة ما لن نُخرجه.
 */
const readPixels = async (source, maxZoom) => {
    const { image, width, height, bounds } = source;

    // عرض الراستر بالبكسلات عند أعلى مستوى سنُنتجه
    const spanDegrees = Math.abs(bounds.east - bounds.west);
    const wanted = Math.ceil((spanDegrees / 360) * TILE * Math.pow(2, maxZoom));

    let readWidth = Math.min(width, Math.max(1, wanted));
    let readHeight = Math.max(1, Math.round((readWidth / width) * height));

    // سقف الذاكرة يسبق كل شيء، ويُحسب من حجم البكسل الفعلي
    let perPixel = 4;
    try {
        perPixel = Math.max(1, image.getBytesPerPixel());
    } catch {
        // ملفّ غريب الوسوم: نفترض أربعة وهو وسط معقول
    }

    const maxPixels = Math.max(1, Math.floor(MAX_SOURCE_BYTES / perPixel));
    if (readWidth * readHeight > maxPixels) {
        const shrink = Math.sqrt(maxPixels / (readWidth * readHeight));
        readWidth = Math.max(1, Math.floor(readWidth * shrink));
        readHeight = Math.max(1, Math.floor(readHeight * shrink));
    }

    const rasters = await image.readRasters({
        width: readWidth,
        height: readHeight,
        interleave: false,
        resampleMethod: 'bilinear'
    });

    return { rasters, readWidth, readHeight };
};

/**
 * يحوّل نطاقات المصدر إلى دالّة لون.
 *
 * ثلاثة نطاقات أو أكثر تُقرأ ‎RGB‎. ونطاق واحد رمادي — وهو حال
 * نماذج الارتفاع والصور أحادية النطاق. والتمدّد يُحسب مرّة على
 * المصفوفة كلّها لا لكل بلاطة، وإلّا اختلف تبايُن كل بلاطة عن
 * جارتها وظهرت الحدود بينها.
 */
const makePainter = (rasters, samples, nodata) => {
    const bands = Array.isArray(rasters) ? rasters : [rasters];
    const rgb = bands.length >= 3;

    const ranges = (rgb ? bands.slice(0, 3) : [bands[0]]).map(band => {
        // ٨-بت تُعرض كما هي: التمدّد يُفسد صوراً مُعدّة سلفاً
        const eightBit = band instanceof Uint8Array || band instanceof Uint8ClampedArray;
        if (eightBit) return { low: 0, high: 255 };

        return stretchRange(band, { ignore: nodata, skip: Math.max(1, Math.floor(band.length / 2e5)) });
    });

    const alphaBand = bands.length === 4 && rgb ? bands[3] : (bands.length === 2 ? bands[1] : null);

    const scale = ranges.map(r => 255 / (r.high - r.low || 1));

    return (index, out, at) => {
        const first = bands[0][index];

        // الفراغ شفّاف: وإلّا ظهرت حدود سوداء حول الراستر المائل
        if (nodata !== null && first === nodata) { out[at + 3] = 0; return; }
        if (!Number.isFinite(first)) { out[at + 3] = 0; return; }

        const clip = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

        if (rgb) {
            out[at] = clip((bands[0][index] - ranges[0].low) * scale[0]);
            out[at + 1] = clip((bands[1][index] - ranges[1].low) * scale[1]);
            out[at + 2] = clip((bands[2][index] - ranges[2].low) * scale[2]);
        } else {
            const grey = clip((first - ranges[0].low) * scale[0]);
            out[at] = grey;
            out[at + 1] = grey;
            out[at + 2] = grey;
        }

        out[at + 3] = alphaBand ? clip(alphaBand[index]) : 255;
    };
};

/* ============================================================
   البلاطة الواحدة
   ============================================================ */

/**
 * يرسم بلاطة واحدة.
 *
 * لكل بكسل: موضعه بالدرجات ← مرجع المصدر (بالشبكة) ← بكسل المصدر.
 * وحين يصغر المستوى يصير بكسل البلاطة أعرض من بكسل المصدر، فنأخذ
 * متوسّط رقعة بدل عيّنة واحدة — وإلّا ظهرت الصورة مُشوّشة بنقاط
 * عند التصغير.
 *
 * @returns ‎ImageData‎ أو ‎null‎ إن كانت البلاطة فارغة تماماً
 */
export const paintTile = (tile, pixels, source, painter, project) => {
    const { z, x, y } = tile;
    const { rasters, readWidth, readHeight } = pixels;
    const { width, height, transform } = source;

    // المصفوفة المقروءة قد تكون مُصغّرة عن الملفّ، فالتحويل يُقاس عليها
    const colScale = readWidth / width;
    const rowScale = readHeight / height;

    const grid = buildWarpGrid(z, x, y, WARP_STEPS, (lon, lat) => {
        const at = project.fromLonLat(lon, lat);
        return [at[0], at[1]];
    });

    // كم بكسلاً من المصدر يُغطّي بكسلاً من البلاطة — يُحدّد المتوسّط
    const tb = tileBounds(z, x, y);
    const a = project.fromLonLat(tb.west, tb.north);
    const b = project.fromLonLat(tb.east, tb.north);
    const tileSpan = Math.abs(b[0] - a[0]);
    const sourceSpan = transform.pixelWidth / colScale;
    const ratio = sourceSpan > 0 ? tileSpan / TILE / sourceSpan : 1;

    // رقعة المتوسّط: ٢×٢ أو ٣×٣ تكفي، وما فوقها ثمنه أكبر من فائدته
    const box = Math.max(1, Math.min(3, Math.round(ratio)));

    const out = new Uint8ClampedArray(TILE * TILE * 4);

    /* مصفوفة العيّنة تُخصَّص مرّة لا لكل بكسل: ‎65536‎ تخصيصاً في
       البلاطة الواحدة يُشغل جامع المهملات أكثر من الرسم نفسه */
    const probe = new Uint8ClampedArray(4);
    let painted = 0;

    for (let py = 0; py < TILE; py++) {
        const v = (py + 0.5) / TILE;

        for (let px = 0; px < TILE; px++) {
            const u = (px + 0.5) / TILE;

            const [projX, projY] = sampleWarpGrid(grid, u, v);
            const at = transform.toPixel(projX, projY);

            const col = at.col * colScale;
            const row = at.row * rowScale;

            if (col < 0 || row < 0 || col >= readWidth || row >= readHeight) continue;

            const slot = (py * TILE + px) * 4;

            if (box === 1) {
                painter((Math.floor(row) * readWidth + Math.floor(col)), out, slot);
            } else {
                // متوسّط رقعة: نجمع في أعداد ثم نكتب مرّة
                let r = 0, g = 0, bl = 0, al = 0, n = 0;
                const half = (box - 1) / 2;

                let lit = 0;

                for (let oy = -half; oy <= half; oy++) {
                    const sr = Math.floor(row + oy);
                    if (sr < 0 || sr >= readHeight) continue;

                    for (let ox = -half; ox <= half; ox++) {
                        const sc = Math.floor(col + ox);
                        if (sc < 0 || sc >= readWidth) continue;

                        probe[3] = 255;
                        painter(sr * readWidth + sc, probe, 0);

                        al += probe[3];
                        n += 1;

                        // الشفّاف لا يُسهم بلون: ‎painter‎ يعود بلا كتابة
                        // اللون عند الفراغ، فقيم ‎probe‎ تبقى من عيّنة سابقة
                        if (probe[3] > 0) {
                            r += probe[0]; g += probe[1]; bl += probe[2];
                            lit += 1;
                        }
                    }
                }

                if (!n) continue;

                if (lit) {
                    out[slot] = r / lit;
                    out[slot + 1] = g / lit;
                    out[slot + 2] = bl / lit;
                }
                out[slot + 3] = al / n;
            }

            if (out[slot + 3] > 0) painted += 1;
        }
    }

    return painted ? out : null;
};

/* ============================================================
   الهرم كلّه
   ============================================================ */

/** يضغط لوحة إلى ‎WebP‎ وإلّا ‎PNG‎ — والفرق في الحجم ثلاثة أضعاف */
const encode = (canvas) => new Promise((resolve) => {
    canvas.toBlob(
        (blob) => {
            if (blob && blob.size) { resolve(blob); return; }
            canvas.toBlob(png => resolve(png), 'image/png');
        },
        'image/webp',
        0.85
    );
});

/**
 * يُبلّط الراستر ويُسلّم بلاطةً بلاطة.
 *
 * ‎onTile‎ يُنادى لكل بلاطة جاهزة فيرفعها المُنادي ويتقدّم شريطه.
 * والبلاطة الفارغة تماماً — ما وقعت خارج الراستر — لا تُسلَّم:
 * رفعها يعني مئات الطلبات لصور شفّافة لا يراها أحد.
 */
export const tileRaster = async (source, {
    maxTiles = 1200,
    hardMaxZoom = 22,
    onProgress,
    onTile,
    shouldStop
} = {}) => {
    const plan = planPyramid(source.bounds, source.width, { maxTiles, hardMaxZoom });

    const pixels = await readPixels(source, plan.maxZoom);
    const painter = makePainter(pixels.rasters, source.samples, source.nodata);
    const project = transformer(source.crs);

    const canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tiles = listTiles(source.bounds, plan.minZoom, plan.maxZoom);
    let done = 0;
    let empty = 0;

    for (const tile of tiles) {
        if (shouldStop?.()) break;

        const data = paintTile(tile, pixels, source, painter, project);
        done += 1;

        if (!data) {
            empty += 1;
            onProgress?.({ done, total: tiles.length, uploaded: done - empty, empty });
            continue;
        }

        ctx.clearRect(0, 0, TILE, TILE);
        ctx.putImageData(new ImageData(data, TILE, TILE), 0, 0);

        const blob = await encode(canvas);
        await onTile?.(tile, blob);

        onProgress?.({ done, total: tiles.length, uploaded: done - empty, empty });

        // نُفلت الخيط كل بلاطة فتبقى الواجهة حيّة ويعمل زرّ الإلغاء
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return { plan, total: tiles.length, done, empty, pixels: { ...pixels, rasters: null } };
};
