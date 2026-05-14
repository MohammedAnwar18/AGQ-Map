// Coffee Lab — Mobile App version
const { useState, useEffect, useRef } = React;
const Icons = window.CLIcons;
const { CATEGORIES, FEATURED, TIMELINE } = window.CL_DATA;
const { CLSeal } = window;

const TWEAKS_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "charcoal",
  "showLabRings": true
}/*EDITMODE-END*/;

const PALETTES = {
  charcoal: { bg: '#F5F1EA', ink: '#2A2A2C', accent: '#7B4A2A', soft: '#EAE3D6', muted: '#8A857C' },
  espresso: { bg: '#EFE9DD', ink: '#221814', accent: '#A55B2A', soft: '#E2D8C5', muted: '#7C6E5F' },
  matcha:   { bg: '#F1EFE6', ink: '#1F2A22', accent: '#5C7A3A', soft: '#E0E5D4', muted: '#7A8470' },
  cocoa:    { bg: '#EDE3D8', ink: '#241712', accent: '#8B3A1F', soft: '#DDCFBE', muted: '#7E6A5D' },
};

// ─────────────────────── ROOT
function MobileApp() {
  const [t, setT] = window.useTweaks(TWEAKS_DEFAULTS);
  const palette = PALETTES[t.palette] || PALETTES.charcoal;

  const [tab, setTab] = useState('home');
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(null);

  const addToCart = (item) => {
    setCart((c) => {
      const ex = c.find(x => x.id === item.id);
      if (ex) return c.map(x => x.id===item.id ? {...x, qty: x.qty+1} : x);
      return [...c, { ...item, qty: 1 }];
    });
  };
  const updateQty = (id, d) => setCart(c => c.map(x => x.id===id ? {...x, qty: Math.max(0, x.qty+d)} : x).filter(x=>x.qty>0));

  const cartCount = cart.reduce((s,x)=>s + x.qty, 0);
  const cartTotal = cart.reduce((s,x)=>s + x.price*x.qty, 0);

  const screenStyle = {
    '--bg': palette.bg, '--ink': palette.ink, '--accent': palette.accent,
    '--soft': palette.soft, '--muted': palette.muted,
  };

  return (
    <div className="m-stage" style={{ padding: 0 }}>
      <div className="m-app" style={{ ...screenStyle, width: '100%', height: '100%' }} dir="rtl">
        {tab === 'home'    && <HomeScreen onAdd={addToCart} onCat={(c)=>{setActiveCat(c); setTab('menu');}} setTab={setTab} cartCount={cartCount}/>}
        {tab === 'menu'    && <MenuScreen activeCat={activeCat} setActiveCat={setActiveCat} showRings={t.showLabRings} onAdd={addToCart} setTab={setTab} cartCount={cartCount}/>}
        {tab === 'map'     && <MapScreen setTab={setTab} cartCount={cartCount}/>}
        {tab === 'cart'    && <CartScreen cart={cart} updateQty={updateQty} total={cartTotal} setTab={setTab}/>}
        {tab === 'profile' && <ProfileScreen />}
        <TabBar tab={tab} setTab={setTab} cartCount={cartCount} />
      </div>
    </div>
  );
}

// ─────────────────────── HOME
function HomeScreen({ onAdd, onCat, setTab, cartCount }) {
  return (
    <div className="m-screen">
      <AppHeader onCart={()=>setTab('cart')} cartCount={cartCount}/>

      {/* Hero card */}
      <section className="m-pad m-hero">
        <div className="m-eyebrow">
          <span className="m-eyebrow-mark">01</span>
          <span>سلسلة الربيع · 2026</span>
        </div>
        <h1 className="m-hero-h1">القهوة <em>كتجربة</em><br/>مُختبرة بدقة.</h1>

        <div className="m-hero-card">
          <div className="m-photo-slot"><span>SIGNATURE DRINK</span></div>
          <div className="m-hero-card-foot">
            <div>
              <div className="m-mono">N° 014</div>
              <div className="m-hero-card-title">Cold Brew · 18h</div>
            </div>
            <div className="m-pill">طازج اليوم</div>
          </div>
        </div>
      </section>

      {/* Live social map ribbon */}
      <section className="m-pad">
        <div className="m-social-card" onClick={()=>setTab('map')}>
          <div className="m-live-dot"></div>
          <div className="m-social-text">
            <div className="m-live-label">42 شخص في الكافيه الآن</div>
            <div className="m-mono">على الخريطة الاجتماعية · حدّث الآن</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
        </div>
      </section>

      {/* Categories quick grid */}
      <SectionHead num="02" eyebrow="MENU" title="استعرض الأقسام"/>
      <div className="m-pad m-quick-grid">
        {CATEGORIES.slice(0, 8).map((c, i) => {
          const Icon = Icons[c.id];
          return (
            <button className="m-quick-tile" key={c.id} onClick={()=>onCat(c.id)}>
              <div className="m-quick-ring">
                <Icon size={32}/>
              </div>
              <div className="m-quick-label">{c.ar}</div>
              <div className="m-mono m-quick-count">{c.count}</div>
            </button>
          );
        })}
      </div>
      <button className="m-link" onClick={()=>{setTab('menu');}}>
        <span>كل الأقسام (16)</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
      </button>

      {/* Featured carousel */}
      <SectionHead num="03" eyebrow="SIGNATURE" title="الأكثر طلباً"/>
      <div className="m-h-scroll">
        {FEATURED.map(f => {
          const Icon = Icons[f.cat];
          return (
            <article className="m-feat-card" key={f.id}>
              <div className="m-feat-tag">{f.tag}</div>
              <div className="m-feat-icon"><Icon size={52}/></div>
              <div className="m-feat-name">{f.name}</div>
              <div className="m-mono m-feat-sub">{f.sub}</div>
              <p>{f.desc}</p>
              <div className="m-feat-foot">
                <div className="m-price">
                  <span className="m-mono">JOD</span>
                  <b>{f.price.toFixed(2)}</b>
                </div>
                <button className="m-add-btn" onClick={()=>onAdd(f)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Lab readout */}
      <SectionHead num="04" eyebrow="LAB DIARY" title="قياسات اليوم"/>
      <div className="m-pad">
        <div className="m-readout">
          <div className="m-readout-row"><span>درجة الاستخراج</span><b>92.4°</b></div>
          <div className="m-readout-row"><span>زمن التخمير</span><b>04:22</b></div>
          <div className="m-readout-row"><span>الحموضة</span><b>4.8 pH</b></div>
          <div className="m-readout-bar"><div style={{width:'72%'}}></div></div>
          <div className="m-mono m-readout-foot">CL · LAB INSTRUMENT v2.6</div>
        </div>
      </div>

      {/* Footer card */}
      <div className="m-pad m-bot-pad">
        <div className="m-foot-card">
          <CLSeal size={48}/>
          <div className="m-mono">EST. 2021 · AMMAN</div>
          <div className="m-foot-line">تحميص يومي · قياس دقيق · شفافية كاملة</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── MENU
function MenuScreen({ activeCat, setActiveCat, showRings, onAdd, setTab, cartCount }) {
  const [q, setQ] = useState('');
  const filtered = CATEGORIES.filter(c =>
    !q || c.ar.includes(q) || c.en.toLowerCase().includes(q.toLowerCase())
  );
  const list = activeCat ? filtered.filter(c => c.id === activeCat) : filtered;

  return (
    <div className="m-screen">
      <AppHeader title="المنيو" sub="MENU · 16 صنف" onBack={()=>setTab('home')} onCart={()=>setTab('cart')} cartCount={cartCount}/>
      <div className="m-pad m-search-wrap">
        <div className="m-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input placeholder="ابحث في القهوة، المخبوزات…" value={q} onChange={(e)=>setQ(e.target.value)}/>
        </div>
      </div>

      <div className="m-pad m-chip-row">
        <button className={'m-chip ' + (!activeCat?'is-on':'')} onClick={()=>setActiveCat(null)}>الكل</button>
        {['coffee','hot','cold','matcha','smoothie'].map(id => {
          const c = CATEGORIES.find(x=>x.id===id);
          return (
            <button key={id} className={'m-chip ' + (activeCat===id?'is-on':'')} onClick={()=>setActiveCat(id===activeCat?null:id)}>
              {c.ar}
            </button>
          );
        })}
      </div>

      <div className="m-pad m-menu-grid">
        {list.map((c, idx) => {
          const Icon = Icons[c.id];
          return (
            <article className="m-menu-card" key={c.id}>
              <div className="m-menu-top">
                <span className="m-mono">N° {String(idx+1).padStart(3,'0')}</span>
                <span className="m-mono m-menu-count">{c.count}</span>
              </div>
              <div className={'m-icon-wrap ' + (showRings?'has-rings':'')}>
                {showRings && <>
                  <div className="m-icon-ring r1"></div>
                  <div className="m-icon-ring r2"></div>
                </>}
                <Icon size={44}/>
              </div>
              <div className="m-menu-foot">
                <div className="m-menu-ar">{c.ar}</div>
                <div className="m-mono m-menu-en">{c.en}</div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="m-bot-pad"></div>
    </div>
  );
}

// ─────────────────────── MAP
function MapScreen({ setTab, cartCount }) {
  return (
    <div className="m-screen">
      <AppHeader title="الموقع" sub="MAP · حيّ الرينبو" onBack={()=>setTab('home')} onCart={()=>setTab('cart')} cartCount={cartCount}/>
      <div className="m-pad">
        <div className="m-map-card">
          <svg width="100%" height="240" viewBox="0 0 380 240" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="mgrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M28 0H0V28" fill="none" stroke="var(--soft)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="380" height="240" fill="var(--bg)"/>
            <rect width="380" height="240" fill="url(#mgrid)"/>
            <path d="M0 130 Q120 110 200 130 T380 110" stroke="var(--muted)" strokeWidth="20" fill="none" opacity="0.18"/>
            <path d="M0 130 Q120 110 200 130 T380 110" stroke="var(--bg)" strokeWidth="12" fill="none"/>
            <path d="M210 0 L195 240" stroke="var(--muted)" strokeWidth="16" fill="none" opacity="0.18"/>
            <path d="M210 0 L195 240" stroke="var(--bg)" strokeWidth="9" fill="none"/>
            <rect x="30" y="30" width="120" height="80" fill="var(--soft)" opacity="0.6" rx="2"/>
            <rect x="250" y="30" width="110" height="90" fill="var(--soft)" opacity="0.6" rx="2"/>
            <rect x="30" y="160" width="140" height="60" fill="var(--soft)" opacity="0.6" rx="2"/>
            <rect x="240" y="150" width="120" height="70" fill="var(--soft)" opacity="0.6" rx="2"/>
            <g transform="translate(200 128)">
              <circle r="30" fill="var(--accent)" opacity="0.12"/>
              <circle r="18" fill="var(--accent)" opacity="0.25"/>
              <circle r="9" fill="var(--accent)"/>
              <circle r="3" fill="var(--bg)"/>
            </g>
          </svg>
          <div className="m-map-tip">
            <div className="m-mono">CL · 31.95°N · 35.93°E</div>
            <div>Coffee Lab · الفرع الرئيسي</div>
          </div>
        </div>
      </div>

      <div className="m-pad m-info-list">
        <div className="m-info-row">
          <div className="m-mono">العنوان</div>
          <div>شارع الرينبو · جبل عمّان · الأردن</div>
        </div>
        <div className="m-info-row">
          <div className="m-mono">ساعات العمل</div>
          <div>
            <div>الأحد — الخميس · 07:00 – 23:00</div>
            <div>الجمعة — السبت · 08:00 – 01:00</div>
          </div>
        </div>
        <div className="m-info-row">
          <div className="m-mono">تواصل</div>
          <div>
            <div>+962 7 9000 0000</div>
            <div>hello@coffeelab.jo</div>
          </div>
        </div>
        <div className="m-info-row m-live-row">
          <div className="m-live-dot"></div>
          <div>
            <div className="m-live-label">42 شخص هنا الآن</div>
            <div className="m-mono">على الخريطة الاجتماعية</div>
          </div>
        </div>
      </div>
      <div className="m-pad">
        <button className="m-btn m-btn-primary m-btn-full">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <span>افتح في الخرائط</span>
        </button>
      </div>
      <div className="m-bot-pad"></div>
    </div>
  );
}

// ─────────────────────── CART
function CartScreen({ cart, updateQty, total, setTab }) {
  return (
    <div className="m-screen">
      <AppHeader title="السلة" sub={'ORDER · N° 0042'} onBack={()=>setTab('home')}/>
      <div className="m-pad">
        {cart.length === 0 && (
          <div className="m-empty">
            <CLSeal size={70}/>
            <p>سلتك فارغة. جرّب إضافة "لاتيه المختبر" من الصفحة الرئيسية.</p>
          </div>
        )}
        {cart.length > 0 && (
          <div className="m-cart-list">
            {cart.map(item => {
              const Icon = Icons[item.cat];
              return (
                <div className="m-cart-item" key={item.id}>
                  <div className="m-cart-icon"><Icon size={36}/></div>
                  <div className="m-cart-mid">
                    <div className="m-cart-name">{item.name}</div>
                    <div className="m-mono">{item.sub}</div>
                    <div className="m-qty">
                      <button onClick={()=>updateQty(item.id, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={()=>updateQty(item.id, +1)}>+</button>
                    </div>
                  </div>
                  <div className="m-cart-price">
                    <span className="m-mono">JOD</span>
                    <b>{(item.price*item.qty).toFixed(2)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="m-pad m-checkout">
          <div className="m-total">
            <span>المجموع</span>
            <b><span className="m-mono">JOD</span> {total.toFixed(2)}</b>
          </div>
          <button className="m-btn m-btn-primary m-btn-full">
            <span>إتمام الطلب</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 6 8 12l6 6"/></svg>
          </button>
        </div>
      )}
      <div className="m-bot-pad"></div>
    </div>
  );
}

// ─────────────────────── PROFILE
function ProfileScreen() {
  return (
    <div className="m-screen">
      <AppHeader title="الحساب" sub="PROFILE"/>
      <div className="m-pad">
        <div className="m-profile-card">
          <div className="m-avatar"><CLSeal size={48}/></div>
          <div>
            <div className="m-profile-name">ضيف Coffee Lab</div>
            <div className="m-mono">N° MEMBER · NEW</div>
          </div>
          <button className="m-pill m-pill-strong">دخول</button>
        </div>

        <div className="m-profile-stats">
          <div><b>12</b><span>طلب</span></div>
          <div><b>4</b><span>مفضّل</span></div>
          <div><b>120</b><span>نقطة</span></div>
        </div>

        <div className="m-info-list">
          <button className="m-info-row m-clickable">
            <div className="m-mono">طلباتي</div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
          <button className="m-info-row m-clickable">
            <div className="m-mono">المفضّل</div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
          <button className="m-info-row m-clickable">
            <div className="m-mono">إشعارات</div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
          <button className="m-info-row m-clickable">
            <div className="m-mono">عن Coffee Lab</div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
          </button>
        </div>
      </div>
      <div className="m-bot-pad"></div>
    </div>
  );
}

// ─────────────────────── APP HEADER
function AppHeader({ title, sub, onBack, onCart, cartCount }) {
  return (
    <header className="m-app-header">
      {onBack ? (
        <button className="m-icon-btn" onClick={onBack} aria-label="رجوع">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 6-6 6 6 6"/></svg>
        </button>
      ) : (
        <div style={{width: 38}}></div>
      )}
      <div className="m-app-header-left">
        {title ? (
          <>
            <div className="m-mono m-app-header-sub">{sub}</div>
            <div className="m-app-header-title">{title}</div>
          </>
        ) : (
          <>
            <div className="m-mono m-app-header-sub">مساء الخير</div>
            <div className="m-app-header-title">Coffee Lab</div>
          </>
        )}
      </div>
      <button className="m-icon-btn" onClick={onCart} aria-label="السلة">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 6h2l2 12h11l2-9H7"/><circle cx="10" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/></svg>
        {cartCount > 0 && <span className="m-icon-badge">{cartCount}</span>}
      </button>
    </header>
  );
}

// ─────────────────────── SECTION HEAD
function SectionHead({ num, eyebrow, title }) {
  return (
    <div className="m-pad m-sec-head">
      <div className="m-mono m-sec-num">{num}</div>
      <div>
        <div className="m-mono m-sec-eye">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
    </div>
  );
}

// ─────────────────────── TAB BAR
function TabBar({ tab, setTab, cartCount }) {
  const tabs = [
    { id: 'home',    label: 'الرئيسية', icon: 'home' },
    { id: 'menu',    label: 'المنيو',   icon: 'menu' },
    { id: 'map',     label: 'الموقع',   icon: 'map'  },
    { id: 'cart',    label: 'السلة',    icon: 'cart' },
    { id: 'profile', label: 'الحساب',   icon: 'user' },
  ];
  const Icon = ({ name, active }) => {
    const stroke = active ? 2 : 1.5;
    if (name === 'home') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11Z"/></svg>;
    if (name === 'menu') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><rect x="3" y="4" width="7" height="7" rx="1.2"/><rect x="14" y="4" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>;
    if (name === 'map')  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M12 22s-7-7-7-13a7 7 0 1 1 14 0c0 6-7 13-7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    if (name === 'cart') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M4 6h2l2 12h11l2-9H7"/><circle cx="10" cy="21" r="1.4"/><circle cx="18" cy="21" r="1.4"/></svg>;
    if (name === 'user') return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 22c1.5-5 5-7 8-7s6.5 2 8 7"/></svg>;
  };
  return (
    <nav className="m-tabbar">
      {tabs.map(tt => (
        <button key={tt.id} className={'m-tab ' + (tab===tt.id?'is-on':'')} onClick={()=>setTab(tt.id)}>
          <div className="m-tab-icon-wrap">
            <Icon name={tt.icon} active={tab===tt.id}/>
            {tt.id === 'cart' && cartCount > 0 && <span className="m-tab-badge">{cartCount}</span>}
          </div>
          <span>{tt.label}</span>
        </button>
      ))}
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp/>);
