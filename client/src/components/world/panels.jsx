import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useWorld } from './worldStore';
import { ASSETS, ASSET_KEYS, AssetThumb } from './assets';
import { importFiles, listCustom, deleteCustom, formatSize, describeStats, forgetStyled } from './customAssets';
import MiniMap from './MiniMap';
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
    const mode = useWorld(s => s.mode);
    const setEnv = useWorld(s => s.setEnv);
    const setMode = useWorld(s => s.setMode);
    const toggleEntity = useWorld(s => s.toggleEntity);

    return (
        <PanelShell title="لوحة تحكم العالم" onClose={onClose} className="we-world">
            <div className="we-group">
                <span className="we-group-label">وضع التجوّل</span>
                <div className="we-seg">
                    {[['orbit', 'تحرير'], ['walk', 'مشي']].map(([key, label]) => (
                        <button
                            key={key}
                            className={mode === key ? 'is-on' : ''}
                            onClick={() => setMode(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <p className="we-note">
                    {mode === 'walk'
                        ? 'انقر المشهد لتثبيت المؤشّر، ثم W A S D للحركة و Shift للركض و Esc للخروج. على الهاتف: العصا للمشي والسحب للنظر.'
                        : 'دوران حول المشهد بالسحب، وتكبير بالعجلة. بدّل إلى «مشي» لتسير داخل العالم.'}
                </p>
            </div>

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
                <span className="we-group-label">نمط العرض</span>
                <div className="we-seg">
                    {[['toon', 'كرتوني'], ['real', 'واقعي']].map(([key, label]) => (
                        <button
                            key={key}
                            className={(env.renderStyle || 'toon') === key ? 'is-on' : ''}
                            onClick={() => {
                                // النسخ المُنمّطة مُخزّنة؛ نُبطلها لتُبنى بالخامات الجديدة
                                forgetStyled();
                                setEnv('renderStyle', key);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <p className="we-note">
                    الواقعي يُبقي خامات glTF كما صُدّرت — خرائط الخشونة والمعدنية
                    والانحناء — ويُضيف إضاءة بيئة تنعكس عليها، ويُطفئ الحدود المحيطة.
                    أثقل من الكرتوني، وأليق بحزمة فيها خرائط ORM.
                </p>
            </div>

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
                <span className="we-group-label">الأرض والشبكة</span>
                <Switch
                    label="الطريق الجاهز في المشهد"
                    checked={env.defaultRoad !== false}
                    onChange={() => setEnv('defaultRoad', env.defaultRoad === false)}
                />
                <Switch
                    label="الالتقاط إلى الشبكة"
                    checked={env.gridSnap !== false}
                    onChange={() => setEnv('gridSnap', env.gridSnap === false)}
                />
                <Slider
                    label="مقاس خليّة الشبكة"
                    readout={`${env.gridSize || 8} م`}
                    value={env.gridSize || 8} min={2} max={16} step={1}
                    onChange={(v) => setEnv('gridSize', v)}
                />
                <p className="we-note">
                    بلاطات الشوارع والتضاريس تلتقط الشبكة دائماً لتتلاصق بلا فجوات،
                    مهما كان هذا المفتاح. أطفئ «الطريق الجاهز» لترسم شبكتك من الصفر.
                </p>
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

export const NodeEditor = ({ onClose }) => (
    <PanelShell title="خريطة العالم" onClose={onClose} className="we-nodes">
        <MiniMap />
    </PanelShell>
);

// ── ٣) متصفّح الأصول ────────────────────────────────────────

const GROUP_LABEL = {
    road: 'شوارع',
    terrain: 'تضاريس',
    build: 'مبانٍ',
    nature: 'طبيعة',
    vehicle: 'مركبات',
    street: 'أثاث الشارع'
};

// الترتيب مقصود: ما تبني به الأرض أولاً، ثم ما تضعه فوقها
const GROUP_ORDER = ['road', 'terrain', 'build', 'nature', 'vehicle', 'street'];

export const AssetBrowser = ({ onClose, onFlash }) => {
    const placementType = useWorld(s => s.placementType);
    const setPlacement = useWorld(s => s.setPlacement);
    const customAssets = useWorld(s => s.customAssets);
    const setCustomAssets = useWorld(s => s.setCustomAssets);
    const addCustomAsset = useWorld(s => s.addCustomAsset);
    const dropCustomAsset = useWorld(s => s.dropCustomAsset);

    const fileRef = useRef(null);
    const folderRef = useRef(null);
    const [busy, setBusy] = useState(null);
    const [problem, setProblem] = useState(null);

    // مجسمات الجلسات السابقة محفوظة في المتصفّح — نستعيد بطاقاتها عند الفتح
    useEffect(() => {
        listCustom()
            .then(setCustomAssets)
            .catch(err => console.warn('تعذّر قراءة مخزن المجسمات:', err?.message));
    }, [setCustomAssets]);

    const grouped = useMemo(() => {
        const out = {};
        ASSET_KEYS.forEach(key => { (out[ASSETS[key].group] ||= []).push(key); });
        return out;
    }, []);

    const onPick = async (e) => {
        const files = e.target.files;
        e.target.value = '';
        if (!files?.length) return;

        setProblem(null);
        setBusy(`يقرأ ${files.length} ملفاً…`);

        try {
            const record = await importFiles(files);

            addCustomAsset({
                key: record.key, name: record.name, entry: record.entry,
                size: record.size, addedAt: record.addedAt, stats: record.stats
            });
            setPlacement(`custom:${record.key}`);

            const extra = record.extras
                ? ` (تجاهلتُ ${record.extras} مشهداً آخر في الاختيار)`
                : '';
            onFlash?.(`جاهز: ${record.name} — ${describeStats(record.stats)}${extra}. انقر المشهد لوضعه.`);
        } catch (err) {
            // الرسالة تُعرض في اللوحة أيضاً: الوميض يختفي قبل أن تُقرأ كاملة
            setProblem(err.message);
            onFlash?.(err.message, 'err');
        } finally {
            setBusy(null);
        }
    };

    const remove = async (card) => {
        if (!window.confirm(`حذف «${card.name}» وكل نسخه في المشهد؟`)) return;
        try {
            await deleteCustom(card.key);
            dropCustomAsset(card.key);
            onFlash?.('حُذف المجسم');
        } catch (err) {
            onFlash?.(`تعذّر الحذف: ${err.message}`, 'err');
        }
    };

    return (
        <PanelShell title="متصفّح الأصول" onClose={onClose} className="we-assets">
            {/* مجسماتك أولاً: هي ما جئت لتضعه */}
            <div className="we-assetgroup">
                <span>مجسماتي</span>

                <div className="we-importbtns">
                    <button className="we-btn" onClick={() => folderRef.current?.click()} disabled={Boolean(busy)}>
                        استورد مجلّداً
                    </button>
                    <button className="we-btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
                        اختر ملفات
                    </button>
                </div>

                {busy && <p className="we-note we-working"><span className="we-spin" />{busy}</p>}

                {problem && (
                    <div className="we-problem">
                        <b>لم يُستورد</b>
                        <p>{problem}</p>
                        <button onClick={() => setProblem(null)}>حسناً</button>
                    </div>
                )}

                <div>
                    {customAssets.map(card => {
                        const type = `custom:${card.key}`;
                        return (
                            <button
                                key={card.key}
                                className={`we-thumb is-custom${placementType === type ? ' is-on' : ''}`}
                                onClick={() => setPlacement(type)}
                                title={`${card.name} · ${formatSize(card.size)}${card.stats ? ' · ' + describeStats(card.stats) : ''}`}
                            >
                                <AssetThumb type="custom" />
                                <em>{card.name}</em>
                                <i
                                    className="we-thumb-x"
                                    role="button"
                                    tabIndex={0}
                                    title="حذف"
                                    onClick={(e) => { e.stopPropagation(); remove(card); }}
                                    onKeyDown={(e) => e.key === 'Enter' && remove(card)}
                                >✕</i>
                            </button>
                        );
                    })}

                    {!customAssets.length && !busy && (
                        <p className="we-note we-empty">لم تستورد مجسماً بعد.</p>
                    )}
                </div>

                <p className="we-note">
                    <b>‎.glb‎</b> ملف واحد ويكفي. <b>‎.gltf‎</b> يحتاج ملف ‎.bin‎ وصور خاماته
                    معه — لذلك <b>«استورد مجلّداً»</b> هو الأضمن مع الحزم الجاهزة: اختر
                    مجلّد التصدير كلّه ونحن نلتقط ما يلزم ونتجاهل الباقي. إن نقص ملف
                    سنُسمّيه لك بدل أن يُوضع مجسم فارغ.
                </p>

                <input
                    ref={fileRef}
                    type="file"
                    accept=".glb,.gltf,.bin,image/png,image/jpeg,image/webp"
                    multiple
                    onChange={onPick}
                    hidden
                />
                {/* webkitdirectory يُمرَّر بالاسم الصريح: React لا يعرفه كخاصيّة */}
                <input
                    ref={folderRef}
                    type="file"
                    multiple
                    onChange={onPick}
                    hidden
                    {...{ webkitdirectory: '', directory: '' }}
                />
            </div>

            <div className="we-assetrow">
                {GROUP_ORDER.filter(g => grouped[g]?.length).map(group => (
                    <div className="we-assetgroup" key={group}>
                        <span>{GROUP_LABEL[group] || group}</span>
                        <div>
                            {grouped[group].map(key => (
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

    const custom = useWorld(s => s.customAssets);

    const item = placed.find(p => p.id === selectedId);
    if (!item) return null;

    const isCustom = item.type.startsWith('custom:');
    const title = isCustom
        ? (custom.find(c => `custom:${c.key}` === item.type)?.name || 'مجسم مستورد')
        : (ASSETS[item.type]?.label || item.type);

    // ربع دورة: الطريقة الوحيدة العملية لتوجيه بلاطة شارع
    const quarter = () => {
        const next = (item.rotation + Math.PI / 2) % (Math.PI * 2);
        updateItem(item.id, { rotation: +next.toFixed(4) });
    };

    return (
        <section className="we-panel we-inspector">
            <header className="we-panel-head">
                <h3>{title}</h3>
                <button className="we-x" onClick={() => select(null)} aria-label="إلغاء التحديد">✕</button>
            </header>
            <div className="we-panel-body">
                <button className="we-btn" onClick={quarter}>أدر ربع دورة (٩٠°)</button>

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
