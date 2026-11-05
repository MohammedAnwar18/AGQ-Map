import React, { useEffect, useRef, useState } from 'react';

/*
 * ───────────────────────────────────────────────────────────────────────────
 *  PalNovaa Foresight  —  /palnovaa-foresight
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  هذا الرابط يعرض صفحة البداية (السبلاش) وحدها: نمطٌ جسيميٌّ كرويّ يعبّر بصرياً
 *  عن «المحاكاة + التنبؤ + دعم القرار»، مع الاسم وشريط تحميل وحقوق النشر فقط —
 *  دون ظهور تطبيق بالنوفا أو أي شيءٍ خلفها. بقيّة الموقع لا تتأثّر.
 */

const PAGE_URL = 'https://palnovaa.com/palnovaa-foresight';
const PAGE_TITLE = 'PalNovaa Foresight — المحاكاة والتنبؤ ودعم القرار';
const PAGE_DESC = 'PalNovaa Foresight: محرّك محاكاةٍ وتنبؤٍ ودعم قرارٍ مكانيّ من بالنوفا — نمذجة مجتمعاتٍ من الوكلاء، استشراف السيناريوهات، وتحليل أثر الأحداث على الرأي والقرار.';

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

export default function PalNovaaForesightPage() {
    const canvasRef = useRef(null);
    const [progress, setProgress] = useState(0);

    /* ── وسوم SEO ── */
    useEffect(() => {
        const prevTitle = document.title;
        document.title = PAGE_TITLE;
        const restorers = [
            setMeta('meta[name="description"]', 'content', PAGE_DESC),
            setMeta('meta[name="keywords"]', 'content', 'PalNovaa Foresight, بالنوفا, محاكاة, تنبؤ, دعم القرار, simulation, forecasting, decision support'),
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

    /* ── الكرة الجسيمية + شريط التحميل ── */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf = 0, w = 0, h = 0, dpr = 1;
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

        const latN = 30, lonN = 56, pts = [];
        for (let i = 1; i < latN; i++) {
            const phi = (i / latN) * Math.PI;
            for (let j = 0; j < lonN; j++) pts.push({ phi, theta: (j / lonN) * Math.PI * 2 });
        }

        const lerp = (a, b, t) => a + (b - a) * t;
        const C0 = [92, 70, 230], C1 = [196, 58, 198], C2 = [255, 96, 12];
        const colorAt = (e) => {
            let r, g, b;
            if (e < 0.5) { const t = e / 0.5; r = lerp(C0[0], C1[0], t); g = lerp(C0[1], C1[1], t); b = lerp(C0[2], C1[2], t); }
            else { const t = (e - 0.5) / 0.5; r = lerp(C1[0], C2[0], t); g = lerp(C1[1], C2[1], t); b = lerp(C1[2], C2[2], t); }
            return [r | 0, g | 0, b | 0];
        };

        const t0 = performance.now();
        const DURATION = 3200;
        let barDone = false;

        const render = (now) => {
            const t = (now - t0) / 1000;
            if (!barDone) {
                const p = Math.min(1, (now - t0) / DURATION);
                setProgress(p);
                if (p >= 1) barDone = true;
            }

            ctx.clearRect(0, 0, w, h);
            // الكرة في الثلثين العلويّين، فيبقى الثلث السفليّ خالصاً للنصّ
            const cx = w / 2, cy = h * 0.37, R = Math.min(w, h) * 0.30;
            const ay = reduced ? 0.5 : t * 0.22, ax = -0.42;
            const cosAy = Math.cos(ay), sinAy = Math.sin(ay), cosAx = Math.cos(ax), sinAx = Math.sin(ax);
            const tw = reduced ? 0 : t;

            const list = [];
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
                let e = (Math.hypot(x1, y1) - 0.5) / 0.6 + Math.max(0, disp) * 0.75;
                e = e < 0 ? 0 : e > 1 ? 1 : e;
                list.push({ sx: cx + x1 * R, sy: cy + y1 * R, z: z2, e });
            }
            list.sort((a, b) => a.z - b.z);

            for (let k = 0; k < list.length; k++) {
                const d = list[k];
                const depth = Math.max(0, Math.min(1, (d.z + 1.3) / 2.6));
                const [r, g, b] = colorAt(d.e);
                const alpha = (0.28 + 0.72 * depth) * 0.85;
                const size = (0.9 + 1.5 * depth) * (0.8 + 0.5 * d.e);
                if (d.e > 0.62) {
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
    }, []);

    const year = new Date().getFullYear();
    return (
        <div style={{
            position: 'fixed', inset: 0, background: '#000', overflow: 'hidden',
            fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif"
        }}>
            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />

            {/* حجابٌ متدرّجٌ أسفل الشاشة يفصل النصّ عن الشكل ويضمن وضوحه */}
            <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
                background: 'linear-gradient(to top, #000 32%, rgba(0,0,0,0))', pointerEvents: 'none'
            }} />

            {/* كتلة النصّ في الأسفل، بعيداً عن الكرة */}
            <div style={{
                position: 'absolute', left: 0, right: 0,
                bottom: 'calc(6vh + env(safe-area-inset-bottom, 0px))',
                textAlign: 'center', padding: '0 20px'
            }}>
                <div style={{
                    fontSize: 'clamp(26px, 6.2vw, 42px)', fontWeight: 600, letterSpacing: '.02em', lineHeight: 1.1,
                    background: 'linear-gradient(90deg,#ff7a18 0%,#ff3d7f 45%,#8a5cff 100%)',
                    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                    WebkitTextFillColor: 'transparent'
                }}>
                    PalNovaa&nbsp;Foresight
                </div>

                <div style={{
                    margin: '22px auto 0', height: 4, width: '100%', maxWidth: 340, borderRadius: 999,
                    background: 'rgba(255,255,255,.12)', overflow: 'hidden'
                }}>
                    <div style={{
                        height: '100%', width: `${Math.round(progress * 100)}%`,
                        background: 'linear-gradient(90deg,#8a5cff,#ff3d7f,#ff7a18)',
                        borderRadius: 999, transition: 'width .18s linear',
                        boxShadow: '0 0 12px rgba(255,120,40,.5)'
                    }} />
                </div>

                <div style={{ marginTop: 28, color: 'rgba(255,255,255,.58)', fontSize: 12, letterSpacing: '.05em' }}>
                    Produced by PalNovaa
                </div>
                <div style={{ marginTop: 5, color: 'rgba(255,255,255,.4)', fontSize: 11, letterSpacing: '.03em' }}>
                    © {year} PalNovaa. All rights reserved.
                </div>
            </div>
        </div>
    );
}
