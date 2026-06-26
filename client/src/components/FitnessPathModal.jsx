import React, { useState, useEffect, useRef } from 'react';
import { fitnessService, postService } from '../services/api';
import './FitnessPathModal.css';

const MET_VALUES = {
    walk: { base: 3.5, slow: 3.0, fast: 4.0 },
    run: { base: 8.0, slow: 7.0, fast: 12.0 },
    cycle: { base: 6.0, slow: 4.0, fast: 8.0 }
};

const getMetValue = (activityType, speedKmh) => {
    if (activityType === 'walk') {
        if (speedKmh < 3.0) return 2.0;
        if (speedKmh < 4.5) return 3.0;
        if (speedKmh < 5.5) return 3.5;
        if (speedKmh < 7.0) return 4.5;
        return 6.0;
    } else if (activityType === 'run') {
        if (speedKmh < 8.0) return 8.0;
        if (speedKmh < 10.0) return 9.8;
        if (speedKmh < 12.0) return 11.0;
        if (speedKmh < 14.0) return 12.5;
        if (speedKmh < 16.0) return 14.0;
        return 16.0;
    } else if (activityType === 'cycle') {
        if (speedKmh < 10.0) return 4.0;
        if (speedKmh < 15.0) return 6.0;
        if (speedKmh < 20.0) return 8.0;
        if (speedKmh < 25.0) return 10.0;
        return 12.0;
    }
    return 3.0;
};


export default function FitnessPathModal({ isOpen, onClose, onUpdateActivePath, onPublishSuccess }) {
    const [screen, setScreen] = useState('welcome'); // welcome, setup, tracking, summary, history
    const [activityType, setActivityType] = useState('run'); // walk, run, cycle
    const [weight, setWeight] = useState(75); // kg
    
    // Tracking states
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [distance, setDistance] = useState(0); // km
    const [calories, setCalories] = useState(0); // kcal
    const [currentSpeed, setCurrentSpeed] = useState(0); // km/h
    const [historyLogs, setHistoryLogs] = useState([]);
    
    // Refs for tracking data to prevent stale closures
    const pathCoordsRef = useRef([]);
    const distanceRef = useRef(0);
    const caloriesRef = useRef(0);
    const watchIdRef = useRef(null);
    const timerRef = useRef(null);
    const lastPosRef = useRef(null);

    // Dynamic Tracking Refs to prevent stale closures in setInterval
    const speedRef = useRef(0);
    const activityTypeRef = useRef(activityType);
    const weightRef = useRef(weight);
    const lastGPSUpdateRef = useRef(Date.now());

    // Keep activity type and weight refs in sync with state
    useEffect(() => {
        activityTypeRef.current = activityType;
    }, [activityType]);

    useEffect(() => {
        weightRef.current = weight;
    }, [weight]);

    // Load history on mount
    useEffect(() => {
        const stored = localStorage.getItem('palnovaa_fitness_history');
        if (stored) {
            try {
                setHistoryLogs(JSON.parse(stored));
            } catch (e) {
                setHistoryLogs([]);
            }
        }
    }, []);

    // Watch position & GPS tracking logic
    const startGPS = () => {
        if (!navigator.geolocation) {
            alert('متصفحك أو جهازك لا يدعم تحديد المواقع الجغرافية (GPS)');
            return;
        }

        lastGPSUpdateRef.current = Date.now();

        // Request permission and start watching
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, speed } = position.coords;
                
                // Filter out inaccurate readings to prevent path jittering (max 25 meters error margin)
                if (accuracy && accuracy > 25) return;

                const newCoord = [longitude, latitude];
                const now = Date.now();
                
                if (lastPosRef.current) {
                    const distDiff = calculateDistance(
                        lastPosRef.current.latitude,
                        lastPosRef.current.longitude,
                        latitude,
                        longitude
                    );

                    const timeDiffMs = now - lastPosRef.current.timestamp;
                    const timeDiffSecs = timeDiffMs / 1000;

                    // Only count movement if distance is greater than 5 meters and time elapsed is realistic
                    if (distDiff > 0.005 && timeDiffSecs > 0) {
                        const calculatedSpeedKmh = distDiff / (timeDiffMs / (1000 * 3600));
                        
                        // Speed validation to reject physical anomalies (GPS jumps)
                        const currentActType = activityTypeRef.current;
                        let isSpeedRealistic = true;
                        if (currentActType === 'walk' && calculatedSpeedKmh > 15) isSpeedRealistic = false;
                        if (currentActType === 'run' && calculatedSpeedKmh > 40) isSpeedRealistic = false;
                        if (currentActType === 'cycle' && calculatedSpeedKmh > 100) isSpeedRealistic = false;
                        
                        // Ignore speeds < 1.0 km/h to prevent GPS drift/jitter while standing still
                        const isNotDrift = calculatedSpeedKmh >= 1.0 || distDiff > 0.01;

                        if (isSpeedRealistic && isNotDrift) {
                            distanceRef.current += distDiff;
                            setDistance(Number(distanceRef.current.toFixed(2)));
                            
                            pathCoordsRef.current.push(newCoord);
                            onUpdateActivePath([...pathCoordsRef.current]);
                            
                            // Prefer device GPS speed if available, otherwise fallback to computed speed
                            let finalSpeed = 0;
                            if (speed !== null && speed !== undefined && speed >= 0) {
                                finalSpeed = speed * 3.6; // convert m/s to km/h
                            } else {
                                finalSpeed = calculatedSpeedKmh;
                            }
                            
                            // Prevent crazy speed spikes
                            if (currentActType === 'walk' && finalSpeed > 10) finalSpeed = 6;
                            if (currentActType === 'run' && finalSpeed > 28) finalSpeed = 12;
                            if (currentActType === 'cycle' && finalSpeed > 60) finalSpeed = 22;

                            speedRef.current = finalSpeed;
                            setCurrentSpeed(Number(finalSpeed.toFixed(1)));
                            
                            lastPosRef.current = { latitude, longitude, timestamp: now };
                            lastGPSUpdateRef.current = now;
                        }
                    }
                } else {
                    // First point
                    pathCoordsRef.current = [newCoord];
                    onUpdateActivePath([newCoord]);
                    lastPosRef.current = { latitude, longitude, timestamp: now };
                    lastGPSUpdateRef.current = now;
                }
            },
            (error) => {
                console.error('GPS Watch error:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 5000
            }
        );
    };

    const stopGPS = () => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        lastPosRef.current = null;
    };

    // Haversine formula to calculate distance in km
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Timer and MET-based calorie calculation loop
    useEffect(() => {
        if (isTracking && !isPaused) {
            // Start GPS watch
            startGPS();
            
            // Start 1-second timer
            timerRef.current = setInterval(() => {
                setSeconds((prev) => {
                    const newSeconds = prev + 1;
                    
                    // Stop detection: If GPS position has not updated for 4+ seconds, assume speed is 0
                    const timeSinceLastGPS = Date.now() - lastGPSUpdateRef.current;
                    if (timeSinceLastGPS > 4000) {
                        speedRef.current = 0;
                        setCurrentSpeed(0);
                    }

                    const speedVal = speedRef.current;
                    // Active calories count only when user is actually moving (speed >= 1.0 km/h)
                    const isMoving = speedVal >= 1.0;

                    if (isMoving) {
                        const currentActType = activityTypeRef.current;
                        const currentWeight = weightRef.current;

                        const met = getMetValue(currentActType, speedVal);

                        const calIncrement = met * currentWeight * (1 / 3600);
                        caloriesRef.current += calIncrement;
                        setCalories(Number(caloriesRef.current.toFixed(1)));
                    }

                    return newSeconds;
                });
            }, 1000);
        } else {
            // Pause/Stop
            clearInterval(timerRef.current);
            stopGPS();
        }

        return () => {
            clearInterval(timerRef.current);
            stopGPS();
        };
    }, [isTracking, isPaused]);

    if (!isOpen) return null;

    const resetTracking = () => {
        setIsTracking(false);
        setIsPaused(false);
        setSeconds(0);
        setDistance(0);
        setCalories(0);
        setCurrentSpeed(0);
        pathCoordsRef.current = [];
        distanceRef.current = 0;
        caloriesRef.current = 0;
        speedRef.current = 0;
        lastGPSUpdateRef.current = Date.now();
        onUpdateActivePath(null);
    };

    const handleStartTracking = () => {
        resetTracking();
        setScreen('tracking');
        setIsTracking(true);
    };

    const handlePauseToggle = () => {
        setIsPaused(!isPaused);
    };

    const handleStopTracking = () => {
        setIsTracking(false);
        setScreen('summary');
        stopGPS();
    };

    const handlePublish = async (publishToMap) => {
        const avgSpeed = seconds > 0 ? (distance / (seconds / 3600)) : 0;
        const newRun = {
            activity_type: activityType,
            duration_seconds: seconds,
            distance_km: distance,
            calories_burned: calories,
            avg_speed_kmh: Number(avgSpeed.toFixed(1)),
            path_coordinates: pathCoordsRef.current,
            created_at: new Date().toISOString()
        };

        // 1. Save locally to localStorage history anyway
        const updatedHistory = [newRun, ...historyLogs];
        setHistoryLogs(updatedHistory);
        localStorage.setItem('palnovaa_fitness_history', JSON.stringify(updatedHistory));

        // 2. Publish to backend database if user selected Publish
        if (publishToMap && pathCoordsRef.current.length > 1) {
            try {
                await fitnessService.saveRun({
                    activity_type: newRun.activity_type,
                    duration_seconds: newRun.duration_seconds,
                    distance_km: newRun.distance_km,
                    calories_burned: newRun.calories_burned,
                    avg_speed_kmh: newRun.avg_speed_kmh,
                    path_coordinates: newRun.path_coordinates
                });

                // Also publish a Post on the map with the path polyline coordinates
                const startCoord = pathCoordsRef.current[0];
                const endCoord = pathCoordsRef.current[pathCoordsRef.current.length - 1];
                const postLocation = startCoord || endCoord;

                if (postLocation) {
                    const activityNamesAr = {
                        walk: 'مشي',
                        run: 'ركض',
                        cycle: 'قيادة دراجة هوائية'
                    };
                    const emoji = activityType === 'walk' ? '🚶' : activityType === 'run' ? '🏃' : '🚴';
                    const actName = activityNamesAr[activityType] || 'تمرين رياضي';
                    const durationText = formatTime(seconds);

                    const postContent = `${emoji} لقد أكملت نشاط ${actName}!\n📏 المسافة: ${distance} كم\n⏱️ الوقت: ${durationText}\n🔥 السعرات: ${calories} kcal\n⚡ معدل السرعة: ${newRun.avg_speed_kmh} كم/س`;

                    const formData = new FormData();
                    formData.append('content', postContent);
                    formData.append('latitude', postLocation[1]); // lat
                    formData.append('longitude', postLocation[0]); // lon
                    formData.append('address', `مسار لياقة بدنية (${actName})`);
                    formData.append('path_coordinates', JSON.stringify(pathCoordsRef.current));

                    await postService.createPost(formData);
                }

                if (onPublishSuccess) {
                    onPublishSuccess();
                }
            } catch (err) {
                console.error('Failed to publish run to backend:', err);
                alert('فشل نشر المسار على قاعدة البيانات، تم حفظ التمرين محلياً فقط');
            }
        }

        // Clean active path and close modal
        onUpdateActivePath(null);
        resetTracking();
        setScreen('welcome');
        onClose();
    };

    // Format seconds to HH:MM:SS
    const formatTime = (secs) => {
        const hrs = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const scs = secs % 60;
        return [
            hrs > 0 ? String(hrs).padStart(2, '0') : null,
            String(mins).padStart(2, '0'),
            String(scs).padStart(2, '0')
        ].filter(Boolean).join(':');
    };

    const getActivityNameAr = (type) => {
        if (type === 'walk') return 'مشي';
        if (type === 'run') return 'ركض';
        return 'دراجة هوائية';
    };

    if (screen === 'tracking') {
        return (
            <div className="fitness-modal-overlay tracking-active-overlay">
                <div className="fitness-modal-container tracking-active-container">
                    <div className="fitness-tracking-topbar">
                        {/* Header Row: Controls (Left) + Activity Text + Activity Indicator (Right) */}
                        <div className="topbar-header-row">
                            <div className="topbar-left-controls">
                                <button 
                                    className={`topbar-btn ${isPaused ? 'btn-resume' : 'btn-pause'}`}
                                    onClick={handlePauseToggle}
                                    title={isPaused ? "استئناف" : "إيقاف مؤقت"}
                                >
                                    {isPaused ? (
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                    )}
                                </button>
                                <button className="topbar-btn btn-stop" onClick={handleStopTracking} title="إنهاء">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
                                </button>
                            </div>

                            <div className="topbar-title-area">
                                <span className="topbar-tracking-text">
                                    {isPaused ? "تم إيقاف التتبع" : "تتبع حركة مباشر"}
                                </span>
                            </div>

                            <div className="topbar-activity-indicator">
                                <span className="badge-pulse"></span>
                                <span className="activity-emoji font-icon">
                                    {activityType === 'walk' ? '🚶' : activityType === 'run' ? '🏃' : '🚴'}
                                </span>
                            </div>
                        </div>

                        {/* Stats Row: 4 columns in Grid */}
                        <div className="topbar-stats-row">
                            <div className="topbar-stat">
                                <span className="topbar-stat-lbl">المسافة</span>
                                <strong className="topbar-stat-val text-cyan">{distance} <span className="topbar-stat-unit">كم</span></strong>
                            </div>
                            <div className="topbar-stat">
                                <span className="topbar-stat-lbl">الوقت</span>
                                <strong className="topbar-stat-val">{formatTime(seconds)}</strong>
                            </div>
                            <div className="topbar-stat">
                                <span className="topbar-stat-lbl">السعرات</span>
                                <strong className="topbar-stat-val text-orange">{calories} <span className="topbar-stat-unit">kcal</span></strong>
                            </div>
                            <div className="topbar-stat">
                                <span className="topbar-stat-lbl">السرعة</span>
                                <strong className="topbar-stat-val text-green">{currentSpeed} <span className="topbar-stat-unit">كم/س</span></strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (screen === 'welcome') {
        return (
            <div className="fitness-modal-overlay">
                <div className="fitness-modal-container fitness-welcome-container">
                    {/* Background runner image */}
                    <div className="welcome-bg-image-wrapper">
                        <img 
                            src="/images/runner.png" 
                            alt="Runner Silhouette" 
                            className="welcome-bg-image"
                        />
                        {/* Atmospheric overlays */}
                        <div className="welcome-overlay-gradient-b" />
                        <div className="welcome-overlay-radial" />
                        {/* Neon glows */}
                        <div className="welcome-neon-glow-left" />
                        <div className="welcome-neon-glow-right" />
                    </div>

                    {/* Content */}
                    <div className="welcome-content-wrapper">
                        {/* Top bar */}
                        <header className="welcome-topbar">
                            <div className="welcome-logo-area">
                                <span className="welcome-logo-badge">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="welcome-logo-icon">
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                                    </svg>
                                </span>
                                <span className="welcome-logo-text">مسار اللياقة</span>
                            </div>
                            <button
                                type="button"
                                className="welcome-skip-btn"
                                onClick={() => { resetTracking(); onClose(); }}
                            >
                                إغلاق
                            </button>
                        </header>

                        {/* Floating stat chip */}
                        <div className="welcome-floating-chip-area">
                            <div className="welcome-floating-chip">
                                <span className="welcome-chip-pulse-dot" />
                                <span className="welcome-chip-text">تتبع مباشر للتمارين والمسارات</span>
                            </div>
                        </div>

                        {/* Spacer to push card to bottom */}
                        <div className="welcome-spacer" />

                        {/* Glass card */}
                        <div className="welcome-glass-card">
                            <p className="welcome-card-subtitle">أهلاً بك في</p>
                            <h1 className="welcome-card-title">
                                مسار اللياقة <span className="text-neon-green">المطور</span>
                            </h1>
                            <p className="welcome-card-description">
                                تتبع كل خطوة، نبضة، ومسار جري أو دراجة مباشرة على الخريطة. تحليلات ذكية تتكيف مع أداء حركتك لتدفعك للأفضل كل يوم.
                            </p>

                            {/* CTA Action Buttons */}
                            <div className="welcome-cta-buttons">
                                <button 
                                    type="button" 
                                    className="welcome-primary-cta"
                                    onClick={() => setScreen('setup')}
                                >
                                    ابدأ مسارك لصحة أفضل
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="welcome-cta-arrow">
                                        <line x1="19" y1="12" x2="5" y2="12"/>
                                        <polyline points="12 19 5 12 12 5"/>
                                    </svg>
                                </button>
                                <button 
                                    type="button" 
                                    className="welcome-secondary-cta"
                                    onClick={() => setScreen('history')}
                                >
                                    سجل الأنشطة السابقة
                                </button>
                            </div>

                            {/* Progress dots decoration */}
                            <div className="welcome-progress-dots">
                                <span className="dot-active" />
                                <span className="dot-inactive" />
                                <span className="dot-inactive" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fitness-modal-overlay">
            <div className="fitness-modal-container">
                {/* Header */}
                <div className="fitness-modal-header">
                    <h3>مسار اللياقة</h3>
                    <button className="fitness-close-btn" onClick={() => { resetTracking(); onClose(); }}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Body Content depending on Screen */}
                <div className="fitness-modal-body">
                    
                    {/* 1. WELCOME SCREEN REMOVED - NOW HANDLED EARLY */}

                    {/* 2. SETUP SCREEN */}
                    {screen === 'setup' && (
                        <div className="fitness-screen-setup">
                            <h4>اختر نوع النشاط الرياضي</h4>
                            <div className="activity-selector-grid">
                                <button 
                                    className={`activity-select-card ${activityType === 'walk' ? 'active' : ''}`}
                                    onClick={() => setActivityType('walk')}
                                >
                                    <div className="activity-icon font-icon">🚶</div>
                                    <span>مشي</span>
                                </button>
                                <button 
                                    className={`activity-select-card ${activityType === 'run' ? 'active' : ''}`}
                                    onClick={() => setActivityType('run')}
                                >
                                    <div className="activity-icon font-icon">🏃</div>
                                    <span>ركض</span>
                                </button>
                                <button 
                                    className={`activity-select-card ${activityType === 'cycle' ? 'active' : ''}`}
                                    onClick={() => setActivityType('cycle')}
                                >
                                    <div className="activity-icon font-icon">🚴</div>
                                    <span>دراجة هوائية</span>
                                </button>
                            </div>

                            <div className="weight-slider-section">
                                <div className="weight-label">
                                    <span>الوزن الحالي للمستخدم</span>
                                    <span className="weight-val">{weight} كغم</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="40" 
                                    max="150" 
                                    value={weight} 
                                    onChange={(e) => setWeight(Number(e.target.value))} 
                                    className="fitness-range-input"
                                />
                                <span className="weight-hint">تُستخدم هذه القيمة لحساب دقيق للسعرات الحركية المحروقة.</span>
                            </div>

                            <div className="fitness-action-buttons">
                                <button className="fitness-primary-btn" onClick={handleStartTracking}>
                                    بدء التتبع المباشر
                                </button>
                                <button className="fitness-secondary-btn" onClick={() => setScreen('welcome')}>
                                    رجوع
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 3. TRACKING SCREEN */}
                    {screen === 'tracking' && (
                        <div className="fitness-screen-tracking">
                            <div className="tracking-activity-badge">
                                <span className="badge-pulse"></span>
                                {activityType === 'walk' ? '🚶 مشي نشط' : activityType === 'run' ? '🏃 ركض نشط' : '🚴 قيادة الدراجة'}
                            </div>

                            {/* Dynamic stats layout */}
                            <div className="tracking-main-stats">
                                <div className="stat-box-large">
                                    <span className="stat-label">المسافة المقطوعة</span>
                                    <span className="stat-value neon-cyan">{distance}</span>
                                    <span className="stat-unit">كيلومتر</span>
                                </div>
                            </div>

                            <div className="tracking-grid-stats">
                                <div className="stat-sub-box">
                                    <span className="stat-sub-label">الوقت المنقضي</span>
                                    <span className="stat-sub-value">{formatTime(seconds)}</span>
                                </div>
                                <div className="stat-sub-box">
                                    <span className="stat-sub-label">السعرات المحروقة</span>
                                    <span className="stat-sub-value neon-orange">{calories} <span className="stat-sub-unit">kcal</span></span>
                                </div>
                                <div className="stat-sub-box">
                                    <span className="stat-sub-label">السرعة الحالية</span>
                                    <span className="stat-sub-value neon-green">{currentSpeed} <span className="stat-sub-unit">كم/س</span></span>
                                </div>
                            </div>

                            {/* Tracking Controls */}
                            <div className="tracking-controls-row">
                                <button 
                                    className={`fitness-control-btn ${isPaused ? 'btn-resume' : 'btn-pause'}`}
                                    onClick={handlePauseToggle}
                                >
                                    {isPaused ? (
                                        <>
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{marginLeft: '6px'}}><path d="M8 5v14l11-7z"/></svg>
                                            استئناف
                                        </>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{marginLeft: '6px'}}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                            إيقاف مؤقت
                                        </>
                                    )}
                                </button>
                                <button className="fitness-control-btn btn-stop" onClick={handleStopTracking}>
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{marginLeft: '6px'}}><path d="M6 6h12v12H6z"/></svg>
                                    إنهاء التمرين
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 4. SUMMARY SCREEN */}
                    {screen === 'summary' && (
                        <div className="fitness-screen-summary">
                            <div className="summary-success-icon">🏆</div>
                            <h4>ملخص مسار اللياقة الخاص بك</h4>
                            
                            <div className="summary-stats-list">
                                <div className="summary-stat-row">
                                    <span>نوع الرياضة:</span>
                                    <span className="summary-val">{getActivityNameAr(activityType)}</span>
                                </div>
                                <div className="summary-stat-row">
                                    <span>المسافة الإجمالية:</span>
                                    <span className="summary-val text-cyan">{distance} كم</span>
                                </div>
                                <div className="summary-stat-row">
                                    <span>الوقت المستغرق:</span>
                                    <span className="summary-val">{formatTime(seconds)}</span>
                                </div>
                                <div className="summary-stat-row">
                                    <span>السعرات الحرارية المحروقة:</span>
                                    <span className="summary-val text-orange">{calories} سعرة حركية</span>
                                </div>
                                <div className="summary-stat-row">
                                    <span>معدل السرعة:</span>
                                    <span className="summary-val text-green">
                                        {seconds > 0 ? (distance / (seconds / 3600)).toFixed(1) : 0} كم/ساعة
                                    </span>
                                </div>
                            </div>

                            <div className="fitness-action-buttons">
                                <button 
                                    className="fitness-primary-btn" 
                                    onClick={() => handlePublish(false)}
                                >
                                    حفظ المسار محلياً
                                </button>
                                <button className="fitness-danger-btn" onClick={() => { resetTracking(); setScreen('welcome'); }}>
                                    إلغاء وتجاهل
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 5. HISTORY SCREEN */}
                    {screen === 'history' && (
                        <div className="fitness-screen-history">
                            <h4>سجل التمارين والمسارات السابقة</h4>
                            
                            <div className="history-logs-container">
                                {historyLogs.length === 0 ? (
                                    <div className="history-empty-state">
                                        <span>📭</span>
                                        <p>لا توجد مسارات مسجلة بعد. ابدأ أول مساراتك الآن!</p>
                                    </div>
                                ) : (
                                    historyLogs.map((log, idx) => (
                                        <div className="history-log-card" key={idx}>
                                            <div className="history-card-header">
                                                <span className="history-type">
                                                    {log.activity_type === 'walk' ? '🚶 مشي' : log.activity_type === 'run' ? '🏃 ركض' : '🚴 دراجة'}
                                                </span>
                                                <span className="history-date">
                                                    {new Date(log.created_at).toLocaleDateString('ar-EG', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="history-card-stats">
                                                <div className="history-stat">
                                                    <span className="hist-label">المسافة</span>
                                                    <span className="hist-val">{log.distance_km} كم</span>
                                                </div>
                                                <div className="history-stat">
                                                    <span className="hist-label">الوقت</span>
                                                    <span className="hist-val">{formatTime(log.duration_seconds)}</span>
                                                </div>
                                                <div className="history-stat">
                                                    <span className="hist-label">السعرات</span>
                                                    <span className="hist-val text-orange">{log.calories_burned} kcal</span>
                                                </div>
                                                <div className="history-stat">
                                                    <span className="hist-label">السرعة</span>
                                                    <span className="hist-val">{log.avg_speed_kmh} كم/س</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="fitness-action-buttons">
                                <button className="fitness-secondary-btn" onClick={() => setScreen('welcome')}>
                                    رجوع للرئيسية
                                </button>
                                {historyLogs.length > 0 && (
                                    <button 
                                        className="fitness-danger-btn" 
                                        onClick={() => {
                                            if (window.confirm('هل أنت متأكد من رغبتك في مسح كل السجل المحلي؟')) {
                                                localStorage.removeItem('palnovaa_fitness_history');
                                                setHistoryLogs([]);
                                            }
                                        }}
                                    >
                                        مسح السجل بالكامل
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
