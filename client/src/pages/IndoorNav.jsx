import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import arIndoorService, { arError } from '../services/arIndoorApi';
import IndoorGuide from '../components/ar/IndoorGuide';
import '../components/ar/IndoorAR.css';

/* ============================================================
   صفحة الرابط العام

   ‎/nav/:slug‎ — يفتحها من وصله الرابط أو من مسح الرمز، بلا حساب
   وبلا تطبيق. تُحمّل الخريطة ثم تُسلّم الدليلَ زمامَها.
   ============================================================ */

const Splash = ({ title, note, children }) => (
    <div className="ai" dir="rtl">
        <div className="ars-gate">
            <div className="ars-gate-card">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                    <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 7z" />
                    <path d="M9 4v13M15 7v12.5" />
                </svg>
                <b>{title}</b>
                {note && <p>{note}</p>}
                {children}
            </div>
        </div>
    </div>
);

const IndoorNav = () => {
    const { slug } = useParams();

    const [map, setMap] = useState(null);
    const [error, setError] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        setError(null);
        setMap(null);

        arIndoorService.open(slug)
            .then(data => { if (alive) setMap(data); })
            .catch(err => { if (alive) setError(arError(err, 'تعذّر فتح الخريطة')); });

        return () => { alive = false; };
    }, [slug, attempt]);

    useEffect(() => {
        if (map?.venue?.title) document.title = `${map.venue.title} · دليل داخلي`;
    }, [map]);

    if (error) {
        return (
            <Splash title="لم نجد هذه الخريطة" note={error}>
                <button className="ars-start" onClick={() => setAttempt(n => n + 1)}>أعد المحاولة</button>
            </Splash>
        );
    }

    if (!map) return <Splash title="يفتح الخريطة…" note="لحظة واحدة" />;

    if (!map.nodes?.length) {
        return (
            <Splash
                title={map.venue.title}
                note="هذه الخريطة لم تُبنَ بعد — لا أماكن فيها. راجع من أرسل لك الرابط."
            />
        );
    }

    return <IndoorGuide venue={map.venue} nodes={map.nodes} edges={map.edges} places={map.places} />;
};

export default IndoorNav;
