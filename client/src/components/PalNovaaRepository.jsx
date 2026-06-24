import React, { useState, useMemo } from 'react';
import { Warp } from "@paper-design/shaders-react";
import './PalNovaaRepository.css';

const PalNovaaRepository = ({ onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    
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

    // Download States
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedIds, setDownloadedIds] = useState([]);

    const handleMouseMove = (e) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

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

    // Handle Upload Simulation & Local Persistence
    const handleAdminUpload = (e) => {
        e.preventDefault();
        if (!selectedFile || !newLayerName || !newLayerSize || !newLayerDesc) return;

        setUploadingState('validating');
        setUploadProgress(15);

        // Step 1: Validating files
        setTimeout(() => {
            setUploadingState('compressing');
            setUploadProgress(45);
            
            // Step 2: Compressing to ZIP
            setTimeout(() => {
                setUploadingState('uploading');
                setUploadProgress(80);
                
                // Step 3: Uploading to Cloudflare R2
                const localUrl = URL.createObjectURL(selectedFile);
                
                const saveLayer = (persistentFileUrl) => {
                    const newLayer = {
                        id: Date.now(),
                        name: newLayerName,
                        category: newLayerCategory,
                        format: `${newLayerFormat} / ZIP`,
                        size: newLayerSize,
                        description: newLayerDesc,
                        fileUrl: persistentFileUrl || localUrl, // Use base64 if <= 3.5MB, otherwise temporary blob URL
                        fileName: selectedFile.name,
                        isPersistent: !!persistentFileUrl
                    };
                    
                    setUploadingState('success');
                    setUploadProgress(100);
                    
                    setTimeout(() => {
                        setLayers(prev => {
                            const updatedLayers = [newLayer, ...prev];
                            localStorage.setItem('palnovaa_repository_layers', JSON.stringify(updatedLayers));
                            return updatedLayers;
                        });
                        setNewLayerName('');
                        setNewLayerSize('');
                        setNewLayerDesc('');
                        setSelectedFile(null);
                        setUploadingState('idle');
                        setIsAdminMode(false); // Return to search view to see the result
                    }, 1000);
                };

                // If file is under 3.5MB, read it as Base64 so it survives page refreshes in localStorage
                if (selectedFile.size <= 3.5 * 1024 * 1024) {
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
        <div 
            className="repository-overlay-container"
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
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
            
            {/* Mouse Follower Glow Light */}
            <div 
                className="repository-mouse-follower"
                style={{
                    transform: `translate3d(${mousePos.x - 250}px, ${mousePos.y - 250}px, 0)`,
                    opacity: isHovering ? 1 : 0
                }}
            />
            
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
                            <h2 className="admin-section-title">إضافة طبقة جغرافية جديدة</h2>
                            
                            {/* File Upload Selector */}
                            <div className="form-group file-upload-group" style={{ marginBottom: '10px' }}>
                                <label>اختر الملف الجغرافي للرفع (ZIP, SHP, KML, GeoJSON, TIFF...)</label>
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
                                        required
                                        disabled={uploadingState !== 'idle'}
                                    />
                                    <label htmlFor="layer-file" className="file-upload-label">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M21.2 15v3.8a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        <span>{selectedFile ? `الملف المحدد: ${selectedFile.name}` : "اختر ملفاً من جهازك للبدء..."}</span>
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
                                        {uploadingState === 'validating' && "⏳ جاري التحقق من سلامة صيغ الملفات..."}
                                        {uploadingState === 'compressing' && "📦 جاري ضغط الملفات إلى أرشيف ZIP..."}
                                        {uploadingState === 'uploading' && "🚀 جاري رفع الأرشيف المضغوط إلى Cloudflare R2..."}
                                        {uploadingState === 'success' && "✅ تمت العملية بنجاح! تم حفظ الطبقة."}
                                    </div>
                                    <div className="admin-progress-track">
                                        <div className="admin-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                    <div className="progress-percentage">{uploadProgress}%</div>
                                </div>
                            ) : (
                                <button type="submit" className="admin-submit-btn">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.2 15v3.8a2 2 0 0 1-2 2H4.8a2 2 0 0 1-2-2V15"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                    <span>ضغط ورفع الملف للمستودع</span>
                                </button>
                            )}
                        </form>

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
