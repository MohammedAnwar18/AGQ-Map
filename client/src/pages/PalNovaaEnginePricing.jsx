import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './PalNovaaEngine.css';

/* ============================================================================
   PalNovaa Engine — صفحة الأسعار  (/palnovaa-engine/pricing)
   بنفس هويّة المحرّك (.pne-root). خطّة Pro بـ$5. جاهزةٌ لـPaddle:
   تفتح الدفع تلقائياً إذا ضُبِط VITE_PADDLE_TOKEN + VITE_PADDLE_PRO_PRICE،
   وإلّا تعرض «قريباً» بدل دفعٍ وهميّ.
   ============================================================================ */

const API = import.meta.env.VITE_API_URL || '/api';
const DEF_TOKEN = import.meta.env.VITE_PADDLE_TOKEN || '';
const DEF_PRICE = import.meta.env.VITE_PADDLE_PRO_PRICE || '';
const DEF_ENV = import.meta.env.VITE_PADDLE_ENV || 'production';

const Check = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3DB37E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
const Dash = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A616B" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>;

const PLANS = [
  {
    id: 'free', name: 'Free', tag: 'للتجربة والبداية', price: '0', unit: '',
    cta: 'ابدأ مجاناً', feat: false,
    items: [
      { ok: true, t: '~10 توليدات في اليوم' },
      { ok: true, t: 'حتى 3 مشاريع محفوظة' },
      { ok: true, t: 'معاينة حيّة + رابط دائم /pe' },
      { ok: true, t: 'رفع GeoJSON / CSV' },
      { ok: false, t: 'نُسَخ وتراجع غير محدود' },
      { ok: false, t: 'أولويّة في التوليد' },
    ],
  },
  {
    id: 'pro', name: 'Pro', tag: 'للمحترفين والعمل الجادّ', price: '5', unit: '/ شهر',
    cta: 'اشترك بـ $5', feat: true, badge: 'الأكثر شيوعاً',
    items: [
      { ok: true, t: '~100 توليدة في اليوم' },
      { ok: true, t: 'مشاريع غير محدودة' },
      { ok: true, t: 'نُسَخ وتراجع كامل' },
      { ok: true, t: 'بثٌّ حيّ + إصلاحٌ ذاتيّ للأخطاء' },
      { ok: true, t: 'بيانات أكبر وأولويّة في التوليد' },
      { ok: true, t: 'بلا علامة ترويجيّة' },
    ],
  },
  {
    id: 'team', name: 'Team', tag: 'للفرق والمؤسّسات', price: 'حسب الطلب', unit: '',
    cta: 'تواصل معنا', feat: false,
    items: [
      { ok: true, t: 'كلّ مزايا Pro' },
      { ok: true, t: 'دومين مخصّص للتطبيقات' },
      { ok: true, t: 'أعضاء فريق ومشاريع مشتركة' },
      { ok: true, t: 'حدود أعلى ودعم مخصّص' },
    ],
  },
];

export default function PalNovaaEnginePricing() {
  const navigate = useNavigate();
  const [toast, setToast] = useState('');
  const [cfg, setCfg] = useState({ token: DEF_TOKEN, priceId: DEF_PRICE, env: DEF_ENV });
  const contoursRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2600); };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* خلفيّة الكونتور */
  useEffect(() => {
    const svg = contoursRef.current; if (!svg) return;
    svg.setAttribute('viewBox', '0 0 1200 800');
    let h = '';
    for (let i = 0; i < 16; i++) {
      const r = 60 + i * 42, cx = 640, cy = 300; let d = '';
      for (let a = 0; a <= 360; a += 6) {
        const t = a * Math.PI / 180, w = 1 + 0.12 * Math.sin(3 * t + i * 0.5) + 0.07 * Math.cos(5 * t - i * 0.3);
        d += (a ? 'L' : 'M') + (cx + Math.cos(t) * r * 1.35 * w).toFixed(1) + ' ' + (cy + Math.sin(t) * r * 0.8 * w).toFixed(1);
      }
      h += `<path d="${d}Z" fill="none" stroke="${i % 4 === 0 ? '#2B3038' : '#1A1E24'}" stroke-width="${i % 4 === 0 ? 1.1 : 0.8}"/>`;
      if (i === 5 || i === 9) h += `<path class="isoline" pathLength="1" d="${d}Z" fill="none" stroke="#E07B39" stroke-opacity="${i === 5 ? 0.85 : 0.5}" stroke-width="1.2" stroke-linecap="round" style="animation-duration:${i === 5 ? 18 : 26}s;${i === 9 ? 'animation-direction:reverse' : ''}"/>`;
    }
    svg.innerHTML = h;
  }, []);

  /* جلب إعداد الدفع من الخادم (قيمٌ عامّة) */
  useEffect(() => {
    fetch(`${API}/engine/billing-config`).then((r) => r.json()).then((d) => {
      if (d?.ok && (d.token || d.priceId)) setCfg({ token: d.token || DEF_TOKEN, priceId: d.priceId || DEF_PRICE, env: d.env || DEF_ENV });
    }).catch(() => {});
  }, []);

  /* تحميل Paddle.js فقط إن توفّر الـtoken */
  useEffect(() => {
    if (!cfg.token || window.Paddle) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    s.async = true;
    s.onload = () => {
      try {
        if (cfg.env !== 'production' && window.Paddle?.Environment?.set) window.Paddle.Environment.set(cfg.env);
        window.Paddle?.Initialize?.({ token: cfg.token });
      } catch { /* */ }
    };
    document.body.appendChild(s);
  }, [cfg.token, cfg.env]);

  const subscribe = (plan) => {
    if (plan === 'free') { navigate('/palnovaa-engine'); return; }
    if (plan === 'team') { window.location.href = 'mailto:support@palnovaa.com?subject=PalNovaa%20Engine%20Team'; return; }
    // Pro
    if (window.Paddle && cfg.priceId) {
      try {
        const u = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
        const uid = u?.id || u?.userId;
        window.Paddle.Checkout.open({
          items: [{ priceId: cfg.priceId, quantity: 1 }],
          ...(u?.email ? { customer: { email: u.email } } : {}),
          ...(uid ? { customData: { ident: `u:${uid}` } } : {}),
        });
      } catch { showToast('تعذّر فتح الدفع، جرّب لاحقاً'); }
      return;
    }
    showToast('سيُفعّل الدفع عبر Paddle قريباً');
  };

  return (
    <div className="pne-root" dir="rtl">
      <div className="app" style={{ gridTemplateColumns: '1fr' }}>
        <main className="main">
          <header className="topbar">
            <div className="crumbs" style={{ cursor: 'pointer' }} onClick={() => navigate('/palnovaa-engine')}>
              <div className="brand-mark" style={{ width: 24, height: 24 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A0D04" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7l9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg></div>
              <b style={{ color: 'var(--text)' }}>PalNovaa Engine</b><span className="sep">/</span><span>الأسعار</span>
            </div>
            <div className="top-actions">
              <button className="btn" onClick={() => navigate('/palnovaa-engine')}>العودة للمحرّك</button>
            </div>
          </header>

          <section className="pricing">
            <svg className="contours" ref={contoursRef} preserveAspectRatio="xMidYMid slice" />
            <div className="pricing-inner">
              <div className="peyebrow"><span>خطط محرّك بالنوفا</span></div>
              <h1>ابنِ تطبيقات GIS بلا حدود</h1>
              <p className="sub">ابدأ مجاناً، ثمّ ارتقِ إلى Pro حين تجدّ. تُدار المدفوعات بأمانٍ عبر Paddle.</p>

              <div className="plans">
                {PLANS.map((p) => (
                  <div className={`plan ${p.feat ? 'feat' : ''}`} key={p.id}>
                    {p.badge && <span className="pbadge">{p.badge}</span>}
                    <h3>{p.name}</h3>
                    <div className="ptag">{p.tag}</div>
                    <div className="price">
                      {p.id === 'team' ? <b style={{ fontSize: 22 }}>{p.price}</b> : <><b>${p.price}</b><small>{p.unit}</small></>}
                    </div>
                    <div className="pline" />
                    <ul>
                      {p.items.map((it, i) => (<li key={i}>{it.ok ? Check : Dash}<span style={{ color: it.ok ? 'var(--text-2)' : 'var(--faint)' }}>{it.t}</span></li>))}
                    </ul>
                    <div className="cta">
                      <button className={`btn ${p.feat ? 'accent' : ''}`} onClick={() => subscribe(p.id)}>{p.cta}</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pfoot">
                الأسعار بالدولار الأمريكيّ، وتُجدَّد تلقائياً حتى الإلغاء. بالاشتراك توافق على
                {' '}<b style={{ cursor: 'pointer' }} onClick={() => navigate('/terms')}>شروط الخدمة</b>،{' '}
                <b style={{ cursor: 'pointer' }} onClick={() => navigate('/privacy')}>سياسة الخصوصيّة</b>، و
                {' '}<b style={{ cursor: 'pointer' }} onClick={() => navigate('/refund')}>سياسة الاسترداد</b>.
              </div>
            </div>
          </section>
        </main>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}><i /><span>{toast}</span></div>
    </div>
  );
}
