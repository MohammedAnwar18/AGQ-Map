import React, { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

import WorldScene from './WorldScene';
import { useWorld } from './worldStore';
import { WalkControls, DriveControls } from './walk';
import MiniMap from './MiniMap';
import { WorldPanel, TerrainPanel, NodeEditor, AssetBrowser, Inspector, RecordBar, WorldFile } from './panels';
import { AdaptiveResolution } from './quality';
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
    { key: 'land', label: 'التضاريس' },
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

/**
 * عمود اللوحات.
 *
 * ممرّر لا يُعلن عن نفسه ممرّر لا يوجد: المستخدم لا يجرّب التمرير على
 * ما يبدو منتهياً. فنقيس بعد كل تمرير وكل تغيّر في المحتوى، ونُضيء
 * حافّة سفلية متدرّجة وسهماً ما دام تحتها شيء.
 *
 * ResizeObserver لأن المحتوى يطول ويقصر بلا تمرير — قسم يُفتح، لوحة
 * فحص تظهر — ولا حدث تمرير يقع حينها.
 */
const ScrollColumn = ({ className, children }) => {
    const ref = useRef(null);
    const [more, setMore] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;

        const measure = () => {
            setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
        };

        measure();
        el.addEventListener('scroll', measure, { passive: true });

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        for (const child of el.children) observer.observe(child);

        return () => {
            el.removeEventListener('scroll', measure);
            observer.disconnect();
        };
    }, [children]);

    return (
        <div className={`we-colwrap${more ? ' has-more' : ''}`}>
            <div className={className} ref={ref}>{children}</div>
            <button
                className="we-more"
                aria-hidden={!more}
                tabIndex={-1}
                onClick={() => ref.current?.scrollBy({ top: 240, behavior: 'smooth' })}
            >
                ▾ تحته مزيد
            </button>
        </div>
    );
};

const Loading = () => (
    <div className="we-loading">
        <span className="we-spin" />
        يبني المشهد…
    </div>
);

const WorldEditor = ({ onClose }) => {
    const canvasRef = useRef(null);
    const rootRef = useRef(null);

    const [fps, setFps] = useState(null);
    const [notice, setNotice] = useState(null);
    const [shown, setShown] = useState({ world: true, land: false, nodes: true, assets: true, record: true });

    // على الشاشات الضيّقة لوحة واحدة في كل مرّة، وإلا غطّت المشهد كلّه
    const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
    const [tab, setTab] = useState('world');

    // ارتفاع ورقة اللوحات على الجوال. الشاشة الصغيرة لا تتّسع للمشهد
    // واللوحة معاً، والاختيار بينهما يتبدّل بحسب ما تفعل: تنحت فتريد
    // الأرض، وتضبط فتريد اللوحة. فيكون ارتفاعها بيدك لا رقماً نُقرّره.
    const [sheet, setSheet] = useState('half');

    const placementType = useWorld(s => s.placementType);
    const setPlacement = useWorld(s => s.setPlacement);
    const mode = useWorld(s => s.mode);
    const setMode = useWorld(s => s.setMode);
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

    /*
     * ارتفاع المحرّر بالبكسل من المتصفّح نفسه.
     *
     * ‎100dvh‎ في الأنماط تكفي حيث تُفهم، وهذا حزامها: متصفّح قديم
     * لا يعرفها يقع على ‎100vh‎ — وهي على الجوال «الشاشة الكبيرة»،
     * أي أطول ممّا يُرى بقدر شريط العنوان. عندها لا يفيض العمود عن
     * حاويته فلا يظهر له ممرّر، ويبقى أسفل اللوحة خارج الشاشة بلا
     * سبيل إليه. ‎innerHeight‎ لا يكذب، و‎visualViewport‎ يضبطها حين
     * تفتح لوحة المفاتيح.
     */
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        const fit = () => {
            const h = window.visualViewport?.height || window.innerHeight;
            if (h > 0) root.style.setProperty('--we-h', `${Math.round(h)}px`);
        };

        fit();
        window.addEventListener('resize', fit);
        window.addEventListener('orientationchange', fit);
        window.visualViewport?.addEventListener('resize', fit);

        return () => {
            window.removeEventListener('resize', fit);
            window.removeEventListener('orientationchange', fit);
            window.visualViewport?.removeEventListener('resize', fit);
        };
    }, []);

    // Esc يُلغي وضع الوضع أولاً ثم يُغلق، وDelete يحذف المحدّد
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                const state = useWorld.getState();
                // التراجع خطوة واحدة في كل ضغطة، لا إغلاق كل شيء دفعة
                if (state.placementType) setPlacement(null);
                else if (state.brush.tool) state.setBrush('tool', null);
                else if (state.mode !== 'orbit') setMode('orbit');
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
    }, [onClose, selectedId, removeItem, setPlacement, setMode]);

    const toggle = (key) => setShown(s => ({ ...s, [key]: !s[key] }));
    const visible = (key) => (narrow ? tab === key : shown[key]);

    return (
        <div className={`we${narrow ? ` is-${sheet}` : ''}`} dir="rtl" ref={rootRef}>
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
                    <AdaptiveResolution max={1.8} />
                </Canvas>

                {/* أول إطار لم يُرسم بعد: الحزمة تُجلب أو المشهد يُبنى */}
                {fps === null && <Loading />}

                {/* المشي: التقاط المفاتيح والمؤشّر خارج الـ Canvas */}
                {mode === 'walk' && (
                    <WalkControls canvasRef={canvasRef} onExit={() => setMode('orbit')} onFlash={flash} />
                )}

                {mode === 'drive' && <DriveControls onExit={() => setMode('orbit')} />}

                {/* داخل العالم ولوحة الخريطة مخفيّة؟ تظهر مصغّرة في الزاوية */}
                {mode !== 'orbit' && !visible('nodes') && (
                    <div className="we-hudmap"><MiniMap compact /></div>
                )}

                {placementType && (
                    <div className="we-placing">
                        وضع الوضع مفعّل — انقر المشهد أو الخريطة لإسقاط نسخة
                        <button onClick={() => setPlacement(null)}>إلغاء</button>
                    </div>
                )}

                {notice && <div className={`we-flash is-${notice.kind}`}>{notice.message}</div>}

                {/* اللوحات — تطفو فوق المشهد على الشاشات الواسعة */}
                <div className="we-overlay">
                    {narrow && (
                        <button
                            className="we-grip"
                            onClick={() => setSheet(v => (v === 'peek' ? 'half' : v === 'half' ? 'full' : 'peek'))}
                            aria-label="ارتفاع اللوحة"
                        >
                            {sheet === 'peek' ? 'وسّع اللوحة' : sheet === 'half' ? 'ملء الشاشة' : 'صغّر اللوحة'}
                        </button>
                    )}

                    <ScrollColumn className="we-col we-col-start">
                        {visible('nodes') && <NodeEditor onClose={narrow ? null : () => toggle('nodes')} />}
                        {visible('assets') && <AssetBrowser onFlash={flash} onClose={narrow ? null : () => toggle('assets')} />}
                    </ScrollColumn>

                    <ScrollColumn className="we-col we-col-end">
                        {visible('world') && <WorldPanel onClose={narrow ? null : () => toggle('world')} />}
                        {visible('land') && (
                            <TerrainPanel onFlash={flash} onClose={narrow ? null : () => toggle('land')} />
                        )}
                        <Inspector />
                        {visible('record') && (
                            <RecordBar canvasRef={canvasRef} onFlash={flash} onClose={narrow ? null : () => toggle('record')} />
                        )}
                        {(!narrow || tab === 'record') && <WorldFile onFlash={flash} />}
                    </ScrollColumn>
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
