import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/* ============================================================================
   PalNovaa Engine — عارض المشروع  (/pe/:slug)
   يجلب التطبيق المحفوظ ويعرضه بملء الشاشة في إطارٍ معزول. رابطٌ دائم يعمل
   لأيّ زائرٍ بلا تسجيل.
   ============================================================================ */

const API = import.meta.env.VITE_API_URL || '/api';

export default function PalNovaaEngineView() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState({ loading: true, project: null, error: null });

    useEffect(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        document.documentElement.classList.add('pn-foresight');
        let alive = true;
        (async () => {
            try {
                const r = await fetch(`${API}/engine/projects/${slug}`);
                const d = await r.json();
                if (!alive) return;
                if (d.ok && d.project) { setState({ loading: false, project: d.project, error: null }); document.title = `${d.project.title} — PalNovaa Engine`; }
                else setState({ loading: false, project: null, error: 'not found' });
            } catch { if (alive) setState({ loading: false, project: null, error: 'network' }); }
        })();
        return () => { alive = false; document.documentElement.classList.remove('pn-foresight'); };
    }, [slug]);

    const wrap = { position: 'fixed', inset: 0, background: '#080b14', display: 'flex', flexDirection: 'column', fontFamily: "'Readex Pro', system-ui, sans-serif", color: '#eef1f8' };
    const bar = { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', background: '#0d1120' };

    if (state.loading) {
        return (
            <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center' }} dir="rtl">
                <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#7b5cff', animation: 'pneSpin .8s linear infinite' }} />
                <style>{'@keyframes pneSpin{to{transform:rotate(360deg)}}'}</style>
            </div>
        );
    }

    if (!state.project) {
        return (
            <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24 }} dir="rtl">
                <div style={{ fontSize: 42, opacity: .5 }}>🗺</div>
                <h2 style={{ margin: 0, fontSize: 18 }}>المشروع غير موجود</h2>
                <p style={{ margin: 0, color: '#9aa3bd', fontSize: 13 }}>قد يكون الرابط خاطئاً أو حُذف المشروع.</p>
                <button onClick={() => navigate('/palnovaa-engine')} style={{ marginTop: 6, cursor: 'pointer', background: '#7b5cff', color: '#fff', border: 'none', borderRadius: 11, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600 }}>افتح محرّك بالنوفا</button>
            </div>
        );
    }

    return (
        <div style={wrap} dir="rtl">
            <div style={bar}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#7b5cff,#c23bc0 52%,#ff7a18)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 15, flex: '0 0 auto' }}>◎</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.project.title}</div>
                    <div style={{ fontSize: 10.5, color: '#6b7493' }}>صُنع بمحرّك بالنوفا · PalNovaa 1.0</div>
                </div>
                <button onClick={() => navigate('/palnovaa-engine')} style={{ cursor: 'pointer', background: '#192135', color: '#eef1f8', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '7px 13px', font: 'inherit', fontSize: 12 }}>فتح المحرّك</button>
            </div>
            {/* عند توفّر رابط R2 نُحمّله من دومينه المنفصل (عزلٌ أمنيّ عن كوكيز/جلسات المنصّة)،
                وإلّا نعرض الكود مباشرةً في إطارٍ معزول عبر srcDoc. */}
            {state.project.public_url ? (
                <iframe
                    title={state.project.title}
                    sandbox="allow-scripts allow-popups allow-forms allow-modals"
                    src={state.project.public_url}
                    style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                />
            ) : (
                <iframe
                    title={state.project.title}
                    sandbox="allow-scripts allow-popups allow-forms allow-modals"
                    srcDoc={state.project.html}
                    style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                />
            )}
        </div>
    );
}
