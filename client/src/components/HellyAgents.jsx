import React, { useEffect } from 'react';
import './HellyAgents.css';

/* الاستوديو الجيومكانيّ يُحمَّل كسولاً: خريطته ومحرّك Turf ثقيلان */
const GeoStudio = React.lazy(() => import('./helly/GeoStudio'));

/* ============================================================
   PalNovaa Foresight — محلّل جيومكانيّ احترافيّ

   نظامٌ مكانيٌّ كامل يعمل في المتصفّح بلا خادم ولا مفاتيح:
   رسمٌ دقيق، ومحرّك تحليلٍ مكانيّ (Turf.js)، وإحصاءٌ مكانيّ،
   واختيار موقعٍ أمثل، وباني نماذجَ جيومكانيّة — وكلّه حتميّ:
   نفس المُدخل يعطي نفس المُخرج. يعمل لأيّ زائرٍ بلا تسجيل.
   ============================================================ */

const HellyAgents = ({ onClose }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="hla" dir="rtl">
            <React.Suspense fallback={<div className="hla-busy"><span className="hla-spin" />يُحمّل الاستوديو…</div>}>
                <GeoStudio onClose={onClose} />
            </React.Suspense>
        </div>
    );
};

export default HellyAgents;
