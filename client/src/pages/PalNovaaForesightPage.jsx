import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * ───────────────────────────────────────────────────────────────────────────
 *  PalNovaa Foresight  —  /palnovaa-foresight
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  المحرّك سابقاً «HellyAgents». نُقل من القائمة الرئيسية إلى رابطٍ مستقلٍّ
 *  قابلٍ للأرشفة، تفتحه صفحةُ بدايةٍ (سبلاش) ذات نمطٍ جسيميّ يعبّر بصرياً عن
 *  «المحاكاة + التنبؤ + دعم القرار» دون نصوصٍ وصفية — فقط الاسم وشريط تحميل
 *  وحقوق النشر — ثم يُسلّم إلى الاستوديو.
 */

const HellyAgents = React.lazy(() => import('../components/HellyAgents'));

const PAGE_URL = 'https://palnovaa.com/palnovaa-foresight';
const PAGE_TITLE = 'PalNovaa Foresight — المحاكاة والتنبؤ ودعم القرار';
const PAGE_DESC = 'PalNovaa Foresight: محرّك محاكاةٍ وتنبؤٍ ودعم قرارٍ مكانيّ من بالنوفا — نمذجة مجتمعاتٍ من الوكلاء، استشراف السيناريوهات، وتحليل أثر الأحداث على الرأي والقرار في المتصفّح.';

const setMeta = (selector, attr, value) => {
    let el = document.head.querySelector(selector);
    let created = false;
    const prev = el ? el.getAttribute(attr) : null;
    if (!el) {
        el = document.createElement('meta');
        const m = selector.match(/\[(name|property)="([^"]+)"\]/);
        if (m) el.setAttribute(m[1], m[2]);
        document.head.appendChild(el);
        created = true;
    }
    el.setAttribute(attr, value);
    return { el, attr, prev, created };
};

/* ───────────────────── صفحة البداية (Splash) ───────────────────── */
function ForesightSplash({ onDone }) {
    const canvasRef = useRef(null);
    const [progress, setProgress] = useState(0);
    const [fading, setFading] = useState(false);
    const doneRef = useRef(false);

    // إنهاءٌ ناعم: تلاشٍ ثم تسليم
    const finish = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        setProgress(1);
        setFading(true);
        setTimeout(() => onDone && onDone(), 680);
    };

    // رسم الكرة الجسيمية + تقدّم شريط التحميل
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf = 0;
        let w = 0, h = 0, dpr = 1;
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const resize = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.clientWidth; h = canvas.clientHeight;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        // شبكة نقاطٍ على سطح كرة (خطوط طول/عرض)
        const latN = 30, lonN = 56, pts = [];
        for (let i = 1; i < latN; i++) {
            const phi = (i / latN) * Math.PI;           // 0..π
            for (let j = 0; j < lonN; j++) {
                const theta = (j / lonN) * Math.PI * 2;   // 0..2π
                pts.push({ phi, theta });
            }
        }

        const lerp = (a, b, t) => a + (b - a) * t;
        // بنفسجي-أزرق في القلب → ماجنتا → برتقالي عند الأطراف المتموّجة
        const C0 = [92, 70, 230], C1 = [196, 58, 198], C2 = [255, 96, 12];
        const colorAt = (e) => {
            let r, g, b;
            if (e < 0.5) { const t = e / 0.5; r = lerp(C0[0], C1[0], t); g = lerp(C0[1], C1[1], t); b = lerp(C0[2], C1[2], t); }
            else { const t = (e - 0.5) / 0.5; r = lerp(C1[0], C2[0], t); g = lerp(C1[1], C2[1], t); b = lerp(C1[2], C2[2], t); }
            return [r | 0, g | 0, b | 0];
        };

        const t0 = performance.now();
        const DURATION = 3400; // مدة شريط التحميل التقريبية
        const render = (now) => {
            const t = (now - t0) / 1000;
            // تقدّم التحميل
            if (!doneRef.current) {
                const p = Math.min(1, (now - t0) / DURATION);
                setProgress(p);
                if (p >= 1) finish();
            }

            ctx.clearRect(0, 0, w, h);
            const cx = w / 2, cy = h * 0.44, R = Math.min(w, h) * 0.34;
            const ay = reduced ? 0.5 : t * 0.22;      // دوران حول المحور الرأسي
            const ax = -0.42;                          // ميلٌ لمنظورٍ ثلاثيّ الأبعاد
            const cosAy = Math.cos(ay), sinAy = Math.sin(ay), cosAx = Math.cos(ax), sinAx = Math.sin(ax);
            const tw = reduced ? 0 : t; // زمن الموجات

            const drawList = [];
            for (let k = 0; k < pts.length; k++) {
                const { phi, theta } = pts[k];
                const sinp = Math.sin(phi), cosp = Math.cos(phi);
                const ux = sinp * Math.cos(theta), uy = cosp, uz = sinp * Math.sin(theta);
                const disp = 0.15 * Math.sin(2.6 * phi + tw * 1.05)
                    + 0.12 * Math.sin(3.4 * theta + tw * 0.8 + phi)
                    + 0.10 * Math.sin(1.9 * phi + 2.2 * theta - tw * 1.3);
                const rr = 1 + 0.22 * disp;
                const x = ux * rr, y = uy * rr, z = uz * rr;
                const x1 = x * cosAy + z * sinAy;
                const z1 = -x * sinAy + z * cosAy;
                const y1 = y * cosAx - z1 * sinAx;
                const z2 = y * sinAx + z1 * cosAx;
                const sx = cx + x1 * R, sy = cy + y1 * R;
                const d2 = Math.hypot(x1, y1);
                let e = (d2 - 0.5) / 0.6; e = e + Math.max(0, disp) * 0.75;
                e = e < 0 ? 0 : e > 1 ? 1 : e;
                drawList.push({ sx, sy, z: z2, e });
            }
            drawList.sort((a, b) => a.z - b.z); // خلفيّ ثم أماميّ

            for (let k = 0; k < drawList.length; k++) {
                const d = drawList[k];
                const depth = (d.z + 1.3) / 2.6;            // 0..1 أماميّة
                const [r, g, b] = colorAt(d.e);
                const alpha = (0.28 + 0.72 * Math.max(0, Math.min(1, depth))) * (0.85);
                const size = (0.9 + 1.5 * depth) * (0.8 + 0.5 * d.e);
                if (d.e > 0.62) { // توهّجٌ للأطراف البرتقالية
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(${r},${g},${b},${0.10 * d.e})`;
                    ctx.arc(d.sx, d.sy, size * 3.4, 0, 6.2832);
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
                ctx.arc(d.sx, d.sy, size, 0, 6.2832);
                ctx.fill();
            }
            raf = requestAnimationFrame(render);
        };
        raf = requestAnimationFrame(render);

        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const year = new Date().getFullYear();
    return (
        <div
            onClick={finish}
            style={{
                position: 'fixed', inset: 0, zIndex: 20000, background: '#000',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                opacity: fading ? 0 : 1, transition: 'opacity .66s ease', cursor: 'pointer',
                fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", overflow: 'hidden'
            }}
            aria-label="PalNovaa Foresight"
        >
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', paddingBottom: '9vh', width: '90%', maxWidth: 460 }}>
                <div style={{
                    fontSize: 'clamp(26px, 6vw, 40px)', fontWeight: 600, letterSpacing: '.02em', lineHeight: 1.1,
                    background: 'linear-gradient(90deg,#ff7a18 0%,#ff3d7f 45%,#8a5cff 100%)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                    WebkitTextFillColor: 'transparent', textShadow: '0 0 24px rgba(255,120,40,.18)'
                }}>
                    PalNovaa&nbsp;Foresight
                </div>

                {/* شريط التحميل */}
                <div style={{
                    marginTop: 22, height: 4, width: '100%', borderRadius: 999,
                    background: 'rgba(255,255,255,.12)', overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%', width: `${Math.round(progress * 100)}%`,
                        background: 'linear-gradient(90deg,#8a5cff,#ff3d7f,#ff7a18)',
                        borderRadius: 999, transition: 'width .18s linear',
                        boxShadow: '0 0 12px rgba(255,120,40,.5)'
                    }} />
                </div>

                {/* حقوق النشر */}
                <div style={{ marginTop: 26, color: 'rgba(255,255,255,.55)', fontSize: 12, letterSpacing: '.04em' }}>
                    Produced by PalNovaa
                </div>
                <div style={{ marginTop: 4, color: 'rgba(255,255,255,.38)', fontSize: 11, letterSpacing: '.03em' }}>
                    © {year} PalNovaa. All rights reserved.
                </div>
            </div>
        </div>
    );
}

export default function PalNovaaForesightPage() {
    const navigate = useNavigate();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const prevTitle = document.title;
        document.title = PAGE_TITLE;
        const restorers = [
            setMeta('meta[name="description"]', 'content', PAGE_DESC),
            setMeta('meta[name="keywords"]', 'content', 'PalNovaa Foresight, بالنوفا, محاكاة, تنبؤ, دعم القرار, simulation, forecasting, decision support, multi-agent, وكلاء'),
            setMeta('meta[property="og:title"]', 'content', PAGE_TITLE),
            setMeta('meta[property="og:description"]', 'content', PAGE_DESC),
            setMeta('meta[property="og:url"]', 'content', PAGE_URL),
            setMeta('meta[name="twitter:title"]', 'content', PAGE_TITLE),
            setMeta('meta[name="twitter:description"]', 'content', PAGE_DESC),
            setMeta('meta[name="robots"]', 'content', 'index, follow'),
        ];
        let canonical = document.head.querySelector('link[rel="canonical"]');
        const prevCanonical = canonical ? canonical.getAttribute('href') : null;
        const canonicalCreated = !canonical;
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', PAGE_URL);

        const ld = document.createElement('script');
        ld.type = 'application/ld+json';
        ld.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'PalNovaa Foresight',
            url: PAGE_URL,
            applicationCategory: 'Simulation, Forecasting, Decision Support',
            operatingSystem: 'Web Browser',
            description: PAGE_DESC,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        });
        document.head.appendChild(ld);

        return () => {
            document.title = prevTitle;
            restorers.forEach(({ el, attr, prev, created }) => {
                if (created) el.remove();
                else if (prev !== null) el.setAttribute(attr, prev);
            });
            if (canonicalCreated) canonical.remove();
            else if (prevCanonical !== null) canonical.setAttribute('href', prevCanonical);
            ld.remove();
        };
    }, []);

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
            <React.Suspense fallback={null}>
                <HellyAgents onClose={() => navigate('/map')} />
            </React.Suspense>
            {!ready && <ForesightSplash onDone={() => setReady(true)} />}
        </div>
    );
}
