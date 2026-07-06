import React, { useState, useEffect, useRef } from 'react';
import { eventPhotosService, getImageUrl } from '../services/api';
import './WeddingInvite.css';

const DEVICE_KEY = 'enas_grad_device_id';

// Get or create a unique ID for this device (browser session persists)
const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
};

const WeddingInvite = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [allPhotos, setAllPhotos] = useState([]); // all photos from server
    const [uploading, setUploading] = useState(false);
    const [activeLightbox, setActiveLightbox] = useState(null);
    const [deviceId] = useState(getDeviceId);

    const fileInputRef = useRef(null);
    const cardRef = useRef(null);

    // Only show THIS device's photos
    const myPhotos = allPhotos.filter(p => p.uploader === deviceId);

    // Fetch album photos on mount
    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await eventPhotosService.getPhotos('enas-graduation');
                if (res && res.success) {
                    setAllPhotos(res.photos || []);
                }
            } catch (err) {
                console.error('Error fetching event photos:', err);
            }
        };
        fetchPhotos();
    }, []);

    const handleOpenEnvelope = () => {
        if (!isOpen) {
            setIsOpen(true);
            // Scroll card back to top whenever opening
            setTimeout(() => {
                if (cardRef.current) cardRef.current.scrollTop = 0;
            }, 800);
        }
    };

    // Trigger file/camera picker immediately on plus click
    const triggerCamera = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    // When file is captured, upload immediately — no name modal
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset input so same file can be reselected
        e.target.value = '';

        try {
            setUploading(true);

            const formData = new FormData();
            formData.append('image', file);
            formData.append('eventSlug', 'enas-graduation');
            formData.append('uploader', deviceId); // tag with device ID
            formData.append('caption', 'حفل تخرج إيناس 🎉');

            const res = await eventPhotosService.uploadPhoto(formData);
            if (res && res.success) {
                // Add new photo at top
                setAllPhotos(prev => [res.photo, ...prev]);
                // Scroll to top of gallery to see new photo
                if (cardRef.current) {
                    setTimeout(() => {
                        cardRef.current.scrollTo({ top: cardRef.current.scrollHeight, behavior: 'smooth' });
                    }, 100);
                }
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

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        return `${datePart} — ${timePart}`;
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

                {/* Centered Golden Rose Wax Seal Image — no text below */}
                <div className="seal-action-button">
                    <div
                        className="gold-rose-wax-seal"
                        style={{ backgroundImage: 'url("https://pub-6e55680fed9e448b82ffe80f9d92b020.r2.dev/uploads/2c8fed7c-520a-40aa-97dc-07864d734ca1.jpg")' }}
                    ></div>
                </div>
            </div>

            {/* 2. REVEALED WEDDING PARCHMENT CARD — scrollable */}
            <div className="revealed-wedding-card" ref={cardRef}>
                <div className="card-inner-frame">

                    {/* Graduate Girl Photo */}
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

                        {/* Hidden File Input — triggers camera on mobile */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {/* Photo Grid Gallery — MY photos only */}
                        {myPhotos.length === 0 && !uploading && (
                            <div className="gallery-status-msg empty-msg">
                                التقط أول صورة للذكرى! ✨
                            </div>
                        )}

                        <div className="polaroid-gallery-grid">
                            {/* Plus button cell — always first */}
                            <div
                                className={`add-photo-card ${uploading ? 'uploading' : ''}`}
                                onClick={!uploading ? triggerCamera : undefined}
                                title="التقط صورة للذكرى"
                            >
                                {uploading ? (
                                    <span className="spinner-icon">⏳</span>
                                ) : (
                                    <span className="plus-icon">+</span>
                                )}
                            </div>

                            {myPhotos.map((photo, idx) => (
                                <div
                                    className="polaroid-card"
                                    key={photo.id || idx}
                                    onClick={() => setActiveLightbox(getImageUrl(photo.image_url))}
                                >
                                    <div className="polaroid-image-wrapper">
                                        <img src={getImageUrl(photo.image_url)} alt="Memory" className="polaroid-img" />
                                    </div>
                                    <div className="polaroid-caption">
                                        <span className="photo-datetime">
                                            {formatDateTime(photo.created_at)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Logo/Branding */}
                    <a href="https://palnovaa.com" className="website-link" target="_blank" rel="noopener noreferrer">
                        palnovaa.com
                    </a>
                </div>

                {/* Re-seal helper */}
                {isOpen && (
                    <button
                        className="re-seal-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                        }}
                        title="إعادة إغلاق الظرف للتجربة"
                    >
                        🔄
                    </button>
                )}
            </div>

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
