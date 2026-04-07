import React, { useState, useEffect, useCallback, useRef } from 'react';
import { shopService } from '../services/api';

/**
 * لوحة السائق الخاصة - تظهر فقط للسائقين عند فتح بروفايل مكتب التاكسي
 */
const TaxiDriverPanel = ({ shopId, shopName, currentUser, onClose, socket }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isOnDuty, setIsOnDuty] = useState(false);
    const [updatingId, setUpdatingId] = useState(null);
    const locationIntervalRef = useRef(null);
    const [myLocation, setMyLocation] = useState(null);

    const loadRequests = useCallback(async () => {
        try {
            const data = await shopService.getShopRequests(shopId);
            setRequests(data.requests || []);
        } catch (err) {
            console.error('Failed to load driver requests:', err);
        } finally {
            setLoading(false);
        }
    }, [shopId]);

    useEffect(() => {
        loadRequests();
        const interval = setInterval(loadRequests, 15000); // Refresh every 15s
        return () => clearInterval(interval);
    }, [loadRequests]);

    // Socket: Listen for new requests in real-time
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            setRequests(prev => {
                const exists = prev.find(r => r.id === data.request.id);
                if (exists) return prev;
                return [{ ...data.request, ...data.requester }, ...prev];
            });
        };
        socket.on('new-taxi-request', handler);
        return () => socket.off('new-taxi-request', handler);
    }, [socket]);

    // On duty: broadcast driver location to followers
    const startDuty = useCallback(() => {
        setIsOnDuty(true);
        if (socket) {
            socket.emit('join-taxi-shop', shopId);
        }
        // Start broadcasting location
        locationIntervalRef.current = setInterval(() => {
            navigator.geolocation?.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                setMyLocation({ latitude, longitude });
                if (socket) {
                    socket.emit('driver-location-update', { latitude, longitude, shopId });
                }
            });
        }, 10000); // every 10s
    }, [socket, shopId]);

    const stopDuty = useCallback(() => {
        setIsOnDuty(false);
        if (locationIntervalRef.current) {
            clearInterval(locationIntervalRef.current);
        }
    }, []);

    useEffect(() => {
        return () => {
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
        };
    }, []);

    const handleAccept = async (requestId) => {
        try {
            setUpdatingId(requestId);
            await shopService.updateRequestStatus(requestId, 'accepted', currentUser.id);
            setRequests(prev => prev.map(r =>
                r.id === requestId
                    ? { ...r, status: 'accepted', driver_username: currentUser.username }
                    : r
            ));
            setSelectedRequest(prev => prev?.id === requestId ? { ...prev, status: 'accepted' } : prev);
            // Start duty automatically when accepting
            if (!isOnDuty) startDuty();
        } catch (err) {
            alert('فشل القبول: ' + (err.response?.data?.error || 'خطأ'));
        } finally {
            setUpdatingId(null);
        }
    };

    const handleArrive = async (requestId) => {
        try {
            setUpdatingId(requestId);
            await shopService.updateRequestStatus(requestId, 'arrived');
            setRequests(prev => prev.map(r =>
                r.id === requestId ? { ...r, status: 'arrived' } : r
            ));
        } catch (err) {
            alert('فشل تحديث الحالة');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleComplete = async (requestId) => {
        try {
            setUpdatingId(requestId);
            await shopService.updateRequestStatus(requestId, 'completed');
            setRequests(prev => prev.filter(r => r.id !== requestId));
            setSelectedRequest(null);
        } catch (err) {
            alert('فشل إكمال الرحلة');
        } finally {
            setUpdatingId(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'accepted': return '#10b981';
            case 'arrived': return '#3b82f6';
            default: return '#6b7280';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'pending': return 'انتظار';
            case 'accepted': return 'في الطريق';
            case 'arrived': return 'وصل';
            default: return status;
        }
    };

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(251, 171, 21, 0.3)',
            marginBottom: '1rem'
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #fbab15, #f59e0b)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.3rem' }}>🚕</span>
                    <div>
                        <div style={{ color: '#000', fontWeight: '800', fontSize: '0.95rem' }}>
                            لوحة السائق
                        </div>
                        <div style={{ color: 'rgba(0,0,0,0.7)', fontSize: '0.8rem' }}>
                            {shopName}
                        </div>
                    </div>
                </div>

                {/* On Duty Toggle */}
                <button
                    onClick={isOnDuty ? stopDuty : startDuty}
                    style={{
                        background: isOnDuty ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)',
                        border: isOnDuty ? '2px solid rgba(0,0,0,0.4)' : '2px solid transparent',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: isOnDuty ? '#22c55e' : '#ef4444',
                        display: 'inline-block'
                    }} />
                    {isOnDuty ? 'متاح' : 'غير متاح'}
                </button>
            </div>

            {/* Requests List */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 10px' }} />
                        جاري التحميل...
                    </div>
                ) : requests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚗</div>
                        <div style={{ fontSize: '0.9rem' }}>لا توجد طلبات حالياً</div>
                    </div>
                ) : (
                    requests.map(req => (
                        <div
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            style={{
                                background: selectedRequest?.id === req.id
                                    ? 'rgba(251, 171, 21, 0.12)'
                                    : 'var(--bg-tertiary)',
                                borderRadius: '12px',
                                padding: '12px',
                                cursor: 'pointer',
                                border: selectedRequest?.id === req.id
                                    ? '1px solid rgba(251, 171, 21, 0.4)'
                                    : '1px solid transparent',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {/* Avatar */}
                                <div style={{
                                    width: '42px', height: '42px', borderRadius: '50%',
                                    overflow: 'hidden', flexShrink: 0,
                                    background: 'var(--bg-secondary)',
                                    border: '2px solid rgba(251,171,21,0.3)'
                                }}>
                                    {req.profile_picture ? (
                                        <img src={req.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.1rem', fontWeight: '700', color: '#fbab15'
                                        }}>
                                            {(req.full_name || req.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontWeight: '700', fontSize: '0.9rem',
                                        color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                    }}>
                                        {req.full_name || req.username}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        📍 {req.pickup_address || 'موقع محدد'}
                                    </div>
                                    {req.phone_number && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px' }}>
                                            📞 {req.phone_number}
                                        </div>
                                    )}
                                </div>

                                {/* Status Badge */}
                                <div style={{
                                    background: `${getStatusColor(req.status)}20`,
                                    color: getStatusColor(req.status),
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    flexShrink: 0,
                                    border: `1px solid ${getStatusColor(req.status)}40`
                                }}>
                                    {getStatusLabel(req.status)}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {selectedRequest?.id === req.id && (
                                <div style={{
                                    marginTop: '12px',
                                    padding: '12px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--bg-tertiary)'
                                }}>
                                    {/* Requester Info */}
                                    <div style={{ marginBottom: '12px' }}>
                                        {req.gender && (
                                            <span style={{
                                                fontSize: '0.8rem', color: 'var(--text-muted)',
                                                background: 'var(--bg-tertiary)', padding: '2px 8px',
                                                borderRadius: '8px', marginLeft: '6px'
                                            }}>
                                                {req.gender === 'male' ? '👨 ذكر' : '👩 أنثى'}
                                            </span>
                                        )}
                                        {req.marital_status && (
                                            <span style={{
                                                fontSize: '0.8rem', color: 'var(--text-muted)',
                                                background: 'var(--bg-tertiary)', padding: '2px 8px',
                                                borderRadius: '8px', marginLeft: '6px'
                                            }}>
                                                {req.marital_status === 'single' ? 'أعزب' :
                                                    req.marital_status === 'married' ? 'متزوج' : req.marital_status}
                                            </span>
                                        )}
                                        {req.latitude && req.longitude && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.showTaxiRoute) {
                                                        window.showTaxiRoute({
                                                            passengerLoc: { lat: req.latitude, lng: req.longitude },
                                                            driverLoc: myLocation,
                                                            passengerName: req.full_name || req.username
                                                        });
                                                    }
                                                    if (onClose) onClose();
                                                }}
                                                style={{
                                                    fontSize: '0.8rem', color: '#fff',
                                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                                    border: 'none', padding: '6px 12px', borderRadius: '8px',
                                                    cursor: 'pointer', display: 'inline-flex',
                                                    alignItems: 'center', gap: '4px', marginTop: '6px',
                                                    fontWeight: 'bold', fontFamily: 'inherit'
                                                }}
                                            >
                                                🗺️ عرض المسار على الخريطة
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {req.status === 'pending' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleAccept(req.id); }}
                                                disabled={updatingId === req.id}
                                                style={{
                                                    flex: 1, padding: '8px 12px',
                                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                                                    fontFamily: 'inherit', opacity: updatingId === req.id ? 0.7 : 1
                                                }}
                                            >
                                                {updatingId === req.id ? '...' : '✓ قبول الطلب'}
                                            </button>
                                        )}
                                        {req.status === 'accepted' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleArrive(req.id); }}
                                                disabled={updatingId === req.id}
                                                style={{
                                                    flex: 1, padding: '8px 12px',
                                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                                                    fontFamily: 'inherit', opacity: updatingId === req.id ? 0.7 : 1
                                                }}
                                            >
                                                {updatingId === req.id ? '...' : '🚖 وصلت'}
                                            </button>
                                        )}
                                        {(req.status === 'accepted' || req.status === 'arrived') && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleComplete(req.id); }}
                                                disabled={updatingId === req.id}
                                                style={{
                                                    flex: 1, padding: '8px 12px',
                                                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                                    color: 'white', border: 'none', borderRadius: '8px',
                                                    cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                                                    fontFamily: 'inherit', opacity: updatingId === req.id ? 0.7 : 1
                                                }}
                                            >
                                                ✓ إكمال الرحلة
                                            </button>
                                        )}
                                        {req.phone_number && (
                                            <a
                                                href={`tel:${req.phone_number}`}
                                                style={{
                                                    padding: '8px 12px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                    borderRadius: '8px',
                                                    fontWeight: '700', fontSize: '0.85rem',
                                                    textDecoration: 'none', display: 'flex',
                                                    alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                📞 اتصال
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer: refresh */}
            <button
                onClick={loadRequests}
                style={{
                    width: '100%', padding: '10px',
                    background: 'none', border: 'none',
                    borderTop: '1px solid var(--bg-tertiary)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.8rem', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
            >
                🔄 تحديث الطلبات
            </button>
        </div>
    );
};

export default TaxiDriverPanel;
