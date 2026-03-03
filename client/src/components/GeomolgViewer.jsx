import React, { useEffect, useRef, useState } from 'react';
import { loadModules } from 'esri-loader';

const WB_URL = "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2023_15cm_jp2_PG1923_jp2/MapServer";
const GAZA_URL = "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2024_m12_Satellite_tif_PG1923/MapServer";

const GeomolgViewer = ({ onClose }) => {
    const mapDiv = useRef(null);
    const viewRef = useRef(null);
    const mapRef = useRef(null);
    const TileLayerClassRef = useRef(null);

    // State to track loading and current region
    const [currentRegion, setCurrentRegion] = useState('wb');
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        let view;

        const initializeMap = async () => {
            try {
                // تحميل وحدات ArcGIS API
                const [Map, MapView, TileLayer] = await loadModules(
                    ["esri/Map", "esri/views/MapView", "esri/layers/TileLayer"],
                    { css: "https://js.arcgis.com/4.26/esri/themes/light/main.css" }
                );

                TileLayerClassRef.current = TileLayer;

                // إعداد طبقة Orthophoto للضفة الغربية كبداية
                const orthoLayer = new TileLayer({
                    url: WB_URL
                });

                // إعداد الخريطة
                const map = new Map({
                    basemap: null,
                    layers: [orthoLayer]
                });
                mapRef.current = map;

                // إعداد العرض
                view = new MapView({
                    container: mapDiv.current,
                    map: map,
                    center: [35.2034, 31.9038], // وسط الضفة الغربية
                    zoom: 14
                });
                viewRef.current = view;

                view.ui.components = ["zoom", "compass", "attribution"];

                view.when(() => {
                    setIsMapReady(true);
                });

            } catch (error) {
                console.error("ArcGIS load error: ", error);
            }
        };

        if (!viewRef.current) {
            initializeMap();
        }

        return () => {
            if (viewRef.current) {
                viewRef.current.container = null;
            }
        };
    }, []);

    const handleSwitchRegion = (region) => {
        if (!viewRef.current || !TileLayerClassRef.current || !mapRef.current) return;

        // تحديد الرابط والإحداثيات بناءً على المنطقة
        const url = region === 'gaza' ? GAZA_URL : WB_URL;
        const center = region === 'gaza' ? [34.35, 31.4] : [35.2034, 31.9038]; // إحداثيات تقريبية لغزة والضفة
        const zoom = region === 'gaza' ? 12 : 14;

        // إزالة الطبقات القديمة
        mapRef.current.removeAll();

        // إضافة الطبقة الجديدة
        const newLayer = new TileLayerClassRef.current({ url });
        mapRef.current.add(newLayer);

        // تحريك الكاميرا
        viewRef.current.goTo({
            center: center,
            zoom: zoom
        });

        setCurrentRegion(region);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, background: 'white' }}>
            <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />

            {/* أزرار التحكم والتبديل */}
            <div style={{
                position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.95)', padding: '5px',
                borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                zIndex: 50, display: 'flex', gap: '5px',
                backdropFilter: 'blur(5px)'
            }}>
                <button
                    onClick={() => handleSwitchRegion('wb')}
                    style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                        background: currentRegion === 'wb' ? '#1a5f7a' : 'transparent',
                        color: currentRegion === 'wb' ? 'white' : '#666',
                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    الضفة الغربية
                </button>
                <button
                    onClick={() => handleSwitchRegion('gaza')}
                    style={{
                        padding: '8px 20px', borderRadius: '8px', border: 'none',
                        background: currentRegion === 'gaza' ? '#1a5f7a' : 'transparent',
                        color: currentRegion === 'gaza' ? 'white' : '#666',
                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    قطاع غزة
                </button>
            </div>

            {/* زر الإغلاق */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute', top: '20px', right: '20px',
                    background: 'white', border: 'none', padding: '10px 20px',
                    borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                    cursor: 'pointer', zIndex: 50, fontWeight: 'bold', fontSize: '1rem',
                    color: '#333', display: 'flex', alignItems: 'center', gap: '5px'
                }}
            >
                <span>إغلاق</span>
                <span>✕</span>
            </button>

            {/* عنوان توضيحي (يتحرك للأسفل قليلاً) */}
            <div style={{
                position: 'absolute', bottom: '20px', left: '20px',
                background: 'rgba(255,255,255,0.9)', padding: '8px 15px',
                borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                zIndex: 50, fontSize: '0.85rem', fontWeight: 'bold', color: '#1a5f7a'
            }}>
                Geomolg Orthophoto {currentRegion === 'gaza' ? 'Gaza 2024' : 'West Bank 2023'}
            </div>
        </div>
    );
};

export default GeomolgViewer;
