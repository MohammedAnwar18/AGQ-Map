import { useEffect } from 'react';

/* ============================================================================
   useEngineBranding — يضبط عنوان التبويب وأيقونته لصفحات محرّك بالنوفا،
   ويُعيد الأصل تلقائياً عند مغادرة الصفحة (حتى يبقى الموقع الأساس كما هو).
   ============================================================================ */
export default function useEngineBranding(
  enabled = true,
  title = 'PalNovaa Engine',
  iconHref = '/palnovaa-engine-icon.svg'
) {
  useEffect(() => {
    if (!enabled) return undefined;

    const prevTitle = document.title;
    document.title = title;

    // أزِل أيقونات الموقع الحاليّة مؤقّتاً وأضِف أيقونة المحرّك (SVG)
    const prevIcons = Array.from(document.querySelectorAll("link[rel~='icon']"));
    prevIcons.forEach((l) => l.parentNode && l.parentNode.removeChild(l));

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = iconHref;
    document.head.appendChild(link);

    return () => {
      document.title = prevTitle;
      link.remove();
      prevIcons.forEach((l) => document.head.appendChild(l));
    };
  }, [enabled, title, iconHref]);
}
