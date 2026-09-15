import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { arModelService } from '../services/arModelApi';
import './ARModelView.css';

/* ============================================================
   صفحة المجسّم — هي ما يفتحه رمز QR في الكتاب
   • عرض ثلاثي الأبعاد فوري مع تدوير وتكبير باللمس
   • زرّ «شاهده أمامك» يضع المجسّم في غرفتك (واقع معزّز)
   • نقاط توضيحية على المجسّم، ولوحة شرح أنيقة
   ============================================================ */

// ── أيقونات ──────────────────────────────────────────────────
const Icon = {
    Cube: (p) => (
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    ),
    Ar: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M12 8.5 8 10.7v4.6l4 2.2 4-2.2v-4.6Z" /><path d="M8 10.7 12 13l4-2.3M12 13v4.5" />
        </svg>
    ),
    Info: (p) => (
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="11" />
            <circle cx="12" cy="8" r=".6" fill="currentColor" />
        </svg>
    ),
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Rotate: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" />
        </svg>
    )
};

// ============================================================
const ARModelView = () => {
    const { slug } = useParams();
    const [model, setModel] = useState(null);
    const [error, setError] = useState(null);
    const [ready, setReady] = useState(false);
    const [progress, setProgress] = useState(0);
    const [arAvailable, setArAvailable] = useState(false);
    const [openSpot, setOpenSpot] = useState(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const viewerRef = useRef(null);

    // ── تحميل بيانات المجسّم ───────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const data = await arModelService.getBySlug(slug);
                if (!cancelled) setModel(data);
            } catch (e) {
                if (!cancelled) {
                    setError(e?.response?.status === 404
                        ? 'لم نجد مجسّماً بهذا الرمز. تأكّد من مسح الرمز الصحيح.'
                        : 'تعذّر تحميل المجسّم، تحقّق من اتصالك.');
                }
            }
        })();

        return () => { cancelled = true; };
    }, [slug]);

    // الصفحة مستقلّة تماماً: نضبط عنوان التبويب ولون شريط المتصفح
    useEffect(() => {
        if (!model?.title) return;
        const previous = document.title;
        document.title = `${model.title} · بالنوفا`;

        const meta = document.querySelector('meta[name="theme-color"]');
        const previousColor = meta?.getAttribute('content');
        meta?.setAttribute('content', '#0b1020');

        return () => {
            document.title = previous;
            if (previousColor) meta?.setAttribute('content', previousColor);
        };
    }, [model?.title]);

    // ── تحميل مشغّل العرض عند الحاجة فقط ──────────────────────
    useEffect(() => {
        if (!model) return;
        // يُسجّل الوسم <model-viewer> مرّة واحدة لكل صفحة
        import('@google/model-viewer').catch(() => setError('تعذّر تشغيل عارض المجسّمات في هذا المتصفح.'));
    }, [model]);

    // ── أحداث العارض ───────────────────────────────────────────
    const attachViewer = useCallback((node) => {
        viewerRef.current = node;
        if (!node) return;

        const onProgress = (e) => setProgress(Math.round((e.detail?.totalProgress || 0) * 100));
        const onLoad = () => {
            setReady(true);
            setArAvailable(Boolean(node.canActivateAR));
        };

        node.addEventListener('progress', onProgress);
        node.addEventListener('load', onLoad);
        return () => {
            node.removeEventListener('progress', onProgress);
            node.removeEventListener('load', onLoad);
        };
    }, []);

    const enterAR = () => {
        try { viewerRef.current?.activateAR?.(); } catch { /* غير مدعوم */ }
    };

    const resetView = () => {
        const viewer = viewerRef.current;
        if (!viewer) return;
        viewer.resetTurntableRotation?.(0);
        viewer.cameraOrbit = '0deg 75deg 105%';
        viewer.fieldOfView = 'auto';
    };

    // ── حالات ما قبل العرض ─────────────────────────────────────
    if (error) {
        return (
            <div className="arv arv-center" dir="rtl">
                <div className="arv-card">
                    <span className="arv-card-icon"><Icon.Cube /></span>
                    <h1>تعذّر العرض</h1>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!model) {
        return (
            <div className="arv arv-center" dir="rtl">
                <div className="arv-boot">
                    <span className="arv-boot-ring" />
                    <b>جاري التحضير…</b>
                </div>
            </div>
        );
    }

    const hotspots = model.hotspots || [];

    return (
        <div className="arv" dir="rtl">

            {/* ── العارض ── */}
            <div className="arv-stage">
                <model-viewer
                    ref={attachViewer}
                    src={model.model_url}
                    ios-src={model.ios_url || undefined}
                    poster={model.poster_url || undefined}
                    alt={model.title}
                    camera-controls
                    touch-action="pan-y"
                    auto-rotate
                    auto-rotate-delay="2500"
                    rotation-per-second="18deg"
                    shadow-intensity="1"
                    exposure="1"
                    environment-image="neutral"
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    ar-scale="auto"
                    loading="eager"
                    reveal="auto"
                    class="arv-viewer"
                >
                    {/* النقاط التوضيحية على سطح المجسّم */}
                    {hotspots.map((spot, i) => (
                        <button
                            key={spot.id || i}
                            className={`arv-spot ${openSpot === i ? 'is-open' : ''}`}
                            slot={`hotspot-${i}`}
                            data-position={spot.position}
                            data-normal={spot.normal}
                            data-visibility-attribute="visible"
                            onClick={() => setOpenSpot(openSpot === i ? null : i)}
                        >
                            <span className="arv-spot-dot">{i + 1}</span>
                            {openSpot === i && (
                                <span className="arv-spot-card">
                                    <b>{spot.title}</b>
                                    {spot.body && <span>{spot.body}</span>}
                                </span>
                            )}
                        </button>
                    ))}

                    {/* شاشة التحميل داخل العارض */}
                    <div className="arv-loading" slot="progress-bar">
                        {!ready && (
                            <div className="arv-loading-inner">
                                <span className="arv-boot-ring" />
                                <b>{progress > 0 ? `${progress}%` : 'جاري التحميل…'}</b>
                            </div>
                        )}
                    </div>
                </model-viewer>

                {/* تلميح الاستخدام */}
                {ready && <p className="arv-hint">حرّك بإصبعك لتدوير المجسّم — إصبعان للتكبير</p>}
            </div>

            {/* ── الترويسة ── */}
            <header className="arv-head">
                <div className="arv-brand">
                    <span className="arv-brand-mark"><Icon.Cube width="18" height="18" /></span>
                    <span>بالنوفا</span>
                </div>

                <button className="arv-icon" onClick={resetView} title="إعادة الضبط" aria-label="إعادة الضبط">
                    <Icon.Rotate />
                </button>
            </header>

            {/* ── لوحة المعلومات ── */}
            <section className={`arv-sheet ${sheetOpen ? 'is-open' : ''}`}>
                <button className="arv-grip" onClick={() => setSheetOpen(o => !o)} aria-label="التفاصيل">
                    <span />
                </button>

                <div className="arv-sheet-head">
                    <div className="arv-sheet-title">
                        <h1>{model.title}</h1>
                        {model.subtitle && <span>{model.subtitle}</span>}
                    </div>

                    <button className="arv-icon" onClick={() => setSheetOpen(o => !o)} aria-label="التفاصيل">
                        <Icon.Info />
                    </button>
                </div>

                <div className="arv-sheet-body">
                    {model.description && <p className="arv-desc">{model.description}</p>}

                    {hotspots.length > 0 && (
                        <div className="arv-spots">
                            <h2>نقاط الشرح</h2>
                            {hotspots.map((spot, i) => (
                                <button
                                    key={spot.id || i}
                                    className={`arv-spotrow ${openSpot === i ? 'is-on' : ''}`}
                                    onClick={() => setOpenSpot(openSpot === i ? null : i)}
                                >
                                    <span className="arv-spotrow-no">{i + 1}</span>
                                    <span className="arv-spotrow-text">
                                        <b>{spot.title}</b>
                                        {spot.body && <span>{spot.body}</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* زر الواقع المعزّز */}
                <button className="arv-ar" onClick={enterAR} disabled={!arAvailable}>
                    <Icon.Ar />
                    {arAvailable ? 'شاهده أمامك بالواقع المعزّز' : 'العرض ثلاثي الأبعاد فقط على هذا الجهاز'}
                </button>
            </section>
        </div>
    );
};

export default ARModelView;
