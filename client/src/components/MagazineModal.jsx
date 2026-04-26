import React, { useState, useEffect } from 'react';
import './MagazineModal.css';
import { useAuth } from '../context/AuthContext';
import { magazineService } from '../services/api';
import MagazineEditor from './MagazineEditor';
import MagazineViewer from './MagazineViewer';
import MagazineBackground from './MagazineBackground';

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
                                    {mag.cover_image ? (
                                        <img src={mag.cover_image} alt={mag.title} />
                                    ) : (
                                        <div className="no-cover">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                            </svg>
                                            <p>بدون غلاف</p>
                                        </div>
                                    )}
                                </div>
                                <h3 style={{ margin: '10px 0', fontSize: '1.2rem' }}>{mag.title}</h3>
                                {mag.is_published && <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>● منشور</span>}
                                {!mag.is_published && isAdmin && <span style={{ color: '#9a9aa5', fontSize: '0.8rem' }}>مسودة</span>}
                                
                                <div className="mag-actions">
                                    <button onClick={() => setSelectedMagazineId(mag.id)}>قراءة</button>
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => { setSelectedMagazineId(mag.id); setIsEditing(true); }}>تعديل</button>
                                            <button onClick={(e) => handleDelete(mag.id, e)} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', flex: '0 0 auto', width: '40px' }}>
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
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
