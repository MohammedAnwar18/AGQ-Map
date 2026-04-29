import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { smartSearchService, shopService, aiService, getImageUrl } from '../services/api';
import './AIChatModal.css';

const AIChatModal = ({ isOpen, onClose, onNavigate, userLocation }) => {
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

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

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

        const newHistory = [...chatHistory, { role: 'user', message: activeQuery }];
        setChatHistory(newHistory);
        setQuery('');
        
        setLoading(true);
        setShowResults(true);

        try {
            const filters = parseQuery(activeQuery);
            const searchData = await smartSearchService.search({
                query: filters.shopQuery,
                productQuery: filters.productQuery,
                priceMin: filters.priceMin,
                priceMax: filters.priceMax,
                priceExact: filters.priceExact
            });
            let fetchedResults = searchData.results || [];

            const aiResp = await aiService.chat(activeQuery, chatHistory, userLocation, { name: user?.full_name });
            let replyText = aiResp.reply;

            // Use AI context results if direct search found nothing
            if (fetchedResults.length === 0 && aiResp.results && aiResp.results.length > 0) {
                fetchedResults = aiResp.results;
            }
            
            setResults(fetchedResults);

            // Auto-Navigation Logic
            const qLower = activeQuery.toLowerCase();
            const isAskingForLocation = qLower.includes('وين') || qLower.includes('اين') || qLower.includes('كيف اروح') || qLower.includes('موقع') || qLower.includes('طريق') || qLower.includes('ديلني') || qLower.includes('اقرب') || qLower.includes('وديني') || qLower.includes('اذهب') || qLower.includes('روح') || qLower.includes('نروح') || qLower.includes('توجه') || qLower.includes('خذني') || qLower.includes('وصلني');
            const isDriving = qLower.match(/(سيارة|سياره|قيادة|بسيارة|تكسي)/);
            const isWalking = qLower.match(/(مشي|سير|اقدام|مشيًا)/);

            if (fetchedResults.length > 0 && (isAskingForLocation || isDriving || isWalking || replyText.includes('يبعد') || aiResp.type === 'route' || aiResp.type === 'navigation_options')) {
                const target = fetchedResults[0];
                let mode = 'driving';
                
                if (isDriving || aiResp.mode === 'driving') {
                    mode = 'driving';
                } else if (isWalking || aiResp.mode === 'walking') {
                    mode = 'walking';
                } else if (userLocation && target.latitude && target.longitude) {
                    const dist = calculateDistance(userLocation.latitude, userLocation.longitude, target.latitude, target.longitude);
                    if (dist !== null && dist <= 1.5) {
                        mode = 'walking';
                    }
                }
                
                const modeText = mode === 'walking' ? 'مشياً على الأقدام 🚶' : 'بالسيارة 🚗';
                replyText += `<br/><br/><div style="background: rgba(var(--primary-rgb), 0.1); border-left: 3px solid var(--primary); padding: 10px; border-radius: 8px; margin-top: 10px; font-weight: bold; color: var(--primary);">يتم الآن فتح الخريطة لتوجيهك ${modeText} إلى ${target.name}...</div>`;
                
                setTimeout(() => {
                    onNavigate(target, mode);
                }, 2000);
            }

            setChatHistory(prev => [...prev, { role: 'assistant', message: replyText, results: fetchedResults }]);

        } catch (error) {
            console.error('Search error:', error);
            const errorMsg = error.response?.data?.error || 'عذراً، واجهت مشكلة في الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى.';
            setChatHistory(prev => [...prev, { role: 'assistant', message: errorMsg }]);
        } finally {
            setLoading(false);
            setTimeout(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            }, 100);
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
                            <div className="ai-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="ai-logo-mark">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                </div>
                                <div className="ai-logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>المساعد الذكي</span>
                                    <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>PalNovaa AI</small>
                                </div>
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '8px'}}>
                            <button className="ai-icon-btn" onClick={onClose}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            </button>
                        </div>
                    </header>

                    <main className="ai-main-scroll" ref={scrollRef}>
                        {!showResults ? (
                            /* Hero State */
                            <section className="ai-hero hero">
                                <div className="ai-hero-icon">
                                </div>
                                <h1>مرحباً <span className="accent">{user?.full_name || 'صديقي'}</span> 👋</h1>
                                <p>أنا مساعدك الذكي في PalNovaa، اسألني عن أي مكان أو منتج وسأساعدك بكل سهولة وذكاء</p>

                                <div className="ai-search-wrap">
                                    <div className="ai-search-box">
                                        <input 
                                            className="ai-search-input" 
                                            placeholder="ابحث عن أي مكان، خدمة، أو وجهة..." 
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <button className="ai-send-btn" onClick={() => handleSearch()}>
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
                                        <div className="ai-feature-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10"/>
                                                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                                            </svg>
                                        </div>
                                        <h4>اكتشف حولي</h4>
                                        <p>أماكن مميزة بالقرب منك</p>
                                    </div>
                                    <div className="ai-feature-card" onClick={() => setShowSettings(true)}>
                                        <div className="ai-feature-icon">
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
                            <section className="ai-results-section" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                
                                {chatHistory.map((msg, idx) => (
                                    <div key={idx} className={msg.role === 'user' ? 'ai-user-query' : 'ai-response-card'}>
                                        {msg.role === 'user' ? (
                                            <>
                                                <div className="ai-user-avatar">{user?.full_name?.[0] || 'M'}</div>
                                                <div className="ai-user-text">{msg.message}</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="ai-badge"><span className="ai-badge-dot"/>المساعد الذكي</div>
                                                <p className="ai-response-text" dangerouslySetInnerHTML={{ __html: msg.message }} />
                                                
                                                {(idx === chatHistory.length - 1) && msg.results && msg.results.length > 0 && !msg.message.includes('يتم الآن فتح الخريطة') && (
                                                    <div className="ai-nav-options" style={{marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px'}}>
                                                        <button className="ai-nav-btn" onClick={() => onNavigate(msg.results[0], 'walking')}>
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M13 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM6 14l3-3 4-4 3 3 4-2M8.5 22l.5-5 2-4 2 5 .5 5"/>
                                                            </svg>
                                                            مشي
                                                        </button>
                                                        <button className="ai-nav-btn" onClick={() => onNavigate(msg.results[0], 'driving')}>
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                                                                <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
                                                            </svg>
                                                            سيارة
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="ai-loading-box">
                                        <div className="ai-dots"><span></span><span></span><span></span></div>
                                        <span>جاري البحث والتحليل...</span>
                                    </div>
                                )}

                                        {!loading && results.length > 0 && (
                                            <>
                                                <div className={`ai-results-grid ${viewMode === 'list' ? 'list-view' : ''}`} 
                                                     style={{gridTemplateColumns: viewMode === 'list' ? '1fr' : undefined}}>
                                                    {results.map(shop => (
                                                        <div 
                                                            key={shop.id} 
                                                            className="ai-place-card"
                                                            onClick={() => onShopClick && onShopClick(shop)}
                                                            style={{ 
                                                                cursor: 'pointer', 
                                                                overflow: 'hidden', 
                                                                borderRadius: '16px', 
                                                                border: '1px solid var(--border)', 
                                                                background: '#1e293b', 
                                                                display: 'flex', 
                                                                flexDirection: 'column',
                                                                transition: 'transform 0.2s',
                                                                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                                        >
                                                            {/* Top Section - Image or Orange Gradient */}
                                                            <div style={{ height: '140px', position: 'relative', background: shop.profile_picture ? '#1e293b' : 'linear-gradient(135deg, #f59e0b 0%, #fbab15 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {/* Rating Badge */}
                                                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '14px', fontSize: '13px', color: 'white', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                                                                    <span style={{ color: '#fbab15' }}>⭐</span> {shop.rating || '4.8'}
                                                                </div>

                                                                {/* Follow Button / Status */}
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleFollow(shop.id); }}
                                                                    disabled={shop.is_followed}
                                                                    style={{
                                                                        position: 'absolute', top: '10px', left: '10px',
                                                                        background: shop.is_followed ? 'rgba(251, 171, 21, 0.9)' : 'rgba(0,0,0,0.5)',
                                                                        padding: '4px 10px', borderRadius: '14px', fontSize: '11px', color: 'white', fontWeight: 'bold', border: 'none', cursor: shop.is_followed ? 'default' : 'pointer', backdropFilter: 'blur(4px)', zIndex: 2
                                                                    }}
                                                                >
                                                                    {shop.is_followed ? 'متابع ✓' : 'متابعة +'}
                                                                </button>

                                                                {shop.profile_picture ? (
                                                                    <img src={getImageUrl(shop.profile_picture)} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" style={{width: '60px', height: '60px'}}>
                                                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                                                    </svg>
                                                                )}
                                                            </div>

                                                            {/* Bottom Section - Info */}
                                                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                                <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 6px 0', color: 'white', textAlign: 'right' }}>{shop.name}</h3>
                                                                
                                                                <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', justifyContent: 'flex-start' }}>
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'15px', height:'15px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                                    {shop.distance ? `${Math.round(shop.distance)} م عنك` : (shop.parent_shop_name || 'محل')}
                                                                </div>

                                                                {shop.products && shop.products.length > 0 && (
                                                                    <div className="ai-place-products" style={{ marginBottom: '16px', paddingTop: '0', borderTop: 'none' }}>
                                                                        {shop.products.slice(0, 3).map(p => (
                                                                            <div 
                                                                                key={p.id} 
                                                                                className="ai-prod-item" 
                                                                                onClick={(e) => { e.stopPropagation(); onNavigate(shop, 'driving'); }}
                                                                                style={{ 
                                                                                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '8px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s ease'
                                                                                }}
                                                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251, 171, 21, 0.1)'; e.currentTarget.style.borderColor = 'rgba(251, 171, 21, 0.3)'; }}
                                                                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                                                                                title="انقر للحصول على مسار لهذا المنتج"
                                                                            >
                                                                                {p.image_url && viewMode === 'grid' && (
                                                                                    <img src={getImageUrl(p.image_url)} alt={p.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                                                                                )}
                                                                                <div style={{ flex: 1, display: 'flex', flexDirection: viewMode === 'grid' ? 'column' : 'row', justifyContent: viewMode === 'list' ? 'space-between' : 'center', alignItems: viewMode === 'list' ? 'center' : 'flex-start', gap: '4px' }}>
                                                                                    <span className="ai-prod-name" style={{ color: 'white', fontWeight: '500' }}>{p.name}</span>
                                                                                    <span className="ai-prod-price" style={{ color: '#fbab15', fontWeight: 'bold' }}>{p.price} ₪</span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Tags Array */}
                                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto', justifyContent: 'flex-start' }}>
                                                                    {shop.category && (
                                                                        <span style={{ padding: '6px 12px', background: 'rgba(251, 171, 21, 0.15)', color: '#fbab15', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                                                            {shop.category}
                                                                        </span>
                                                                    )}
                                                                    <span style={{ padding: '6px 12px', background: 'rgba(251, 171, 21, 0.15)', color: '#fbab15', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                                                                        {shop.is_open !== false ? 'مفتوح الآن' : 'مغلق'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button 
                                                    className="ai-follow-btn" 
                                                    style={{marginTop: '30px', width: 'auto', padding: '12px 30px', margin: '30px auto', display: 'block'}}
                                                    onClick={() => { setShowResults(false); setQuery(''); setChatHistory([]); setResults([]); }}
                                                >
                                                    ← محادثة جديدة
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
                                <button className="ai-send-btn" onClick={() => handleSearch()}>
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
                        <button className="ai-icon-btn" onClick={() => setShowSettings(false)}>
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
                            <button className="ai-icon-btn" onClick={() => setShowCamera(false)}>
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
                            <div className="ai-scan-frame"><div className="ai-scan-line" /></div>
                        </div>
                        <div style={{padding: '20px', display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center'}}>
                            <button className="ai-camera-control-btn" title="معرض">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                            </button>
                            <button className="ai-camera-capture" onClick={() => setShowCamera(false)}></button>
                            <button className="ai-camera-control-btn" title="قلب الكاميرا">
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
