import React, { useState, useEffect, useCallback } from 'react';
import { shopService } from '../services/api';

/**
 * لوحة الراكب لطلب التاكسي
 * يظهر للمتابعين في بروفايل مكتب التاكسي
 */
const TaxiRequestPanel = ({
    shop,
    currentUser,
    activeDrivers = [],    // السائقون النشطون مع مواقعهم
    socket,
    onDriverSelect,       // callback for showing driver route on map
    onRequestSent        // callback after request is sent
}) => {
    const [myLocation, setMyLocation] = useState(null);
    const [requesting, setRequesting] = useState(false);
    const [activeRequest, setActiveRequest] = useState(null);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [liveDrivers, setLiveDrivers] = useState(activeDrivers);
    const [requestMode, setRequestMode] = useState('any'); // 'any' | 'nearest' | 'specific'

    // Update live drivers from socket
    useEffect(() => {
        setLiveDrivers(activeDrivers);
    }, [activeDrivers]);

    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            setLiveDrivers(prev => {
                const existing = prev.findIndex(d => d.id === data.driverId);
                const updated = [...prev];
                if (existing >= 0) {
                    updated[existing] = { ...updated[existing], latitude: data.latitude, longitude: data.longitude };
                }
                return updated;
            });
        };
        socket.on('driver-location', handler);
        return () => socket.off('driver-location', handler);
    }, [socket]);

    // Track taxi status via socket
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (data.status === 'accepted') {
                setActiveRequest(prev => prev ? { ...prev, status: 'accepted', driver: data.driver } : prev);
            } else if (data.status === 'arrived') {
                setActiveRequest(prev => prev ? { ...prev, status: 'arrived' } : prev);
            } else if (data.status === 'completed' || data.status === 'cancelled') {
                setActiveRequest(null);
            }
        };
        socket.on('taxi-status-update', handler);
        return () => socket.off('taxi-status-update', handler);
    }, [socket]);

    const getLocation = useCallback(() => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                err => reject(err),
                { enableHighAccuracy: true, timeout: 8000 }
            );
        });
    }, []);

    const handleRequestTaxi = async (driverId = null, useNearest = false) => {
        try {
            setRequesting(true);
            const location = await getLocation();
            setMyLocation(location);

            let result;
            if (useNearest) {
                result = await shopService.requestNearestTaxi({
                    shopId: shop.id,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: 'موقعي الحالي'
                });
            } else {
                result = await shopService.requestTaxi(shop.id, {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: 'موقعي الحالي',
                    driverId
                });
            }

            setActiveRequest({ ...result, status: result.status || 'pending' });
            if (onRequestSent) onRequestSent(result);

            // Subscribe to driver tracking
            if (socket && result.assigned_driver_id) {
                socket.emit('track-driver', { driverId: result.assigned_driver_id });
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'فشل إرسال الطلب';
            alert(msg);
        } finally {
            setRequesting(false);
        }
    };

    const cancelRequest = async () => {
        if (!activeRequest) return;
        try {
            await shopService.updateRequestStatus(activeRequest.id, 'cancelled');
            setActiveRequest(null);
        } catch (err) {
            alert('فشل إلغاء الطلب');
        }
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'pending': return { label: 'جاري البحث عن سائق...', color: '#f59e0b', icon: '⏳' };
            case 'accepted': return { label: 'السائق في الطريق إليك!', color: '#10b981', icon: '🚕' };
            case 'arrived': return { label: 'السائق وصل إلى موقعك!', color: '#3b82f6', icon: '✅' };
            default: return { label: status, color: '#6b7280', icon: '🚗' };
        }
    };

    const calcDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist < 1000) return `${Math.round(dist)} م`;
        return `${(dist / 1000).toFixed(1)} كم`;
    };

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            marginBottom: '1rem'
        }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span style={{ fontSize: '1.4rem' }}>🚕</span>
                <div>
                    <div style={{ color: 'white', fontWeight: '800', fontSize: '0.95rem' }}>
                        طلب تاكسي
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                        {liveDrivers?.length > 0
                            ? `${liveDrivers.length} سائق نشط`
                            : 'لا يوجد سائقون نشطون حالياً'}
                    </div>
                </div>
            </div>

            {/* Active Request State */}
            {activeRequest ? (
                <div style={{ padding: '16px' }}>
                    {(() => {
                        const info = getStatusInfo(activeRequest.status);
                        return (
                            <div style={{
                                background: `${info.color}15`,
                                border: `1px solid ${info.color}40`,
                                borderRadius: '12px',
                                padding: '16px',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                                    {info.icon}
                                </div>
                                <div style={{ color: info.color, fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>
                                    {info.label}
                                </div>

                                {activeRequest.status === 'accepted' && activeRequest.driver && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: '8px', marginTop: '12px',
                                        background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '8px 12px'
                                    }}>
                                        {activeRequest.driver.profile_picture ? (
                                            <img
                                                src={activeRequest.driver.profile_picture}
                                                alt=""
                                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%',
                                                background: 'rgba(251,171,21,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fbab15', fontWeight: '700'
                                            }}>
                                                {(activeRequest.driver.full_name || 'س').charAt(0)}
                                            </div>
                                        )}
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                {activeRequest.driver.full_name || activeRequest.driver.username}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                السائق المعيّن
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeRequest.status === 'pending' && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: '6px', marginTop: '8px'
                                    }}>
                                        <div className="spinner-small" style={{ borderColor: `${info.color}40`, borderTopColor: info.color }} />
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            يتم إرسال الطلب للسائقين...
                                        </span>
                                    </div>
                                )}

                                {(activeRequest.status === 'accepted' || activeRequest.status === 'arrived') && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.showTaxiRoute && activeRequest.driver && activeRequest.driver.latitude) {
                                                window.showTaxiRoute({
                                                    passengerLoc: location,
                                                    driverLoc: { lat: activeRequest.driver.latitude, lng: activeRequest.driver.longitude },
                                                    passengerName: 'أنت',
                                                    driverName: activeRequest.driver.full_name || activeRequest.driver.username
                                                });
                                                if (onClose) onClose();
                                            } else {
                                                alert('موقع السائق غير متوفر بعد');
                                            }
                                        }}
                                        style={{
                                            marginTop: '12px', width: '100%',
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: '#fff', border: 'none', borderRadius: '8px',
                                            padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit',
                                            fontSize: '0.85rem', fontWeight: 'bold', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '6px'
                                        }}
                                    >
                                        🗺️ تتبع السائق على الخريطة
                                    </button>
                                )}

                                <button
                                    onClick={cancelRequest}
                                    style={{
                                        marginTop: '12px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '8px',
                                        padding: '8px 20px',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontSize: '0.85rem',
                                        fontWeight: '600'
                                    }}
                                >
                                    ✕ إلغاء الطلب
                                </button>
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <div style={{ padding: '16px' }}>
                    {/* Active Drivers Map Preview */}
                    {liveDrivers?.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600' }}>
                                🟢 السائقون النشطون القريبون:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {liveDrivers.filter(d => d.latitude && d.longitude).map(driver => (
                                    <div
                                        key={driver.id}
                                        onClick={() => {
                                            setSelectedDriver(driver);
                                            if (onDriverSelect) onDriverSelect(driver);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 12px',
                                            background: selectedDriver?.id === driver.id
                                                ? 'rgba(251, 171, 21, 0.12)'
                                                : 'var(--bg-tertiary)',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            border: selectedDriver?.id === driver.id
                                                ? '1px solid rgba(251,171,21,0.4)'
                                                : '1px solid transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            overflow: 'hidden', flexShrink: 0,
                                            background: 'rgba(251,171,21,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {driver.profile_picture ? (
                                                <img
                                                    src={driver.profile_picture}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '1.2rem' }}>🚗</span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                                {driver.full_name || driver.username}
                                            </div>
                                            {driver.car_type && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    🚙 {driver.car_type}
                                                    {driver.plate_number && ` • ${driver.plate_number}`}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'left', flexShrink: 0 }}>
                                            {myLocation && (
                                                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>
                                                    📍 {calcDistance(myLocation.latitude, myLocation.longitude, driver.latitude, driver.longitude)}
                                                </div>
                                            )}
                                            <div style={{
                                                width: '8px', height: '8px', borderRadius: '50%',
                                                background: '#10b981',
                                                margin: '4px auto 0'
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Request Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            onClick={() => handleRequestTaxi(null, true)}
                            disabled={requesting}
                            style={{
                                width: '100%', padding: '13px',
                                background: requesting
                                    ? 'var(--bg-tertiary)'
                                    : 'linear-gradient(135deg, #fbab15, #f59e0b)',
                                color: requesting ? 'var(--text-muted)' : '#000',
                                border: 'none', borderRadius: '12px',
                                cursor: requesting ? 'not-allowed' : 'pointer',
                                fontWeight: '800', fontSize: '0.95rem',
                                fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                transition: 'all 0.3s',
                                boxShadow: requesting ? 'none' : '0 4px 12px rgba(251,171,21,0.3)'
                            }}
                        >
                            {requesting ? (
                                <>
                                    <div className="spinner-small" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }} />
                                    جاري الطلب...
                                </>
                            ) : (
                                <>
                                    🚕 طلب أقرب تاكسي
                                </>
                            )}
                        </button>

                        {selectedDriver && (
                            <button
                                onClick={() => handleRequestTaxi(selectedDriver.id)}
                                disabled={requesting}
                                style={{
                                    width: '100%', padding: '11px',
                                    background: 'rgba(251, 171, 21, 0.1)',
                                    color: '#fbab15',
                                    border: '1px solid rgba(251,171,21,0.4)',
                                    borderRadius: '12px',
                                    cursor: requesting ? 'not-allowed' : 'pointer',
                                    fontWeight: '700', fontSize: '0.9rem',
                                    fontFamily: 'inherit'
                                }}
                            >
                                طلب من {selectedDriver.full_name || selectedDriver.username} تحديداً
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaxiRequestPanel;
