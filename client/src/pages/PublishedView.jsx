import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const PublishedView = () => {
    const { slug } = useParams();
    const [pageData, setPageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPage = async () => {
            try {
                const apiUrl = window.location.origin === 'http://localhost:5173' ? 'http://localhost:5001' : '';
                const response = await axios.get(`${apiUrl}/api/pages/view/${slug}`);
                setPageData(response.data.page);
            } catch (err) {
                console.error('Fetch page failed:', err);
                setError(err.response?.data?.error || 'فشل تحميل الصفحة');
            } finally {
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    const config = useMemo(() => pageData?.config || {}, [pageData]);
    const selections = config.selections || {};
    const elements = config.elements || [];

    const mapStyle = useMemo(() => {
        const bm = selections.basemap || 'satellite';
        if (bm === 'satellite') {
            return {
                version: 8,
                sources: { 'raster-tiles': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 } },
                layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }]
            };
        }
        // Fallback for others to MapTiler if possible or default MapLibre
        return `https://api.maptiler.com/maps/basic-v2/style.json?key=N6uNP3sTu25OIBUyi9G1`;
    }, [selections.basemap]);

    if (loading) return <div style={{ height: '100vh', background: '#050B16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>جاري تحميل التطبيق...</div>;
    if (error) return <div style={{ height: '100vh', background: '#050B16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>{error}</div>;

    return (
        <div style={{ 
            height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative',
            fontFamily: selections.fontB || 'sans-serif',
            background: selections.palette === 'dark' ? '#0A1628' : '#FFFFFF'
        }}>
            <Map
                initialViewState={{
                    longitude: 35.2034,
                    latitude: 31.9038,
                    zoom: 12
                }}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
            >
                <NavigationControl position="bottom-right" />
            </Map>

            {/* Render Custom UI Elements */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {elements.map(el => (
                    <div 
                        key={el.id}
                        style={{
                            position: 'absolute',
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            width: el.w ? `${el.w}px` : 'auto',
                            pointerEvents: 'auto',
                            zIndex: 10
                        }}
                    >
                        {el.type === 'heading' && <h1 style={{ color: 'white', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{el.text}</h1>}
                        {el.type === 'subheading' && <h2 style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>{el.text}</h2>}
                        {el.type === 'paragraph' && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{el.text}</p>}
                        {el.type === 'btn_primary' && <button style={{ padding: '10px 25px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>{el.text}</button>}
                        {el.type === 'search' && (
                            <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '10px 15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'white', width: '300px' }}>
                                {el.text}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {/* Attribution / Branding */}
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                Powered by PalNovaa Platform
            </div>
        </div>
    );
};

export default PublishedView;
