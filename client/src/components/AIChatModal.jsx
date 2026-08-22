import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { smartSearchService, shopService, aiService, getImageUrl } from '../services/api';
import './AIChatModal.css';

const AIChatModal = ({ isOpen, onClose, onNavigate, userLocation, onShopClick }) => {
    const { user } = useAuth();

    // UI State
    const [theme, setTheme] = useState(localStorage.getItem('palnovaa-ai-theme') || 'dark');
    const [accent, setAccent] = useState(localStorage.getItem('palnovaa-ai-accent') || '#F5A623');
    const [showSettings, setShowSettings] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [navMode, setNavMode] = useState(false);
    const [navFrom, setNavFrom] = useState('');
    const [navTo, setNavTo] = useState('');
    const [navTransportMode, setNavTransportMode] = useState('driving');
    const [fromSuggestions, setFromSuggestions] = useState([]);
    const [toSuggestions, setToSuggestions] = useState([]);
    const [showNavSuggestions, setShowNavSuggestions] = useState(false);

    // Search & Chat State
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);

    const scrollRef = useRef(null);
    const navTimeoutRef = useRef(null);

    // Initial setup & cleanup
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
            if (navTimeoutRef.current) {
                clearTimeout(navTimeoutRef.current);
            }
        };
    }, []);

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Apply Theme & Accent
    useEffect(() => {
        const applyAccent = (color) => {
            const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
            const root = document.querySelector('.ai-modal-container');
            if (!root) return;
            root.style.setProperty('--primary', color);
            root.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.45)`);
            const lighten = (v) => Math.min(255, Math.round(v + (255 - v) * 0.3));
            const darken = (v) => Math.max(0, Math.round(v * 0.75));
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

    const triggerNavigation = (target, mode = 'driving', customStartLoc = null) => {
        if (navTimeoutRef.current) {
            clearTimeout(navTimeoutRef.current);
        }
        if (onNavigate && target) {
            onNavigate(target, mode, customStartLoc);
        }
    };

    const handleSearch = async (overrideQuery = null) => {
        const activeQuery = overrideQuery || query;
        if (!activeQuery.trim()) return;

        if (navTimeoutRef.current) {
            clearTimeout(navTimeoutRef.current);
        }

        const newHistory = [...chatHistory, { role: 'user', message: activeQuery }];
        setChatHistory(newHistory);
        setQuery('');

        setLoading(true);
        setShowResults(true);

        try {
            const filters = parseQuery(activeQuery);
            let fetchedResults = [];

            try {
                const searchData = await smartSearchService.search({
                    query: filters.shopQuery,
                    productQuery: filters.productQuery,
                    priceMin: filters.priceMin,
                    priceMax: filters.priceMax,
                    priceExact: filters.priceExact
                });
                fetchedResults = searchData.results || [];
            } catch (err) {
                console.warn('Smart search service fallback:', err);
            }

            let replyText = '';
            let aiResp = null;

            try {
                aiResp = await aiService.chat(activeQuery, chatHistory, userLocation, { name: user?.full_name });
                if (aiResp && aiResp.reply) {
                    replyText = aiResp.reply;
                }
            } catch (aiErr) {
                console.warn('AI chat service error:', aiErr);
            }

            // If smart search found nothing, use AI response results if available
            if (fetchedResults.length === 0 && aiResp?.results && aiResp.results.length > 0) {
                fetchedResults = aiResp.results;
            }

            // Normalize coordinates for navigation
            fetchedResults = fetchedResults.map(r => ({
                ...r,
                latitude: r.latitude || r.location?.lat,
                longitude: r.longitude || r.location?.lon
            }));

            // Calculate distances from userLocation if available
            if (userLocation?.latitude && userLocation?.longitude) {
                fetchedResults = fetchedResults.map(r => {
                    if (r.latitude && r.longitude) {
                        const d = calculateDistance(userLocation.latitude, userLocation.longitude, parseFloat(r.latitude), parseFloat(r.longitude));
                        return { ...r, distance: d ? Math.round(d * 1000) : r.distance };
                    }
                    return r;
                });
            }

            setResults(fetchedResults);

            // If no replyText from AI, craft an intelligent friendly message
            if (!replyText) {
                if (fetchedResults.length > 0) {
                    replyText = `عثرت لك على ${fetchedResults.length} من الأماكن والخدمات المطابقة لبحثك:`;
                } else {
                    replyText = `عذراً، لم أجد نتائج مطابقة لـ "${activeQuery}". جرب البحث باسم مكان آخر أو تصنيف معين.`;
                }
            }

            // Auto-Navigation Logic (Like before with prompt countdown and immediate options)
            const qLower = activeQuery.toLowerCase();
            const isAskingForLocation = qLower.includes('وين') || qLower.includes('اين') || qLower.includes('أين') || 
                                       qLower.includes('كيف اروح') || qLower.includes('كيف أروح') || qLower.includes('موقع') || 
                                       qLower.includes('طريق') || qLower.includes('ديلني') || qLower.includes('دلني') || 
                                       qLower.includes('اقرب') || qLower.includes('أقرب') || qLower.includes('وديني') || 
                                       qLower.includes('اذهب') || qLower.includes('أذهب') || qLower.includes('روح') || 
                                       qLower.includes('نروح') || qLower.includes('توجه') || qLower.includes('خذني') || 
                                       qLower.includes('وصلني') || qLower.includes('مسار') || qLower.includes('توجيه');

            const isDriving = qLower.match(/(سيارة|سياره|قيادة|بسيارة|تكسي|تاكسي|سواقة)/);
            const isWalking = qLower.match(/(مشي|سير|اقدام|أقدام|مشيًا|مشيا|رجليه)/);

            if (fetchedResults.length > 0 && (isAskingForLocation || isDriving || isWalking || replyText.includes('يبعد') || aiResp?.type === 'route' || aiResp?.type === 'navigation_options')) {
                const target = fetchedResults[0];
                let mode = 'driving';

                if (isWalking || aiResp?.mode === 'walking') {
                    mode = 'walking';
                } else if (isDriving || aiResp?.mode === 'driving') {
                    mode = 'driving';
                } else if (userLocation && target.latitude && target.longitude) {
                    const distKm = calculateDistance(userLocation.latitude, userLocation.longitude, parseFloat(target.latitude), parseFloat(target.longitude));
                    if (distKm !== null && distKm <= 1.2) {
                        mode = 'walking';
                    }
                }

                const modeLabel = mode === 'walking' ? 'مشياً على الأقدام 🚶' : 'بالسيارة 🚗';
                replyText += `<br/><br/><div style="background: rgba(251, 171, 21, 0.12); border-right: 4px solid #fbab15; padding: 12px; border-radius: 12px; margin-top: 12px; font-weight: bold; color: #fbab15; direction: rtl; text-align: right; line-height: 1.6;">📍 يتم الآن فتح الخريطة لتوجيهك ${modeLabel} إلى "${target.name}"...<br/><small style="font-size: 11px; opacity: 0.85; color: #fff;">يمكنك التبديل أو البدء فوراً عبر الأزرار أدناه.</small></div>`;

                navTimeoutRef.current = setTimeout(() => {
                    triggerNavigation(target, mode);
                }, 2200);
            }

            setChatHistory(prev => [...prev, { role: 'assistant', message: replyText, results: fetchedResults }]);

        } catch (error) {
            console.error('Search error:', error);
            const errorMsg = 'عذراً، واجهت مشكلة أثناء المعالجة. يرجى المحاولة مرة أخرى.';
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

    const handleNavigation = async () => {
        const fromStr = navFrom.trim();
        const toStr = navTo.trim();

        if (!toStr) {
            alert('يرجى تحديد الوجهة (إلى)');
            return;
        }

        setLoading(true);
        try {
            let fromLocation = null;
            if (fromStr && fromStr !== 'موقعي الحالي') {
                const fromData = await smartSearchService.search({ query: fromStr });
                if (fromData.results && fromData.results.length > 0) {
                    fromLocation = fromData.results[0];
                    fromLocation.latitude = fromLocation.latitude || fromLocation.location?.lat;
                    fromLocation.longitude = fromLocation.longitude || fromLocation.location?.lon;
                } else {
                    alert(`لم نتمكن من العثور على موقع "${fromStr}" كنقطة انطلاق.`);
                    setLoading(false);
                    return;
                }
            } else if (userLocation?.latitude && userLocation?.longitude) {
                fromLocation = {
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    name: 'موقعي الحالي'
                };
            }

            // Search for the "to" location
            const toData = await smartSearchService.search({ query: toStr });
            let toLocation = null;
            if (toData.results && toData.results.length > 0) {
                toLocation = toData.results[0];
                toLocation.latitude = toLocation.latitude || toLocation.location?.lat;
                toLocation.longitude = toLocation.longitude || toLocation.location?.lon;
            } else {
                alert(`لم نتمكن من العثور على موقع "${toStr}" كـ وجهة.`);
                setLoading(false);
                return;
            }

            setNavMode(false);
            triggerNavigation(toLocation, navTransportMode, fromLocation);
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء البحث عن المسار.');
        } finally {
            setLoading(false);
        }
    };

    const handleFromChange = async (val) => {
        setNavFrom(val);
        if (val.trim().length > 1 && val !== 'موقعي الحالي') {
            try {
                const data = await smartSearchService.search({ query: val });
                setFromSuggestions(data.results ? data.results.slice(0, 4) : []);
            } catch(e) {}
        } else {
            setFromSuggestions([]);
        }
    };

    const handleToChange = async (val) => {
        setNavTo(val);
        if (val.trim().length > 1) {
            try {
                const data = await smartSearchService.search({ query: val });
                setToSuggestions(data.results ? data.results.slice(0, 5) : []);
            } catch(e) {}
        } else {
            setToSuggestions([]);
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

                <header className="ai-header">
                    <div className="ai-header-right">
                        <div className="ai-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="ai-logo-mark">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div className="ai-logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>المساعد الذكي</span>
                                <small style={{ fontSize: '10px', opacity: 0.6, marginTop: '2px' }}>PalNovaa AI Guide</small>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="ai-icon-btn" onClick={() => setShowSettings(true)} title="تخصيص الواجهة">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                        <button className="ai-icon-btn" onClick={onClose} title="إغلاق">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </header>

                <div className="ai-modal-content">

                    <main className="ai-main-scroll" ref={scrollRef}>
                        {!showResults ? (
                            /* Hero State */
                            <section className="ai-hero hero">
                                <div className="ai-hero-icon" onClick={() => setNavMode(prev => !prev)}>
                                </div>
                                <h1>مرحباً <span className="accent">{user?.full_name || 'صديقي'}</span> 👋</h1>
                                <p>أنا دليلك ومساعدك الذكي في PalNovaa، اسألني عن أي مكان أو خدمة أو مسار وسأوجهك فوراً</p>

                                <div className="ai-search-wrap">
                                    {!navMode ? (
                                        <div className="ai-search-box">
                                            <input
                                                className="ai-search-input"
                                                placeholder="ابحث عن مكان، مطعم، مرفق، أو وجهة (مثل: وديني على مطعم قطنة)..."
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                            />
                                            <button className="ai-tool-btn" onClick={() => setNavMode(true)} title="تحديد مسار مخصص" style={{ width: '46px', height: '46px', borderRadius: '14px', background: 'rgba(245, 166, 35, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', flexShrink: 0 }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px' }}>
                                                    <circle cx="6" cy="19" r="3" />
                                                    <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
                                                    <circle cx="18" cy="5" r="3" />
                                                </svg>
                                            </button>
                                            <button className="ai-send-btn" onClick={() => handleSearch()} title="بحث وإرشاد">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M22 2L11 13" />
                                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="nav-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--surface)', padding: '16px', borderRadius: '24px', border: '1px solid var(--primary)', boxShadow: '0 8px 24px var(--primary-glow)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px' }}>
                                                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                                    </svg>
                                                    تحديد المسار والتوجيه الذكي
                                                </span>
                                                <button onClick={() => setNavMode(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', height: '18px' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                </button>
                                            </div>

                                            {/* From Input */}
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '8px 12px', border: '1px solid var(--border)' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', color: 'var(--text-muted)' }}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                                                    <input 
                                                        type="text" 
                                                        value={navFrom} 
                                                        onChange={(e) => handleFromChange(e.target.value)} 
                                                        placeholder="من: موقعي الحالي أو ابحث عن مكان..." 
                                                        style={{ background: 'none', border: 'none', color: 'white', outline: 'none', flex: 1, fontSize: '14px' }} 
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setNavFrom('موقعي الحالي')}
                                                        style={{ background: 'rgba(251, 171, 21, 0.15)', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                                    >
                                                        📍 موقعي
                                                    </button>
                                                </div>
                                                {fromSuggestions.length > 0 && (
                                                    <div className="ai-suggestions" style={{ marginTop: '8px', marginBottom: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                        {fromSuggestions.map((s, idx) => (
                                                            <span key={idx} className="ai-chip" style={{ cursor: 'pointer', padding: '4px 10px', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px' }} onClick={() => { setNavFrom(s.name); setFromSuggestions([]); }}>{s.name}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* To Input */}
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '8px 12px', border: '1px solid var(--primary)' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px', color: 'var(--primary)' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                    <input 
                                                        type="text" 
                                                        value={navTo} 
                                                        onChange={(e) => handleToChange(e.target.value)} 
                                                        onFocus={() => setShowNavSuggestions(true)} 
                                                        onBlur={() => setTimeout(() => setShowNavSuggestions(false), 200)} 
                                                        placeholder="إلى: أين وجهتك؟ (محل، مرفق، مبنى...)" 
                                                        style={{ background: 'none', border: 'none', color: 'white', outline: 'none', flex: 1, fontSize: '14px' }} 
                                                    />
                                                </div>
                                                {showNavSuggestions && toSuggestions.length > 0 && (
                                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface-solid)', border: '1px solid var(--primary)', borderRadius: '12px', marginTop: '4px', zIndex: 10, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                                        {toSuggestions.map((s, i) => (
                                                            <div key={i} onClick={() => { setNavTo(s.name); setShowNavSuggestions(false); setToSuggestions([]); }} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', color: 'white' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{ width: '16px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                                {s.name} {s.category ? `(${s.category})` : ''}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mode Selector */}
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', marginBottom: '4px' }}>
                                                <button onClick={() => setNavTransportMode('driving')} style={{ flex: 1, padding: '10px', borderRadius: '16px', border: navTransportMode === 'driving' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', background: navTransportMode === 'driving' ? 'rgba(251, 171, 21, 0.15)' : 'rgba(255,255,255,0.05)', color: navTransportMode === 'driving' ? 'var(--primary)' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontWeight: navTransportMode === 'driving' ? 'bold' : 'normal' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                                                    🚗 بالسيارة
                                                </button>
                                                <button onClick={() => setNavTransportMode('walking')} style={{ flex: 1, padding: '10px', borderRadius: '16px', border: navTransportMode === 'walking' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', background: navTransportMode === 'walking' ? 'rgba(251, 171, 21, 0.15)' : 'rgba(255,255,255,0.05)', color: navTransportMode === 'walking' ? 'var(--primary)' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontWeight: navTransportMode === 'walking' ? 'bold' : 'normal' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}><path d="M12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M14 21.999 12 15l-3 4"/><path d="m9 10 2 1 1-3.999L14 10l3-1.999"/></svg>
                                                    🚶 مشياً
                                                </button>
                                            </div>

                                            <button onClick={handleNavigation} style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white', border: 'none', borderRadius: '24px', padding: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px var(--primary-glow)', marginTop: '4px' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '18px' }}><polyline points="9 18 15 12 9 6" /></svg>
                                                ارسم المسار على الخريطة الآن
                                            </button>
                                        </div>
                                    )}

                                </div>

                                <div className="ai-features">
                                    <div className="ai-feature-card" onClick={() => setNavMode(true)} style={{ borderColor: 'var(--primary)', boxShadow: '0 4px 15px rgba(245, 166, 35, 0.15)' }}>
                                        <div className="ai-feature-icon" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: 'white' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                            </svg>
                                        </div>
                                        <h4>ارسم مسار</h4>
                                        <p>تحديد نقطة الانطلاق والوجهة بدقة</p>
                                    </div>

                                    <div className="ai-feature-card" onClick={() => setShowSettings(true)}>
                                        <div className="ai-feature-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                                            </svg>
                                        </div>
                                        <h4>تخصيص الواجهة</h4>
                                        <p>اختر الثيم واللون وطريقة العرض</p>
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
                                                <div className="ai-badge"><span className="ai-badge-dot" />المساعد الذكي</div>
                                                <p className="ai-response-text" dangerouslySetInnerHTML={{ __html: msg.message }} />

                                                {/* Navigation Action Buttons for AI Responses */}
                                                {(idx === chatHistory.length - 1) && msg.results && msg.results.length > 0 && (
                                                    <div className="ai-nav-options" style={{ marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                                                        <button 
                                                            className="ai-nav-btn" 
                                                            onClick={() => triggerNavigation(msg.results[0], 'driving')}
                                                            style={{ background: 'rgba(251, 171, 21, 0.15)', borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 'bold' }}
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                                                                <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
                                                            </svg>
                                                            توجيه بالسيارة 🚗
                                                        </button>
                                                        <button 
                                                            className="ai-nav-btn" 
                                                            onClick={() => triggerNavigation(msg.results[0], 'walking')}
                                                            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                                                        >
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M13 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM6 14l3-3 4-4 3 3 4-2M8.5 22l.5-5 2-4 2 5 .5 5" />
                                                            </svg>
                                                            توجيه مشياً 🚶
                                                        </button>
                                                        {onShopClick && (
                                                            <button 
                                                                className="ai-nav-btn" 
                                                                onClick={() => { if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current); onShopClick(msg.results[0]); }}
                                                                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                                                                </svg>
                                                                التفاصيل
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}

                                {loading && (
                                    <div className="ai-loading-box">
                                        <div className="ai-dots"><span></span><span></span><span></span></div>
                                        <span>جاري البحث وتحليل البيانات وتجهيز المسار...</span>
                                    </div>
                                )}

                                {!loading && results.length > 0 && (
                                    <>
                                        <div className={`ai-results-grid ${viewMode === 'list' ? 'list-view' : ''}`}
                                            style={{ gridTemplateColumns: viewMode === 'list' ? '1fr' : undefined }}>
                                            {results.map(shop => (
                                                <div
                                                    key={shop.id}
                                                    className="ai-place-card"
                                                    onClick={() => {
                                                        if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
                                                        if (onShopClick) onShopClick(shop);
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        overflow: 'hidden',
                                                        borderRadius: '16px',
                                                        border: '1px solid var(--border)',
                                                        background: '#1e293b',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        transition: 'all 0.25s ease',
                                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                                >
                                                     {/* Top Section - Image or Gradient Banner */}
                                                     <div style={{ 
                                                         height: '140px', 
                                                         position: 'relative', 
                                                         background: (shop.profile_picture || shop.result_type === 'facility') ? '#1e293b' : 'linear-gradient(135deg, #f59e0b 0%, #fbab15 100%)', 
                                                         display: 'flex', 
                                                         alignItems: 'center', 
                                                         justifyContent: 'center' 
                                                     }}>
                                                         {/* Rating Badge */}
                                                         {shop.result_type !== 'facility' && (
                                                             <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '14px', fontSize: '13px', color: 'white', fontWeight: 'bold', display: 'flex', gap: '4px', alignItems: 'center', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                                                                 <span style={{ color: '#fbab15' }}>⭐</span> {shop.rating || '4.8'}
                                                             </div>
                                                         )}

                                                         {/* Follow Button / Status */}
                                                         <button
                                                             onClick={(e) => { 
                                                                 e.stopPropagation(); 
                                                                 if (shop.result_type === 'facility') {
                                                                     alert('هذا مرفق جامعي، يمكنك متابعة الجامعة التابع لها من ملفها الشخصي.');
                                                                 } else {
                                                                     handleFollow(shop.id); 
                                                                 }
                                                             }}
                                                             disabled={shop.is_followed && shop.result_type !== 'facility'}
                                                             style={{
                                                                 position: 'absolute', top: '10px', left: '10px',
                                                                 background: shop.is_followed ? 'rgba(251, 171, 21, 0.9)' : 'rgba(0,0,0,0.6)',
                                                                 padding: '4px 10px', borderRadius: '14px', fontSize: '11px', color: 'white', fontWeight: 'bold', border: 'none', cursor: (shop.is_followed && shop.result_type !== 'facility') ? 'default' : 'pointer', backdropFilter: 'blur(4px)', zIndex: 2
                                                             }}
                                                         >
                                                             {shop.is_followed ? 'متابع ✓' : (shop.result_type === 'facility' ? 'مرفق 🏛️' : 'متابعة +')}
                                                         </button>

                                                         {shop.result_type === 'facility' ? (
                                                             <div style={{ fontSize: '60px' }}>🏛️</div>
                                                         ) : (
                                                             shop.profile_picture ? (
                                                                 <img src={getImageUrl(shop.profile_picture)} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                             ) : (
                                                                 <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" style={{ width: '60px', height: '60px' }}>
                                                                     <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                                                                 </svg>
                                                             )
                                                         )}
                                                     </div>

                                                     {/* Bottom Section - Info */}
                                                     <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                         <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 6px 0', color: 'white', textAlign: 'right' }}>{shop.name}</h3>

                                                         <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', justifyContent: 'flex-start' }}>
                                                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '15px', height: '15px' }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                                             {shop.distance ? `يبعد ${Math.round(shop.distance)} م عنك` : (shop.parent_shop_name || (shop.result_type === 'facility' ? 'مبنى جامعي' : 'محل مسجل'))}
                                                         </div>

                                                         {shop.result_type === 'facility' && (
                                                             <div style={{ fontSize: '13px', color: '#fbab15', marginBottom: '10px' }}>
                                                                 📍 {shop.parent_shop_name || 'الحرم الجامعي'}
                                                             </div>
                                                         )}

                                                         {shop.products && shop.products.length > 0 && (
                                                             <div className="ai-place-products" style={{ marginBottom: '14px', paddingTop: '0', borderTop: 'none' }}>
                                                                 {shop.products.slice(0, 3).map(p => (
                                                                     <div
                                                                         key={p.id}
                                                                         className="ai-prod-item"
                                                                         onClick={(e) => { 
                                                                             e.stopPropagation(); 
                                                                             triggerNavigation(shop, 'driving'); 
                                                                         }}
                                                                         style={{
                                                                             display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.2s ease'
                                                                         }}
                                                                         onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251, 171, 21, 0.12)'; e.currentTarget.style.borderColor = 'rgba(251, 171, 21, 0.3)'; }}
                                                                         onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                                                                         title="انقر للتوجه والحصول على مسار"
                                                                     >
                                                                         {p.image_url && viewMode === 'grid' && (
                                                                             <img src={getImageUrl(p.image_url)} alt={p.name} style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }} />
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
                                                         <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', justifyContent: 'flex-start' }}>
                                                             <span style={{ padding: '4px 10px', background: 'rgba(251, 171, 21, 0.15)', color: '#fbab15', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                 {shop.category || (shop.result_type === 'facility' ? 'مرفق جامعي' : 'عام')}
                                                             </span>
                                                             {shop.result_type !== 'facility' && (
                                                                 <span style={{ padding: '4px 10px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                     {shop.is_open !== false ? 'مفتوح الآن' : 'مغلق'}
                                                                 </span>
                                                             )}
                                                         </div>

                                                         {/* Action Navigation Buttons on Each Card */}
                                                         <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                                             <button
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     triggerNavigation(shop, 'driving');
                                                                 }}
                                                                 style={{
                                                                     flex: 1, padding: '8px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                                                                     color: 'white', border: 'none', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                                                 }}
                                                                 title="توجيه بالسيارة"
                                                             >
                                                                 🚗 سيارة
                                                             </button>
                                                             <button
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     triggerNavigation(shop, 'walking');
                                                                 }}
                                                                 style={{
                                                                     flex: 1, padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)',
                                                                     color: 'white', border: '1px solid rgba(255,255,255,0.15)', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                                                 }}
                                                                 title="توجيه مشياً"
                                                             >
                                                                 🚶 مشي
                                                             </button>
                                                             {onShopClick && (
                                                                 <button
                                                                     onClick={(e) => {
                                                                         e.stopPropagation();
                                                                         if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
                                                                         onShopClick(shop);
                                                                     }}
                                                                     style={{
                                                                         padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
                                                                         color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', cursor: 'pointer'
                                                                     }}
                                                                     title="فتح الملف والتفاصيل"
                                                                 >
                                                                     ℹ️
                                                                 </button>
                                                             )}
                                                         </div>
                                                     </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            className="ai-follow-btn"
                                            style={{ marginTop: '30px', width: 'auto', padding: '12px 30px', margin: '30px auto', display: 'block' }}
                                            onClick={() => { 
                                                if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
                                                setShowResults(false); setQuery(''); setChatHistory([]); setResults([]); 
                                            }}
                                        >
                                            ← بدء محادثة جديدة
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
                                    placeholder="اسأل شيئاً آخر أو اطلب توجيهك لمكان آخر..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <button className="ai-send-btn" onClick={() => handleSearch()} title="إرسال">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 2L11 13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <aside className={`ai-settings-panel ${showSettings ? 'active' : ''}`}>
                    <div className="ai-settings-header">
                        <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px' }}>
                                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                            </svg>
                            تخصيص الستايل
                        </h2>
                        <button className="ai-icon-btn" onClick={() => setShowSettings(false)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="ai-settings-body">
                        <div className="ai-settings-group">
                            <div className="ai-settings-title">المظهر</div>
                            <div className="ai-theme-grid">
                                {[
                                    { id: 'dark', name: 'داكن', class: 'ai-p-dark' },
                                    { id: 'light', name: 'فاتح', class: 'ai-p-light' },
                                    { id: 'midnight', name: 'منتصف الليل', class: 'ai-p-midnight' },
                                    { id: 'sunset', name: 'غروب', class: 'ai-p-sunset' }
                                ].map(t => (
                                    <div
                                        key={t.id}
                                        className={`ai-theme-opt ${theme === t.id ? 'active' : ''}`}
                                        onClick={() => changeTheme(t.id)}
                                    >
                                        <div className={`ai-theme-preview ${t.class}`} />
                                        <span style={{ fontSize: '13px' }}>{t.name}</span>
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
                                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                                    </svg>
                                    <span>شبكي</span>
                                </div>
                                <div className={`view-mode ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                    </svg>
                                    <span>قائمة</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    );
};

export default AIChatModal;
