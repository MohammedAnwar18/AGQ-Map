import React, { useState, useEffect, useRef } from 'react';
import './HellyAgents.css';

/* ============================================================
   HellyAgents — واجهة محرّك المحاكاة متعدّد الوكلاء (MiroFish)

   المحرّك خدمة Python/Flask مستقلّة تعمل في حاوية Docker خاصّة بها،
   وهذه الصفحة تصله وتعرضه داخل بالنوفا. أبقيناه منفصلاً لسببين:

   • تقني : بالنوفا تطبيق Node يعمل على دوال Vercel قصيرة العمر،
            والمحرّك عملية Python طويلة تُشغّل آلاف الوكلاء لدقائق.
   • قانوني: رخصة المحرّك AGPL-3.0، وهي تُلزم بنشر الشيفرة كاملةً
            لو دُمج داخل التطبيق. وصله كخدمة مستقلّة يتجنّب ذلك.
   ============================================================ */

const STORAGE_KEY = 'helly_agents_url';

// نتحقّق أن العنوان صالح قبل محاولة الوصل
const normalizeUrl = (value) => {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    if (!raw) return '';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    try {
        // eslint-disable-next-line no-new
        new URL(withScheme);
        return withScheme;
    } catch {
        return '';
    }
};

const Icon = {
    Close: (p) => (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    Brain: (p) => (
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="7" cy="7" r="2.6" /><circle cx="17" cy="7" r="2.6" />
            <circle cx="12" cy="17" r="2.6" /><circle cx="12" cy="4.5" r="1.6" />
            <path d="M9.4 8.4 11 15M14.6 8.4 13 15M9.3 6.4h5.4" />
        </svg>
    ),
    Link: (p) => (
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
    ),
    Gear: (p) => (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    ),
    Copy: (p) => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
};

// ── كتلة أوامر قابلة للنسخ ───────────────────────────────────
const Command = ({ children }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* حافظة غير متاحة */ }
    };

    return (
        <div className="hla-cmd">
            <code dir="ltr">{children}</code>
            <button onClick={copy} aria-label="نسخ">
                {copied ? '✓' : <Icon.Copy />}
            </button>
        </div>
    );
};

// ============================================================
const HellyAgents = ({ onClose }) => {
    // الأولوية لمتغيّر البيئة، ثم ما حفظه الأدمن في هذا المتصفح
    const envUrl = normalizeUrl(import.meta.env.VITE_HELLY_AGENTS_URL);
    const [url, setUrl] = useState(() => envUrl || normalizeUrl(localStorage.getItem(STORAGE_KEY)));
    const [draft, setDraft] = useState(url);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [frameError, setFrameError] = useState(false);
    const frameRef = useRef(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const connect = () => {
        const clean = normalizeUrl(draft);
        if (!clean) return;
        localStorage.setItem(STORAGE_KEY, clean);
        setUrl(clean);
        setDraft(clean);
        setFrameError(false);
        setSettingsOpen(false);
    };

    const disconnect = () => {
        localStorage.removeItem(STORAGE_KEY);
        setUrl('');
        setDraft('');
        setSettingsOpen(false);
    };

    const showSetup = !url || settingsOpen;

    return (
        <div className="hla" dir="rtl">
            <header className="hla-top">
                <div className="hla-brand">
                    <span className="hla-brand-mark"><Icon.Brain width="20" height="20" /></span>
                    <div>
                        <b>HellyAgents</b>
                        <span>محاكاة جماعية متعدّدة الوكلاء</span>
                    </div>
                </div>

                <div className="hla-top-actions">
                    {url && (
                        <button
                            className={`hla-icon ${settingsOpen ? 'is-on' : ''}`}
                            onClick={() => setSettingsOpen(o => !o)}
                            title="إعدادات الاتصال"
                        >
                            <Icon.Gear />
                        </button>
                    )}
                    <button className="hla-icon" onClick={onClose} aria-label="إغلاق"><Icon.Close /></button>
                </div>
            </header>

            {/* ── المحرّك موصول: نعرضه ── */}
            {url && !showSetup && !frameError && (
                <iframe
                    ref={frameRef}
                    className="hla-frame"
                    src={url}
                    title="HellyAgents"
                    allow="clipboard-write; fullscreen"
                    onError={() => setFrameError(true)}
                />
            )}

            {/* ── تعذّر العرض داخل الإطار ── */}
            {url && !showSetup && frameError && (
                <div className="hla-body">
                    <div className="hla-card">
                        <span className="hla-card-icon"><Icon.Link /></span>
                        <h3>تعذّر عرض المحرّك داخل الصفحة</h3>
                        <p>قد يمنع المحرّك التضمين. افتحه في تبويب مستقلّ:</p>
                        <a className="hla-btn hla-btn-primary" href={url} target="_blank" rel="noreferrer">
                            فتح HellyAgents في تبويب جديد
                        </a>
                    </div>
                </div>
            )}

            {/* ── الإعداد ── */}
            {showSetup && (
                <div className="hla-body">
                    <div className="hla-setup">

                        <div className="hla-hero">
                            <span className="hla-hero-icon"><Icon.Brain /></span>
                            <h2>اربط محرّك HellyAgents</h2>
                            <p>
                                المحرّك يبني عالماً رقمياً فيه آلاف الوكلاء المستقلّين، لكلٍّ شخصيته وذاكرته،
                                ليختبر سيناريوهات المستقبل قبل تنفيذها على أرض الواقع.
                            </p>
                        </div>

                        {/* عنوان الخدمة */}
                        <div className="hla-block">
                            <h3><span className="hla-step">1</span> عنوان المحرّك</h3>
                            <div className="hla-connect">
                                <input
                                    dir="ltr"
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && connect()}
                                    placeholder="http://localhost:3000"
                                />
                                <button className="hla-btn hla-btn-primary" onClick={connect} disabled={!normalizeUrl(draft)}>
                                    وصل
                                </button>
                            </div>
                            {url && (
                                <button className="hla-unlink" onClick={disconnect}>فصل المحرّك الحالي</button>
                            )}
                            {envUrl && (
                                <p className="hla-tiny">
                                    مضبوط أيضاً في متغيّر البيئة <code dir="ltr">VITE_HELLY_AGENTS_URL</code>.
                                </p>
                            )}
                        </div>

                        {/* التشغيل */}
                        <div className="hla-block">
                            <h3><span className="hla-step">2</span> تشغيل المحرّك</h3>
                            <p className="hla-note">
                                المحرّك تطبيق <b>Python / Flask</b> يعمل في حاوية Docker مستقلّة —
                                لا يمكن تشغيله داخل بالنوفا نفسها لأنها تعمل على دوال Vercel قصيرة العمر،
                                بينما تستغرق المحاكاة دقائق إلى ساعات.
                            </p>

                            <Command>{'git clone https://github.com/666ghj/MiroFish.git'}</Command>
                            <Command>{'cd MiroFish && cp .env.example .env'}</Command>
                            <Command>{'docker compose up -d'}</Command>

                            <p className="hla-note">
                                ثم افتح <code dir="ltr">http://localhost:3000</code> والصقه في الحقل أعلاه.
                                لتشغيله على خادم، ضع عنوانه بدل <code dir="ltr">localhost</code> واحمِه بشهادة HTTPS.
                            </p>
                        </div>

                        {/* المفاتيح */}
                        <div className="hla-block">
                            <h3><span className="hla-step">3</span> المفاتيح المطلوبة</h3>
                            <p className="hla-note">تُوضع في ملف <code dir="ltr">.env</code> داخل مجلّد المحرّك:</p>
                            <ul className="hla-keys">
                                <li><code dir="ltr">LLM_API_KEY</code> + <code dir="ltr">LLM_BASE_URL</code> + <code dir="ltr">LLM_MODEL_NAME</code> — نموذج لغوي بواجهة OpenAI</li>
                                <li><code dir="ltr">ZEP_API_KEY</code> — ذاكرة الوكلاء طويلة الأمد (Zep Cloud)</li>
                                <li><code dir="ltr">LLM_BOOST_*</code> — نموذج أسرع للمهام الخفيفة <em>(اختياري)</em></li>
                            </ul>
                        </div>

                        {/* تنبيه الرخصة */}
                        <div className="hla-warn">
                            <b>ملاحظة عن الرخصة</b>
                            <p>
                                MiroFish مرخّص بـ <b>AGPL-3.0</b>، وهي رخصة تُلزم بنشر الشيفرة المصدرية كاملةً
                                لكل من يستخدم الخدمة عبر الشبكة إن دُمج المشروع داخل تطبيقك.
                                لذلك نصله هنا <b>كخدمة مستقلّة</b> لا كجزء من بالنوفا —
                                هكذا يبقى تطبيقك مملوكاً لك، والمحرّك يعمل بكامل طاقته بجواره.
                            </p>
                            <a
                                className="hla-repolink"
                                href="https://github.com/666ghj/MiroFish"
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Icon.Link /> المستودع الرسمي على GitHub
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HellyAgents;
