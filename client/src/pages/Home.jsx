import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import EarthGlobe from '../components/home/EarthGlobe';
import './Home.css';

export default function Home() {
    const navigate = useNavigate();
    const [activeCity, setActiveCity] = useState(null);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [activeFaq, setActiveFaq] = useState(null);
    const [liveLocationCoords, setLiveLocationCoords] = useState(null);

    // Blog Articles Data
    const articles = [
        {
            id: 1,
            title: 'مستقبل الخرائط الاجتماعية المكانية: كيف تدمج PalNovaa الواقع بالمكان؟',
            category: 'تقنية وابتكار',
            date: '2025-05-10',
            readTime: '4 دقائق',
            image: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&q=80',
            excerpt: 'استكشف كيف تعمل تكنولوجيا الخرائط المكانية ثلاثية الأبعاد على تحويل تجربة التواصل الاجتماعي وتوثيق اللحظات الجغرافية.',
            content: `في عصرنا الرقمي الحالي، لم تعد الخرائط مجرد خطوط وطرق للتنقل فقط، بل أصبحت وسيطاً حيوياً يجمع الناس ويعيد تعريف كيفية تفاعلنا مع محيطنا.

تقدم منصة PalNovaa مفهوماً ثورياً وهو "الشبكة الاجتماعية المكانية" (Spatial Social Network)، حيث يرتبط كل منشور، تفاعل، أو نشاط بإحداثيات حقيقية ومعالم ثلاثية الأبعاد. 

من خلال الجمع بين محركات الرندرة ثلاثية الأبعاد (WebGL) ونظم المعلومات الجغرافية، تتيح المنصة للمستخدمين اكتشاف ما يدور حولهم لحظياً، بدءاً من المناسبات المجتمعية والأنشطة الطلابية وحتى العروض التجارية المحلية.`
        },
        {
            id: 2,
            title: 'الواقع المعزز (AR) في استكشاف المدن والتسوق المكاني الذكي',
            category: 'الواقع المعزز',
            date: '2025-05-02',
            readTime: '3 دقائق',
            image: 'https://images.unsplash.com/photo-1633493106115-026046e11423?auto=format&fit=crop&w=800&q=80',
            excerpt: 'كيف تتيح لك كاميرا هاتفك رؤية أسماء المتاجر، المعالم التاريخية، والعروض المخفية في شوارع مدينتك بالواقع المعزز.',
            content: `تخيل أن تسير في شارع رئيسي، وبمجرد رفع كاميرا هاتفك تظهر أمامك أسماء المباني، قوائم الطعام للمطاعم المحيطة، والمقاعد الشاغرة في مقاهيك المفضلة مع مسار بصري ثلاثي الأبعاد يقودك خطوة بخطوة.

هذا هو صميم تقنية AR Workspace في PalNovaa. باستخدام تقنيات الرؤية الحاسوبية وتحديد الموقع فائق الدقة، ندمج الواقع الملموس مع العالم الرقمي لتقديم تجربة استكشاف غامرة وسلسة.`
        },
        {
            id: 3,
            title: 'الجيوبورتال والتخطيط الحضري: تمكين البلديات والمواطنين ببيانات جغرافية حية',
            category: 'حلول مؤسسية',
            date: '2025-04-20',
            readTime: '5 دقائق',
            image: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32f?auto=format&fit=crop&w=800&q=80',
            excerpt: 'منصة Geoportal Designer تمنح البلديات والمؤسسات القدرة على نشر خرائط تفاعلية للأحواض والأراضي والمرافق بسهولة.',
            content: `يعد التحول الرقمي للبلديات والمجالس المحلية ضرورة قصوى لتسهيل خدمات المواطنين. يوفر نظام الجيوبورتال في PalNovaa أدوات ذكية لتصميم ونشر الخرائط الهندسية، طبقات الأحواض والقطع، واستخراج إفادات الموقع وتراخيص البناء بدقة وسرعة غير مسبوقة.

يستطيع المواطن الآن استعراض قطع الأراضي والشوارع التنظيمية والخدمات المحيطة به مباشرة من متصفحه دون الحاجة لزيارة مقرات البلدية.`
        },
        {
            id: 4,
            title: 'ثورة بطاقات الدعوة الرقمية الذكية وربط المناسبات بالمسارات الجغرافية',
            category: 'مناسبات ومجتمع',
            date: '2025-04-12',
            readTime: '3 دقائق',
            image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80',
            excerpt: 'أعد ابتكار دعوات الأعراس وحفلات التخرج مع مسارات ملاحية حية وتأكيد حضور تفاعلي وسجل تهاني رقمي.',
            content: `وداعاً للدعوات الورقية التقليدية! تقدم PalNovaa خدمة تصميم وتوزيع بطاقات الدعوة الرقمية الفاخرة لحفلات الزفاف، التخرج، والمؤتمرات.

تتضمن البطاقة مساراً تفاعلياً دقيقاً لقاعة الاحتفال، زر تأكيد الحضور (RSVP) المباشر، جداراً رقمياً لتدوين التهاني، وعداً تنازلياً ينبه المدعوين في الوقت المناسب.`
        }
    ];

    // FAQ Data
    const faqs = [
        {
            q: 'ما هي منصة PalNovaa وكيف تفيدني؟',
            a: 'PalNovaa هي أول شبكة اجتماعية مكانية متكاملة تجمع بين الخرائط الذكية ثلاثية الأبعاد، الواقع المعزز (AR)، الجولات الافتراضية، والخدمات المجتمعية والبلدية لتمنحك وسيلة عصرية للتواصل واكتشاف كل ما يحيط بك.'
        },
        {
            q: 'كيف يمكنني تسجيل الدخول أو إنشاء حساب؟',
            a: 'يمكنك النقر على زر "تسجيل الدخول" في أعلى الصفحة للانتقال فوراً لصفحة تسجيل الدخول، حيث يمكنك الدخول بحسابك أو استخدام حساب Google بضغطة زر واحدة مجاناً.'
        },
        {
            q: 'هل يتطلب استخدام الكرة الأرضية ثلاثية الأبعاد تحميل أي برامج؟',
            a: 'لا، تعمل الكرة الأرضية وكافة تقنيات PalNovaa مباشرة على متصفح جهازك (حاسوب أو هاتف) وبأعلى سرعة وسلاسة بفضل تقنية WebGL الحديثة.'
        },
        {
            q: 'كيف تحافظ المنصة على خصوصية موقعي؟',
            a: 'تلتزم PalNovaa بأعلى معايير حماية الخصوصية وتشفير البيانات، ولا يتم مشاركة موقعك الدقيق إلا بموافقتك الكاملة وللأشخاص أو المعالم التي تختارها أنت.'
        },
        {
            q: 'ما هي ميزة الجيوبورتال للبلديات والمؤسسات؟',
            a: 'يتيح الجيوبورتال للبلديات رفع المخططات الهيكلية والأحواض والقطع وتسهيل المعاملات العقارية والمكانية للمواطنين بشفافية وسرعة رقمية.'
        }
    ];

    // City Quick Jumps
    const worldCities = [
        { name: 'القدس', lat: 31.7683, lon: 35.2137, country: 'فلسطين' },
        { name: 'رام الله', lat: 31.9038, lon: 35.2034, country: 'فلسطين' },
        { name: 'غزة', lat: 31.5017, lon: 34.4668, country: 'فلسطين' },
        { name: 'نابلس', lat: 32.2211, lon: 35.2544, country: 'فلسطين' },
        { name: 'الخليل', lat: 31.5326, lon: 35.0998, country: 'فلسطين' },
        { name: 'عمان', lat: 31.9454, lon: 35.9284, country: 'الأردن' },
        { name: 'دبي', lat: 25.2048, lon: 55.2708, country: 'الإمارات' },
        { name: 'الرياض', lat: 24.7136, lon: 46.6753, country: 'السعودية' },
        { name: 'القاهرة', lat: 30.0444, lon: 31.2357, country: 'مصر' },
        { name: 'بيروت', lat: 33.8938, lon: 35.5018, country: 'لبنان' },
        { name: 'لندن', lat: 51.5074, lon: -0.1278, country: 'المملكة المتحدة' },
        { name: 'نيويورك', lat: 40.7128, lon: -74.0060, country: 'الولايات المتحدة' }
    ];

    return (
        <div className="home-container">
            {/* ================= TOP NAVIGATION BAR ================= */}
            <header className="home-header">
                <div className="header-inner">
                    {/* Brand Logo */}
                    <div className="home-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="brand-icon-box">
                            <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-pin-svg">
                                <path d="M32 2C16.536 2 4 14.536 4 30c0 19 22 44 26.2 48.2a2.55 2.55 0 0 0 3.6 0C38 74 60 49 60 30 60 14.536 47.464 2 32 2Z" fill="#fff" />
                                <circle cx="32" cy="29" r="11" fill="#fbab15" />
                            </svg>
                        </div>
                        <div className="brand-text">
                            <span className="brand-name">PalNovaa</span>
                            <span className="brand-tag">Spatial Social</span>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="home-nav-links">
                        <a href="#hero" className="nav-link active">الرئيسية</a>
                        <a href="#services" className="nav-link">الخدمات</a>
                        <a href="#features" className="nav-link">المميزات</a>
                        <a href="#blog" className="nav-link">المدونة</a>
                        <a href="#faq" className="nav-link">الأسئلة الشائعة</a>
                    </nav>

                    {/* Header Action Buttons */}
                    <div className="header-actions">
                        <button
                            className="btn-header-login"
                            onClick={() => navigate('/login')}
                            id="btn-nav-login"
                        >
                            تسجيل الدخول
                        </button>
                        <button
                            className="btn-header-register"
                            onClick={() => navigate('/login', { state: { mode: 'register' } })}
                            id="btn-nav-register"
                        >
                            <span>ابدأ الآن مجاناً</span>
                            <span className="btn-arrow">←</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ================= HERO SECTION WITH 3D GLOBE ================= */}
            <section id="hero" className="hero-section">
                <div className="hero-grid-ambient"></div>
                <div className="hero-glow-ambient"></div>

                <div className="hero-content-wrapper">
                    {/* Right / Text Hero Content */}
                    <div className="hero-text-col">
                        <div className="hero-badge">
                            <span className="badge-pulse"></span>
                            <span>الجيل الجديد من الخرائط الاجتماعية المكانية ثلاثية الأبعاد</span>
                        </div>

                        <h1 className="hero-title">
                            استكشف كوكبك، تواصل مع مدينتك، وعِش تجربة العالم <span className="title-highlight">بأبعاد ثلاثية</span>
                        </h1>

                        <p className="hero-description">
                            منصة <strong>PalNovaa</strong> تدمج الخرائط المكانية الذكية مع الواقع المعزز (AR)، الجولات الافتراضية 360، ونظم الجيوبورتال الحضرية لتقريبك من كل ما يهمك حولك بأقصى درجات الإبداع والدقة.
                        </p>

                        <div className="hero-cta-group">
                            <button
                                className="btn-cta-primary"
                                onClick={() => navigate('/login')}
                            >
                                <span className="cta-glow"></span>
                                <span>دخول الخريطة الآن</span>
                                <span className="icon">🚀</span>
                            </button>

                            <a href="#services" className="btn-cta-secondary">
                                <span>استكشف الخدمات</span>
                                <span className="icon">⬇</span>
                            </a>
                        </div>

                        {/* Quick Live Stats in Hero */}
                        <div className="hero-stats-row">
                            <div className="hero-stat-card">
                                <div className="stat-value">+50K</div>
                                <div className="stat-label">معلم وموقع مسجل</div>
                            </div>
                            <div className="hero-stat-divider"></div>
                            <div className="hero-stat-card">
                                <div className="stat-value">3D &amp; AR</div>
                                <div className="stat-label">واقع معزز فوري</div>
                            </div>
                            <div className="hero-stat-divider"></div>
                            <div className="hero-stat-card">
                                <div className="stat-value">100%</div>
                                <div className="stat-label">تغطية جغرافية حية</div>
                            </div>
                        </div>
                    </div>

                    {/* Left / 3D Globe Interactive Visualization */}
                    <div className="hero-globe-col">
                        <div className="globe-card-container">
                            <div className="globe-header-hud">
                                <div className="hud-title-wrap">
                                    <span className="globe-status-dot"></span>
                                    <span className="globe-hud-text">محاكاة الكرة الأرضية الحية (Live 3D Globe)</span>
                                </div>
                                <div className="globe-hud-tip">💡 اسحب للتمرير والتدوير ثلاثي الأبعاد</div>
                            </div>

                            {/* 3D Earth Component */}
                            <div className="globe-canvas-wrapper">
                                <EarthGlobe
                                    targetCity={activeCity}
                                    onLocationFound={(loc) => setLiveLocationCoords(loc)}
                                />
                            </div>

                            {/* Live Coordinates Footer Ribbon */}
                            <div className="globe-footer-hud">
                                <div className="hud-metric">
                                    <span className="label">الحالة:</span>
                                    <span className="val success">متصل بالرادار</span>
                                </div>
                                <div className="hud-metric">
                                    <span className="label">الوضع:</span>
                                    <span className="val">WebGL 3D Accelerated</span>
                                </div>
                                {liveLocationCoords && (
                                    <div className="hud-metric">
                                        <span className="label">إحداثياتك:</span>
                                        <span className="val highlight">{liveLocationCoords.lat}°, {liveLocationCoords.lon}°</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* City Quick Flyover Bar */}
                <div className="city-flyover-bar">
                    <div className="flyover-title">
                        <span>✈️ محطات التحليق السريع:</span>
                    </div>
                    <div className="flyover-scroll">
                        {worldCities.map((city) => (
                            <button
                                key={city.name}
                                className={`flyover-chip ${activeCity?.name === city.name ? 'active' : ''}`}
                                onClick={() => setActiveCity(city)}
                            >
                                <span className="city-flag">📍</span>
                                <span className="city-name">{city.name}</span>
                                <span className="country-sub">{city.country}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================= SERVICES SECTION ================= */}
            <section id="services" className="section-block services-section">
                <div className="section-header">
                    <div className="section-tag">⚡ منظومة خدماتنا المتكاملة</div>
                    <h2 className="section-title">حلول مبتكرة مصممة لربط الإنسان بالمكان</h2>
                    <p className="section-subtitle">
                        نقدم باقة فريدة من الأدوات المتقدمة التي تدمج التفاعل الاجتماعي بالموقع الجغرافي والواقع المعزز.
                    </p>
                </div>

                <div className="services-grid">
                    {/* Service 1 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap amber-glow">
                            <span className="service-icon">🗺️</span>
                        </div>
                        <h3 className="service-title">الخريطة الاجتماعية المكانية</h3>
                        <p className="service-desc">
                            شبكة اجتماعية تفاعلية ترتبط بالواقع. استكشف منشورات الأصدقاء، قصص الأماكن، والفعاليات القريبة منك على خريطة حية لحظة بلحظة.
                        </p>
                        <div className="service-features-list">
                            <span>✓ نشر قصص مكانية (Spatial Reels)</span>
                            <span>✓ غرف محادثة جغرافية حية</span>
                            <span>✓ اكتشاف الأصدقاء والمجتمعات</span>
                        </div>
                        <div className="service-action-link">
                            <span>جرب الخريطة الآن</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>

                    {/* Service 2 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap cyan-glow">
                            <span className="service-icon">👓</span>
                        </div>
                        <h3 className="service-title">الواقع المعزز الذكي (AR View)</h3>
                        <p className="service-desc">
                            وجه كاميرا هاتفك نحو أي شارع أو معلم لتشاهد فوراً طبقات الواقع المعزز ثلاثية الأبعاد، إرشادات الملاحة، ومعلومات المتاجر المحيطة.
                        </p>
                        <div className="service-features-list">
                            <span>✓ رصد المعالم بالكاميرا الحية</span>
                            <span>✓ أسهم وتوجيهات ثلاثية الأبعاد</span>
                            <span>✓ فحص المنتجات والعروض القريبة</span>
                        </div>
                        <div className="service-action-link">
                            <span>استكشف الواقع المعزز</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>

                    {/* Service 3 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap purple-glow">
                            <span className="service-icon">🔄</span>
                        </div>
                        <h3 className="service-title">الجولات الافتراضية 360°</h3>
                        <p className="service-desc">
                            تجول داخل الجامعات، المعالم التاريخية، المنشآت السياحية، وقاعات المناسبات بدقة بانورامية فائقة مع نقاط تفاعلية غنية.
                        </p>
                        <div className="service-features-list">
                            <span>✓ صور بانورامية كروية عالية الجودة</span>
                            <span>✓ نقاط توجيه ذكية داخل المنشآت</span>
                            <span>✓ دعم التصفح عبر النظارات والشاشات</span>
                        </div>
                        <div className="service-action-link">
                            <span>ابدأ الجولة الافتراضية</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>

                    {/* Service 4 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap green-glow">
                            <span className="service-icon">🏛️</span>
                        </div>
                        <h3 className="service-title">الجيوبورتال والتخطيط الحضري</h3>
                        <p className="service-desc">
                            نظام متطور للبلديات والمؤسسات لإدارة ونشر المخططات الهيكلية، الأحواض والقطع، وتسهيل معاملات تراخيص البناء للمواطنين.
                        </p>
                        <div className="service-features-list">
                            <span>✓ استعراض وتنزيل مخططات الأحواض</span>
                            <span>✓ طبقات GIS تفاعلية متقدمة</span>
                            <span>✓ إفادات الموقع وتراخيص الأراضي</span>
                        </div>
                        <div className="service-action-link">
                            <span>استكشف الجيوبورتال</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>

                    {/* Service 5 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap rose-glow">
                            <span className="service-icon">💌</span>
                        </div>
                        <h3 className="service-title">بطاقات الدعوة الرقمية الذكية</h3>
                        <p className="service-desc">
                            صمم وشارك دعوات رقمية فاخرة للأعراس والتخرج مع مسار ملاحة دقيق، تأكيد حضور إلكتروني (RSVP)، وسجل تهاني تفاعلي.
                        </p>
                        <div className="service-features-list">
                            <span>✓ تصاميم تفاعلية بمؤثرات سينمائية</span>
                            <span>✓ ربط مباشر بمسارات الوصول</span>
                            <span>✓ جدار أمنيات وتهاني المدعوين</span>
                        </div>
                        <div className="service-action-link">
                            <span>صمم بطاقتك الذكية</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>

                    {/* Service 6 */}
                    <div className="service-card" onClick={() => navigate('/login')}>
                        <div className="service-icon-wrap gold-glow">
                            <span className="service-icon">🛍️</span>
                        </div>
                        <h3 className="service-title">دليل الأماكن والمتاجر المعتمدة</h3>
                        <p className="service-desc">
                            منظومة شاملة للمتاجر والمطاعم والخدمات تمكن أصحاب الأعمال من الترويج لمنتجاتهم والوصول للزبائن في نطاقهم الجغرافي.
                        </p>
                        <div className="service-features-list">
                            <span>✓ صفحات ومتاجر إلكترونية مصغرة</span>
                            <span>✓ عروض وخصومات جغرافية حية</span>
                            <span>✓ تقييمات موثقة من زوار المكان</span>
                        </div>
                        <div className="service-action-link">
                            <span>تصفح المتاجر القريبة</span>
                            <span className="arrow">←</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= FEATURES SPOTLIGHT ================= */}
            <section id="features" className="section-block features-section">
                <div className="features-container-card">
                    <div className="features-content">
                        <div className="section-tag">🌟 لماذا تختار PalNovaa؟</div>
                        <h2 className="features-main-title">سرعة فائقة، أمان متين، وتجربة ثلاثية الأبعاد سلسة</h2>
                        <p className="features-lead">
                            بنيت منصة بالنوفا بأحدث المعايير البرمجية لتقديم أداء سريع وخفيف على متصفح الحاسوب دون الحاجة لتثبيت برامج ثقيلة.
                        </p>

                        <div className="feature-bullets-grid">
                            <div className="feature-bullet">
                                <div className="bullet-icon">⚡</div>
                                <div className="bullet-body">
                                    <h4>أداء 60 إطار بالثانية (60 FPS)</h4>
                                    <p>محرك رسومي مبني على WebGL يضمن سلاسة الحركة وسرعة تحميل الخرائط ثلاثية الأبعاد.</p>
                                </div>
                            </div>

                            <div className="feature-bullet">
                                <div className="bullet-icon">🔒</div>
                                <div className="bullet-body">
                                    <h4>حماية الخصوصية وتشفير كامل</h4>
                                    <p>بيانات موقعك ومحادثاتك مشفرة ومحمية وفق أعلى معايير الأمان الدولية.</p>
                                </div>
                            </div>

                            <div className="feature-bullet">
                                <div className="bullet-icon">📱</div>
                                <div className="bullet-body">
                                    <h4>تطبيق ويب تقدمي (PWA)</h4>
                                    <p>إمكانية التثبيت المباشر على سطح المكتب أو شاشة هاتفك مع العمل في وضع عدم الاتصال.</p>
                                </div>
                            </div>

                            <div className="feature-bullet">
                                <div className="bullet-icon">🌐</div>
                                <div className="bullet-body">
                                    <h4>دعم التوطين واللغة العربية</h4>
                                    <p>واجهة عربية أصيلة مصممة خصيصاً للمستخدم العربي بأدق التفاصيل والخطوط الحديثة.</p>
                                </div>
                            </div>
                        </div>

                        <div className="features-action-row">
                            <button className="btn-features-start" onClick={() => navigate('/login')}>
                                <span>ابدأ التجربة الآن</span>
                                <span className="arrow">←</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= BLOG & ARTICLES SECTION ================= */}
            <section id="blog" className="section-block blog-section">
                <div className="section-header">
                    <div className="section-tag">📰 المدونة والمقالات</div>
                    <h2 className="section-title">أحدث الأفكار، الرؤى، والتطورات المكانية</h2>
                    <p className="section-subtitle">
                        اكتشف مقالات متخصصة حول تكنولوجيا الخرائط، الواقع المعزز، ومستقبل المدن الذكية.
                    </p>
                </div>

                <div className="blog-cards-grid">
                    {articles.map((article) => (
                        <div
                            key={article.id}
                            className="blog-card"
                            onClick={() => setSelectedArticle(article)}
                        >
                            <div className="blog-image-wrapper">
                                <img src={article.image} alt={article.title} className="blog-thumb" loading="lazy" />
                                <span className="blog-category-badge">{article.category}</span>
                            </div>
                            <div className="blog-body">
                                <div className="blog-meta">
                                    <span>📅 {article.date}</span>
                                    <span>⏱️ {article.readTime}</span>
                                </div>
                                <h3 className="blog-card-title">{article.title}</h3>
                                <p className="blog-card-excerpt">{article.excerpt}</p>
                                <div className="blog-read-more">
                                    <span>اقرأ المقال كاملاً</span>
                                    <span className="arrow">←</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Article Detail Modal */}
            {selectedArticle && (
                <div className="article-modal-overlay" onClick={() => setSelectedArticle(null)}>
                    <div className="article-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button className="article-modal-close" onClick={() => setSelectedArticle(null)}>✕</button>
                        <div className="article-modal-hero">
                            <img src={selectedArticle.image} alt={selectedArticle.title} />
                            <div className="article-modal-badge">{selectedArticle.category}</div>
                        </div>
                        <div className="article-modal-content">
                            <div className="article-modal-meta">
                                <span>📅 {selectedArticle.date}</span>
                                <span>⏱️ وقت القراءة: {selectedArticle.readTime}</span>
                            </div>
                            <h2 className="article-modal-title">{selectedArticle.title}</h2>
                            <div className="article-modal-text">
                                {selectedArticle.content.split('\n\n').map((para, i) => (
                                    <p key={i}>{para}</p>
                                ))}
                            </div>
                            <div className="article-modal-footer">
                                <button className="btn-article-share" onClick={() => navigate('/login')}>
                                    <span>شارك على PalNovaa</span>
                                    <span>🚀</span>
                                </button>
                                <button className="btn-article-close-secondary" onClick={() => setSelectedArticle(null)}>
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= FAQ SECTION ================= */}
            <section id="faq" className="section-block faq-section">
                <div className="section-header">
                    <div className="section-tag">❓ مركز المساعدة</div>
                    <h2 className="section-title">الأسئلة الشائعة</h2>
                    <p className="section-subtitle">إجابات سريعة وواضحة على أكثر الأسئلة تكراراً حول المنصة</p>
                </div>

                <div className="faq-accordion-list">
                    {faqs.map((faq, idx) => (
                        <div
                            key={idx}
                            className={`faq-item ${activeFaq === idx ? 'open' : ''}`}
                            onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        >
                            <div className="faq-question-bar">
                                <span className="faq-question-text">{faq.q}</span>
                                <span className="faq-toggle-icon">{activeFaq === idx ? '−' : '+'}</span>
                            </div>
                            {activeFaq === idx && (
                                <div className="faq-answer-box">
                                    <p>{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ================= CTA BANNER ================= */}
            <section className="cta-banner-section">
                <div className="cta-banner-card">
                    <div className="cta-content">
                        <h2 className="cta-heading">جاهز لتجربة العالم بشكل مختلف؟</h2>
                        <p className="cta-sub">
                            انضم الآن إلى آلاف المستخدمين والمجتمعات على PalNovaa واستكشف مدينتك بلمسة واحدة.
                        </p>
                        <div className="cta-buttons-row">
                            <button className="btn-cta-main" onClick={() => navigate('/login')}>
                                <span>تسجيل الدخول / إنشاء حساب</span>
                                <span className="arrow">←</span>
                            </button>
                            <Link to="/support" className="btn-cta-outline">
                                الدعم الفني والمساعدة
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= FOOTER ================= */}
            <footer className="home-footer">
                <div className="footer-inner">
                    <div className="footer-top-grid">
                        <div className="footer-brand-col">
                            <div className="footer-brand">
                                <div className="brand-icon-box">
                                    <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-pin-svg">
                                        <path d="M32 2C16.536 2 4 14.536 4 30c0 19 22 44 26.2 48.2a2.55 2.55 0 0 0 3.6 0C38 74 60 49 60 30 60 14.536 47.464 2 32 2Z" fill="#fff" />
                                        <circle cx="32" cy="29" r="11" fill="#fbab15" />
                                    </svg>
                                </div>
                                <span className="brand-title">PalNovaa</span>
                            </div>
                            <p className="footer-desc">
                                شبكة اجتماعية مكانية ذكية تجمع بين الخرائط ثلاثية الأبعاد، الواقع المعزز، والجولات الافتراضية لتقريبك من مجتمعك.
                            </p>
                            <div className="footer-credits-badge">
                                <span>Built with passion by <strong>Mohammed Housheya</strong> &amp; <strong>Momen Kalefh</strong></span>
                            </div>
                        </div>

                        <div className="footer-links-col">
                            <h4>روابط سريعة</h4>
                            <ul>
                                <li><a href="#hero">الرئيسية</a></li>
                                <li><a href="#services">الخدمات</a></li>
                                <li><a href="#features">المميزات</a></li>
                                <li><a href="#blog">المدونة والمقالات</a></li>
                            </ul>
                        </div>

                        <div className="footer-links-col">
                            <h4>الخدمات والحلول</h4>
                            <ul>
                                <li><span onClick={() => navigate('/login')}>الخريطة الاجتماعية</span></li>
                                <li><span onClick={() => navigate('/login')}>الواقع المعزز (AR)</span></li>
                                <li><span onClick={() => navigate('/login')}>الجولات الافتراضية</span></li>
                                <li><span onClick={() => navigate('/login')}>الجيوبورتال الحضري</span></li>
                            </ul>
                        </div>

                        <div className="footer-links-col">
                            <h4>الشروط والمساعدة</h4>
                            <ul>
                                <li><Link to="/terms">شروط الاستخدام</Link></li>
                                <li><Link to="/privacy">سياسة الخصوصية</Link></li>
                                <li><Link to="/support">مركز الدعم والمساعدة</Link></li>
                                <li><span onClick={() => navigate('/login')}>تسجيل الدخول</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="footer-bottom-bar">
                        <p>© {new Date().getFullYear()} PalNovaa. جميع الحقوق محفوظة.</p>
                        <p className="footer-built">PalNovaa Spatial Network Platform</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
