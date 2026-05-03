import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PalNovaaLab.css';

const PalNovaaLab = ({ onClose }) => {
    const [showIntro, setShowIntro] = useState(true);
    const [particles, setParticles] = useState([]);
    const [activeTab, setActiveTab] = useState('layers');
    const [geoJsonData, setGeoJsonData] = useState(null);
    const [mapState, setMapState] = useState({
        longitude: 35.2034,
        latitude: 31.9038,
        zoom: 13,
        pitch: 0,
        bearing: 0
    });
    const mapRef = useRef(null);

    const MAPTILER_KEY = 'N6uNP3sTu25OIBUyi9G1';
    const mapStyle = `https://api.maptiler.com/maps/019b8b76-e5e2-7f02-b5d1-74fd0cf725bb/style.json?key=${MAPTILER_KEY}`;

    useEffect(() => {
        // Generate particles
        const newParticles = [];
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 * i) / 30;
            const dist = 200 + Math.random() * 200;
            newParticles.push({
                px: Math.cos(angle) * dist + 'px',
                py: Math.sin(angle) * dist + 'px',
                delay: (Math.random() * 4) + 's'
            });
        }
        setParticles(newParticles);

        // Hide intro after 2.8s
        const timer = setTimeout(() => {
            setShowIntro(false);
        }, 2800);
        return () => clearTimeout(timer);
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                if (json.type === 'FeatureCollection' || json.type === 'Feature') {
                    setGeoJsonData(json);
                    // Fly to data
                    if (mapRef.current) {
                        try {
                            const coordinates = [];
                            const extractCoords = (obj) => {
                                if(obj.type === 'FeatureCollection') obj.features.forEach(extractCoords);
                                else if(obj.geometry) extractCoords(obj.geometry);
                                else if(obj.coordinates) {
                                    if(typeof obj.coordinates[0] === 'number') coordinates.push(obj.coordinates);
                                    else obj.coordinates.forEach(c => {
                                        if(typeof c[0] === 'number') coordinates.push(c);
                                        else c.forEach(sub => {
                                            if(typeof sub[0] === 'number') coordinates.push(sub);
                                        });
                                    });
                                }
                            };
                            extractCoords(json);
                            if(coordinates.length > 0) {
                                const lons = coordinates.map(c => c[0]);
                                const lats = coordinates.map(c => c[1]);
                                mapRef.current.fitBounds(
                                    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                                    { padding: 80, duration: 2000 }
                                );
                            }
                        } catch(e) { console.error('Fit bounds error', e); }
                    }
                } else {
                    alert('الملف المرفق ليس بصيغة GeoJSON صحيحة.');
                }
            } catch (err) {
                alert('حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف JSON/GeoJSON صالح.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="palnovaa-lab-container">
            {/* INTRO SPLASH */}
            {showIntro && (
                <div className="lab-intro" id="intro">
                    <div className="intro-grid"></div>
                    <div className="intro-glow"></div>
                    <div className="intro-particles">
                        {particles.map((p, i) => (
                            <div key={i} className="particle" style={{ left: '50%', top: '50%', '--px': p.px, '--py': p.py, animationDelay: p.delay }}></div>
                        ))}
                    </div>

                    <div className="intro-content">
                        <div className="intro-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 2h6"/>
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/>
                                <path d="M7 16h10"/>
                                <circle cx="11" cy="14" r="0.6" fill="currentColor"/>
                                <circle cx="13.5" cy="17" r="0.5" fill="currentColor"/>
                                <circle cx="9.5" cy="18" r="0.5" fill="currentColor"/>
                            </svg>
                        </div>
                        <h1 dir="ltr">PalNovaa <span className="lab-tag">Lab</span></h1>
                        <div className="intro-loader"></div>
                    </div>
                </div>
            )}

            {/* MAIN APP */}
            <div className="lab-app">
                <header className="topbar">
                    <div className="brand">
                        <div className="brand-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 2h6"/>
                                <path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/>
                                <path d="M7 16h10"/>
                            </svg>
                        </div>
                        <div className="brand-text">
                            <strong>PalNovaa</strong>
                            <small>LAB · v2.0</small>
                        </div>
                    </div>

                    <div className="topbar-divider"></div>

                    <nav className="breadcrumb">
                        <span>المشاريع</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        <span>تحليل مكاني</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        <span className="current">جلسة نشطة</span>
                    </nav>

                    <div className="topbar-spacer"></div>

                    <div className="topbar-actions">
                        <button className="top-btn" title="إغلاق المختبر" onClick={onClose}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>خروج</span>
                        </button>
                        <button className="top-btn primary" title="تشغيل التحليل">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>تشغيل التحليل</span>
                        </button>
                    </div>
                </header>

                <aside className="sidebar">
                    <button className="tool active" data-tip="مؤشر التحديد">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l3.057-3 11.943 11.943-4.057.057L13 16.943l-3 3L5 3z"/></svg>
                    </button>
                    <button className="tool" data-tip="رسم نقطة">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>
                    </button>
                    <button className="tool" data-tip="رسم خط">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>
                    </button>
                    <button className="tool" data-tip="رسم مضلع">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg>
                    </button>

                    <div className="sidebar-divider"></div>

                    <button className="tool" data-tip="قياس المسافة">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.3 8.7L8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4z"/><path d="M7 17l-3-3M11 13l-3-3M15 9l-3-3"/></svg>
                    </button>
                    
                    <div className="sidebar-bottom">
                        <button className="tool" data-tip="الإعدادات">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                    </div>
                </aside>

                <section className="canvas">
                    <div className="map-container-inner">
                        <Map
                            ref={mapRef}
                            {...mapState}
                            onMove={evt => setMapState(evt.viewState)}
                            mapStyle={mapStyle}
                            style={{ width: '100%', height: '100%', opacity: 0.8 }}
                            maxPitch={85}
                            attributionControl={false}
                        >
                            <NavigationControl position="bottom-right" />
                            
                            {geoJsonData && (
                                <Source id="palnovaa-lab-source" type="geojson" data={geoJsonData}>
                                    <Layer
                                        id="palnovaa-lab-polygon"
                                        type="fill"
                                        filter={['==', '$type', 'Polygon']}
                                        paint={{ 'fill-color': '#06D6F2', 'fill-opacity': 0.4, 'fill-outline-color': '#06D6F2' }}
                                    />
                                    <Layer
                                        id="palnovaa-lab-line"
                                        type="line"
                                        filter={['==', '$type', 'LineString']}
                                        paint={{ 'line-color': '#F5A623', 'line-width': 3 }}
                                    />
                                    <Layer
                                        id="palnovaa-lab-point"
                                        type="circle"
                                        filter={['==', '$type', 'Point']}
                                        paint={{ 'circle-radius': 6, 'circle-color': '#10D9A0', 'circle-stroke-width': 2, 'circle-stroke-color': '#0A1628' }}
                                    />
                                </Source>
                            )}
                        </Map>
                    </div>

                    <div className="map-overlay-card" style={{ pointerEvents: 'none' }}>
                        <h4>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/></svg>
                            إحصائيات الجلسة
                        </h4>
                        <div className="map-stat-row"><span>عدد الميزات المرفوعة</span><span>{geoJsonData ? (geoJsonData.features?.length || 1) : 0}</span></div>
                        <div className="map-stat-row"><span>الطبقات النشطة</span><span>{geoJsonData ? 1 : 0}</span></div>
                    </div>
                </section>

                <aside className="panel">
                    <div className="panel-tabs">
                        <button className={`panel-tab ${activeTab === 'layers' ? 'active' : ''}`} onClick={() => setActiveTab('layers')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                            الطبقات
                        </button>
                        <button className={`panel-tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            التحليل
                        </button>
                        <button className={`panel-tab ${activeTab === 'inspector' ? 'active' : ''}`} onClick={() => setActiveTab('inspector')}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            التفاصيل
                        </button>
                    </div>

                    <div className="panel-body">
                        {activeTab === 'layers' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>استيراد بيانات GeoJSON</span>
                                    </div>
                                    <label className="upload-zone">
                                        <input type="file" accept=".json,.geojson" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        <div className="upload-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                                <polyline points="17 8 12 3 7 8"/>
                                                <line x1="12" y1="3" x2="12" y2="15"/>
                                            </svg>
                                        </div>
                                        <h4>اضغط للاختيار من جهازك</h4>
                                        <div className="formats">
                                            <span className="format-pill">.geojson</span>
                                            <span className="format-pill">.json</span>
                                        </div>
                                    </label>
                                </div>

                                {geoJsonData && (
                                    <div className="panel-section">
                                        <div className="panel-section-title">
                                            <span>الطبقات النشطة</span>
                                            <button onClick={() => setGeoJsonData(null)} style={{color: '#EF4444'}}>إزالة</button>
                                        </div>
                                        <div className="layer-item active">
                                            <div className="layer-color" style={{ background: 'var(--accent-cyan)' }}></div>
                                            <div className="layer-info">
                                                <h5>بيانات جيوجيسون المرفوعة</h5>
                                                <small>{geoJsonData.type} · {geoJsonData.features?.length || 1} ميزة</small>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'analysis' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>عمليات التحليل المتاحة قريباً</span>
                                    </div>
                                    <div className="analysis-grid">
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" strokeDasharray="2 2"/></svg></div>
                                            <h6>Buffer</h6>
                                            <p>نطاق احتمالي</p>
                                        </div>
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg></div>
                                            <h6>Intersection</h6>
                                            <p>تقاطع الطبقات</p>
                                        </div>
                                        <div className="analysis-card">
                                            <div className="analysis-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2"/><path d="M22 12c0-5.5-4.5-10-10-10v10h10z"/></svg></div>
                                            <h6>Heatmap</h6>
                                            <p>خريطة حرارية</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'inspector' && (
                            <div className="tab-content">
                                <div className="panel-section">
                                    <div className="panel-section-title">
                                        <span>معلومات الخريطة</span>
                                    </div>
                                    <div className="info-row"><span className="label">خط العرض</span><span className="value mono">{mapState.latitude.toFixed(4)}</span></div>
                                    <div className="info-row"><span className="label">خط الطول</span><span className="value mono">{mapState.longitude.toFixed(4)}</span></div>
                                    <div className="info-row"><span className="label">مستوى التكبير</span><span className="value mono">{mapState.zoom.toFixed(1)}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                <footer className="statusbar">
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/></svg>
                        <span>{mapState.latitude.toFixed(4)}°N, {mapState.longitude.toFixed(4)}°E</span>
                    </div>
                    <div className="status-divider"></div>
                    <div className="status-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>EPSG:4326</span>
                    </div>
                    <div className="status-spacer"></div>
                    <div className="status-pill">المختبر متصل</div>
                </footer>
            </div>
        </div>
    );
};

export default PalNovaaLab;
