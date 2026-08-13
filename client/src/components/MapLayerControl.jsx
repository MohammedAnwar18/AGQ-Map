/**
 * MapLayerControl.jsx
 * ═══════════════════════════════════════════════════════════════════════════════
 * مكون التحكم بطبقات الأحداث الإقليمية — فلسطين والشرق الأوسط
 * يعمل مع react-map-gl/maplibre ويضيف:
 *   - بؤر حرارية (NASA FIRMS)
 *   - زلازل (USGS)
 *   - أحداث إنسانية (ReliefWeb)
 *   - منشورات اجتماعية محلية
 * كل طبقة قابلة للتشغيل والإخفاء بشكل مستقل
 * تصميم متجاوب: Sidebar على الحاسوب / Bottom Sheet على الهاتف عبر createPortal
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import './MapLayerControl.css';

// ─── ثابت الـ API Base ───────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── تعريف الطبقات المتاحة ───────────────────────────────────────────────────────
const LAYER_DEFINITIONS = [
  {
    id: 'thermal',
    name: 'بؤر حرارية',
    description: 'نقاط ساخنة من أقمار NASA/VIIRS',
    icon: '🔥',
    color: '#ef4444',
    param: 'thermal',
    types: ['thermal'],
    defaultEnabled: true,
  },
  {
    id: 'earthquake',
    name: 'زلازل وهزات أرضية',
    description: 'بيانات USGS الحية (آخر 24 ساعة)',
    icon: '🌍',
    color: '#a78bfa',
    param: 'earthquake',
    types: ['earthquake'],
    defaultEnabled: true,
  },
  {
    id: 'humanitarian',
    name: 'أحداث إنسانية',
    description: 'كوارث وأزمات — ReliefWeb',
    icon: '🏥',
    color: '#10b981',
    param: 'humanitarian',
    types: ['humanitarian'],
    defaultEnabled: true,
  },
  {
    id: 'social',
    name: 'منشورات مجتمعية محلية',
    description: 'منشورات مستخدمي المنطقة (7 أيام)',
    icon: '💬',
    color: '#3b82f6',
    param: 'social',
    types: ['social'],
    defaultEnabled: false,
  },
  {
    id: 'news',
    name: 'أخبار وتحديثات ميدانية',
    description: 'تحديثات GDELT — فلسطين والمنطقة',
    icon: '📰',
    color: '#f59e0b',
    param: 'news',
    types: ['news'],
    defaultEnabled: false,
  },
];

// ─── التبويبات الجغرافية ──────────────────────────────────────────────────────────
const REGION_TABS = [
  { id: 'wb+gz', label: '🇵🇸 فلسطين (كل)', westBank: true, gaza: true, middleEast: false },
  { id: 'wb',    label: '🏘️ الضفة الغربية',  westBank: true, gaza: false, middleEast: false },
  { id: 'gz',    label: '🕌 قطاع غزة',             westBank: false, gaza: true, middleEast: false },
  { id: 'me',    label: '🌍 الشرق الأوسط',    westBank: true, gaza: true, middleEast: true },
];

// ─── مساعدات ─────────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-PS', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `منذ ${minutes} د`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${Math.floor(hours / 24)} يوم`;
  } catch { return ''; }
}

// ─── MapLayerControl Component ────────────────────────────────────────────────────
const MapLayerControl = ({ mapRef }) => {
  // ─── State ─────────────────────────────────────────────────────────────────────
  const [isOpen, setIsOpen]               = useState(false);
  const [activeRegion, setActiveRegion]   = useState(REGION_TABS[0]);
  const [enabledLayers, setEnabledLayers] = useState(() => {
    const obj = {};
    LAYER_DEFINITIONS.forEach(l => { obj[l.id] = l.defaultEnabled; });
    return obj;
  });

  const [eventsData, setEventsData]       = useState(null); // GeoJSON FeatureCollection
  const [loading, setLoading]             = useState(false);
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null); // popup

  const abortRef = useRef(null);

  // ─── جلب البيانات من الـ API ──────────────────────────────────────────────────
  const fetchEvents = useCallback(async (region = activeRegion, layers = enabledLayers) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const params = new URLSearchParams({
        westBank:     region.westBank,
        gaza:         region.gaza,
        middleEast:   region.middleEast,
        thermal:      layers.thermal    ?? true,
        earthquake:   layers.earthquake ?? true,
        humanitarian: layers.humanitarian ?? true,
        social:       layers.social     ?? false,
        news:         layers.news       ?? false,
      });

      const res = await fetch(`${API_BASE}/regional-events?${params.toString()}`, {
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEventsData(data);
      setLastUpdate(new Date());
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[MapLayerControl] fetch error:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeRegion, enabledLayers]);

  // ─── أول تحميل وكل تغيير في المنطقة ───────────────────────────────────────────
  useEffect(() => {
    fetchEvents(activeRegion, enabledLayers);

    const interval = setInterval(() => fetchEvents(activeRegion, enabledLayers), 10 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [activeRegion]);

  // ─── تغيير المنطقة ────────────────────────────────────────────────────────────
  const handleRegionChange = useCallback((tab) => {
    setActiveRegion(tab);
    setSelectedEvent(null);
    fetchEvents(tab, enabledLayers);
  }, [enabledLayers, fetchEvents]);

  // ─── تشغيل/إخفاء طبقة ────────────────────────────────────────────────────────
  const handleToggleLayer = useCallback((layerId) => {
    setEnabledLayers(prev => {
      const updated = { ...prev, [layerId]: !prev[layerId] };
      fetchEvents(activeRegion, updated);
      return updated;
    });
    setSelectedEvent(null);
  }, [activeRegion, fetchEvents]);

  // ─── حساب GeoJSON مفلترة حسب الطبقات المفعّلة ───────────────────────────────
  const filteredGeoJSON = useMemo(() => {
    if (!eventsData?.features) {
      return { type: 'FeatureCollection', features: [] };
    }

    const enabledTypes = new Set(
      LAYER_DEFINITIONS
        .filter(l => enabledLayers[l.id])
        .flatMap(l => l.types)
    );

    const features = eventsData.features.filter(f =>
      enabledTypes.has(f.properties?.type)
    );

    return { type: 'FeatureCollection', features };
  }, [eventsData, enabledLayers]);

  // ─── عداد الأحداث لكل طبقة ───────────────────────────────────────────────────
  const countByLayer = useMemo(() => {
    if (!eventsData?.features) return {};
    const counts = {};
    LAYER_DEFINITIONS.forEach(l => {
      counts[l.id] = eventsData.features.filter(f =>
        l.types.includes(f.properties?.type)
      ).length;
    });
    return counts;
  }, [eventsData]);

  const totalVisible = filteredGeoJSON.features.length;

  // ─── إجمالي الأحداث لكل فئة ──────────────────────────────────────────────────
  const regionCounts = useMemo(() => {
    if (!eventsData?.features) return { wb: 0, gz: 0, total: 0 };
    const wb = eventsData.features.filter(f => f.properties?.region === 'الضفة الغربية').length;
    const gz = eventsData.features.filter(f => f.properties?.region === 'قطاع غزة').length;
    return { wb, gz, total: eventsData.features.length };
  }, [eventsData]);

  // ─── نقر على الخريطة للإغلاق ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onMapClick = () => setIsOpen(false);
    const timeout = setTimeout(() => {
      document.addEventListener('click', onMapClick, { once: true });
    }, 50);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', onMapClick);
    };
  }, [isOpen]);

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════════════════ طبقات الخريطة (Sources & Layers) ══════════════ */}
      {filteredGeoJSON.features.length > 0 && (
        <Source
          id="regional-events-source"
          type="geojson"
          data={filteredGeoJSON}
          cluster={true}
          clusterMaxZoom={10}
          clusterRadius={40}
        >
          {/* طبقة الـ Clusters (تجميع النقاط) */}
          <Layer
            id="regional-events-clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step', ['get', 'point_count'],
                '#fbab15', 5,
                '#f97316', 15,
                '#ef4444',
              ],
              'circle-radius': [
                'step', ['get', 'point_count'],
                18, 5, 24, 15, 30,
              ],
              'circle-stroke-width': 3,
              'circle-stroke-color': 'rgba(255,255,255,0.25)',
              'circle-opacity': 0.92,
            }}
          />

          {/* عداد الـ Cluster */}
          <Layer
            id="regional-events-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 13,
            }}
            paint={{
              'text-color': '#ffffff',
              'text-halo-color': 'rgba(0,0,0,0.3)',
              'text-halo-width': 1,
            }}
          />

          {/* نقاط الأحداث الفردية */}
          <Layer
            id="regional-events-unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['coalesce', ['get', 'color'], '#fbab15'],
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                6, 5, 10, 8, 14, 11,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': 'rgba(255,255,255,0.6)',
              'circle-opacity': 0.9,
            }}
          />

          {/* تأثير Glow حول النقاط */}
          <Layer
            id="regional-events-glow"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': ['coalesce', ['get', 'color'], '#fbab15'],
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                6, 10, 10, 15, 14, 20,
              ],
              'circle-opacity': 0.15,
              'circle-stroke-width': 0,
            }}
          />
        </Source>
      )}

      {/* ══════════════════════ Popup تفاصيل الحدث ════════════════════════════ */}
      {selectedEvent && (
        <Popup
          longitude={selectedEvent.geometry.coordinates[0]}
          latitude={selectedEvent.geometry.coordinates[1]}
          onClose={() => setSelectedEvent(null)}
          closeButton={true}
          closeOnClick={false}
          maxWidth="300px"
          anchor="bottom"
          offset={[0, -8]}
        >
          <div className="mlc-event-popup">
            <div className="mlc-event-popup-header">
              <span className="mlc-event-popup-icon">
                {selectedEvent.properties.icon || '📍'}
              </span>
              <p className="mlc-event-popup-title">
                {selectedEvent.properties.title}
              </p>
            </div>

            {selectedEvent.properties.region && (
              <span className="mlc-event-popup-region">
                📍 {selectedEvent.properties.region}
              </span>
            )}

            {selectedEvent.properties.description && (
              <p className="mlc-event-popup-desc">
                {selectedEvent.properties.description}
              </p>
            )}

            <div className="mlc-event-popup-meta">
              {selectedEvent.properties.source && (
                <span>📡 {selectedEvent.properties.source}</span>
              )}
              {selectedEvent.properties.date && (
                <span>🕐 {timeAgo(selectedEvent.properties.date)}</span>
              )}
              {selectedEvent.properties.magnitude && (
                <span>📊 ريختر {selectedEvent.properties.magnitude.toFixed(1)}</span>
              )}
              {selectedEvent.properties.frp && (
                <span>🔥 {selectedEvent.properties.frp.toFixed(0)} MW</span>
              )}
            </div>

            {selectedEvent.properties.url && (
              <a
                href={selectedEvent.properties.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mlc-event-popup-link"
              >
                عرض التفاصيل ←
              </a>
            )}
          </div>
        </Popup>
      )}

      {/* ══════════════════════ FAB — زر التحكم بالطبقات ══════════════════════ */}
      {createPortal(
        <>
          <button
            className={`mlc-fab ${isOpen ? 'is-open' : ''}`}
            onClick={(e) => { e.stopPropagation(); setIsOpen(prev => !prev); }}
            title="طبقات الأحداث الإقليمية"
            aria-label="فتح لوحة التحكم بالطبقات"
          >
            <span className="mlc-fab-icon">{isOpen ? '✕' : '🗺️'}</span>
            <span>{isOpen ? 'إغلاق' : 'طبقات فلسطين'}</span>
            {!isOpen && totalVisible > 0 && (
              <span className="mlc-fab-badge">{totalVisible > 99 ? '99+' : totalVisible}</span>
            )}
          </button>

          {/* ══════════════════════ Panel (Sidebar / Bottom Sheet) ════════════════ */}
          {isOpen && (
            <>
              {/* Overlay */}
              <div
                className="mlc-overlay"
                onClick={() => setIsOpen(false)}
              />

              <div
                className="mlc-panel"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle */}
                <div className="mlc-drag-handle">
                  <div className="mlc-drag-handle-bar" />
                </div>

                {/* ─── Header ────────────────────────────────────────────────────── */}
                <div className="mlc-header">
                  <div className="mlc-header-left">
                    <span className="mlc-header-flag">🇵🇸</span>
                    <div>
                      <h2 className="mlc-header-title">طبقات الأحداث</h2>
                      <p className="mlc-header-subtitle">فلسطين — الضفة الغربية وغزة</p>
                    </div>
                  </div>
                  <button
                    className="mlc-close-btn"
                    onClick={() => setIsOpen(false)}
                    aria-label="إغلاق"
                  >
                    ✕
                  </button>
                </div>

                {/* ─── Stats ────────────────────────────────────────────────────── */}
                <div className="mlc-stats-bar">
                  <div className="mlc-stat-item">
                    <span className="mlc-stat-number">
                      {loading ? '...' : totalVisible}
                    </span>
                    <span className="mlc-stat-label">حدث مرئي</span>
                  </div>
                  <div className="mlc-stat-item">
                    <span className="mlc-stat-number">
                      {loading ? '...' : regionCounts.wb}
                    </span>
                    <span className="mlc-stat-label">ضفة غربية</span>
                  </div>
                  <div className="mlc-stat-item">
                    <span className="mlc-stat-number">
                      {loading ? '...' : regionCounts.gz}
                    </span>
                    <span className="mlc-stat-label">قطاع غزة</span>
                  </div>
                </div>

                {/* ─── Region Tabs ────────────────────────────────────────────────── */}
                <div className="mlc-region-tabs" role="tablist">
                  {REGION_TABS.map(tab => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeRegion.id === tab.id}
                      className={`mlc-region-tab ${activeRegion.id === tab.id ? 'active' : ''}`}
                      onClick={() => handleRegionChange(tab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ─── Layer Cards ────────────────────────────────────────────────── */}
                <div className="mlc-body">
                  <div className="mlc-section-title">الطبقات المتاحة</div>

                  {LAYER_DEFINITIONS.map(layer => {
                    const count = countByLayer[layer.id] ?? 0;
                    const isEnabled = enabledLayers[layer.id];

                    return (
                      <div
                        key={layer.id}
                        className={`mlc-layer-card ${isEnabled ? 'active' : ''} ${loading ? 'loading' : ''}`}
                        onClick={() => handleToggleLayer(layer.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && handleToggleLayer(layer.id)}
                        aria-label={`${layer.name} — ${isEnabled ? 'مفعّل' : 'معطّل'}`}
                      >
                        {/* أيقونة */}
                        <div className="mlc-layer-icon-wrap">
                          {layer.icon}
                        </div>

                        {/* النص */}
                        <div className="mlc-layer-info">
                          <span className="mlc-layer-name">{layer.name}</span>
                          <span className="mlc-layer-desc">{layer.description}</span>
                        </div>

                        {/* عداد الأحداث */}
                        {isEnabled && (
                          <span className="mlc-layer-count">
                            {loading ? '…' : count}
                          </span>
                        )}

                        {/* Toggle Switch */}
                        <label
                          className="mlc-toggle"
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleLayer(layer.id)}
                            aria-label={`تبديل طبقة ${layer.name}`}
                          />
                          <span className="mlc-toggle-slider" />
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* ─── Last Update ─────────────────────────────────────────────────── */}
                {lastUpdate && (
                  <div className="mlc-last-update">
                    <span className={`mlc-live-dot ${loading ? 'loading' : ''}`} />
                    {loading
                      ? 'جاري التحديث...'
                      : `آخر تحديث: ${lastUpdate.toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </div>
                )}

                {/* ─── Footer Buttons ─────────────────────────────────────────────── */}
                <div className="mlc-footer">
                  <button
                    className="mlc-refresh-btn"
                    onClick={() => fetchEvents(activeRegion, enabledLayers)}
                    disabled={loading}
                  >
                    {loading
                      ? <><div className="mlc-spinner" /> جاري التحديث...</>
                      : <>🔄 تحديث البيانات</>
                    }
                  </button>
                  <button
                    className="mlc-all-btn"
                    onClick={() => {
                      const allEnabled = LAYER_DEFINITIONS.every(l => enabledLayers[l.id]);
                      const newState = {};
                      LAYER_DEFINITIONS.forEach(l => { newState[l.id] = !allEnabled; });
                      setEnabledLayers(newState);
                      fetchEvents(activeRegion, newState);
                    }}
                  >
                    {LAYER_DEFINITIONS.every(l => enabledLayers[l.id]) ? 'إخفاء الكل' : 'إظهار الكل'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>,
        document.body
      )}
    </>
  );
};

export default MapLayerControl;
