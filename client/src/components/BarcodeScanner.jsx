import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { shopService } from '../services/api';
import { startScanning, scannerEngine } from '../utils/barcodeReader';
import './BarcodeScanner.css';

/* ============================================================
   الباركود — وضعان
   • استخدام : الكاميرا تبقى مفتوحة وتمسح رمزاً تلو الآخر، فتُضيف
     كل منتج إلى قائمة بسعره، مع مجموع جارٍ.
   • تسجيل  : تمسح رمزاً فتُدخل اسمه وسعره ويُحفظ فوراً ليصير
     جاهزاً للاستخدام.
   ============================================================ */

// مهلة قبل قبول الرمز نفسه مجدداً — تمنع التكرار من إطارات متتابعة
const REPEAT_GUARD_MS = 1200;

const money = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} ₪` : null;
};

const beep = () => {
    // نغمة قصيرة من WebAudio: لا ملف صوتي ولا تحميل
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 1650;
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
        setTimeout(() => ctx.close(), 400);
    } catch { /* الصوت ليس جوهرياً */ }
};

const buzz = (pattern = 40) => {
    try { navigator.vibrate?.(pattern); } catch { /* غير مدعوم */ }
};

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Scan: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
    ),
    Tag: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
            <circle cx="7.5" cy="7.5" r="1.4" />
        </svg>
    ),
    Trash: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    Back: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    ),
    Camera: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
        </svg>
    )
};

// ============================================================
const BarcodeScanner = ({ shop, onClose }) => {
    const [mode, setMode] = useState(null);            // null | 'use' | 'register'
    const [cameraState, setCameraState] = useState('idle'); // idle | starting | live | denied | unsupported
    const [lines, setLines] = useState([]);            // بنود وضع الاستخدام
    const [lastHit, setLastHit] = useState(null);      // آخر رمز مقروء
    const [form, setForm] = useState(null);            // نموذج التسجيل
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [scanError, setScanError] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const stopScanRef = useRef(null);
    const recentRef = useRef(new Map());               // رمز ← آخر وقت قُرئ فيه
    const busyRef = useRef(false);

    const notify = (message, kind = 'ok') => {
        setFlash({ message, kind });
        setTimeout(() => setFlash(null), 2200);
    };

    // ── الكاميرا ───────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        stopScanRef.current?.();
        stopScanRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { stopCamera(); document.body.style.overflow = ''; };
    }, [stopCamera]);

    // ── معالجة الرمز المقروء ───────────────────────────────────
    const handleCode = useCallback(async (code) => {
        if (!code || busyRef.current) return;

        // نتجاهل الرمز نفسه إن قُرئ للتوّ
        const now = Date.now();
        const seenAt = recentRef.current.get(code);
        if (seenAt && now - seenAt < REPEAT_GUARD_MS) return;

        // ننظّف القديم حتى لا تنمو الخريطة في جلسة مسح طويلة
        for (const [seen, at] of recentRef.current) {
            if (now - at > REPEAT_GUARD_MS * 4) recentRef.current.delete(seen);
        }
        recentRef.current.set(code, now);

        beep();
        buzz();

        if (mode === 'register') {
            busyRef.current = true;
            let known = null;
            try {
                known = await shopService.lookupBarcode(shop.id, code);
            } catch { /* رمز جديد */ }

            setForm({
                code,
                name: known?.name || '',
                price: known?.price ?? '',
                existing: Boolean(known)
            });
            busyRef.current = false;
            return;
        }

        // وضع الاستخدام: نبحث عن الرمز ونضيفه للقائمة
        busyRef.current = true;
        try {
            const found = await shopService.lookupBarcode(shop.id, code);
            setLastHit({ ...found, known: true });
            setLines(prev => {
                const at = prev.findIndex(line => line.code === code);
                if (at === -1) return [{ ...found, quantity: 1 }, ...prev];
                const next = [...prev];
                next[at] = { ...next[at], quantity: next[at].quantity + 1 };
                return next;
            });
        } catch {
            setLastHit({ code, name: null, price: null, known: false });
            buzz([60, 50, 60]);
        } finally {
            busyRef.current = false;
        }
    }, [mode, shop.id]);

    // نُبقي أحدث نسخة من المعالج داخل حلقة المسح
    const handleCodeRef = useRef(handleCode);
    useEffect(() => { handleCodeRef.current = handleCode; }, [handleCode]);

    // ── تشغيل الكاميرا عند اختيار الوضع ────────────────────────
    useEffect(() => {
        if (!mode) return;
        let cancelled = false;

        (async () => {
            setCameraState('starting');
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraState('unsupported');
                return;
            }

            try {
                // دقّة عالية: الباركود خطوط رفيعة، والدقّة الأقل تُذيبها
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        frameRate: { ideal: 30 }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;

                // تركيز مستمر إن دعمه الجهاز — بدونه يخرج الرمز القريب عن الوضوح
                const track = stream.getVideoTracks()[0];
                try {
                    const caps = track.getCapabilities?.() || {};
                    const advanced = [];
                    if (caps.focusMode?.includes('continuous')) advanced.push({ focusMode: 'continuous' });
                    if (caps.exposureMode?.includes('continuous')) advanced.push({ exposureMode: 'continuous' });
                    if (advanced.length) await track.applyConstraints({ advanced });
                } catch { /* قيود غير مدعومة: نكمل بالإعداد الافتراضي */ }

                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    video.setAttribute('playsinline', 'true');   // يمنع ملء الشاشة على iOS
                    await video.play().catch(() => {});
                }

                setCameraState('live');

                const stop = await startScanning(
                    video,
                    (code) => handleCodeRef.current(code),
                    { onError: (err) => { console.error('Scanner start failed:', err); setScanError(true); } }
                );

                if (cancelled) stop();          // أُغلقت الشاشة أثناء التجهيز
                else stopScanRef.current = stop;
            } catch (e) {
                if (!cancelled) setCameraState(e?.name === 'NotAllowedError' ? 'denied' : 'unsupported');
            }
        })();

        return () => { cancelled = true; stopCamera(); };
    }, [mode, stopCamera]);

    // ── حفظ رمز جديد ───────────────────────────────────────────
    const saveBarcode = async () => {
        if (!form?.name.trim()) return;
        setSaving(true);
        try {
            await shopService.saveBarcode(shop.id, {
                code: form.code,
                name: form.name.trim(),
                price: form.price === '' ? null : form.price
            });
            notify(form.existing ? 'حُدّث المنتج' : 'سُجّل المنتج، صار جاهزاً للاستخدام');
            setForm(null);
            recentRef.current.delete(form.code);   // نسمح بإعادة مسحه فوراً للتأكّد
        } catch (e) {
            console.error(e);
            notify(e?.response?.data?.error || 'تعذّر الحفظ، حاول مجدداً', 'err');
        } finally {
            setSaving(false);
        }
    };

    // ── حسابات وضع الاستخدام ───────────────────────────────────
    const total = useMemo(() => lines.reduce((sum, line) => {
        const price = parseFloat(line.price);
        return Number.isFinite(price) ? sum + price * line.quantity : sum;
    }, 0), [lines]);

    const unitCount = useMemo(
        () => lines.reduce((sum, line) => sum + line.quantity, 0),
        [lines]
    );

    const unpriced = useMemo(
        () => lines.filter(line => !Number.isFinite(parseFloat(line.price))).length,
        [lines]
    );

    const changeQty = (code, delta) =>
        setLines(prev => prev
            .map(line => (line.code === code ? { ...line, quantity: line.quantity + delta } : line))
            .filter(line => line.quantity > 0));

    const leaveMode = () => {
        stopCamera();
        setMode(null);
        setCameraState('idle');
        setLastHit(null);
        setForm(null);
        recentRef.current.clear();
    };

    // ── شاشة اختيار الوضع ──────────────────────────────────────
    if (!mode) {
        return (
            <div className="bcs" dir="rtl">
                <header className="bcs-top">
                    <button className="bcs-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>
                    <div className="bcs-title"><b>الباركود</b><span>{shop?.name}</span></div>
                    <span className="bcs-icon is-ghost" />
                </header>

                <div className="bcs-choose">
                    <button className="bcs-mode is-use" onClick={() => setMode('use')}>
                        <span className="bcs-mode-icon"><Icon.Scan /></span>
                        <b>استخدام</b>
                        <span>امسح المنتجات واحداً تلو الآخر — يظهر الاسم والسعر ويُحسب المجموع</span>
                    </button>

                    <button className="bcs-mode is-reg" onClick={() => setMode('register')}>
                        <span className="bcs-mode-icon"><Icon.Tag /></span>
                        <b>تسجيل</b>
                        <span>امسح رمزاً وأدخل اسمه وسعره ليُحفظ ويصير جاهزاً للاستخدام</span>
                    </button>
                </div>
            </div>
        );
    }

    // ── شاشة المسح ─────────────────────────────────────────────
    return (
        <div className={`bcs is-scanning is-${mode}`} dir="rtl">
            <video ref={videoRef} className="bcs-video" playsInline muted autoPlay />

            {cameraState !== 'live' && (
                <div className="bcs-fallback">
                    <div className="bcs-fallback-card">
                        <span className="bcs-fallback-icon"><Icon.Camera /></span>
                        <h3>
                            {cameraState === 'starting' && 'جاري تشغيل الكاميرا…'}
                            {cameraState === 'denied' && 'الكاميرا غير مسموحة'}
                            {cameraState === 'unsupported' && 'الكاميرا غير متاحة'}
                        </h3>
                        {cameraState === 'denied' && <p>اسمح بالوصول إلى الكاميرا من إعدادات المتصفح ثم أعد المحاولة.</p>}
                        {cameraState === 'unsupported' && <p>جهازك أو متصفحك لا يدعم الكاميرا هنا.</p>}
                    </div>
                </div>
            )}

            {/* إطار التصويب */}
            {cameraState === 'live' && (
                <>
                    <div className="bcs-reticle" aria-hidden="true">
                        <span /><span /><span /><span />
                        <i className="bcs-laser" />
                    </div>

                    <p className="bcs-tip">
                        {scanError
                            ? 'تعذّر تشغيل القارئ على هذا المتصفح'
                            : 'ضع الباركود داخل الإطار على بُعد ١٠–٢٠ سم'}
                    </p>
                </>
            )}

            <header className="bcs-top is-over">
                <button className="bcs-icon" onClick={leaveMode} aria-label="رجوع"><Icon.Back /></button>
                <div className="bcs-title">
                    <b>{mode === 'use' ? 'مسح للاستخدام' : 'تسجيل رمز'}</b>
                    <span>وجّه الكاميرا نحو الباركود</span>
                </div>
                <button className="bcs-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>
            </header>

            {flash && <div className={`bcs-flash is-${flash.kind}`}>{flash.message}</div>}

            {/* ── وضع الاستخدام: آخر قراءة + القائمة + المجموع ── */}
            {mode === 'use' && (
                <section className="bcs-panel">
                    {lastHit && (
                        <div className={`bcs-hit ${lastHit.known ? '' : 'is-unknown'}`}>
                            {lastHit.known ? (
                                <>
                                    <div className="bcs-hit-text">
                                        <b>{lastHit.name}</b>
                                        <span dir="ltr">{lastHit.code}</span>
                                    </div>
                                    <span className="bcs-hit-price">{money(lastHit.price) || 'بلا سعر'}</span>
                                </>
                            ) : (
                                <>
                                    <div className="bcs-hit-text">
                                        <b>رمز غير مسجّل</b>
                                        <span dir="ltr">{lastHit.code}</span>
                                    </div>
                                    <button
                                        className="bcs-hit-add"
                                        onClick={() => { setMode('register'); setForm({ code: lastHit.code, name: '', price: '', existing: false }); }}
                                    >
                                        سجّله
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {lines.length > 0 && (
                        <div className="bcs-lines">
                            {lines.map(line => (
                                <div className="bcs-line" key={line.code}>
                                    <div className="bcs-line-text">
                                        <b>{line.name}</b>
                                        <span dir="ltr">{line.code}</span>
                                    </div>

                                    <div className="bcs-qty">
                                        <button onClick={() => changeQty(line.code, -1)} aria-label="إنقاص">−</button>
                                        <span>{line.quantity}</span>
                                        <button onClick={() => changeQty(line.code, 1)} aria-label="زيادة">+</button>
                                    </div>

                                    <span className="bcs-line-price">
                                        {money(parseFloat(line.price) * line.quantity) || '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bcs-total">
                        <div>
                            <span>المجموع{unpriced > 0 ? ' (للمسعّر)' : ''}</span>
                            <b>{total > 0 ? money(total) : '—'}</b>
                        </div>
                        <span className="bcs-count">{unitCount} قطعة</span>
                        {lines.length > 0 && (
                            <button className="bcs-clear" onClick={() => { setLines([]); setLastHit(null); }}>
                                <Icon.Trash /> تفريغ
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* ── وضع التسجيل: نموذج الاسم والسعر ── */}
            {mode === 'register' && (
                <section className="bcs-panel">
                    {form ? (
                        <div className="bcs-form">
                            <div className="bcs-form-code">
                                <span>الرمز</span>
                                <b dir="ltr">{form.code}</b>
                                {form.existing && <em>مسجّل مسبقاً — الحفظ يُحدّثه</em>}
                            </div>

                            <label className="bcs-field">
                                <span>اسم المنتج</span>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="مثال: شيبس بطاطا ٣٠غ"
                                    autoFocus
                                />
                            </label>

                            <label className="bcs-field">
                                <span>السعر <em>(اختياري)</em></span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    dir="ltr"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                    placeholder="0.00"
                                />
                            </label>

                            <div className="bcs-form-actions">
                                <button className="bcs-btn" onClick={() => setForm(null)}>إلغاء</button>
                                <button
                                    className="bcs-btn is-primary"
                                    onClick={saveBarcode}
                                    disabled={saving || !form.name.trim()}
                                >
                                    {saving ? 'جاري الحفظ…' : 'حفظ'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bcs-waiting">
                            <b>وجّه الكاميرا نحو الباركود</b>
                            <span>سيفتح النموذج تلقائياً بمجرد قراءته</span>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

export default BarcodeScanner;
