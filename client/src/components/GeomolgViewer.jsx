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
                Geomolg Orthophoto {currentRegion === 'gaza' ? 'Gaza 2024' : 'West Bank 2024'}
            </div>
        </div>
    );
};

export default GeomolgViewer;
