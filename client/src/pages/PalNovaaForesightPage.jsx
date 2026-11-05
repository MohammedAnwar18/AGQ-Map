import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * ───────────────────────────────────────────────────────────────────────────
 *  PalNovaa Foresight — الاستوديو  —  /palnovaa-foresight/app
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  صفحة البداية (السبلاش) أصبحت ملفّاً ثابتاً مستقلاً على /palnovaa-foresight
 *  (كـ /cadrev تماماً) فلا تظهر سبلاش الموقع العامّة. بعد انتهاء السبلاش تُسلّم
 *  إلى هذه الصفحة التي تعرض واجهة المحرّك (الاستوديو) مباشرةً دون أي سبلاش.
 */

const HellyAgents = React.lazy(() => import('../components/HellyAgents'));

const LANDING_URL = 'https://palnovaa.com/palnovaa-foresight';
const PAGE_TITLE = 'PalNovaa Foresight — المحاكاة والتنبؤ ودعم القرار';
const PAGE_DESC = 'PalNovaa Foresight: محرّك محاكاةٍ وتنبؤٍ ودعم قرارٍ مكانيّ من بالنوفا.';

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
    const navigate = useNavigate();

    useEffect(() => {
        const prevTitle = document.title;
        document.title = PAGE_TITLE;
        const restorers = [
            setMeta('meta[name="description"]', 'content', PAGE_DESC),
            // صفحة التطبيق خلف السبلاش: الصفحة القابلة للأرشفة هي الرابط الأساس
            setMeta('meta[name="robots"]', 'content', 'noindex, follow'),
        ];
        let canonical = document.head.querySelector('link[rel="canonical"]');
        const prevCanonical = canonical ? canonical.getAttribute('href') : null;
        const canonicalCreated = !canonical;
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', LANDING_URL);

        return () => {
            document.title = prevTitle;
            restorers.forEach(({ el, attr, prev, created }) => {
                if (created) el.remove();
                else if (prev !== null) el.setAttribute(attr, prev);
            });
            if (canonicalCreated) canonical.remove();
            else if (prevCanonical !== null) canonical.setAttribute('href', prevCanonical);
        };
    }, []);

    return (
        <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
            <React.Suspense fallback={null}>
                <HellyAgents onClose={() => navigate('/map')} />
            </React.Suspense>
        </div>
    );
}
