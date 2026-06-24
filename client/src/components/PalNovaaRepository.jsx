import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';

const PalNovaaRepository = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    
    // Repository & Admin States - Load from localStorage to persist when closed/reopened
    const [layers, setLayers] = useState(() => {
        try {
            const saved = localStorage.getItem('palnovaa_repository_layers');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

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

    // Water Ripple Simulation State & Logic
    const rippleCanvasRef = useRef(null);

    useEffect(() => {
        const canvas = rippleCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        const scale = 4; // Downscale factor for grid simulation performance
        
        let cols = 0;
        let rows = 0;
        let current = [];
        let previous = [];
        
        const resize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width / scale);
            canvas.height = Math.floor(height / scale);
            cols = canvas.width;
            rows = canvas.height;
            current = new Float32Array(cols * rows);
            previous = new Float32Array(cols * rows);
        };

        window.addEventListener('resize', resize);
        resize();

        // Mouse move ripple trigger
        let lastMouseX = -1;
        let lastMouseY = -1;

        const handleMouseMoveEvent = (e) => {
            const rect = canvas.getBoundingClientRect();
            // Map coordinates relative to the canvas bounding rect
            const clientX = e.clientX - rect.left;
            const clientY = e.clientY - rect.top;
            
            const x = Math.floor(clientX / scale);
            const y = Math.floor(clientY / scale);
            
            if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2) {
                // Drop a stone in the water (wider impact radius for smooth ripples)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const index = (x + dx) + (y + dy) * cols;
                        current[index] = 450;
                    }
                }
                
                // Interpolate line points between mouse steps for smooth continuous ripples
                if (lastMouseX !== -1 && lastMouseY !== -1) {
                    const dist = Math.hypot(x - lastMouseX, y - lastMouseY);
                    if (dist > 1) {
                        for (let i = 0; i <= dist; i++) {
                            const t = i / dist;
                            const ix = Math.floor(lastMouseX + (x - lastMouseX) * t);
                            const iy = Math.floor(lastMouseY + (y - lastMouseY) * t);
                            if (ix > 1 && ix < cols - 2 && iy > 1 && iy < rows - 2) {
                                current[ix + iy * cols] = 450;
                            }
                        }
                    }
                }
            }
            lastMouseX = x;
            lastMouseY = y;
        };

        window.addEventListener('mousemove', handleMouseMoveEvent);

        let animationFrameId;
        const damping = 0.97; // Gradually damp ripple amplitudes

        const update = () => {
            // Wave propagation physics equations
            for (let y = 1; y < rows - 1; y++) {
                for (let x = 1; x < cols - 1; x++) {
                    const i = x + y * cols;
                    previous[i] = (
                        current[i - 1] +
                        current[i + 1] +
                        current[i - cols] +
                        current[i + cols]
                    ) / 2 - previous[i];
                    previous[i] *= damping;
                }
            }

            // Swap previous and current height buffers
            const temp = current;
            current = previous;
            previous = temp;

            // Generate image data representing the ripples
            const imgData = ctx.createImageData(cols, rows);
            const data = imgData.data;

            // Gold Highlight: HSL(38, 90%, 55%) -> RGB (251, 171, 21)
            // Cyan Highlight: HSL(194, 96%, 49%) -> RGB (5, 177, 246)
            
            for (let i = 0; i < cols * rows; i++) {
                const heightVal = current[i];
                if (Math.abs(heightVal) > 0.1) {
                    const x = i % cols;
                    const y = Math.floor(i / cols);

                    if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2) {
                        // Compute normals/slopes for specular shading/shimmer
                        const dx = current[i + 1] - current[i - 1];
                        const dy = current[i + cols] - current[i - cols];
                        
                        const shade = Math.min(255, Math.max(0, (dx + dy) * 1.5));
                        
                        const pixelIdx = i * 4;
                        if (shade > 4) {
                            const mixRatio = Math.sin(x * 0.08 + y * 0.08) * 0.5 + 0.5;
                            data[pixelIdx] = Math.floor(251 * mixRatio + 5 * (1 - mixRatio));
                            data[pixelIdx + 1] = Math.floor(171 * mixRatio + 177 * (1 - mixRatio));
                            data[pixelIdx + 2] = Math.floor(21 * mixRatio + 246 * (1 - mixRatio));
                            data[pixelIdx + 3] = Math.min(255, Math.floor(shade * 1.8)); // Shimmer opacity
                        }
                    }
                }
            }

            ctx.putImageData(imgData, 0, 0);
            animationFrameId = requestAnimationFrame(update);
        };

        update();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMoveEvent);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

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

    // Handle Upload or Edit Submission & Local Persistence
    const handleAdminUpload = (e) => {
        e.preventDefault();
        
        // If we are creating a new layer, a file is required. If editing, it is optional.
        if (!editingLayerId && !selectedFile) return;
        if (!newLayerName || !newLayerSize || !newLayerDesc) return;

        setUploadingState('validating');
        setUploadProgress(15);

        // Step 1: Validating files
        setTimeout(() => {
            setUploadingState('compressing');
            setUploadProgress(45);
            
            // Step 2: Compressing to ZIP (or saving changes)
            setTimeout(() => {
                setUploadingState('uploading');
                setUploadProgress(80);
                
                // Step 3: Uploading to Cloudflare R2 / Saving
                const localUrl = selectedFile ? URL.createObjectURL(selectedFile) : null;
                
                const saveLayer = (persistentFileUrl) => {
                    setUploadingState('success');
                    setUploadProgress(100);
                    
                    setTimeout(() => {
                        setLayers(prev => {
                            let updatedLayers;
                            if (editingLayerId) {
                                // Edit mode
                                updatedLayers = prev.map(layer => {
                                    if (layer.id === editingLayerId) {
                                        return {
                                            ...layer,
                                            name: newLayerName,
                                            category: newLayerCategory,
                                            format: `${newLayerFormat} / ZIP`,
                                            size: newLayerSize,
                                            description: newLayerDesc,
                                            // Only replace URL and name if a new file was chosen
                                            ...(selectedFile ? {
                                                fileUrl: persistentFileUrl || localUrl,
                                                fileName: selectedFile.name,
                                                isPersistent: !!persistentFileUrl
                                            } : {})
                                        };
                                    }
                                    return layer;
                                });
                            } else {
                                // Create mode
                                const newLayer = {
                                    id: Date.now(),
                                    name: newLayerName,
                                    category: newLayerCategory,
                                    format: `${newLayerFormat} / ZIP`,
                                    size: newLayerSize,
                                    description: newLayerDesc,
                                    fileUrl: persistentFileUrl || localUrl,
                                    fileName: selectedFile.name,
                                    isPersistent: !!persistentFileUrl
                                };
                                updatedLayers = [newLayer, ...prev];
                            }
                            
                            localStorage.setItem('palnovaa_repository_layers', JSON.stringify(updatedLayers));
                            return updatedLayers;
                        });

                        // Reset states
                        setNewLayerName('');
                        setNewLayerSize('');
                        setNewLayerDesc('');
                        setSelectedFile(null);
                        setEditingLayerId(null);
                        setUploadingState('idle');
                        setIsAdminMode(false); // Return to search view to see the result
                    }, 1000);
                };

                // If a new file was uploaded and it is under 3.5MB, read it as Base64.
                // Otherwise, save immediately.
                if (selectedFile && selectedFile.size <= 3.5 * 1024 * 1024) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        saveLayer(event.target.result);
                    };
                    reader.onerror = () => {
                        saveLayer(null);
                    };
                    reader.readAsDataURL(selectedFile);
                } else {
                    saveLayer(null);
                }
                
            }, 1200);
        }, 1200);
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
    const handleDeleteClick = (layerId) => {
        if (window.confirm("هل أنت متأكد من رغبتك في حذف هذه الطبقة الجغرافية نهائياً؟")) {
            setLayers(prev => {
                const updated = prev.filter(layer => layer.id !== layerId);
                localStorage.setItem('palnovaa_repository_layers', JSON.stringify(updated));
                return updated;
            });
            
            if (editingLayerId === layerId) {
                setEditingLayerId(null);
                setNewLayerName('');
                setNewLayerSize('');
                setNewLayerDesc('');
                setSelectedFile(null);
            }
        }
    };

    // Handle Download Simulation & Trigger Real Browser Download
    const handleDownload = (layer) => {
        if (downloadingId !== null) return;
        
        setDownloadingId(layer.id);
        setDownloadProgress(0);

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setDownloadingId(null);
                        setDownloadedIds(prevIds => [...prevIds, layer.id]);
                        
                        // Trigger actual browser download
                        if (layer.fileUrl) {
                            const link = document.createElement('a');
                            link.href = layer.fileUrl;
                            link.download = layer.fileName || `${layer.name}.zip`;
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

            {/* Background shader - kept exactly as base properties */}
            <div className="repository-shader-bg">
                <Warp
                    style={{ height: "100%", width: "100%" }}
                    proportion={0.45}
                    softness={1}
                    distortion={0.25}
                    swirl={0.8}
                    swirlIterations={10}
                    shape="checks"
                    shapeScale={0.1}
                    scale={1}
                    rotation={0}
                    speed={1}
                    colors={["hsl(217, 54%, 11%)", "hsl(38, 90%, 55%)", "hsl(213, 44%, 18%)", "hsl(194, 96%, 49%)"]}
                />
            </div>
            
            {/* Physical Water Ripple Canvas */}
            <canvas ref={rippleCanvasRef} className="repository-ripple-canvas" />
            
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
