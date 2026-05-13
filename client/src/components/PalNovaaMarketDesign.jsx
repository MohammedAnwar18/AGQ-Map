import React, { useState, useEffect } from 'react';

const PalNovaaMarketDesign = ({ onClose, onSelectShop, onSelectUniversity }) => {
    const [activeChip, setActiveChip] = useState('الكل');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const chips = ['الكل','ألوان','خطوط','أنماط تراثية','واجهات Hero','بطاقات المحل','منتجات','أزرار','شارات','دبابيس الخريطة','ستوريز','أيقونات','خلفيات'];

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

    const shops = [
        { name: 'كافيه عتبة', cat: 'قهوة مختصّة', rating: '4.9', dist: '300م', city: 'رام الله', cover: 'linear-gradient(135deg,#E8B547,#C8324A)', open: true },
        { name: 'مكتبة الأمل', cat: 'قرطاسية وكتب', rating: '4.7', dist: '120م', city: 'البيرة', cover: 'linear-gradient(135deg,#3FA7A1,#0B102A)', open: true },
        { name: 'صالون ميرا', cat: 'تجميل وعناية', rating: '4.8', dist: '450م', city: 'نابلس', cover: 'linear-gradient(135deg,#8B1F33,#E8A0B5)', open: false },
        { name: 'زيتون السلطان', cat: 'منتجات طبيعية', rating: '5.0', dist: '2.1كم', city: 'بيت لحم', cover: 'linear-gradient(135deg,#4F5E32,#BDC9B8)', open: true },
        { name: 'Studio 14', cat: 'تصوير وإبداع', rating: '4.6', dist: '800م', city: 'رام الله', cover: 'linear-gradient(135deg,#141A35,#7FA8C9)', open: true },
        { name: 'مخبز نجمة', cat: 'معجنات يومية', rating: '4.9', dist: '50م', city: 'قريب جداً', cover: 'repeating-linear-gradient(45deg,#0B102A 0 10px,#141A35 10px 20px)', open: true },
    ];

    const categories = [
        { icon: '🍽️', label: 'مطاعم' }, { icon: '☕', label: 'مقاهي' }, { icon: '🛒', label: 'سوبرماركت' },
        { icon: '👕', label: 'ملابس' }, { icon: '💊', label: 'صيدلية' }, { icon: '🏦', label: 'بنوك' },
        { icon: '📱', label: 'إلكترونيات' }, { icon: '⚙️', label: 'خدمات' },
    ];

    const st = {
        overlay: { position:'fixed',inset:0,zIndex:99999,background:'#06091C',overflowY:'auto',direction:'rtl',fontFamily:"'Cairo','Inter',sans-serif" },
        header: { position:'sticky',top:0,zIndex:10,background:'rgba(6,9,28,0.95)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(232,181,71,0.15)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' },
        logo: { display:'flex',alignItems:'center',gap:'12px' },
        logoMark: { width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#E8B547,#C8324A)',display:'grid',placeItems:'center',boxShadow:'0 8px 24px rgba(232,181,71,0.3)' },
        logoText: { fontSize:18,fontWeight:900,color:'#F8F4ED' },
        logoSub: { fontSize:10,color:'#8B8772',letterSpacing:'1.5px',textTransform:'uppercase' },
        closeBtn: { width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'none',color:'#F8F4ED',cursor:'pointer',fontSize:16,display:'grid',placeItems:'center' },
        body: { maxWidth:1200,margin:'0 auto',padding:'0 16px 120px' },
        heroSection: { margin:'24px 0',padding:'36px 28px',borderRadius:24,background:'linear-gradient(135deg,#141A35,#0B102A)',border:'1px solid rgba(232,181,71,0.12)',position:'relative',overflow:'hidden' },
        heroTag: { display:'inline-flex',alignItems:'center',gap:8,padding:'6px 14px',background:'rgba(232,181,71,0.1)',border:'1px solid rgba(232,181,71,0.3)',borderRadius:100,fontSize:11,fontWeight:600,color:'#E8B547',letterSpacing:'2px',textTransform:'uppercase',marginBottom:16 },
        heroDot: { width:6,height:6,borderRadius:'50%',background:'#E8B547',boxShadow:'0 0 12px #E8B547' },
        heroTitle: { fontSize:32,fontWeight:900,lineHeight:1.1,background:'linear-gradient(135deg,#F8F4ED 0%,#E8B547 50%,#C8324A 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:12 },
        heroDesc: { color:'#C9C3B0',fontSize:14,lineHeight:1.7,maxWidth:560,marginBottom:24 },
        heroStats: { display:'flex',gap:24,flexWrap:'wrap',marginBottom:24 },
        heroStat: { display:'flex',flexDirection:'column',gap:4 },
        heroStatNum: { fontFamily:"'Space Grotesk'",fontSize:26,fontWeight:700,color:'#E8B547' },
        heroStatLbl: { fontSize:10,color:'#5A5645',letterSpacing:'2px',textTransform:'uppercase' },
        heroBtns: { display:'flex',gap:12,flexWrap:'wrap' },
        btnGold: { padding:'12px 22px',borderRadius:12,background:'#E8B547',color:'#06091C',fontWeight:700,fontSize:14,border:'none',cursor:'pointer',fontFamily:'inherit' },
        btnGhost: { padding:'12px 22px',borderRadius:12,background:'transparent',color:'#F8F4ED',fontWeight:600,fontSize:14,border:'1px solid rgba(232,181,71,0.4)',cursor:'pointer',fontFamily:'inherit' },
        chipsWrap: { display:'flex',gap:8,overflowX:'auto',padding:'20px 0 4px',scrollbarWidth:'none',marginBottom:8 },
        chip: (active) => ({ padding:'8px 16px',background: active ? '#E8B547' : 'rgba(26,33,67,1)',border:`1px solid ${active ? '#E8B547' : 'rgba(232,181,71,0.12)'}`,borderRadius:100,whiteSpace:'nowrap',fontSize:12,fontWeight:600,color: active ? '#06091C' : '#C9C3B0',cursor:'pointer',flexShrink:0 }),
        sectionHead: { display:'flex',alignItems:'flex-end',justifyContent:'space-between',margin:'32px 0 16px' },
        sectionNum: { fontSize:10,color:'#E8B547',fontFamily:"'Space Grotesk'",letterSpacing:'3px',fontWeight:500,display:'block',marginBottom:4 },
        sectionTitle: { fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:'#F8F4ED' },
        sectionCount: { padding:'4px 12px',background:'rgba(26,33,67,1)',border:'1px solid rgba(232,181,71,0.12)',borderRadius:100,color:'#E8B547',fontWeight:600,fontFamily:"'Space Grotesk'",fontSize:12 },
        grid: { display:'grid',gap:12 },
        paletteCard: { background:'rgba(26,33,67,1)',border:'1px solid rgba(232,181,71,0.12)',borderRadius:16,overflow:'hidden',cursor:'pointer' },
        paletteSwatches: { height:80,display:'flex' },
        paletteMeta: { padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center' },
        paletteName: { fontWeight:700,fontSize:13,color:'#F8F4ED' },
        paletteTag: { fontSize:10,color:'#8B8772',letterSpacing:'1px',textTransform:'uppercase',marginTop:2 },
        shopCard: { background:'rgba(26,33,67,1)',border:'1px solid rgba(232,181,71,0.12)',borderRadius:16,overflow:'hidden',cursor:'pointer' },
        shopCover: { height:100,position:'relative',display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:10 },
        shopOpenBadge: (open) => ({ padding:'3px 10px',background: open ? 'rgba(141,164,99,0.95)' : 'rgba(200,50,74,0.95)',color: open ? '#0B102A' : '#fff',fontSize:10,fontWeight:700,borderRadius:100 }),
        shopBody: { padding:'12px 14px' },
        shopName: { fontWeight:700,fontSize:14,color:'#F8F4ED',marginBottom:4 },
        shopCat: { fontSize:11,color:'#8B8772',display:'flex',alignItems:'center',gap:6 },
        shopStats: { display:'flex',justifyContent:'space-between',marginTop:10,paddingTop:10,borderTop:'1px solid rgba(232,181,71,0.1)',fontSize:11,color:'#C9C3B0' },
        fontCard: { background:'rgba(26,33,67,1)',border:'1px solid rgba(232,181,71,0.12)',borderRadius:16,padding:20,cursor:'pointer' },
        catGrid: { display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 },
        catItem: { background:'rgba(26,33,67,1)',border:'1px solid rgba(232,181,71,0.12)',borderRadius:14,padding:'16px 12px',textAlign:'center',cursor:'pointer' },
        catIcon: { fontSize:28,marginBottom:8,display:'block' },
        catLabel: { fontSize:11,fontWeight:600,color:'#C9C3B0' },
        createSection: { position:'sticky',bottom:0,background:'rgba(6,9,28,0.97)',backdropFilter:'blur(20px)',borderTop:'1px solid rgba(232,181,71,0.2)',padding:'16px 20px' },
        createBtns: { display:'flex',gap:12,maxWidth:600,margin:'0 auto' },
        createBtnShop: { flex:1,padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#E8B547,#C8324A)',border:'none',color:'#06091C',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 24px rgba(232,181,71,0.3)' },
        createBtnUni: { flex:1,padding:'14px',borderRadius:14,background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.4)',color:'#60a5fa',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:8 },
    };

    return (
        <div style={st.overlay}>
            {/* Header */}
            <div style={st.header}>
                <div style={st.logo}>
                    <div style={st.logoMark}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#06091C"><path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z"/></svg>
                    </div>
                    <div>
                        <div style={st.logoText}>PalNovaa <span style={{color:'#E8B547'}}>Market</span></div>
                        <div style={st.logoSub}>Design Studio · Edition 01</div>
                    </div>
                </div>
                <button style={st.closeBtn} onClick={onClose}>✕</button>
            </div>

            <div style={st.body}>
                {/* Hero */}
                <div style={st.heroSection}>
                    <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 80% 20%,rgba(232,181,71,0.12),transparent 50%)',pointerEvents:'none'}}/>
                    <div style={{position:'relative'}}>
                        <div style={st.heroTag}><span style={st.heroDot}/> Studio · Edition 01 · 2026</div>
                        <div style={st.heroTitle}>مجرّة تصميم لكل محل على الخريطة</div>
                        <div style={st.heroDesc}>مكتبة هوية بصرية متكاملة — ألوان، خطوط، أنماط، مكوّنات مستوحاة من التراث الفلسطيني. اختر وركّب وحوّل كل محل إلى تجربة تستحق الزيارة.</div>
                        <div style={st.heroStats}>
                            <div style={st.heroStat}><span style={st.heroStatNum}>340+</span><span style={st.heroStatLbl}>عنصر تصميم</span></div>
                            <div style={st.heroStat}><span style={st.heroStatNum}>16</span><span style={st.heroStatLbl}>لوحة ألوان</span></div>
                            <div style={st.heroStat}><span style={st.heroStatNum}>12</span><span style={st.heroStatLbl}>نمط تراثي</span></div>
                        </div>
                        <div style={st.heroBtns}>
                            <button style={st.btnGold} onClick={onSelectShop}>ابدأ بإنشاء محل ←</button>
                            <button style={st.btnGhost} onClick={onSelectUniversity}>إنشاء مؤسسة تعليمية</button>
                        </div>
                    </div>
                </div>

                {/* Chips */}
                <div style={st.chipsWrap}>
                    {chips.map(c => (
                        <button key={c} style={st.chip(activeChip===c)} onClick={()=>setActiveChip(c)}>{c}</button>
                    ))}
                </div>

                {/* Categories */}
                <div style={st.sectionHead}>
                    <div><span style={st.sectionNum}>تصفح حسب الفئة</span><div style={st.sectionTitle}>اختر تصنيف محلك</div></div>
                </div>
                <div style={st.catGrid}>
                    {categories.map(c => (
                        <div key={c.label} style={st.catItem} onClick={onSelectShop}>
                            <span style={st.catIcon}>{c.icon}</span>
                            <div style={st.catLabel}>{c.label}</div>
                        </div>
                    ))}
                </div>

                {/* Color Palettes */}
                <div style={st.sectionHead}>
                    <div><span style={st.sectionNum}>01 · COLOR SYSTEM</span><div style={st.sectionTitle}>لوحات ألوان مُختارة</div></div>
                    <span style={st.sectionCount}>16</span>
                </div>
                <div style={{...st.grid,gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
                    {palettes.map(p => (
                        <div key={p.name} style={st.paletteCard}>
                            <div style={st.paletteSwatches}>
                                {p.colors.map(c => <div key={c} style={{flex:1,background:c}}/>)}
                            </div>
                            <div style={st.paletteMeta}>
                                <div><div style={st.paletteName}>{p.name}</div><div style={st.paletteTag}>{p.tag}</div></div>
                                <div style={{width:28,height:28,borderRadius:8,background:'rgba(232,181,71,0.15)',display:'grid',placeItems:'center',color:'#E8B547',fontSize:14}}>★</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Typography */}
                <div style={st.sectionHead}>
                    <div><span style={st.sectionNum}>02 · TYPOGRAPHY</span><div style={st.sectionTitle}>أزواج خطوط مختارة</div></div>
                    <span style={st.sectionCount}>10</span>
                </div>
                <div style={{...st.grid,gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))'}}>
                    {fonts.map(f => (
                        <div key={f.pair} style={st.fontCard}>
                            <div style={{fontSize:32,fontWeight:800,fontFamily:f.fontFamily,background:'linear-gradient(135deg,#F8F4ED,#E8B547)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:8}}>{f.display}</div>
                            <div style={{color:'#C9C3B0',fontSize:13,lineHeight:1.6,marginBottom:14}}>{f.tag}</div>
                            <div style={{borderTop:'1px dashed rgba(232,181,71,0.15)',paddingTop:12,display:'flex',justifyContent:'space-between',fontSize:11,color:'#8B8772',fontFamily:'monospace'}}>
                                <span style={{color:'#E8B547'}}>{f.pair}</span><span>Display · Body</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Shop Cards */}
                <div style={st.sectionHead}>
                    <div><span style={st.sectionNum}>03 · SHOP CARDS</span><div style={st.sectionTitle}>أمثلة على بطاقات المحلات</div></div>
                    <span style={st.sectionCount}>12</span>
                </div>
                <div style={{...st.grid,gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))'}}>
                    {shops.map(s => (
                        <div key={s.name} style={st.shopCard} onClick={onSelectShop}>
                            <div style={{...st.shopCover,background:s.cover}}>
                                <span style={st.shopOpenBadge(s.open)}>{s.open ? 'مفتوح' : 'مغلق'}</span>
                                <span style={{width:28,height:28,background:'rgba(0,0,0,0.4)',borderRadius:'50%',display:'grid',placeItems:'center',color:'#fff',fontSize:14}}>♡</span>
                            </div>
                            <div style={st.shopBody}>
                                <div style={st.shopName}>{s.name}</div>
                                <div style={st.shopCat}><span style={{width:4,height:4,borderRadius:'50%',background:'#E8B547',display:'inline-block'}}/>{s.cat}</div>
                                <div style={st.shopStats}>
                                    <span><span style={{color:'#E8B547'}}>★</span>{s.rating}</span>
                                    <span>{s.dist}</span>
                                    <span>{s.city}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Patterns preview */}
                <div style={st.sectionHead}>
                    <div><span style={st.sectionNum}>04 · PATTERNS</span><div style={st.sectionTitle}>الأنماط التراثية · تطريز نوفا</div></div>
                    <span style={st.sectionCount}>12</span>
                </div>
                <div style={{...st.grid,gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))'}}>
                    {[
                        {name:'Sunrise',bg:'repeating-conic-gradient(from 0deg at 50% 50%,#0B102A 0deg 10deg,#C8324A 10deg 20deg,#E8B547 20deg 30deg)'},
                        {name:'Diamond',bg:'linear-gradient(45deg,#C8324A 25%,transparent 25.5%) 0 0/20px 20px,linear-gradient(-45deg,#E8B547 25%,transparent 25.5%) 0 0/20px 20px,#0B102A'},
                        {name:'Lattice',bg:'repeating-linear-gradient(0deg,#C8324A 0 4px,transparent 4px 16px),repeating-linear-gradient(90deg,#C8324A 0 4px,transparent 4px 16px),#0B102A'},
                        {name:'Quadrant',bg:'conic-gradient(from 45deg at 50% 50%,#E8B547 0deg 90deg,#0B102A 90deg 180deg,#C8324A 180deg 270deg,#0B102A 270deg 360deg) 0 0/40px 40px'},
                        {name:'Heritage',bg:'repeating-linear-gradient(45deg,#0B102A 0 8px,#8B1F33 8px 12px,#E8B547 12px 14px)'},
                        {name:'Star Wheel',bg:'repeating-conic-gradient(from 0deg at 0 0,#0B102A 0deg 30deg,#E8B547 30deg 60deg,#C8324A 60deg 90deg) 0 0/30px 30px'},
                    ].map(p => (
                        <div key={p.name} style={{aspectRatio:'1',borderRadius:12,overflow:'hidden',border:'1px solid rgba(232,181,71,0.15)',position:'relative',cursor:'pointer',background:p.bg}}>
                            <span style={{position:'absolute',bottom:0,left:0,right:0,padding:'6px 8px',background:'linear-gradient(180deg,transparent,rgba(0,0,0,0.8))',fontSize:10,fontWeight:600,color:'#F8F4ED'}}>{p.name}</span>
                        </div>
                    ))}
                </div>

                <div style={{height:100}}/>
            </div>

            {/* Sticky Create Buttons */}
            <div style={st.createSection}>
                <div style={st.createBtns}>
                    <button style={st.createBtnShop} onClick={onSelectShop}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18v-8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8z"/><path d="M6 6h12v7H6z"/></svg>
                        إنشاء محل / مؤسسة
                    </button>
                    <button style={st.createBtnUni} onClick={onSelectUniversity}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        إنشاء جامعة
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaMarketDesign;
