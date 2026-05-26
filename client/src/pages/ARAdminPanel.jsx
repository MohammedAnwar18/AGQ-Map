import React, { useState, useEffect, useCallback } from 'react';
import './ARAdminPanel.css';

const BASE = import.meta.env.VITE_API_URL || '';

// ─── Default form states ───────────────────────────────────────────────────────
const DEFAULT_BUILDING = {
  title: '',
  subtitle: '',
  content: '',
  latitude: '',
  longitude: '',
  bearing: 0,
  era_year: '',
  elevation: 0,
  scale_x: 1.0,
  scale_y: 1.0,
  scale_z: 1.0,
  trigger_radius: 100,
  fov_angle: 30,
  model_url: '',
  image_url: '',
};

const DEFAULT_STORY = {
  title: '',
  subtitle: '',
  content: '',
  latitude: '',
  longitude: '',
  bearing: 0,
  era_year: '',
  image_url: '',
  trigger_radius: 50,
  fov_angle: 25,
};

const DEFAULT_NAVPOINT = {
  title: '',
  content: '',
  latitude: '',
  longitude: '',
  trigger_radius: 200,
};

// ─── Type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  building: { icon: '🏛️', label: 'مبنى تاريخي', color: '#00d4ff' },
  story: { icon: '📜', label: 'قصة مكانية', color: '#7c3aed' },
  nav_point: { icon: '🧭', label: 'نقطة توجيه', color: '#059669' },
};

// ─── Reusable Field Components ─────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="ar-field">
      <label className="ar-label">
        {label}
        {hint && <span className="ar-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return <input className="ar-input" {...props} />;
}

function Textarea({ ...props }) {
  return <textarea className="ar-textarea" rows={4} {...props} />;
}

function TwoCol({ children }) {
  return <div className="ar-two-col">{children}</div>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ARAdminPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('building');
  const [buildingForm, setBuildingForm] = useState(DEFAULT_BUILDING);
  const [storyForm, setStoryForm] = useState(DEFAULT_STORY);
  const [navForm, setNavForm] = useState(DEFAULT_NAVPOINT);

  const [arItems, setArItems] = useState([]);
  const [stats, setStats] = useState({ buildings: 0, stories: 0, nav_points: 0 });

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [message, setMessage] = useState(null); // { type: 'success'|'error', text: string }

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

  // ─── Fetch all AR content & stats ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setFetchLoading(true);
    try {
      const [allRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/ar/all`, { headers: authHeaders }),
        fetch(`${BASE}/api/ar/stats`, { headers: authHeaders }),
      ]);

      if (allRes.ok) {
        const data = await allRes.json();
        setArItems(Array.isArray(data) ? data : data.items || []);
      }

      if (statsRes.ok) {
        const sdata = await statsRes.json();
        setStats({
          buildings: sdata.buildings ?? 0,
          stories: sdata.stories ?? 0,
          nav_points: sdata.nav_points ?? 0,
        });
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

  // ─── Generic form change handlers ─────────────────────────────────────────
  const handleChange = (setter) => (e) => {
    const { name, value, type } = e.target;
    setter((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  // ─── Submit handlers ───────────────────────────────────────────────────────
  const handleSubmit = async (endpoint, body, resetFn) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'خطأ في الخادم');
      flash('success', 'تم الحفظ بنجاح ✓');
      resetFn();
      fetchData();
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitBuilding = (e) => {
    e.preventDefault();
    handleSubmit('/api/ar/building', buildingForm, () => setBuildingForm(DEFAULT_BUILDING));
  };

  const submitStory = (e) => {
    e.preventDefault();
    handleSubmit('/api/ar/story', storyForm, () => setStoryForm(DEFAULT_STORY));
  };

  const submitNav = (e) => {
    e.preventDefault();
    handleSubmit('/api/ar/nav-point', navForm, () => setNavForm(DEFAULT_NAVPOINT));
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="ar-panel" dir="rtl">
      {/* Header */}
      <div className="ar-header">
        <div className="ar-header-left">
          <span className="ar-header-icon">🗺️</span>
          <div>
            <h1 className="ar-header-title">لوحة إدارة المحتوى المعزز</h1>
            <p className="ar-header-subtitle">إدارة نقاط الواقع المعزز والمحتوى التاريخي</p>
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
      <div className="ar-stats-row">
        <div className="ar-stat-card ar-stat--building">
          <span className="ar-stat-icon">🏛️</span>
          <div className="ar-stat-info">
            <span className="ar-stat-num">{stats.buildings}</span>
            <span className="ar-stat-label">مبانٍ تاريخية</span>
          </div>
        </div>
        <div className="ar-stat-card ar-stat--story">
          <span className="ar-stat-icon">📜</span>
          <div className="ar-stat-info">
            <span className="ar-stat-num">{stats.stories}</span>
            <span className="ar-stat-label">قصص مكانية</span>
          </div>
        </div>
        <div className="ar-stat-card ar-stat--nav">
          <span className="ar-stat-icon">🧭</span>
          <div className="ar-stat-info">
            <span className="ar-stat-num">{stats.nav_points}</span>
            <span className="ar-stat-label">نقاط توجيه</span>
          </div>
        </div>
        <div className="ar-stat-card ar-stat--total">
          <span className="ar-stat-icon">📍</span>
          <div className="ar-stat-info">
            <span className="ar-stat-num">{stats.buildings + stats.stories + stats.nav_points}</span>
            <span className="ar-stat-label">إجمالي النقاط</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ar-tabs">
        {[
          { id: 'building', label: 'مبنى تاريخي', icon: '🏛️' },
          { id: 'story', label: 'قصة مكانية', icon: '📜' },
          { id: 'nav_point', label: 'نقطة توجيه', icon: '🧭' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`ar-tab${activeTab === tab.id ? ' ar-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Forms */}
      <div className="ar-form-wrapper">
        {/* ── Building Form ── */}
        {activeTab === 'building' && (
          <form className="ar-form" onSubmit={submitBuilding}>
            <h2 className="ar-form-title">🏛️ إضافة مبنى تاريخي</h2>

            <TwoCol>
              <Field label="العنوان *">
                <Input name="title" value={buildingForm.title} onChange={handleChange(setBuildingForm)} required placeholder="اسم المبنى" />
              </Field>
              <Field label="العنوان الفرعي">
                <Input name="subtitle" value={buildingForm.subtitle} onChange={handleChange(setBuildingForm)} placeholder="وصف مختصر" />
              </Field>
            </TwoCol>

            <Field label="المحتوى / الوصف التاريخي">
              <Textarea name="content" value={buildingForm.content} onChange={handleChange(setBuildingForm)} placeholder="اكتب وصفاً تاريخياً تفصيلياً للمبنى..." />
            </Field>

            <TwoCol>
              <Field label="خط العرض (Latitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="latitude" value={buildingForm.latitude} onChange={handleChange(setBuildingForm)} required placeholder="31.7767" />
              </Field>
              <Field label="خط الطول (Longitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="longitude" value={buildingForm.longitude} onChange={handleChange(setBuildingForm)} required placeholder="35.2345" />
              </Field>
            </TwoCol>

            <TwoCol>
              <Field label="الاتجاه (Bearing °)" hint="0–360 — الاتجاه الذي يواجهه المبنى">
                <Input type="number" min="0" max="360" name="bearing" value={buildingForm.bearing} onChange={handleChange(setBuildingForm)} />
              </Field>
              <Field label="السنة التاريخية">
                <Input type="number" name="era_year" value={buildingForm.era_year} onChange={handleChange(setBuildingForm)} placeholder="مثال: 1948" />
              </Field>
            </TwoCol>

            <TwoCol>
              <Field label="الارتفاع (Elevation م)" hint="إزاحة رأسية بالمتر">
                <Input type="number" step="any" name="elevation" value={buildingForm.elevation} onChange={handleChange(setBuildingForm)} />
              </Field>
              <Field label="نصف قطر التفعيل (م)">
                <Input type="number" min="1" name="trigger_radius" value={buildingForm.trigger_radius} onChange={handleChange(setBuildingForm)} />
              </Field>
            </TwoCol>

            <Field label="زاوية الرؤية (FOV °)">
              <Input type="number" min="1" max="360" name="fov_angle" value={buildingForm.fov_angle} onChange={handleChange(setBuildingForm)} />
            </Field>

            <div className="ar-section-label">مقياس النموذج ثلاثي الأبعاد</div>
            <div className="ar-three-col">
              <Field label="Scale X">
                <Input type="number" step="0.01" name="scale_x" value={buildingForm.scale_x} onChange={handleChange(setBuildingForm)} />
              </Field>
              <Field label="Scale Y">
                <Input type="number" step="0.01" name="scale_y" value={buildingForm.scale_y} onChange={handleChange(setBuildingForm)} />
              </Field>
              <Field label="Scale Z">
                <Input type="number" step="0.01" name="scale_z" value={buildingForm.scale_z} onChange={handleChange(setBuildingForm)} />
              </Field>
            </div>

            <Field label="رابط النموذج ثلاثي الأبعاد (.glb)" hint="اختياري">
              <Input name="model_url" value={buildingForm.model_url} onChange={handleChange(setBuildingForm)} placeholder="https://example.com/model.glb" />
            </Field>

            <Field label="رابط الصورة التاريخية" hint="اختياري">
              <Input name="image_url" value={buildingForm.image_url} onChange={handleChange(setBuildingForm)} placeholder="https://example.com/photo.jpg" />
            </Field>

            <button className="ar-submit-btn" type="submit" disabled={loading}>
              {loading ? <span className="ar-spinner" /> : '＋'}
              {loading ? 'جارٍ الحفظ...' : 'حفظ المبنى'}
            </button>
          </form>
        )}

        {/* ── Story Form ── */}
        {activeTab === 'story' && (
          <form className="ar-form" onSubmit={submitStory}>
            <h2 className="ar-form-title">📜 إضافة قصة مكانية</h2>

            <TwoCol>
              <Field label="العنوان *">
                <Input name="title" value={storyForm.title} onChange={handleChange(setStoryForm)} required placeholder="عنوان القصة" />
              </Field>
              <Field label="العنوان الفرعي">
                <Input name="subtitle" value={storyForm.subtitle} onChange={handleChange(setStoryForm)} placeholder="وصف مختصر" />
              </Field>
            </TwoCol>

            <Field label="محتوى القصة">
              <Textarea name="content" value={storyForm.content} onChange={handleChange(setStoryForm)} placeholder="اكتب تفاصيل القصة المكانية..." />
            </Field>

            <TwoCol>
              <Field label="خط العرض (Latitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="latitude" value={storyForm.latitude} onChange={handleChange(setStoryForm)} required placeholder="31.7767" />
              </Field>
              <Field label="خط الطول (Longitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="longitude" value={storyForm.longitude} onChange={handleChange(setStoryForm)} required placeholder="35.2345" />
              </Field>
            </TwoCol>

            <TwoCol>
              <Field label="الاتجاه (Bearing °)" hint="0–360 — الاتجاه الذي تُرى منه القصة">
                <Input type="number" min="0" max="360" name="bearing" value={storyForm.bearing} onChange={handleChange(setStoryForm)} />
              </Field>
              <Field label="السنة التاريخية">
                <Input type="number" name="era_year" value={storyForm.era_year} onChange={handleChange(setStoryForm)} placeholder="مثال: 1948" />
              </Field>
            </TwoCol>

            <TwoCol>
              <Field label="نصف قطر التفعيل (م)">
                <Input type="number" min="1" name="trigger_radius" value={storyForm.trigger_radius} onChange={handleChange(setStoryForm)} />
              </Field>
              <Field label="زاوية الرؤية (FOV °)">
                <Input type="number" min="1" max="360" name="fov_angle" value={storyForm.fov_angle} onChange={handleChange(setStoryForm)} />
              </Field>
            </TwoCol>

            <Field label="رابط الصورة" hint="اختياري">
              <Input name="image_url" value={storyForm.image_url} onChange={handleChange(setStoryForm)} placeholder="https://example.com/image.jpg" />
            </Field>

            <button className="ar-submit-btn ar-submit-btn--story" type="submit" disabled={loading}>
              {loading ? <span className="ar-spinner" /> : '＋'}
              {loading ? 'جارٍ الحفظ...' : 'حفظ القصة'}
            </button>
          </form>
        )}

        {/* ── Nav Point Form ── */}
        {activeTab === 'nav_point' && (
          <form className="ar-form" onSubmit={submitNav}>
            <h2 className="ar-form-title">🧭 إضافة نقطة توجيه</h2>

            <Field label="العنوان *">
              <Input name="title" value={navForm.title} onChange={handleChange(setNavForm)} required placeholder="اسم النقطة" />
            </Field>

            <Field label="الوصف">
              <Textarea name="content" value={navForm.content} onChange={handleChange(setNavForm)} rows={3} placeholder="وصف النقطة أو التعليمات..." />
            </Field>

            <TwoCol>
              <Field label="خط العرض (Latitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="latitude" value={navForm.latitude} onChange={handleChange(setNavForm)} required placeholder="31.7767" />
              </Field>
              <Field label="خط الطول (Longitude)" hint="📍 التقاط من الخريطة">
                <Input type="number" step="any" name="longitude" value={navForm.longitude} onChange={handleChange(setNavForm)} required placeholder="35.2345" />
              </Field>
            </TwoCol>

            <Field label="نصف قطر التفعيل (م)" hint="المسافة التي تُفعَّل عندها النقطة">
              <Input type="number" min="1" name="trigger_radius" value={navForm.trigger_radius} onChange={handleChange(setNavForm)} />
            </Field>

            <button className="ar-submit-btn ar-submit-btn--nav" type="submit" disabled={loading}>
              {loading ? <span className="ar-spinner" /> : '＋'}
              {loading ? 'جارٍ الحفظ...' : 'حفظ النقطة'}
            </button>
          </form>
        )}
      </div>

      {/* AR Items List */}
      <div className="ar-list-section">
        <div className="ar-list-header">
          <h2 className="ar-list-title">📋 جميع نقاط الواقع المعزز</h2>
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
            <span className="ar-empty-icon">🗺️</span>
            <p>لا توجد نقاط AR بعد. ابدأ بإضافة محتوى جديد!</p>
          </div>
        ) : (
          <div className="ar-grid">
            {arItems.map((item) => {
              const meta = TYPE_META[item.type] || { icon: '📍', label: item.type, color: '#00d4ff' };
              return (
                <div key={item._id || item.id} className="ar-card" style={{ '--card-accent': meta.color }}>
                  <div className="ar-card-header">
                    <span className="ar-card-icon">{meta.icon}</span>
                    <div className="ar-card-titles">
                      <h3 className="ar-card-title">{item.title}</h3>
                      {item.subtitle && <p className="ar-card-subtitle">{item.subtitle}</p>}
                    </div>
                    <span className="ar-card-type-badge" style={{ borderColor: meta.color, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>

                  <div className="ar-card-body">
                    {item.content && (
                      <p className="ar-card-content">{item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}</p>
                    )}

                    <div className="ar-card-meta">
                      {(item.latitude != null && item.longitude != null) && (
                        <span className="ar-meta-chip ar-meta-chip--coords">
                          📍 {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                        </span>
                      )}
                      {item.trigger_radius != null && (
                        <span className="ar-meta-chip">
                          📡 {item.trigger_radius} م
                        </span>
                      )}
                      {item.era_year && (
                        <span className="ar-meta-chip ar-meta-chip--era">
                          🕰️ {item.era_year}
                        </span>
                      )}
                      {item.bearing != null && item.bearing !== 0 && (
                        <span className="ar-meta-chip">
                          🧭 {item.bearing}°
                        </span>
                      )}
                      {item.fov_angle != null && (
                        <span className="ar-meta-chip">
                          👁️ {item.fov_angle}°
                        </span>
                      )}
                    </div>

                    {(item.model_url || item.image_url) && (
                      <div className="ar-card-links">
                        {item.model_url && (
                          <a href={item.model_url} target="_blank" rel="noreferrer" className="ar-card-link">
                            📦 نموذج 3D
                          </a>
                        )}
                        {item.image_url && (
                          <a href={item.image_url} target="_blank" rel="noreferrer" className="ar-card-link">
                            🖼️ صورة
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="ar-card-footer">
                    <span className="ar-card-id">ID: {(item._id || item.id || '').toString().slice(-8)}</span>
                    <button
                      className="ar-delete-btn"
                      onClick={() => handleDelete(item._id || item.id, item.title)}
                      title="حذف"
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
