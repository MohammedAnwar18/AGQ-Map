import React, { useState, useEffect, useRef, useCallback } from 'react';
import { eventPhotosService, getImageUrl } from '../services/api';
import './WeddingInvite.css';

const DEVICE_KEY = 'enas_grad_device_id';

const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
};

// Compress image via canvas before upload (faster network transfer)
const compressImage = (file, maxWidth = 1200, quality = 0.82) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

const WeddingInvite = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [allPhotos, setAllPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [activeLightbox, setActiveLightbox] = useState(null);
    const [deviceId] = useState(getDeviceId);

    const fileInputRef = useRef(null);
    const cardRef = useRef(null);

    const myPhotos = allPhotos.filter(p => p.uploader === deviceId);

    useEffect(() => {
        const fetchPhotos = async () => {
            try {
                const res = await eventPhotosService.getPhotos('enas-graduation');
                if (res && res.success) setAllPhotos(res.photos || []);
            } catch (err) {
                console.error('Error fetching event photos:', err);
            }
        };
        fetchPhotos();
    }, []);

    const handleOpenEnvelope = () => {
        if (!isOpen) {
            setIsOpen(true);
            setTimeout(() => {
                if (cardRef.current) cardRef.current.scrollTop = 0;
            }, 800);
        }
    };

    const triggerCamera = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = useCallback(async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        try {
            setUploading(true);

            // Optimistic UI: show placeholder immediately
            const localUrl = URL.createObjectURL(file);
            const tempPhoto = {
                id: 'temp_' + Date.now(),
                image_url: localUrl,
                uploader: deviceId,
                created_at: new Date().toISOString(),
                isTemp: true,
            };
            setAllPhotos(prev => [tempPhoto, ...prev]);

            // Compress before upload
            const compressed = await compressImage(file);
            const uploadFile = new File([compressed], file.name, { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('image', uploadFile);
            formData.append('eventSlug', 'enas-graduation');
            formData.append('uploader', deviceId);
            formData.append('caption', 'حفل تخرج إيناس 🎉');

            const res = await eventPhotosService.uploadPhoto(formData);
            if (res && res.success) {
                // Replace temp with real photo
                setAllPhotos(prev => [res.photo, ...prev.filter(p => p.id !== tempPhoto.id)]);
                URL.revokeObjectURL(localUrl);
            } else {
                // Remove temp on failure
                setAllPhotos(prev => prev.filter(p => p.id !== tempPhoto.id));
                alert('فشل رفع الصورة، يرجى المحاولة لاحقاً.');
            }
        } catch (err) {
            console.error('Error uploading photo:', err);
            setAllPhotos(prev => prev.filter(p => p.isTemp));
            alert('حدث خطأ أثناء رفع الصورة.');
        } finally {
            setUploading(false);
        }
    }, [deviceId]);

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        return `${datePart} — ${timePart}`;
    };

    return (
        <div className="wedding-invite-page">
            <div className="bokeh-bubble bokeh-1"></div>
            <div className="bokeh-bubble bokeh-2"></div>
            <div className="bokeh-bubble bokeh-3"></div>

            {/* 1. DIGITAL ENVELOPE (CLOSED LAYER) */}
            <div
                className={`invite-envelope-wrapper ${isOpen ? 'open' : ''}`}
                onClick={handleOpenEnvelope}
            >
                <div className="envelope-half-door door-left"></div>
                <div className="envelope-half-door door-right"></div>

                {/* Seal + Cover Text */}
                <div className="seal-action-button">
                    <div
                        className="gold-rose-wax-seal"
                        style={{ backgroundImage: 'url("https://pub-6e55680fed9e448b82ffe80f9d92b020.r2.dev/uploads/2c8fed7c-520a-40aa-97dc-07864d734ca1.jpg")' }}
                    ></div>
                </div>

                {/* Cover typewriter texts — top & bottom of envelope */}
                <div className="cover-welcome-text">
                    <span className="typewriter-welcome">Welcome to Enas's Seminar</span>
                </div>
                <div className="cover-date-text">
                    <span className="typewriter-date">9 - 7 - 2026</span>
                </div>
            </div>

            {/* 2. REVEALED CARD — scrollable */}
            <div className="revealed-wedding-card" ref={cardRef}>
                <div className="card-inner-frame">

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
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />

                        {/* Full-width Plus Add Card */}
                        <div
                            className={`add-photo-card-full ${uploading ? 'uploading' : ''}`}
                            onClick={!uploading ? triggerCamera : undefined}
                            title="التقط صورة للذكرى"
                        >
                            {uploading ? (
                                <span className="spinner-icon">⏳</span>
                            ) : (
                                <span className="plus-icon">+</span>
                            )}
                        </div>

                        {myPhotos.length === 0 && !uploading && (
                            <div className="gallery-status-msg empty-msg">
                                التقط أول صورة للذكرى! ✨
                            </div>
                        )}

                        {/* Photo Grid */}
                        {myPhotos.length > 0 && (
                            <div className="polaroid-gallery-grid">
                                {myPhotos.map((photo, idx) => (
                                    <div
                                        className={`polaroid-card ${photo.isTemp ? 'uploading-card' : ''}`}
                                        key={photo.id || idx}
                                        onClick={() => !photo.isTemp && setActiveLightbox(photo.isTemp ? photo.image_url : getImageUrl(photo.image_url))}
                                    >
                                        <div className="polaroid-image-wrapper">
                                            <img
                                                src={photo.isTemp ? photo.image_url : getImageUrl(photo.image_url)}
                                                alt="Memory"
                                                className="polaroid-img"
                                            />
                                            {photo.isTemp && <div className="upload-overlay">جاري الرفع...</div>}
                                        </div>
                                        <div className="polaroid-caption">
                                            <span className="photo-datetime">
                                                {formatDateTime(photo.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <a href="https://palnovaa.com" className="website-link" target="_blank" rel="noopener noreferrer">
                        palnovaa.com
                    </a>
                </div>

                {isOpen && (
                    <button
                        className="re-seal-btn"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                        title="إعادة إغلاق الظرف للتجربة"
                    >🔄</button>
                )}
            </div>

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
