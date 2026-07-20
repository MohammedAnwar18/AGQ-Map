import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../services/api';

const MAP_STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const OrbisControlCenter = () => {
    const { user } = useAuth();
    const [isMobileConnected, setIsMobileConnected] = useState(false);
    const [liveFrame, setLiveFrame] = useState(null);
    const [detections, setDetections] = useState([]);
    const [selectedDetection, setSelectedDetection] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all');
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [stats, setStats] = useState({ cars: 0, people: 0 });
    const [loading, setLoading] = useState(true);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Map View State
    const [viewState, setViewState] = useState({
        longitude: 35.2332, // Ramallah
        latitude: 31.9522,
        zoom: 13
    });

    const socketRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        // Generate QR code pointing to the current admin dashboard URL
        QRCode.toDataURL(window.location.href)
            .then(url => setQrCodeUrl(url))
            .catch(err => console.error('Failed generating pairing QR code:', err));
    }, []);
    const API_URL = import.meta.env.VITE_API_URL || '/api';
    const SOCKET_URL = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : window.location.origin;

    // Play a synthesized control-room sound
    const playBeep = (freq = 880, duration = 0.12) => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.warn('Audio Context beep disabled/blocked:', e.message);
        }
    };

    // 1. Fetch initial historical detections
    const fetchDetections = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/orbis/detections`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.data.detections || [];
            setDetections(data);
            
            // Calculate stats
            const cars = data.filter(d => d.object_type !== 'person').length;
            const people = data.filter(d => d.object_type === 'person').length;
            setStats({ cars, people });

            // If there are detections, center map on the latest one
            if (data.length > 0) {
                setViewState(prev => ({
                    ...prev,
                    longitude: parseFloat(data[0].longitude),
                    latitude: parseFloat(data[0].latitude)
                }));
            }
        } catch (err) {
            console.error('Failed fetching Orbis detections:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetections();

        // 2. Establish Real-time Socket Synchronization
        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            upgrade: false
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('Orbis Control Center Socket connected:', socket.id);
            socket.emit('orbis-register', { userId: user.id, role: 'laptop' });
        });

        // Listen for live mobile camera frames
        socket.on('orbis-frame', (frameData) => {
            setLiveFrame(frameData);
        });

        // Listen for mobile lens state changes
        socket.on('orbis-peer-status', ({ mobileConnected }) => {
            setIsMobileConnected(mobileConnected);
            if (!mobileConnected) {
                setLiveFrame(null);
            } else {
                playBeep(600, 0.2); // Notify pairing online
            }
        });

        // Listen for new real-time database detections
        socket.on('orbis-new-detection', (event) => {
            playBeep(980, 0.15); // Trigger high-pitch detection beep
            setDetections(prev => {
                const updated = [event, ...prev];
                // Recalculate stats
                const cars = updated.filter(d => d.object_type !== 'person').length;
                const people = updated.filter(d => d.object_type === 'person').length;
                setStats({ cars, people });
                return updated;
            });

            // Center map on the new real-time detection
            setViewState(prev => ({
                ...prev,
                longitude: parseFloat(event.longitude),
                latitude: parseFloat(event.latitude),
                zoom: 15
            }));
        });

        return () => {
            if (socket) socket.disconnect();
        };
    }, []);

    // Filter detections locally based on tab
    const filteredDetections = useMemo(() => {
        if (activeFilter === 'all') return detections;
        return detections.filter(d => d.object_type === activeFilter);
    }, [detections, activeFilter]);

    // Locate item on Map
    const handleLocateOnMap = (det) => {
        setSelectedDetection(det);
        setViewState(prev => ({
            ...prev,
            longitude: parseFloat(det.longitude),
            latitude: parseFloat(det.latitude),
            zoom: 17
        }));
    };

    return (
        <div className="orbis-control-center" style={{
            display: 'flex',
            height: 'calc(100vh - 220px)',
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
            gap: '20px',
            color: '#f1f5f9'
        }}>
            {/* Left Panel: Stats and Detections Logs */}
            <div style={{
                width: '450px',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(15, 23, 42, 0.45)',
                backdropFilter: 'blur(30px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden'
            }}>
                {/* Header & Status Indicator */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(9, 13, 22, 0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: '900', color: '#fbab15' }}>
                            🛰️ PalNovaa Orbis
                        </h2>
                        <button 
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '18px'
                            }}
                            title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
                        >
                            {soundEnabled ? '🔊' : '🔇'}
                        </button>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: isMobileConnected ? '#10b981' : '#64748b',
                                boxShadow: isMobileConnected ? '0 0 10px #10b981' : 'none'
                            }}></span>
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                                {isMobileConnected ? 'العدسة المحمولة متصلة' : 'في انتظار اتصال الهاتف...'}
                            </span>
                        </div>
                        {!isMobileConnected && (
                            <span style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                background: 'rgba(255, 255, 255, 0.05)',
                                padding: '3px 8px',
                                borderRadius: '8px'
                            }}>قم بتسجيل الدخول من الهاتف</span>
                        )}
                    </div>
                </div>

                {/* Stats Dashboard */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '1.25rem',
                    background: 'rgba(0, 0, 0, 0.15)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <div style={{
                        padding: '15px',
                        background: 'rgba(251, 171, 21, 0.05)',
                        border: '1px solid rgba(251, 171, 21, 0.15)',
                        borderRadius: '16px',
                        textAlign: 'center'
                    }}>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#94a3b8' }}>إجمالي المركبات</h4>
                        <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fbab15' }}>{stats.cars}</p>
                    </div>
                    <div style={{
                        padding: '15px',
                        background: 'rgba(168, 85, 247, 0.05)',
                        border: '1px solid rgba(168, 85, 247, 0.15)',
                        borderRadius: '16px',
                        textAlign: 'center'
                    }}>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#94a3b8' }}>إجمالي الأشخاص</h4>
                        <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>{stats.people}</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.2)',
                    padding: '6px',
                    margin: '10px 15px',
                    borderRadius: '12px'
                }}>
                    {['all', 'car', 'person'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            style={{
                                flex: 1,
                                background: activeFilter === filter ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                color: activeFilter === filter ? '#fff' : '#94a3b8',
                                border: 'none',
                                padding: '8px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                        >
                            {filter === 'all' ? 'الكل' : filter === 'car' ? 'السيارات' : 'الأشخاص'}
                        </button>
                    ))}
                </div>

                {/* Detections List */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0 1.25rem 1.25rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '14px' }}>
                            جاري تحميل سجل الرصد...
                        </div>
                    ) : filteredDetections.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '13px' }}>
                            لا توجد بيانات مسجلة حالياً
                        </div>
                    ) : (
                        filteredDetections.map((det) => {
                            const isPerson = det.object_type === 'person';
                            const badgeColor = isPerson ? '#a855f7' : '#3b82f6';
                            const badgeBg = isPerson ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)';
                            
                            return (
                                <div 
                                    key={det.id}
                                    style={{
                                        padding: '12px',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 255, 255, 0.04)',
                                        borderRadius: '18px',
                                        display: 'flex',
                                        gap: '12px',
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleLocateOnMap(det)}
                                >
                                    {/* Event Image */}
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '12px',
                                        overflow: 'hidden',
                                        backgroundColor: '#000',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        flexShrink: 0
                                    }}>
                                        <img 
                                            src={getImageUrl(det.image_url) || 'https://via.placeholder.com/80?text=No+Image'} 
                                            alt={det.object_type}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>

                                    {/* Event Details */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{
                                                    fontSize: '11px',
                                                    padding: '2px 8px',
                                                    borderRadius: '8px',
                                                    fontWeight: 'bold',
                                                    color: badgeColor,
                                                    background: badgeBg,
                                                    border: `1px solid ${badgeColor}30`
                                                }}>
                                                    {isPerson ? 'إنسان' : 'مركبة'}
                                                </span>
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                                    {new Date(det.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>

                                            {/* Metadata items */}
                                            {isPerson ? (
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                    الحركة: {det.metadata?.direction || 'ثابت'} | اللون: {det.metadata?.colors?.[0] || 'غير محدد'}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                    النوع: {det.metadata?.model || 'غير معروف'} <br />
                                                    اللوحة: <strong style={{ color: '#fbab15' }}>{det.metadata?.license_plate || 'غير مسجلة'}</strong>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: '#fbab15' }}>
                                            📍 عرض على الخريطة
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Panel: WebGIS Map & Live PiP Stream */}
            <div style={{
                flex: 1,
                position: 'relative',
                borderRadius: '24px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: 'var(--card-shadow)'
            }}>
                {/* Floating QR Pairing Guide Card */}
                {!isMobileConnected && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '380px',
                        background: 'rgba(9, 13, 22, 0.95)',
                        backdropFilter: 'blur(30px)',
                        border: '1px solid rgba(251, 171, 21, 0.2)',
                        borderRadius: '24px',
                        padding: '24px',
                        zIndex: 100,
                        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.7)',
                        textAlign: 'center',
                        fontFamily: 'Tajawal, sans-serif'
                    }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#fbab15', fontSize: '18px', fontWeight: '900' }}>
                            🔗 ربط عدسة الهاتف المحمول
                        </h3>
                        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
                            للبدء برصد المركبات والناس، افتح حساب الأدمن من هاتفك الذكي وتوجه لنفس التبويب لتفعيل الكاميرا.
                        </p>

                        {/* QR Code Container */}
                        {qrCodeUrl ? (
                            <div style={{
                                background: '#fff',
                                padding: '12px',
                                borderRadius: '16px',
                                display: 'inline-block',
                                marginBottom: '20px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                            }}>
                                <img src={qrCodeUrl} alt="QR Code" style={{ width: '150px', height: '150px', display: 'block' }} />
                            </div>
                        ) : (
                            <div style={{ padding: '40px 0', color: '#94a3b8', fontSize: '12px' }}>جاري إنشاء رمز الاستجابة...</div>
                        )}

                        <div style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '14px',
                            padding: '12px',
                            fontSize: '12px',
                            color: '#e2e8f0',
                            textAlign: 'right',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div><strong>1.</strong> تأكد من اتصال الهاتف واللابتوب بـ <strong>نفس شبكة الـ Wi-Fi</strong>.</div>
                            <div><strong>2.</strong> امسح الرمز أعلاه بكاميرا الهاتف لفتح الرابط مباشرة.</div>
                            {isLocalhost && (
                                <div style={{ color: '#fbab15', fontSize: '11px', borderTop: '1px solid rgba(251, 171, 21, 0.1)', paddingTop: '6px', marginTop: '4px' }}>
                                    ⚠️ <strong>تنبيه localhost:</strong> يفضل فتح الموقع من اللابتوب باستخدام آي بي الشبكة (مثل <code>http://192.168.1.X:5173/admin</code>) قبل مسح الرمز.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <Map
                    ref={mapRef}
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    mapStyle={MAP_STYLE_URL}
                    style={{ width: '100%', height: '100%' }}
                >
                    <NavigationControl position="top-right" />

                    {/* Detections Markers */}
                    {detections.map((det) => {
                        const isPerson = det.object_type === 'person';
                        const markerColor = isPerson ? '#a855f7' : '#fbab15';
                        return (
                            <Marker
                                key={det.id}
                                longitude={parseFloat(det.longitude)}
                                latitude={parseFloat(det.latitude)}
                                onClick={(e) => {
                                    e.originalEvent.stopPropagation();
                                    setSelectedDetection(det);
                                }}
                            >
                                <div style={{
                                    width: '14px',
                                    height: '14px',
                                    backgroundColor: markerColor,
                                    borderRadius: '50%',
                                    border: '2px solid #fff',
                                    cursor: 'pointer',
                                    boxShadow: `0 0 10px ${markerColor}`
                                }} />
                            </Marker>
                        );
                    })}

                    {/* Popups */}
                    {selectedDetection && (
                        <Popup
                            longitude={parseFloat(selectedDetection.longitude)}
                            latitude={parseFloat(selectedDetection.latitude)}
                            anchor="bottom"
                            onClose={() => setSelectedDetection(null)}
                            closeButton={true}
                            closeOnClick={false}
                        >
                            <div style={{
                                color: '#0f172a',
                                width: '220px',
                                fontFamily: 'Tajawal, sans-serif',
                                direction: 'rtl'
                            }}>
                                <div style={{
                                    height: '110px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    backgroundColor: '#000',
                                    marginBottom: '8px'
                                }}>
                                    <img 
                                        src={getImageUrl(selectedDetection.image_url)} 
                                        alt={selectedDetection.object_type}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 'bold' }}>
                                    {selectedDetection.object_type === 'person' ? '👤 إنسان مرصود' : '🚗 مركبة مرصودة'}
                                </h4>
                                <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748b' }}>
                                    رصد في: {new Date(selectedDetection.timestamp).toLocaleTimeString('ar-EG')}
                                </p>
                                <div style={{ fontSize: '11px', color: '#334155', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                                    {selectedDetection.object_type === 'person' ? (
                                        <>
                                            <strong>الحركة:</strong> {selectedDetection.metadata?.direction || 'ثابت'}<br />
                                            <strong>اللون الأساسي:</strong> {selectedDetection.metadata?.colors?.[0] || 'غير محدد'}
                                        </>
                                    ) : (
                                        <>
                                            <strong>الطراز:</strong> {selectedDetection.metadata?.model || 'غير معروف'}<br />
                                            <strong>رقم اللوحة:</strong> <span style={{ color: '#d97706', fontWeight: 'bold' }}>{selectedDetection.metadata?.license_plate || 'غير معروف'}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    )}
                </Map>

                {/* Picture-in-Picture Remote Camera Window */}
                <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: '24px',
                    width: '280px',
                    height: '210px',
                    background: 'rgba(9, 13, 22, 0.85)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 10,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                }}>
                    <div style={{
                        padding: '8px 12px',
                        background: 'rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fbab15' }}>📹 بث عدسة الهاتف المباشر</span>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: liveFrame ? '#10b981' : '#ef4444',
                            display: 'inline-block'
                        }}></span>
                    </div>
                    <div style={{
                        flex: 1,
                        backgroundColor: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}>
                        {liveFrame ? (
                            <img 
                                src={liveFrame} 
                                alt="Live Stream" 
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            <div style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>
                                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📡</span>
                                <span style={{ fontSize: '11px' }}>في انتظار بث الكاميرا...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrbisControlCenter;
