import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './PalNovaaEngine.css';

/* ============================================================================
   PalNovaa Engine  (/palnovaa-engine)
   واجهةٌ مينيمال: شريط إنشاءٍ واحد بتوهّجٍ برتقاليّ علويّ. المعاينة اختياريّة
   مخفيّة. المشاريع والمفتاح داخل زرّ (＋). يبني تطبيق GIS ويعطيه رابطاً دائماً.
   ============================================================================ */

const API = import.meta.env.VITE_API_URL || '/api';
const KEY_LS = 'palnovaa_engine_key';

const authHeaders = () => { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {}; };
const jpost = (p, b) => fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(b) }).then((r) => r.json());
const jput = (p, b) => fetch(API + p, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(b) }).then((r) => r.json());
const jget = (p) => fetch(API + p, { headers: { ...authHeaders() } }).then((r) => r.json());
const jdel = (p) => fetch(API + p, { method: 'DELETE', headers: { ...authHeaders() } }).then((r) => r.json());

export default function PalNovaaEnginePage() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [html, setHtml] = useState('');
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [preview, setPreview] = useState(false);
    const [keyModal, setKeyModal] = useState(false);
    const [keyDraft, setKeyDraft] = useState('');
    const chatRef = useRef(null);
    const taRef = useRef(null);

    useEffect(() => {
        document.title = 'PalNovaa Engine';
        const s = document.getElementById('splash-screen'); if (s) s.style.display = 'none';
        document.documentElement.classList.add('pn-foresight');
        return () => document.documentElement.classList.remove('pn-foresight');
    }, []);

    const loadProjects = useCallback(async () => { try { const d = await jget('/engine/projects'); if (d.ok) setProjects(d.projects || []); } catch { /* */ } }, []);
    useEffect(() => { loadProjects(); }, [loadProjects]);
    useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages, busy]);

    const resetTA = () => { if (taRef.current) taRef.current.style.height = 'auto'; };
    const newProject = () => { setMessages([]); setHtml(''); setTitle(''); setSlug(null); setDraft(''); setMenuOpen(false); setPreview(false); resetTA(); };

    const openProject = async (s) => {
        setMenuOpen(false); setBusy(true);
        try {
            const d = await jget('/engine/projects/' + s);
            if (d.ok) { setHtml(d.project.html); setTitle(d.project.title); setSlug(d.project.slug); setMessages([{ role: 'assistant', text: d.project.summary || 'المشروع جاهز.' }]); }
        } catch { /* */ }
        setBusy(false);
    };

    const persist = async (nHtml, nTitle, nSum, prompt) => {
        try {
            if (slug) await jput('/engine/projects/' + slug, { html: nHtml, title: nTitle, summary: nSum, prompt });
            else { const d = await jpost('/engine/projects', { html: nHtml, title: nTitle, summary: nSum, prompt }); if (d.ok && d.project) setSlug(d.project.slug); }
            loadProjects();
        } catch { /* */ }
    };

    const send = async () => {
        const prompt = draft.trim(); if (!prompt || busy) return;
        setDraft(''); resetTA();
        setMessages((m) => [...m, { role: 'user', text: prompt }]);
        setBusy(true);
        const key = localStorage.getItem(KEY_LS) || '';
        try {
            const d = await jpost('/engine/generate', { prompt, currentHtml: html || undefined, key: key || undefined });
            if (d.ok) {
                setHtml(d.html); setTitle(d.title || 'GIS App');
                setMessages((m) => [...m, { role: 'assistant', text: d.summary || ('تمّ بناء «' + (d.title || '') + '».'), done: true }]);
                persist(d.html, d.title || 'GIS App', d.summary || '', prompt);
            } else if (d.reason === 'missing_key') {
                setMessages((m) => [...m, { role: 'assistant', text: 'أضِف مفتاح الـAPI أوّلاً (＋ ← المفتاح).', error: true }]); setKeyModal(true);
            } else {
                setMessages((m) => [...m, { role: 'assistant', text: 'تعذّر: ' + (d.reason || 'غير معروف'), error: true }]);
            }
        } catch { setMessages((m) => [...m, { role: 'assistant', text: 'خطأ في الاتصال.', error: true }]); }
        setBusy(false);
    };

    const onTA = (e) => { setDraft(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 150) + 'px'; };
    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

    const saveKey = () => { const k = keyDraft.trim(); if (k) { localStorage.setItem(KEY_LS, k); setKeyModal(false); setKeyDraft(''); } };
    const exportHtml = () => { if (!html) return; const b = new Blob([html], { type: 'text/html' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = (title || 'app').replace(/\s+/g, '-') + '.html'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 400); };
    const copyLink = () => { if (slug) { try { navigator.clipboard.writeText(window.location.origin + '/pe/' + slug); } catch { /* */ } } };
    const deleteProject = async (e, s) => { e.stopPropagation(); await jdel('/engine/projects/' + s); if (s === slug) newProject(); loadProjects(); };

    const empty = messages.length === 0;

    return (
        <div className="pne2" dir="rtl">
            {/* توهّج برتقاليّ علويّ */}
            <svg className="pne2-fil" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="pneFg" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#ff7a18" stopOpacity="0" />
                        <stop offset="0.35" stopColor="#ff6a12" stopOpacity="0.9" />
                        <stop offset="0.72" stopColor="#ff8a2a" />
                        <stop offset="1" stopColor="#ffd089" />
                    </linearGradient>
                    <filter id="pneGlow" x="-5%" y="-400%" width="110%" height="900%"><feGaussianBlur stdDeviation="4" /></filter>
                </defs>
                <path className="pne2-fil-glow" d="M0 46 Q 260 44 440 41 T 760 33 Q 940 24 1050 17 T 1200 7" stroke="url(#pneFg)" strokeWidth="3" fill="none" filter="url(#pneGlow)" />
                <path className="pne2-fil-core" d="M0 46 Q 260 44 440 41 T 760 33 Q 940 24 1050 17 T 1200 7" stroke="url(#pneFg)" strokeWidth="1.4" fill="none" />
            </svg>

            <div className="pne2-brandmini">PalNovaa Engine</div>

            <main className={'pne2-main' + (empty ? ' empty' : '')}>
                {!empty && (
                    <div className="pne2-stream" ref={chatRef}>
                        {messages.map((m, i) => (
                            <div key={i} className={'pne2-row ' + m.role + (m.error ? ' err' : '')}>
                                <div className="pne2-bubble">
                                    {m.text}
                                    {m.done && (
                                        <div className="pne2-chips">
                                            <button onClick={() => setPreview(true)}>معاينة</button>
                                            {slug && <button onClick={() => window.open('/pe/' + slug, '_blank', 'noopener')}>فتح الرابط</button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {busy && <div className="pne2-row assistant"><div className="pne2-bubble"><span className="pne2-typing"><i /><i /><i /></span></div></div>}
                    </div>
                )}

                {/* شريط الإنشاء — نمط الصورة */}
                <div className="pne2-dock">
                    <div className="pne2-dock-head">{title || 'New chat'}{busy && <span className="pne2-mini-spin" />}</div>
                    <div className="pne2-bar">
                        <div className="pne2-plus-wrap">
                            <button className="pne2-plus" onClick={() => setMenuOpen((v) => !v)} aria-label="القائمة">+</button>
                            {menuOpen && (
                                <>
                                    <div className="pne2-menu-scrim" onClick={() => setMenuOpen(false)} />
                                    <div className="pne2-menu">
                                        <button className="pne2-menu-item" onClick={newProject}>＋ محادثة جديدة</button>
                                        <button className="pne2-menu-item" onClick={() => { setKeyModal(true); setMenuOpen(false); }}>⚙ مفتاح الـAPI</button>
                                        <div className="pne2-menu-sep" />
                                        {projects.length === 0 && <div className="pne2-menu-empty">لا مشاريع</div>}
                                        {projects.map((p) => (
                                            <div key={p.id} className={'pne2-menu-proj' + (p.slug === slug ? ' on' : '')} onClick={() => openProject(p.slug)}>
                                                <span className="pne2-menu-proj-t">{p.title}</span>
                                                <button className="pne2-menu-proj-x" onClick={(e) => deleteProject(e, p.slug)}>×</button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <textarea ref={taRef} className="pne2-input" rows={1} value={draft} onChange={onTA} onKeyDown={onKey}
                            placeholder={html ? 'عدّل التطبيق…' : 'اكتب ما تريد بناءه…'} />

                        <div className="pne2-actions">
                            <button className="pne2-img" disabled={!html} onClick={() => setPreview(true)} aria-label="معاينة" title="معاينة">
                                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="M21 15l-5-5L5 21" /></svg>
                            </button>
                            <button className="pne2-go" disabled={busy || !draft.trim()} onClick={send} aria-label="إرسال">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* المعاينة — اختياريّة، بملء الشاشة */}
            {preview && (
                <div className="pne2-preview">
                    <div className="pne2-prev-bar">
                        <span className="pne2-prev-title">{title || 'Preview'}</span>
                        <div className="pne2-prev-acts">
                            {slug && <button onClick={copyLink}>نسخ الرابط</button>}
                            {slug && <button onClick={() => window.open('/pe/' + slug, '_blank', 'noopener')}>فتح</button>}
                            <button onClick={exportHtml} disabled={!html}>تصدير</button>
                            <button className="pne2-prev-close" onClick={() => setPreview(false)}>✕</button>
                        </div>
                    </div>
                    {html
                        ? <iframe title="preview" sandbox="allow-scripts allow-popups allow-forms allow-modals" srcDoc={html} className="pne2-frame" />
                        : <div className="pne2-prev-empty">لا يوجد تطبيقٌ بعد.</div>}
                </div>
            )}

            {/* مفتاح الـAPI */}
            {keyModal && (
                <div className="pne2-modal" onClick={(e) => { if (e.target === e.currentTarget) setKeyModal(false); }}>
                    <div className="pne2-mbox">
                        <header>API Key <button onClick={() => setKeyModal(false)}>×</button></header>
                        <div className="pne2-mbody">
                            <p>الصق مفتاح الـAPI (OpenRouter / Groq / NVIDIA / Gemini). يُحفَظ في متصفّحك فقط.</p>
                            <input type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-or-… / gsk_… / AIza…" autoComplete="off" />
                        </div>
                        <footer>
                            <button className="pne2-primary" onClick={saveKey}>حفظ</button>
                            <button className="pne2-sec" onClick={() => { localStorage.removeItem(KEY_LS); setKeyModal(false); }}>مسح</button>
                            <button className="pne2-sec" onClick={() => navigate('/map')}>خروج</button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
