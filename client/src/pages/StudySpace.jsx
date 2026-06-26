import React, { useState, useEffect, useRef, useCallback } from 'react';
import { studySpaceService } from '../services/api';
import './StudySpace.css';

// ─── مساعدات ────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatFileSize = (mb) => {
    if (!mb) return '';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${parseFloat(mb).toFixed(1)} MB`;
};

// ─── مكون لوحة المكتبة ───────────────────────────────────────────────────────
const LibraryPanel = ({ books, loading, user, onBooksChange, onClose }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: '', author: '', description: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [openBook, setOpenBook] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef(null);
    const isAdmin = user?.role === 'admin';

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.title) {
            setUploadError('عنوان الكتاب وملف PDF مطلوبان');
            return;
        }
        setUploadError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            fd.append('title', uploadForm.title);
            fd.append('author', uploadForm.author);
            fd.append('description', uploadForm.description);
            await studySpaceService.uploadBook(fd);
            setUploadForm({ title: '', author: '', description: '' });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            onBooksChange();
        } catch (err) {
            setUploadError('فشل في رفع الكتاب: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الكتاب؟')) return;
        try {
            await studySpaceService.deleteBook(id);
            onBooksChange();
        } catch {}
    };

    if (openBook) {
        return (
            <div className="ss-panel-inner">
                <div className="ss-panel-header">
                    <button className="ss-back-btn" onClick={() => setOpenBook(null)}>← رجوع</button>
                    <h3 className="ss-panel-title">{openBook.title}</h3>
                </div>
                <div className="ss-pdf-viewer">
                    <iframe
                        src={openBook.file_url}
                        title={openBook.title}
                        className="ss-pdf-iframe"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="ss-panel-inner">
            <div className="ss-panel-header">
                <h3 className="ss-panel-title">📚 المكتبة</h3>
                <button className="ss-panel-close" onClick={onClose}>✕</button>
            </div>

            {/* Admin: رفع كتاب */}
            {isAdmin && (
                <div className="ss-upload-box">
                    <p className="ss-upload-label">➕ رفع كتاب جديد (أدمن)</p>
                    <input
                        className="ss-input"
                        placeholder="عنوان الكتاب *"
                        value={uploadForm.title}
                        onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))}
                    />
                    <input
                        className="ss-input"
                        placeholder="اسم المؤلف"
                        value={uploadForm.author}
                        onChange={e => setUploadForm(p => ({ ...p, author: e.target.value }))}
                    />
                    <textarea
                        className="ss-input ss-textarea"
                        placeholder="وصف مختصر (اختياري)"
                        rows={2}
                        value={uploadForm.description}
                        onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))}
                    />
                    <label className="ss-file-label">
                        {selectedFile ? selectedFile.name : 'اختر ملف PDF أو صورة'}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,image/*"
                            hidden
                            onChange={e => setSelectedFile(e.target.files[0])}
                        />
                    </label>
                    {uploadError && <p className="ss-error">{uploadError}</p>}
                    <button className="ss-btn-primary" onClick={handleUpload} disabled={uploading}>
                        {uploading ? 'جاري الرفع...' : 'رفع الكتاب'}
                    </button>
                </div>
            )}

            {/* قائمة الكتب */}
            <div className="ss-books-list">
                {loading && <p className="ss-empty">جاري التحميل...</p>}
                {!loading && books.length === 0 && (
                    <p className="ss-empty">لا توجد كتب بعد</p>
                )}
                {books.map(book => (
                    <div key={book.id} className="ss-book-card">
                        <div className="ss-book-icon">📖</div>
                        <div className="ss-book-info">
                            <p className="ss-book-title">{book.title}</p>
                            {book.author && <p className="ss-book-author">{book.author}</p>}
                            {book.file_size_mb && <p className="ss-book-size">{formatFileSize(book.file_size_mb)}</p>}
                        </div>
                        <div className="ss-book-actions">
                            <button className="ss-btn-open" onClick={() => setOpenBook(book)}>فتح</button>
                            {isAdmin && (
                                <button className="ss-btn-delete" onClick={() => handleDelete(book.id)}>🗑</button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── مكون لوحة المترجم ───────────────────────────────────────────────────────
const TranslatorPanel = ({ onClose }) => {
    const [inputText, setInputText] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [charCount, setCharCount] = useState(0);

    const handleTranslate = async () => {
        const text = inputText.trim();
        if (!text) return;
        setLoading(true);
        setResult('');
        try {
            const translated = await studySpaceService.translate(text);
            setResult(translated);
        } catch {
            setResult('⚠️ فشل الترجمة، يرجى المحاولة مرة أخرى');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(result).catch(() => {});
        }
    };

    return (
        <div className="ss-panel-inner">
            <div className="ss-panel-header">
                <h3 className="ss-panel-title">🌐 مترجم إلى العربية</h3>
                <button className="ss-panel-close" onClick={onClose}>✕</button>
            </div>

            <div className="ss-translator-body">
                <label className="ss-label">النص الأصلي</label>
                <textarea
                    className="ss-input ss-translator-textarea"
                    placeholder="الصق نص الكتاب هنا..."
                    value={inputText}
                    onChange={e => {
                        setInputText(e.target.value);
                        setCharCount(e.target.value.length);
                    }}
                    rows={7}
                />
                <div className="ss-char-count">{charCount} حرف</div>

                <button
                    className="ss-btn-primary"
                    onClick={handleTranslate}
                    disabled={loading || !inputText.trim()}
                >
                    {loading ? (
                        <span className="ss-loading-dots"><span /><span /><span /></span>
                    ) : 'ترجمة →'}
                </button>

                {result && (
                    <div className="ss-translation-result">
                        <div className="ss-result-header">
                            <label className="ss-label">الترجمة بالعربية</label>
                            <button className="ss-copy-btn" onClick={handleCopy}>نسخ</button>
                        </div>
                        <div className="ss-result-text">{result}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── مكون نافذة إعداد الأدمن للفيديو ───────────────────────────────────────
const AdminVideoPanel = ({ videos, onSave, onClose }) => {
    const [form2, setForm2] = useState({ youtube_url: '', duration_hours: '2', title: '' });
    const [form4, setForm4] = useState({ youtube_url: '', duration_hours: '4', title: '' });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        const v2 = videos.find(v => parseFloat(v.duration_hours) === 2);
        const v4 = videos.find(v => parseFloat(v.duration_hours) === 4);
        if (v2) setForm2(p => ({ ...p, youtube_url: v2.youtube_url, title: v2.title }));
        if (v4) setForm4(p => ({ ...p, youtube_url: v4.youtube_url, title: v4.title }));
    }, [videos]);

    const saveVideo = async (form) => {
        setSaving(true);
        setMsg('');
        try {
            await studySpaceService.upsertVideo(form);
            setMsg('✅ تم الحفظ بنجاح');
            onSave();
        } catch (err) {
            setMsg('❌ ' + (err.response?.data?.error || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="ss-panel-inner">
            <div className="ss-panel-header">
                <h3 className="ss-panel-title">⚙️ إعداد فيديوهات الدراسة (أدمن)</h3>
                <button className="ss-panel-close" onClick={onClose}>✕</button>
            </div>
            <div className="ss-admin-video-body">
                {[{ form: form2, setForm: setForm2, label: '🕐 ساعتان (2h)' },
                  { form: form4, setForm: setForm4, label: '🕓 أربع ساعات (4h)' }].map(({ form, setForm, label }) => (
                    <div key={form.duration_hours} className="ss-admin-video-section">
                        <p className="ss-label">{label}</p>
                        <input
                            className="ss-input"
                            placeholder="رابط يوتيوب مثال: https://youtu.be/..."
                            value={form.youtube_url}
                            onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))}
                        />
                        <input
                            className="ss-input"
                            placeholder="عنوان الفيديو (اختياري)"
                            value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                        />
                        <button
                            className="ss-btn-primary"
                            onClick={() => saveVideo(form)}
                            disabled={saving}
                        >
                            {saving ? 'جاري الحفظ...' : 'حفظ الفيديو'}
                        </button>
                    </div>
                ))}
                {msg && <p className="ss-msg">{msg}</p>}
            </div>
        </div>
    );
};

// ─── المكون الرئيسي ──────────────────────────────────────────────────────────
export default function StudySpace({ user, onClose }) {
    const isDesktop = !('ontouchstart' in window) && !/Mobi|Android/i.test(navigator.userAgent);

    // ── حالة الصفحات ──────────────────────────────────────────────────────────
    const [phase, setPhase] = useState('select'); // 'select' | 'study'
    const [selectedDuration, setSelectedDuration] = useState(null); // 2 | 4

    // ── الفيديوهات والكتب ─────────────────────────────────────────────────────
    const [videos, setVideos] = useState([]);
    const [books, setBooks] = useState([]);
    const [booksLoading, setBooksLoading] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);

    // ── التايمر ───────────────────────────────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);
    const timerRef = useRef(null);

    // ── الألواح الجانبية ──────────────────────────────────────────────────────
    const [activePanel, setActivePanel] = useState(null); // null | 'library' | 'translator' | 'adminVideo'

    // ── YouTube iframe ref ────────────────────────────────────────────────────
    const playerRef = useRef(null);
    const iframeRef = useRef(null);

    // جلب البيانات عند تحميل المكون
    useEffect(() => {
        loadVideos();
        loadBooks();
    }, []);

    const loadVideos = async () => {
        try {
            const data = await studySpaceService.getVideos();
            setVideos(data.videos || []);
        } catch {}
    };

    const loadBooks = async () => {
        setBooksLoading(true);
        try {
            const data = await studySpaceService.getBooks();
            setBooks(data.books || []);
        } catch {}
        setBooksLoading(false);
    };

    // بدء جلسة الدراسة
    const startStudy = (hours) => {
        const video = videos.find(v => parseFloat(v.duration_hours) === hours);
        if (video) {
            setActiveVideoId(video.video_id);
        } else {
            setActiveVideoId(null);
        }
        setSelectedDuration(hours);
        setTimeLeft(hours * 3600);
        setTimerRunning(true);
        setPhase('study');
    };

    // التايمر
    useEffect(() => {
        if (timerRunning && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        setTimerRunning(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [timerRunning]);

    // إيقاف/استئناف الفيديو مع التايمر
    const toggleTimer = () => {
        const iframe = iframeRef.current;
        if (timerRunning) {
            // إيقاف
            setTimerRunning(false);
            if (iframe) {
                iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            }
        } else {
            // استئناف
            setTimerRunning(true);
            if (iframe) {
                iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            }
        }
    };

    // الخروج من جلسة الدراسة
    const exitStudy = () => {
        clearInterval(timerRef.current);
        setPhase('select');
        setTimerRunning(false);
        setActiveVideoId(null);
        setActivePanel(null);
    };

    const togglePanel = (panel) => {
        setActivePanel(prev => prev === panel ? null : panel);
    };

    // ── الحواسيب فقط ──────────────────────────────────────────────────────────
    if (!isDesktop) {
        return (
            <div className="ss-mobile-block">
                <div className="ss-mobile-block-card">
                    <div className="ss-mobile-block-icon">💻</div>
                    <h3>متاحة على الحاسوب فقط</h3>
                    <p>مساحة الدراسة مصممة للاستخدام على أجهزة الكمبيوتر لتوفير تجربة دراسية مثالية.</p>
                    <button className="ss-btn-primary" onClick={onClose}>العودة</button>
                </div>
            </div>
        );
    }

    // ── شاشة اختيار الوقت ────────────────────────────────────────────────────
    if (phase === 'select') {
        return (
            <div className="ss-select-screen">
                {/* خلفية */}
                <div className="ss-select-bg" />

                {/* زر الإغلاق */}
                <button className="ss-close-top" onClick={onClose}>✕</button>

                {/* إعداد أدمن */}
                {user?.role === 'admin' && (
                    <button
                        className="ss-admin-gear"
                        onClick={() => setActivePanel(activePanel === 'adminVideo' ? null : 'adminVideo')}
                        title="إعداد الفيديوهات"
                    >⚙️</button>
                )}

                {activePanel === 'adminVideo' && (
                    <div className="ss-floating-panel">
                        <AdminVideoPanel videos={videos} onSave={loadVideos} onClose={() => setActivePanel(null)} />
                    </div>
                )}

                <div className="ss-select-content">
                    {/* شعار */}
                    <div className="ss-select-badge">✦ مساحة دراسة ✦</div>
                    <h1 className="ss-select-title">اختر مدة جلسة الدراسة</h1>
                    <p className="ss-select-sub">سيبدأ الفيديو تلقائياً في الخلفية مع التايمر</p>

                    <div className="ss-duration-cards">
                        {/* ساعتان */}
                        <button className="ss-duration-card" onClick={() => startStudy(2)}>
                            <div className="ss-dur-icon">🕐</div>
                            <div className="ss-dur-hours">2</div>
                            <div className="ss-dur-label">ساعتان</div>
                            <div className="ss-dur-sub">
                                {videos.find(v => parseFloat(v.duration_hours) === 2)
                                    ? '✓ فيديو متاح'
                                    : user?.role === 'admin' ? '⚙️ يحتاج إعداد' : 'جلسة متوسطة'}
                            </div>
                            <div className="ss-dur-glow" />
                        </button>

                        {/* أربع ساعات */}
                        <button className="ss-duration-card ss-duration-card--4h" onClick={() => startStudy(4)}>
                            <div className="ss-dur-icon">🕓</div>
                            <div className="ss-dur-hours">4</div>
                            <div className="ss-dur-label">أربع ساعات</div>
                            <div className="ss-dur-sub">
                                {videos.find(v => parseFloat(v.duration_hours) === 4)
                                    ? '✓ فيديو متاح'
                                    : user?.role === 'admin' ? '⚙️ يحتاج إعداد' : 'جلسة طويلة'}
                            </div>
                            <div className="ss-dur-glow" />
                        </button>
                    </div>

                    <p className="ss-select-hint">
                        💡 يمكنك إيقاف التايمر أو الخروج في أي وقت
                    </p>
                </div>
            </div>
        );
    }

    // ── شاشة الدراسة ─────────────────────────────────────────────────────────
    return (
        <div className="ss-study-screen">

            {/* ═══ فيديو الخلفية ═══════════════════════════════════════════════ */}
            {activeVideoId ? (
                <div className="ss-video-bg">
                    <iframe
                        ref={iframeRef}
                        className="ss-yt-iframe"
                        src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&mute=0&controls=0&disablekb=1&loop=1&playlist=${activeVideoId}&rel=0&showinfo=0&modestbranding=1&iv_load_policy=3&enablejsapi=1&origin=${window.location.origin}`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen={false}
                        frameBorder="0"
                        title="study-bg"
                    />
                    <div className="ss-video-overlay" />
                </div>
            ) : (
                <div className="ss-no-video-bg">
                    <div className="ss-no-video-particles">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="ss-particle" style={{ '--i': i }} />
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ الشريط العلوي ══════════════════════════════════════════════ */}
            <header className="ss-top-bar">
                {/* اليسار: الخروج */}
                <div className="ss-top-left">
                    <button className="ss-exit-btn" onClick={exitStudy} title="إنهاء الجلسة">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        <span>إنهاء</span>
                    </button>
                </div>

                {/* الوسط: التايمر */}
                <div className="ss-timer-center">
                    <div className={`ss-timer-display ${!timerRunning ? 'ss-timer-paused' : ''} ${timeLeft === 0 ? 'ss-timer-done' : ''}`}>
                        <span className="ss-timer-label">وقت الدراسة</span>
                        <span className="ss-timer-value">{formatTime(timeLeft)}</span>
                        <span className="ss-timer-total">من {selectedDuration}:00:00</span>
                    </div>
                    <button
                        className={`ss-timer-toggle ${timerRunning ? 'ss-running' : 'ss-paused'}`}
                        onClick={toggleTimer}
                        title={timerRunning ? 'إيقاف مؤقت' : 'استئناف'}
                    >
                        {timerRunning ? (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <polygon points="5,3 19,12 5,21"/>
                            </svg>
                        )}
                    </button>
                </div>

                {/* اليمين: فارغ للتوازن */}
                <div className="ss-top-right">
                    <div className="ss-session-badge">
                        {selectedDuration === 2 ? '🕐 ساعتان' : '🕓 ٤ ساعات'}
                    </div>
                </div>
            </header>

            {/* ═══ الشريط الجانبي الأيمن ══════════════════════════════════════ */}
            <aside className="ss-right-sidebar">
                {/* أيقونة المكتبة */}
                <button
                    className={`ss-side-icon ${activePanel === 'library' ? 'ss-side-icon--active' : ''}`}
                    onClick={() => togglePanel('library')}
                    title="المكتبة"
                >
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span>مكتبة</span>
                </button>

                {/* أيقونة المترجم */}
                <button
                    className={`ss-side-icon ${activePanel === 'translator' ? 'ss-side-icon--active' : ''}`}
                    onClick={() => togglePanel('translator')}
                    title="المترجم"
                >
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span>مترجم</span>
                </button>

                {/* أيقونة إعداد أدمن */}
                {user?.role === 'admin' && (
                    <button
                        className={`ss-side-icon ${activePanel === 'adminVideo' ? 'ss-side-icon--active' : ''}`}
                        onClick={() => togglePanel('adminVideo')}
                        title="إعداد الفيديو"
                    >
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        <span>إعداد</span>
                    </button>
                )}
            </aside>

            {/* ═══ لوحة جانبية منزلقة ════════════════════════════════════════ */}
            {activePanel && (
                <div className="ss-panel-drawer">
                    {activePanel === 'library' && (
                        <LibraryPanel
                            books={books}
                            loading={booksLoading}
                            user={user}
                            onBooksChange={loadBooks}
                            onClose={() => setActivePanel(null)}
                        />
                    )}
                    {activePanel === 'translator' && (
                        <TranslatorPanel onClose={() => setActivePanel(null)} />
                    )}
                    {activePanel === 'adminVideo' && (
                        <AdminVideoPanel
                            videos={videos}
                            onSave={loadVideos}
                            onClose={() => setActivePanel(null)}
                        />
                    )}
                </div>
            )}

            {/* رسالة انتهاء الوقت */}
            {timeLeft === 0 && (
                <div className="ss-done-overlay">
                    <div className="ss-done-card">
                        <div className="ss-done-icon">🎉</div>
                        <h2>أحسنت! انتهت جلسة الدراسة</h2>
                        <p>لقد أكملت جلسة دراسة لمدة {selectedDuration} {selectedDuration === 2 ? 'ساعتين' : 'ساعات'}</p>
                        <button className="ss-btn-primary" onClick={exitStudy}>العودة</button>
                    </div>
                </div>
            )}
        </div>
    );
}
