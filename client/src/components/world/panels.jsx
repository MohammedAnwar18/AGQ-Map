import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useWorld, WORLD_BOUNDS } from './worldStore';
import { ASSETS, ASSET_KEYS, AssetThumb } from './assets';
import { saveFile } from '../../utils/download';

/* ============================================================
   لوحات المحرّر الأربع

   كلها HTML فوق الـ Canvas لا داخله: تقرأ من مخزن zustand وتكتب
   فيه، والمشهد يلتقط التغيير من هناك. لا تمرّ خاصيّة واحدة عبر
   حدود الـ Canvas، وهو ما يُبقي الطبقتين مستقلّتين فعلاً.
   ============================================================ */

// ── لبنات صغيرة ─────────────────────────────────────────────

const Slider = ({ label, value, min, max, step = 0.01, onChange, left, right, readout }) => (
    <label className="we-slider">
        <span className="we-slider-top">
            <b>{label}</b>
            {readout && <em>{readout}</em>}
        </span>
        <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {(left || right) && (
            <span className="we-slider-ends"><i>{left}</i><i>{right}</i></span>
        )}
    </label>
);

const Switch = ({ label, checked, onChange }) => (
    <button
        type="button"
        className={`we-switch${checked ? ' is-on' : ''}`}
        onClick={onChange}
        role="switch"
        aria-checked={checked}
    >
        <span>{label}</span>
        <i />
    </button>
);

const PanelShell = ({ title, children, onClose, className = '' }) => (
    <section className={`we-panel ${className}`}>
        <header className="we-panel-head">
            <h3>{title}</h3>
            {onClose && <button className="we-x" onClick={onClose} aria-label="إخفاء">✕</button>}
        </header>
        <div className="we-panel-body">{children}</div>
    </section>
);

// ساعة عشرية إلى توقيت مقروء
const clock = (hour) => {
    const h = Math.floor(hour) % 24;
    const m = Math.round((hour - Math.floor(hour)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m === 60 ? 59 : m).padStart(2, '0')}`;
};

const partOfDay = (hour) => {
    if (hour < 5) return 'ليل';
    if (hour < 7.5) return 'شروق';
    if (hour < 16) return 'نهار';
    if (hour < 19) return 'غروب';
    return 'ليل';
};

// ── ١) لوحة تحكم العالم ─────────────────────────────────────

export const WorldPanel = ({ onClose }) => {
    const env = useWorld(s => s.environment);
    const entities = useWorld(s => s.entities);
    const setEnv = useWorld(s => s.setEnv);
    const toggleEntity = useWorld(s => s.toggleEntity);

    return (
        <PanelShell title="لوحة تحكم العالم" onClose={onClose} className="we-world">
            <Slider
                label="وقت اليوم"
                readout={`${clock(env.timeOfDay)} · ${partOfDay(env.timeOfDay)}`}
                value={env.timeOfDay} min={0} max={24} step={0.1}
                onChange={(v) => setEnv('timeOfDay', v)}
                left="منتصف الليل" right="منتصف الليل"
            />

            <Slider
                label="الطقس"
                readout={env.climate < 0.33 ? 'مشمس' : env.climate < 0.7 ? 'غائم جزئياً' : 'غائم'}
                value={env.climate} min={0} max={1}
                onChange={(v) => setEnv('climate', v)}
                left="مشمس" right="غائم"
            />

            <Slider
                label="كثافة الأشجار"
                readout={`${Math.round(env.foliageDensity * 100)}%`}
                value={env.foliageDensity} min={0} max={1}
                onChange={(v) => setEnv('foliageDensity', v)}
                left="خالٍ" right="كثيف"
            />

            <div className="we-group">
                <span className="we-group-label">نمط المباني</span>
                <div className="we-seg">
                    {[['suburban', 'ضواحٍ'], ['urban', 'مدينة']].map(([key, label]) => (
                        <button
                            key={key}
                            className={env.buildingStyle === key ? 'is-on' : ''}
                            onClick={() => setEnv('buildingStyle', key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="we-group">
                <span className="we-group-label">التحكم بالكيانات</span>
                <Switch label="حركة المرور" checked={entities.traffic} onChange={() => toggleEntity('traffic')} />
                <Switch label="المشاة" checked={entities.npcs} onChange={() => toggleEntity('npcs')} />
            </div>

            <div className="we-group">
                <span className="we-group-label">الجودة والأداء</span>
                <Switch label="الحدود المحيطة" checked={env.outlines !== false} onChange={() => setEnv('outlines', env.outlines === false)} />
                <Switch label="ظلال الاحتكاك (SSAO)" checked={env.heavyShading} onChange={() => setEnv('heavyShading', !env.heavyShading)} />
                <p className="we-note">
                    SSAO يُعمّق الالتقاء بين المجسمات والأرض لكنه الأثقل هنا؛
                    أطفئه أولاً إن تعثّرت الحركة على جهاز متوسّط.
                </p>
            </div>
        </PanelShell>
    );
};

// ── ٢) محرّر عقد الخريطة ────────────────────────────────────

const GROUP_TONE = {
    nature: '#4FA85C',
    build: '#D4564B',
    vehicle: '#4E8FC0',
    street: '#E8C15A'
};

export const NodeEditor = ({ onClose }) => {
    const placed = useWorld(s => s.placed);
    const selectedId = useWorld(s => s.selectedId);
    const cameraTarget = useWorld(s => s.cameraTarget);
    const placementType = useWorld(s => s.placementType);

    const moveItem = useWorld(s => s.moveItem);
    const setCameraTarget = useWorld(s => s.setCameraTarget);
    const select = useWorld(s => s.select);
    const place = useWorld(s => s.place);

    const boardRef = useRef(null);
    const dragRef = useRef(null);   // 'camera' | معرّف الأصل

    const toPct = (v) => ((v + WORLD_BOUNDS) / (WORLD_BOUNDS * 2)) * 100;

    const fromEvent = useCallback((e) => {
        const box = boardRef.current.getBoundingClientRect();
        const px = (e.clientX - box.left) / box.width;
        const py = (e.clientY - box.top) / box.height;

        const clamp = (v) => Math.min(1, Math.max(0, v));
        return {
            x: +((clamp(px) * 2 - 1) * WORLD_BOUNDS).toFixed(2),
            z: +((clamp(py) * 2 - 1) * WORLD_BOUNDS).toFixed(2)
        };
    }, []);

    const startDrag = (id) => (e) => {
        e.stopPropagation();
        e.preventDefault();
        dragRef.current = id;
        boardRef.current.setPointerCapture(e.pointerId);
        if (id !== 'camera') select(id);
    };

    const onMove = (e) => {
        if (!dragRef.current) return;
        const { x, z } = fromEvent(e);

        if (dragRef.current === 'camera') setCameraTarget(x, z);
        else moveItem(dragRef.current, x, z);
    };

    const endDrag = (e) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        try { boardRef.current.releasePointerCapture(e.pointerId); } catch { /* المؤشّر تُرك أصلاً */ }
    };

    // النقر على فراغ اللوحة: يضع أصلاً إن كان وضع الوضع مفعّلاً، وإلا ينقل الكاميرا
    const onBoardDown = (e) => {
        const { x, z } = fromEvent(e);
        if (placementType) place(placementType, x, z);
        else setCameraTarget(x, z);
    };

    return (
        <PanelShell title="محرّر عقد الخريطة" onClose={onClose} className="we-nodes">
            <div
                className={`we-board${placementType ? ' is-placing' : ''}`}
                ref={boardRef}
                onPointerDown={onBoardDown}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                {/* الطريق: شريط رأسي في منتصف الإسقاط العلوي */}
                <i className="we-board-road" />

                {placed.map(item => {
                    const def = ASSETS[item.type];
                    return (
                        <button
                            key={item.id}
                            className={`we-node${item.id === selectedId ? ' is-sel' : ''}`}
                            style={{
                                left: `${toPct(item.x)}%`,
                                top: `${toPct(item.z)}%`,
                                '--tone': GROUP_TONE[def?.group] || '#94a3b8'
                            }}
                            title={`${def?.label || item.type} — ${item.x}, ${item.z}`}
                            onPointerDown={startDrag(item.id)}
                        />
                    );
                })}

                <button
                    className="we-node is-cam"
                    style={{ left: `${toPct(cameraTarget.x)}%`, top: `${toPct(cameraTarget.z)}%` }}
                    title="موقع الكاميرا — اسحبه"
                    onPointerDown={startDrag('camera')}
                />
            </div>

            <p className="we-note">
                {placementType
                    ? 'وضع الوضع مفعّل — انقر اللوحة أو المشهد لإسقاط نسخة.'
                    : 'اسحب العقدة الذهبية لتحريك الكاميرا، وأي عقدة ملوّنة لنقل مجسمها.'}
            </p>
        </PanelShell>
    );
};

// ── ٣) متصفّح الأصول ────────────────────────────────────────

const GROUP_LABEL = {
    nature: 'طبيعة',
    build: 'مبانٍ',
    vehicle: 'مركبات',
    street: 'أثاث الشارع'
};

export const AssetBrowser = ({ onClose }) => {
    const placementType = useWorld(s => s.placementType);
    const setPlacement = useWorld(s => s.setPlacement);

    const grouped = useMemo(() => {
        const out = {};
        ASSET_KEYS.forEach(key => {
            const g = ASSETS[key].group;
            (out[g] ||= []).push(key);
        });
        return out;
    }, []);

    return (
        <PanelShell title="متصفّح الأصول" onClose={onClose} className="we-assets">
            <div className="we-assetrow">
                {Object.entries(grouped).map(([group, keys]) => (
                    <div className="we-assetgroup" key={group}>
                        <span>{GROUP_LABEL[group] || group}</span>
                        <div>
                            {keys.map(key => (
                                <button
                                    key={key}
                                    className={`we-thumb${placementType === key ? ' is-on' : ''}`}
                                    onClick={() => setPlacement(key)}
                                    title={ASSETS[key].label}
                                >
                                    <AssetThumb type={key} />
                                    <em>{ASSETS[key].label}</em>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </PanelShell>
    );
};

// ── محدّد العنصر المختار ────────────────────────────────────

export const Inspector = () => {
    const selectedId = useWorld(s => s.selectedId);
    const placed = useWorld(s => s.placed);
    const updateItem = useWorld(s => s.updateItem);
    const removeItem = useWorld(s => s.removeItem);
    const select = useWorld(s => s.select);

    const item = placed.find(p => p.id === selectedId);
    if (!item) return null;

    const def = ASSETS[item.type];

    return (
        <section className="we-panel we-inspector">
            <header className="we-panel-head">
                <h3>{def?.label || item.type}</h3>
                <button className="we-x" onClick={() => select(null)} aria-label="إلغاء التحديد">✕</button>
            </header>
            <div className="we-panel-body">
                <Slider
                    label="الدوران" readout={`${Math.round((item.rotation * 180) / Math.PI)}°`}
                    value={item.rotation} min={0} max={Math.PI * 2} step={0.05}
                    onChange={(v) => updateItem(item.id, { rotation: v })}
                />
                <Slider
                    label="الحجم" readout={`${item.scale.toFixed(2)}×`}
                    value={item.scale} min={0.4} max={2.5} step={0.05}
                    onChange={(v) => updateItem(item.id, { scale: v })}
                />
                <div className="we-coords">
                    <span>س {item.x}</span>
                    <span>ص {item.z}</span>
                </div>
                <button className="we-btn we-danger" onClick={() => removeItem(item.id)}>حذف المجسم</button>
            </div>
        </section>
    );
};

// ── ٤) التسجيل ──────────────────────────────────────────────

// المتصفّحات تختلف فيما تسجّله: سفاري يكتب MP4 مباشرة، وكروم/فايرفوكس
// يكتبان WebM. نختار الأفضل المتاح ونُسمّي الزرّ بما سيهبط فعلاً،
// بدل أن نَعِد بـ MP4 ثم نُنزّل شيئاً آخر.
const MIME_CANDIDATES = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
];

const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    return MIME_CANDIDATES.find(m => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) || '';
};

export const RecordBar = ({ canvasRef, onFlash, onClose }) => {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);

    const recRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    const mime = useMemo(() => pickMime(), []);
    const ext = mime?.includes('mp4') ? 'mp4' : 'webm';
    const supported = mime !== null;

    // نوقف التسجيل عند إغلاق المحرّر، وإلا بقي المسجّل ممسكاً باللوحة
    useEffect(() => () => {
        clearInterval(timerRef.current);
        try { recRef.current?.state === 'recording' && recRef.current.stop(); } catch { /* أُوقف سلفاً */ }
    }, []);

    const start = () => {
        const canvas = canvasRef.current;
        if (!canvas) return onFlash?.('لوحة الرسم غير جاهزة بعد', 'err');
        if (!supported) return onFlash?.('متصفّحك لا يدعم التسجيل من الصفحة', 'err');

        try {
            const stream = canvas.captureStream(60);
            const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);

            chunksRef.current = [];
            rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };

            rec.onstop = async () => {
                clearInterval(timerRef.current);
                const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' });
                chunksRef.current = [];

                if (!blob.size) return onFlash?.('لم يُسجَّل شيء', 'err');

                const name = `world_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
                await saveFile(blob, name, blob.type);
                onFlash?.(`نُزّل ${name}`);
            };

            rec.start(250);
            recRef.current = rec;
            setRecording(true);
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        } catch (e) {
            onFlash?.(`تعذّر بدء التسجيل: ${e.message}`, 'err');
        }
    };

    const stop = () => {
        try { recRef.current?.stop(); } catch { /* لا شيء يُوقَف */ }
        setRecording(false);
        clearInterval(timerRef.current);
    };

    return (
        <PanelShell title="التسجيل" onClose={onClose} className="we-record">
            <button
                className={`we-btn we-rec${recording ? ' is-live' : ''}`}
                onClick={recording ? stop : start}
                disabled={!supported}
            >
                <i />
                {recording
                    ? `إيقاف — ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
                    : `ابدأ التسجيل (${ext.toUpperCase()})`}
            </button>

            {!supported && <p className="we-note">متصفّحك لا يوفّر MediaRecorder.</p>}
            {supported && ext === 'webm' && (
                <p className="we-note">
                    متصفّحك يسجّل WebM لا MP4 — يعمل على الحاسوب، وتحويله إلى MP4
                    يحتاج أداة خارجية مثل ffmpeg.
                </p>
            )}
        </PanelShell>
    );
};

// ── شريط حفظ العالم ─────────────────────────────────────────

export const WorldFile = ({ onFlash }) => {
    const exportWorld = useWorld(s => s.exportWorld);
    const importWorld = useWorld(s => s.importWorld);
    const resetWorld = useWorld(s => s.resetWorld);
    const clearAll = useWorld(s => s.clearAll);
    const count = useWorld(s => s.placed.length);

    const fileRef = useRef(null);

    const save = async () => {
        const blob = new Blob([JSON.stringify(exportWorld(), null, 2)], { type: 'application/json' });
        await saveFile(blob, 'world.json', 'application/json');
        onFlash?.(`حُفظ العالم — ${count} مجسماً`);
    };

    const load = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        try {
            importWorld(JSON.parse(await file.text()));
            onFlash?.('استُرجع العالم من الملف');
        } catch (err) {
            onFlash?.(`ملف غير صالح: ${err.message}`, 'err');
        }
    };

    return (
        <div className="we-filebar">
            <button className="we-btn" onClick={save}>حفظ world.json</button>
            <button className="we-btn" onClick={() => fileRef.current?.click()}>تحميل ملف</button>
            <button className="we-btn" onClick={() => { clearAll(); onFlash?.('أُفرغ العالم'); }}>إفراغ</button>
            <button className="we-btn" onClick={() => { resetWorld(); onFlash?.('عاد المشهد الابتدائي'); }}>استعادة</button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={load} hidden />
        </div>
    );
};
