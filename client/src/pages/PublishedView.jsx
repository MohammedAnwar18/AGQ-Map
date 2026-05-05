import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const PublishedView = () => {
    const { slug } = useParams();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFeature, setSelectedFeature] = useState(null);

    useEffect(() => {
        const fetchPage = async () => {
            try {
                const apiUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:5001' : '';
                const response = await axios.get(`${apiUrl}/api/pages/view/${slug}`);
                setPageData(response.data.page);
                
                // Update Page Title
                if (response.data.page.name) {
                    document.title = `${response.data.page.name} | PalNovaa`;
                }
            } catch (err) {
                setError(err.response?.data?.error || 'فشل تحميل الصفحة');
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    const config = useMemo(() => {
        if (!pageData?.config) return {};
        // Handle cases where DB might return config as a string instead of object
        try {
            const parsed = typeof pageData.config === 'string' ? JSON.parse(pageData.config) : pageData.config;
            console.log("🛠️ Page Config Loaded:", parsed);
            return parsed;
        } catch (e) {
            console.error("❌ Failed to parse config:", e);
            return pageData.config || {};
        }
    }, [pageData]);

    const selections = config.selections || {};
    const elements = config.elements || [];
    const geoLayers = config.geoLayers || [];

    useEffect(() => {
        if (geoLayers.length > 0) {
            console.log(`📍 Found ${geoLayers.length} layers to render:`, geoLayers);
        }
    }, [geoLayers]);

    // Auto-Focus on data
    const mapRef = React.useRef(null);
    useEffect(() => {
        if (geoLayers.length > 0 && mapRef.current) {
            try {
                const coordinates = [];
                const extract = (obj) => {
                    if (obj.type === 'FeatureCollection') obj.features.forEach(extract);
                    else if (obj.type === 'Feature') extract(obj.geometry);
                    else if (obj.coordinates) {
                        const flatten = (c) => {
                            if (typeof c[0] === 'number') coordinates.push(c);
                            else c.forEach(flatten);
                        };
                        flatten(obj.coordinates);
                    }
                };
                geoLayers.forEach(l => extract(l.data));
                
                if (coordinates.length > 0) {
                    const lons = coordinates.map(c => c[0]);
                    const lats = coordinates.map(c => c[1]);
                    const bounds = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
                    mapRef.current.fitBounds(bounds, { padding: 50, duration: 2000 });
                }
            } catch (e) { console.warn("Auto-focus failed", e); }
        }
    }, [geoLayers, loading]);

    // Inject Dynamic Styles
    const dynamicStyles = useMemo(() => {
        const palette = selections.palette === 'custom' ? [selections.customPrimary, '#0A1628', '#142B47'] : 
                       selections.palette === 'classic' ? ['#F5A623', '#0F1E33', '#142B47'] : 
                       selections.palette === 'ocean' ? ['#06D6F2', '#1A2980', '#0A1628'] : ['#10B981', '#050B16', '#0F172A'];
        
        return {
            '--primary': palette[0],
            '--bg-deep': palette[1],
            '--bg-soft': palette[2],
            '--font-main': selections.fontH?.includes('Cairo') ? 'Cairo, sans-serif' : 'Inter, sans-serif',
            '--radius': '16px',
            '--glass': 'rgba(255, 255, 255, 0.03)',
            '--glass-border': 'rgba(255, 255, 255, 0.08)'
        };
    }, [selections]);

    const mapStyle = useMemo(() => {
        const bm = selections.basemap || 'satellite';
        if (bm === 'satellite') {
            return {
                version: 8,
                sources: { 'raster-tiles': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 } },
                layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }]
            };
        }
        const styleIds = {
            dark: 'dark-v10',
            light: 'light-v10',
            terrain: 'outdoors-v11',
            vintage: 'streets-v11'
        };
        return `https://api.maptiler.com/maps/${bm === 'cyber' ? '019b8b76-e5e2-7f02-b5d1-74fd0cf725bb' : 'basic-v2'}/style.json?key=N6uNP3sTu25OIBUyi9G1`;
    }, [selections.basemap]);

    if (loading) {
        return (
            <div style={{ 
                height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', 
                alignItems: 'center', justifyContent: 'center', background: '#050B16', color: 'white',
                fontFamily: 'Cairo, sans-serif'
            }}>
                <div className="loader-orbit" style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '30px' }}>
                    <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(6, 214, 242, 0.1)', borderRadius: '50%' }}></div>
                    <div style={{ 
                        position: 'absolute', inset: 0, border: '2px solid transparent', 
                        borderTopColor: 'var(--primary, #06D6F2)', borderRadius: '50%',
                        animation: 'spin 1.5s linear infinite'
                    }}></div>
                    <div style={{ 
                        position: 'absolute', inset: '20px', border: '2px solid rgba(245, 166, 35, 0.2)', borderRadius: '50%',
                        animation: 'spin 2s linear reverse infinite'
                    }}></div>
                    <div style={{ 
                        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'
                    }}>
                        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--primary, #06D6F2)" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                    </div>
                </div>
                <h2 style={{ margin: '0 0 10px 0', letterSpacing: '2px', fontWeight: 900 }}>PALNOVAA <span style={{ color: '#06D6F2' }}>STUDIO</span></h2>
                <p style={{ opacity: 0.6, fontSize: '0.9rem', animation: 'pulse 2s infinite' }}>جاري تحضير التجربة المكانية... يرجى الانتظار</p>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
                `}</style>
            </div>
        );
    }
    if (error) return <div style={{ height: '100vh', background: '#050B16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B6B', textAlign: 'center', padding: '20px' }}>
        <div>
            <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
            <p>{error}</p>
            <button onClick={() => window.location.href = '/'} style={{ padding: '10px 20px', background: '#10B981', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>العودة للرئيسية</button>
        </div>
    </div>;

    return (
        <div className={`published-app-container layout-${selections.layout}`} style={{ 
            height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
            display: 'flex', flexDirection: selections.layout === 'stacked' ? 'column' : 'row',
            fontFamily: 'var(--font-main)', color: 'white',
            backgroundColor: 'var(--bg-deep)',
            ...dynamicStyles
        }}>
            {/* Sidebar Layout */}
            {selections.layout === 'sidebar' && (
                <aside style={{ width: '350px', background: 'var(--bg-soft)', borderLeft: '1px solid var(--glass-border)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <div style={{ marginBottom: '30px' }}>
                        <h2 style={{ color: 'var(--primary)', marginBottom: '5px' }}>{pageData.name}</h2>
                        <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>بواسطة {pageData.owner_name}</p>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {elements.filter(el => el.y < 30).map(el => (
                            <div key={el.id} style={{ marginBottom: '20px', pointerEvents: 'auto' }}>
                                <h4 style={{ margin: '0 0 8px 0' }}>{el.text}</h4>
                                <div style={{ height: '2px', width: '30px', background: 'var(--primary)' }}></div>
                            </div>
                        ))}
                    </div>
                </aside>
            )}

            {/* Main Map Area */}
            <main style={{ flex: 1, position: 'relative', height: '100%' }}>
                <Map
                    ref={mapRef}
                    initialViewState={{
                        longitude: 35.2034,
                        latitude: 31.9038,
                        zoom: 12
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle={getBasemapStyle(selections.basemap)}
                    onClick={handleMapClick}
                    interactiveLayerIds={geoLayers
                        .filter(l => l && l.data && (l.type !== 'raster'))
                        .map((l, idx) => `layer-${l.id || idx}`)}
                >
                    {selections.show_controls && <NavigationControl position="bottom-right" />}
                    
                    {/* Render Saved Layers */}
                    {geoLayers.map((layer, idx) => {
                        if (!layer || !layer.data) return null;

                        try {
                            // Enhanced geometry detection
                            let geomType = 'Polygon';
                            if (layer.data.features && layer.data.features.length > 0) {
                                // Find first feature with geometry
                                const firstWithGeom = layer.data.features.find(f => f.geometry && f.geometry.type);
                                if (firstWithGeom) geomType = firstWithGeom.geometry.type;
                            } else if (layer.data.type === 'Feature' && layer.data.geometry) {
                                geomType = layer.data.geometry.type;
                            }

                            const isLine = geomType.toLowerCase().includes('line');
                            const isPoint = geomType.toLowerCase().includes('point');
                            const layerId = `layer-${layer.id || idx}`;
                            const sourceId = `source-${layer.id || idx}`;
                            const layerColor = layer.color || selections.customPrimary || '#F5A623';

                            return (
                                <Source 
                                    key={sourceId} 
                                    id={sourceId} 
                                    type={layer.type === 'raster' ? 'raster' : 'geojson'} 
                                    data={layer.data} 
                                    url={layer.url} 
                                    coordinates={layer.coordinates}
                                >
                                    {layer.type === 'raster' ? (
                                        <Layer
                                            id={layerId}
                                            type="raster"
                                            paint={{ 'raster-opacity': 0.8 }}
                                        />
                                    ) : (
                                        <Layer
                                            id={layerId}
                                            type={isPoint ? 'circle' : isLine ? 'line' : 'fill'}
                                            paint={
                                                isPoint ? { 
                                                    'circle-color': layerColor, 
                                                    'circle-radius': 8, 
                                                    'circle-stroke-width': 2, 
                                                    'circle-stroke-color': '#ffffff',
                                                    'circle-opacity': 0.9
                                                } :
                                                isLine ? { 
                                                    'line-color': layerColor, 
                                                    'line-width': 4,
                                                    'line-opacity': 0.9,
                                                    'line-blur': 0.5
                                                } :
                                                { 
                                                    'fill-color': layerColor, 
                                                    'fill-opacity': 0.45, 
                                                    'fill-outline-color': '#ffffff' 
                                                }
                                            }
                                        />
                                    )}
                                </Source>
                            );
                        } catch (err) {
                            console.error(`❌ Error rendering layer ${layer.name || idx}:`, err);
                            return null;
                        }
                    })}

                    {/* Feature Popup */}
                    {selectedFeature && (
                        <Popup
                            longitude={selectedFeature.lng}
                            latitude={selectedFeature.lat}
                            onClose={() => setSelectedFeature(null)}
                            closeButton={false}
                            anchor="bottom"
                            maxWidth="300px"
                        >
                            <div style={{ padding: '10px', color: 'black', fontFamily: 'Cairo, sans-serif' }}>
                                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>تفاصيل المعلم</h4>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {Object.entries(selectedFeature.properties).map(([key, val]) => (
                                        <div key={key} style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                                            <strong style={{ color: '#666' }}>{key}:</strong> {String(val)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Popup>
                    )}
                </Map>

                {/* Floating Elements (Builder elements) */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                    {elements.map(el => (
                        <div 
                            key={el.id}
                            className="builder-element"
                            style={{
                                position: 'absolute',
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: el.w ? `${el.w}px` : 'auto',
                                pointerEvents: 'auto'
                            }}
                        >
                            {el.type === 'heading' && <h1 style={{ color: 'white', margin: 0, textShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '2.5rem' }}>{el.text}</h1>}
                            {el.type === 'paragraph' && <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '400px', lineHeight: '1.6' }}>{el.text}</p>}
                            {el.type === 'btn_primary' && (
                                <button style={{ 
                                    padding: '12px 30px', background: 'var(--primary)', color: 'white', border: 'none', 
                                    borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.2)', transition: 'all 0.3s'
                                }}>{el.text}</button>
                            )}
                            {el.type === 'search' && (
                                <div style={{ 
                                    background: 'rgba(10, 22, 40, 0.7)', backdropFilter: 'blur(20px)', 
                                    padding: '12px 20px', borderRadius: '15px', border: '1px solid var(--glass-border)', 
                                    color: 'white', width: '350px', display: 'flex', alignItems: 'center', gap: '10px'
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                                    <input type="text" placeholder={el.text} style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%' }} />
                                </div>
                            )}
                            {el.type === 'social' && (
                                <div style={{ display: 'flex', gap: '15px', background: 'var(--glass)', backdropFilter: 'blur(10px)', padding: '10px 20px', borderRadius: '50px', border: '1px solid var(--glass-border)' }}>
                                    {[1, 2, 3].map(i => <div key={i} style={{ width: '30px', height: '30px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', cursor: 'pointer' }}></div>)}
                                </div>
                            )}
                            {el.type === 'card' && (
                                <div style={{ 
                                    width: '280px', background: 'var(--bg-soft)', padding: '20px', borderRadius: '20px', 
                                    border: '1px solid var(--glass-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' 
                                }}>
                                    <div style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '15px' }}></div>
                                    <h4 style={{ margin: '0 0 10px 0' }}>{el.text || 'بطاقة تفاعلية'}</h4>
                                    <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>هذا عنصر احترافي يمكن للمصمم استخدامه لعرض المنتجات أو المعالم.</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Dashboard Overlay */}
                {selections.layout === 'dashboard' && (
                    <div style={{ position: 'absolute', bottom: '30px', left: '30px', right: '30px', display: 'flex', gap: '20px', zIndex: 20 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ flex: 1, background: 'rgba(10, 22, 40, 0.8)', backdropFilter: 'blur(15px)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '5px' }}>إحصائيات مباشرة</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{Math.floor(Math.random() * 1000)}+</div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Custom Branding Footer */}
            <div style={{ 
                position: 'absolute', bottom: '15px', left: '20px', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 15px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)', borderRadius: '100px',
                fontSize: '0.7rem', opacity: 0.8, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>
                <span>Powered by <strong>PalNovaa Studio</strong></span>
            </div>

            <style>{`
                .published-app-container * { box-sizing: border-box; }
                .builder-element:hover { transform: translateY(-2px); transition: 0.3s; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-thumb { background: var(--glass-border); borderRadius: 10px; }
            `}</style>
        </div>
    );
};

export default PublishedView;
