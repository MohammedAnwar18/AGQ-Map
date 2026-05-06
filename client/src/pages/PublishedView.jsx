import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
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
                if (response.data.success) {
                    setPageData(response.data.page);
                    if (response.data.page.name) {
                        document.title = `${response.data.page.name} | PalNovaa`;
                    }
                } else {
                    setError('لم يتم العثور على الصفحة المطلوبة');
                }
            } catch (err) {
                setError('حدث خطأ أثناء تحميل البيانات');
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    const config = useMemo(() => {
        if (!pageData?.config) return {};
        try {
            return typeof pageData.config === 'string' ? JSON.parse(pageData.config) : pageData.config;
        } catch (e) {
            return pageData.config || {};
        }
    }, [pageData]);

    const selections = config.selections || {};
    const elements = config.elements || [];
    const geoLayers = config.geoLayers || [];

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
            } catch (e) {}
        }
    }, [geoLayers, loading]);

    const dynamicStyles = useMemo(() => {
        const palette = selections.palette === 'custom' ? [selections.customPrimary, '#0A1628', '#142B47'] : 
                       selections.palette === 'classic' ? ['#F5A623', '#0F1E33', '#142B47'] : 
                       selections.palette === 'ocean' ? ['#06D6F2', '#1A2980', '#0A1628'] : ['#10B981', '#050B16', '#0F172A'];
        return {
            '--primary': palette[0],
            '--bg-deep': palette[1],
            '--bg-soft': palette[2],
            '--font-main': selections.fontH?.includes('Cairo') ? 'Cairo, sans-serif' : 'Inter, sans-serif'
        };
    }, [selections]);

    const mapStyle = useMemo(() => {
        const bm = selections.basemap || 'satellite';
        const key = 'N6uNP3sTu25OIBUyi9G1';
        if (bm === 'satellite') return `https://api.maptiler.com/maps/satellite/style.json?key=${key}`;
        const styleIds = { dark: 'dark-v10', light: 'light-v10', terrain: 'outdoors-v11', vintage: 'streets-v11' };
        return `https://api.maptiler.com/maps/${bm === 'cyber' ? '019b8b76-e5e2-7f02-b5d1-74fd0cf725bb' : (styleIds[bm] || 'basic-v2')}/style.json?key=${key}`;
    }, [selections.basemap]);

    const handleMapClick = (e) => {
        const feature = e.features && e.features[0];
        if (feature && selections.enable_popups) {
            setSelectedFeature({
                lng: e.lngLat.lng,
                lat: e.lngLat.lat,
                properties: feature.properties
            });
        } else {
            setSelectedFeature(null);
        }
    };

    const renderedLayers = useMemo(() => geoLayers.map((layer, idx) => {
        if (!layer || !layer.data) return null;
        try {
            let geomType = 'Polygon';
            if (layer.data.features && layer.data.features.length > 0) {
                const firstWithGeom = layer.data.features.find(f => f.geometry && f.geometry.type);
                if (firstWithGeom) geomType = firstWithGeom.geometry.type;
            } else if (layer.data.type === 'Feature' && layer.data.geometry) {
                geomType = layer.data.geometry.type;
            }
            const isLine = geomType.toLowerCase().includes('line');
            const isPoint = geomType.toLowerCase().includes('point');
            const layerColor = layer.color || selections.customPrimary || '#F5A623';
            return (
                <Source key={`s-${idx}`} id={`s-${idx}`} type={layer.type === 'raster' ? 'raster' : 'geojson'} data={layer.data}>
                    {layer.type === 'raster' ? (
                        <Layer id={`l-${idx}`} type="raster" paint={{ 'raster-opacity': 0.8 }} />
                    ) : (
                        <Layer
                            id={`l-${idx}`}
                            type={isPoint ? 'circle' : isLine ? 'line' : 'fill'}
                            paint={
                                isPoint ? { 'circle-color': layerColor, 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.9 } :
                                isLine ? { 'line-color': layerColor, 'line-width': 4, 'line-opacity': 0.9 } :
                                { 'fill-color': layerColor, 'fill-opacity': 0.45, 'fill-outline-color': '#ffffff' }
                            }
                        />
                    )}
                </Source>
            );
        } catch (err) { return null; }
    }), [geoLayers, selections.customPrimary]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050B16', color: 'white' }}>
                <p>جاري التحميل...</p>
            </div>
        );
    }

    if (error) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{error}</div>;

    return (
        <div className={`published-app-container layout-${selections.layout}`} style={{ 
            height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
            display: 'flex', flexDirection: selections.layout === 'stacked' ? 'column' : 'row',
            fontFamily: 'var(--font-main)', color: 'white',
            backgroundColor: 'var(--bg-deep)', ...dynamicStyles
        }}>
            {selections.layout === 'sidebar' && (
                <aside style={{ width: '350px', background: 'var(--bg-soft)', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 100, padding: '20px' }}>
                    <h2 style={{ color: 'var(--primary)' }}>{pageData.name}</h2>
                    <p style={{ opacity: 0.6 }}>بواسطة {pageData.owner_name}</p>
                </aside>
            )}

            <main style={{ flex: 1, position: 'relative', height: '100%' }}>
                <Map
                    ref={mapRef}
                    mapLib={maplibregl}
                    initialViewState={{ longitude: 35.2034, latitude: 31.9038, zoom: 12 }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle={mapStyle}
                    onClick={handleMapClick}
                    interactiveLayerIds={geoLayers.filter(l => l && l.data && (l.type !== 'raster')).map((l, idx) => `l-${idx}`)}
                >
                    {selections.show_controls && <NavigationControl position="bottom-right" />}
                    {renderedLayers}

                    {selectedFeature && (
                        <Popup
                            longitude={selectedFeature.lng} latitude={selectedFeature.lat}
                            onClose={() => setSelectedFeature(null)} closeButton={false} anchor="bottom"
                        >
                            <div style={{ padding: '10px', color: 'black' }}>
                                {Object.entries(selectedFeature.properties).map(([k, v]) => (
                                    <div key={k} style={{ fontSize: '0.8rem' }}><strong>{k}:</strong> {String(v)}</div>
                                ))}
                            </div>
                        </Popup>
                    )}
                </Map>

                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
                    {elements.map(el => (
                        <div key={el.id} style={{ position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, pointerEvents: 'auto' }}>
                            {el.type === 'heading' && <h1 style={{ color: 'white', margin: 0 }}>{el.text}</h1>}
                            {el.type === 'paragraph' && <p style={{ color: 'white', opacity: 0.8 }}>{el.text}</p>}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default PublishedView;
