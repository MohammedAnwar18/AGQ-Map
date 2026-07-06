import React, { useState, useEffect, useRef } from 'react';
import { eventPhotosService, getImageUrl } from '../services/api';
import './WeddingInvite.css';

const WeddingInvite = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [loadingPhotos, setLoadingPhotos] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploaderName, setUploaderName] = useState('');
    const [showNameModal, setShowNameModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [activeLightbox, setActiveLightbox] = useState(null);

    const fileInputRef = useRef(null);

    // Fetch album photos on mount
    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await eventPhotosService.getPhotos('enas-graduation');
                if (res && res.success) {
                    setPhotos(res.photos || []);
                }
            } catch (err) {
                console.error('Error fetching event photos:', err);
            } finally {
                setLoadingPhotos(false);
            }
        };

        fetchPhotos();
    }, []);

    const handleOpenEnvelope = () => {
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    // Trigger file picker
    const triggerFilePicker = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // When file selected, show modal to enter uploader name
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);
        setShowNameModal(true);
    };

    // Perform R2 upload
    const handleUploadSubmit = async () => {
        if (!selectedFile) return;

        try {
            setUploading(true);
            setShowNameModal(false);

            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('eventSlug', 'enas-graduation');
            formData.append('uploader', uploaderName || 'ضيف بالنوفا');
            formData.append('caption', 'حفل تخرج إيناس 🎉');

            const res = await eventPhotosService.uploadPhoto(formData);
            if (res && res.success) {
                // Add the new photo to state at the top
                setPhotos(prev => [res.photo, ...prev]);
                setUploaderName('');
                setSelectedFile(null);
                
                // Alert success
                alert('تمت إضافة صورتك إلى ألبوم التخرج بنجاح! 🎉');
            } else {
                alert('فشل رفع الصورة، يرجى المحاولة لاحقاً.');
            }
        } catch (err) {
            console.error('Error uploading photo:', err);
            alert('حدث خطأ أثناء رفع الصورة.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="wedding-invite-page">
            {/* Ambient Bokeh Glow Background Elements */}
            <div className="bokeh-bubble bokeh-1"></div>
            <div className="bokeh-bubble bokeh-2"></div>
            <div className="bokeh-bubble bokeh-3"></div>

            {/* 1. DIGITAL ENVELOPE (CLOSED LAYER) */}
            <div 
                className={`invite-envelope-wrapper ${isOpen ? 'open' : ''}`}
                onClick={handleOpenEnvelope}
            >
                {/* Left Half Door (Embossed pattern split) */}
                <div className="envelope-half-door door-left"></div>

                {/* Right Half Door (Embossed pattern split) */}
                <div className="envelope-half-door door-right"></div>

                {/* Centered Golden Rose Wax Seal Image */}
                <div className="seal-action-button">
                    <div 
                        className="gold-rose-wax-seal"
                        style={{ backgroundImage: 'url("https://pub-6e55680fed9e448b82ffe80f9d92b020.r2.dev/uploads/2c8fed7c-520a-40aa-97dc-07864d734ca1.jpg")' }}
                    ></div>
                    <span className="seal-open-instruction">انقر لفتح الدعوة 🌹</span>
                </div>
            </div>

            {/* 2. REVEALED WEDDING PARCHMENT CARD */}
            <div className="revealed-wedding-card">
                <div className="card-inner-frame">
                    
                    {/* Graduate Girl Photo (Embends correctly on top) */}
                    <div className="graduate-girl-container">
                        <img 
                            src="https://pub-6e55680fed9e448b82ffe80f9d92b020.r2.dev/uploads/3b910638-ce93-4d8f-9a94-26e23c34da61.png"
                            alt="Graduate Girl"
                            className="graduate-girl-img"
                        />
                    </div>

                    <h1 className="names-calligraphy enas-title">Enas's Graduation</h1>
                    <div className="event-sub-message graduation-sub">اصنع ألبوم ذكرياتك هذا اليوم</div>

                    <div className="divider-line"></div>

                    {/* PHOTO ALBUM SECTION */}
                    <div className="album-interactive-section">
                        
                        {/* Hidden File Input (supports mobile camera natively) */}
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {/* Open Camera / Add Photo Button */}
                        <button 
                            className="album-action-button" 
                            onClick={triggerFilePicker}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <>
                                    <span className="spinner-icon">⏳</span> جاري الرفع للـ R2...
                                </>
                            ) : (
                                <>
                                    📸 افتح الكاميرا وصوّر للذكرى
                                </>
                            )}
                        </button>

                        {/* Photo Grid Gallery */}
                        <div className="polaroid-gallery-grid">
                            {loadingPhotos ? (
                                <div className="gallery-status-msg">جاري تحميل ألبوم الذكريات...</div>
                            ) : photos.length === 0 ? (
                                <div className="gallery-status-msg empty-msg">كن أول من يضيف صورة للألبوم اليوم! ✨</div>
                            ) : (
                                photos.map((photo, idx) => (
                                    <div 
                                        className="polaroid-card" 
                                        key={photo.id || idx}
                                        onClick={() => setActiveLightbox(getImageUrl(photo.image_url))}
                                    >
                                        <div className="polaroid-image-wrapper">
                                            <img src={getImageUrl(photo.image_url)} alt="Memory" className="polaroid-img" />
                                        </div>
                                        <div className="polaroid-caption">
                                            <span className="uploader-badge">👤 {photo.uploader}</span>
                                            <span className="photo-time">
                                                {photo.created_at ? new Date(photo.created_at).toLocaleDateString('ar-EG', {
                                                    month: 'short',
                                                    day: 'numeric'
                                                }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Logo/Branding */}
                    <a href="https://palnovaa.com" className="website-link" target="_blank" rel="noopener noreferrer">
                        palnovaa.com
                    </a>
                </div>

                {/* Re-seal helper (allows admin to test animation again) */}
                {isOpen && (
                    <button 
                        className="re-seal-btn" 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                        title="إعادة إغلاق الظرف للتجربة"
                    >
                        🔄 إعادة إغلاق
                    </button>
                )}
            </div>

            {/* NAME MODAL */}
            {showNameModal && (
                <div className="name-modal-overlay">
                    <div className="name-modal-content">
                        <h3>✍️ أضف اسمك كصاحب الصورة</h3>
                        <p>سيتم عرض اسمك في ألبوم التخرج أسفل صورتك للذكرى</p>
                        <input 
                            type="text" 
                            placeholder="اكتب اسمك هنا (مثال: محمد)..."
                            value={uploaderName}
                            onChange={(e) => setUploaderName(e.target.value)}
                            maxLength={30}
                            className="name-modal-input"
                        />
                        <div className="name-modal-buttons">
                            <button 
                                className="modal-btn-cancel" 
                                onClick={() => {
                                    setShowNameModal(false);
                                    setSelectedFile(null);
                                }}
                            >
                                إلغاء
                            </button>
                            <button className="modal-btn-submit" onClick={handleUploadSubmit}>
                                رفع الصورة 🎉
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LIGHTBOX FOR IMAGE VIEW */}
            {activeLightbox && (
                <div className="lightbox-overlay" onClick={() => setActiveLightbox(null)}>
                    <span className="lightbox-close">&times;</span>
                    <img src={activeLightbox} alt="Full screen preview" className="lightbox-image" />
                </div>
            )}
        </div>
    );
};

export default WeddingInvite;
