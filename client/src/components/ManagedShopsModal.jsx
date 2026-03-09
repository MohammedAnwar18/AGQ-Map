import React, { useState, useEffect } from 'react';
import { shopService } from '../services/api';
import './Modal.css';

const ManagedShopsModal = ({ onClose, onShopClick }) => {
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchShops = async () => {
            try {
                const data = await shopService.getManagedShops();
                setShops(data.shops || []);
            } catch (error) {
                console.error("Failed to load managed shops", error);
            } finally {
                setLoading(false);
            }
        };
        fetchShops();
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>إدارة محلاتي</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="spinner"></div>
                    ) : shops.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <p>أنت لا تدير أي محلات حالياً.</p>
                        </div>
                    ) : (
                        <div className="user-list">
                            {shops.map(shop => (
                                <div
                                    key={shop.id}
                                    className="user-item"
                                    onClick={() => onShopClick(shop)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="chat-avatar">
                                        <div style={{
                                            width: '50px', height: '50px', borderRadius: '12px',
                                            background: `url(${shop.profile_picture || '/default-shop.png'}) center/cover`,
                                            backgroundColor: '#fbab15',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 'bold'
                                        }}>
                                            {!shop.profile_picture && (shop.name?.[0] || 'S')}
                                        </div>
                                    </div>
                                    <div className="chat-info">
                                        <div className="chat-name">{shop.name}</div>
                                        <div className="chat-last-message">{shop.category}</div>
                                    </div>
                                    <div className="user-item-actions">
                                        <button className="btn-small is-primary">تعديل / إدارة</button>
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

export default ManagedShopsModal;
