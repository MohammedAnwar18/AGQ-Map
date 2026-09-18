import React, { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

import WorldScene from './WorldScene';
import { useWorld } from './worldStore';
import { WorldPanel, NodeEditor, AssetBrowser, Inspector, RecordBar, WorldFile } from './panels';
import './WorldEditor.css';

/* ============================================================
   محرّر العالم — Toon/Anime بـ React Three Fiber

   ليس عرضاً توضيحياً بل أداة تحرير: أربع لوحات مستقلّة فوق مشهد
   واحد، وكلّها تكتب في مخزن واحد يُحفظ ويُسترجع كملف world.json.

   يُفتح من أيقونة في الشريط العلوي للأدمن وحده، ويُحمَّل كسولاً
   (React.lazy) فلا تُنزّل حزمة Three.js على من لا يفتحه.
   ============================================================ */

const PANELS = [
    { key: 'world', label: 'العالم' },
    { key: 'nodes', label: 'العقد' },
    { key: 'assets', label: 'الأصول' },
    { key: 'record', label: 'التسجيل' }
];

/** قياس معدّل الإطارات — معيار القبول في خطة المشروع رقمي، فليكن ظاهراً */
const FpsProbe = ({ onSample }) => {
    const frames = useRef(0);
    const since = useRef(performance.now());

    useFrame(() => {
        frames.current++;
        const now = performance.now();
        if (now - since.current >= 1000) {
            onSample(Math.round((frames.current * 1000) / (now - since.current)));
            frames.current = 0;
            since.current = now;
        }
    });

    return null;
};

const Loading = () => (
    <div className="we-loading">
        <span className="we-spin" />
        يبني المشهد…
    </div>
);

const WorldEditor = ({ onClose }) => {
    const canvasRef = useRef(null);

    const [fps, setFps] = useState(null);
    const [notice, setNotice] = useState(null);
    const [shown, setShown] = useState({ world: true, nodes: true, assets: true, record: true });

    // على الشاشات الضيّقة لوحة واحدة في كل مرّة، وإلا غطّت المشهد كلّه
    const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
    const [tab, setTab] = useState('world');

    const placementType = useWorld(s => s.placementType);
    const setPlacement = useWorld(s => s.setPlacement);
    const selectedId = useWorld(s => s.selectedId);
    const removeItem = useWorld(s => s.removeItem);

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 3000);
    }, []);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 900px)');
        const onChange = (e) => setNarrow(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Esc يُلغي وضع الوضع أولاً ثم يُغلق، وDelete يحذف المحدّد
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (useWorld.getState().placementType) setPlacement(null);
                else onClose?.();
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId
                && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
                e.preventDefault();
                removeItem(selectedId);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, selectedId, removeItem, setPlacement]);

    const toggle = (key) => setShown(s => ({ ...s, [key]: !s[key] }));
    const visible = (key) => (narrow ? tab === key : shown[key]);

    return (
        <div className="we" dir="rtl">
            <header className="we-top">
                <div className="we-brand">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                        <path d="M12 2.6 21 7.3v9.4L12 21.4 3 16.7V7.3z" />
                        <path d="M3 7.3 12 12l9-4.7M12 12v9.4" />
                    </svg>
                    <div>
                        <b>محرّر العالم</b>
                        <span>مشهد Toon ثلاثي الأبعاد · React Three Fiber</span>
                    </div>
                </div>

                <div className="we-topright">
                    {fps !== null && (
                        <span className={`we-fps${fps < 30 ? ' is-low' : fps < 45 ? ' is-mid' : ''}`}>
                            {fps} <i>إطار/ث</i>
                        </span>
                    )}

                    {!narrow && (
                        <div className="we-chips">
                            {PANELS.map(p => (
                                <button
                                    key={p.key}
                                    className={shown[p.key] ? 'is-on' : ''}
                                    onClick={() => toggle(p.key)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button className="we-icon" onClick={onClose} aria-label="إغلاق">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </header>

            <div className="we-stage">
                <Canvas
                    shadows
                    dpr={[1, 2]}
                    camera={{ position: [0, 13, 58], fov: 52, near: 0.5, far: 700 }}
                    gl={{
                        antialias: true,
                        // مطلوب كي يلتقط MediaRecorder اللوحة على كل المتصفّحات
                        preserveDrawingBuffer: true,
                        toneMapping: THREE.ACESFilmicToneMapping,
                        toneMappingExposure: 1.15
                    }}
                    onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
                >
                    <Suspense fallback={null}>
                        <WorldScene />
                    </Suspense>
                    <FpsProbe onSample={setFps} />
                </Canvas>

                {/* أول إطار لم يُرسم بعد: الحزمة تُجلب أو المشهد يُبنى */}
                {fps === null && <Loading />}

                {placementType && (
                    <div className="we-placing">
                        وضع الوضع مفعّل — انقر المشهد أو الخريطة لإسقاط نسخة
                        <button onClick={() => setPlacement(null)}>إلغاء</button>
                    </div>
                )}

                {notice && <div className={`we-flash is-${notice.kind}`}>{notice.message}</div>}

                {/* اللوحات — تطفو فوق المشهد على الشاشات الواسعة */}
                <div className="we-overlay">
                    <div className="we-col we-col-start">
                        {visible('nodes') && <NodeEditor onClose={narrow ? null : () => toggle('nodes')} />}
                        {visible('assets') && <AssetBrowser onClose={narrow ? null : () => toggle('assets')} />}
                    </div>

                    <div className="we-col we-col-end">
                        {visible('world') && <WorldPanel onClose={narrow ? null : () => toggle('world')} />}
                        <Inspector />
                        {visible('record') && (
                            <RecordBar canvasRef={canvasRef} onFlash={flash} onClose={narrow ? null : () => toggle('record')} />
                        )}
                        {(!narrow || tab === 'record') && <WorldFile onFlash={flash} />}
                    </div>
                </div>
            </div>

            {narrow && (
                <nav className="we-tabs">
                    {PANELS.map(p => (
                        <button key={p.key} className={tab === p.key ? 'is-on' : ''} onClick={() => setTab(p.key)}>
                            {p.label}
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
};

export default WorldEditor;
