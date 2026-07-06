import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getImageUrl } from '../services/api';
import './GraduationEvent.css';

// Configure Axios specifically for events API
const API_URL = import.meta.env.VITE_API_URL || '/api';

const GraduationEvent = () => {
    // Envelope states
    const [isOpen, setIsOpen] = useState(false);
    const [envelopeRemoved, setEnvelopeRemoved] = useState(false);

    // Photos state
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Guest identity state
    const [guestName, setGuestName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');

    // Image capture and upload states
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);

    // Image Zoom modal
    const [zoomPhoto, setZoomPhoto] = useState(null);

    const cameraInputRef = useRef(null);

    // 1. Initialize anonymous Guest User and Load Photos
    useEffect(() => {
        // Handle anonymous Guest Name
        let storedName = localStorage.getItem('enas_grad_guest_name');
        if (!storedName) {
            const randomId = Math.floor(100 + Math.random() * 900);
            storedName = `ضيف بالنوفا ${randomId}`;
            localStorage.setItem('enas_grad_guest_name', storedName);
        }
        setGuestName(storedName);
        setTempName(storedName);

        fetchPhotos();
    }, []);

    const fetchPhotos = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/events/photos/enas-graduation`);
            if (response.data && response.data.success) {
                // Apply a deterministic/stable random rotation to each photo for album scatter effect
                const photosWithRotation = response.data.photos.map((p, index) => {
                    const rotations = [-3, -2, -1, 1, 2, 3];
                    const rot = rotations[index % rotations.length];
                    return { ...p, rotation: `${rot}deg` };
                });
                setPhotos(photosWithRotation);
            }
        } catch (err) {
            console.error('Failed to load event photos:', err);
        } finally {
            setLoading(false);
        }
    };

    // 2. Handle Envelope Open with Gatefold Animation
    const handleOpenEnvelope = () => {
        if (isOpen) return;
        setIsOpen(true);
        // Remove envelope from DOM after split transition finishes (1.2s)
        setTimeout(() => {
            setEnvelopeRemoved(true);
        }, 1200);
    };

    // 3. Update Guest Name
    const handleSaveName = () => {
        if (tempName.trim()) {
            setGuestName(tempName.trim());
            localStorage.setItem('enas_grad_guest_name', tempName.trim());
            setIsEditingName(false);
        }
    };

    // 4. Capture photo from Camera input
    const handleCaptureTrigger = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    const handlePhotoCaptured = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // 5. Upload Photo to Backend Event Album
    const handleUploadPhoto = async () => {
        if (!selectedImage) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', selectedImage);
            formData.append('eventSlug', 'enas-graduation');
            formData.append('uploader', guestName);
            formData.append('caption', caption);

            const res = await axios.post(`${API_URL}/events/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data && res.data.success) {
                // Clear fields
                setSelectedImage(null);
                setImagePreview(null);
                setCaption('');
                // Refresh album photos
                fetchPhotos();
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert('❌ فشل رفع الصورة، يرجى المحاولة مجدداً.');
        } finally {
            setUploading(false);
        }
    };

    // Format Relative Time in Arabic
    const formatTimeArabic = (dateStr) => {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return `منذ سنة`;
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return `منذ ${interval} شهر`;
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return `منذ ${interval} يوم`;
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return `منذ ${interval} ساعة`;
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return `منذ ${interval} دقيقة`;
        
        return seconds < 10 ? 'الآن' : `منذ ثوانٍ`;
    };

    return (
        <div className={`grad-event-page ${isOpen ? 'revealed' : ''}`}>
            
            {/* 1. FULLSCREEN GATEFOLD ENVELOPE */}
            {!envelopeRemoved && (
                <div 
                    className={`gatefold-envelope-overlay ${isOpen ? 'open-envelope' : ''}`}
                    onClick={handleOpenEnvelope}
                >
                    {/* Left Screen Half */}
                    <div className="envelope-half envelope-half-left">
                        <div className="envelope-cover-title">Enas's</div>
                    </div>

                    {/* Right Screen Half */}
                    <div className="envelope-half envelope-half-right">
                        <div className="envelope-cover-title">Graduation</div>
                    </div>

                    {/* Central Gold Rose Wax Seal */}
                    <div className="rose-wax-seal-container">
                        <div 
                            className="rose-wax-seal"
                            style={{ backgroundImage: 'url("/images/rose-seal.png")' }}
                        ></div>
                        <span className="rose-wax-seal-text">انقر لفتح الدعوة 🌹</span>
                    </div>
                </div>
            )}

            {/* 2. THE MAIN PORTAL CONTENT */}
            <div className="grad-portal-container">
                {/* Event header congratulations card */}
                <div className="grad-header-card">
                    <span className="grad-badge">🎓✨</span>
                    <h1 className="grad-title">Enas's Graduation</h1>
                    <p className="grad-subtitle">
                        أهلاً بكم في المساحة التفاعلية المشتركة لحفل تخرج إيناس. 
                        التقطوا أسعد اللحظات وشاركوها معنا مباشرة لتنضم إلى ألبوم الخريجين التذكاري!
                    </p>
                </div>

                {/* Anonymous guest nickname settings */}
                <div className="guest-session-card">
                    <div className="guest-session-info">
                        <span>👤 اسمك المسجل لمشاركة الصور:</span>
                        {isEditingName ? (
                            <input 
                                type="text"
                                className="guest-session-input"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                maxLength={25}
                            />
                        ) : (
                            <strong style={{ color: '#ffd700', fontSize: '1.1rem' }}>{guestName}</strong>
                        )}
                    </div>
                    <div>
                        {isEditingName ? (
                            <button className="guest-session-save-btn" onClick={handleSaveName}>حفظ الاسم ✅</button>
                        ) : (
                            <button 
                                className="guest-session-save-btn" 
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }} 
                                onClick={() => setIsEditingName(true)}
                            >
                                ✏️ تعديل الاسم
                            </button>
                        )}
                    </div>
                </div>

                {/* Shared Album Section */}
                <div className="album-section">
                    <h3 className="album-section-title">
                        <span>📸</span> ألبوم الصور التذكاري ({photos.length} صورة)
                    </h3>

                    {loading && photos.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                            <div className="letter-spinner"></div>
                        </div>
                    ) : photos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', opacity: 0.5 }}>
                            <p>لا توجد صور بعد. كن أول من يصور ويشارك فرحته!</p>
                        </div>
                    ) : (
                        <div className="photo-grid">
                            {photos.map((photo) => (
                                <div 
                                    key={photo.id} 
                                    className="polaroid-card"
                                    style={{ '--rotation': photo.rotation }}
                                    onClick={() => setZoomPhoto(photo.image_url)}
                                >
                                    <div className="polaroid-image-container">
                                        <img 
                                            src={getImageUrl(photo.image_url)} 
                                            alt="Event Memory" 
                                            className="polaroid-image"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="polaroid-info">
                                        <div className="polaroid-uploader">{photo.uploader}</div>
                                        <div className="polaroid-time">{formatTimeArabic(photo.created_at)}</div>
                                        {photo.caption && <div className="polaroid-caption" title={photo.caption}>{photo.caption}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. CAPTURE / UPLOAD ACTION BAR */}
            <div className="floating-camera-bar">
                <button className="camera-action-btn" onClick={handleCaptureTrigger}>
                    <span>📸</span> التقط صورة وشاركها
                </button>
                {/* Native camera file picker - opens camera instantly on mobile */}
                <input 
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    ref={cameraInputRef}
                    onChange={handlePhotoCaptured}
                />
            </div>

            {/* 4. PHOTO PREVIEW / UPLOAD MODAL */}
            {imagePreview && (
                <div className="preview-modal-overlay">
                    <div className="preview-modal-card">
                        <h3 style={{ margin: '0 0 15px 0', color: '#ffd700' }}>مشاركة صورة جديدة</h3>
                        
                        <div className="preview-image-holder">
                            <img src={imagePreview} alt="Preview Snap" />
                        </div>

                        <div className="preview-input-group">
                            <label>الاسم المرفق:</label>
                            <input 
                                type="text" 
                                value={guestName}
                                disabled
                                style={{ opacity: 0.6 }}
                            />
                        </div>

                        <div className="preview-input-group">
                            <label>تعليق بسيط (اختياري):</label>
                            <input 
                                type="text"
                                placeholder="اكتب تعليقاً على الصورة..."
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                maxLength={80}
                            />
                        </div>

                        <div className="preview-modal-actions">
                            <button 
                                className="preview-btn preview-btn-cancel" 
                                onClick={() => {
                                    setSelectedImage(null);
                                    setImagePreview(null);
                                }}
                            >
                                إلغاء
                            </button>
                            <button 
                                className="preview-btn preview-btn-upload" 
                                onClick={handleUploadPhoto}
                            >
                                رفع ومشاركة 📤
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. UPLOADING PROGRESS OVERLAY */}
            {uploading && (
                <div className="upload-loading-overlay">
                    <div className="letter-spinner"></div>
                    <h3 style={{ marginTop: '20px', color: '#ffd700' }}>جاري رفع ومشاركة صورتك في الألبوم...</h3>
                    <p style={{ opacity: 0.6 }}>يرجى الانتظار لحين اكتمال الرفع.</p>
                </div>
            )}

            {/* 6. PHOTO ZOOM OVERLAY */}
            {zoomPhoto && (
                <div className="zoom-modal-overlay" onClick={() => setZoomPhoto(null)}>
                    <img src={getImageUrl(zoomPhoto)} alt="Zoomed memory" className="zoom-image" />
                </div>
            )}

        </div>
    );
};

export default GraduationEvent;
