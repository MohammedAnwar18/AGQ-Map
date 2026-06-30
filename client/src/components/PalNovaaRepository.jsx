import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';
import api from '../services/api';

const PalNovaaRepository = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    
    // Repository & Admin States - Load from backend database
    const [layers, setLayers] = useState([]);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Fetch layers from backend on mount
    useEffect(() => {
        const fetchLayers = async () => {
            try {
                const response = await api.get('/storage/layers');
                setLayers(response.data);
            } catch (error) {
                console.error('Error fetching repository layers:', error);
            }
        };
        fetchLayers();
    }, []);

    // Admin Upload Form State
    const [selectedFile, setSelectedFile] = useState(null);
    const [newLayerName, setNewLayerName] = useState('');
    const [newLayerCategory, setNewLayerCategory] = useState('حدود إدارية');
    const [newLayerFormat, setNewLayerFormat] = useState('SHP');
    const [newLayerSize, setNewLayerSize] = useState('');
    const [newLayerDesc, setNewLayerDesc] = useState('');
    const [uploadingState, setUploadingState] = useState('idle'); // idle, validating, compressing, uploading, success
    const [uploadProgress, setUploadProgress] = useState(0);
    const [editingLayerId, setEditingLayerId] = useState(null);

    // Download States
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedIds, setDownloadedIds] = useState([]);

    // Dynamic Warp shader interactive distortion and swirl
    const [distortion, setDistortion] = useState(0.25);
    const [swirl, setSwirl] = useState(0.8);

    // Mouse targets for smooth Ebru-style marbling drift (oil-on-water simulation)
    const targetX = useRef(0);
    const targetY = useRef(0);
    const smoothX = useRef(0);
    const smoothY = useRef(0);

    // Run animation physics loop to update smooth marbling drift
    useEffect(() => {
        let active = true;

        const updatePhysics = () => {
            if (!active) return;

            // Soft ease-out (lerp) toward mouse targets for an elegant Ebru effect
            smoothX.current += (targetX.current - smoothX.current) * 0.035;
            smoothY.current += (targetY.current - smoothY.current) * 0.035;

            // Rests at base values (distortion: 0.25, swirl: 0.8)
            const dynamicDist = 0.25 + smoothX.current * 0.12;
            const dynamicSwirl = 0.8 + smoothY.current * 0.35;

            // Slowly decay the target offset back to center (0) so it drifts back when idle
            targetX.current *= 0.98;
            targetY.current *= 0.98;

            setDistortion(dynamicDist);
            setSwirl(dynamicSwirl);

            requestAnimationFrame(updatePhysics);
        };

        updatePhysics();
        
        // Listen to mouse movement and convert to soft directional offset coordinates
        const handleMouseMoveEvent = (e) => {
            const dx = (e.clientX / window.innerWidth) - 0.5;
            const dy = (e.clientY / window.innerHeight) - 0.5;
            
            // Set targets (dx/dy are in range [-0.5, 0.5])
            targetX.current = dx;
            targetY.current = dy;
        };

        window.addEventListener('mousemove', handleMouseMoveEvent);

        return () => {
            active = false;
            window.removeEventListener('mousemove', handleMouseMoveEvent);
        };
    }, []);

    // Pulse the wave targets softly when typing to create gentle Ebru marbling drifts
    useEffect(() => {
        if (searchQuery) {
            targetX.current += (Math.random() - 0.5) * 0.25;
            targetY.current += (Math.random() - 0.5) * 0.25;
            
            // Clamp targets to stay within reasonable ranges [-1, 1]
            targetX.current = Math.max(-1, Math.min(1, targetX.current));
            targetY.current = Math.max(-1, Math.min(1, targetY.current));
        }
    }, [searchQuery]);

    // Interpolate original Warp colors to Sunrise theme based on query length
    const warpColors = useMemo(() => {
        const textLength = searchQuery.length;
        if (textLength === 0) {
            return ["hsl(217, 54%, 11%)", "hsl(38, 90%, 55%)", "hsl(213, 44%, 18%)", "hsl(194, 96%, 49%)"];
        }

        const ratio = Math.min(1, textLength / 15); // Fully morphed at 15 chars

        const interpolateHSL = (h1, s1, l1, h2, s2, l2, r) => {
            const h = Math.round(h1 + (h2 - h1) * r);
            const s = Math.round(s1 + (s2 - s1) * r);
            const l = Math.round(l1 + (l2 - l1) * r);
            return `hsl(${h}, ${s}%, ${l}%)`;
        };

        return [
            interpolateHSL(217, 54, 11, 260, 40, 8, ratio),   // Dark blue -> Deep indigo
            interpolateHSL(38, 90, 55, 20, 95, 55, ratio),     // Gold -> Sunrise orange/red
            interpolateHSL(213, 44, 18, 38, 95, 55, ratio),    // Deep navy -> Sunrise gold
            interpolateHSL(194, 96, 49, 340, 85, 45, ratio)    // Cyan -> Dawn vibrant pink
        ];
    }, [searchQuery]);

    // Autocomplete Suggestions
    const suggestions = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return layers.filter(layer => 
            layer.name.toLowerCase().startsWith(query) ||
            layer.name.toLowerCase().includes(query)
        );
    }, [searchQuery, layers]);

    // Filtered Results to Display
    const filteredLayers = useMemo(() => {
        if (!searchQuery.trim()) return layers;
        const query = searchQuery.toLowerCase();
        return layers.filter(layer => 
            layer.name.toLowerCase().includes(query) ||
            layer.category.toLowerCase().includes(query) ||
            layer.description.toLowerCase().includes(query) ||
            layer.format.toLowerCase().includes(query)
        );
    }, [searchQuery, layers]);

    // Handle Upload or Edit Submission & Server Persistence
    const handleAdminUpload = async (e) => {
        e.preventDefault();
        
        // If we are creating a new layer, a file is required. If editing, it is optional.
        if (!editingLayerId && !selectedFile) return;
        if (!newLayerName || !newLayerSize || !newLayerDesc) return;

        setUploadingState('validating');
        setUploadProgress(20);

        try {
            const formData = new FormData();
            formData.append('name', newLayerName);
            formData.append('category', newLayerCategory);
            formData.append('format', `${newLayerFormat} / ZIP`);
            formData.append('size', newLayerSize);
            formData.append('description', newLayerDesc);
            if (selectedFile) {
                formData.append('file', selectedFile);
            }

            setUploadingState('uploading');
            setUploadProgress(50);

            let response;
            if (editingLayerId) {
                // Edit mode
                response = await api.put(`/storage/layers/${editingLayerId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                // Create mode
                response = await api.post('/storage/layers', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setUploadProgress(90);

            if (response.data && response.data.success) {
                const savedLayer = response.data.layer;
                
                setLayers(prev => {
                    if (editingLayerId) {
                        return prev.map(layer => layer.id === editingLayerId ? savedLayer : layer);
                    } else {
                        return [savedLayer, ...prev];
                    }
                });

                setUploadingState('success');
                setUploadProgress(100);

                setTimeout(() => {
                    // Reset states
                    setNewLayerName('');
                    setNewLayerSize('');
                    setNewLayerDesc('');
                    setSelectedFile(null);
                    setEditingLayerId(null);
                    setUploadingState('idle');
                    setIsAdminMode(false); // Return to search view to see the result
                }, 1000);
            } else {
                throw new Error('Failed to save layer');
            }

        } catch (error) {
            console.error('Upload failed:', error);
            setUploadingState('idle');
            alert('حدث خطأ أثناء رفع الطبقة الجغرافية. يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.');
        }
    };

    // Populate form to edit layer
    const handleEditClick = (layer) => {
        setEditingLayerId(layer.id);
        setNewLayerName(layer.name);
        setNewLayerCategory(layer.category);
        const rawFormat = layer.format.split(' / ')[0]; // Extract base extension
        setNewLayerFormat(rawFormat);
        setNewLayerSize(layer.size);
        setNewLayerDesc(layer.description);
        setSelectedFile(null); // File upload is optional during edit
    };

    // Delete a layer
    const handleDeleteClick = async (layerId) => {
        if (window.confirm("هل أنت متأكد من رغبتك في حذف هذه الطبقة الجغرافية نهائياً؟")) {
            try {
                await api.delete(`/storage/layers/${layerId}`);
                setLayers(prev => prev.filter(layer => layer.id !== layerId));
                
                if (editingLayerId === layerId) {
                    setEditingLayerId(null);
                    setNewLayerName('');
                    setNewLayerSize('');
                    setNewLayerDesc('');
                    setSelectedFile(null);
                }
            } catch (error) {
                console.error('Delete failed:', error);
                alert('حدث خطأ أثناء حذف الطبقة الجغرافية.');
            }
        }
    };

    // Handle Download Simulation & Trigger Real Browser Download
    const handleDownload = (layer) => {
        if (downloadingId !== null) return;
        
        setDownloadingId(layer.id);
        setDownloadProgress(0);

        const fileUrl = layer.fileUrl || layer.file_url;
        const fileName = layer.fileName || layer.file_name;

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setDownloadingId(null);
                        setDownloadedIds(prevIds => [...prevIds, layer.id]);
                        
                        // Trigger actual browser download
                        if (fileUrl) {
                            const link = document.createElement('a');
                            link.href = fileUrl;
                            link.download = fileName || `${layer.name}.zip`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    }, 400);
                    return 100;
                }
                return prev + 10;
            });
        }, 100);
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

            {/* Background shader - dynamic wave & sunrise colors */}
            <div className="repository-shader-bg">
                <Warp
                    style={{ height: "100%", width: "100%" }}
                    proportion={0.45}
                    softness={1}
                    distortion={distortion}
                    swirl={swirl}
                    swirlIterations={10}
                    shape="checks"
                    shapeScale={0.1}
                    scale={1}
                    rotation={0}
                    speed={1}
                    colors={warpColors}
                />
            </div>
            
            {/* Glowing organic blobs that flash and pulse on focus with theme colors */}
            <div className={`repository-glow-dot dot-1 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-2 ${isFocused ? 'active' : ''}`}></div>
            <div className={`repository-glow-dot dot-3 ${isFocused ? 'active' : ''}`}></div>
            
            {/* Vignette Overlay */}
            <div className="repository-shader-overlay"></div>

            {/* Centered Glass Card */}
            <div className="repository-content-card">
                <div className="repository-header-actions">
                    <button 
                        className={`repository-admin-toggle ${isAdminMode ? 'active' : ''}`}
                        onClick={() => {
                            setIsAdminMode(!isAdminMode);
                            setUploadingState('idle');
                            setEditingLayerId(null);
                        }}
                        title={isAdminMode ? "العودة للمستودع" : "لوحة التحكم (أدمن)"}
                    >
                        {isAdminMode ? (
                            <>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                                <span>العودة للمستودع</span>
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                                <span>إدارة المستودع ⚙️</span>
                            </>
                        )}
                    </button>
                    <span className="repository-tag">ميزة جديدة قادمة</span>
                </div>
                
                <h1 className="repository-title">مستودع بالنوفا</h1>
                <div className="repository-subtitle">PalNovaa Repository</div>
                
                <p className="repository-description">
                    {isAdminMode 
                        ? "لوحة تحكم المشرف لإضافة وإدارة طبقات البيانات الجغرافية وضغطها ورفعها تلقائياً."
                        : "نعمل حالياً على تطوير مستودع بالنوفا الرقمي المخصص لمشاركة وتحميل الطبقات الجغرافية."
                    }
                </p>

                {!isAdminMode ? (
                    <div className="repository-search-container">
                        {/* Search Bar Input */}
                        <div className="repository-input-wrapper">
                            <input
                                type="text"
                                placeholder="بحث عن البيانات..."
                                className={`repository-search-input ${isFocused ? 'focused' : ''}`}
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => {
                                    setIsFocused(true);
                                    setShowSuggestions(true);
                                }}
                                onBlur={() => {
                                    setIsFocused(false);
                                    // slight timeout to allow clicking suggestions
                                    setTimeout(() => setShowSuggestions(false), 200);
                                }}
                            />
                            <button className="repository-search-btn" title="بحث">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>

                            {/* Autocomplete Dropdown Suggestions */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="repository-suggestions-dropdown">
                                    {suggestions.map(s => (
                                        <div 
                                            key={s.id} 
                                            className="repository-suggestion-item"
                                            onMouseDown={() => {
                                                setSearchQuery(s.name);
                                                setShowSuggestions(false);
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <circle cx="11" cy="11" r="8"></circle>
                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            </svg>
                                            <span>{s.name}</span>
                                            <span className="suggestion-category">{s.category}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search Results / Layers List */}
                        <div className="repository-results-layout">
                            {filteredLayers.length > 0 ? (
                                filteredLayers.map(layer => (
                                    <div key={layer.id} className="repository-result-card">
                                        <div className="result-card-header">
                                            <div className="result-card-format">
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                    <line x1="9" y1="15" x2="15" y2="15"></line>
                                                    <line x1="9" y1="19" x2="13" y2="19"></line>
                                                    <line x1="9" y1="11" x2="11" y2="11"></line>
                                                </svg>
                                                <span>{layer.format}</span>
                                            </div>
                                            <span className="result-card-size">{layer.size}</span>
                                        </div>
                                        <h3 className="result-card-title">{layer.name}</h3>
                                        <p className="result-card-desc">{layer.description}</p>
                                        <div className="result-card-footer">
                                            <span className="result-card-category">{layer.category}</span>
                                            <button 
                                                className={`result-download-btn ${downloadingId === layer.id ? 'downloading' : ''} ${downloadedIds.includes(layer.id) ? 'downloaded' : ''}`}
                                                onClick={() => handleDownload(layer)}
                                                disabled={downloadingId !== null}
                                            >
                                                {downloadingId === layer.id ? (
                                                    <div className="download-progress-bar-container">
                                                        <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
                                                        <span className="progress-text">جاري التحميل... {downloadProgress}%</span>
                                                    </div>
                                                ) : downloadedIds.includes(layer.id) ? (
                                                    <>
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12"></polyline>
                                                        </svg>
                                                        <span>تم التحميل</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                                        </svg>
                                                        <span>تحميل الملف</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-results-alert">
                                    {layers.length === 0 
                                        ? "لا توجد طبقات جغرافية مرفوعة حالياً. تفضل بالانتقال إلى لوحة المشرف لرفع أول ملف جغرافي."
                                        : "لا توجد طبقات جغرافية تطابق بحثك. جرب كتابة اسم آخر."
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Admin Control Panel View */
                    <div className="repository-admin-panel">
                        <form onSubmit={handleAdminUpload} className="repository-admin-form">
                            <h2 className="admin-section-title">
                                {editingLayerId ? "تعديل الطبقة الجغرافية" : "إضافة طبقة جغرافية جديدة"}
                            </h2>
                            
                            {/* File Upload Selector */}
                            <div className="form-group file-upload-group" style={{ marginBottom: '10px' }}>
                                <label>اختر الملف الجغرافي للرفع {editingLayerId ? "(اختياري لاستبدال الملف الحالي)" : "(مطلوب)"}</label>
                                <div className="custom-file-upload">
                                    <input 
                                        type="file" 
                                        id="layer-file"
                                        onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                setSelectedFile(file);
                                                setNewLayerName(file.name.substring(0, file.name.lastIndexOf('.')) || file.name);
                                                // Format size
                                                const sizeInMB = file.size / (1024 * 1024);
                                                const sizeStr = sizeInMB < 0.1 
                                                    ? `${(file.size / 1024).toFixed(1)} KB` 
                                                    : `${sizeInMB.toFixed(2)} MB`;
                                                setNewLayerSize(sizeStr);
                                                // Extract extension
                                                const ext = file.name.split('.').pop().toUpperCase();
                                                setNewLayerFormat(ext);
                                            }
                                        }}
                                        required={!editingLayerId}
                                        disabled={uploadingState !== 'idle'}
                                    />
                                    <label htmlFor="layer-file" className="file-upload-label">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M21.2 15v3.8a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        <span>{selectedFile ? `الملف المحدد: ${selectedFile.name}` : editingLayerId ? "انقر لاختيار ملف جديد (اختياري)..." : "اختر ملفاً من جهازك للبدء..."}</span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>اسم الطبقة الجغرافية</label>
                                    <input 
                                        type="text" 
                                        placeholder="مثال: شبكة أنابيب المياه والصرف"
                                        value={newLayerName}
                                        onChange={(e) => setNewLayerName(e.target.value)}
                                        required
                                        disabled={uploadingState !== 'idle'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>التصنيف</label>
                                    <select 
                                        value={newLayerCategory} 
                                        onChange={(e) => setNewLayerCategory(e.target.value)}
                                        disabled={uploadingState !== 'idle'}
                                    >
                                        <option value="حدود إدارية">حدود إدارية</option>
                                        <option value="نقل ومواصلات">نقل ومواصلات</option>
                                        <option value="بيئة طبيعية">بيئة طبيعية</option>
                                        <option value="تضاريس">تضاريس</option>
                                        <option value="بنية تحتية">بنية تحتية</option>
                                        <option value="هيدرولوجيا">هيدرولوجيا</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>صيغة البيانات</label>
                                    <input 
                                        type="text"
                                        placeholder="صيغة الملف"
                                        value={newLayerFormat}
                                        onChange={(e) => setNewLayerFormat(e.target.value)}
                                        required
                                        disabled={uploadingState !== 'idle'}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>حجم الملف</label>
                                    <input 
                                        type="text" 
                                        placeholder="مثال: 5.4 MB"
                                        value={newLayerSize}
                                        onChange={(e) => setNewLayerSize(e.target.value)}
                                        required
                                        disabled={uploadingState !== 'idle'}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>وصف الطبقة ومحتواها الجغرافي</label>
                                <textarea 
                                    placeholder="اكتب وصفاً تفصيلياً للطبقة الجغرافية ونظام الإسقاط المستخدم..."
                                    rows="2"
                                    value={newLayerDesc}
                                    onChange={(e) => setNewLayerDesc(e.target.value)}
                                    required
                                    disabled={uploadingState !== 'idle'}
                                ></textarea>
                            </div>

                            {uploadingState !== 'idle' ? (
                                <div className="admin-upload-progress-wrapper">
                                    <div className="progress-status-text">
                                        {uploadingState === 'validating' && "⏳ جاري التحقق من سلامة البيانات..."}
                                        {uploadingState === 'compressing' && (editingLayerId ? "📦 جاري معالجة وحفظ التغييرات..." : "📦 جاري ضغط الملفات إلى أرشيف ZIP...")}
                                        {uploadingState === 'uploading' && (editingLayerId ? "🚀 جاري مزامنة الملف مع R2..." : "🚀 جاري رفع الأرشيف المضغوط إلى Cloudflare R2...")}
                                        {uploadingState === 'success' && "✅ تمت العملية بنجاح! تم حفظ التعديلات."}
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                    <div className="progress-percentage">{uploadProgress}%</div>
                                </div>
                            ) : (
                                <div className="admin-form-buttons">
                                    <button type="submit" className="admin-submit-btn" style={{ flexGrow: 1 }}>
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                            <polyline points="7 3 7 8 15 8"></polyline>
                                        </svg>
                                        <span>{editingLayerId ? "حفظ التعديلات" : "ضغط ورفع الملف للمستودع"}</span>
                                    </button>
                                    
                                    {editingLayerId && (
                                        <button 
                                            type="button" 
                                            className="admin-cancel-edit-btn"
                                            onClick={() => {
                                                setEditingLayerId(null);
                                                setNewLayerName('');
                                                setNewLayerSize('');
                                                setNewLayerDesc('');
                                                setSelectedFile(null);
                                            }}
                                        >
                                            إلغاء التعديل
                                        </button>
                                    )}
                                </div>
                            )}
                        </form>

                        {/* Admin Managed Layers Grid List */}
                        <div className="repository-admin-layers-list">
                            <h3 className="admin-section-title">إدارة الطبقات المرفوعة ({layers.length})</h3>
                            {layers.length > 0 ? (
                                <div className="admin-layers-grid">
                                    {layers.map(layer => (
                                        <div key={layer.id} className="admin-layer-item">
                                            <div className="admin-layer-info">
                                                <span className="admin-layer-name">{layer.name}</span>
                                                <span className="admin-layer-meta">
                                                    <span className="layer-category-badge">{layer.category}</span>
                                                    <span>•</span>
                                                    <span>{layer.size}</span>
                                                </span>
                                            </div>
                                            <div className="admin-layer-actions">
                                                <button 
                                                    type="button"
                                                    className="admin-action-btn edit" 
                                                    onClick={() => handleEditClick(layer)} 
                                                    title="تعديل"
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </button>
                                                <button 
                                                    type="button"
                                                    className="admin-action-btn delete" 
                                                    onClick={() => handleDeleteClick(layer.id)} 
                                                    title="حذف"
                                                >
                                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="no-results-alert" style={{ background: 'rgba(255,255,255,0.01)', padding: '20px' }}>
                                    لا توجد طبقات جغرافية مرفوعة حالياً للتحكم بها.
                                </div>
                            )}
                        </div>

                        {/* R2 Recommendation Panel */}
                        <div className="repository-r2-recommendation">
                            <div className="r2-recommendation-header">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fbab15" strokeWidth="2.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                                </svg>
                                <h3>💡 توصية التخزين: Cloudflare R2 Storage</h3>
                            </div>
                            <p>
                                نوصي بشدة برفع الملفات الجغرافية المضغوطة على **Cloudflare R2** بدلاً من AWS S3 لسبب رئيسي وهو **عدم وجود رسوم نقل البيانات (Zero Egress Fees)**. ملفات الـ GIS تكون كبيرة الحجم، والتحميل المتكرر سيكلف مبالغ باهظة في S3 بينما في R2 هو مجاني تماماً ومتوافق مع نفس حزمة `@aws-sdk/client-s3`.
                            </p>
                            <div className="r2-code-title">نموذج الإعداد بالخلفية (NodeJS Backend configuration):</div>
                            <pre className="r2-code-block">
{`const { S3Client } = require("@aws-sdk/client-s3");

const r2Client = new S3Client({
  region: "auto",
  endpoint: \`https://\${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});`}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PalNovaaRepository;
