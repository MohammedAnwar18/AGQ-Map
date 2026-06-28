import React, { useState, useEffect, useRef, useCallback } from 'react';
import { studySpaceService } from '../services/api';
import './StudySpace.css';

// ─── مساعدات ────────────────────────────────────────────────────────────────
const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
};

const formatFileSize = (mb) => {
    if (!mb) return '';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${parseFloat(mb).toFixed(1)} MB`;
};

// ─── Hook للسحب (Draggable) ────────────────────────────────────────────────
function useDraggable(initialPos) {
    const [pos, setPos] = useState(initialPos);
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });

    const onMouseDown = useCallback((e) => {
        if (e.target.closest('.ss-no-drag')) return;
        dragging.current = true;
        offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        e.preventDefault();
    }, [pos]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current) return;
            const nx = e.clientX - offset.current.x;
            const ny = e.clientY - offset.current.y;
            setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
        };
        const onUp = () => { dragging.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    return { pos, onMouseDown };
}

// ─── مكون عارض الكتاب القابل للتغيير حجمه ───────────────────────────────────
const BookViewer = ({ book, onClose }) => {
    const [heightPct, setHeightPct] = useState(70); // نسبة % من الشاشة
    const resizing = useRef(false);
    const startY = useRef(0);
    const startH = useRef(0);

    const onResizeStart = (e) => {
        resizing.current = true;
        startY.current = e.clientY;
        startH.current = heightPct;
        e.preventDefault();
    };

    useEffect(() => {
        const onMove = (e) => {
            if (!resizing.current) return;
            const dy = startY.current - e.clientY; // سحب للأعلى = تكبير
            const newH = Math.min(95, Math.max(25, startH.current + (dy / window.innerHeight) * 100));
            setHeightPct(newH);
        };
        const onUp = () => { resizing.current = false; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    return (
        <div className="ss-book-viewer-overlay" style={{ height: `${heightPct}%` }}>
            {/* مقبض تغيير الحجم */}
            <div className="ss-resize-handle" onMouseDown={onResizeStart}>
                <div className="ss-resize-grip" />
                <span className="ss-resize-hint">{Math.round(heightPct)}% من الشاشة — اسحب للأعلى أو الأسفل</span>
            </div>
            {/* شريط عنوان الكتاب */}
            <div className="ss-book-viewer-bar">
                <span className="ss-book-viewer-title">📖 {book.title}</span>
                <button className="ss-panel-close ss-no-drag" onClick={onClose}>✕</button>
            </div>
            {/* iframe الكتاب */}
            <iframe
                src={book.file_url}
                title={book.title}
                className="ss-pdf-iframe"
            />
        </div>
    );
};

// ─── مكون المترجم العائم القابل للسحب ────────────────────────────────────────
const FloatingTranslator = ({ onClose }) => {
    const { pos, onMouseDown } = useDraggable({ x: 120, y: 100 });
    const [inputText, setInputText] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [width, setWidth] = useState(420);
    const [chunkInfo, setChunkInfo] = useState(null); // { total, current }

    const handleTranslate = async () => {
        const text = inputText.trim();
        if (!text) return;
        setLoading(true);
        setResult('');
        // حساب عدد الأجزاء المتوقعة لعرض التقدم
        const estimatedChunks = Math.ceil(text.length / 450);
        setChunkInfo(estimatedChunks > 1 ? { total: estimatedChunks, current: 0 } : null);
        try {
            const translated = await studySpaceService.translate(text);
            setResult(translated);
        } catch (err) {
            // إعادة المحاولة مرة واحدة قبل إظهار الخطأ
            try {
                const shortened = text.slice(0, 1500);
                const translated = await studySpaceService.translate(shortened);
                setResult(translated + (text.length > 1500 ? '\n\n[تمت ترجمة الجزء الأول فقط نظراً لطول النص]' : ''));
            } catch {
                setResult('⚠️ لم تتمكن من الترجمة، يرجى تقصير النص وإعادة المحاولة.');
            }
        } finally {
            setLoading(false);
            setChunkInfo(null);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        navigator.clipboard.writeText(result).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
    };

    const handleKeyDown = (e) => {
        if (e.ctrlKey && e.key === 'Enter') handleTranslate();
    };

    // نسخ نتيجة بشكل منظّم كفقرات
    const formattedResult = result
        ? result.split(/\n+/).filter(p => p.trim()).map((p, i) => (
            <p key={i} className="ss-result-paragraph">{p}</p>
        ))
        : null;

    return (
        <div
            className="ss-floating-translator"
            style={{ left: pos.x, top: pos.y, width: `${width}px` }}
        >
            {/* شريط السحب */}
            <div className="ss-float-drag-bar" onMouseDown={onMouseDown}>
                <div className="ss-float-drag-dots">
                    <span /><span /><span /><span /><span /><span />
                </div>
                <span className="ss-float-title">🌐 مترجم فوري</span>
                <button className="ss-float-close ss-no-drag" onClick={onClose}>✕</button>
            </div>

            {/* جسم المترجم */}
            <div className="ss-float-body ss-no-drag">
                {/* حقل الإدخال */}
                <div className="ss-float-section">
                    <div className="ss-float-section-label">
                        <span>النص الأصلي</span>
                        <span className="ss-char-badge">{inputText.length} حرف</span>
                    </div>
                    <textarea
                        className="ss-float-textarea"
                        placeholder="الصق نص الكتاب هنا... (Ctrl+Enter للترجمة)"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={5}
                        dir="auto"
                    />
                </div>

                {/* زر الترجمة */}
                <button
                    className={`ss-translate-btn ${loading ? 'ss-translate-btn--loading' : ''}`}
                    onClick={handleTranslate}
                    disabled={loading || !inputText.trim()}
                >
                    {loading ? (
                        <div className="ss-translate-progress">
                            <span className="ss-loading-dots"><span /><span /><span /></span>
                            <span className="ss-progress-text">
                                {chunkInfo
                                    ? `جاري ترجمة النص الطويل...`
                                    : 'جاري الترجمة...'}
                            </span>
                        </div>
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="2" y1="12" x2="22" y2="12"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                            ترجمة إلى العربية
                        </>
                    )}
                </button>

                {/* نتيجة الترجمة */}
                {result && (
                    <div className="ss-float-result">
                        <div className="ss-float-result-header">
                            <div className="ss-float-result-label">
                                <span className="ss-result-dot" />
                                الترجمة بالعربية
                            </div>
                            <button
                                className={`ss-copy-btn ${copied ? 'ss-copy-btn--done' : ''}`}
                                onClick={handleCopy}
                            >
                                {copied ? '✓ تم النسخ' : 'نسخ'}
                            </button>
                        </div>
                        <div className="ss-float-result-text" dir="rtl">
                            {formattedResult}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── مكون لوحة المكتبة (الشريط الجانبي) ─────────────────────────────────────
const LibraryPanel = ({ books, loading, user, onBooksChange, onClose, onOpenBook }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({ title: '', author: '', description: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadError, setUploadError] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const fileInputRef = useRef(null);
    const isAdmin = user?.role === 'admin';

    const handleUpload = async () => {
        if (!selectedFile || !uploadForm.title) { setUploadError('عنوان الكتاب وملف PDF مطلوبان'); return; }
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
            setShowUpload(false);
            onBooksChange();
        } catch (err) {
            setUploadError('فشل في رفع الكتاب: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الكتاب؟')) return;
        try { await studySpaceService.deleteBook(id); onBooksChange(); } catch {}
    };

    return (
        <div className="ss-panel-inner">
            <div className="ss-panel-header">
                <h3 className="ss-panel-title">📚 المكتبة</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isAdmin && (
                        <button
                            className={`ss-btn-icon ${showUpload ? 'ss-btn-icon--active' : ''}`}
                            onClick={() => setShowUpload(p => !p)}
                            title="رفع كتاب"
                        >➕</button>
                    )}
                    <button className="ss-panel-close" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Admin: رفع كتاب */}
            {isAdmin && showUpload && (
                <div className="ss-upload-box">
                    <input className="ss-input" placeholder="عنوان الكتاب *" value={uploadForm.title}
                        onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))} />
                    <input className="ss-input" placeholder="اسم المؤلف" value={uploadForm.author}
                        onChange={e => setUploadForm(p => ({ ...p, author: e.target.value }))} />
                    <label className="ss-file-label">
                        {selectedFile ? selectedFile.name : '+ اختر ملف PDF'}
                        <input ref={fileInputRef} type="file" accept=".pdf,image/*" hidden
                            onChange={e => setSelectedFile(e.target.files[0])} />
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
                {!loading && books.length === 0 && <p className="ss-empty">لا توجد كتب بعد</p>}
                {books.map(book => (
                    <div key={book.id} className="ss-book-card">
                        <div className="ss-book-icon">📖</div>
                        <div className="ss-book-info">
                            <p className="ss-book-title">{book.title}</p>
                            {book.author && <p className="ss-book-author">{book.author}</p>}
                            {book.file_size_mb && <p className="ss-book-size">{formatFileSize(book.file_size_mb)}</p>}
                        </div>
                        <div className="ss-book-actions">
                            <button className="ss-btn-open" onClick={() => onOpenBook(book)}>فتح</button>
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
        setSaving(true); setMsg('');
        try {
            await studySpaceService.upsertVideo(form);
            setMsg('✅ تم الحفظ بنجاح');
            onSave();
        } catch (err) {
            setMsg('❌ ' + (err.response?.data?.error || err.message));
        } finally { setSaving(false); }
    };

    return (
        <div className="ss-panel-inner">
            <div className="ss-panel-header">
                <h3 className="ss-panel-title">⚙️ إعداد الفيديوهات</h3>
                <button className="ss-panel-close" onClick={onClose}>✕</button>
            </div>
            <div className="ss-admin-video-body">
                {[{ form: form2, setForm: setForm2, label: '🕐 ساعتان (2h)' },
                  { form: form4, setForm: setForm4, label: '🕓 أربع ساعات (4h)' }].map(({ form, setForm, label }) => (
                    <div key={form.duration_hours} className="ss-admin-video-section">
                        <p className="ss-label">{label}</p>
                        <input className="ss-input" placeholder="رابط يوتيوب..." value={form.youtube_url}
                            onChange={e => setForm(p => ({ ...p, youtube_url: e.target.value }))} />
                        <input className="ss-input" placeholder="عنوان (اختياري)" value={form.title}
                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                        <button className="ss-btn-primary" onClick={() => saveVideo(form)} disabled={saving}>
                            {saving ? 'جاري الحفظ...' : 'حفظ'}
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

    const [phase, setPhase] = useState('select');
    const [selectedDuration, setSelectedDuration] = useState(null);
    const [videos, setVideos] = useState([]);
    const [books, setBooks] = useState([]);
    const [booksLoading, setBooksLoading] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);
    const timerRef = useRef(null);
    const iframeRef = useRef(null);

    // الأدوات المفتوحة
    const [sidePanel, setSidePanel] = useState(null);      // 'library' | 'adminVideo' | null
    const [showTranslator, setShowTranslator] = useState(false);
    const [openBook, setOpenBook] = useState(null);        // الكتاب المفتوح في viewer

    useEffect(() => { loadVideos(); loadBooks(); }, []);

    const loadVideos = async () => {
        try { const d = await studySpaceService.getVideos(); setVideos(d.videos || []); } catch {}
    };

    const loadBooks = async () => {
        setBooksLoading(true);
        try { const d = await studySpaceService.getBooks(); setBooks(d.books || []); } catch {}
        setBooksLoading(false);
    };

    const startStudy = (hours) => {
        const video = videos.find(v => parseFloat(v.duration_hours) === hours);
        setActiveVideoId(video?.video_id || null);
        setSelectedDuration(hours);
        setTimeLeft(hours * 3600 * 1000);
        setTimerRunning(true);
        setPhase('study');
    };

    useEffect(() => {
        if (timerRunning && timeLeft > 0) {
            const startTime = Date.now();
            const initialTimeLeft = timeLeft;
            
            timerRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const nextTimeLeft = Math.max(0, initialTimeLeft - elapsed);
                
                setTimeLeft(nextTimeLeft);
                
                if (nextTimeLeft <= 0) {
                    clearInterval(timerRef.current);
                    setTimerRunning(false);
                }
            }, 50); // Update every 50ms for extremely smooth and precise ticking!
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [timerRunning]);

    const toggleTimer = () => {
        const iframe = iframeRef.current;
        if (timerRunning) {
            setTimerRunning(false);
            iframe?.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        } else {
            setTimerRunning(true);
            iframe?.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        }
    };

    const exitStudy = () => {
        clearInterval(timerRef.current);
        setPhase('select'); setTimerRunning(false);
        setActiveVideoId(null); setSidePanel(null);
        setShowTranslator(false); setOpenBook(null);
    };

    const toggleSidePanel = (panel) => setSidePanel(prev => prev === panel ? null : panel);

    // ── موبايل ────────────────────────────────────────────────────────────────
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

    // ── شاشة الاختيار ────────────────────────────────────────────────────────
    if (phase === 'select') {
        return (
            <div className="ss-select-screen">
                <div className="ss-select-bg" />
                <button className="ss-close-top" onClick={onClose}>✕</button>
                {user?.role === 'admin' && (
                    <button className="ss-admin-gear"
                        onClick={() => setSidePanel(p => p === 'adminVideo' ? null : 'adminVideo')}
                        title="إعداد الفيديوهات">⚙️</button>
                )}
                {sidePanel === 'adminVideo' && (
                    <div className="ss-floating-panel">
                        <AdminVideoPanel videos={videos} onSave={loadVideos} onClose={() => setSidePanel(null)} />
                    </div>
                )}
                <div className="ss-select-content">
                    <div className="ss-select-badge">✦ مساحة دراسة ✦</div>
                    <h1 className="ss-select-title">اختر مدة جلسة الدراسة</h1>
                    <p className="ss-select-sub">سيبدأ الفيديو تلقائياً في الخلفية مع التايمر</p>
                    <div className="ss-duration-cards">
                        <button className="ss-duration-card" onClick={() => startStudy(2)}>
                            <div className="ss-dur-icon">🕐</div>
                            <div className="ss-dur-hours">2</div>
                            <div className="ss-dur-label">ساعتان</div>
                            <div className="ss-dur-sub">{videos.find(v => parseFloat(v.duration_hours) === 2) ? '✓ فيديو متاح' : user?.role === 'admin' ? '⚙️ يحتاج إعداد' : 'جلسة متوسطة'}</div>
                            <div className="ss-dur-glow" />
                        </button>
                        <button className="ss-duration-card ss-duration-card--4h" onClick={() => startStudy(4)}>
                            <div className="ss-dur-icon">🕓</div>
                            <div className="ss-dur-hours">4</div>
                            <div className="ss-dur-label">أربع ساعات</div>
                            <div className="ss-dur-sub">{videos.find(v => parseFloat(v.duration_hours) === 4) ? '✓ فيديو متاح' : user?.role === 'admin' ? '⚙️ يحتاج إعداد' : 'جلسة طويلة'}</div>
                            <div className="ss-dur-glow" />
                        </button>
                    </div>
                    <p className="ss-select-hint">💡 يمكنك إيقاف التايمر أو الخروج في أي وقت</p>
                </div>
            </div>
        );
    }

    // ── شاشة الدراسة ─────────────────────────────────────────────────────────
    return (
        <div className="ss-study-screen">

            {/* الفيديو في الخلفية */}
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

            {/* ══ الشريط العلوي المحسّن ══ */}
            <header className="ss-top-bar">
                {/* اليسار: الخروج */}
                <div className="ss-top-left">
                    <button className="ss-exit-btn" onClick={exitStudy}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        <span>إنهاء الجلسة</span>
                    </button>
                </div>

                {/* الوسط: التايمر */}
                <div className="ss-timer-center">
                    <div className={`ss-timer-block ${!timerRunning ? 'ss-timer-block--paused' : ''} ${timeLeft === 0 ? 'ss-timer-block--done' : ''}`}>
                        <span className="ss-timer-sup">وقت الدراسة المتبقي</span>
                        <div className="ss-timer-row">
                            <span className="ss-timer-value">{formatTime(timeLeft)}</span>
                            <button
                                className={`ss-timer-toggle ${timerRunning ? 'ss-running' : 'ss-paused'}`}
                                onClick={toggleTimer}
                                title={timerRunning ? 'إيقاف مؤقت' : 'استئناف'}
                            >
                                {timerRunning ? (
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <rect x="6" y="4" width="4" height="16"/>
                                        <rect x="14" y="4" width="4" height="16"/>
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                        <polygon points="5,3 19,12 5,21"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                        <span className="ss-timer-sub">من أصل {String(selectedDuration).padStart(2, '0')}:00:00</span>
                    </div>
                </div>

                {/* اليمين */}
                <div className="ss-top-right">
                    <div className="ss-session-badge">
                        {selectedDuration === 2 ? '🕐 جلسة ساعتين' : '🕓 جلسة أربع ساعات'}
                    </div>
                </div>
            </header>

            {/* ══ الشريط الجانبي ══ */}
            <aside className="ss-right-sidebar">
                {/* مكتبة */}
                <button
                    className={`ss-side-icon ${sidePanel === 'library' ? 'ss-side-icon--active' : ''}`}
                    onClick={() => toggleSidePanel('library')}
                    title="المكتبة"
                >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                    <span>مكتبة</span>
                </button>

                {/* مترجم */}
                <button
                    className={`ss-side-icon ${showTranslator ? 'ss-side-icon--active' : ''}`}
                    onClick={() => setShowTranslator(p => !p)}
                    title="المترجم"
                >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span>مترجم</span>
                </button>

                {/* إعداد أدمن */}
                {user?.role === 'admin' && (
                    <button
                        className={`ss-side-icon ${sidePanel === 'adminVideo' ? 'ss-side-icon--active' : ''}`}
                        onClick={() => toggleSidePanel('adminVideo')}
                        title="إعداد الفيديو"
                    >
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        <span>إعداد</span>
                    </button>
                )}
            </aside>

            {/* ══ لوحة الشريط الجانبي ══ */}
            {sidePanel && (
                <div className="ss-panel-drawer">
                    {sidePanel === 'library' && (
                        <LibraryPanel
                            books={books}
                            loading={booksLoading}
                            user={user}
                            onBooksChange={loadBooks}
                            onClose={() => setSidePanel(null)}
                            onOpenBook={(book) => setOpenBook(book)}
                        />
                    )}
                    {sidePanel === 'adminVideo' && (
                        <AdminVideoPanel videos={videos} onSave={loadVideos} onClose={() => setSidePanel(null)} />
                    )}
                </div>
            )}

            {/* ══ عارض الكتاب القابل للتمديد ══ */}
            {openBook && (
                <BookViewer book={openBook} onClose={() => setOpenBook(null)} />
            )}

            {/* ══ المترجم العائم القابل للسحب ══ */}
            {showTranslator && (
                <FloatingTranslator onClose={() => setShowTranslator(false)} />
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
