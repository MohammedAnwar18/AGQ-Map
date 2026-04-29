import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { smartSearchService, shopService, aiService, getImageUrl } from '../services/api';
import './AIChatModal.css';

const AIChatModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    
    // UI State
    const [theme, setTheme] = useState(localStorage.getItem('palnovaa-ai-theme') || 'dark');
    const [accent, setAccent] = useState(localStorage.getItem('palnovaa-ai-accent') || '#F5A623');
    const [showSettings, setShowSettings] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    
    // Search & Chat State
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiText, setAiText] = useState('');
    const [results, setResults] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    
    const scrollRef = useRef(null);

    // Initial setup
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Apply Theme & Accent
    useEffect(() => {
        const applyAccent = (color) => {
            const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
            const root = document.querySelector('.ai-modal-container');
            if (!root) return;
            root.style.setProperty('--primary', color);
            root.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.45)`);
            const lighten = (v) => Math.min(255, Math.round(v + (255-v)*0.3));
            const darken = (v) => Math.max(0, Math.round(v*0.75));
            root.style.setProperty('--primary-light', `rgb(${lighten(r)},${lighten(g)},${lighten(b)})`);
            root.style.setProperty('--primary-dark', `rgb(${darken(r)},${darken(g)},${darken(b)})`);
        };
        applyAccent(accent);
    }, [accent, theme]);

    // Handle Theme Change
    const changeTheme = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('palnovaa-ai-theme', newTheme);
    };

    const changeAccent = (newColor) => {
        setAccent(newColor);
        localStorage.setItem('palnovaa-ai-accent', newColor);
    };

    // Parse natural language for price filters
    const parseQuery = (text) => {
        const result = { shopQuery: '', productQuery: '', priceMin: '', priceMax: '', priceExact: '' };
        let q = text.trim();
        
        const priceRegex = /(بسيار|بسعر|سعر|بكم|بكام)\s*(\d+)/i;
        const match = q.match(priceRegex);
        if (match) {
            result.priceExact = match[2];
            q = q.replace(priceRegex, '').trim();
        }

        const minRegex = /(أكثر من|اكبر من|فوق|من)\s*(\d+)/i;
        const minMatch = q.match(minRegex);
        if (minMatch) {
            result.priceMin = minMatch[2];
            q = q.replace(minMatch, '').trim();
        }

        const maxRegex = /(أقل من|اصغر من|تحت|حتى)\s*(\d+)/i;
        const maxMatch = q.match(maxRegex);
        if (maxMatch) {
            result.priceMax = maxMatch[2];
            q = q.replace(maxMatch, '').trim();
        }

        result.shopQuery = q;
        result.productQuery = q;
        return result;
    };

    const handleSearch = async (overrideQuery = null) => {
        const activeQuery = overrideQuery || query;
        if (!activeQuery.trim()) return;

        setLoading(true);
        setShowResults(true);
        setAiText('');
        setResults([]);

        try {
            const filters = parseQuery(activeQuery);
            const searchData = await smartSearchService.search({
                query: filters.shopQuery,
                productQuery: filters.productQuery,
                priceMin: filters.priceMin,
                priceMax: filters.priceMax,
                priceExact: filters.priceExact
            });
            setResults(searchData.results || []);

            const aiResp = await aiService.chat(activeQuery, chatHistory, null, { name: user?.full_name });
            setAiText(aiResp.reply);

            setChatHistory(prev => [...prev, 
                { role: 'user', message: activeQuery },
                { role: 'assistant', message: aiResp.reply }
            ]);

        } catch (error) {
            console.error('Search error:', error);
            setAiText('عذراً، واجهت مشكلة في الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى.');
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (shopId) => {
        try {
            await shopService.follow(shopId);
            setResults(prev => prev.map(s => s.id === shopId ? { ...s, is_followed: true } : s));
        } catch (error) {
            console.error('Follow error:', error);
        }
    };

    return (
        <div className="ai-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="ai-modal-container" data-theme={theme}>
                
                <div className="ai-bg-canvas" />
                <div className="ai-floating-orb ai-orb-1" />
                <div className="ai-floating-orb ai-orb-2" />

                <div className="ai-modal-content">
                    
                    <header className="ai-header">
                        <div className="ai-header-right">
                            <button className="icon-btn" onClick={() => setShowSettings(true)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                </svg>
                            </button>
                            <div className="ai-logo">
                                <div className="logo-mark">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                </div>
                                <div className="ai-logo-text">
                                    <span>المساعد الذكي</span>
                                    <small style={{display: 'block', fontSize: '10px', opacity: 0.6}}>PalNovaa AI</small>
                                </div>
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <button className="icon-btn" onClick={() => setShowCamera(true)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </svg>
                            </button>
                            <button className="icon-btn" onClick={onClose}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </header>

                    <main className="ai-main-scroll" ref={scrollRef}>
                        {!showResults ? (
                            <section className="ai-hero hero">
                                <div className="hero-icon">
                                </div>
                                <h1>مرحباً <span className="accent">{user?.full_name || 'صديقي'}</span> 👋</h1>
                                <p>أنا مساعدك الذكي في PalNovaa، اسألني عن أي مكان أو منتج أو سعر وسأساعدك بكل سهولة وذكاء</p>

                                <div className="ai-search-wrap">
                                    <div className="ai-search-box">
                                        <input 
                                            className="ai-search-input" 
                                            placeholder="ابحث عن مطاعم، منتجات، أسعار..." 
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <button className="send-btn" onClick={() => handleSearch()}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <line x1="22" y1="2" x2="11" y2="13"/>
                                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="ai-suggestions">
                                        {['مطاعم قريبة', 'كافيهات هادئة', 'أقرب صيدلية', 'عروض اليوم'].map(tag => (
                                            <button key={tag} className="ai-chip" onClick={() => { setQuery(tag); handleSearch(tag); }}>
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="ai-features">
                                    <div className="ai-feature-card" onClick={() => handleSearch('اكتشف حولي')}>
                                        <div className="feature-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                                            </svg>
                                        </div>
                                        <h4>اكتشف حولي</h4>
                                        <p>أماكن مميزة بالقرب منك</p>
                                    </div>
                                    <div className="ai-feature-card" onClick={() => setShowSettings(true)}>
                                        <div className="feature-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                                            </svg>
                                        </div>
                                        <h4>تخصيص الواجهة</h4>
                                        <p>اختر الثيم الذي يناسبك</p>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <section className="ai-results-section">
                                <div className="ai-user-query">
                                    <div className="ai-user-avatar">{user?.full_name?.[0] || 'M'}</div>
                                    <div className="ai-user-text">{query}</div>
                                </div>

                                {loading ? (
                                    <div className="ai-loading-box">
                                        <div className="ai-dots"><span></span><span></span><span></span></div>
                                        <span>جاري البحث والتحليل...</span>
                                    </div>
                                ) : (
                                    <>
                                        {aiText && (
                                            <div className="ai-response-card">
                                                <div className="ai-badge"><span className="ai-badge-dot"/>المساعد الذكي</div>
                                                <p className="ai-response-text" dangerouslySetInnerHTML={{ __html: aiText }} />
                                            </div>
                                        )}

                                        <div className={`ai-results-grid ${viewMode === 'list' ? 'list-view' : ''}`} 
                                             style={{gridTemplateColumns: viewMode === 'list' ? '1fr' : undefined}}>
                                            {results.map(shop => (
                                                <div key={shop.id} className="ai-place-card">
                                                    <div className="ai-place-img">
                                                        {shop.profile_picture 
                                                            ? <img src={getImageUrl(shop.profile_picture)} alt={shop.name} />
                                                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                        }
                                                    </div>
                                                    <div className="ai-place-info">
                                                        <h3>{shop.name}</h3>
                                                        <div className="ai-place-meta">
                                                            <span>📍 {shop.parent_shop_name || shop.category || 'محل'}</span>
                                                        </div>
                                                        
                                                        {shop.products && shop.products.length > 0 && (
                                                            <div className="ai-place-products">
                                                                {shop.products.slice(0, 3).map(p => (
                                                                    <div key={p.id} className="ai-prod-item">
                                                                        <span className="ai-prod-name">{p.name}</span>
                                                                        <span className="ai-prod-price">{p.price} ₪</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <button 
                                                            className={`ai-follow-btn ${shop.is_followed ? 'followed' : ''}`}
                                                            onClick={() => handleFollow(shop.id)}
                                                            disabled={shop.is_followed}
                                                        >
                                                            {shop.is_followed ? 'متابع ✓' : 'متابعة'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button 
                                            className="ai-follow-btn" 
                                            style={{marginTop: '30px', width: 'auto', padding: '12px 30px', margin: '30px auto', display: 'block'}}
                                            onClick={() => { setShowResults(false); setQuery(''); }}
                                        >
                                            ← بحث جديد
                                        </button>
                                    </>
                                )}
                            </section>
                        )}
                    </main>

                    {showResults && (
                        <div className="ai-search-wrap ai-search-wrap-floating">
                            <div className="ai-search-box">
                                <input 
                                    className="ai-search-input" 
                                    placeholder="اسأل شيئاً آخر..." 
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button className="send-btn" onClick={() => handleSearch()}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                        <line x1="22" y1="2" x2="11" y2="13"/>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <aside className={`ai-settings-panel ${showSettings ? 'active' : ''}`}>
                    <div className="ai-settings-header">
                        <h2 style={{fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}>
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                            </svg>
                            تخصيص الستايل
                        </h2>
                        <button className="icon-btn" onClick={() => setShowSettings(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>
                    <div className="ai-settings-body">
                        <div className="ai-settings-group">
                            <div className="ai-settings-title">المظهر</div>
                            <div className="ai-theme-grid">
                                {[
                                    {id: 'dark', name: 'داكن', class: 'ai-p-dark'},
                                    {id: 'light', name: 'فاتح', class: 'ai-p-light'},
                                    {id: 'midnight', name: 'منتصف الليل', class: 'ai-p-midnight'},
                                    {id: 'sunset', name: 'غروب', class: 'ai-p-sunset'}
                                ].map(t => (
                                    <div 
                                        key={t.id} 
                                        className={`ai-theme-opt ${theme === t.id ? 'active' : ''}`}
                                        onClick={() => changeTheme(t.id)}
                                    >
                                        <div className={`ai-theme-preview ${t.class}`} />
                                        <span style={{fontSize: '13px'}}>{t.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="ai-settings-group">
                            <div className="ai-settings-title">اللون المميز</div>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {['#F5A623', '#FF6B6B', '#4ECDC4', '#A78BFA', '#34D399', '#F472B6'].map(color => (
                                    <button 
                                        key={color}
                                        onClick={() => changeAccent(color)}
                                        style={{
                                            width: '36px', height: '36px', borderRadius: '50%', 
                                            background: color, cursor: 'pointer',
                                            border: accent === color ? '3px solid var(--text-primary)' : '2px solid var(--border)',
                                            boxShadow: accent === color ? `0 0 10px ${color}` : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="ai-settings-group">
                            <div className="ai-settings-title">طريقة عرض النتائج</div>
                            <div className="view-modes">
                                <div className={`view-mode ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                                    </svg>
                                    <span>شبكي</span>
                                </div>
                                <div className={`view-mode ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                                    </svg>
                                    <span>قائمة</span>
                                </div>
                                <div className={`view-mode ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                                    </svg>
                                    <span>خريطة</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {showCamera && (
                    <div className="ai-camera-modal">
                        <header className="ai-header" style={{margin: '0'}}>
                            <div className="ai-header-right">
                                <h3 style={{fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}>
                                        <path d="M5 8h14M5 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M5 8V6a2 2 0 0 1 2-2h2M19 8V6a2 2 0 0 0-2-2h-2"/>
                                        <path d="M9 14h6M9 18h4"/>
                                    </svg>
                                    الترجمة الذكية بالكاميرا
                                </h3>
                            </div>
                            <button className="icon-btn" onClick={() => setShowCamera(false)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </header>
                        <div className="ai-camera-view">
                            <div style={{textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px'}}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '60px', marginBottom: '20px', color: 'var(--primary)'}}>
                                    <path d="M5 8h14M5 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M5 8V6a2 2 0 0 1 2-2h2M19 8V6a2 2 0 0 0-2-2h-2"/>
                                    <path d="M9 14h6M9 18h4"/>
                                </svg>
                                <p>وجّه الكاميرا نحو أي نص وسأترجمه فوراً للعربية</p>
                            </div>
                            <div className="scan-frame"><div className="scan-line" /></div>
                        </div>
                        <div style={{padding: '20px', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center'}}>
                            <button className="camera-control-btn" title="معرض">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                            </button>
                            <button className="camera-capture" onClick={() => setShowCamera(false)}></button>
                            <button className="camera-control-btn" title="قلب الكاميرا">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AIChatModal;
