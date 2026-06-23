import React, { useEffect, useRef, useState } from 'react';
import { loadModules } from 'esri-loader';
import proj4 from 'proj4';
import './Modal.css';

// تعريف مسقط فلسطين 1923
proj4.defs("EPSG:28191", "+proj=cass +lat_0=31.7340969444444 +lon_0=35.2120805555556 +x_0=170251.555 +y_0=126867.909 +a=6378300.789 +b=6356566.435 +units=m +no_defs +type=crs");

const toPalGrid = (lon, lat) => {
    try {
        const [x, y] = proj4("EPSG:4326", "EPSG:28191", [parseFloat(lon), parseFloat(lat)]);
        return { x, y };
    } catch (e) {
        console.error("Coordinate projection error:", e);
        return { x: parseFloat(lon), y: parseFloat(lat) };
    }
};

const ORTHOPHOTO_SERVICES = {
    wb: {
        '2025': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2025_15cm_tif_PG1923/MapServer",
        '2024': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2024_15cm_tif_PG1923/MapServer",
        '2023': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2023_15cm_tif_PG1923/MapServer",
        '2022': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2022_15cm_tif_PG1923/MapServer",
        '2021': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2021_15cm_tif_PG1923/MapServer",
        '2020': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2020_15cm_tif_PG1923/MapServer"
    },
    gaza: {
        '2025': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2025_m03_Satellite_tif_PG1923/MapServer",
        '2024': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2024_m12_Satellite_tif_PG1923/MapServer",
        '2022': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2022_m12_Satellite_tif_PG1923/MapServer",
        '2018': "https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_GS_2018_Satellite_tif_PG1923/MapServer"
    }
};

const GeomolgViewer = ({ onClose, userLocation, posts, friends, shops, onShopClick, onPostClick }) => {
    const mapDiv = useRef(null);
    const containerRef = useRef(null);
    const viewRef = useRef(null);
    const mapRef = useRef(null);
    const graphicsLayerRef = useRef(null);
    const esriModules = useRef(null);
    const TileLayerClassRef = useRef(null);

    // State to track loading, current region, year, and fullscreen
    const [currentRegion, setCurrentRegion] = useState('wb');
    const [selectedYear, setSelectedYear] = useState('2025');
    const [isMapReady, setIsMapReady] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error("Fullscreen error:", err);
            });
        } else {
            document.exitFullscreen();
        }
    };

    useEffect(() => {
        const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

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
                    url: ORTHOPHOTO_SERVICES.wb['2025']
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
                const defaultCenter = [35.2034, 31.9038];
                const centerCoords = userLocation 
                    ? toPalGrid(userLocation.longitude, userLocation.latitude)
                    : toPalGrid(defaultCenter[0], defaultCenter[1]);

                view = new MapView({
                    container: mapDiv.current,
                    map: map,
                    center: [centerCoords.x, centerCoords.y],
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

    // Effect to update view when userLocation changes for live tracking
    useEffect(() => {
        if (isMapReady && viewRef.current && userLocation) {
            const coords = toPalGrid(userLocation.longitude, userLocation.latitude);
            viewRef.current.goTo({
                center: [coords.x, coords.y]
            });
        }
    }, [isMapReady, userLocation]);

    // Effect to render markers when map is ready or data changes
    useEffect(() => {
        if (!isMapReady || !graphicsLayerRef.current || !esriModules.current) return;

        const graphicsLayer = graphicsLayerRef.current;
        const { Graphic } = esriModules.current;
        
        graphicsLayer.removeAll();

        // 1. User Location
        if (userLocation) {
            const coords = toPalGrid(userLocation.longitude, userLocation.latitude);
            const userGraphic = new Graphic({
                geometry: { 
                    type: "point", 
                    x: coords.x, 
                    y: coords.y, 
                    spatialReference: { wkid: 28191 } 
                },
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
                const coords = toPalGrid(post.location.longitude, post.location.latitude);
                const postGraphic = new Graphic({
                    geometry: { 
                        type: "point", 
                        x: coords.x, 
                        y: coords.y, 
                        spatialReference: { wkid: 28191 } 
                    },
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
                const coords = toPalGrid(friend.last_longitude, friend.last_latitude);
                const friendGraphic = new Graphic({
                    geometry: { 
                        type: "point", 
                        x: coords.x, 
                        y: coords.y, 
                        spatialReference: { wkid: 28191 } 
                    },
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
                const coords = toPalGrid(shop.longitude, shop.latitude);
                const shopGraphic = new Graphic({
                    geometry: { 
                        type: "point", 
                        x: coords.x, 
                        y: coords.y, 
                        spatialReference: { wkid: 28191 } 
                    },
                    symbol: { type: "simple-marker", style: "square", color: "#fbab15", size: "16px", outline: { color: [255, 255, 255], width: 2 } },
                    popupTemplate: { title: shop.name, content: "اضغط لعرض المتجر" },
                    attributes: { type: 'shop', data: shop }
                });
                graphicsLayer.add(shopGraphic);
            });
        }

    }, [isMapReady, userLocation, posts, friends, shops]);

    const handleSwitchLayer = (region, year) => {
        if (!viewRef.current || !TileLayerClassRef.current || !mapRef.current) return;

        // Fallback year if not available for that region
        const availableYears = Object.keys(ORTHOPHOTO_SERVICES[region]);
        const targetYear = availableYears.includes(year) ? year : availableYears[0];

        const url = ORTHOPHOTO_SERVICES[region][targetYear];
        
        // Only move coordinates if switching region
        let center = null;
        let zoom = null;
        if (region !== currentRegion) {
            const rawCenter = region === 'gaza' ? [34.35, 31.4] : (userLocation ? [parseFloat(userLocation.longitude), parseFloat(userLocation.latitude)] : [35.2034, 31.9038]);
            const projCenter = toPalGrid(rawCenter[0], rawCenter[1]);
            center = [projCenter.x, projCenter.y];
            zoom = region === 'gaza' ? 12 : (userLocation ? 16 : 14);
        }

        // إزالة الطبقة القديمة الجوية فقط وإبقاء الرسومات
        const layersToRemove = mapRef.current.layers.filter(l => l.type === "tile");
        mapRef.current.removeMany(layersToRemove.toArray());

        // إضافة الطبقة الجديدة بالخلف
        const newLayer = new TileLayerClassRef.current({ url });
        mapRef.current.add(newLayer, 0);

        // تحريك الكاميرا
        if (center && zoom) {
            viewRef.current.goTo({
                center: center,
                zoom: zoom
            });
        }

        setCurrentRegion(region);
        setSelectedYear(targetYear);
    };

    return (
        <div className="modal-overlay geomolg-modal-overlay" onClick={onClose}>
            <div className="modal-container geomolg-modal-container" ref={containerRef} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>الصورة الجوية</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {/* Fullscreen Toggle for Laptop/PC experience */}
                        <button 
                            className="btn-fullscreen" 
                            onClick={toggleFullscreen}
                            style={{ 
                                background: 'transparent', border: 'none', color: '#94a3b8', 
                                cursor: 'pointer', display: 'flex', alignItems: 'center' 
                            }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                                {isFullscreen ? (
                                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                ) : (
                                    <path d="M15 3h6v6M9 21H3v-6M21 15v6h-6M3 9V3h6" />
                                )}
                            </svg>
                        </button>
                        <button className="btn-close" onClick={onClose}>✕</button>
                    </div>
                </div>
                
                <div className="modal-body" style={{ padding: 0, position: 'relative', height: '100%', overflow: 'hidden' }}>
                    <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />

                    {/* Optimized Layer & Year Controls */}
                    <div className="geomolg-control-bar">
                        {/* Region Buttons */}
                        <div className="geomolg-region-container">
                            <button
                                onClick={() => handleSwitchLayer('wb', selectedYear)}
                                className={`geomolg-region-btn ${currentRegion === 'wb' ? 'active' : ''}`}
                            >
                                الضفة الغربية
                            </button>
                            <button
                                onClick={() => handleSwitchLayer('gaza', selectedYear)}
                                className={`geomolg-region-btn ${currentRegion === 'gaza' ? 'active' : ''}`}
                            >
                                قطاع غزة
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="geomolg-divider"></div>

                        {/* Year Selector */}
                        <div className="geomolg-year-container">
                            <span className="geomolg-year-label">سنة التصوير:</span>
                            <select
                                value={selectedYear}
                                onChange={(e) => handleSwitchLayer(currentRegion, e.target.value)}
                                className="geomolg-year-select"
                            >
                                {Object.keys(ORTHOPHOTO_SERVICES[currentRegion]).map(year => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Minimal Attribution */}
                    <div style={{
                        position: 'absolute', bottom: '20px', left: '15px',
                        background: 'rgba(15, 23, 42, 0.7)', padding: '6px 12px',
                        borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)',
                        zIndex: 100, fontSize: '0.75rem', fontWeight: '700', color: 'rgba(251, 171, 21, 0.8)',
                        backdropFilter: 'blur(10px)'
                    }}>
                        Geomolg Orthophoto {selectedYear}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeomolgViewer;
