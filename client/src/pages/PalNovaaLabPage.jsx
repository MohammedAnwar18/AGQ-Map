import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PalNovaaLab from '../components/PalNovaaLab';

/*
 * ───────────────────────────────────────────────────────────────────────────
 *  صفحة مختبر بالنوفا المستقلّة  —  /palnovaa-lab
 * ───────────────────────────────────────────────────────────────────────────
 *
 *  رابطٌ مباشرٌ قابلٌ للأرشفة على محرّكات البحث، يفتح استوديو التحليل المكانيّ
 *  دون المرور بخريطة بالنوفا. الإغلاق يأخذ المستخدم إلى الخريطة.
 */

const PAGE_URL = 'https://palnovaa.com/palnovaa-lab';
const PAGE_TITLE = 'PalNovaa Lab — مختبر التحليل المكانيّ الجغرافيّ';
const PAGE_DESC = 'مختبر بالنوفا (PalNovaa Lab): استوديو نظم معلومات جغرافية احترافيّ في المتصفّح — استيراد طبقات GeoJSON وShapefile وقواعد بيانات ArcGIS الجغرافية (.gdb)، أدوات رسم وقياس وتحليل مكانيّ، وتصدير خرائط عالية الدقة.';

// ضبطُ وسمٍ من نوع <meta name="..."> أو <meta property="..."> وإعادته لاحقاً
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

export default function PalNovaaLabPage() {
    const navigate = useNavigate();

    useEffect(() => {
        const prevTitle = document.title;
        document.title = PAGE_TITLE;

        const restorers = [
            setMeta('meta[name="description"]', 'content', PAGE_DESC),
            setMeta('meta[name="keywords"]', 'content', 'PalNovaa Lab, مختبر بالنوفا, نظم معلومات جغرافية, GIS, ArcGIS, جيوداتابيس, geodatabase, GeoJSON, Shapefile, تحليل مكاني, خرائط'),
            setMeta('meta[property="og:title"]', 'content', PAGE_TITLE),
            setMeta('meta[property="og:description"]', 'content', PAGE_DESC),
            setMeta('meta[property="og:url"]', 'content', PAGE_URL),
            setMeta('meta[name="twitter:title"]', 'content', PAGE_TITLE),
            setMeta('meta[name="twitter:description"]', 'content', PAGE_DESC),
            setMeta('meta[name="robots"]', 'content', 'index, follow'),
        ];

        // الرابط الأساسيّ (canonical)
        let canonical = document.head.querySelector('link[rel="canonical"]');
        const prevCanonical = canonical ? canonical.getAttribute('href') : null;
        const canonicalCreated = !canonical;
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', PAGE_URL);

        // بياناتٌ منظّمة (JSON-LD) تساعد أرشفة جوجل كتطبيقٍ ويب
        const ld = document.createElement('script');
        ld.type = 'application/ld+json';
        ld.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'PalNovaa Lab',
            alternateName: 'مختبر بالنوفا',
            url: PAGE_URL,
            applicationCategory: 'GIS, Geographic Information System',
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

    return <PalNovaaLab onClose={() => navigate('/map')} />;
}
