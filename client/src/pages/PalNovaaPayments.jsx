import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useEngineBranding from '../hooks/useEngineBranding';
import './PalNovaaEngine.css';

/* ============================================================================
   PalNovaa Engine — إدارة الدفع (للأدمن)  (/palnovaa-engine/payments)
   تعرض من اشترك في Pro: الاسم، البريد، المزوّد، المبلغ، حالة الاشتراك وتاريخه.
   محميّة بـAdminRoute + تحقّق أدمن على الخادم.
   ============================================================================ */

const API = import.meta.env.VITE_API_URL || '/api';

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return '—'; }
};
const money = (v, c) => (v == null ? '—' : `${v.toFixed(2)} ${c || 'USD'}`);

export default function PalNovaaPayments() {
  const navigate = useNavigate();
  useEngineBranding();
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [q, setQ] = useState('');

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    const token = localStorage.getItem('token');
    fetch(`${API}/engine/admin/payments`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d?.ok) throw new Error(d?.reason || d?.error || `خطأ ${r.status}`);
        return d;
      })
      .then((d) => setState({ loading: false, error: '', data: d }))
      .catch((e) => setState({ loading: false, error: String(e.message || e), data: null }));
  };

  useEffect(load, []);

  const d = state.data;
  const rows = (d?.rows || []).filter((x) => {
    if (!q.trim()) return true;
    const s = `${x.name || ''} ${x.email || ''} ${x.ident || ''}`.toLowerCase();
    return s.includes(q.trim().toLowerCase());
  });

  return (
    <div className="pne-root" dir="rtl">
      <div className="app" style={{ gridTemplateColumns: '1fr' }}>
        <main className="main">
          <header className="topbar">
            <div className="crumbs" style={{ cursor: 'pointer' }} onClick={() => navigate('/palnovaa-engine')}>
              <div className="brand-mark" style={{ width: 24, height: 24 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A0D04" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7l9 5 9-5-9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg></div>
              <b style={{ color: 'var(--text)' }}>PalNovaa Engine</b><span className="sep">/</span><span>إدارة الدفع</span>
            </div>
            <div className="top-actions">
              <button className="btn" onClick={load}>تحديث</button>
              <button className="btn" onClick={() => navigate('/palnovaa-engine')}>العودة للمحرّك</button>
            </div>
          </header>

          <section className="pay-wrap">
            <div className="pay-inner">
              <div className="peyebrow"><span>لوحة الأدمن</span></div>
              <h1 style={{ marginBottom: 6 }}>المشتركون والمدفوعات</h1>
              <p className="sub" style={{ marginBottom: 20 }}>كلّ من فعّل خطّة Pro، مع تفاصيله والمبلغ وحالة الاشتراك.</p>

              {/* ملخّص */}
              <div className="pay-stats">
                <div className="pay-stat"><b>{d ? d.activeCount : '—'}</b><span>اشتراكات فعّالة</span></div>
                <div className="pay-stat"><b>{d ? d.count : '—'}</b><span>إجمالي السجلّات</span></div>
                <div className="pay-stat"><b>{d ? `$${(d.revenueUsd || 0).toFixed(2)}` : '—'}</b><span>إجمالي المحصّل (USD)</span></div>
              </div>

              <div className="pay-tools">
                <input className="pay-search" placeholder="بحث بالاسم أو البريد…" value={q} onChange={(e) => setQ(e.target.value)} />
                <span className="pay-count">{rows.length} نتيجة</span>
              </div>

              {state.loading && <div className="pay-msg">…جارِ التحميل</div>}
              {state.error && <div className="pay-msg err">تعذّر الجلب: {state.error}</div>}

              {!state.loading && !state.error && (
                <div className="pay-table-wrap">
                  <table className="pay-table">
                    <thead>
                      <tr>
                        <th>المستخدم</th><th>البريد</th><th>الحالة</th><th>المزوّد</th>
                        <th>المبلغ</th><th>آخر دفعة</th><th>ينتهي في</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && <tr><td colSpan={7} className="pay-empty">لا مدفوعات بعد.</td></tr>}
                      {rows.map((x) => (
                        <tr key={x.ident}>
                          <td>
                            <div className="pay-user">{x.name || '—'}</div>
                            <div className="pay-ident">{x.userId ? `#${x.userId}` : x.ident}</div>
                          </td>
                          <td className="pay-mono">{x.email || '—'}</td>
                          <td>
                            <span className={`pay-badge ${x.active ? 'on' : 'off'}`}>{x.active ? 'فعّال' : 'منتهٍ'}</span>
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{x.provider || '—'}</td>
                          <td className="pay-mono">{money(x.amount, x.currency)}</td>
                          <td>{fmtDate(x.lastSaleAt)}</td>
                          <td>{fmtDate(x.periodEnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
