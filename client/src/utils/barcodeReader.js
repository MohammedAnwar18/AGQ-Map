/**
 * قارئ باركود سريع يعمل على كل الأجهزة.
 *
 * يفضّل واجهة المتصفح الأصلية BarcodeDetector حين تتوفّر (أندرويد/كروم)
 * لأنها تعمل على مستوى النظام. وحين لا تتوفّر — سفاري iOS مثلاً —
 * نفكّ صور الكاميرا بأنفسنا عبر نواة ZXing.
 *
 * ملاحظة مهمّة: لا نستعمل BrowserMultiFormatReader إطلاقاً، لأن
 * decodeFromVideoElement* تستدعي reset() التي توقف بثّ الكاميرا وتُفرغ
 * عنصر الفيديو — فتقتل البثّ الذي شغّلناه بأنفسنا. نحن نملك الكاميرا،
 * وهي تقرأ الإطارات فقط.
 */

// صيغ باركود المنتجات الشائعة + QR
const NATIVE_FORMATS = [
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'code_93',
    'itf', 'codabar', 'qr_code'
];

// عرض العمل: نصغّر الإطار قبل الفك — أسرع بكثير ودقّته كافية
const WORK_WIDTH = 720;

const hasNative = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

const nativeDetector = async () => {
    if (!hasNative()) return null;
    try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const usable = NATIVE_FORMATS.filter(f => supported.includes(f));
        if (!usable.length) return null;
        return new window.BarcodeDetector({ formats: usable });
    } catch {
        return null;
    }
};

/**
 * ينسخ إطاراً من الفيديو إلى لوحة، مع قصّ اختياري لوسط الصورة.
 * القصّ يجعل الفكّ أسرع وأدقّ لأن الرمز يقع في وسط الكادر عادةً.
 */
const grabFrame = (video, canvas, { cropX = 1, cropY = 1 } = {}) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const sw = Math.round(vw * cropX);
    const sh = Math.round(vh * cropY);
    const sx = Math.round((vw - sw) / 2);
    const sy = Math.round((vh - sh) / 2);

    const scale = Math.min(1, WORK_WIDTH / sw);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
    return { ctx, width: dw, height: dh };
};

/**
 * يبدأ المسح المستمر على عنصر <video> يملكه المُستدعي.
 *
 * onResult يُستدعى لكل رمز مقروء، ويُعيد دالة إيقاف.
 * onError يُستدعى مرّة إن تعذّر تشغيل القارئ أصلاً.
 */
export const startScanning = async (video, onResult, { onError, intervalMs = 70 } = {}) => {
    let stopped = false;
    let timer = null;
    const canvas = document.createElement('canvas');

    const stop = () => { stopped = true; clearTimeout(timer); };
    const loop = (fn) => {
        if (!stopped) timer = setTimeout(fn, intervalMs);
    };

    // ── المسار الأصلي ─────────────────────────────────────────
    const detector = await nativeDetector();
    if (detector) {
        const tick = async () => {
            if (stopped) return;
            try {
                if (video.readyState >= 2) {
                    const codes = await detector.detect(video);
                    const value = codes?.[0]?.rawValue;
                    if (value && !stopped) onResult(String(value).trim(), codes[0].format);
                }
            } catch { /* إطار تعذّرت قراءته */ }
            loop(tick);
        };
        tick();
        return stop;
    }

    // ── المسار البديل: نواة ZXing، والإطارات من عندنا ─────────
    let reader;
    let BinaryBitmapCls;
    let HybridBinarizerCls;
    let RGBLuminanceSourceCls;

    try {
        const {
            MultiFormatReader, DecodeHintType, BarcodeFormat,
            BinaryBitmap, HybridBinarizer, RGBLuminanceSource
        } = await import('@zxing/library');

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
            BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        reader = new MultiFormatReader();
        reader.setHints(hints);

        BinaryBitmapCls = BinaryBitmap;
        HybridBinarizerCls = HybridBinarizer;
        RGBLuminanceSourceCls = RGBLuminanceSource;
    } catch (e) {
        onError?.(e);
        return stop;
    }

    // RGBA ← تدرّج رمادي بمتوسط يُحابي الأخضر (كما تفعل ZXing)
    const toLuminance = (data, width, height) => {
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
            gray[p] = (data[i] * 306 + data[i + 1] * 601 + data[i + 2] * 117) >> 10;
        }
        return gray;
    };

    const decodeFrame = (crop) => {
        const frame = grabFrame(video, canvas, crop);
        if (!frame) return null;

        const { ctx, width, height } = frame;
        const { data } = ctx.getImageData(0, 0, width, height);
        const source = new RGBLuminanceSourceCls(toLuminance(data, width, height), width, height);
        const bitmap = new BinaryBitmapCls(new HybridBinarizerCls(source));

        try {
            return reader.decode(bitmap);
        } catch {
            return null;              // لا رمز في هذا الإطار
        } finally {
            reader.reset();           // ضروري بين الإطارات
        }
    };

    // نناوب بين شريط وسط الكادر (سريع ودقيق) والكادر الكامل
    // (يلتقط الرمز إن خرج عن الإطار) — فتبقى السرعة والتغطية معاً
    let full = false;

    const tick = () => {
        if (stopped) return;

        if (video.readyState >= 2) {
            try {
                const result = full
                    ? decodeFrame({ cropX: 1, cropY: 1 })
                    : decodeFrame({ cropX: 0.92, cropY: 0.46 });

                if (result && !stopped) {
                    onResult(String(result.getText() || '').trim(), result.getBarcodeFormat?.());
                }
            } catch { /* إطار تالف */ }
            full = !full;
        }

        loop(tick);
    };

    tick();
    return stop;
};

/** اسم المحرّك المستخدم — للعرض والتشخيص */
export const scannerEngine = () => (hasNative() ? 'native' : 'zxing');
