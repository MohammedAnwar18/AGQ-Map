import React, { useState, useMemo } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';

const LAYERS_DATA = [
    { id: 1, name: "حدود البلديات والمحافظات", category: "حدود إدارية", format: "SHP / GeoJSON", size: "4.2 MB" },
    { id: 2, name: "شبكة الطرق والشوارع الرئيسية", category: "نقل ومواصلات", format: "KML / GeoJSON", size: "12.8 MB" },
    { id: 3, name: "مخطط الغطاء النباتي والاستخدام الزراعي", category: "بيئة طبيعية", format: "Raster TIFF", size: "45.0 MB" },
    { id: 4, name: "نموذج الارتفاعات الرقمي (DEM)", category: "تضاريس", format: "GeoTIFF", size: "88.5 MB" },
    { id: 5, name: "طبقة المباني والمنشآت السكنية ثلاثية الأبعاد", category: "بنية تحتية", format: "3D Tiles / OBJ", size: "154.2 MB" },
    { id: 6, name: "توزيع مصادر المياه والآبار الجوفية", category: "هيدرولوجيا", format: "SHP / CSV", size: "2.1 MB" },
];

const PalNovaaRepository = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedIds, setDownloadedIds] = useState([]);

    const filteredLayers = useMemo(() => {
        if (!searchQuery.trim()) return LAYERS_DATA;
        const query = searchQuery.toLowerCase();
        return LAYERS_DATA.filter(layer => 
            layer.name.toLowerCase().includes(query) ||
            layer.category.toLowerCase().includes(query) ||
            layer.format.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const handleDownload = (layerId, layerName) => {
        if (downloadingId !== null) return;
        
        setDownloadingId(layerId);
        setDownloadProgress(0);

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setDownloadingId(null);
                        setDownloadedIds(prevIds => [...prevIds, layerId]);
                    }, 400);
                    return 100;
                }
                return prev + 10;
            });
        }, 120);
    };

    return (
        <div className="repository-overlay-container">
            {/* Close Button */}
            <button className="repository-close-btn" onClick={onClose} title="إغلاق">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            {/* Background shader */}
            <div className="repository-shader-bg">
                <Warp
                    style={{ height: "100%", width: "100%" }}
                    proportion={isFocused ? 0.55 : 0.45}
                    softness={1}
                    distortion={isFocused ? 0.4 : 0.25}
                    swirl={isFocused ? 1.3 : 0.8}
                    swirlIterations={10}
                    shape="checks"
                    shapeScale={0.1}
                    scale={1}
                    rotation={0}
                    speed={isFocused ? 2.5 : 1}
                    colors={
                        isFocused 
                        ? ["hsl(217, 54%, 11%)", "hsl(38, 98%, 58%)", "hsl(213, 44%, 18%)", "hsl(194, 98%, 60%)"]
                        : ["hsl(217, 54%, 11%)", "hsl(38, 90%, 55%)", "hsl(213, 44%, 18%)", "hsl(194, 96%, 49%)"]
                    }
                />
            </div>
            
            {/* Glowing organic blobs that flash and pulse on focus */}
            <div className={`repository-glow-dot dot-1 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-2 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-3 ${isFocused ? 'active' : ''}`}></div>
            
            {/* Vignette Overlay */}
            <div className="repository-shader-overlay"></div>

            {/* Centered Glass Card */}
            <div className="repository-content-card">
                <span className="repository-tag">ميزة جديدة قادمة</span>
                
                <h1 className="repository-title">مستودع بالنوفا</h1>
                <div className="repository-subtitle">PalNovaa Repository</div>
                
                <p className="repository-description">
                    نعمل حالياً على تطوير مستودع بالنوفا الرقمي المخصص لمشاركة وتحميل الطبقات الجغرافية.
                </p>

                <div className="repository-search-container">
                    <div className="repository-input-wrapper">
                        <input
                            type="text"
                            placeholder="بحث عن البيانات..."
                            className={`repository-search-input ${isFocused ? 'focused' : ''}`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                        />
                        <button className="repository-search-btn" title="بحث">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </button>
                    </div>

                    {/* Geographic Layers List */}
                    <div className="repository-layers-list">
                        {filteredLayers.length > 0 ? (
                            filteredLayers.map(layer => (
                                <div key={layer.id} className="repository-layer-item">
                                    <div className="layer-info">
                                        <div className="layer-name">{layer.name}</div>
                                        <div className="layer-meta">
                                            <span className="layer-category">{layer.category}</span>
                                            <span className="layer-divider">•</span>
                                            <span className="layer-format">{layer.format}</span>
                                            <span className="layer-divider">•</span>
                                            <span className="layer-size">{layer.size}</span>
                                        </div>
                                    </div>
                                    <button 
                                        className={`layer-download-btn ${downloadingId === layer.id ? 'downloading' : ''} ${downloadedIds.includes(layer.id) ? 'downloaded' : ''}`}
                                        onClick={() => handleDownload(layer.id, layer.name)}
                                        disabled={downloadingId !== null}
                                    >
                                        {downloadingId === layer.id ? (
                                            <div className="download-progress-container">
                                                <span className="download-progress-text">{downloadProgress}%</span>
                                                <div className="download-progress-bar" style={{ width: `${downloadProgress}%` }}></div>
                                            </div>
                                        ) : downloadedIds.includes(layer.id) ? (
                                            <div className="btn-content-wrapper">
                                                <svg className="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                                <span>تم التحميل</span>
                                            </div>
                                        ) : (
                                            <div className="btn-content-wrapper">
                                                <svg className="btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                </svg>
                                                <span>تحميل</span>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="no-results">
                                لا توجد طبقات تطابق بحثك. جرب البحث عن "طرق"، "حدود" أو "بيئة".
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PalNovaaRepository;
