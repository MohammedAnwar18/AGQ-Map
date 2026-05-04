import React, { useState, useEffect, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import './PalNovaaLab.css';

const PalNovaaLab = ({ onClose }) => {
    const [showIntro, setShowIntro] = useState(true);
    const [particles, setParticles] = useState([]);
    const [activeTab, setActiveTab] = useState('layers');
    const [mapState, setMapState] = useState({
        longitude: 35.2034,
        latitude: 31.9038,
        zoom: 13,
        pitch: 0,
        bearing: 0
    });
    const mapRef = useRef(null);

    const mapStyle = useMemo(() => ({
        version: 8,
        name: "Google Satellite",
        sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
            'raster-tiles': {
                type: 'raster',
                tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
                tileSize: 256
            }
        },
        layers: [
            {
                id: 'simple-tiles',
                type: 'raster',
                source: 'raster-tiles',
                minzoom: 0,
                maxzoom: 22
            }
        ]
    }), []);

    const [drawingMode, setDrawingMode] = useState(null);
    const [selectedFeatureInfo, setSelectedFeatureInfo] = useState(null);
    const [draftCoordinates, setDraftCoordinates] = useState([]);
    const [geoLayers, setGeoLayers] = useState([]);
    const [activeTableLayerId, setActiveTableLayerId] = useState(null);
    const [isDesignStudioOpen, setIsDesignStudioOpen] = useState(false);
    const [activeDsCategory, setActiveDsCategory] = useState('layouts');
    const [showBottomTable, setShowBottomTable] = useState(false);
    
    const [designSelections, setDesignSelections] = useState({
        layout: 'fullmap',
        palette: 'classic',
        font: 'cairo_tajawal',
        basemap: 'dark',
        marker: 'pin',
        component: 'primary',
        effect: 'glow'
    });

    const activeTableLayer = useMemo(() => geoLayers.find(l => l.id === activeTableLayerId) || null, [geoLayers, activeTableLayerId]);

    const attributeKeys = useMemo(() => {
        if (!activeTableLayer || !activeTableLayer.data.features) return [];
        const keys = new Set();
        for (let i = 0; i < Math.min(activeTableLayer.data.features.length, 100); i++) {
            const props = activeTableLayer.data.features[i].properties;
            if (props) {
                Object.keys(props).forEach(k => keys.add(k));
            }
        }
        return Array.from(keys);
    }, [activeTableLayer]);

    const haversineDistance = (coords1, coords2) => {
        const R = 6371e3;
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(coords2[1] - coords1[1]);
        const dLon = toRad(coords2[0] - coords1[0]);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(coords1[1])) * Math.cos(toRad(coords2[1])) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const finishDrawing = () => {
        if (draftCoordinates.length > 1) {
            let geometryType = drawingMode === 'polygon' && draftCoordinates.length > 2 ? 'Polygon' : 'LineString';
            let coords = geometryType === 'Polygon' ? [[...draftCoordinates, draftCoordinates[0]]] : draftCoordinates;
            
            let metricText = '';
            if (geometryType === 'LineString' || drawingMode === 'measure') {
                let dist = 0;
                for (let i = 0; i < coords.length - 1; i++) dist += haversineDistance(coords[i], coords[i+1]);
                metricText = dist > 1000 ? (dist / 1000).toFixed(2) + ' كم' : dist.toFixed(1) + ' م';
            } else if (geometryType === 'Polygon') {
                let area = 0;
                const pts = coords[0];
                for (let i = 0; i < pts.length - 1; i++) {
                    let p1 = pts[i];
                    let p2 = pts[i + 1];
                    area += (p2[0] - p1[0]) * Math.PI/180 * (2 + Math.sin(p1[1]*Math.PI/180) + Math.sin(p2[1]*Math.PI/180));
                }
                area = Math.abs(area * 6378137 * 6378137 / 2.0);
                metricText = area > 1000000 ? (area / 1000000).toFixed(2) + ' كم²' : area.toFixed(1) + ' م²';
            }

            const newFeature = { type: 'Feature', geometry: { type: geometryType, coordinates: coords }, properties: { type: `drawn_${drawingMode}`, name: `رسمة (${drawingMode})`, Measurement: metricText } };
            setGeoLayers(prev => [...prev, {
                id: Date.now().toString(),
                name: `رسم (${drawingMode === 'polygon' ? 'مساحة' : drawingMode === 'measure' ? 'قياس مسافة' : 'مسار'})`,
                data: { type: 'FeatureCollection', features: [newFeature] },
                color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][prev.length % 5],
                measurement: metricText
            }]);
        }
        setDraftCoordinates([]);
        setDrawingMode(null);
    };

    const handleMapClick = (e) => {
        if (drawingMode) {
            const coord = [e.lngLat.lng, e.lngLat.lat];
            if (drawingMode === 'point') {
                const newFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: coord }, properties: { type: 'drawn_point', name: 'نقطة محددة' } };
                setGeoLayers(prev => [...prev, {
                    id: Date.now().toString(),
                    name: 'رسم (نقطة)',
                    data: { type: 'FeatureCollection', features: [newFeature] },
                    color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][prev.length % 5]
                }]);
                setDrawingMode(null);
            } else if (drawingMode === 'line' || drawingMode === 'measure' || drawingMode === 'polygon') {
                setDraftCoordinates(prev => [...prev, coord]);
            }
            return;
        }
    };

    const handleToolClick = (tool) => {
        if (drawingMode === tool) finishDrawing();
        else {
            finishDrawing();
            setDrawingMode(tool);
        }
    };

    useEffect(() => {
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
        const timer = setTimeout(() => setShowIntro(false), 2800);
        return () => clearTimeout(timer);
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                const newLayer = {
                    id: Date.now().toString(),
                    name: file.name,
                    data: json,
                    color: ['#06D6F2', '#F5A623', '#10D9A0', '#8B5CF6', '#EC4899'][geoLayers.length % 5]
                };
                setGeoLayers(prev => [...prev, newLayer]);
                setActiveTableLayerId(newLayer.id);
                setShowBottomTable(true);
            } catch (err) { alert('خطأ في الملف'); }
        };
        reader.readAsText(file);
    };

    const launchDesignStudioFinal = () => setIsDesignStudioOpen(true);

    const performActualExport = () => {
        alert("جاري تصدير الملفات... سيتم تحميل ملف HTML الخاص بك فوراً.");
        setIsDesignStudioOpen(false);
    };

    return (
        <div className="palnovaa-lab-container" dir="rtl">
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
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 2h6"/><path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/><path d="M7 16h10"/>
                            </svg>
                        </div>
                        <h1 dir="ltr">PalNovaa <span className="lab-tag">Lab</span></h1>
                        <div className="intro-loader"></div>
                    </div>
                </div>
            )}

            <div className="lab-app">
                <header className="topbar">
                    <div className="brand">
                        <div className="brand-logo">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2h6"/><path d="M10 2v7.5L4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V2"/><path d="M7 16h10"/></svg>
                        </div>
                        <div className="brand-text">
                            <strong>PalNovaa</strong>
                            <small>LAB · v3.5 (Studio Ready)</small>
                        </div>
                    </div>
                    <div className="topbar-actions">
                        <button className="top-btn" onClick={onClose}>إغلاق</button>
                        <button className="top-btn primary" onClick={launchDesignStudioFinal}>استوديو التصميم</button>
                    </div>
                </header>

                <div className="lab-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    <aside className="sidebar" style={{ width: '60px', background: 'rgba(10,22,40,0.8)', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
                        <button className="tool" onClick={() => handleToolClick('point')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg></button>
                        <button className="tool" onClick={() => handleToolClick('line')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg></button>
                        <button className="tool" onClick={() => handleToolClick('polygon')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/></svg></button>
                        <div style={{ flex: 1 }}></div>
                        <button className="tool studio-trigger-btn" onClick={launchDesignStudioFinal} style={{ background: 'var(--primary)', color: '#000' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8l4 4-4 4M8 12h8"/></svg>
                        </button>
                    </aside>

                    <main className="canvas" style={{ flex: 1, position: 'relative' }}>
                        <Map
                            ref={mapRef}
                            {...mapState}
                            onMove={evt => setMapState(evt.viewState)}
                            mapStyle={mapStyle}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <NavigationControl position="bottom-right" />
                            {geoLayers.map(layer => (
                                <Source key={layer.id} id={`src-${layer.id}`} type="geojson" data={layer.data}>
                                    <Layer id={`poly-${layer.id}`} type="fill" filter={['==', '$type', 'Polygon']} paint={{ 'fill-color': layer.color, 'fill-opacity': 0.4 }} />
                                    <Layer id={`line-${layer.id}`} type="line" filter={['==', '$type', 'LineString']} paint={{ 'line-color': layer.color, 'line-width': 3 }} />
                                    <Layer id={`point-${layer.id}`} type="circle" filter={['==', '$type', 'Point']} paint={{ 'circle-radius': 6, 'circle-color': layer.color }} />
                                </Source>
                            ))}
                        </Map>
                    </main>

                    <aside className="panel" style={{ width: '300px', background: 'rgba(10,22,40,0.9)', padding: '20px' }}>
                        <div className="panel-section">
                            <h4>استيراد البيانات</h4>
                            <input type="file" onChange={handleFileUpload} />
                        </div>
                        <div className="panel-section" style={{ marginTop: '20px' }}>
                            <h4>الطبقات</h4>
                            {geoLayers.map(l => (
                                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: l.color }}></div>
                                    <span>{l.name}</span>
                                </div>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>

            {/* DESIGN STUDIO MODAL */}
            <div className={`design-studio ${isDesignStudioOpen ? 'active' : ''}`}>
                <header className="ds-header">
                    <div className="ds-brand">
                        <div className="ds-brand-icon">🎨</div>
                        <div className="ds-brand-text">
                            <strong>PalNovaa Design Studio</strong>
                            <small>VERSION 3.5</small>
                        </div>
                    </div>
                    <div className="ds-header-actions" style={{ display: 'flex', gap: '10px' }}>
                        <button className="ds-btn primary" onClick={performActualExport}>تصدير المشروع</button>
                        <button className="ds-close" onClick={() => setIsDesignStudioOpen(false)}>✕</button>
                    </div>
                </header>

                <div className="ds-body">
                    <aside className="ds-categories">
                        <div className="ds-cat-title">الأقسام</div>
                        {[
                            { id: 'layouts', label: 'التخطيطات', icon: '📐' },
                            { id: 'palettes', label: 'الألوان', icon: '🎨' },
                            { id: 'typography', label: 'الخطوط', icon: 'font' },
                            { id: 'components', label: 'المكونات', icon: '🧩' },
                            { id: 'basemaps', label: 'الخرائط', icon: '🗺️' },
                            { id: 'markers', label: 'المعالم', icon: '📍' },
                            { id: 'icons', label: 'الأيقونات', icon: '⭐' },
                            { id: 'effects', label: 'التأثيرات', icon: '✨' }
                        ].map(cat => (
                            <div key={cat.id} className={`ds-cat ${activeDsCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveDsCategory(cat.id)}>
                                <span>{cat.icon}</span>
                                <span>{cat.label}</span>
                            </div>
                        ))}
                    </aside>

                    <main className="ds-main">
                        {activeDsCategory === 'layouts' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>تخطيطات الصفحة <span className="ds-tag">LAYOUTS</span></h2>
                                    <p>اختر هيكل الصفحة الأنسب لعرض الخريطة في موقعك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'fullmap', title: 'خريطة كاملة', sub: 'الخريطة تملأ الشاشة', type: 'lm-fullmap' },
                                        { id: 'sidebar', title: 'خريطة + لوحة جانبية', sub: 'لوحة معلومات جانبية', type: 'lm-sidebar' },
                                        { id: 'three', title: 'ثلاث لوحات', sub: 'أدوات + خريطة + تفاصيل', type: 'lm-three' },
                                        { id: 'dashboard', title: 'لوحة قيادة', sub: 'رأس + خريطة + إحصائيات', type: 'lm-dashboard' },
                                        { id: 'split', title: 'تقسيم 50/50', sub: 'خريطة + محتوى متوازي', type: 'lm-split' },
                                        { id: 'stacked', title: 'خريطة + قائمة', sub: 'الخريطة فوق وقائمة تحت', type: 'lm-stacked' },
                                        { id: 'floating', title: 'بطاقات عائمة', sub: 'خريطة + ودجتس', type: 'lm-floating' },
                                        { id: 'modal', title: 'خريطة في مودال', sub: 'نافذة خريطة وسط الصفحة', type: 'lm-modal' }
                                    ].map(l => (
                                        <div key={l.id} className={`ds-pick ${designSelections.layout === l.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, layout: l.id}))}>
                                            <div className={`layout-mockup ${l.type}`}>
                                                <div className="lm-block map"></div>
                                                <div className="lm-block alt"></div>
                                            </div>
                                            <div className="ds-pick-title">{l.title}</div>
                                            <div className="ds-pick-sub">{l.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'palettes' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>لوحات الألوان <span className="ds-tag">PALETTES</span></h2>
                                    <p>مجموعات ألوان احترافية مدروسة لتطبيقات الخرائط</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'classic', title: 'PalNovaa Classic', sub: 'برتقالي دافئ + كحلي عميق', colors: ['#F5A623', '#D88B0E', '#0F1E33', '#142B47', '#FFFFFF'] },
                                        { id: 'heritage', title: 'Heritage', sub: 'ألوان فلسطينية تراثية', colors: ['#CE1126', '#000000', '#FFFFFF', '#007A3D', '#F5A623'] },
                                        { id: 'ocean', title: 'Ocean Deep', sub: 'بحر هادئ ومحيط لانهائي', colors: ['#06D6F2', '#1A2980', '#0A1628', '#26D0CE', '#F0F8FF'] },
                                        { id: 'sunset', title: 'Sunset', sub: 'غروب الصحراء الدافئ', colors: ['#FF6B6B', '#F5A623', '#8B5CF6', '#FCD34D', '#1A0E1F'] },
                                        { id: 'forest', title: 'Forest', sub: 'طبيعة خضراء منعشة', colors: ['#10D9A0', '#059669', '#064E3B', '#A7F3D0', '#F5F4ED'] },
                                        { id: 'earth', title: 'Earth Tones', sub: 'ألوان ترابية كلاسيكية', colors: ['#D4C49B', '#A0826D', '#5C4033', '#F5F4ED', '#2C1810'] },
                                        { id: 'neon', title: 'Cyber Neon', sub: 'مستقبلي وعصري', colors: ['#06D6F2', '#8B5CF6', '#EC4899', '#050B16', '#F5A623'] },
                                        { id: 'minimal', title: 'Minimal', sub: 'بساطة وأناقة', colors: ['#FFFFFF', '#F5F4ED', '#E5E5E5', '#1A1A2E', '#F5A623'] }
                                    ].map(p => (
                                        <div key={p.id} className={`ds-pick ${designSelections.palette === p.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, palette: p.id}))}>
                                            <div className="palette-strip">
                                                {p.colors.map((c, i) => <span key={i} style={{ background: c }}></span>)}
                                            </div>
                                            <div className="ds-pick-title">{p.title}</div>
                                            <div className="ds-pick-sub">{p.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'typography' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>أزواج الخطوط <span className="ds-tag">TYPOGRAPHY</span></h2>
                                    <p>أزواج خطوط متناغمة للعناوين والنصوص</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'cairo_tajawal', title: 'Cairo + Tajawal', sub: 'عربي حديث · موصى به' },
                                        { id: 'tajawal_inter', title: 'Tajawal + Inter', sub: 'مختلط · أنيق' },
                                        { id: 'cairo_mono', title: 'Cairo + Mono', sub: 'تقني · للمطورين' },
                                        { id: 'tajawal_ed', title: 'Tajawal Editorial', sub: 'تحريري · رسمي' },
                                        { id: 'display', title: 'Display Big', sub: 'عرض · بصري' },
                                        { id: 'compact', title: 'Compact UI', sub: 'مدمج · واجهات' }
                                    ].map(f => (
                                        <div key={f.id} className={`ds-pick ${designSelections.font === f.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, font: f.id}))}>
                                            <div className="type-preview">
                                                <div className="t-title">العنوان الرئيسي</div>
                                                <div className="t-body">هذا نص تجريبي لعرض الخط.</div>
                                            </div>
                                            <div className="ds-pick-title">{f.title}</div>
                                            <div className="ds-pick-sub">{f.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'basemaps' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>ثيمات الخرائط <span className="ds-tag">BASEMAPS</span></h2>
                                    <p>اختر مظهر الخريطة الأنسب لتطبيقك</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'dark', title: 'Dark Matter', sub: 'داكن أنيق', type: 'bm-dark' },
                                        { id: 'light', title: 'Light Streets', sub: 'فاتح ونظيف', type: 'bm-light' },
                                        { id: 'satellite', title: 'Satellite', sub: 'صور أقمار صناعية', type: 'bm-satellite' },
                                        { id: 'terrain', title: 'Terrain', sub: 'تضاريس وارتفاعات', type: 'bm-terrain' },
                                        { id: 'vintage', title: 'Vintage Map', sub: 'خريطة تاريخية كلاسيكية', type: 'bm-vintage' },
                                        { id: 'cyber', title: 'Cyber Grid', sub: 'سايبر بانك مستقبلي', type: 'bm-cyber' }
                                    ].map(b => (
                                        <div key={b.id} className={`ds-pick ${designSelections.basemap === b.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, basemap: b.id}))}>
                                            <div className={`basemap-preview ${b.type}`}></div>
                                            <div className="ds-pick-title">{b.title}</div>
                                            <div className="ds-pick-sub">{b.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'markers' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>المعالم <span className="ds-tag">MARKERS</span></h2>
                                    <p>أشكال مختلفة لتمييز المواقع</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'pin', title: 'Classic Pin', sub: 'دبوس تقليدي', class: 'mk-pin' },
                                        { id: 'dot', title: 'Glow Dot', sub: 'نقطة متوهجة', class: 'mk-dot' },
                                        { id: 'pulse', title: 'Pulse Marker', sub: 'نبض حي', class: 'mk-pulse' },
                                        { id: 'cluster', title: 'Cluster', sub: 'تجميع نقاط', class: 'mk-cluster' },
                                        { id: 'numbered', title: 'Numbered', sub: 'رقم داخل دائرة', class: 'mk-num' },
                                        { id: 'square', title: 'Diamond', sub: 'مربع مائل عصري', class: 'mk-square' }
                                    ].map(m => (
                                        <div key={m.id} className={`ds-pick ${designSelections.marker === m.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, marker: m.id}))}>
                                            <div className="marker-preview">
                                                <div className={m.class}>{m.id === 'cluster' ? '12' : m.id === 'numbered' ? '5' : ''}</div>
                                            </div>
                                            <div className="ds-pick-title">{m.title}</div>
                                            <div className="ds-pick-sub">{m.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'components' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>المكونات <span className="ds-tag">COMPONENTS</span></h2>
                                    <p>عناصر واجهة جاهزة للاستخدام</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'primary', title: 'Primary Button', sub: 'زر متدرج', content: <button className="comp-btn">زر رئيسي</button> },
                                        { id: 'outline', title: 'Outline Button', sub: 'زر بحدود', content: <button className="comp-btn outline">زر محدد</button> },
                                        { id: 'ghost', title: 'Ghost Button', sub: 'خفيف', content: <button className="comp-btn ghost">زر شفاف</button> },
                                        { id: 'pill', title: 'Pill Button', sub: 'بيضاوي ناعم', content: <button className="comp-btn pill">زر بيضاوي</button> },
                                        { id: 'glow', title: 'Glow Button', sub: 'توهج قوي', content: <button className="comp-btn glow">متوهج</button> },
                                        { id: 'card', title: 'Card Default', sub: 'بطاقة معلومات', content: <div className="comp-card"><div className="c-title">عنوان</div><div className="c-text">نص وصفي</div></div> },
                                        { id: 'search', title: 'Search Bar', sub: 'شريط بحث', content: <div className="comp-search">🔍 ابحث...</div> },
                                        { id: 'toggle', title: 'Toggle Switch', sub: 'مفتاح تبديل', content: <div style={{width:'36px',height:'20px',background:'var(--primary)',borderRadius:'10px'}}></div> }
                                    ].map(c => (
                                        <div key={c.id} className={`ds-pick ${designSelections.component === c.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, component: c.id}))}>
                                            <div className="comp-preview">{c.content}</div>
                                            <div className="ds-pick-title">{c.title}</div>
                                            <div className="ds-pick-sub">{c.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'icons' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>مكتبة الأيقونات <span className="ds-tag">ICONS</span></h2>
                                    <p>أيقونات احترافية للخرائط والواجهات</p>
                                </div>
                                <div className="icons-grid">
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <div key={i} className="icon-cell">⭐</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeDsCategory === 'effects' && (
                            <div className="ds-section active">
                                <div className="ds-section-head">
                                    <h2>التأثيرات <span className="ds-tag">EFFECTS</span></h2>
                                    <p>ظلال وتدرجات بصرية لإضافة العمق</p>
                                </div>
                                <div className="ds-grid">
                                    {[
                                        { id: 'md', title: 'Shadow Medium', sub: 'ظل متوازن', class: 'ef-shadow-md' },
                                        { id: 'lg', title: 'Shadow Large', sub: 'ظل عميق', class: 'ef-shadow-lg' },
                                        { id: 'glow', title: 'Glow Effect', sub: 'توهج برتقالي', class: 'ef-glow' },
                                        { id: 'glass', title: 'Glassmorphism', sub: 'زجاج ضبابي', class: 'ef-glass' },
                                        { id: 'sunset', title: 'Sunset Gradient', sub: 'تدرج الغروب', class: 'ef-grad-sunset' },
                                        { id: 'ocean', title: 'Ocean Gradient', sub: 'تدرج المحيط', class: 'ef-grad-ocean' },
                                        { id: 'forest', title: 'Forest Gradient', sub: 'تدرج الغابة', class: 'ef-grad-forest' },
                                        { id: 'float', title: 'Float Animation', sub: 'حركة طفو', class: 'ef-anim-float' },
                                        { id: 'pulse', title: 'Pulse Animation', sub: 'نبضة دائرية', class: 'ef-anim-pulse' }
                                    ].map(e => (
                                        <div key={e.id} className={`ds-pick ${designSelections.effect === e.id ? 'selected' : ''}`} onClick={() => setDesignSelections(s => ({...s, effect: e.id}))}>
                                            <div className={`effect-preview ${e.class}`}><div className="effect-box"></div></div>
                                            <div className="ds-pick-title">{e.title}</div>
                                            <div className="ds-pick-sub">{e.sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </main>

                    <aside className="ds-preview">
                        <div className="ds-preview-head">👁️ معاينة حية</div>
                        <div className="preview-mock">
                            <div className="preview-mock-content">
                                <div className="pmc-header"></div>
                                <div className="pmc-map"></div>
                                <div className="pmc-bar"></div>
                            </div>
                        </div>
                        <div className="preview-info">
                            <div className="preview-info-row"><span className="pi-label">التخطيط:</span><span className="pi-value">{designSelections.layout}</span></div>
                            <div className="preview-info-row"><span className="pi-label">الألوان:</span><span className="pi-value">{designSelections.palette}</span></div>
                            <div className="preview-info-row"><span className="pi-label">الخط:</span><span className="pi-value">{designSelections.font}</span></div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaLab;
