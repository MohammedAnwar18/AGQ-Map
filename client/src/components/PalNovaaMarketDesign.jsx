import React, { useState, useEffect } from 'react';

const PalNovaaMarketDesign = ({ onClose, onSelectShop, onSelectUniversity, initialDesign }) => {
    const defaultDesign = {
        palette: { name: 'Heritage Nova', colors: ['#0B102A','#8B1F33','#C8324A','#E8B547','#F8F4ED'] },
        font: { display: 'المتجر العتيق', fontFamily: "'Playfair Display',serif", pair: 'Playfair × Cairo' },
        pattern: { name: 'Heritage', bg: 'repeating-linear-gradient(45deg,#0B102A 0 8px,#8B1F33 8px 12px,#E8B547 12px 14px)' },
        category: 'Restaurant',
        shopName: 'محلي المبدع',
        layout: 'modern'
    };

    // Studio State
    const [design, setDesign] = useState(() => {
        if (!initialDesign || Object.keys(initialDesign).length === 0) return defaultDesign;
        return {
            ...defaultDesign,
            ...initialDesign,
            palette: initialDesign.palette || defaultDesign.palette,
            font: initialDesign.font || defaultDesign.font,
            pattern: initialDesign.pattern || defaultDesign.pattern,
            layout: initialDesign.layout || defaultDesign.layout,
        };
    });

    // Removed the initialDesign sync useEffect to prevent the state from reverting 
    // when the parent component re-renders (e.g., from background updates or live data).
    // The initial state is already correctly captured in the useState above.

    const [activeChip, setActiveChip] = useState('الكل');
    const [previewMode, setPreviewMode] = useState('card'); // 'card' or 'profile'

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const palettes = [
        { name: 'Heritage Nova', tag: 'الهوية الأساسية', colors: ['#0B102A','#8B1F33','#C8324A','#E8B547','#F8F4ED'] },
        { name: 'Olive Branch', tag: 'ترابي · طبيعي', colors: ['#141A35','#4F5E32','#8DA463','#BDC9B8','#EFE8D8'] },
        { name: 'Mediterranean', tag: 'منعش · مائي', colors: ['#0B102A','#3FA7A1','#7FA8C9','#BDC9B8','#F8F4ED'] },
        { name: 'Midnight Gold', tag: 'فاخر · رسمي', colors: ['#06091C','#141A35','#222B55','#E8B547','#F4D183'] },
        { name: 'Old Stone', tag: 'حجر القدس', colors: ['#F8F4ED','#EFE8D8','#D4B895','#8B6F47','#3D2817'] },
        { name: 'Sunset Souq', tag: 'دافئ · حيوي', colors: ['#0B102A','#FF6B35','#F7B538','#FFE15D','#FFF8E7'] },
        { name: 'Bouquet', tag: 'بوتيك · أنثوي', colors: ['#1A1A1A','#8B1F33','#E8A0B5','#EFE8D8','#FFFFFF'] },
        { name: 'Neon Bazaar', tag: 'جريء · شبابي', colors: ['#1B1B3A','#693668','#A74482','#F84AA7','#FF8AC5'] },
    ];

    const fonts = [
        { display: 'المتجر العتيق', fontFamily: "'Playfair Display',serif", pair: 'Playfair × Cairo', tag: 'راقي · تراثي' },
        { display: 'NOVA / MARKET', fontFamily: "'Space Grotesk',sans-serif", pair: 'Space Grotesk × Tajawal', tag: 'تقني · حديث' },
        { display: 'حِرفة وتُراث', fontFamily: "'Amiri',serif", pair: 'Amiri × Cairo', tag: 'تراثي · ثقيل' },
        { display: 'FRESH STOP', fontFamily: "'Inter',sans-serif", pair: 'Inter × Cairo', tag: 'نظيف · متعدد' },
    ];

    const patterns = [
        { name: 'Sunrise', bg: 'repeating-conic-gradient(from 0deg at 50% 50%,#0B102A 0deg 10deg,#C8324A 10deg 20deg,#E8B547 20deg 30deg)' },
        { name: 'Diamond', bg: 'linear-gradient(45deg,#C8324A 25%,transparent 25.5%) 0 0/20px 20px,linear-gradient(-45deg,#E8B547 25%,transparent 25.5%) 0 0/20px 20px,#0B102A' },
        { name: 'Lattice', bg: 'repeating-linear-gradient(0deg,#C8324A 0 4px,transparent 4px 16px),repeating-linear-gradient(90deg,#C8324A 0 4px,transparent 4px 16px),#0B102A' },
        { name: 'Quadrant', bg: 'conic-gradient(from 45deg at 50% 50%,#E8B547 0deg 90deg,#0B102A 90deg 180deg,#C8324A 180deg 270deg,#0B102A 270deg 360deg) 0 0/40px 40px' },
        { name: 'Heritage', bg: 'repeating-linear-gradient(45deg,#0B102A 0 8px,#8B1F33 8px 12px,#E8B547 12px 14px)' },
        { name: 'Star Wheel', bg: 'repeating-conic-gradient(from 0deg at 0 0,#0B102A 0deg 30deg,#E8B547 30deg 60deg,#C8324A 60deg 90deg) 0 0/30px 30px' },
    ];

    const categories = [
        { icon: '🍽️', label: 'مطاعم', val: 'Restaurant' }, { icon: '☕', label: 'مقاهي', val: 'Cafe' }, { icon: '🛒', label: 'سوبرماركت', val: 'Supermarket' },
        { icon: '👕', label: 'ملابس', val: 'Clothing' }, { icon: '💊', label: 'صيدلية', val: 'Pharmacy' }, { icon: '🏦', label: 'بنوك', val: 'Bank' },
    ];

    const layouts = [
        { id: 'modern', name: 'عصري (يمين)', desc: 'الصورة عائمة على اليمين', styles: { bottom: '-40px', right: '20px' } },
        { id: 'classic', name: 'كلاسيكي (وسط)', desc: 'الصورة في المنتصف', styles: { bottom: '-40px', left: '50%', transform: 'translateX(-50%)' } },
        { id: 'minimal', name: 'بسيط (يسار)', desc: 'الصورة عائمة على اليسار', styles: { bottom: '-40px', left: '20px' } },
        { id: 'floating', name: 'عائم (مدمج)', desc: 'مدمج داخل الغلاف', styles: { bottom: '15px', right: '20px', border: 'none', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' } }
    ];

    const st = {
        overlay: { position:'fixed',inset:0,zIndex:99999,background:'#06091C',overflowY:'auto',direction:'rtl',fontFamily:"'Cairo', sans-serif" },
        header: { position:'sticky',top:0,zIndex:100,background:'rgba(6,9,28,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(232,181,71,0.15)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' },
        mainLayout: { display: 'flex', minHeight: '100vh', maxWidth: '1400px', margin: '0 auto' },
        sidebar: { flex: '1', padding: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingBottom: '120px' },
        previewContainer: { flex: '0 0 400px', position: 'sticky', top: '70px', height: 'calc(100vh - 70px)', padding: '20px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 50 },
        
        // Components
        sectionTitle: { fontSize: '1.2rem', fontWeight: '800', color: '#F8F4ED', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' },
        card: (active) => ({ 
            background: active ? 'rgba(232,181,71,0.1)' : 'rgba(26,33,67,0.5)', 
            border: `1px solid ${active ? '#E8B547' : 'rgba(232,181,71,0.1)'}`,
            borderRadius: '16px', padding: '12px', cursor: 'pointer', transition: 'all 0.2s ease',
            boxShadow: active ? '0 0 20px rgba(232,181,71,0.15)' : 'none'
        }),
        
        // Live Preview Styles
        mockProfile: {
            background: design.palette?.colors[0] || '#0B102A',
            borderRadius: '24px',
            overflow: 'hidden',
            width: '100%',
            height: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            position: 'relative',
            fontFamily: design.font?.fontFamily
        },
        mockHero: {
            height: '180px',
            background: design.pattern?.bg,
            position: 'relative'
        },
        mockAvatar: () => {
            const layoutStyle = layouts.find(l => l.id === design.layout)?.styles || layouts[0].styles;
            return {
                width: '80px', height: '80px', borderRadius: '20px',
                background: `linear-gradient(135deg, ${design.palette?.colors[3]}, ${design.palette?.colors[2]})`,
                border: `4px solid ${design.palette?.colors[0]}`,
                position: 'absolute',
                display: 'grid', placeItems: 'center', fontSize: '2rem',
                transition: 'all 0.3s ease',
                ...layoutStyle
            };
        },
        mockContent: {
            padding: '50px 20px 20px',
            color: design.palette?.colors[4]
        },
        mockTitle: {
            fontSize: '1.8rem', fontWeight: '900', marginBottom: '4px'
        },
        mockSub: {
            fontSize: '0.9rem', opacity: 0.7, marginBottom: '20px'
        },
        mockButton: {
            padding: '12px', borderRadius: '12px', width: '100%',
            background: design.palette?.colors[3],
            color: design.palette?.colors[0] || '#fff',
            border: 'none', fontWeight: '800', fontSize: '1rem',
            marginTop: '20px', fontFamily: 'inherit'
        }
    };

    const handleApplyDesign = () => {
        // Here we could call onSelectShop with the design tokens
        onSelectShop(design);
    };

    return (
        <div style={st.overlay}>
            {/* Header */}
            <div style={st.header}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#E8B547,#C8324A)', display:'grid', placeItems:'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#06091C"><path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z"/></svg>
                    </div>
                    <div>
                        <div style={{ fontSize:16, fontWeight:900, color:'#F8F4ED' }}>Studio <span style={{color:'#E8B547'}}>Market</span></div>
                        <div style={{ fontSize:9, color:'#8B8772', letterSpacing:1, textTransform:'uppercase' }}>Live Experience Builder</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={{ ...st.mockButton, marginTop: 0, width: 'auto', padding: '8px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={onClose}>خروج</button>
                    <button style={{ ...st.mockButton, marginTop: 0, width: 'auto', padding: '8px 20px' }} onClick={handleApplyDesign}>اعتماد التصميم</button>
                </div>
            </div>

            <div style={st.mainLayout}>
                {/* Builder Sidebar */}
                <div style={st.sidebar}>
                    
                    {/* Step 1: Info */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={st.sectionTitle}><span>01</span> معلومات المحل</div>
                        <input 
                            type="text" 
                            placeholder="اسم المحل..." 
                            value={design.shopName}
                            onChange={(e) => setDesign({...design, shopName: e.target.value})}
                            style={{ width: '100%', padding: '15px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,181,71,0.2)', color: '#fff', fontSize: '1.1rem', marginBottom: '12px' }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            {categories.map(c => (
                                <div key={c.label} style={st.card(design.category === c.val)} onClick={() => setDesign({...design, category: c.val})}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '5px' }}>{c.icon}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#C9C3B0' }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 2: Palettes */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={st.sectionTitle}><span>02</span> لوحة الألوان</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {palettes.map(p => (
                                <div key={p.name} style={st.card(design.palette?.name === p.name)} onClick={() => setDesign({...design, palette: p})}>
                                    <div style={{ display: 'flex', height: '12px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                                        {p.colors.map(c => <div key={c} style={{ flex: 1, background: c }} />)}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#F8F4ED', fontWeight: '700' }}>{p.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#8B8772' }}>{p.tag}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 3: Typography */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={st.sectionTitle}><span>03</span> الخطوط</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {fonts.map(f => (
                                <div key={f.display} style={{ ...st.card(design.font?.display === f.display), padding: '20px' }} onClick={() => setDesign({...design, font: f})}>
                                    <div style={{ fontSize: '1.5rem', fontFamily: f.fontFamily, color: '#F8F4ED', marginBottom: '5px' }}>{f.display}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#E8B547' }}>{f.pair}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 4: Patterns */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={st.sectionTitle}><span>04</span> أنماط Hero التراثية</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            {patterns.map(p => (
                                <div key={p.name} style={{ ...st.card(design.pattern?.name === p.name), height: '80px', background: p.bg, position: 'relative' }} onClick={() => setDesign({...design, pattern: p})}>
                                    <div style={{ position: 'absolute', bottom: 5, left: 5, padding: '2px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', fontSize: '0.7rem', color: '#fff' }}>{p.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Step 5: Layouts */}
                    <div style={{ marginBottom: '40px' }}>
                        <div style={st.sectionTitle}><span>05</span> تنسيق الواجهة (المكان والشكل)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            {layouts.map(l => (
                                <div key={l.id} style={st.card(design.layout === l.id)} onClick={() => setDesign({...design, layout: l.id})}>
                                    <div style={{ fontSize: '0.9rem', color: '#F8F4ED', fontWeight: '700', marginBottom: '4px' }}>{l.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#8B8772' }}>{l.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Live Preview Viewport */}
                <div style={st.previewContainer}>
                    <div style={{ ...st.sectionTitle, marginBottom: 5 }}>Live Preview</div>
                    <div style={{ fontSize: '0.8rem', color: '#8B8772', marginBottom: 15 }}>شاهد التعديلات مباشرة على واجهة المحل</div>
                    
                    {/* The Mockup */}
                    <div style={st.mockProfile}>
                        <div style={st.mockHero}>
                            <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '4px 12px', borderRadius: '100px', fontSize: '0.7rem' }}>Preview Mode</div>
                            <div style={st.mockAvatar()}>
                                {categories.find(c => c.val === design.category)?.icon || '🏪'}
                            </div>
                        </div>
                        <div style={{...st.mockContent, textAlign: design.layout === 'classic' ? 'center' : (design.layout === 'minimal' ? 'left' : 'right')}}>
                            <div style={st.mockTitle}>{design.shopName || 'اسم المحل'}</div>
                            <div style={st.mockSub}>
                                {design.category} · مدينة القدس · <span style={{ color: design.palette?.colors[3] }}>مفتوح الآن</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                <div style={{ flex: 1, height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}></div>
                                <div style={{ flex: 1, height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}></div>
                                <div style={{ flex: 1, height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '100px' }}></div>
                            </div>
 
                            <div style={{ height: '2px', background: `linear-gradient(to left, transparent, ${design.palette?.colors[3] || '#E8B547'}, transparent)`, opacity: 0.3, marginBottom: '20px' }}></div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ width: '60%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '5px' }}></div>
                                        <div style={{ width: '40%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(255,255,255,0.03)' }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ width: '70%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '5px' }}></div>
                                        <div style={{ width: '30%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                    </div>
                                </div>
                            </div>

                            <button style={st.mockButton}>زيارة المحل الافتراضية</button>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(232,181,71,0.05)', border: '1px solid rgba(232,181,71,0.2)', borderRadius: '16px', padding: '15px' }}>
                        <div style={{ fontSize: '0.85rem', color: '#E8B547', fontWeight: 'bold', marginBottom: '5px' }}>💡 معلومة التصميم</div>
                        <div style={{ fontSize: '0.8rem', color: '#8B8772', lineHeight: '1.5' }}>
                            لوحة "{design.palette?.name}" تستخدم تباين عالي مع خط "{design.font?.display}" لخلق هوية بصرية قوية تناسب طابع {design.category}.
                        </div>
                    </div>
                </div>
            </div>

            {/* Float Label */}
            <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 200, display: 'flex', gap: '10px' }}>
                 <div style={{ background: '#0B102A', border: '1px solid #E8B547', color: '#E8B547', padding: '10px 20px', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 'bold', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    Studio Live Engine 0.1
                 </div>
            </div>
        </div>
    );
};

export default PalNovaaMarketDesign;
