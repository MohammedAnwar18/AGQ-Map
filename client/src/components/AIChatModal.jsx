import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { smartSearchService, shopService, aiService } from '../services/api';
import { getImageUrl } from '../services/api';
import './AIChatModal.css';

// Parse natural language query for price filters
const parseQuery = (text) => {
    const result = { shopQuery: '', productQuery: '', priceMin: '', priceMax: '', priceExact: '' };
    let q = text.trim();

    // Price exact: "بسعر X" or "يساوي X"
    let m = q.match(/(?:بسعر|يساوي|سعره)\s*([\d.]+)/);
    if (m) { result.priceExact = m[1]; q = q.replace(m[0], '').trim(); }

    // Price max: "أقل من X" or "بأقل من X"
    m = q.match(/(?:أقل\s*من|بأقل\s*من|تحت)\s*([\d.]+)/);
    if (m) { result.priceMax = m[1]; q = q.replace(m[0], '').trim(); }

    // Price min: "أكثر من X" or "أغلى من X" or "فوق X"
    m = q.match(/(?:أكثر\s*من|أغلى\s*من|فوق)\s*([\d.]+)/);
    if (m) { result.priceMin = m[1]; q = q.replace(m[0], '').trim(); }

    // Product keywords
    const prodMatch = q.match(/(?:يبيع|يوجد|عنده|فيه|ببيع|بيبيع)\s+(.+)/);
    if (prodMatch) {
        result.productQuery = prodMatch[1].trim();
        q = q.replace(prodMatch[0], '').trim();
    }

    result.shopQuery = q;
    return result;
};

const AIChatModal = ({ onClose }) => {
    const { user } = useAuth();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [aiText, setAiText] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [theme, setThemeState] = useState(() => localStorage.getItem('ai-theme') || 'dark');
    const [accent, setAccentState] = useState(() => localStorage.getItem('ai-accent') || '#F5A623');
    const [showSettings, setShowSettings] = useState(false);
    const inputRef = useRef(null);

    const userName = user?.full_name || user?.username || 'مستخدم';
    const userInitial = userName.charAt(0).toUpperCase();

    useEffect(() => {
        applyTheme(theme);
        applyAccent(accent);
        inputRef.current?.focus();
    }, []);

    const applyTheme = (t) => {
        const el = document.getElementById('ai-modal-root');
        if (!el) return;
        el.setAttribute('data-theme', t);
    };

    const applyAccent = (color) => {
        const el = document.getElementById('ai-modal-root');
        if (!el) return;
        const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
        el.style.setProperty('--primary', color);
        el.style.setProperty('--primary-glow', `rgba(${r},${g},${b},0.4)`);
        el.style.setProperty('--primary-light', `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`);
        el.style.setProperty('--primary-dark', `rgb(${Math.round(r*0.75)},${Math.round(g*0.75)},${Math.round(b*0.75)})`);
    };

    const setTheme = (t) => { setThemeState(t); applyTheme(t); localStorage.setItem('ai-theme', t); };
    const setAccent = (c) => { setAccentState(c); applyAccent(c); localStorage.setItem('ai-accent', c); };

    const handleSearch = useCallback(async (searchText) => {
        const q = searchText || query;
        if (!q.trim()) return;
        setLoading(true);
        setShowResults(true);
        setResults(null);
        setAiText('');

        try {
            // 1. Get structured data results
            const parsed = parseQuery(q);
            const searchData = await smartSearchService.search({
                query: parsed.shopQuery,
                productQuery: parsed.productQuery,
                priceMin: parsed.priceMin,
                priceMax: parsed.priceMax,
                priceExact: parsed.priceExact,
            });
            const found = searchData.results || [];
            setResults(found);

            // 2. Get conversational AI response
            const aiResponse = await aiService.chat(q, [], null, { name: userName });
            
            if (aiResponse && aiResponse.reply) {
                setAiText(aiResponse.reply);
            } else if (found.length > 0) {
                setAiText(`وجدت <strong>${found.length} نتيجة</strong> تطابق بحثك. أفضل نتيجة هي <strong>${found[0].name}</strong>.`);
            } else {
                setAiText(`لم أجد نتائج لـ "${q}". حاول البحث بكلمات مختلفة.`);
            }

        } catch (err) {
            console.error(err);
            setAiText('عذراً، واجهت مشكلة في الاتصال بالمساعد الذكي.');
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [query, userName]);

    const handleFollow = async (shopId) => {
        try {
            await shopService.follow(shopId);
            setResults(prev => prev.map(s => s.id === shopId ? { ...s, is_followed: true } : s));
        } catch (e) {
            console.error(e);
        }
    };

    const chips = [
        { icon: '🍕', label: 'مطاعم' },
        { icon: '☕', label: 'كافيهات' },
        { icon: '💊', label: 'صيدليات' },
        { icon: '👕', label: 'ملابس' },
        { icon: '📱', label: 'إلكترونيات' },
        { icon: '💇', label: 'صالونات' },
    ];

    return (
        <div id="ai-modal-root" data-theme={theme} className="ai-overlay" onClick={onClose}>
            <div className="ai-panel" onClick={e => e.stopPropagation()}>

                {/* BG Orbs */}
                <div className="ai-orb ai-orb-1" />
                <div className="ai-orb ai-orb-2" />

                {/* Header */}
                <header className="ai-header">
                    <button className="ai-icon-btn" onClick={() => setShowSettings(!showSettings)} title="الإعدادات">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                    </button>
                    <div className="ai-logo">
                        <div className="ai-logo-mark">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                <circle cx="12" cy="10" r="3"/>
                            </svg>
                        </div>
                        <div className="ai-logo-text">
                            <span>المساعد الذكي</span>
                            <small>PalNovaa AI</small>
                        </div>
                    </div>
                    <button className="ai-icon-btn" onClick={onClose} title="إغلاق">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </header>

                {/* Main */}
                <main className="ai-main">

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="ai-settings-panel">
                            <div className="ai-settings-title">المظهر</div>
                            <div className="ai-theme-grid">
                                {[
                                    { id: 'dark', label: 'داكن', cls: 'prev-dark' },
                                    { id: 'light', label: 'فاتح', cls: 'prev-light' },
                                    { id: 'midnight', label: 'منتصف الليل', cls: 'prev-midnight' },
                                    { id: 'sunset', label: 'غروب', cls: 'prev-sunset' },
                                ].map(t => (
                                    <div key={t.id} className={`ai-theme-opt${theme === t.id ? ' active' : ''}`} onClick={() => setTheme(t.id)}>
                                        <div className={`ai-theme-prev ${t.cls}`} />
                                        <span>{t.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="ai-settings-title" style={{marginTop:'16px'}}>اللون المميز</div>
                            <div className="ai-accents">
                                {['#F5A623','#FF6B6B','#4ECDC4','#A78BFA','#34D399','#F472B6'].map(c => (
                                    <button key={c} className={`ai-swatch${accent===c?' active':''}`} style={{background:c}} onClick={() => setAccent(c)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hero (initial) */}
                    {!showResults && (
                        <section className="ai-hero">
                            <div className="ai-hero-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                    <path d="M2 17l10 5 10-5"/>
                                    <path d="M2 12l10 5 10-5"/>
                                </svg>
                            </div>
                            <h1>مرحباً <span className="ai-accent">{userName}</span> 👋</h1>
                            <p>ابحث عن أي محل، منتج، أو سعر — أنا أساعدك بكل ذكاء</p>
                            <div className="ai-chips">
                                {chips.map(c => (
                                    <button key={c.label} className="ai-chip" onClick={() => { setQuery(c.label); handleSearch(c.label); }}>
                                        <span>{c.icon}</span> {c.label}
                                    </button>
                                ))}
                            </div>
                            <div className="ai-examples">
                                <p className="ai-example-title">أمثلة على البحث الذكي:</p>
                                {[
                                    'مطعم يبيع شاورما بأقل من 15',
                                    'صيدلية عندها بروتين بسعر 80',
                                    'محل ملابس يبيع جاكيت',
                                ].map(ex => (
                                    <button key={ex} className="ai-example-chip" onClick={() => { setQuery(ex); handleSearch(ex); }}>
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Results */}
                    {showResults && (
                        <section className="ai-results">
                            {/* Query bubble */}
                            <div className="ai-query-bubble">
                                <div className="ai-q-avatar">{userInitial}</div>
                                <div className="ai-q-text">{query}</div>
                            </div>

                            {/* Loading */}
                            {loading && (
                                <div className="ai-loading">
                                    <div className="ai-dots"><span/><span/><span/></div>
                                    <span>المساعد الذكي يبحث لك...</span>
                                </div>
                            )}

                            {/* AI Response */}
                            {!loading && aiText && (
                                <div className="ai-response-card">
                                    <div className="ai-badge"><span className="ai-badge-dot"/>المساعد الذكي</div>
                                    <p className="ai-response-text" dangerouslySetInnerHTML={{ __html: aiText }} />
                                </div>
                            )}

                            {/* Results Grid */}
                            {!loading && results && results.length > 0 && (
                                <div className="ai-results-grid">
                                    {results.map(shop => (
                                        <div key={shop.id} className="ai-shop-card">
                                            <div className="ai-shop-img">
                                                {shop.profile_picture
                                                    ? <img src={getImageUrl(shop.profile_picture)} alt={shop.name} />
                                                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                }
                                                <span className="ai-shop-cat">{shop.category || 'محل'}</span>
                                            </div>
                                            <div className="ai-shop-body">
                                                <div className="ai-shop-top">
                                                    <div>
                                                        <h3>{shop.name}</h3>
                                                        {shop.parent_shop_name && <p className="ai-shop-sub">📍 {shop.parent_shop_name}</p>}
                                                    </div>
                                                    <button
                                                        className={`ai-follow-btn${shop.is_followed ? ' followed' : ''}`}
                                                        onClick={() => handleFollow(shop.id)}
                                                        disabled={shop.is_followed}
                                                    >
                                                        {shop.is_followed ? 'متابَع ✓' : 'متابعة'}
                                                    </button>
                                                </div>

                                                {/* Products */}
                                                {shop.products && shop.products.length > 0 && (
                                                    <div className="ai-products">
                                                        {shop.products.map(p => (
                                                            <div key={p.id} className="ai-product-pill">
                                                                <span className="ai-product-name">{p.name}</span>
                                                                {p.price && <span className="ai-product-price">{parseFloat(p.price).toLocaleString('ar')} ₪</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Back button */}
                            <button className="ai-back-btn" onClick={() => { setShowResults(false); setQuery(''); }}>
                                ← بحث جديد
                            </button>
                        </section>
                    )}
                </main>

                {/* Search Box */}
                <div className="ai-search-area">
                    <div className="ai-search-box">
                        <input
                            ref={inputRef}
                            className="ai-search-input"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="ابحث عن محل، منتج، أو سعر... مثلاً: يبيع هاتف بأقل من 300"
                        />
                        <button className="ai-send-btn" onClick={() => handleSearch()} disabled={loading || !query.trim()}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{transform:'scaleX(-1)'}}>
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AIChatModal;
