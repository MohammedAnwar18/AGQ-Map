import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import './ARAdminPanel.css';

const BASE = import.meta.env.VITE_API_URL || '';

const DEFAULT_FORM = {
  title: '',
  subtitle: '',
  content: '',
  custom_code: '',
  image_url: '',
  era_year: '',
};

export default function ARAdminPanel({ onClose }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [arItems, setArItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: string }

  // ─── Secure QR Code states & handlers ───────────────────────────────────────
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrTitle, setQrTitle] = useState('');
  const [qrValue, setQrValue] = useState('');

  const encodePayload = (idOrCode) => {
    const raw = `AGQ_QR:${idOrCode}:${Date.now()}`;
    const base64 = btoa(unescape(encodeURIComponent(raw)));
    return 'AGQ_' + base64.split('').reverse().join('');
  };

  const handleGenerateQR = (item) => {
    const val = encodePayload(item.custom_code || item.id);
    setQrValue(val);
    setQrTitle(item.title);
    setShowQRModal(true);
  };

  useEffect(() => {
    if (showQRModal && qrValue) {
      const canvas = document.getElementById('ar-qr-canvas');
      if (canvas) {
        QRCode.toCanvas(canvas, qrValue, {
          width: 260,
          margin: 2,
          color: {
            dark: '#000814',
            light: '#ffffff'
          }
        }).catch(err => console.error('Error drawing QR:', err));
      }
    }
  }, [showQRModal, qrValue]);

  const handlePrintQR = () => {
    const canvas = document.getElementById('ar-qr-canvas');
    if (!canvas) return;
    const win = window.open('', '_blank');
    const dataUrl = canvas.toDataURL('image/png');
    win.document.write(`
      <html>
        <head>
          <title>رمز كاشف آمن - ${qrTitle}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; direction: rtl; }
            h1 { margin-bottom: 5px; font-size: 24px; color: #000; }
            p { font-size: 14px; color: #666; margin-bottom: 20px; }
            img { width: 300px; height: 300px; border: 1px solid #ccc; padding: 10px; border-radius: 12px; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>رمز QR آمن: ${qrTitle}</h1>
          <p>يمكن قراءته فقط من خلال كاشف الموقع في تطبيقنا</p>
          <img src="${dataUrl}" />
          <br><br>
          <button onclick="window.print()">طباعة الرمز 🖨️</button>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById('ar-qr-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${qrTitle.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const token = localStorage.getItem('token');
  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ─── Flash message helper ──────────────────────────────────────────────────
  const flash = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  // ─── Fetch all QR Content items ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setFetchLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ar/all`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setArItems(Array.isArray(data) ? data : (data.contents || data.items || []));
      }
    } catch (err) {
      flash('error', 'فشل تحميل البيانات: ' + err.message);
    } finally {
      setFetchLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Form change handlers ──────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  // ─── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title) {
      flash('error', 'العنوان مطلوب');
      return;
    }
    if (!form.custom_code) {
      flash('error', 'الرمز المخصص مطلوب لربط كود الـ QR');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ar/story`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...form,
          latitude: 31.7767,
          longitude: 35.2345,
          bearing: 0,
          trigger_radius: 50,
          fov_angle: 25,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'خطأ في الخادم');
      flash('success', 'تم حفظ وتوليد صفحة الـ QR بنجاح ✓');
      setForm(DEFAULT_FORM);
      fetchData();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = async (id, title) => {
    if (!window.confirm(`هل أنت متأكد من حذف "${title}"؟`)) return;
    try {
      const res = await fetch(`${BASE}/api/ar/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'فشل الحذف');
      }
      flash('success', `تم حذف "${title}" بنجاح`);
      fetchData();
    } catch (err) {
      flash('error', err.message);
    }
  };

  return (
    <div className="ar-panel" dir="rtl">
      {/* Header */}
      <div className="ar-header">
        <div className="ar-header-left">
          <span className="ar-header-icon">📷</span>
          <div>
            <h1 className="ar-header-title">إدارة صفحات كاشف الـ QR</h1>
            <p className="ar-header-subtitle">إنشاء وإدارة صفحات المحتوى المخصصة عند مسح الأكواد</p>
          </div>
        </div>
        {onClose && (
          <button className="ar-close-btn" onClick={onClose} title="إغلاق">
            ✕
          </button>
        )}
      </div>

      {/* Flash Message */}
      {message && (
        <div className={`ar-message ar-message--${message.type}`}>
          {message.type === 'success' ? '✓' : '⚠'} {message.text}
        </div>
      )}

      {/* Stats Row */}
      <div className="ar-stats-row" style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="ar-stat-card ar-stat--story" style={{ width: '100%', maxWidth: '350px', borderRight: '4px solid #00d4ff' }}>
          <span className="ar-stat-icon">🔑</span>
          <div className="ar-stat-info">
            <span className="ar-stat-num">{arItems.length}</span>
            <span className="ar-stat-label">عدد صفحات الـ QR المخصصة</span>
          </div>
        </div>
      </div>

      {/* Unified Simple QR Page Form */}
      <div className="ar-form-wrapper" style={{ marginTop: '20px' }}>
        <form className="ar-form" onSubmit={handleSubmit}>
          <h2 className="ar-form-title">✨ إنشاء صفحة QR جديدة للماسح</h2>

          <div className="ar-two-col">
            <div className="ar-field">
              <label className="ar-label">العنوان *</label>
              <input
                className="ar-input"
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="مثال: مدخل القاعة الرئيسية"
              />
            </div>
            <div className="ar-field">
              <label className="ar-label">الرمز المخصص (Custom QR Key) *</label>
              <input
                className="ar-input"
                name="custom_code"
                value={form.custom_code}
                onChange={handleChange}
                required
                placeholder="مثال: gate_01 (أحرف و أرقام إنجليزية)"
              />
            </div>
          </div>

          <div className="ar-two-col">
            <div className="ar-field">
              <label className="ar-label">العنوان الفرعي</label>
              <input
                className="ar-input"
                name="subtitle"
                value={form.subtitle}
                onChange={handleChange}
                placeholder="وصف إضافي قصير للمستخدم"
              />
            </div>
            <div className="ar-field">
              <label className="ar-label">السنة التاريخية (اختياري)</label>
              <input
                className="ar-input"
                type="number"
                name="era_year"
                value={form.era_year}
                onChange={handleChange}
                placeholder="مثال: 1948"
              />
            </div>
          </div>

          <div className="ar-field">
            <label className="ar-label">محتوى وتفاصيل الصفحة (الوصف الكامل)</label>
            <textarea
              className="ar-textarea"
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={4}
              placeholder="اكتب هنا التفاصيل والمحتوى الكامل الذي سيظهر للمستخدم عند مسح الكود..."
            />
          </div>

          <div className="ar-field">
            <label className="ar-label">رابط صورة الصفحة (اختياري)</label>
            <input
              className="ar-input"
              name="image_url"
              value={form.image_url}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <button className="ar-submit-btn" type="submit" disabled={loading}>
            {loading ? <span className="ar-spinner" /> : '＋'}
            {loading ? 'جارٍ الحفظ والتوليد...' : 'حفظ وإنشاء صفحة QR'}
          </button>
        </form>
      </div>

      {/* Pages List */}
      <div className="ar-list-section">
        <div className="ar-list-header">
          <h2 className="ar-list-title">📋 جميع صفحات الـ QR النشطة</h2>
          <button className="ar-refresh-btn" onClick={fetchData} disabled={fetchLoading} title="تحديث">
            <span className={fetchLoading ? 'ar-spin' : ''}>↻</span>
            {fetchLoading ? 'تحميل...' : 'تحديث'}
          </button>
        </div>

        {fetchLoading ? (
          <div className="ar-loading">
            <div className="ar-loading-dots">
              <span /><span /><span />
            </div>
            <p>جارٍ تحميل البيانات...</p>
          </div>
        ) : arItems.length === 0 ? (
          <div className="ar-empty">
            <span className="ar-empty-icon">📷</span>
            <p>لا توجد صفحات مخصصة بعد. ابدأ بإنشاء أول كود!</p>
          </div>
        ) : (
          <div className="ar-grid">
            {arItems.map((item) => (
              <div key={item._id || item.id} className="ar-card" style={{ '--card-accent': '#00d4ff' }}>
                <div className="ar-card-header">
                  <span className="ar-card-icon">🔑</span>
                  <div className="ar-card-titles">
                    <h3 className="ar-card-title">{item.title}</h3>
                    {item.subtitle && <p className="ar-card-subtitle">{item.subtitle}</p>}
                  </div>
                  <span className="ar-card-type-badge" style={{ borderColor: '#00d4ff', color: '#00d4ff' }}>
                    كود: {item.custom_code || item.id}
                  </span>
                </div>

                <div className="ar-card-body">
                  {item.content && (
                    <p className="ar-card-content">{item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}</p>
                  )}

                  <div className="ar-card-meta">
                    {item.era_year && (
                      <span className="ar-meta-chip ar-meta-chip--era">
                        🕰️ {item.era_year}
                      </span>
                    )}
                    {item.image_url && (
                      <span className="ar-meta-chip" style={{ color: '#00ff88', borderColor: 'rgba(0,255,136,0.3)' }}>
                        🖼️ يحتوي صورة
                      </span>
                    )}
                  </div>
                </div>

                <div className="ar-card-footer">
                  <span className="ar-card-id">ID: {(item._id || item.id || '').toString().slice(-8)}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="ar-qr-btn"
                      onClick={() => handleGenerateQR(item)}
                      title="توليد رمز QR"
                    >
                      🖨️ رمز QR
                    </button>
                    <button
                      className="ar-delete-btn"
                      onClick={() => handleDelete(item._id || item.id, item.title)}
                      title="حذف"
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Secure QR Code Modal ─── */}
      {showQRModal && (
        <div className="ar-modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="ar-modal-card" onClick={e => e.stopPropagation()}>
            <button className="ar-modal-close" onClick={() => setShowQRModal(false)}>✕</button>
            <h3 className="ar-modal-title">رمز QR المخصص الآمن</h3>
            <p className="ar-modal-subtitle">اسم الصفحة: <strong style={{ color: '#00d4ff' }}>{qrTitle}</strong></p>
            <p className="ar-modal-info">لا يمكن قراءة هذا الرمز من خلال كاميرات الهواتف العادية، فقط من كاشف الموقع لدينا.</p>
            
            <div className="ar-qr-container">
              <canvas id="ar-qr-canvas" />
            </div>

            <div className="ar-modal-actions">
              <button onClick={handlePrintQR} className="ar-action-btn print">
                🖨️ طباعة الرمز
              </button>
              <button onClick={handleDownloadQR} className="ar-action-btn download">
                📥 تحميل كصورة PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
