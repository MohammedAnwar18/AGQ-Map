/**
 * قارئ باركود سريع يعمل على كل الأجهزة.
 *
 * يفضّل واجهة المتصفح الأصلية BarcodeDetector حين تتوفّر (أندرويد/كروم):
 * تعمل على مستوى النظام فهي الأسرع والأدقّ. وحين لا تتوفّر — سفاري iOS
 * مثلاً — نسقط إلى ZXing وهي مكتبة برمجية تقرأ نفس الصيغ.
 */

// صيغ باركود المنتجات الشائعة + QR
const FORMATS = [
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'code_93',
    'itf', 'codabar', 'qr_code'
];

const hasNative = () => typeof window !== 'undefined' && 'BarcodeDetector' in window;

/** يتحقّق أن الواجهة الأصلية تدعم صيغاً فعلاً (بعض الأجهزة تعلنها بلا دعم) */
const nativeDetector = async () => {
    if (!hasNative()) return null;
    try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const usable = FORMATS.filter(f => supported.includes(f));
        if (!usable.length) return null;
        return new window.BarcodeDetector({ formats: usable });
    } catch {
        return null;
    }
};

/**
 * يبدأ المسح المستمر على عنصر <video>.
 *
 * onResult يُستدعى لكل رمز مقروء. المُعيد دالة إيقاف.
 * ملاحظة: مسؤولية تشغيل الكاميرا على المُستدعي — نقرأ من الفيديو فقط.
 */
export const startScanning = async (video, onResult, { intervalMs = 120 } = {}) => {
    let stopped = false;
    let timer = null;
    let zxingReader = null;

    const detector = await nativeDetector();

    // ── المسار الأصلي: BarcodeDetector ────────────────────────
    if (detector) {
        const tick = async () => {
            if (stopped) return;
            try {
                if (video.readyState >= 2) {
                    const codes = await detector.detect(video);
                    if (codes?.length && !stopped) {
                        onResult(String(codes[0].rawValue || '').trim(), codes[0].format);
                    }
                }
            } catch {
                // إطار تعذّرت قراءته: نتجاهله ونكمل
            }
            if (!stopped) timer = setTimeout(tick, intervalMs);
        };
        tick();

        return () => { stopped = true; clearTimeout(timer); };
    }

    // ── المسار البديل: ZXing ──────────────────────────────────
    const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/library');

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93,
        BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE
    ]);
    // يحاول أكثر لكل إطار: أبطأ قليلاً لكن يلتقط الرموز الباهتة والمائلة
    hints.set(DecodeHintType.TRY_HARDER, true);

    // المُعامل الثاني عدد المللي ثانية بين المحاولات، لا كائن خيارات
    zxingReader = new BrowserMultiFormatReader(hints, intervalMs);

    // النسخة المستمرة هي التي تقبل دالة استدعاء؛ decodeFromVideoElement
    // تقرأ مرّة واحدة فقط وتعيد وعداً
    zxingReader
        .decodeFromVideoElementContinuously(video, (result) => {
            if (stopped || !result) return;
            onResult(String(result.getText() || '').trim(), result.getBarcodeFormat?.());
        })
        .catch(() => { /* أُوقف القارئ */ });

    return () => {
        stopped = true;
        try { zxingReader?.reset(); } catch { /* أُفرغ مسبقاً */ }
    };
};

/** اسم المحرّك المستخدم — للعرض في الواجهة */
export const scannerEngine = () => (hasNative() ? 'native' : 'zxing');
