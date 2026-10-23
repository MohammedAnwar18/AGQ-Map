import React, { useState, useEffect, useCallback, useRef } from 'react';

import rasterService, { rasterError, BATCH } from '../../services/rasterApi';
import { KNOWN_CRS } from './rasterCrsList.js';
import { planPyramid } from './rasterGeo.js';
import { sidecarKind, stemOf } from './rasterSidecar.js';
import './AdminRasters.css';

/* ============================================================
   قسم الراستر

   يرفع الأدمن ملفّ ‎GeoTIFF‎، فيُقرأ في المتصفّح ويُقطّع إلى هرم
   بلاطات ويُرفع، فيظهر على الخريطة الرئيسية.

   والمُبلِّط نفسه يُحمَّل عند الحاجة فقط: ‎geotiff‎ و‎proj4‎ معاً
   مئاتُ الكيلوبايتات، ولا سبب لتحميلها على من يفتح لوحة الإدارة
   لأمر آخر.
   ============================================================ */

const readable = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} بايت`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
};

const deg = (n) => Number(n).toFixed(5);

/* ============================================================
   المعالجة — القراءة ثم التبليط ثم الرفع
   ============================================================ */

const Builder = ({ onDone, onCancel, flash }) => {
    const [file, setFile] = useState(null);
    const [mates, setMates] = useState([]);       // ‎.tfw‎ و‎aux.xml‎ و‎.prj‎
    const [source, setSource] = useState(null);
    const [name, setName] = useState('');
    const [crsOverride, setCrsOverride] = useState('');
    const [plan, setPlan] = useState(null);

    /*
     * الحدود باليد — آخر ملاذ.
     *
     * تُفتح وحدها حين لا يكون في الملفّ ولا بجانبه إحداثيات. وقبل
     * ذلك لا تُعرض: حقول أرقام تُغري بالتخمين حيث توجد قيمة مقروءة.
     */
    const [manual, setManual] = useState(null);   // { west, south, east, north }

    const [phase, setPhase] = useState('pick');   // pick | reading | ready | working | done
    const [progress, setProgress] = useState(null);
    const [problem, setProblem] = useState(null);

    const stop = useRef(false);
    const tiler = useRef(null);

    /* الوحدة الثقيلة تُحمَّل مرّة عند أوّل حاجة */
    const loadTiler = useCallback(async () => {
        if (!tiler.current) tiler.current = await import('./rasterTiler');
        return tiler.current;
    }, []);

    const read = useCallback(async (chosen, override, friends, bounds) => {
        setPhase('reading');
        setProblem(null);
        setSource(null);
        setPlan(null);

        try {
            const { openRaster } = await loadTiler();
            const { readSidecars } = await import('./rasterSidecar.js');

            const sidecar = friends?.length ? await readSidecars(friends) : null;
            const buffer = await chosen.arrayBuffer();

            const opened = await openRaster(buffer, {
                crsOverride: override || null,
                sidecar,
                manualBounds: bounds || null
            });

            if (opened.error) {
                setProblem(opened.error);
                /* لا إحداثيات في الملفّ: نفتح حقول الحدود مُهيّأة بأرقام
                   المنطقة، فيكتبها الأدمن بدل أن يعود خالي اليدين */
                if (opened.needsBounds && !bounds) {
                    setManual({ west: '', south: '', east: '', north: '' });
                }
                setPhase('pick');
                return;
            }

            if (sidecar?.problems?.length) {
                // وُجدت الإحداثيات لكن ملفّاً مجاوراً تعذّر فهمه
                console.warn('ملاحظات على الملفّات المجاورة:', sidecar.problems);
            }

            setSource({ ...opened, buffer });
            setPlan(planPyramid(opened.bounds, opened.width, { maxTiles: 1200 }));
            setPhase('ready');
        } catch (err) {
            setProblem(err?.message || 'تعذّرت قراءة الملفّ');
            setPhase('pick');
        }
    }, [loadTiler]);

    /**
     * يستقبل ما اختاره الأدمن، تيفاً كان أو عائلة ملفّات.
     *
     * والعائلة هي الحالة الطبيعية لا الاستثناء: برامج ‎GIS‎ تُصدّر
     * ‎ortho.tif‎ ومعه ‎ortho.tfw‎ و‎ortho.prj‎، ومن رفع التيف وحده
     * رفع صورة بلا موضع.
     *
     * ونقبل مجاوراً لا يوافق جذر التيف: من يختار ملفّين معاً
     * يعني أنّهما لبعضهما، ورفضه لأنّ أحدهما أُعيدت تسميته تشددٌ
     * بلا فائدة.
     */
    const choose = (picked) => {
        const list = Array.from(picked || []);
        if (!list.length) return;

        const tif = list.find(entry => /\.tiff?$/i.test(entry.name));
        if (!tif) {
            setProblem('اختر ملفّ ‎.tif‎ — ومعه ‎.tfw‎ أو ‎aux.xml‎ إن وجد');
            return;
        }

        const friends = list.filter(entry => sidecarKind(entry.name));
        const root = stemOf(tif.name);
        const strays = friends.filter(entry => stemOf(entry.name) !== root);

        setFile(tif);
        setMates(friends);
        setManual(null);
        setName(tif.name.replace(/\.[^.]+$/, ''));

        if (strays.length) {
            setProblem(`اسم ${strays[0].name} لا يوافق ${tif.name} — نقرأه على أنّه له على كل حال`);
        }

        read(tif, crsOverride, friends, null);
    };

    /* تغيير المرجع يُعيد القراءة: الحدود كلّها تعتمد عليه */
    const changeCrs = (code) => {
        setCrsOverride(code);
        if (file) read(file, code, mates, manualReady() ? numericManual() : null);
    };

    const numericManual = () => ({
        west: parseFloat(manual?.west),
        south: parseFloat(manual?.south),
        east: parseFloat(manual?.east),
        north: parseFloat(manual?.north)
    });

    const manualReady = () => {
        if (!manual) return false;
        const b = numericManual();
        return Object.values(b).every(Number.isFinite) && b.east > b.west && b.north > b.south;
    };

    const applyManual = () => {
        if (!file || !manualReady()) return;
        read(file, crsOverride || 'EPSG:4326', mates, numericManual());
    };

    /**
     * يُبلّط ويرفع.
     *
     * السجلّ يُنشأ أوّلاً فنملك معرّفاً تُرفع إليه البلاطات، ويبقى
     * ‎building‎ فلا يُعرض نصفُ هرم على الخريطة. ثم ‎finish‎ يُظهره.
     */
    const build = async () => {
        if (!source || !plan) return;

        stop.current = false;
        setPhase('working');
        setProblem(null);
        setProgress({ stage: 'create', done: 0, total: plan.count, uploaded: 0 });

        let raster = null;

        try {
            raster = await rasterService.create({
                name: name.trim() || file.name,
                west: source.bounds.west,
                south: source.bounds.south,
                east: source.bounds.east,
                north: source.bounds.north,
                min_zoom: plan.minZoom,
                max_zoom: plan.maxZoom,
                crs: source.crs,
                opacity: 0.9
            });

            const { tileRaster } = await loadTiler();

            let batch = [];
            let sent = 0;

            const flushBatch = async () => {
                if (!batch.length) return;
                const payload = batch;
                batch = [];

                const result = await rasterService.putTiles(raster.id, payload);
                sent += result.added;

                if (result.rejected?.length) {
                    // نُبلّغ ولا نصمت: بلاطة مرفوضة تعني ثقباً في الصورة
                    console.warn('بلاطات مرفوضة:', result.rejected);
                }
            };

            await tileRaster(source, {
                maxTiles: 1200,
                shouldStop: () => stop.current,
                onProgress: (p) => setProgress({ stage: 'tiles', ...p, sent }),
                onTile: async (tile, blob) => {
                    if (!blob) return;
                    batch.push({ tile, blob });
                    if (batch.length >= BATCH) await flushBatch();
                }
            });

            await flushBatch();

            if (stop.current) {
                await rasterService.remove(raster.id).catch(() => {});
                setPhase('ready');
                setProgress(null);
                flash('أُلغيت العملية وحُذف ما رُفع', 'warn');
                return;
            }

            const finished = await rasterService.finish(raster.id, true);
            setPhase('done');
            flash(`جهزت «${finished.name}» — ${finished.tile_count} بلاطة`);
            onDone(finished);
        } catch (err) {
            setProblem(rasterError(err, 'تعذّر بناء الطبقة'));
            setPhase('ready');

            // سجلّ نصف مبنيّ لا قيمة له ويُربك القائمة
            if (raster?.id) await rasterService.remove(raster.id).catch(() => {});
        }
    };

    const pct = progress?.total
        ? Math.round((progress.done / progress.total) * 100)
        : 0;

    return (
        <div className="rst-build">
            <header className="rst-build-head">
                <b>طبقة راستر جديدة</b>
                <button className="rst-x" onClick={onCancel} aria-label="إلغاء">✕</button>
            </header>

            {/* ── الملفّ ── */}
            <label className={`rst-drop${file ? ' is-set' : ''}`}>
                <input
                    type="file"
                    accept=".tif,.tiff,.tfw,.wld,.prj,.xml,image/tiff"
                    multiple
                    hidden
                    disabled={phase === 'working' || phase === 'reading'}
                    onChange={(e) => choose(e.target.files)}
                />

                {file ? (
                    <>
                        <b>{file.name}</b>
                        <span>{readable(file.size)}</span>
                        {mates.length > 0 && (
                            <span className="rst-mates">
                                ومعه {mates.map(m => m.name).join(' · ')}
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        <b>اختر ملفّ التيف</b>
                        <span>
                            واختر معه ملفّاته المجاورة إن وُجدت — ‎.tfw‎ أو ‎aux.xml‎ أو ‎.prj‎.
                            حدّدها كلّها معاً.
                        </span>
                        <span>يُقرأ في جهازك: لا يُرفع الملفّ نفسه بل بلاطاته</span>
                    </>
                )}
            </label>

            {problem && <div className="rst-bad">{problem}</div>}

            {phase === 'reading' && <div className="rst-note">يُقرأ الملفّ…</div>}

            {/*
              * لا إحداثيات في الملفّ ولا بجانبه.
              *
              * أوّل ما يُقال: اختر الملفّ المجاور — فهو الحلّ الصحيح
              * والدقيق. والكتابة باليد بعده، لمن لا يملك ذلك الملفّ.
              */}
            {manual && !source && (
                <div className="rst-manual">
                    <b>أين تقع هذه الصورة؟</b>
                    <p>
                        لو كان بجانب التيف ملفّ ‎.tfw‎ أو ‎aux.xml‎ أو ‎.prj‎ — وهو ما يقرؤه
                        Arc ليفتحها في موضعها — فاضغط فوق واخترهما معاً. وإن لم يكن،
                        اكتب الحدود بالدرجات.
                    </p>

                    <div className="rst-manual-grid">
                        {[
                            ['north', 'شمال'],
                            ['south', 'جنوب'],
                            ['west', 'غرب'],
                            ['east', 'شرق']
                        ].map(([key, label]) => (
                            <label key={key}>
                                <span>{label}</span>
                                <input
                                    type="number"
                                    step="0.000001"
                                    inputMode="decimal"
                                    value={manual[key]}
                                    onChange={(e) => setManual(m => ({ ...m, [key]: e.target.value }))}
                                    placeholder={key === 'north' ? '31.96' : key === 'south' ? '31.95'
                                        : key === 'west' ? '35.18' : '35.19'}
                                />
                            </label>
                        ))}
                    </div>

                    <button className="rst-primary" onClick={applyManual} disabled={!manualReady()}>
                        ضع الصورة في هذه الحدود
                    </button>

                    <span className="rst-hint is-warn">
                        هذه حدود تكتبها أنت، فدقّتها دقّة ما كتبتَ. والملفّ المجاور أصدق منها دائماً.
                    </span>
                </div>
            )}

            {/* ── ما قرأناه ── */}
            {source && (
                <>
                    <div className="rst-facts">
                        <div>
                            <label>الأبعاد</label>
                            <b>{source.width.toLocaleString('en')} × {source.height.toLocaleString('en')}</b>
                        </div>
                        <div>
                            <label>النطاقات</label>
                            <b>{source.samples} {source.samples >= 3 ? '(ملوّن)' : '(رمادي)'}</b>
                        </div>
                        <div>
                            <label>دقّة البكسل</label>
                            <b>{source.metresPerPixel ? `${source.metresPerPixel.toFixed(2)} م` : 'بالدرجات'}</b>
                        </div>
                        <div>
                            <label>قيمة الفراغ</label>
                            <b>{source.nodata === null ? 'لا شيء' : source.nodata}</b>
                        </div>
                    </div>

                    {/*
                      * المرجع: نقول من أين عرفناه.
                      *
                      * المقروء من الملفّ موثوق، والمخمَّن قد يضع الصورة في
                      * بلد مجاور — فيُقال صريحاً ويُتاح تصحيحه.
                      */}
                    <section className="rst-field">
                        <label>
                            مرجع الإحداثيات
                            <i className={`rst-src is-${source.crsSource === 'sidecar' ? 'file' : source.crsSource}`}>
                                {source.crsSource === 'file' ? 'مقروء من الملفّ'
                                    : source.crsSource === 'sidecar' ? 'مقروء من الملفّ المجاور'
                                        : source.crsSource === 'override' ? 'اخترته أنت'
                                            : 'مخمَّن — راجعه'}
                            </i>
                        </label>

                        <select value={crsOverride || source.crs} onChange={(e) => changeCrs(e.target.value)}>
                            {KNOWN_CRS.map(c => (
                                <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                            ))}
                            {!KNOWN_CRS.some(c => c.code === source.crs) && (
                                <option value={source.crs}>{source.crs}</option>
                            )}
                        </select>

                        {source.unsupported && (
                            <span className="rst-hint is-warn">
                                الملفّ يذكر {source.unsupported} وهو غير مدعوم — اخترنا بديلاً، تحقّق من الموضع على الخريطة.
                            </span>
                        )}
                    </section>

                    {/* من أين جاء الموضع — ومن كتبه بيده يجب أن يرى ذلك */}
                    <div className="rst-geofrom">
                        <span>الموضع من: <b>{source.geoFrom}</b></span>
                        {source.rotated && <i className="rst-chip">مُدارة — تُعاد لإسقاطها</i>}
                        {source.manual && <i className="rst-chip is-warn">حدود يدوية</i>}
                    </div>

                    <div className="rst-bounds">
                        <span>شمال {deg(source.bounds.north)}</span>
                        <span>جنوب {deg(source.bounds.south)}</span>
                        <span>غرب {deg(source.bounds.west)}</span>
                        <span>شرق {deg(source.bounds.east)}</span>
                    </div>

                    <section className="rst-field">
                        <label>اسم الطبقة</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 160))}
                            placeholder="أورثوفوتو بير زيت ٢٠٢٤"
                            disabled={phase === 'working'}
                        />
                    </section>

                    {/* ── الهرم ── */}
                    {plan && (
                        <div className="rst-plan">
                            <div>
                                <label>مستويات التكبير</label>
                                <b>{plan.minZoom} ← {plan.maxZoom}</b>
                            </div>
                            <div>
                                <label>عدد البلاطات</label>
                                <b>{plan.count.toLocaleString('en')}</b>
                            </div>

                            {plan.capped ? (
                                <span className="rst-hint is-warn">
                                    دقّة الملفّ تكفي للمستوى {plan.nativeZoom}، لكنّه يحتاج بلاطات أكثر من
                                    السقف. نتوقّف عند {plan.maxZoom} — فيبقى الراستر كاملاً ويفقد حدّة آخر زوم.
                                </span>
                            ) : (
                                <span className="rst-hint">
                                    الهرم يغطّي دقّة الملفّ كلّها حتى المستوى {plan.maxZoom}.
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── التقدّم ── */}
            {phase === 'working' && (
                <div className="rst-progress">
                    <div className="rst-bar"><i style={{ width: `${pct}%` }} /></div>
                    <span>
                        {progress?.stage === 'create' ? 'يُهيّئ الطبقة…' : (
                            <>
                                {pct}% · {progress?.done ?? 0} من {progress?.total ?? 0} بلاطة
                                {progress?.empty > 0 && ` · ${progress.empty} فارغة`}
                            </>
                        )}
                    </span>
                    <button className="rst-cancel" onClick={() => { stop.current = true; }}>
                        ألغِ
                    </button>
                </div>
            )}

            {/* ── الأزرار ── */}
            {phase !== 'working' && (
                <div className="rst-build-foot">
                    <button className="rst-primary" onClick={build} disabled={!source || !plan}>
                        بلّط وارفع
                    </button>
                    <button onClick={onCancel}>رجوع</button>
                </div>
            )}
        </div>
    );
};

/* ============================================================ */

const AdminRasters = () => {
    const [rasters, setRasters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState(null);
    const [notice, setNotice] = useState(null);
    const [building, setBuilding] = useState(false);

    const flash = useCallback((message, kind = 'ok') => setNotice({ message, kind }), []);

    useEffect(() => {
        if (!notice) return undefined;
        const t = setTimeout(() => setNotice(null), 3600);
        return () => clearTimeout(t);
    }, [notice]);

    const load = useCallback(async () => {
        setLoading(true);
        setProblem(null);
        try {
            const data = await rasterService.list(true);
            setRasters(data.rasters || []);
        } catch (err) {
            setProblem(rasterError(err, 'تعذّر تحميل الطبقات'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const patch = useCallback(async (raster, body) => {
        try {
            const saved = await rasterService.update(raster.id, body);
            setRasters(prev => prev.map(r => (r.id === saved.id
                ? { ...r, ...saved, opacity: Number(saved.opacity) }
                : r)));
        } catch (err) {
            flash(rasterError(err, 'تعذّر التعديل'), 'err');
        }
    }, [flash]);

    const remove = useCallback(async (raster) => {
        // eslint-disable-next-line no-alert
        if (!window.confirm(`حذف «${raster.name}» و${raster.tile_count} بلاطة؟ لا رجعة في هذا.`)) return;

        try {
            await rasterService.remove(raster.id);
            setRasters(prev => prev.filter(r => r.id !== raster.id));
            flash('حُذفت الطبقة');
        } catch (err) {
            flash(rasterError(err, 'تعذّر الحذف'), 'err');
        }
    }, [flash]);

    return (
        <div className="rst">
            <header className="rst-head">
                <div>
                    <b>طبقات الراستر</b>
                    <span>ملفّ GeoTIFF يُقطّع إلى بلاطات ويظهر على الخريطة الرئيسية</span>
                </div>

                {!building && (
                    <button className="rst-primary" onClick={() => setBuilding(true)}>
                        + طبقة جديدة
                    </button>
                )}
            </header>

            {notice && <div className={`rst-flash is-${notice.kind}`}>{notice.message}</div>}

            {building && (
                <Builder
                    flash={flash}
                    onCancel={() => setBuilding(false)}
                    onDone={(raster) => {
                        setBuilding(false);
                        setRasters(prev => [{ ...raster, opacity: Number(raster.opacity) }, ...prev]);
                    }}
                />
            )}

            {problem && (
                <div className="rst-bad">
                    {problem}
                    <button onClick={load}>أعد المحاولة</button>
                </div>
            )}

            {loading && <div className="rst-note">يُحمّل…</div>}

            {!loading && !rasters.length && !building && (
                <div className="rst-empty">
                    لا طبقات بعد. ارفع ملفّ GeoTIFF فيُقطّع ويظهر على الخريطة.
                </div>
            )}

            <div className="rst-list">
                {rasters.map(raster => (
                    <article key={raster.id} className={`rst-card${raster.is_visible ? ' is-on' : ''}`}>
                        <div className="rst-card-top">
                            <b>{raster.name}</b>
                            <span className={`rst-state is-${raster.status}`}>
                                {raster.status === 'ready' ? 'جاهزة' : 'تُبنى'}
                            </span>
                        </div>

                        <div className="rst-meta">
                            <span>مستويات {raster.min_zoom}–{raster.max_zoom}</span>
                            <span>{raster.tile_count.toLocaleString('en')} بلاطة</span>
                            <span>{readable(raster.bytes)}</span>
                            {raster.crs && <span>{raster.crs}</span>}
                        </div>

                        <div className="rst-bounds">
                            <span>ش {deg(raster.north)}</span>
                            <span>ج {deg(raster.south)}</span>
                            <span>غ {deg(raster.west)}</span>
                            <span>ق {deg(raster.east)}</span>
                        </div>

                        <label className="rst-slider">
                            <span>الشفافية {Math.round(raster.opacity * 100)}%</span>
                            <input
                                type="range"
                                min="0.05" max="1" step="0.05"
                                value={raster.opacity}
                                onChange={(e) => {
                                    const opacity = parseFloat(e.target.value);
                                    setRasters(prev => prev.map(r => (r.id === raster.id ? { ...r, opacity } : r)));
                                }}
                                onPointerUp={(e) => patch(raster, { opacity: parseFloat(e.target.value) })}
                            />
                        </label>

                        <div className="rst-card-act">
                            <button
                                className={raster.is_visible ? 'is-on' : ''}
                                onClick={() => patch(raster, { is_visible: !raster.is_visible })}
                                disabled={raster.status !== 'ready'}
                            >
                                {raster.is_visible ? 'ظاهرة على الخريطة' : 'مخفيّة'}
                            </button>
                            <button className="rst-danger" onClick={() => remove(raster)}>حذف</button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default AdminRasters;
