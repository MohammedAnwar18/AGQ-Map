import React, { useState, useEffect } from 'react';
import './MagazineModal.css';
import { useAuth } from '../context/AuthContext';
import { magazineService } from '../services/api';
import MagazineEditor from './MagazineEditor';
import MagazineViewer from './MagazineViewer';
import MagazineBackground from './MagazineBackground';
import { MagazineElementRenderer } from './MagazineElementRenderer';

const MagazineModal = ({ onClose }) => {
    const { user } = useAuth();
    const [magazines, setMagazines] = useState([]);
    const [selectedMagazineId, setSelectedMagazineId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);

    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        fetchMagazines();
    }, [isAdmin]);

    const fetchMagazines = async () => {
        try {
            setLoading(true);
            const data = isAdmin 
                ? await magazineService.getAllMagazines()
                : await magazineService.getMagazines();
            setMagazines(data);
        } catch (error) {
            console.error('Failed to fetch magazines:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        const title = prompt('أدخل عنوان المجلة الجديد:');
        if (!title) return;
        try {
            const newMag = await magazineService.createMagazine({ title, description: '' });
            setMagazines([newMag, ...magazines]);
            // Automatically open editor for the new magazine
            setSelectedMagazineId(newMag.id);
            setIsEditing(true);
        } catch (error) {
            alert('فشل في إنشاء المجلة');
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('هل أنت متأكد من حذف هذا العدد؟')) return;
        try {
            await magazineService.deleteMagazine(id);
            setMagazines(magazines.filter(m => m.id !== id));
        } catch (error) {
            alert('فشل في الحذف');
        }
    };

    if (isEditing && selectedMagazineId) {
        return <MagazineEditor magazineId={selectedMagazineId} onClose={() => { setIsEditing(false); fetchMagazines(); }} />;
    }

    if (selectedMagazineId) {
        return (
            <div className="magazine-modal-overlay">
                <button className="magazine-close-btn" onClick={() => setSelectedMagazineId(null)}>×</button>
                <MagazineViewer magazineId={selectedMagazineId} />
            </div>
        );
    }

    return (
        <div className="magazine-modal-overlay">
            <MagazineBackground />
            <button className="magazine-close-btn" onClick={onClose}>×</button>
            
            <div className="magazine-library">
                <h1>مجلة بالنوفا المكانية</h1>
                {isAdmin && (
                    <button className="header-btn save" style={{ margin: '0 auto 40px auto', display: 'block' }} onClick={handleCreate}>
                        + إنشاء عدد جديد
                    </button>
                )}
                
                {loading ? (
                    <div className="magazine-loading">جاري تحميل المكتبة...</div>
                ) : (
                    <div className="magazines-grid">
                        {magazines.map(mag => (
                            <div key={mag.id} className="magazine-card">
                                <div className="magazine-cover">
                                    {mag.cover_content ? (
                                        <div className="mini-cover-container">
                                            <div className="mini-cover-viewport">
                                                {(() => {
                                                    try {
                                                        const content = typeof mag.cover_content === 'string' 
                                                            ? JSON.parse(mag.cover_content) 
                                                            : mag.cover_content;
                                                        return content.elements?.map(el => (
                                                            <MagazineElementRenderer key={el.id} el={el} scale={0.6} />
                                                        ));
                                                    } catch (e) {
                                                        return <p style={{ color: 'red', fontSize: '10px' }}>خطأ في البيانات</p>;
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="no-cover">
                                            <div className="cover-fallback-title">{mag.title}</div>
                                            <div className="no-cover-icon">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                    <div className="cover-overlay">
                                         <button className="read-btn-overlay" onClick={() => setSelectedMagazineId(mag.id)}>قراءة الآن</button>
                                    </div>
                                </div>
                                <div className="magazine-info">
                                    <h3 className="mag-title">{mag.title}</h3>
                                    <div className="mag-meta">
                                        {mag.is_published ? (
                                            <span className="status-badge published">العدد منشور</span>
                                        ) : (
                                            <span className="status-badge draft">مسودة</span>
                                        )}
                                        <span className="date-badge">{new Date(mag.created_at).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                </div>
                                
                                {isAdmin && (
                                    <div className="mag-admin-actions">
                                        <button className="edit-btn" onClick={() => { setSelectedMagazineId(mag.id); setIsEditing(true); }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            تعديل
                                        </button>
                                        <button className="delete-btn" onClick={(e) => handleDelete(mag.id, e)} title="حذف">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {magazines.length === 0 && !loading && (
                            <div style={{ gridColumn: '1/-1', padding: '40px', opacity: 0.5 }}>
                                <p>لا توجد مـجلات متاحة حالياً.</p>
                                {isAdmin && <p>ابدأ بإنشاء العدد الأول الآن!</p>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MagazineModal;
