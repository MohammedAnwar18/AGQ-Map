import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { communityService } from '../services/api';
import './Modal.css';

const CommunitiesModal = ({ onClose, onJoinCommunity }) => {
    const { user } = useAuth();
    const [communities, setCommunities] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    // Create State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const data = await communityService.getAll();
                setCommunities(data.communities || []);
            } catch (error) {
                console.error("Failed to load communities", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCommunities();
    }, []);

    const handleJoin = async (community) => {
        try {
            if (!community.is_joined) {
                await communityService.join(community.id);
            }
            onJoinCommunity(community);
            onClose();
        } catch (error) {
            console.error("Failed to join community", error);
            alert("فشل الانضمام للمجتمع");
        }
    };

    const handleCreateCommunity = async (e) => {
        e.preventDefault();
        try {
            const res = await communityService.create({ name: newName, description: newDescription });
            setCommunities([res.community, ...communities]);
            setNewName('');
            setNewDescription('');
            setShowCreateForm(false);
            alert('تم إنشاء المجتمع بنجاح');
        } catch (error) {
            console.error(error);
            alert('فشل إنشاء المجتمع');
        }
    };

    const filteredCommunities = communities.filter(c =>
        c.name.includes(searchTerm) || c.description.includes(searchTerm)
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>المجتمعات</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {user?.role === 'admin' && (
                        <div style={{ marginBottom: 20 }}>
                            <button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: showCreateForm ? '#ef4444' : 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginBottom: '10px',
                                    fontFamily: 'inherit'
                                }}
                            >
                                {showCreateForm ? 'إلغاء إنشاء مجتمع' : '+ إضافة مجتمع جديد'}
                            </button>

                            {showCreateForm && (
                                <form onSubmit={handleCreateCommunity} style={{ background: '#f8f9fa', padding: 15, borderRadius: 10, border: '1px solid #ddd' }}>
                                    <input
                                        className="input"
                                        placeholder="اسم المجتمع"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        required
                                        style={{ marginBottom: 10, width: '100%' }}
                                    />
                                    <textarea
                                        className="input"
                                        placeholder="وصف المجتمع"
                                        value={newDescription}
                                        onChange={e => setNewDescription(e.target.value)}
                                        required
                                        style={{ marginBottom: 10, width: '100%', minHeight: 60 }}
                                    />
                                    <button type="submit" className="btn-small is-primary" style={{ width: '100%', padding: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>حفظ</button>
                                </form>
                            )}
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder="ابحث عن مجتمع..."
                        className="input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginBottom: '20px' }}
                    />

                    {loading ? (
                        <div style={{ textAlign: 'center' }}>جاري التحميل...</div>
                    ) : (
                        <div className="communities-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {filteredCommunities.map(comm => (
                                <div key={comm.id} className="community-item" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '15px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                    border: '1px solid #fbab15'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#333', fontFamily: 'inherit' }}>{comm.name}</h3>
                                        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem', fontFamily: 'inherit' }}>{comm.description}</p>
                                        <span style={{ fontSize: '0.8rem', color: '#888', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px', fontFamily: 'inherit' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                            {comm.members_count} عضو
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleJoin(comm)}
                                        style={{
                                            minWidth: '100px',
                                            padding: '8px 20px',
                                            borderRadius: '20px',
                                            border: comm.is_joined ? '2px solid #fbab15' : 'none',
                                            background: comm.is_joined ? 'transparent' : 'linear-gradient(135deg, #fbab15 0%, #f59e0b 100%)',
                                            color: comm.is_joined ? '#fbab15' : 'white',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s',
                                            boxShadow: comm.is_joined ? 'none' : '0 4px 10px rgba(251, 171, 21, 0.3)',
                                            fontFamily: 'inherit'
                                        }}
                                        onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
                                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                                    >
                                        {comm.is_joined ? 'دخول' : 'انضمام'}
                                    </button>
                                </div>
                            ))}
                            {filteredCommunities.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#888', padding: '20px', fontFamily: 'inherit' }}>
                                    لا توجد نتائج
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommunitiesModal;
