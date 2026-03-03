import React, { useState, useEffect } from 'react';
import { newsService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './NewsModal.css';

const NewsModal = ({ onClose, location }) => {
    const { user } = useAuth();
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationName, setLocationName] = useState('Loading location...');
    const [error, setError] = useState(null);

    // Admin state
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const [showAddForm, setShowAddForm] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [initialLocation] = useState({
        latitude: location?.latitude,
        longitude: location?.longitude
    });

    const fetchNews = async () => {
        try {
            setLoading(true);
            const data = await newsService.getNews({
                lat: initialLocation.latitude,
                lon: initialLocation.longitude
            });
            setNews(data.articles);
            setLocationName(data.location || 'Local Area');
        } catch (err) {
            console.error("News fetch error", err);
            setError("Could not fetch local news.");
            setLocationName("Unable to locate");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialLocation.latitude && initialLocation.longitude) {
            fetchNews();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddNews = async (e) => {
        e.preventDefault();
        if (!title || !description) return;
        try {
            setSubmitting(true);
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('latitude', initialLocation.latitude);
            formData.append('longitude', initialLocation.longitude);
            if (imageFile) formData.append('image', imageFile);

            await newsService.createNews(formData);

            // Reset and refresh
            setTitle('');
            setDescription('');
            setImageFile(null);
            setShowAddForm(false);
            fetchNews();
        } catch (err) {
            console.error("Failed to add news", err);
            alert("حدث خطأ أثناء إضافة الخبر");
        } finally {
            setSubmitting(false);
        }
    };

    const getImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '';
        return `${baseUrl}${url}`;
    };

    return (
        <div className="news-modal-overlay">
            <div className="news-panel glass fade-in-up">
                <div className="news-header">
                    <div className="location-badge">
                        <span className="live-dot"></span>
                        LIVE
                    </div>
                    <h2>{loading ? 'Locating...' : `الأخبار المحلية`}</h2>
                    <button onClick={onClose} className="close-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

                {isAdmin && (
                    <div style={{ padding: '0 20px', marginBottom: '10px' }}>
                        <button
                            style={{
                                width: '100%', padding: '10px',
                                background: showAddForm ? '#6c757d' : '#fbab15',
                                color: 'white', border: 'none',
                                borderRadius: '10px', fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                            onClick={() => setShowAddForm(!showAddForm)}
                        >
                            {showAddForm ? 'إلغاء الإضافة' : '+ إضافة خبر جديد هنا'}
                        </button>
                    </div>
                )}

                <div className="news-content">
                    {showAddForm ? (
                        <form onSubmit={handleAddNews} className="add-news-form" style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '15px' }}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>العنوان:</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                                />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>التفاصيل:</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    required
                                    rows="4"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', resize: 'vertical' }}
                                ></textarea>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>صورة (اختياري):</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => setImageFile(e.target.files[0])}
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: '100%', padding: '12px',
                                    background: '#28a745', color: 'white',
                                    border: 'none', borderRadius: '8px',
                                    fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {submitting ? 'جاري الإضافة...' : 'نشر الخبر'}
                            </button>
                        </form>
                    ) : loading ? (
                        <div className="loading-skeletons">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton-card"></div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p>{error}</p>
                        </div>
                    ) : news.length === 0 ? (
                        <div className="empty-state">
                            <p>لا توجد أخبار محلية في هذه المنطقة حالياً.</p>
                        </div>
                    ) : (
                        <div className="news-grid">
                            {news.map((item) => (
                                <div key={item.id} className="news-card" style={{ cursor: 'default' }}>
                                    {item.image && <div className="news-image" style={{ backgroundImage: `url(${getImageUrl(item.image)})` }}></div>}
                                    <div className="news-info">
                                        <span className="news-source">{item.source.name}</span>
                                        <h3>{item.title}</h3>
                                        <p>{item.description}</p>
                                        <span className="news-time">{new Date(item.publishedAt).toLocaleString('ar-EG')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsModal;
