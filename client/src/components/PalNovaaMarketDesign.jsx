import React, { useState, useEffect, useMemo } from 'react';

const PalNovaaMarketDesign = ({ onClose, onSelectShop, onSelectUniversity, initialDesign }) => {
    const defaultDesign = {
        palette: { 
            name: 'Heritage Nova', 
            colors: ['#0B102A','#8B1F33','#C8324A','#E8B547','#F8F4ED'],
            custom: false
        },
        font: { display: 'المتجر العتيق', fontFamily: "'Playfair Display', serif", pair: 'Playfair × Cairo' },
        pattern: { name: 'Heritage', bg: 'repeating-linear-gradient(45deg,#0B102A 0 8px,#8B1F33 8px 12px,#E8B547 12px 14px)' },
        category: 'Restaurant',
        shopName: 'محلي المبدع',
        layout: 'modern',
        menu_layout: 'default',
        avatar_shape: 'circle', // circle, rounded, hexagon, diamond, shield
        avatar_glow: true,
        music_enabled: false,
        music_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        music_title: 'دندنة عود تراثية (Oud)',
        noticeboard_enabled: false,
        noticeboard_text: 'أهلاً بكم في متجرنا! ترقبوا أقوى العروض قريباً.',
        noticeboard_icon: '📢',
        noticeboard_type: 'static', // static, marquee
        card_glow: false,
        border_radius: '16px',
        // Quantum Leap visual fields
        particles_effect: 'none', // none, sparkles, confetti, leaves, bubbles, matrix
        hover_animation: 'scale-up', // scale-up, glow-pulse, glitch-tilt, none
        border_style: 'solid', // solid, double, embroidered, neon, gold-lux
        glass_blur: '8px',
        contact_fab_enabled: false,
        contact_whatsapp: '',
        contact_phone: '',
        contact_instagram: '',
        custom_css: ''
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
            menu_layout: initialDesign.menu_layout || defaultDesign.menu_layout,
            avatar_shape: initialDesign.avatar_shape || defaultDesign.avatar_shape,
            avatar_glow: initialDesign.avatar_glow !== undefined ? initialDesign.avatar_glow : defaultDesign.avatar_glow,
            music_enabled: initialDesign.music_enabled !== undefined ? initialDesign.music_enabled : defaultDesign.music_enabled,
            music_url: initialDesign.music_url || defaultDesign.music_url,
            music_title: initialDesign.music_title || defaultDesign.music_title,
            noticeboard_enabled: initialDesign.noticeboard_enabled !== undefined ? initialDesign.noticeboard_enabled : defaultDesign.noticeboard_enabled,
            noticeboard_text: initialDesign.noticeboard_text || defaultDesign.noticeboard_text,
            noticeboard_icon: initialDesign.noticeboard_icon || defaultDesign.noticeboard_icon,
            noticeboard_type: initialDesign.noticeboard_type || defaultDesign.noticeboard_type,
            card_glow: initialDesign.card_glow !== undefined ? initialDesign.card_glow : defaultDesign.card_glow,
            border_radius: initialDesign.border_radius || defaultDesign.border_radius,
            particles_effect: initialDesign.particles_effect || defaultDesign.particles_effect,
            hover_animation: initialDesign.hover_animation || defaultDesign.hover_animation,
            border_style: initialDesign.border_style || defaultDesign.border_style,
            glass_blur: initialDesign.glass_blur || defaultDesign.glass_blur,
            contact_fab_enabled: initialDesign.contact_fab_enabled !== undefined ? initialDesign.contact_fab_enabled : defaultDesign.contact_fab_enabled,
            contact_whatsapp: initialDesign.contact_whatsapp || defaultDesign.contact_whatsapp,
            contact_phone: initialDesign.contact_phone || defaultDesign.contact_phone,
            contact_instagram: initialDesign.contact_instagram || defaultDesign.contact_instagram,
            custom_css: initialDesign.custom_css || defaultDesign.custom_css
        };
    });

    const [activeTab, setActiveTab] = useState('themes'); // 'themes', 'custom_colors', 'typography', 'patterns', 'layout', 'cards', 'widgets', 'advanced'
    const [audioElement, setAudioElement] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [previewDevice, setPreviewDevice] = useState('mobile'); // 'mobile', 'tablet', 'desktop'

    // Preset Tracks
    const musicTracks = [
        { title: 'دندنة عود تراثية (Oud)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { title: 'موسيقى الخيال الرقمي (Synth)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
        { title: 'موسيقى المقهى الهادئة (Jazz)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
        { title: 'ناي تراثي طبيعي (Flute)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
        { title: 'قانون وعود كلاسيكي (Kanun)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' }
    ];

    // Audio controller inside design preview
    useEffect(() => {
        if (design.music_enabled && design.music_url) {
            if (audioElement) audioElement.pause();
            const audio = new Audio(design.music_url);
            audio.loop = true;
            setAudioElement(audio);
            setIsPlaying(false);
            return () => {
                audio.pause();
            };
        } else {
            if (audioElement) {
                audioElement.pause();
                setIsPlaying(false);
                setAudioElement(null);
            }
        }
    }, [design.music_enabled, design.music_url]);

    const togglePlay = () => {
        if (!audioElement) return;
        if (isPlaying) {
            audioElement.pause();
            setIsPlaying(false);
        } else {
            audioElement.play().catch(err => console.log("Audio play blocked", err));
            setIsPlaying(true);
        }
    };

    // Load fonts dynamically
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Amiri:ital@0;1&family=Cairo:wght@300;400;700;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Space+Grotesk:wght@300..700&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Alexandria:wght@100..900&family=Reem+Kufi:wght@400..900&family=Orbitron:wght@400..900&display=swap';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const palettes = [
        { name: 'Heritage Nova', tag: 'تراثي · هوية فلسطينية عريقة', colors: ['#0B102A','#8B1F33','#C8324A','#E8B547','#F8F4ED'] },
        { name: 'Olive Souq', tag: 'ترابي · شجر الزيتون والطبيعة', colors: ['#141A35','#4F5E32','#8DA463','#BDC9B8','#EFE8D8'] },
        { name: 'Cyber Neon', tag: 'مستقبلي نيون · جريء وحيوي', colors: ['#0A0E17','#FF007F','#00F0FF','#10B981','#F8F4ED'] },
        { name: 'Glassmorphic Dark', tag: 'زجاجي داكن · عصري أنيق', colors: ['#080C14', '#1E293B', '#38BDF8', '#64748B', '#F1F5F9'] },
        { name: 'Royal Gold', tag: 'ملكي فاخر · أسود وذهب القدس', colors: ['#0C0C0C', '#222222', '#AA7C11', '#D4AF37', '#FFFFFF'] },
        { name: 'Mediterranean Fresh', tag: 'منعش · نسيم بحر يافا', colors: ['#0A1D37','#20B2AA','#87CEFA','#B0E0E6','#F8F8FF'] },
        { name: 'Old Stone Souq', tag: 'حجر القدس العتيق والخشب المعتّق', colors: ['#FAF6F0','#EFE8D8','#D4B895','#8B6F47','#2A1F13'] },
        { name: 'Sunset Rose', tag: 'وردي دافئ · هادئ ورومانسي', colors: ['#1A0B1A','#A21C53','#E8A0B5','#FDF6F8','#FFFFFF'] },
        // Premium new themes
        { name: 'Galactic Cosmic', tag: 'فضاء كوني · أرجواني ساطع ونجوم', colors: ['#070714', '#180B30', '#6366F1', '#EC4899', '#F3F4F6'] },
        { name: 'Sweet Candy', tag: 'حلوى الفراولة · درجات الوردي الناعم', colors: ['#1E0A1E', '#4C1D95', '#EC4899', '#F472B6', '#FFF1F2'] },
        { name: 'Eco Forest', tag: 'غابة طبيعية · درجات العشب والزيتون', colors: ['#0B1B10', '#1E3F20', '#4D7C0F', '#84CC16', '#F4FBF7'] },
        { name: 'Retro Arcade', tag: 'ألعاب ريترو · بكسل ملون ساطع', colors: ['#0C0F1D', '#3B82F6', '#EF4444', '#F59E0B', '#FFFFFF'] }
    ];

    const fonts = [
        { display: 'المتجر العتيق', fontFamily: "'Playfair Display', serif", pair: 'Playfair × Cairo', tag: 'كلاسيكي عريق' },
        { display: 'NOVA TECH', fontFamily: "'Space Grotesk', sans-serif", pair: 'Space Grotesk × Tajawal', tag: 'تقني عصري' },
        { display: 'تطريز تراثي', fontFamily: "'Amiri', serif", pair: 'Amiri × Cairo', tag: 'تقليدي فخم' },
        { display: 'مختبر القهوة', fontFamily: "'Bricolage Grotesque', sans-serif", pair: 'Bricolage × Tajawal', tag: 'حديث فريد' },
        { display: 'الخط الكوفي المطور', fontFamily: "'Reem Kufi', sans-serif", pair: 'Reem Kufi × Cairo', tag: 'فني عربي' },
        { display: 'نيون أوربيترون', fontFamily: "'Orbitron', sans-serif", pair: 'Orbitron × Alexandria', tag: 'مستقبلي رقمي' },
        { display: 'الخط النظيف المبسط', fontFamily: "'Alexandria', sans-serif", pair: 'Alexandria × Cairo', tag: 'نظيف وواضح' }
    ];

    const patterns = [
        { name: 'ثوب فلسطيني', bg: 'repeating-linear-gradient(45deg,#0B102A 0 8px,#8B1F33 8px 12px,#E8B547 12px 14px)' },
        { name: 'حجر قدسي', bg: 'linear-gradient(45deg,#D4B895 25%,transparent 25.5%) 0 0/20px 20px, linear-gradient(-45deg,#EFE8D8 25%,transparent 25.5%) 0 0/20px 20px, #F8F4ED' },
        { name: 'شبكة النيون', bg: 'linear-gradient(rgba(0,240,255,0.05) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(0,240,255,0.05) 1px, transparent 1px) 0 0/20px 20px, #0A0E17' },
        { name: 'زجاج متموج', bg: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 10%, transparent 20%) 0 0/15px 15px, #1E293B' },
        { name: 'زخرفة معينة', bg: 'conic-gradient(from 45deg at 50% 50%,#D4AF37 0deg 90deg,#0C0C0C 90deg 180deg,#AA7C11 180deg 270deg,#0C0C0C 270deg 360deg) 0 0/30px 30px' },
        { name: 'تموجات يافا', bg: 'radial-gradient(circle at 100% 150%, #20B2AA 24%, #87CEFA 25%, #87CEFA 28%, #0A1D37 29%) 0 0/40px 40px' }
    ];

    const categories = [
        { icon: '🍽️', label: 'مطاعم', val: 'Restaurant' },
        { icon: '☕', label: 'مقاهي', val: 'Cafe' },
        { icon: '🛒', label: 'سوبرماركت', val: 'Supermarket' },
        { icon: '👕', label: 'ملابس', val: 'Clothing' },
        { icon: '💊', label: 'صيدلية', val: 'Pharmacy' },
        { icon: '🏦', label: 'بنوك', val: 'Bank' }
    ];

    const layouts = [
        { id: 'modern', name: 'عصري (شمال)', desc: 'شكل اللوجو على اليمين مع محاذاة النص لليمين' },
        { id: 'classic', name: 'كلاسيكي (وسط)', desc: 'شكل اللوجو في المنتصف مع توسيط كامل للنصوص' },
        { id: 'minimal', name: 'مينيمال (يسار)', desc: 'شكل اللوجو على اليسار مع محاذاة النص لليسار' },
        { id: 'floating', name: 'عائم متطور', desc: 'اللوجو مدمج داخل الغلاف بشكل عائم متداخل' }
    ];

    const menuLayouts = [
        { id: 'default', name: 'الافتراضي الشبكي (Grid)', icon: '📱', desc: 'عرض شبكي كلاسيكي مريح ومناسب لكافة الأجهزة' },
        { id: 'vanilla', name: 'فانيلا الكلاسيكي (Vanilla)', icon: '🍦', desc: 'تصميم عتيق بورق قديم وخطوط تراثية جذابة' },
        { id: 'restaurant_modern', name: 'المطعم العصري (Modern Diner)', icon: '🍔', desc: 'عرض بطاقات ممتدة مع صور كبيرة وزر تفاعلي سريع' },
        { id: 'lab', name: 'مختبر بالنوفا (Lab Slide)', icon: '🔬', desc: 'عرض أفقي مبتكر من خلال السحب الجانبي للمنتجات' }
    ];

    const avatarShapes = [
        { id: 'circle', name: 'دائري كلاسيكي', css: { borderRadius: '50%' } },
        { id: 'rounded', name: 'مربع منحني', css: { borderRadius: '24px' } },
        { id: 'hexagon', name: 'مضلع سداسي', css: { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' } },
        { id: 'diamond', name: 'معين هندسي', css: { transform: 'rotate(45deg)', borderRadius: '12px' } },
        { id: 'shield', name: 'درع الحماية', css: { borderRadius: '12px 12px 50% 50%' } }
    ];

    const handleApplyDesign = () => {
        onSelectShop(design);
    };

    const handlePaletteChange = (colorIndex, hexValue) => {
        const newColors = [...design.palette.colors];
        newColors[colorIndex] = hexValue;
        setDesign({
            ...design,
            palette: {
                ...design.palette,
                colors: newColors,
                custom: true,
                name: 'لوحة مخصصة'
            }
        });
    };

    const renderParticles = (effect) => {
        if (!effect || effect === 'none') return null;
        let emoji = '✨';
        let count = 12;
        if (effect === 'sparkles') emoji = '✨';
        else if (effect === 'confetti') {
            const emojis = ['🎉', '✨', '💛', '🔴', '🟩', '🔵'];
            return (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
                    {Array.from({ length: 15 }).map((_, i) => {
                        const randomEmoji = emojis[i % emojis.length];
                        const left = `${Math.random() * 100}%`;
                        const delay = `${Math.random() * 6}s`;
                        const duration = `${4 + Math.random() * 4}s`;
                        return (
                            <span 
                                key={i} 
                                style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    left,
                                    fontSize: '0.8rem',
                                    animation: `fallRotate ${duration} linear infinite`,
                                    animationDelay: delay,
                                    opacity: 0.65
                                }}
                            >
                                {randomEmoji}
                            </span>
                        );
                    })}
                </div>
            );
        }
        else if (effect === 'leaves') emoji = '🍃';
        else if (effect === 'bubbles') emoji = '🫧';
        else if (effect === 'matrix') {
            return (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1, opacity: 0.18 }}>
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 240, 255, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05))',
                        backgroundSize: '100% 4px, 6px 100%',
                        animation: 'scanline 15s linear infinite'
                    }} />
                    {Array.from({ length: 8 }).map((_, i) => {
                        const left = `${Math.random() * 95}%`;
                        const delay = `${Math.random() * 5}s`;
                        const duration = `${3 + Math.random() * 5}s`;
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    top: '-40px',
                                    left,
                                    color: '#00F0FF',
                                    fontFamily: 'monospace',
                                    fontSize: '0.6rem',
                                    whiteSpace: 'nowrap',
                                    writingMode: 'vertical-rl',
                                    animation: `fallRain ${duration} linear infinite`,
                                    animationDelay: delay,
                                    opacity: 0.75
                                }}
                            >
                                {['1','0','1','0','N','O','V','A'][i % 8]}
                            </div>
                        );
                    })}
                </div>
            );
        }

        const animationName = effect === 'bubbles' ? 'floatUp' : 'floatDown';
        return (
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
                {Array.from({ length: count }).map((_, i) => {
                    const left = `${Math.random() * 95}%`;
                    const delay = `${Math.random() * 6}s`;
                    const duration = `${5 + Math.random() * 5}s`;
                    const size = `${0.6 + Math.random() * 0.7}rem`;
                    return (
                        <span
                            key={i}
                            style={{
                                position: 'absolute',
                                [effect === 'bubbles' ? 'bottom' : 'top']: '-30px',
                                left,
                                fontSize: size,
                                animation: `${animationName} ${duration} ease-in-out infinite`,
                                animationDelay: delay,
                                opacity: 0.6
                            }}
                        >
                            {emoji}
                        </span>
                    );
                })}
            </div>
        );
    };

    // Dynamic style definitions based on current state
    const styles = {
        overlay: { 
            position: 'fixed', 
            inset: 0, 
            zIndex: 99999, 
            background: '#040714', 
            color: '#e2e8f0', 
            overflow: 'hidden', 
            display: 'flex', 
            flexDirection: 'column', 
            direction: 'rtl', 
            fontFamily: "'Cairo', sans-serif" 
        },
        header: { 
            background: 'rgba(10, 15, 30, 0.95)', 
            backdropFilter: 'blur(20px)', 
            borderBottom: '1px solid rgba(232, 181, 71, 0.15)', 
            padding: '16px 24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
            zIndex: 10
        },
        mainContent: { 
            display: 'flex', 
            flex: 1, 
            overflow: 'hidden', 
            position: 'relative' 
        },
        sidebar: { 
            flex: '0 0 500px', 
            background: '#070a13', 
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)', 
            display: 'flex', 
            flexDirection: 'row',
            overflow: 'hidden',
            height: '100%'
        },
        sidebarDock: {
            width: '80px',
            background: '#03050a',
            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
            gap: '14px',
            flexShrink: 0
        },
        dockButton: (active) => ({
            width: '58px',
            height: '58px',
            borderRadius: '16px',
            background: active ? 'linear-gradient(135deg, #E8B547, #C8324A)' : 'rgba(255,255,255,0.02)',
            border: active ? 'none' : '1px solid rgba(255,255,255,0.05)',
            color: active ? '#040714' : '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: 0
        }),
        dockLabel: (active) => ({
            fontSize: '0.62rem',
            fontWeight: active ? '900' : 'normal',
            color: active ? '#040714' : '#64748b',
            marginTop: '2px'
        }),
        sidebarContent: {
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        },
        previewAreaWrapper: {
            flex: 1,
            background: 'radial-gradient(circle at 50% 50%, #0c1222 0%, #03050c 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 40px 40px',
            overflow: 'hidden',
            position: 'relative'
        },
        deviceBar: {
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '100px',
            padding: '6px 12px',
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 5
        },
        deviceButton: (active) => ({
            padding: '8px 18px',
            borderRadius: '100px',
            border: 'none',
            background: active ? 'rgba(232, 181, 71, 0.15)' : 'transparent',
            color: active ? '#E8B547' : '#94a3b8',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }),
        previewViewport: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            padding: '10px 0'
        },
        // Scalable device mockup
        phoneShell: {
            width: previewDevice === 'mobile' ? '380px' : (previewDevice === 'tablet' ? '650px' : '98%'),
            maxWidth: previewDevice === 'desktop' ? '1100px' : 'none',
            height: previewDevice === 'mobile' ? '740px' : '820px',
            borderRadius: previewDevice === 'mobile' ? '45px' : (previewDevice === 'tablet' ? '32px' : '16px'),
            border: previewDevice === 'mobile' ? '12px solid #1e293b' : (previewDevice === 'tablet' ? '14px solid #1e293b' : '10px solid #1e293b'),
            background: design.palette.colors[0],
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.85), 0 0 0 4px rgba(255,255,255,0.03)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: design.font.fontFamily,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxSizing: 'border-box'
        },
        phoneSpeaker: {
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '24px',
            background: '#1e293b',
            borderRadius: '0 0 16px 16px',
            zIndex: 100,
            display: previewDevice === 'mobile' ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center'
        },
        phoneScreen: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingBottom: '40px',
            scrollbarWidth: 'none',
            position: 'relative',
            zIndex: 2
        },
        previewHero: {
            height: previewDevice === 'desktop' ? '280px' : '190px',
            background: design.pattern.bg,
            position: 'relative',
            transition: 'all 0.3s'
        },
        previewAvatarWrapper: () => {
            const isFloating = design.layout === 'floating';
            const isClassic = design.layout === 'classic';
            const isMinimal = design.layout === 'minimal';
            const size = previewDevice === 'desktop' ? '110px' : '90px';
            const offset = previewDevice === 'desktop' ? '-55px' : '-45px';
            return {
                width: size,
                height: size,
                position: 'absolute',
                bottom: isFloating ? '15px' : offset,
                right: (isFloating || design.layout === 'modern') ? '24px' : undefined,
                left: isClassic ? '50%' : (isMinimal ? '24px' : undefined),
                transform: isClassic ? 'translateX(-50%)' : undefined,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: 10
            };
        },
        previewAvatar: () => {
            const shapeObj = avatarShapes.find(s => s.id === design.avatar_shape) || avatarShapes[0];
            const hasGlow = design.avatar_glow;
            const accentColor = design.palette.colors[3];
            const baseColor = design.palette.colors[0];

            return {
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${design.palette.colors[3]}, ${design.palette.colors[2]})`,
                border: `4px solid ${baseColor}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: previewDevice === 'desktop' ? '3.2rem' : '2.5rem',
                filter: hasGlow ? `drop-shadow(0 0 15px ${accentColor}80)` : 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))',
                overflow: 'hidden',
                transition: 'all 0.4s',
                ...shapeObj.css
            };
        },
        previewContent: {
            padding: previewDevice === 'desktop' ? '80px 40px 20px' : '60px 20px 20px',
            color: design.palette.colors[4],
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 3
        },
        previewShopName: {
            fontSize: previewDevice === 'desktop' ? '2.4rem' : '1.7rem',
            fontWeight: '900',
            lineHeight: '1.2'
        },
        previewCategory: {
            fontSize: '0.88rem',
            opacity: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        },
        noticeBoard: {
            background: `rgba(255,255,255,0.03)`,
            backdropFilter: `blur(${design.glass_blur})`,
            border: `1px dashed ${design.palette.colors[3]}60`,
            borderRadius: '12px',
            padding: '12px 18px',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: design.palette.colors[4],
            position: 'relative',
            overflow: 'hidden',
            boxShadow: design.card_glow ? `0 0 15px ${design.palette.colors[3]}10` : 'none'
        },
        productContainer: () => {
            if (design.menu_layout === 'restaurant_modern') {
                return { display: 'flex', flexDirection: 'column', gap: '14px' };
            }
            if (design.menu_layout === 'lab') {
                return { display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' };
            }
            // Responsive Grid columns
            const cols = previewDevice === 'desktop' ? 'repeat(3, 1fr)' : (previewDevice === 'tablet' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)');
            return { display: 'grid', gridTemplateColumns: cols, gap: '14px' };
        },
        productCard: () => {
            const hasGlow = design.card_glow;
            const accentColor = design.palette.colors[3];
            const baseColor = design.palette.colors[0];
            const cardBg = design.palette.colors[1];
            const borderCol = design.palette.colors[2];
            const textCol = design.palette.colors[4];

            let borderStyle = {};
            if (design.border_style === 'double') {
                borderStyle = { border: `4px double ${borderCol}` };
            } else if (design.border_style === 'embroidered') {
                borderStyle = { border: `2px dashed #C8324A`, boxShadow: `0 0 0 2px #0B102A, 0 0 0 4px #E8B547` };
            } else if (design.border_style === 'neon') {
                borderStyle = { border: `1.5px solid ${accentColor}`, animation: 'pulseNeon 2.5s infinite' };
            } else if (design.border_style === 'gold-lux') {
                borderStyle = { border: `1px solid #D4AF37`, boxShadow: '0 0 8px rgba(212, 175, 55, 0.2)' };
            } else {
                borderStyle = { border: '1px solid rgba(255, 255, 255, 0.08)' };
            }

            return {
                background: cardBg,
                borderRadius: design.border_radius,
                padding: '14px',
                display: 'flex',
                flexDirection: design.menu_layout === 'restaurant_modern' ? 'row' : 'column',
                gap: '10px',
                position: 'relative',
                boxShadow: hasGlow ? `0 0 15px ${accentColor}12` : 'none',
                minWidth: design.menu_layout === 'lab' ? '150px' : 'none',
                color: textCol,
                ...borderStyle
            };
        },
        sectionTitle: {
            fontSize: '1.05rem',
            fontWeight: '900',
            color: '#f8fafc',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px dashed rgba(232, 181, 71, 0.2)',
            paddingBottom: '8px'
        },
        card: (active) => ({
            background: active ? 'rgba(232,181,71,0.08)' : 'rgba(30, 41, 59, 0.35)',
            border: active ? '2px solid #E8B547' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            boxShadow: active ? '0 0 20px rgba(232,181,71,0.12)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }),
        fabWrapper: {
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 100,
            pointerEvents: 'auto'
        },
        fabButton: (bg) => ({
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: bg,
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.1rem',
            border: 'none',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            transition: 'transform 0.2s'
        })
    };

    return (
        <div style={styles.overlay}>
            {/* Embedded styles for particles, animations and CSS overrides */}
            <style>{`
                @keyframes floatDown {
                    0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.65; }
                    90% { opacity: 0.65; }
                    100% { transform: translateY(780px) translateX(15px) rotate(180deg); opacity: 0; }
                }
                @keyframes floatUp {
                    0% { transform: translateY(10px) translateX(0) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.65; }
                    90% { opacity: 0.65; }
                    100% { transform: translateY(-780px) translateX(-15px) rotate(-180deg); opacity: 0; }
                }
                @keyframes fallRotate {
                    0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.8; }
                    90% { opacity: 0.8; }
                    100% { transform: translateY(780px) rotate(360deg); opacity: 0; }
                }
                @keyframes fallRain {
                    0% { transform: translateY(-10px); opacity: 0; }
                    10% { opacity: 0.85; }
                    90% { opacity: 0.85; }
                    100% { transform: translateY(780px); opacity: 0; }
                }
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                @keyframes pulseNeon {
                    0% { box-shadow: 0 0 4px ${design.palette.colors[3]}80, inset 0 0 3px ${design.palette.colors[3]}50; border-color: ${design.palette.colors[3]}90; }
                    50% { box-shadow: 0 0 12px ${design.palette.colors[3]}cc, inset 0 0 6px ${design.palette.colors[3]}80; border-color: ${design.palette.colors[3]}; }
                    100% { box-shadow: 0 0 4px ${design.palette.colors[3]}80, inset 0 0 3px ${design.palette.colors[3]}50; border-color: ${design.palette.colors[3]}90; }
                }
                @keyframes spinDisk {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes marqueeText {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .marquee-box {
                    display: flex;
                    overflow: hidden;
                    white-space: nowrap;
                    width: 100%;
                }
                .marquee-inner {
                    display: inline-block;
                    animation: marqueeText 12s linear infinite;
                    padding-right: 100%;
                }
                /* Hover Animations */
                .hvr-scale-up { transition: transform 0.3s ease, box-shadow 0.3s ease; }
                .hvr-scale-up:hover { transform: translateY(-5px) scale(1.02); }
                
                .hvr-glow-pulse { transition: all 0.3s ease; }
                .hvr-glow-pulse:hover { box-shadow: 0 0 20px ${design.palette.colors[3]}40; transform: translateY(-2px); }
                
                .hvr-glitch-tilt { transition: transform 0.2s ease; }
                .hvr-glitch-tilt:hover { transform: skewX(-2deg) skewY(1deg) rotate(0.8deg) scale(0.99); }
                
                .hvr-none { }
            `}</style>

            {/* Top Bar Header */}
            <div style={styles.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #E8B547, #C8324A)', display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(232, 181, 71, 0.25)' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="#040714">
                            <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 16.5L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 950, color: '#F8F4ED', letterSpacing: '0.5px' }}>HYDROSTUDIO</div>
                        <div style={{ fontSize: 9, color: '#e8b547', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: '2px', fontWeight: 'bold' }}>Live Experience Builder 3.0</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        style={{ 
                            background: 'rgba(255,255,255,0.04)', 
                            color: '#94a3b8', 
                            border: '1px solid rgba(255,255,255,0.08)', 
                            padding: '10px 24px', 
                            borderRadius: '100px', 
                            fontWeight: 'bold', 
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }} 
                        onClick={onClose}
                    >
                        خروج وإلغاء
                    </button>
                    <button 
                        style={{ 
                            background: 'linear-gradient(135deg, #E8B547, #C8324A)', 
                            color: '#040714', 
                            border: 'none', 
                            padding: '10px 28px', 
                            borderRadius: '100px', 
                            fontWeight: '900', 
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(232, 181, 71, 0.3)',
                            transition: 'all 0.3s'
                        }} 
                        onClick={handleApplyDesign}
                    >
                        اعتماد ونشر التصميم ✨
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div style={styles.mainContent}>
                
                {/* Double-Column Sidebar (Dock + Panel) */}
                <div style={styles.sidebar}>
                    {/* Dock Navigation Strip */}
                    <div style={styles.sidebarDock}>
                        <button style={styles.dockButton(activeTab === 'themes')} onClick={() => setActiveTab('themes')}>
                            <span>🎨</span>
                            <span style={styles.dockLabel(activeTab === 'themes')}>السمات</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'custom_colors')} onClick={() => setActiveTab('custom_colors')}>
                            <span>🖌️</span>
                            <span style={styles.dockLabel(activeTab === 'custom_colors')}>الألوان</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'typography')} onClick={() => setActiveTab('typography')}>
                            <span>✍️</span>
                            <span style={styles.dockLabel(activeTab === 'typography')}>الخطوط</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'patterns')} onClick={() => setActiveTab('patterns')}>
                            <span>🖼️</span>
                            <span style={styles.dockLabel(activeTab === 'patterns')}>الغلاف</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'layout')} onClick={() => setActiveTab('layout')}>
                            <span>📐</span>
                            <span style={styles.dockLabel(activeTab === 'layout')}>الهيكل</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'cards')} onClick={() => setActiveTab('cards')}>
                            <span>🛡️</span>
                            <span style={styles.dockLabel(activeTab === 'cards')}>البطاقات</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'widgets')} onClick={() => setActiveTab('widgets')}>
                            <span>⚙️</span>
                            <span style={styles.dockLabel(activeTab === 'widgets')}>الإضافات</span>
                        </button>
                        <button style={styles.dockButton(activeTab === 'advanced')} onClick={() => setActiveTab('advanced')}>
                            <span>💻</span>
                            <span style={styles.dockLabel(activeTab === 'advanced')}>CSS</span>
                        </button>
                    </div>

                    {/* Active Sidebar Panel Content */}
                    <div style={styles.sidebarContent}>
                        
                        {activeTab === 'themes' && (
                            <div>
                                <div style={styles.sectionTitle}>
                                    <span>🎨</span>
                                    السمات الفنية الممتازة (Premium)
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                    {palettes.map(p => (
                                        <div 
                                            key={p.name} 
                                            style={styles.card(design.palette.name === p.name && !design.palette.custom)} 
                                            onClick={() => setDesign({
                                                ...design, 
                                                palette: { ...p, custom: false }
                                            })}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '0.95rem', color: '#F8F4ED', fontWeight: '900' }}>{p.name}</div>
                                                <div style={{ display: 'flex', gap: '4px', height: '14px', borderRadius: '4px', overflow: 'hidden', width: '90px' }}>
                                                    {p.colors.map(c => <div key={c} style={{ flex: 1, background: c }} />)}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.tag}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'custom_colors' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={styles.sectionTitle}>
                                    <span>🛠️</span>
                                    محرر الألوان والشفافية
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>خلفية المحل الرئيسية:</label>
                                        <input 
                                            type="color" 
                                            value={design.palette.colors[0]} 
                                            onChange={(e) => handlePaletteChange(0, e.target.value)}
                                            style={{ width: '45px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>الخلفية الثانوية للبطاقات:</label>
                                        <input 
                                            type="color" 
                                            value={design.palette.colors[1]} 
                                            onChange={(e) => handlePaletteChange(1, e.target.value)}
                                            style={{ width: '45px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>لون اللمسة والحدود الحيوية:</label>
                                        <input 
                                            type="color" 
                                            value={design.palette.colors[2]} 
                                            onChange={(e) => handlePaletteChange(2, e.target.value)}
                                            style={{ width: '45px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>لون الأزرار والتوهج (Accent):</label>
                                        <input 
                                            type="color" 
                                            value={design.palette.colors[3]} 
                                            onChange={(e) => handlePaletteChange(3, e.target.value)}
                                            style={{ width: '45px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>لون نصوص وعناوين المحل:</label>
                                        <input 
                                            type="color" 
                                            value={design.palette.colors[4]} 
                                            onChange={(e) => handlePaletteChange(4, e.target.value)}
                                            style={{ width: '45px', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem' }}>شدة ضباب بلور الزجاج:</span>
                                        <select 
                                            value={design.glass_blur} 
                                            onChange={(e) => setDesign({...design, glass_blur: e.target.value})}
                                            style={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}
                                        >
                                            <option value="0px">بلا بلور (0px)</option>
                                            <option value="4px">خفيف (4px)</option>
                                            <option value="8px">متوسط (8px)</option>
                                            <option value="16px">قوي (16px)</option>
                                            <option value="24px">شديد الغباش (24px)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'typography' && (
                            <div>
                                <div style={styles.sectionTitle}>
                                    <span>✍️</span>
                                    الخطوط وعناوين النصوص
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {fonts.map(f => (
                                        <div 
                                            key={f.display} 
                                            style={{ ...styles.card(design.font.display === f.display), padding: '16px' }} 
                                            onClick={() => setDesign({...design, font: f})}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '1.25rem', fontFamily: f.fontFamily, color: '#f8fafc' }}>{f.display}</div>
                                                <span style={{ fontSize: '0.7rem', color: '#E8B547', background: 'rgba(232,181,71,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{f.pair}</span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{f.tag}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'patterns' && (
                            <div>
                                <div style={styles.sectionTitle}>
                                    <span>🖼️</span>
                                    غلاف المحل والنقوش التراثية
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                    {patterns.map(p => (
                                        <div 
                                            key={p.name} 
                                            style={{ 
                                                ...styles.card(design.pattern.name === p.name), 
                                                height: '110px', 
                                                background: p.bg, 
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }} 
                                            onClick={() => setDesign({...design, pattern: p})}
                                        >
                                            <div style={{ 
                                                position: 'absolute', 
                                                bottom: 0, 
                                                left: 0, 
                                                right: 0, 
                                                padding: '6px', 
                                                background: 'rgba(0,0,0,0.75)', 
                                                backdropFilter: 'blur(5px)',
                                                fontSize: '0.75rem', 
                                                color: '#fff',
                                                textAlign: 'center',
                                                fontWeight: 'bold'
                                            }}>
                                                {p.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'layout' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <div style={styles.sectionTitle}><span>📐</span> هيكل ورأس الصفحة</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                        {layouts.map(l => (
                                            <div key={l.id} style={styles.card(design.layout === l.id)} onClick={() => setDesign({...design, layout: l.id})}>
                                                <div style={{ fontSize: '0.9rem', color: '#F8F4ED', fontWeight: '800' }}>{l.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{l.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={styles.sectionTitle}><span>🛍️</span> نمط عرض المنتجات</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                                        {menuLayouts.map(m => (
                                            <div key={m.id} style={styles.card(design.menu_layout === m.id)} onClick={() => setDesign({...design, menu_layout: m.id})}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ fontSize: '1.25rem' }}>{m.icon}</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#F8F4ED', fontWeight: '800' }}>{m.name}</div>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{m.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={styles.sectionTitle}><span>🛡️</span> شكل لوجو/أفاتار المتجر</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                        {avatarShapes.map(s => (
                                            <div key={s.id} style={styles.card(design.avatar_shape === s.id)} onClick={() => setDesign({...design, avatar_shape: s.id})}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                    <div style={{ 
                                                        width: '24px', 
                                                        height: '24px', 
                                                        background: '#E8B547', 
                                                        ...s.css, 
                                                        transform: s.id === 'diamond' ? 'rotate(45deg) scale(0.7)' : undefined 
                                                    }} />
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{s.name}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'cards' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <div style={styles.sectionTitle}><span>🛡️</span> حدود وإطارات بطاقات المنتجات</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {[
                                            { id: 'solid', name: 'إطار افتراضي ناعم (Solid)', desc: 'خط كلاسيكي رفيع خفيف الألوان' },
                                            { id: 'double', name: 'إطار مزدوج ملكي (Double)', desc: 'خط مزدوج أنيق يوحي بالعراقة والفخامة' },
                                            { id: 'embroidered', name: 'تطريز فلسطيني تراثي', desc: 'إطار ثنائي بلون القماش والتطريز يمثل الهوية الفلسطينية' },
                                            { id: 'neon', name: 'توهج نيون نابض (Neon Pulse)', desc: 'توهج إشعاعي ينبض بألوان النيون للمستقبل' },
                                            { id: 'gold-lux', name: 'رخام لمعان ذهبي (Gold Lustre)', desc: 'خط ذهبي رفيع براق بتأثير لمعان ميتاليك' }
                                        ].map(border => (
                                            <div key={border.id} style={styles.card(design.border_style === border.id)} onClick={() => setDesign({...design, border_style: border.id})}>
                                                <div style={{ fontSize: '0.9rem', color: '#F8F4ED', fontWeight: '800' }}>{border.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{border.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={styles.sectionTitle}><span>⚡</span> حركة تحويم المنتجات (Hover Effect)</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                        {[
                                            { id: 'scale-up', name: 'بروز للأعلى ⬆️' },
                                            { id: 'glow-pulse', name: 'توهج ضوئي 🌟' },
                                            { id: 'glitch-tilt', name: 'ميلان بكسل 👾' },
                                            { id: 'none', name: 'بلا حركة' }
                                        ].map(h => (
                                            <div key={h.id} style={styles.card(design.hover_animation === h.id)} onClick={() => setDesign({...design, hover_animation: h.id})}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>{h.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div style={styles.sectionTitle}><span>⭕</span> درجة انحناء حواف المنتجات</div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem' }}>درجة انحناء الحواف:</span>
                                        <select 
                                            value={design.border_radius}
                                            onChange={(e) => setDesign({...design, border_radius: e.target.value})}
                                            style={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}
                                        >
                                            <option value="0px">حادة (0px)</option>
                                            <option value="8px">بسيطة (8px)</option>
                                            <option value="16px">ناعمة (16px)</option>
                                            <option value="28px">دائرية جداً (28px)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'widgets' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {/* Floating Particles Atmosphere */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px' }}>تأثيرات الخلفية الحركية (Particles)</div>
                                    <select
                                        value={design.particles_effect}
                                        onChange={(e) => setDesign({...design, particles_effect: e.target.value})}
                                        style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.85rem' }}
                                    >
                                        <option value="none">بلا جزيئات عائمة (هادئ)</option>
                                        <option value="sparkles">بريق النجوم واللمعان ✨</option>
                                        <option value="confetti">قصاصات الورق الاحتفالية 🎉</option>
                                        <option value="leaves">أوراق شجر الزيتون المتساقطة 🍃</option>
                                        <option value="bubbles">فقاعات مائية صاعدة 🫧</option>
                                        <option value="matrix">الماتريكس وخطوط النيون الرقمية 💻</option>
                                    </select>
                                </div>

                                {/* Floating Contacts (FAB) */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>أزرار التواصل السريع العائمة</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>أزرار اتصال وواتس وإنستا عائمة بالأسفل</div>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={design.contact_fab_enabled}
                                                onChange={(e) => setDesign({...design, contact_fab_enabled: e.target.checked})}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{ 
                                                position: 'absolute', cursor: 'pointer', inset: 0, 
                                                background: design.contact_fab_enabled ? '#E8B547' : '#475569', 
                                                borderRadius: '34px', transition: '0.4s' 
                                            }}>
                                                <span style={{ 
                                                    position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px', 
                                                    background: '#040714', borderRadius: '50%', transition: '0.4s',
                                                    transform: design.contact_fab_enabled ? 'translateX(18px)' : 'translateX(0)'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                    
                                    {design.contact_fab_enabled && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                            <input 
                                                type="text"
                                                value={design.contact_whatsapp}
                                                onChange={(e) => setDesign({...design, contact_whatsapp: e.target.value})}
                                                placeholder="رقم الواتساب (مثال: 970599000000)"
                                                style={{ padding: '8px 12px', borderRadius: '8px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                                            />
                                            <input 
                                                type="text"
                                                value={design.contact_phone}
                                                onChange={(e) => setDesign({...design, contact_phone: e.target.value})}
                                                placeholder="رقم الاتصال الهاتفي (مثال: 0599000000)"
                                                style={{ padding: '8px 12px', borderRadius: '8px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                                            />
                                            <input 
                                                type="text"
                                                value={design.contact_instagram}
                                                onChange={(e) => setDesign({...design, contact_instagram: e.target.value})}
                                                placeholder="يوزر الإنستقرام (مثال: my.shop)"
                                                style={{ padding: '8px 12px', borderRadius: '8px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Noticeboard */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>لوحة الإعلانات التفاعلية</div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={design.noticeboard_enabled}
                                                onChange={(e) => setDesign({...design, noticeboard_enabled: e.target.checked})}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{ 
                                                position: 'absolute', cursor: 'pointer', inset: 0, 
                                                background: design.noticeboard_enabled ? '#E8B547' : '#475569', 
                                                borderRadius: '34px', transition: '0.4s' 
                                            }}>
                                                <span style={{ 
                                                    position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px', 
                                                    background: '#040714', borderRadius: '50%', transition: '0.4s',
                                                    transform: design.noticeboard_enabled ? 'translateX(18px)' : 'translateX(0)'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                    {design.noticeboard_enabled && (
                                        <>
                                            <textarea 
                                                value={design.noticeboard_text}
                                                onChange={(e) => setDesign({...design, noticeboard_text: e.target.value})}
                                                placeholder="اكتب الإعلان هنا..."
                                                style={{ 
                                                    width: '100%', minHeight: '60px', padding: '10px', borderRadius: '10px', 
                                                    background: '#0a0e1a', border: '1px solid rgba(232,181,71,0.2)', color: 'white', fontSize: '0.8rem' 
                                                }}
                                            />
                                            
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.8rem' }}>نمط الإعلان:</span>
                                                <select
                                                    value={design.noticeboard_type}
                                                    onChange={(e) => setDesign({...design, noticeboard_type: e.target.value})}
                                                    style={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}
                                                >
                                                    <option value="static">ثابت (بسيط)</option>
                                                    <option value="marquee">شريط متحرك (Marquee)</option>
                                                </select>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.8rem' }}>أيقونة الإعلان:</span>
                                                <select
                                                    value={design.noticeboard_icon}
                                                    onChange={(e) => setDesign({...design, noticeboard_icon: e.target.value})}
                                                    style={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem' }}
                                                >
                                                    <option value="📢">📢 إعلان</option>
                                                    <option value="🎉">🎉 احتفال</option>
                                                    <option value="🔔">🔔 تنبيه</option>
                                                    <option value="⚠️">⚠️ تحذير</option>
                                                    <option value="✉️">✉️ رسالة</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Music */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>الموسيقى التراثية الخلفية</div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>تعزف لحناً جميلاً عند فتح صفحة المتجر</div>
                                        </div>
                                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={design.music_enabled}
                                                onChange={(e) => setDesign({...design, music_enabled: e.target.checked})}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{ 
                                                position: 'absolute', cursor: 'pointer', inset: 0, 
                                                background: design.music_enabled ? '#E8B547' : '#475569', 
                                                borderRadius: '34px', transition: '0.4s' 
                                            }}>
                                                <span style={{ 
                                                    position: 'absolute', height: '16px', width: '16px', left: '3px', bottom: '3px', 
                                                    background: '#040714', borderRadius: '50%', transition: '0.4s',
                                                    transform: design.music_enabled ? 'translateX(18px)' : 'translateX(0)'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                    {design.music_enabled && (
                                        <select
                                            value={design.music_url}
                                            onChange={(e) => {
                                                const selectedTrack = musicTracks.find(t => t.url === e.target.value);
                                                setDesign({
                                                    ...design,
                                                    music_url: e.target.value,
                                                    music_title: selectedTrack ? selectedTrack.title : 'لحن مخصص'
                                                });
                                            }}
                                            style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.8rem' }}
                                        >
                                            {musicTracks.map(track => (
                                                <option key={track.url} value={track.url}>{track.title}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Extra Aesthetics */}
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem' }}>توهج إطار اللوجو (Logo Glow):</span>
                                        <input 
                                            type="checkbox" 
                                            checked={design.avatar_glow}
                                            onChange={(e) => setDesign({...design, avatar_glow: e.target.checked})}
                                            style={{ accentColor: '#E8B547', width: '16px', height: '16px' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem' }}>توهج البطاقات والمنتجات:</span>
                                        <input 
                                            type="checkbox" 
                                            checked={design.card_glow}
                                            onChange={(e) => setDesign({...design, card_glow: e.target.checked})}
                                            style={{ accentColor: '#E8B547', width: '16px', height: '16px' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'advanced' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                                <div style={styles.sectionTitle}>
                                    <span>💻</span>
                                    مطور متقدم: كود CSS مخصص
                                </div>
                                <p style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.4', margin: 0 }}>
                                    اكتب كود CSS مخصص ليتم تطبيقه مباشرة داخل المتجر. يمكنك استخدام الكلاسات الافتراضية مثل 
                                    <code>.modal-container</code>, <code>.product-card</code>, <code>.modal-header</code>.
                                </p>
                                <textarea
                                    value={design.custom_css}
                                    onChange={(e) => setDesign({...design, custom_css: e.target.value})}
                                    placeholder="/* مثال: */\n.product-card {\n  filter: grayscale(20%);\n}"
                                    style={{
                                        width: '100%',
                                        height: '280px',
                                        background: '#040712',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#38bdf8',
                                        fontFamily: 'monospace',
                                        fontSize: '0.78rem',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        direction: 'ltr',
                                        textAlign: 'left'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Interactive Live Preview Viewport */}
                <div style={styles.previewAreaWrapper}>
                    {/* Device Switcher Bar */}
                    <div style={styles.deviceBar}>
                        <button style={styles.deviceButton(previewDevice === 'mobile')} onClick={() => setPreviewDevice('mobile')}>
                            <span>📱</span> جوال
                        </button>
                        <button style={styles.deviceButton(previewDevice === 'tablet')} onClick={() => setPreviewDevice('tablet')}>
                            <span>📟</span> تابلت
                        </button>
                        <button style={styles.deviceButton(previewDevice === 'desktop')} onClick={() => setPreviewDevice('desktop')}>
                            <span>💻</span> حاسوب
                        </button>
                    </div>

                    {/* Viewport for Mockup */}
                    <div style={styles.previewViewport}>
                        
                        {/* Smartphone/Tablet/Desktop Mockup container */}
                        <div style={styles.phoneShell}>
                            
                            {/* Live CSS Injection in Preview */}
                            {design.custom_css && <style>{design.custom_css}</style>}

                            {/* Dynamic Particle Atmosphere Renderer */}
                            {renderParticles(design.particles_effect)}
                            
                            {/* Speaker & Camera notch */}
                            <div style={styles.phoneSpeaker}>
                                <div style={{ width: '40px', height: '4px', background: '#0c0f1d', borderRadius: '10px' }} />
                            </div>

                            {/* Screen contents */}
                            <div style={styles.phoneScreen}>
                                {/* Cover photo */}
                                <div style={styles.previewHero}>
                                    <div style={{ position: 'absolute', top: 32, right: 16, background: 'rgba(0,0,0,0.5)', color: '#E8B547', padding: '3px 10px', borderRadius: '100px', fontSize: '0.65rem', border: '1px solid rgba(232,181,71,0.2)', fontWeight: 'bold', zIndex: 10 }}>
                                        {design.palette.custom ? 'تصميم مخصص' : design.palette.name}
                                    </div>

                                    {/* Music widget inside preview */}
                                    {design.music_enabled && (
                                        <button 
                                            onClick={togglePlay}
                                            style={{ 
                                                position: 'absolute', top: 32, left: 16, background: 'rgba(0,0,0,0.6)', 
                                                border: `1px solid ${design.palette.colors[3]}`, 
                                                borderRadius: '50%', width: '28px', height: '28px', 
                                                display: 'grid', placeItems: 'center', cursor: 'pointer', zIndex: 50 
                                            }}
                                        >
                                            {isPlaying ? (
                                                <span style={{ fontSize: '0.65rem', animation: 'spinDisk 4s linear infinite', display: 'inline-block' }}>💿</span>
                                            ) : (
                                                <span style={{ fontSize: '0.65rem', color: '#ffffff' }}>🎵</span>
                                            )}
                                        </button>
                                    )}

                                    {/* Avatar */}
                                    <div style={styles.previewAvatarWrapper()}>
                                        <div style={styles.previewAvatar()}>
                                            {categories.find(c => c.val === design.category)?.icon || '🏪'}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Text Content */}
                                <div style={{
                                    ...styles.previewContent,
                                    textAlign: design.layout === 'classic' ? 'center' : (design.layout === 'minimal' ? 'left' : 'right')
                                }}>
                                    <div style={styles.previewShopName}>{design.shopName || 'اسم المحل'}</div>
                                    <div style={{ ...styles.previewCategory, justifyContent: design.layout === 'classic' ? 'center' : 'flex-start' }}>
                                        <span>{categories.find(c => c.val === design.category)?.icon}</span>
                                        <span>{categories.find(c => c.val === design.category)?.label || design.category}</span>
                                        <span>•</span>
                                        <span style={{ color: design.palette.colors[3], fontWeight: 'bold' }}>مفتوح الآن</span>
                                    </div>

                                    {/* Custom Noticeboard (Static / Marquee) */}
                                    {design.noticeboard_enabled && design.noticeboard_text && (
                                        <div style={styles.noticeBoard}>
                                            <div style={{ position: 'absolute', top: '0', right: '0', bottom: '0', width: '4px', background: design.palette.colors[3] }} />
                                            {design.noticeboard_type === 'marquee' ? (
                                                <div className="marquee-box">
                                                    <div className="marquee-inner">
                                                        <span style={{ fontWeight: 'bold', color: design.palette.colors[3], marginLeft: '8px' }}>
                                                            {design.noticeboard_icon} إعلان:
                                                        </span>
                                                        {design.noticeboard_text}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <span style={{ fontWeight: 'bold', color: design.palette.colors[3], marginLeft: '4px' }}>
                                                        {design.noticeboard_icon} إعلان المتجر:
                                                    </span>
                                                    {design.noticeboard_text}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Fast tabs navigation mock */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <div style={{ flex: 1, height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.8 }}>المنتجات</div>
                                        <div style={{ flex: 1, height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.4 }}>الأخبار</div>
                                        <div style={{ flex: 1, height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.4 }}>التفاصيل</div>
                                    </div>

                                    <div style={{ height: '1px', background: `linear-gradient(to left, transparent, ${design.palette.colors[2]}, transparent)`, opacity: 0.2, margin: '10px 0' }} />

                                    {/* Mock Products Area */}
                                    <div style={styles.productContainer()}>
                                        
                                        {/* Mock Product 1 */}
                                        <div style={styles.productCard()} className={`hvr-${design.hover_animation} product-card`}>
                                            <div style={{ 
                                                width: design.menu_layout === 'restaurant_modern' ? '80px' : '100%', 
                                                height: design.menu_layout === 'restaurant_modern' ? '80px' : '85px', 
                                                background: 'rgba(255,255,255,0.05)', 
                                                borderRadius: '8px',
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontSize: '1.5rem',
                                                flexShrink: 0
                                            }}>
                                                {categories.find(c => c.val === design.category)?.icon || '🎁'}
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                                                <div style={{ width: '80%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                                                <div style={{ width: '50%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                                    <div style={{ width: '30px', height: '10px', background: `${design.palette.colors[3]}80`, borderRadius: '4px' }}></div>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: design.palette.colors[3], display: 'grid', placeItems: 'center', fontSize: '0.8rem', color: design.palette.colors[0], cursor: 'pointer' }}>+</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mock Product 2 */}
                                        <div style={styles.productCard()} className={`hvr-${design.hover_animation} product-card`}>
                                            <div style={{ 
                                                width: design.menu_layout === 'restaurant_modern' ? '80px' : '100%', 
                                                height: design.menu_layout === 'restaurant_modern' ? '80px' : '85px', 
                                                background: 'rgba(255,255,255,0.05)', 
                                                borderRadius: '8px',
                                                display: 'grid',
                                                placeItems: 'center',
                                                fontSize: '1.5rem',
                                                flexShrink: 0
                                            }}>
                                                ✨
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                                                <div style={{ width: '70%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                                                <div style={{ width: '40%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                                    <div style={{ width: '30px', height: '10px', background: `${design.palette.colors[3]}80`, borderRadius: '4px' }}></div>
                                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: design.palette.colors[3], display: 'grid', placeItems: 'center', fontSize: '0.8rem', color: design.palette.colors[0], cursor: 'pointer' }}>+</div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                    {/* Virtual Tour Action Button */}
                                    <button 
                                        style={{ 
                                            padding: '12px', 
                                            borderRadius: '12px', 
                                            width: '100%',
                                            background: `linear-gradient(135deg, ${design.palette.colors[3]}, ${design.palette.colors[2]})`,
                                            color: design.palette.colors[0],
                                            border: 'none', 
                                            fontWeight: '900', 
                                            fontSize: '0.95rem',
                                            marginTop: '15px', 
                                            fontFamily: 'inherit',
                                            boxShadow: `0 4px 15px ${design.palette.colors[3]}40`,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        زيارة المتجر ثلاثية الأبعاد 🌐
                                    </button>
                                </div>

                                {/* Floating Contacts (FAB) Preview */}
                                {design.contact_fab_enabled && (
                                    <div style={styles.fabWrapper}>
                                        {design.contact_whatsapp && (
                                            <button style={styles.fabButton('#25D366')} title="واتساب">💬</button>
                                        )}
                                        {design.contact_phone && (
                                            <button style={styles.fabButton('#3b82f6')} title="اتصال">📞</button>
                                        )}
                                        {design.contact_instagram && (
                                            <button style={styles.fabButton('#E1306C')} title="إنستقرام">📸</button>
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
};

export default PalNovaaMarketDesign;
