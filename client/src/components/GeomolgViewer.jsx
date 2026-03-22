import React, { useEffect, useRef, useState } from 'react';
import { loadModules } from 'esri-loader';

const WB_URL = "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2024_15cm_tif_PG1923/MapServer";
const GAZA_URL = "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2024_m12_Satellite_tif_PG1923/MapServer";

const GeomolgViewer = ({ onClose, userLocation, posts, friends, shops, onShopClick, onPostClick }) => {
    const mapDiv = useRef(null);
    const viewRef = useRef(null);
    const mapRef = useRef(null);
    const graphicsLayerRef = useRef(null);
    const esriModules = useRef(null);
    const TileLayerClassRef = useRef(null);

    // State to track loading and current region
    const [currentRegion, setCurrentRegion] = useState('wb');
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        let view;

        const initializeMap = async () => {
            try {
                // تحميل وحدات ArcGIS API
                const [Map, MapView, TileLayer, GraphicsLayer, Graphic] = await loadModules(
                    ["esri/Map", "esri/views/MapView", "esri/layers/TileLayer", "esri/layers/GraphicsLayer", "esri/Graphic"],
                    { css: "https://js.arcgis.com/4.26/esri/themes/light/main.css" }
                );

                TileLayerClassRef.current = TileLayer;
                esriModules.current = { Graphic };

                // إعداد طبقة Orthophoto للضفة الغربية كبداية
                const orthoLayer = new TileLayer({
                    url: WB_URL
                });

                const graphicsLayer = new GraphicsLayer();
                graphicsLayerRef.current = graphicsLayer;

                // إعداد الخريطة
                const map = new Map({
                    basemap: null,
                    layers: [orthoLayer, graphicsLayer]
                });
                mapRef.current = map;

                // إعداد العرض
                view = new MapView({
                    container: mapDiv.current,
                    map: map,
                    center: userLocation ? [parseFloat(userLocation.longitude), parseFloat(userLocation.latitude)] : [35.2034, 31.9038],
                    zoom: userLocation ? 16 : 14
                });
                viewRef.current = view;

                view.ui.components = ["zoom", "compass", "attribution"];

                view.when(() => {
                    setIsMapReady(true);
                    
                    // Add click event listener for graphics
                    view.on("click", (event) => {
                        view.hitTest(event).then((response) => {
                            if (response.results.length > 0) {
                                // Find the graphic result
                                const graphicResult = response.results.find(res => res.graphic && res.graphic.layer === graphicsLayerRef.current);
                                if (graphicResult) {
                                    const attrs = graphicResult.graphic.attributes;
                                    if (attrs) {
                                        if (attrs.type === 'shop' && onShopClick) {
                                            onShopClick(attrs.data);
                                            onClose(); // Close Geomolg view to return to main UI overlay
                                        } else if (attrs.type === 'post' && onPostClick) {
                                            onPostClick(attrs.data);
                                            onClose();
                                        }
                                    }
                                }
                            }
                        });
                    });
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

    // Effect to render markers when map is ready or data changes
    useEffect(() => {
        if (!isMapReady || !graphicsLayerRef.current || !esriModules.current) return;

        const graphicsLayer = graphicsLayerRef.current;
        const { Graphic } = esriModules.current;
        
        graphicsLayer.removeAll();

        // 1. User Location
        if (userLocation) {
            const userGraphic = new Graphic({
                geometry: { type: "point", longitude: parseFloat(userLocation.longitude), latitude: parseFloat(userLocation.latitude) },
                symbol: { type: "simple-marker", color: "#fbab15", size: "18px", outline: { color: [255, 255, 255], width: 3 } },
                popupTemplate: { title: "موقعي", content: "أنت هنا" },
                attributes: { type: 'user' }
            });
            graphicsLayer.add(userGraphic);
        }

        // 2. Posts
        if (posts && posts.length > 0) {
            posts.forEach(post => {
                if (!post.location?.latitude || !post.location?.longitude) return;
                const postGraphic = new Graphic({
                    geometry: { type: "point", longitude: parseFloat(post.location.longitude), latitude: parseFloat(post.location.latitude) },
                    symbol: { type: "simple-marker", style: "diamond", color: "#1a5f7a", size: "14px", outline: { color: [255, 255, 255], width: 2 } },
                    popupTemplate: { title: post.user?.username || "منشور", content: "اضغط لعرض المنشور" },
                    attributes: { type: 'post', data: post }
                });
                graphicsLayer.add(postGraphic);
            });
        }

        // 3. Friends
        if (friends && friends.length > 0) {
            friends.forEach(friend => {
                if (!friend.last_latitude || !friend.last_longitude) return;
                const friendGraphic = new Graphic({
                    geometry: { type: "point", longitude: parseFloat(friend.last_longitude), latitude: parseFloat(friend.last_latitude) },
                    symbol: { type: "simple-marker", color: "#22c55e", size: "14px", outline: { color: [255, 255, 255], width: 2 } },
                    popupTemplate: { title: friend.username || "صديق", content: "صديقك متواجد هنا" },
                    attributes: { type: 'friend', data: friend }
                });
                graphicsLayer.add(friendGraphic);
            });
        }

        // 4. Shops
        if (shops && shops.length > 0) {
            shops.forEach(shop => {
                if (!shop.latitude || !shop.longitude) return;
                const shopGraphic = new Graphic({
                    geometry: { type: "point", longitude: parseFloat(shop.longitude), latitude: parseFloat(shop.latitude) },
                    symbol: { type: "simple-marker", style: "square", color: "#fbab15", size: "16px", outline: { color: [255, 255, 255], width: 2 } },
                    popupTemplate: { title: shop.name, content: "اضغط لعرض المتجر" },
                    attributes: { type: 'shop', data: shop }
                });
                graphicsLayer.add(shopGraphic);
            });
        }

    }, [isMapReady, userLocation, posts, friends, shops]);

    const handleSwitchRegion = (region) => {
        if (!viewRef.current || !TileLayerClassRef.current || !mapRef.current) return;

        // تحديد الرابط والإحداثيات بناءً على المنطقة
        const url = region === 'gaza' ? GAZA_URL : WB_URL;
        const center = region === 'gaza' ? [34.35, 31.4] : (userLocation ? [parseFloat(userLocation.longitude), parseFloat(userLocation.latitude)] : [35.2034, 31.9038]);
        const zoom = region === 'gaza' ? 12 : (userLocation ? 16 : 14);

        // إزالة الطبقة القديمة الجوية فقط وإبقاء الرسومات
        const layersToRemove = mapRef.current.layers.filter(l => l.type === "tile");
        mapRef.current.removeMany(layersToRemove.toArray());

        // إضافة الطبقة الجديدة بالخلف
        const newLayer = new TileLayerClassRef.current({ url });
        mapRef.current.add(newLayer, 0);

        // تحريك الكاميرا
        viewRef.current.goTo({
            center: center,
            zoom: zoom
        });

        setCurrentRegion(region);
    };

    return (
        <div className="geomolg-viewer-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3000, background: '#0f172a' }}>
            <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />

            {/* Optimized Region Control for Mobile & Web */}
            <div style={{
                position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(15, 23, 42, 0.9)', padding: '4px',
                borderRadius: '14px', border: '1px solid rgba(251, 171, 21, 0.4)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 100, display: 'flex', gap: '2px',
                backdropFilter: 'blur(20px)',
                width: 'auto', maxWidth: 'calc(100% - 90px)' 
            }}>
                <button
                    onClick={() => handleSwitchRegion('wb')}
                    style={{
                        padding: '10px 18px', borderRadius: '10px', border: 'none',
                        background: currentRegion === 'wb' ? '#fbab15' : 'transparent',
                        color: currentRegion === 'wb' ? '#0f172a' : 'rgba(255,255,255,0.7)',
                        fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.25s ease',
                        whiteSpace: 'nowrap'
                    }}
                >
                    الضفة الغربية
                </button>
                <button
                    onClick={() => handleSwitchRegion('gaza')}
                    style={{
                        padding: '10px 18px', borderRadius: '10px', border: 'none',
                        background: currentRegion === 'gaza' ? '#fbab15' : 'transparent',
                        color: currentRegion === 'gaza' ? '#0f172a' : 'rgba(255,255,255,0.7)',
                        fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.25s ease',
                        whiteSpace: 'nowrap'
                    }}
                >
                    قطاع غزة
                </button>
            </div>

            {/* Refined Close Button for better Mobile Reach */}
            <button
                onClick={onClose}
                className="geomolg-close-btn"
                style={{
                    position: 'absolute', top: '20px', right: '15px',
                    width: '42px', height: '42px', border: '1px solid rgba(251, 171, 21, 0.4)',
                    background: 'rgba(15, 23, 42, 0.85)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 100, color: '#fbab15',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(15px)',
                    transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)'; e.currentTarget.style.background = '#fbab15'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.85)'; e.currentTarget.style.color = '#fbab15'; }}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            {/* Minimal Attribution */}
            <div style={{
                position: 'absolute', bottom: '20px', left: '15px',
                background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px',
                borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 100, fontSize: '0.75rem', fontWeight: '700', color: 'rgba(251, 171, 21, 0.8)',
                backdropFilter: 'blur(10px)'
            }}>
                Geomolg Orthophoto 2024
            </div>
        </div>
    );
};

export default GeomolgViewer;
