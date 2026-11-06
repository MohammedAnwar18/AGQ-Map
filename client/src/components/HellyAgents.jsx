import React, { useEffect } from 'react';
import './HellyAgents.css';
import './helly/SpatialAgent.css';
import './helly/AgentStudio.css';

/* الاستوديو يُحمَّل كسولاً: خريطته ومحرّكاته ثقيلة، فلا تُحمَّل قبل أوانها */
const AgentStudio = React.lazy(() => import('./helly/AgentStudio'));

/* ============================================================
   PalNovaa Foresight — التحليل المكانيّ الذكيّ

   واجهةٌ واحدة لغرضٍ واحد: وقع حدثٌ هنا، فماذا يحدث للمعالم؟
   يُجاب بسلسلةٍ ماديّة محسوبة من بياناتٍ مفتوحة (OpenStreetMap +
   Esri) ومعاييرَ عالمية (HCM · NFPA · SFPE · WHO · ERG)، بلا رأيٍ
   ولا نموذجٍ لغوي — فنتيجته واحدة لنفس المُدخل، تُراجَع وتُبنى عليها
   القرارات. ويعمل لأيّ زائر بلا تسجيل.
   ============================================================ */

/* شعار Foresight: نقاطٌ على حلقاتٍ متحدة المركز بتدرّج بنفسجي→برتقالي */
const FsGlyph = ({ size = 48, className = '' }) => {
    const dots = [];
    [{ r: 0, n: 1 }, { r: 7, n: 7 }, { r: 14, n: 13 }, { r: 21, n: 20 }].forEach(({ r, n }) => {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + r * 0.12;
            dots.push([24 + r * Math.cos(a), 24 + r * Math.sin(a), r]);
        }
    });
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
            <defs>
                <radialGradient id="fsGlyphGrad" cx="50%" cy="45%" r="62%">
                    <stop offset="0%" stopColor="#7b5cff" />
                    <stop offset="55%" stopColor="#c23bc0" />
                    <stop offset="100%" stopColor="#ff6a00" />
                </radialGradient>
            </defs>
            {dots.map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r > 17 ? 1.1 : 1.6} fill="url(#fsGlyphGrad)" />
            ))}
        </svg>
    );
};

const CloseIcon = (p) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const HellyAgents = ({ onClose }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="hla" dir="rtl">
            <header className="hla-top">
                <div className="hla-brand">
                    <FsGlyph size={40} className="hla-brand-mark" />
                    <div>
                        <b>PalNovaa Foresight</b>
                        <span>التحليل المكانيّ الذكيّ · بياناتٌ مفتوحة ومعاييرُ عالمية</span>
                    </div>
                </div>

                {onClose && (
                    <button className="hla-icon" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
                )}
            </header>

            <div className="hla-body">
                <React.Suspense fallback={<div className="hla-busy"><span className="hla-spin" />يُحمّل الاستوديو…</div>}>
                    <AgentStudio />
                </React.Suspense>
            </div>
        </div>
    );
};

export default HellyAgents;
