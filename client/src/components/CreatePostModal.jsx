import React, { useState, useRef } from 'react';
import { postService } from '../services/api';
import { optimizeImage } from '../utils/imageOptimizer';
import './Modal.css';

const CreatePostModal = ({ currentLocation, onClose, onPostCreated, communityId }) => {
    const [content, setContent] = useState('');
    const [images, setImages] = useState([]); // Array of files
    const [imagePreviews, setImagePreviews] = useState([]); // Array of strings (URLs)
    const [useCamera, setUseCamera] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // اختار صورة أو فيديو من الملف
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        // Filter and add files
        let validFiles = [];
        let validPreviews = [];

        files.forEach(file => {
            if (communityId && !file.type.startsWith('image/')) {
                setError('فقط الصور مسموحة في المجتمعات حالياً');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                setError('تم تجاهل ملفات أكبر من 20MB');
                return;
            }
            validFiles.push(file);
            validPreviews.push(URL.createObjectURL(file));
        });

        setImages(prev => [...prev, ...validFiles]);
        setImagePreviews(prev => [...prev, ...validPreviews]);
    };

    // إزالة الصورة
    const removeImage = (index) => {
        const newImages = [...images];
        const newPreviews = [...imagePreviews];

        URL.revokeObjectURL(newPreviews[index]);

        newImages.splice(index, 1);
        newPreviews.splice(index, 1);

        setImages(newImages);
        setImagePreviews(newPreviews);

        if (newImages.length === 0 && fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // حالة النجاح
    const [success, setSuccess] = useState(false);

    // نشر المنشور
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!currentLocation) {
            setError('لم نتمكن من الحصول على موقعك. يرجى السماح بالوصول للموقع.');
            return;
        }

        if (!content && images.length === 0) {
            setError('يرجى إضافة صورة أو نص على الأقل');
            return;
        }

        try {
            setLoading(true);
            setError('');

            const formData = new FormData();
            formData.append('content', content);
            formData.append('latitude', currentLocation.latitude);
            formData.append('longitude', currentLocation.longitude);
            if (communityId) {
                formData.append('community_id', communityId);
            }

            // Optimize images before upload
            for (const img of images) {
                const optimizedFile = await optimizeImage(img, { maxWidth: 1200, quality: 0.7 });
                formData.append('media', optimizedFile);
            }

            // محاولة الحصول على العنوان (Reverse Geocoding)
            try {
                const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
                const geocodeResponse = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${currentLocation.longitude},${currentLocation.latitude}.json?access_token=${mapboxToken}`
                );
                const geocodeData = await geocodeResponse.json();
                if (geocodeData.features && geocodeData.features.length > 0) {
                    formData.append('address', geocodeData.features[0].place_name);
                }
            } catch (geocodeError) {
                console.error('Geocoding failed:', geocodeError);
            }

            const result = await postService.createPost(formData);

            // إظهار نجاح
            setSuccess(true);

            // تأخير بسيط لرؤية الأنيميشن ثم التحديث
            setTimeout(() => {
                onPostCreated(result.post); // Pass the post object directly to avoid structure mismatch
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.error || 'فشل نشر المنشور');
            console.error('Create post error:', err);
            setLoading(false); // Only stop loading on error, keep loading/success state on success
        }
    };

    // تنظيف عند الإغلاق
    const handleClose = () => {
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        onClose();
    };

    if (success) {
        return (
            <div className="modal-overlay">
                <div className="modal-container glass" style={{
                    maxWidth: '430px',
                    padding: '3rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
                }}>
                    <div className="success-overlay-content">
                        <div className="success-icon-wrapper">
                            <div className="success-circle-bg"></div>
                            <div className="success-circle-main">
                                <svg className="checkmark-smooth" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                            </div>
                        </div>
                        <div className="success-text-container">
                            <h3 className="success-title">تم النشر بنجاح!</h3>
                            <p className="success-subtitle">شكراً لك، جاري تحديث الخريطة...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>منشور جديد</h2>
                    <button className="btn-close" onClick={handleClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {error && (
                        <div className="error-message">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}

                    {/* معاينة الوسائط */}
                    {imagePreviews.length > 0 && (
                        <div className="media-preview-container" style={{
                            display: 'flex',
                            gap: '10px',
                            overflowX: 'auto',
                            padding: '10px 0',
                            whiteSpace: 'nowrap'
                        }}>
                            {imagePreviews.map((preview, index) => (
                                <div key={index} className="image-preview" style={{
                                    flex: '0 0 auto',
                                    width: '150px',
                                    height: '150px',
                                    position: 'relative'
                                }}>
                                    {images[index].type.startsWith('video/') ? (
                                        <video src={preview} className="preview-video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <img src={preview} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )}
                                    <button
                                        type="button"
                                        className="btn-remove-image"
                                        onClick={() => removeImage(index)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            {/* زر إضافة المزيد */}
                            <label
                                style={{
                                    flex: '0 0 auto',
                                    width: '150px',
                                    height: '150px',
                                    border: '2px dashed #ccc',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    background: 'transparent',
                                    color: '#ccc',
                                    fontSize: '2rem'
                                }}
                            >
                                +
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}

                    {/* أزرار الإضافة الأولية */}
                    {imagePreviews.length === 0 && (
                        <div className="image-actions">
                            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                فتح الكاميرا
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    capture="environment"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>

                            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                اختيار ملفات
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}

                    {/* النص */}
                    <div className="form-group">
                        <label htmlFor="content">الوصف (اختياري)</label>
                        <textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="input textarea"
                            placeholder="اكتب وصفاً لمنشورك..."
                            rows="4"
                        />
                    </div>

                    {/* معلومات الموقع */}
                    {currentLocation && (
                        <div className="location-info">
                            <span className="location-icon">📍</span>
                            <span className="location-text">
                                الموقع: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                            </span>
                        </div>
                    )}

                    {/* زر النشر */}
                    <button
                        type="submit"
                        className="btn btn-primary btn-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="spinner-small"></div>
                                جاري النشر...
                            </>
                        ) : (
                            'نشر'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePostModal;
