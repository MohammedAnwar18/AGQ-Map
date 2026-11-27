/* ============================================================================
   PalNovaa Data Hub — لوحة ترحيل البيانات الجغرافيّة
   تصفّحُ خادمٍ خارجيّ ← اختيارُ طبقة ← معاينةُ حقولها وعددها ← ترحيلٌ إلى
   PostGIS مع متابعةٍ حيّةٍ للتقدّم. السحبُ ينفّذه العامل على الخادم، فاللوحة
   تضيف المهمّة وتراقبها فقط — لا تنتظرها.
   ============================================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

/* خادم البيانات منفصل (Hetzner) لأنّ PostGIS يعيش بجواره. يُضبَط بـVITE_DATA_API،
   وإن غاب عدنا للمسار المحلّيّ فتعمل التطوير والنشر الموحّد كما هما. */
const DATA_API = import.meta.env.VITE_DATA_API || '/api';
const api = axios.create({ baseURL: DATA_API, timeout: 25000 });
api.interceptors.request.use((c) => {
    const t = localStorage.getItem('token');
    if (t) c.headers.Authorization = `Bearer ${t}`;
    return c;
});
import './DataHub.css';

const GEOMOLG = 'https://orthophotos.geomolg.ps/adaptor/rest/services';
const OCHA = 'https://gis.unocha.org/server/rest/services';

const CATEGORIES = ['إداريّ', 'دينيّ', 'تعليميّ', 'صحّيّ', 'نقل', 'بيئة', 'مياه', 'زراعة', 'تخطيط', 'سكّان', 'أخرى'];
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en'));
const err = (e) => e?.response?.data?.reason || e?.message || 'خطأٌ غير متوقّع';

export default function DataHub() {
    const [tab, setTab] = useState('import');          // import | catalog
    const [url, setUrl] = useState(GEOMOLG);
    const [node, setNode] = useState(null);            // نتيجة discover
    const [stack, setStack] = useState([]);            // فتات المسار
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState(null);              // {kind,text}
    const [filter, setFilter] = useState('');

    const [sel, setSel] = useState(null);              // الطبقة المختارة + وصفها
    const [form, setForm] = useState(null);            // نموذج الترحيل

    const [jobs, setJobs] = useState([]);
    const [layers, setLayers] = useState([]);
    const [edit, setEdit] = useState(null);          // { slug, ...draft }
    const [stats, setStats] = useState(null);        // تمايز حقول الطبقة المحرَّرة
    const poll = useRef(null);

    const toast = (text, kind = 'ok') => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 4500); };

    /* ---------------- التصفّح ---------------- */
    const browse = useCallback(async (target, push = true) => {
        setBusy('browse'); setSel(null); setForm(null);
        try {
            const { data } = await api.get('/data/discover', { params: { url: target }, timeout: 120000 });
            if (!data.ok) throw new Error(data.reason);
            setNode(data);
            setUrl(target);
            setFilter('');
            if (push) setStack((s) => (s[s.length - 1] === target ? s : [...s, target]));
        } catch (e) { toast(err(e), 'err'); }
        setBusy('');
    }, []);

    const goBack = () => {
        const s = [...stack]; s.pop();
        const prev = s[s.length - 1];
        setStack(s);
        if (prev) browse(prev, false); else { setNode(null); setUrl(GEOMOLG); }
    };

    /* ---------------- وصفُ طبقة ---------------- */
    const pick = async (layer) => {
        setBusy('describe'); setSel(null); setForm(null);
        try {
            const { data } = await api.get('/data/describe', { params: { url: node.url, layer: layer.id }, timeout: 120000 });
            if (!data.ok) throw new Error(data.reason);
            const d = data.layer;
            setSel({ ...layer, ...d });
            /* تخمينُ حقل الاسم — الدرس المستفاد: LayerName_Arabic يحمل القيمة
               نفسها لكلّ الصفوف فيُفسد البحث. نستبعد حقول الوصف العامّ ونفضّل
               أسماءَ الكيان (تجمّع/قرية/موقع)، والعربيّة على الإنجليزيّة. */
            const strs = (d.fields || []).filter((f) => /string|text/i.test(f.type || ''));
            const BAN = /^(layer|source|service|dataset|category|class|type|status|created|last_edited|molg|permit)/i;
            const GOOD = /(community|village|town|city|locality|site|place|school|mosque|facility|اسم)/i;
            const score = (f) => {
                if (BAN.test(f.name)) return -10;
                let v = 0;
                if (GOOD.test(f.name)) v += 4;
                if (/name/i.test(f.name)) v += 2;
                if (/_arabic$|_ar$/i.test(f.name)) v += 2;
                if (/_english$|_en$/i.test(f.name)) v -= 1;
                return v;
            };
            const ranked = strs.map((f) => ({ f, v: score(f) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
            const nf = ranked.length ? ranked[0].f : null;
            const svc = String(node.name || '').split('/').pop();
            setForm({
                slug: `${svc}_${layer.id}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 50),
                name_ar: layer.name || d.name, category: '', name_field: nf ? nf.name : '',
                is_boundary: false, where: '', minzoom: 10, license: '', maxFeatures: '',
            });
        } catch (e) { toast(err(e), 'err'); }
        setBusy('');
    };

    /* ---------------- بدء الترحيل ---------------- */
    const migrate = async () => {
        if (!form.slug) return toast('المعرّف (slug) مطلوب', 'err');
        setBusy('migrate');
        try {
            const body = {
                slug: form.slug, serviceUrl: node.url, layerId: sel.id,
                name_ar: form.name_ar, category: form.category || null,
                name_field: form.name_field || null, is_boundary: form.is_boundary,
                where: form.where || '1=1', license: form.license || null,
                minzoom: Number(form.minzoom) || 10,
                ...(form.maxFeatures ? { maxFeatures: Number(form.maxFeatures) } : {}),
            };
            const { data } = await api.post('/data/migrate', body);
            if (!data.ok) throw new Error(data.reason);
            toast(`أُضيفت المهمّة #${data.job.id} — يلتقطها العامل خلال ثوانٍ`);
            setSel(null); setForm(null);
            loadJobs();
        } catch (e) { toast(err(e), 'err'); }
        setBusy('');
    };

    /* ---------------- المهامّ والمكتبة ---------------- */
    const loadJobs = useCallback(async () => {
        try { const { data } = await api.get('/data/jobs'); if (data.ok) setJobs(data.jobs); } catch { /* */ }
    }, []);
    const loadLayers = useCallback(async () => {
        try { const { data } = await api.get('/data/layers'); if (data.ok) setLayers(data.layers); } catch { /* */ }
    }, []);

    useEffect(() => { loadJobs(); loadLayers(); }, [loadJobs, loadLayers]);

    // استطلاعٌ حيٌّ ما دامت هناك مهمّةٌ نشطة
    useEffect(() => {
        const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
        clearInterval(poll.current);
        if (active) poll.current = setInterval(() => { loadJobs(); loadLayers(); }, 2500);
        return () => clearInterval(poll.current);
    }, [jobs, loadJobs, loadLayers]);

    const cancelJob = async (id) => {
        try { await api.post(`/data/jobs/${id}/cancel`); loadJobs(); } catch (e) { toast(err(e), 'err'); }
    };
    /* فتحُ التحرير مع جلب تمايز الحقول — الرقم يكشف الحقل عديم الفائدة فوراً */
    const openEdit = async (l) => {
        setEdit({ slug: l.slug, name_ar: l.name_ar, category: l.category || '',
            name_field: l.name_field || '', is_boundary: !!l.is_boundary, minzoom: l.minzoom ?? 10,
            fields: l.fields || [] });
        setStats(null);
        try {
            const { data } = await api.get(`/data/layers/${l.slug}/field-stats`, { timeout: 60000 });
            if (data.ok) setStats(data);
        } catch { /* اختياريّ */ }
    };

    const saveEdit = async () => {
        setBusy('edit');
        try {
            const { data } = await api.patch(`/data/layers/${edit.slug}`, {
                name_ar: edit.name_ar, category: edit.category || null,
                name_field: edit.name_field || null, is_boundary: edit.is_boundary,
                minzoom: Number(edit.minzoom) || 10,
            });
            if (!data.ok) throw new Error(data.reason);
            toast(data.renamed ? `حُفظ — وأُعيد اشتقاق الاسم لـ${fmt(data.renamed)} معلماً` : 'حُفظ');
            setEdit(null); setStats(null); loadLayers();
        } catch (e) { toast(err(e), 'err'); }
        setBusy('');
    };

    const delLayer = async (slug) => {
        if (!window.confirm(`حذف الطبقة «${slug}» وكلّ معالمها نهائيّاً؟`)) return;
        try { await api.delete(`/data/layers/${slug}`); toast('حُذفت'); loadLayers(); } catch (e) { toast(err(e), 'err'); }
    };

    /* ---------------- العرض ---------------- */
    const f = filter.trim().toLowerCase();
    const services = (node?.services || []).filter((s) => !f || s.name.toLowerCase().includes(f));
    const folders = (node?.folders || []).filter((s) => !f || s.name.toLowerCase().includes(f));
    const nodeLayers = (node?.layers || []).filter((l) => !f || String(l.name).toLowerCase().includes(f));

    return (
        <div className="dh" dir="rtl">
            <header className="dh-head">
                <div>
                    <h2>مكتبة البيانات الجغرافيّة</h2>
                    <p>رحّل الطبقات من الخوادم الخارجيّة مرّةً واحدة، فتُخدَم بعدها من قاعدتك مباشرةً</p>
                </div>
                <nav className="dh-tabs">
                    <button className={tab === 'import' ? 'on' : ''} onClick={() => setTab('import')}>استيراد</button>
                    <button className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>
                        المكتبة {layers.length > 0 && <span className="dh-pill">{layers.length}</span>}
                    </button>
                </nav>
            </header>

            {msg && <div className={`dh-msg ${msg.kind}`}>{msg.text}</div>}

            {/* ============ الاستيراد ============ */}
            {tab === 'import' && (<>
                <div className="dh-bar">
                    <input value={url} onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && browse(url.trim())}
                        placeholder="رابط خادم ArcGIS REST…" />
                    <button className="dh-btn primary" disabled={!!busy} onClick={() => browse(url.trim())}>
                        {busy === 'browse' ? <span className="dh-spin" /> : 'تصفّح'}
                    </button>
                    <div className="dh-presets">
                        <button onClick={() => browse(GEOMOLG)}>GeoMOLG</button>
                        <button onClick={() => browse(OCHA)}>OCHA</button>
                    </div>
                </div>

                {node && (
                    <div className="dh-crumbs">
                        {stack.length > 1 && <button className="dh-back" onClick={goBack}>↩ رجوع</button>}
                        <span className="dh-path">{node.kind === 'service' ? node.name : node.url.split('/rest/services')[1] || '/'}</span>
                        {(services.length + folders.length + nodeLayers.length) > 8 && (
                            <input className="dh-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="تصفية…" />
                        )}
                    </div>
                )}

                <div className="dh-grid">
                    <div className="dh-col">
                        {!node && <div className="dh-empty">اختر خادماً من الأزرار أعلاه أو الصق رابطاً، ثمّ اضغط «تصفّح».</div>}

                        {node?.kind === 'directory' && (<>
                            {folders.map((x) => (
                                <button className="dh-row folder" key={x.url} onClick={() => browse(x.url)}>
                                    <span className="dh-ic">📁</span><b>{x.name}</b>
                                </button>
                            ))}
                            {services.map((x) => (
                                <button className="dh-row" key={x.url} onClick={() => browse(x.url)}>
                                    <span className="dh-ic">🗺</span><b>{x.name}</b><span className="dh-tag">{x.type}</span>
                                </button>
                            ))}
                            {!folders.length && !services.length && <div className="dh-empty">لا نتائج.</div>}
                        </>)}

                        {node?.kind === 'service' && (<>
                            {nodeLayers.map((l) => (
                                <button className={`dh-row ${sel?.id === l.id ? 'on' : ''}`} key={l.id}
                                    disabled={busy === 'describe'} onClick={() => pick(l)}>
                                    <span className="dh-ic">▦</span>
                                    <b>{l.name}</b>
                                    {l.geometryType && <span className="dh-tag">{String(l.geometryType).replace('esriGeometry', '')}</span>}
                                    <span className="dh-id">#{l.id}</span>
                                </button>
                            ))}
                            {!nodeLayers.length && <div className="dh-empty">لا طبقات في هذه الخدمة.</div>}
                        </>)}
                    </div>

                    {/* نموذج الترحيل */}
                    <aside className="dh-side">
                        {busy === 'describe' && <div className="dh-empty"><span className="dh-spin" /> جارٍ قراءة الطبقة…</div>}
                        {!sel && busy !== 'describe' && <div className="dh-empty">اختر طبقةً لتظهر تفاصيلها هنا.</div>}

                        {sel && form && (<>
                            <div className="dh-stats">
                                <div><b>{fmt(sel.count)}</b><span>معلم</span></div>
                                <div><b>{sel.geometryType || '—'}</b><span>الهندسة</span></div>
                                <div><b>{sel.fields?.length || 0}</b><span>حقل</span></div>
                            </div>

                            <details className="dh-fields">
                                <summary>الحقول ({sel.fields?.length || 0})</summary>
                                <div className="dh-chips">
                                    {(sel.fields || []).map((x) => <span key={x.name} title={x.alias}>{x.name}<i>{x.type}</i></span>)}
                                </div>
                            </details>

                            <div className="dh-f">
                                <label>المعرّف (slug) — لاتينيّ، يُستعمل في الروابط</label>
                                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} dir="ltr" />
                            </div>
                            <div className="dh-f">
                                <label>الاسم بالعربيّة</label>
                                <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
                            </div>
                            <div className="dh-f2">
                                <div className="dh-f">
                                    <label>التصنيف</label>
                                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                                        <option value="">—</option>
                                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="dh-f">
                                    <label>حقل الاسم</label>
                                    <select value={form.name_field} onChange={(e) => setForm({ ...form, name_field: e.target.value })}>
                                        <option value="">—</option>
                                        {(sel.fields || []).map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <label className="dh-check">
                                <input type="checkbox" checked={form.is_boundary}
                                    onChange={(e) => setForm({ ...form, is_boundary: e.target.checked })} />
                                <span>
                                    <b>طبقةُ حدود</b>
                                    <small>فعّلها للتجمّعات والمحافظات — تصير قاطعاً مكانيّاً، فيصحّ «المساجد في بيتا»</small>
                                </span>
                            </label>

                            <details className="dh-adv">
                                <summary>خياراتٌ متقدّمة</summary>
                                <div className="dh-f">
                                    <label>فلتر SQL (where) — لترحيل جزءٍ فقط</label>
                                    <input value={form.where} onChange={(e) => setForm({ ...form, where: e.target.value })}
                                        dir="ltr" placeholder="GOV='نابلس'" />
                                </div>
                                <div className="dh-f2">
                                    <div className="dh-f">
                                        <label>أقلّ تكبيرٍ للبلاطات</label>
                                        <input type="number" value={form.minzoom} min="0" max="18"
                                            onChange={(e) => setForm({ ...form, minzoom: e.target.value })} />
                                    </div>
                                    <div className="dh-f">
                                        <label>حدّ المعالم (للتجربة)</label>
                                        <input type="number" value={form.maxFeatures} placeholder="الكلّ"
                                            onChange={(e) => setForm({ ...form, maxFeatures: e.target.value })} />
                                    </div>
                                </div>
                                <div className="dh-f">
                                    <label>الترخيص / المصدر</label>
                                    <input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} />
                                </div>
                            </details>

                            <button className="dh-btn primary wide" disabled={busy === 'migrate'} onClick={migrate}>
                                {busy === 'migrate' ? <span className="dh-spin" /> : `رحّل ${fmt(sel.count)} معلماً`}
                            </button>
                            {sel.count > 200000 && (
                                <p className="dh-warn">طبقةٌ ضخمة — قد يستغرق الترحيل دقائق. استعمل فلتر SQL لترحيل جزءٍ منها إن أردت.</p>
                            )}
                        </>)}
                    </aside>
                </div>

                {/* المهامّ */}
                {jobs.length > 0 && (
                    <section className="dh-jobs">
                        <h3>المهامّ</h3>
                        {jobs.slice(0, 8).map((j) => {
                            const pct = j.total ? Math.min(100, Math.round((j.done / j.total) * 100)) : null;
                            return (
                                <div className={`dh-job ${j.status}`} key={j.id}>
                                    <span className="dh-job-slug">{j.layer_slug}</span>
                                    <span className={`dh-job-st ${j.status}`}>
                                        {{ queued: 'في الطابور', running: 'جارٍ', done: 'اكتمل', error: 'خطأ', canceled: 'أُلغيت' }[j.status] || j.status}
                                    </span>
                                    <div className="dh-job-bar">
                                        {pct != null && <span style={{ width: `${pct}%` }} />}
                                    </div>
                                    <span className="dh-job-n">{fmt(j.done)}{j.total ? ` / ${fmt(j.total)}` : ''}</span>
                                    <span className="dh-job-msg" title={j.message}>{j.message}</span>
                                    {(j.status === 'queued' || j.status === 'running') &&
                                        <button className="dh-x" onClick={() => cancelJob(j.id)}>إلغاء</button>}
                                </div>
                            );
                        })}
                    </section>
                )}
            </>)}

            {/* نافذة تصحيح وصف الطبقة */}
            {edit && (
                <div className="dh-modal" onClick={(e) => e.target.classList.contains('dh-modal') && setEdit(null)}>
                    <div className="dh-dlg">
                        <h3>تعديل «{edit.name_ar}»<code>{edit.slug}</code></h3>

                        <div className="dh-f">
                            <label>الاسم بالعربيّة</label>
                            <input value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} />
                        </div>

                        <div className="dh-f">
                            <label>حقل الاسم — المستعمَل للبحث عن المواقع</label>
                            <select value={edit.name_field} onChange={(e) => setEdit({ ...edit, name_field: e.target.value })}>
                                <option value="">—</option>
                                {(stats?.fields || edit.fields.map((f) => ({ name: f.name }))).map((f) => (
                                    <option key={f.name} value={f.name}>
                                        {f.name}{f.distinct != null ? ` — ${f.distinct} قيمة مختلفة` : ''}
                                    </option>
                                ))}
                            </select>
                            {stats && (() => {
                                const cur = stats.fields.find((f) => f.name === edit.name_field);
                                if (!cur) return <small className="dh-hint">اختر حقلاً يحمل اسم كلّ معلم.</small>;
                                if (cur.distinct <= 1) return <small className="dh-hint bad">⚠ هذا الحقل قيمته واحدةٌ لكلّ المعالم — لا يصلح للبحث.</small>;
                                if (cur.ratio < 0.1) return <small className="dh-hint warn">تمايزٌ ضعيف ({cur.distinct} من {fmt(cur.total)}) — تأكّد أنّه المقصود.</small>;
                                return <small className="dh-hint good">✓ {cur.distinct} قيمة مختلفة من {fmt(cur.total)} — مناسب.</small>;
                            })()}
                        </div>

                        <div className="dh-f2">
                            <div className="dh-f">
                                <label>التصنيف</label>
                                <select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                                    <option value="">—</option>
                                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="dh-f">
                                <label>أقلّ تكبير</label>
                                <input type="number" min="0" max="18" value={edit.minzoom}
                                    onChange={(e) => setEdit({ ...edit, minzoom: e.target.value })} />
                            </div>
                        </div>

                        <label className="dh-check">
                            <input type="checkbox" checked={edit.is_boundary}
                                onChange={(e) => setEdit({ ...edit, is_boundary: e.target.checked })} />
                            <span>
                                <b>طبقةُ حدود</b>
                                <small>للمضلّعات فقط. النقاط لا تحتوي شيئاً، فتفعيلها عليها يُفسد نتائج البحث.</small>
                            </span>
                        </label>

                        <div className="dh-dlg-foot">
                            <button className="dh-btn" onClick={() => setEdit(null)}>إلغاء</button>
                            <button className="dh-btn primary" disabled={busy === 'edit'} onClick={saveEdit}>
                                {busy === 'edit' ? <span className="dh-spin" /> : 'حفظ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ المكتبة ============ */}
            {tab === 'catalog' && (
                <section className="dh-cat">
                    {!layers.length && <div className="dh-empty">لا طبقاتٍ بعد — رحّل أوّل طبقةٍ من تبويب «استيراد».</div>}
                    {layers.map((l) => (
                        <div className="dh-cat-row" key={l.slug}>
                            <div className="dh-cat-main">
                                <b>{l.name_ar}</b>
                                {l.is_boundary && <span className="dh-badge">حدود</span>}
                                {l.category && <span className="dh-tag">{l.category}</span>}
                                <code>{l.slug}</code>
                            </div>
                            <div className="dh-cat-meta">
                                <span>{fmt(l.feature_count)} معلم</span>
                                <span>{l.geometry_type || '—'}</span>
                                <span>{(l.fields || []).length} حقل</span>
                                {l.name_field && <span>اسم: {l.name_field}</span>}
                            </div>
                            <button className="dh-x edit" onClick={() => openEdit(l)}>تعديل</button>
                            <button className="dh-x" onClick={() => delLayer(l.slug)}>حذف</button>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
