import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PalNovaaEngine.css';

/* ============================================================================
   PalNovaa Engine — محرّك بالنوفا  (/palnovaa-engine)
   ----------------------------------------------------------------------------
   واجهة محادثة يكتب فيها المستخدم ما يريد، فيبني الموديل «PalNovaa 1.0» تطبيق
   GIS كاملاً، يُعرض حيّاً، ويُحفَظ برابطٍ دائم (/pe/:slug) يعمل في أيّ وقت.
   ============================================================================ */

const API = import.meta.env.VITE_API_URL || '/api';
const MODEL = 'PalNovaa 1.0';
const KEY_LS = 'palnovaa_engine_key';

const authHeaders = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
};
async function jpost(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
    return r.json();
}
async function jput(path, body) {
    const r = await fetch(API + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) });
    return r.json();
}
async function jget(path) {
    const r = await fetch(API + path, { headers: { ...authHeaders() } });
    return r.json();
}
async function jdel(path) {
    const r = await fetch(API + path, { method: 'DELETE', headers: { ...authHeaders() } });
    return r.json();
}

const EXAMPLES = [
    'خريطة لمدن الضفة الغربية مع ترقيمها حسب عدد السكّان وبحث فوريّ',
    'أداة ترسم نطاقات (Buffer) حول نقاط المستشفيات وتحسب التغطية',
    'لوحة تعرض الحوادث كنقاط ساخنة (Heatmap) مع فلترة حسب الشدّة',
    'مُخطِّط مسارات بين موقعين مع قياس المسافة والزمن التقريبيّ',
];

export default function PalNovaaEnginePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [messages, setMessages] = useState([]);      // {role, text, summary?}
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [html, setHtml] = useState('');
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState(null);
    const [mobileTab, setMobileTab] = useState('chat'); // chat | preview
    const [sideOpen, setSideOpen] = useState(false);
    const [keyModal, setKeyModal] = useState(false);
    const [keyDraft, setKeyDraft] = useState('');
    const chatRef = useRef(null);

    useEffect(() => {
        document.title = 'PalNovaa Engine — محرّك بالنوفا';
        const splash = document.getElementById('splash-screen');
        if (splash) splash.style.display = 'none';
        document.documentElement.classList.add('pn-foresight');
        return () => document.documentElement.classList.remove('pn-foresight');
    }, []);

    const loadProjects = useCallback(async () => {
        try { const d = await jget('/engine/projects'); if (d.ok) setProjects(d.projects || []); } catch { /* ignore */ }
    }, []);
    useEffect(() => { loadProjects(); }, [loadProjects]);

    useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, busy]);

    const newProject = () => {
        setMessages([]); setHtml(''); setTitle(''); setSlug(null); setDraft(''); setSideOpen(false); setMobileTab('chat');
    };

    const openProject = async (s) => {
        setBusy(true); setSideOpen(false);
        try {
            const d = await jget('/engine/projects/' + s);
            if (d.ok) {
                setHtml(d.project.html); setTitle(d.project.title); setSlug(d.project.slug);
                setMessages([{ role: 'assistant', text: 'تمّ فتح المشروع المحفوظ.', summary: d.project.summary || '' }]);
                setMobileTab('preview');
            }
        } catch { /* ignore */ }
        setBusy(false);
    };

    const persist = async (newHtml, newTitle, newSummary, prompt) => {
        try {
            if (slug) {
                await jput('/engine/projects/' + slug, { html: newHtml, title: newTitle, summary: newSummary, prompt });
            } else {
                const d = await jpost('/engine/projects', { html: newHtml, title: newTitle, summary: newSummary, prompt });
                if (d.ok && d.project) setSlug(d.project.slug);
            }
            loadProjects();
        } catch { /* ignore */ }
    };

    const send = async (text) => {
        const prompt = (text != null ? text : draft).trim();
        if (!prompt || busy) return;
        setDraft('');
        setMessages((m) => [...m, { role: 'user', text: prompt }]);
        setBusy(true);
        const key = localStorage.getItem(KEY_LS) || '';
        try {
            const d = await jpost('/engine/generate', { prompt, currentHtml: html || undefined, key: key || undefined });
            if (d.ok) {
                setHtml(d.html); setTitle(d.title || 'تطبيق GIS');
                setMessages((m) => [...m, { role: 'assistant', text: '✓ تمّ بناء التطبيق «' + (d.title || '') + '».', summary: d.summary || '' }]);
                setMobileTab('preview');
                persist(d.html, d.title || 'تطبيق GIS', d.summary || '', prompt);
            } else if (d.reason === 'missing_key') {
                setMessages((m) => [...m, { role: 'assistant', text: '⚠️ المفتاح غير مُهيّأ بعد. أضِف مفتاح PalNovaa 1.0 لتشغيل المحرّك.', error: true }]);
                setKeyModal(true);
            } else {
                setMessages((m) => [...m, { role: 'assistant', text: '⚠️ تعذّر التوليد: ' + (d.reason || 'غير معروف') + '. حاول صياغة الطلب بوضوحٍ أكثر.', error: true }]);
            }
        } catch (e) {
            setMessages((m) => [...m, { role: 'assistant', text: '⚠️ خطأ في الاتصال بالمحرّك.', error: true }]);
        }
        setBusy(false);
    };

    const saveKey = () => {
        const k = keyDraft.trim();
        if (k) { localStorage.setItem(KEY_LS, k); setKeyModal(false); setKeyDraft(''); }
    };

    const exportHtml = () => {
        if (!html) return;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = (title || 'palnovaa-app').replace(/\s+/g, '-') + '.html';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    };

    const openLink = () => { if (slug) window.open('/pe/' + slug, '_blank', 'noopener'); };
    const deleteProject = async (e, s) => {
        e.stopPropagation();
        await jdel('/engine/projects/' + s);
        if (s === slug) newProject();
        loadProjects();
    };

    const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

    return (
        <div className="pne" dir="rtl">
            {/* ===================== الشريط الجانبيّ ===================== */}
            <aside className={'pne-side' + (sideOpen ? ' open' : '')}>
                <div className="pne-brand">
                    <span className="pne-mk">◎</span>
                    <div className="pne-brand-txt">محرّك بالنوفا<small>PalNovaa Engine</small></div>
                </div>
                <button className="pne-new" onClick={newProject}><span>＋</span> مشروع جديد</button>

                <div className="pne-plist">
                    <div className="pne-plist-h">مشاريعي</div>
                    {projects.length === 0 && <div className="pne-plist-empty">لا مشاريع بعد — ابدأ بكتابة فكرتك.</div>}
                    {projects.map((p) => (
                        <div key={p.id} className={'pne-pitem' + (p.slug === slug ? ' active' : '')} onClick={() => openProject(p.slug)}>
                            <div className="pne-pitem-main">
                                <div className="pne-pitem-title">{p.title}</div>
                                {p.summary && <div className="pne-pitem-sub">{p.summary}</div>}
                            </div>
                            <button className="pne-pitem-del" title="حذف" onClick={(e) => deleteProject(e, p.slug)}>🗑</button>
                        </div>
                    ))}
                </div>

                <div className="pne-side-foot">
                    <button className="pne-ghost" onClick={() => setKeyModal(true)}>⚙ مفتاح الموديل</button>
                    <button className="pne-ghost" onClick={() => navigate('/map')}>↩ عودة للموقع</button>
                </div>
            </aside>
            {sideOpen && <div className="pne-scrim" onClick={() => setSideOpen(false)} />}

            {/* ===================== المحادثة ===================== */}
            <section className={'pne-chat' + (mobileTab === 'chat' ? ' show' : '')}>
                <header className="pne-chat-top">
                    <button className="pne-burger" onClick={() => setSideOpen(true)} aria-label="القائمة">☰</button>
                    <div className="pne-model"><span className="pne-dot" /> {MODEL}</div>
                    <div className="pne-mtabs">
                        <button className={mobileTab === 'chat' ? 'on' : ''} onClick={() => setMobileTab('chat')}>محادثة</button>
                        <button className={mobileTab === 'preview' ? 'on' : ''} onClick={() => setMobileTab('preview')}>المعاينة</button>
                    </div>
                </header>

                <div className="pne-msgs" ref={chatRef}>
                    {messages.length === 0 && (
                        <div className="pne-hero">
                            <div className="pne-hero-mk">◎</div>
                            <h1>اكتب فكرتك، ويبنيها المحرّك</h1>
                            <p>صِف تطبيق نظم المعلومات الجغرافية (GIS) الذي تريده بالعربية، وسيبنيه <b>{MODEL}</b> كاملاً ويمنحه رابطاً دائماً.</p>
                            <div className="pne-examples">
                                {EXAMPLES.map((ex, i) => (
                                    <button key={i} onClick={() => send(ex)}>{ex}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={'pne-msg ' + m.role + (m.error ? ' err' : '')}>
                            <div className="pne-msg-ava">{m.role === 'user' ? '؟' : '◎'}</div>
                            <div className="pne-msg-body">
                                <div className="pne-msg-text">{m.text}</div>
                                {m.summary && <div className="pne-msg-sum">{m.summary}</div>}
                            </div>
                        </div>
                    ))}
                    {busy && (
                        <div className="pne-msg assistant">
                            <div className="pne-msg-ava">◎</div>
                            <div className="pne-msg-body"><div className="pne-typing"><span /><span /><span /></div></div>
                        </div>
                    )}
                </div>

                <div className="pne-composer">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={html ? 'اطلب تعديلاً على التطبيق…' : 'صِف التطبيق الذي تريد بناءه…'}
                        rows={1}
                    />
                    <button className="pne-send" disabled={busy || !draft.trim()} onClick={() => send()} aria-label="إرسال">
                        {busy ? '…' : '↑'}
                    </button>
                </div>
            </section>

            {/* ===================== المعاينة الحيّة ===================== */}
            <section className={'pne-preview' + (mobileTab === 'preview' ? ' show' : '')}>
                <header className="pne-prev-top">
                    <div className="pne-prev-title">{title || 'المعاينة الحيّة'}</div>
                    <div className="pne-prev-acts">
                        <button className="pne-ghost" disabled={!html} onClick={exportHtml} title="تصدير HTML">⬇ تصدير</button>
                        <button className="pne-ghost" disabled={!slug} onClick={openLink} title="فتح برابط دائم">🔗 الرابط</button>
                    </div>
                </header>
                <div className="pne-prev-body">
                    {html ? (
                        <iframe
                            title="preview"
                            className="pne-frame"
                            sandbox="allow-scripts allow-popups allow-forms allow-modals"
                            srcDoc={html}
                        />
                    ) : (
                        <div className="pne-prev-empty">
                            <div className="pne-prev-empty-mk">🗺</div>
                            <p>ستظهر هنا معاينة التطبيق فور بنائه.</p>
                        </div>
                    )}
                    {busy && <div className="pne-prev-loading"><span className="pne-spin" /> يبني {MODEL}…</div>}
                </div>
                {slug && (
                    <div className="pne-prev-link">
                        <span>الرابط الدائم:</span>
                        <code>{window.location.origin}/pe/{slug}</code>
                        <button onClick={() => { try { navigator.clipboard.writeText(window.location.origin + '/pe/' + slug); } catch { /* ignore */ } }}>نسخ</button>
                    </div>
                )}
            </section>

            {/* ===================== نافذة المفتاح ===================== */}
            {keyModal && (
                <div className="pne-modal" onClick={(e) => { if (e.target === e.currentTarget) setKeyModal(false); }}>
                    <div className="pne-mbox">
                        <header>مفتاح {MODEL} <button onClick={() => setKeyModal(false)}>×</button></header>
                        <div className="pne-mbody">
                            <p>للاستخدام قبل تهيئة الخادم، الصق مفتاح الموديل هنا. يُحفَظ في متصفّحك فقط ويُرسَل للخادم مع كلّ طلبٍ لتشغيل المحرّك.</p>
                            <p className="pne-mnote">الأفضل والأأمن: ضع المفتاح في متغيّر البيئة <code>PALNOVAA_MODEL_KEY</code> على الخادم (Vercel) فلا يظهر في المتصفّح إطلاقاً.</p>
                            <input type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="AQ.… أو AIza…" autoComplete="off" />
                        </div>
                        <footer>
                            <button className="pne-primary" onClick={saveKey}>حفظ المفتاح</button>
                            <button className="pne-ghost" onClick={() => { localStorage.removeItem(KEY_LS); setKeyModal(false); }}>مسح</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
