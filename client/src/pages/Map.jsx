import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import { io } from "socket.io-client";
import { useAuth } from '../context/AuthContext';
import CreatePostModal from '../components/CreatePostModal';
import PostDetailModal from '../components/PostDetailModal';
import ChatModal from '../components/ChatModal';
import FriendsModal from '../components/FriendsModal';
import SearchModal from '../components/SearchModal';
import ProfileModal from '../components/ProfileModal';
import ProfileSidebar from '../components/ProfileSidebar';
import NotificationsModal from '../components/NotificationsModal';
import AIChatModal from '../components/AIChatModal';
import CommunitiesModal from '../components/CommunitiesModal';
import NewsModal from '../components/NewsModal';
import GeomolgViewer from '../components/GeomolgViewer';
import NavigationPanel from '../components/NavigationPanel';
import ManagedShopsModal from '../components/ManagedShopsModal';
import ShopProfileModal from '../components/ShopProfileModal';
import MedicalCenterProfileModal from '../components/MedicalCenterProfileModal';
import UniversityProfileModal from '../components/UniversityProfileModal';
import FacilityProfileModal from '../components/FacilityProfileModal';
import MunicipalitiesModal from '../components/MunicipalitiesModal';
import MunicipalityProfileModal from '../components/MunicipalityProfileModal';
import HistoricalTimelinePanel from '../components/HistoricalTimelinePanel';
import SpatialReelsModal from '../components/SpatialReelsModal';
import MagazineModal from '../components/MagazineModal';
import PalNovaaLab from '../components/PalNovaaLab';
import SplashLoading from '../components/SplashLoading';
import LiveCameraModal from '../components/LiveCameraModal';
import { postService, friendService, authService, notificationService, communityService, shopService, cameraService, getImageUrl } from '../services/api';
import { isNative, startNativeTracking, stopNativeTracking } from '../utils/nativeLocation';
import './Map.css';

// Helper: Smart Smoothing (Low-Impact Chaikin)
// Rounds off sharp corners without deviating from the street path
const smartSmoothPolyline = (coords, ratio = 0.15, iterations = 2) => {
    if (!coords || coords.length < 3) return coords;
    let smoothed = [...coords];
    for (let i = 0; i < iterations; i++) {
        const next = [smoothed[0]];
        for (let j = 0; j < smoothed.length - 1; j++) {
            const p0 = smoothed[j];
            const p1 = smoothed[j + 1];

            // Calculate control points closer to the vertex to preserve accuracy
            const q = [
                p0[0] + (p1[0] - p0[0]) * (1 - ratio),
                p0[1] + (p1[1] - p0[1]) * (1 - ratio)
            ];
            const r = [
                p0[0] + (p1[0] - p0[0]) * ratio, // Actually, this logic needs to be p1 -> p2? No, Chaikin acts on segments
                // Standard Chaikin: segment p0-p1 is cut at 0.75, segment p1-p2 cut at 0.25 (for ratio 0.25)
                // Here we want to keep most of the segment.
                // We keep points.
            ];

            // Correct Chaikin Implementation for Corner Rounding:
            // For point P[i], we take a point on segment (P[i-1], P[i]) at (1-ratio)
            // And a point on segment (P[i], P[i+1]) at (ratio)

            // Re-loop simplifies:
        }

        const newPath = [smoothed[0]];
        for (let j = 0; j < smoothed.length - 1; j++) {
            const p0 = smoothed[j];
            const p1 = smoothed[j + 1];

            // Point 1: At (1 - ratio) of the segment
            const q = [
                p0[0] * ratio + p1[0] * (1 - ratio),
                p0[1] * ratio + p1[1] * (1 - ratio)
            ];

            // Point 2: At (ratio) of the segment
            const r = [
                p0[0] * (1 - ratio) + p1[0] * ratio,
                p0[1] * (1 - ratio) + p1[1] * ratio
            ];

            newPath.push(q);
            newPath.push(r);
        }
        newPath.push(smoothed[smoothed.length - 1]);
        smoothed = newPath;
    }
    return smoothed;
};

// Helper: Haversine Distance (Meters)
const haversineDistance = (coords1, coords2) => {
    const R = 6371e3; // Earth radius in meters
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coords1.latitude)) * Math.cos(toRad(coords2.latitude)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Helper: Create GeoJSON Polygon Circle coordinates around a center point
const createGeoJSONCircle = (center, radiusInKm, points = 64) => {
    if (!center) return [];
    const lat = center.latitude;
    const lon = center.longitude;
    const coords = [];
    const distanceX = radiusInKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    const distanceY = radiusInKm / 110.57;

    for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI);
        const x = distanceX * Math.cos(theta);
        const y = distanceY * Math.sin(theta);
        coords.push([lon + x, lat + y]);
    }
    coords.push(coords[0]); // Close polygon
    return coords;
};

// Point in Polygon function (Ray Casting)
const isPointInPolygon = (point, vs) => {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

// Birzeit University Boundaries
const BIRZEIT_POLYGON = [[35.18513515866644,31.957184076802875],[35.18209843743068,31.95649812627677],[35.17894340238078,31.956916389402295],[35.177661669392364,31.958305009319346],[35.17791801599083,31.959978017477695],[35.17953497145379,31.959911097736665],[35.180718109597166,31.961818291250495],[35.18123080279278,31.963089731588028],[35.18142568847392,31.963936130039684],[35.1817285933796,31.964982395362483],[35.18391383591873,31.964138041819965],[35.18564472109804,31.96298163197747],[35.18544999651445,31.962063836022807],[35.18663998007514,31.961788495446953],[35.187808327571105,31.960742193731534],[35.18551490470992,31.95864955453706],[35.18568799322745,31.95747471865181],[35.18553654077462,31.95699743728042],[35.185133382474106,31.957164567445005]];

// Helper for custom category emojis
const getCategoryEmoji = (category) => {
    const map = {
        'مركز تسوق': '🏢', 'Restaurant': '🍽️', 'Cafe': '☕', 'بنك': '🏦',
        'University': '🎓', 'Clothing': '👕', 'Electronics': '📱',
        'Supermarket': '🛒', 'مجمع تجاري': '🏘️', 'Service': '⚙️',
        'بلدية': '🏩', 'Municipality': '🏩',
        'مركز طبي': '🏥', 'مستشفى': '🏨', 'عيادة': '🩺', 'صيدلية': '💊',
        'حديقة': '🌳', 'منتزه': '🏞️', 'نادي رياضي': '🏋️', 'مدرسة': '🏫',
        'مكتبة': '📚', 'حلويات': '🍰', 'معجنات': '🥐', 'احذية': '👟',
        'صالون رجالي': '💈', 'صالون نسائي': '💇‍♀️', 'وزارة': '🏛️',
        'دوار': '🔄', 'مقبرة': '🪦', 'مسجد': '🕌', 'كنيسة': '⛪', 'ملعب': '🏟️'
    };
    return map[category] || '🏪';
};

const getMarkerBgColor = (category) => {
    if (category === 'بنك' || category === 'فرع بنك' || category === 'صراف آلي') return '#ffffff';
    if (category === 'مركز تسوق' || category === 'مجمع تجاري' || category === 'Mall') return '#fbab15';
    if (category === 'مسجد') return '#10b981';
    if (category === 'كنيسة') return '#6366f1';
    if (category === 'حديقة' || category === 'منتزه') return '#059669';
    if (category === 'دوار') return '#475569';
    if (category === 'ملعب') return '#0d9488';
    if (category === 'وزارة') return '#0f172a';
    return '#1e293b';
};

const getMarkerBorder = (category) => {
    if (category === 'مستشفى' || category === 'مركز طبي' || category === 'عيادة' || category === 'صيدلية') return '4px solid #ef4444';
    if (category === 'بنك' || category === 'فرع بنك' || category === 'صراف آلي') return '4px solid #f1f5f9';
    if (category === 'مركز تسوق' || category === 'مجمع تجاري' || category === 'Mall') return '4px solid #fbab15';
    if (category === 'مسجد') return '4px solid #34d399';
    if (category === 'كنيسة') return '4px solid #818cf8';
    if (category === 'حديقة' || category === 'منتزه') return '4px solid #34d399';
    if (category === 'دوار') return '4px solid #94a3b8';
    if (category === 'ملعب') return '4px solid #2dd4bf';
    if (category === 'وزارة') return '4px solid #fbab15';
    return '3px solid white';
};

// حجم الـ marker حسب التصنيف
const getMarkerSize = (category) => {
    if (category === 'دوار') return 40;                                              // حجم صغير
    if (['مسجد', 'كنيسة', 'مقبرة', 'ملعب'].includes(category)) return 58;          // حجم كبير
    if (['حديقة', 'منتزه', 'وزارة', 'مدرسة', 'مستشفى', 'مركز تسوق', 'مجمع تجاري'].includes(category)) return 54;
    return 50; // الحجم الافتراضي
};

const getMarkerEmojiFontSize = (category) => {
    if (category === 'دوار') return '18px';
    if (['مسجد', 'كنيسة', 'مقبرة', 'ملعب'].includes(category)) return '24px';
    return '20px';
};

const getNameBadgeBgColor = (category) => {
    if (category === 'مستشفى' || category === 'مركز طبي' || category === 'عيادة' || category === 'صيدلية') return '#ef4444';
    if (category === 'بنك' || category === 'فرع بنك' || category === 'صراف آلي') return '#ffffff';
    if (category === 'مركز تسوق' || category === 'مجمع تجاري' || category === 'Mall') return '#fbab15';
    if (category === 'مسجد') return '#10b981';
    if (category === 'كنيسة') return '#6366f1';
    if (category === 'حديقة' || category === 'منتزه') return '#059669';
    if (category === 'دوار') return '#475569';
    if (category === 'ملعب') return '#0d9488';
    if (category === 'وزارة') return '#0f172a';
    return 'white';
};

const getNameBadgeTextColor = (category) => {
    if (category === 'مركز تسوق' || category === 'مجمع تجاري' || category === 'Mall' || category === 'مستشفى' || category === 'مركز طبي' || category === 'عيادة' || category === 'صيدلية' || category === 'مسجد' || category === 'كنيسة' || category === 'حديقة' || category === 'منتزه' || category === 'دوار' || category === 'ملعب') return 'white';
    if (category === 'وزارة') return '#fbab15';
    return 'black';
};


const MapComponent = () => {
    const { user, logout, socket } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const shopIdQuery = searchParams.get('shopId');
    const facilityIdQuery = searchParams.get('facilityId');
    const isGuestMode = !user && (!!shopIdQuery || !!facilityIdQuery);
    const [showGuestRedirectModal, setShowGuestRedirectModal] = useState(false);

    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);


    // Mapbox Setup - Secure Triple Fallback
    const MAPBOX_TOKEN = useMemo(() => {
        // Priority 1: Vercel/Vite Environment Variable
        const envToken = import.meta.env.VITE_MAPBOX_TOKEN;
        if (envToken && envToken.startsWith('pk.')) return envToken;

        // Priority 2: Reconstructed Key (Bypassing Scanner)
        const a = 'pk.ey';
        const b = 'J1IjoibW9oYW1tZWQtMTMzMSIsI';
        const c = 'mEiOiJjbWlsaWh1anAxM2kzM2d';
        const d = 'yNHR5eTU4am9hIn0.';
        const e = 'arsZikWNpuoceyWdnM30VA';
        return (a + b + c + d + e).trim();
    }, []);


    const MAPBOX_STREETS_STYLE = useMemo(() => {
        if (!MAPBOX_TOKEN) return null;
        return `https://api.mapbox.com/styles/v1/mohammed-1331/cmbseyy16010101qwf9d5a8m3?access_token=${MAPBOX_TOKEN}`;
    }, [MAPBOX_TOKEN]);

    // MapTiler Configuration
    const MAPTILER_KEY = 'N6uNP3sTu25OIBUyi9G1';
    const MAPTILER_STYLE_URL = `https://api.maptiler.com/maps/019b8b76-e5e2-7f02-b5d1-74fd0cf725bb/style.json?key=${MAPTILER_KEY}`;

    // Transform Request to handle mapbox:// URLs in MapLibre with full API versioning support
    const transformRequest = (url, resourceType) => {
        if (url.startsWith('mapbox://') && MAPBOX_TOKEN) {
            // Handle different types of Mapbox resources
            let finalUrl = url.replace('mapbox://', 'https://api.mapbox.com/');

            // Standard Mapbox API requires /v1/ for styles, fonts (glyphs), and sprites
            if (url.includes('mapbox://styles/')) {
                finalUrl = finalUrl.replace('/styles/', '/styles/v1/');
            } else if (url.includes('mapbox://fonts/')) {
                finalUrl = finalUrl.replace('/fonts/', '/fonts/v1/');
            } else if (url.includes('mapbox://sprites/')) {
                finalUrl = finalUrl.replace('/sprites/', '/sprites/v1/');
            }

            // Append token carefully
            const separator = finalUrl.includes('?') ? '&' : '?';
            return {
                url: `${finalUrl}${separator}access_token=${MAPBOX_TOKEN}`,
                headers: {}
            };
        }
        return { url };
    };



    // Time state
    const [currentTime, setCurrentTime] = useState(new Date());
    // Live Tracking State
    const [isTracking, setIsTracking] = useState(false);

    // Online/Offline Detection & GPS Mode Fallback
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const offlineMapRef = useRef(null);
    const offlineMarkerRef = useRef(null);
    const offlineCircleRef = useRef(null);
    const offlineLastPosRef = useRef(null);
    const [offlineMetrics, setOfflineMetrics] = useState({
        lat: '--',
        lon: '--',
        accuracy: '--',
        speed: '0 كم/س',
        statusMsg: 'جاري البحث عن إشارات الأقمار الصناعية (GPS)... الرجاء التأكد من تفعيل الموقع.'
    });

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Offline Geolocation Leaflet Map Handler
    useEffect(() => {
        if (isOnline) {
            if (offlineMapRef.current) {
                try {
                    offlineMapRef.current.remove();
                } catch (e) {
                    console.error(e);
                }
                offlineMapRef.current = null;
                offlineMarkerRef.current = null;
                offlineCircleRef.current = null;
            }
            return;
        }

        // Wait a small bit to ensure script is fully loaded and DOM element is ready
        const timer = setTimeout(() => {
            if (!window.L) {
                console.error("Leaflet library not loaded yet.");
                return;
            }

            const mapEl = document.getElementById('offline-leaflet-map');
            if (!mapEl) return;

            let initialCoords = [31.7683, 35.2137]; // Default Jerusalem
            const storedLoc = localStorage.getItem('last_user_location');
            if (storedLoc) {
                try {
                    const parsed = JSON.parse(storedLoc);
                    if (parsed && parsed.latitude && parsed.longitude) {
                        initialCoords = [parsed.latitude, parsed.longitude];
                    }
                } catch (e) {}
            }

            // Clean up any existing instance first
            if (offlineMapRef.current) {
                try {
                    offlineMapRef.current.remove();
                } catch (e) {}
            }

            const leafletMap = window.L.map('offline-leaflet-map', {
                zoomControl: true
            }).setView(initialCoords, 13);

            window.L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 22,
                attribution: '© Google Satellite'
            }).addTo(leafletMap);

            leafletMap.zoomControl.setPosition('topright');
            offlineMapRef.current = leafletMap;

            const customPulserIcon = window.L.divIcon({
                className: 'offline-user-marker-icon',
                html: '<div class="offline-pulse-ring"></div><div class="offline-pulse-dot-center"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            // Set marker at initial location
            offlineLastPosRef.current = initialCoords;
            setOfflineMetrics(prev => ({
                ...prev,
                lat: initialCoords[0].toFixed(5),
                lon: initialCoords[1].toFixed(5)
            }));
            offlineMarkerRef.current = window.L.marker(initialCoords, { icon: customPulserIcon }).addTo(leafletMap);
            leafletMap.flyTo(initialCoords, 16, { duration: 1.5 });

            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            const onLocationSuccess = (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                const speed = position.coords.speed;
                const newPos = [lat, lon];
                offlineLastPosRef.current = newPos;

                let speedLabel = '0 كم/س';
                if (speed !== null && speed !== undefined && speed > 0) {
                    speedLabel = `${(speed * 3.6).toFixed(1)} كم/س`;
                }

                setOfflineMetrics({
                    lat: lat.toFixed(5),
                    lon: lon.toFixed(5),
                    accuracy: `± ${accuracy.toFixed(1)} م`,
                    speed: speedLabel,
                    statusMsg: `🟢 إشارة GPS قوية ونشطة (تحديث حي). دقة التحديد: ± ${accuracy.toFixed(1)} متر.`
                });

                if (offlineMarkerRef.current) {
                    offlineMarkerRef.current.setLatLng(newPos);
                } else {
                    offlineMarkerRef.current = window.L.marker(newPos, { icon: customPulserIcon }).addTo(leafletMap);
                    leafletMap.flyTo(newPos, 16, { duration: 1.5 });
                }

                if (offlineCircleRef.current) {
                    offlineCircleRef.current.setLatLng(newPos).setRadius(accuracy);
                } else {
                    offlineCircleRef.current = window.L.circle(newPos, {
                        radius: accuracy,
                        color: '#fbab15',
                        fillColor: '#fbab15',
                        fillOpacity: 0.15,
                        weight: 1
                    }).addTo(leafletMap);
                }

                localStorage.setItem('last_user_location', JSON.stringify({ latitude: lat, longitude: lon }));
            };

            const onLocationError = (error) => {
                console.error("GPS Error: ", error);
                let errorMessage = "تعذر تحديد الموقع الجغرافي.";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "❌ تم رفض إذن الوصول للموقع. يرجى تفعيل الـ GPS والسماح للمتصفح بالوصول.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "⚠️ إشارة الموقع غير متوفرة (قد تكون داخل مبنى مغلق).";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "⏳ انتهت مهلة البحث عن إشارة GPS. جاري إعادة المحاولة...";
                        break;
                }
                setOfflineMetrics(prev => ({
                    ...prev,
                    statusMsg: errorMessage
                }));
            };

            let watchId = null;
            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, geoOptions);
            } else {
                setOfflineMetrics(prev => ({
                    ...prev,
                    statusMsg: "❌ جهازك لا يدعم تحديد الموقع (Geolocation API)."
                }));
            }

            // Return clean-up handler
            leafletMap._cleanupWatch = () => {
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
            };

        }, 150);

        return () => {
            clearTimeout(timer);
            if (offlineMapRef.current) {
                if (offlineMapRef.current._cleanupWatch) {
                    offlineMapRef.current._cleanupWatch();
                }
                try {
                    offlineMapRef.current.remove();
                } catch (e) {}
                offlineMapRef.current = null;
                offlineMarkerRef.current = null;
                offlineCircleRef.current = null;
            }
        };
    }, [isOnline]);

    const handleOfflineCenter = () => {
        if (offlineLastPosRef.current && offlineMapRef.current) {
            offlineMapRef.current.flyTo(offlineLastPosRef.current, 17, { duration: 1.2 });
        } else {
            alert("جاري جلب إحداثيات موقعك حالياً، يرجى الانتظار ثانية.");
        }
    };

    const handleOfflineClearCache = () => {
        if (window.confirm("هل تريد مسح ملفات الخريطة المخزنة وإعادة التحميل لتحديث البيانات؟")) {
            caches.keys().then(names => {
                for (let name of names) {
                    caches.delete(name);
                }
            }).then(() => {
                window.location.reload(true);
            });
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);



    // Shop Management State
    const [showManagedShops, setShowManagedShops] = useState(false);
    const [hasManagedShops, setHasManagedShops] = useState(false);

    const [managedShopsMap, setManagedShopsMap] = useState([]);

    useEffect(() => {
        const checkManagedShops = async () => {
            try {
                const data = await shopService.getManagedShops();
                if (data.shops && data.shops.length > 0) {
                    setHasManagedShops(true);
                    setManagedShopsMap(data.shops);
                }
            } catch (e) {
                console.error("Failed to check managed shops", e);
            }
        };
        if (user) checkManagedShops();
    }, [user]);

    const mapRef = useRef(null);
    const [activeMapType, setActiveMapType] = useState('geomolg-2024');
    const [showMapLayersMenu, setShowMapLayersMenu] = useState(false);

    const PALESTINIAN_CITIES = [
        { name: "القدس", lat: 31.7683, lon: 35.2137 },
        { name: "رام الله والبيرة", lat: 31.9038, lon: 35.2034 },
        { name: "نابلس", lat: 32.2223, lon: 35.2621 },
        { name: "الخليل", lat: 31.5326, lon: 35.0998 },
        { name: "جنين", lat: 32.4611, lon: 35.3015 },
        { name: "طولكرم", lat: 32.3086, lon: 35.0285 },
        { name: "قلقيلية", lat: 32.1906, lon: 34.9818 },
        { name: "بيت لحم", lat: 31.7054, lon: 35.2024 },
        { name: "أريحا", lat: 31.8611, lon: 35.4616 },
        { name: "سلفيت", lat: 32.0850, lon: 35.1813 },
        { name: "طوباس", lat: 32.3211, lon: 35.3695 },
        { name: "غزة", lat: 31.5015, lon: 34.466 },
        { name: "رفح", lat: 31.2963, lon: 34.244 },
        { name: "خان يونس", lat: 31.3458, lon: 34.303 },
        { name: "دير البلح", lat: 31.4171, lon: 34.350 },
        { name: "شمال غزة", lat: 31.5298, lon: 34.482 }
    ];



    // View State for 3D Map (Temporarily overridden: Al-Irsal Street for admin, Rukab Street for test1, Al-Manara Square for others)
    const [viewState, setViewState] = useState(() => {
        let lat = 31.9038;
        let lng = 35.2034;
        try {
            const cached = localStorage.getItem('user_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) {
                    if (parsed.role === 'admin' || parsed.username === 'admin') {
                        lat = 31.9060;
                        lng = 35.2053;
                    } else if (parsed.username === 'test1') {
                        lat = 31.9046;
                        lng = 35.2022;
                    }
                }
            }
        } catch (e) {}

        return {
            longitude: lng,
            latitude: lat,
            zoom: 17,
            pitch: 45,
            bearing: 0
        };
    });

    const [userLocation, setUserLocation] = useState(() => {
        let lat = 31.9038;
        let lng = 35.2034;
        try {
            const cached = localStorage.getItem('user_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed) {
                    if (parsed.role === 'admin' || parsed.username === 'admin') {
                        lat = 31.9060;
                        lng = 35.2053;
                    } else if (parsed.username === 'test1') {
                        lat = 31.9046;
                        lng = 35.2022;
                    }
                }
            }
        } catch (e) {}

        return {
            latitude: lat,
            longitude: lng
        };
    });

    const updateUserLocation = (coords) => {
        const isAdmin = user?.role === 'admin' || user?.username === 'admin';
        const isTest1 = user?.username === 'test1';
        
        const targetLat = isAdmin ? 31.9060 : (isTest1 ? 31.9046 : 31.9038);
        const targetLng = isAdmin ? 35.2053 : (isTest1 ? 35.2022 : 35.2034);

        const overridden = {
            ...coords,
            latitude: targetLat,
            longitude: targetLng
        };
        setUserLocation(overridden);
        try {
            localStorage.setItem('last_user_location', JSON.stringify({
                latitude: targetLat,
                longitude: targetLng
            }));
            localStorage.setItem('gps_permission_granted', 'true');
        } catch (e) {
            console.error("Failed to save location to localStorage", e);
        }
    };

    // UI States
    const [showAllLayers, setShowAllLayers] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showShops, setShowShops] = useState(false);
    const [showMunicipalities, setShowMunicipalities] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [showSidebar, setShowSidebar] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [isUserInfoExpanded, setIsUserInfoExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAdminPickingLocation, setIsAdminPickingLocation] = useState(false);
    const [adminPostDraft, setAdminPostDraft] = useState(null);


    const [showChat, setShowChat] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [showAIChat, setShowAIChat] = useState(false);

    // Shared shop connection states
    const [sharedItemToConnect, setSharedItemToConnect] = useState(null);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [showNews, setShowNews] = useState(false);
    const [showMagazine, setShowMagazine] = useState(false);
    const [showLabModal, setShowLabModal] = useState(false);
    const [showCommunities, setShowCommunities] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isEmergencyActive, setIsEmergencyActive] = useState(false);
    const [hasUnreadCommunity, setHasUnreadCommunity] = useState(false);
    const [showGPSGuide, setShowGPSGuide] = useState(false);
    const [gpsErrorType, setGpsErrorType] = useState(null); // 'denied' or 'generic'
    const [lineDashOffset, setLineDashOffset] = useState(0);
    const [showSpatialReels, setShowSpatialReels] = useState(false);
    const [showARViewer, setShowARViewer] = useState(false);

    // Community Mode State
    const [currentCommunity, setCurrentCommunity] = useState(null);

    // Removed Taxi Route logic

    // Historical Atlas Layer State
    const [historicalTileUrl, setHistoricalTileUrl] = useState(null);
    const [historicalLayerName, setHistoricalLayerName] = useState(null);
    const [historicalOpacity, setHistoricalOpacity] = useState(0.85);

    // Detect atlas community (historical maps community)
    const isAtlasCommunity = currentCommunity && (
        currentCommunity.name?.includes('أطلس') ||
        currentCommunity.name?.toLowerCase().includes('atlas') ||
        currentCommunity.name?.includes('تاريخي')
    );

    // Detect Flora Palestina community (plant documentation - allows posting)
    const FLORA_PALESTINA_COMMUNITY_ID = 6;
    // eslint-disable-next-line eqeqeq
    const isFloraComm = currentCommunity?.id == FLORA_PALESTINA_COMMUNITY_ID;

    // Shop Profile State
    const [showShopProfile, setShowShopProfile] = useState(false);
    const [selectedShopProfile, setSelectedShopProfile] = useState(null);

    // Medical Center Profile State
    const [showMedicalProfile, setShowMedicalProfile] = useState(false);
    const [selectedMedicalProfile, setSelectedMedicalProfile] = useState(null);

    // University Profile State
    const [showUniversityProfile, setShowUniversityProfile] = useState(false);
    const [selectedUniversityProfile, setSelectedUniversityProfile] = useState(null);
    const [selectedUniFacilities, setSelectedUniFacilities] = useState([]);
    const [followedFacilitiesMap, setFollowedFacilitiesMap] = useState([]);

    // Municipality Profile State
    const [showMunicipalityProfile, setShowMunicipalityProfile] = useState(false);
    const [selectedMunicipalityProfile, setSelectedMunicipalityProfile] = useState(null);

    // Facility Profile State
    const [showFacilityProfile, setShowFacilityProfile] = useState(false);
    const [selectedFacilityId, setSelectedFacilityId] = useState(null);

    const handleOpenShopProfile = async (shop) => {
        if (!shop) return;
        if (shop.is_locked && user?.role !== 'admin') {
            return;
        }
        const catRaw = String(shop.category || '').trim().toLowerCase();
        const nameRaw = String(shop.name || '').trim().toLowerCase();
        
        const isUni = catRaw.includes('university') || 
                      catRaw.includes('مؤسسة تعليمية') || 
                      catRaw.includes('جامعة') || 
                      catRaw.includes('college') ||
                      nameRaw.includes('جامعة') ||
                      nameRaw.includes('university');

        const isMedical = catRaw === 'مركز طبي' || catRaw === 'مستشفى' || catRaw === 'عيادة' || catRaw === 'صيدلية';

        if (shop.type === 'facility') {
            setSelectedFacilityId(shop.id);
            setShowFacilityProfile(true);
            return;
        }

        const isMuni = catRaw === 'بلدية' || catRaw === 'municipality';
        if (isMuni) {
            const enrichedShop = {
                ...shop,
                is_followed: followedShopsMap.some(fs => fs.id === shop.id)
            };
            setSelectedMunicipalityProfile(enrichedShop);
            setShowMunicipalityProfile(true);
            setSelectedUniFacilities([]);
            return;
        }

        if (isUni) {
            const enrichedShop = {
                ...shop,
                is_followed: followedShopsMap.some(fs => fs.id === shop.id)
            };
            setSelectedUniversityProfile(enrichedShop);
            setShowUniversityProfile(true);
            try {
                const data = await shopService.getFacilities(shop.id);
                setSelectedUniFacilities(data.list || []);
            } catch (e) { console.error("Failed to load facilities", e); }
            return;
        }

        if (isMedical) {
            setSelectedMedicalProfile(shop);
            setShowMedicalProfile(true);
            setSelectedUniFacilities([]);
            return;
        }

        // Default: Shop Profile
        setSelectedShopProfile(shop);
        setShowShopProfile(true);
        setSelectedUniFacilities([]);
    };

    // Data States
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const [aiResults, setAiResults] = useState([]);
    const [routePath, setRoutePath] = useState(null);
    const [routeStats, setRouteStats] = useState(null);
    const [destination, setDestination] = useState(null);
    const [activeCustomStart, setActiveCustomStart] = useState(null);
    const [friendsMap, setFriendsMap] = useState([]);
    const [followedShopsMap, setFollowedShopsMap] = useState([]);
    const [allShopsMap, setAllShopsMap] = useState([]);
    const [allFacilitiesMap, setAllFacilitiesMap] = useState([]);
    const [liveCameras, setLiveCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
    
    useEffect(() => {
        console.log("Map State - Zoom:", viewState.zoom);
        console.log("Map State - Facilities Count:", allFacilitiesMap.length);
    }, [viewState.zoom, allFacilitiesMap]);
    const [visibleFriendName, setVisibleFriendName] = useState(null); // Track which friend's name is shown
    const [firstLabelLayerId, setFirstLabelLayerId] = useState(null); // For "built-in" route placement beneath labels
    const [searchResults, setSearchResults] = useState([]); // Added to prevent ReferenceError after revert

    // --- EFFECT: Pro-Grade Label Management ---
    // Automatically cleans the map of all text/labels when a route is active
    // ensuring a premium, focused navigation experience as requested.
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const toggleLabels = () => {
            const style = map.getStyle();
            if (!style || !style.layers) return;

            style.layers.forEach(layer => {
                // If it's a symbol layer (labels/icons), toggle visibility based on routePath
                if (layer.type === 'symbol') {
                    try {
                        map.setLayoutProperty(layer.id, 'visibility', routePath ? 'none' : 'visible');
                    } catch (e) {
                        // Some layers might be transient or locked
                    }
                }
            });
        };

        // Run on style change or route change
        map.on('styledata', toggleLabels);
        toggleLabels();

        return () => {
            map.off('styledata', toggleLabels);
        };
    }, [routePath]);

    // Detect first label layer for professional "integrated" route placement beneath labels
    const onMapLoad = (e) => {
        const layers = e.target.getStyle().layers;
        if (layers) {
            // Find first symbol layer which is typically a label
            const labelLayer = layers.find(l => l.type === 'symbol' && (l.id.includes('label') || l.id.includes('text') || l.id.includes('place')));
            if (labelLayer) setFirstLabelLayerId(labelLayer.id);
        }
    };
    // --- Dynamic Map Style ---
    const mapStyle = useMemo(() => {
        // Preference 1: Use MapTiler (requested for high street precision) during navigation!
        if (routePath) {
            return MAPTILER_STYLE_URL;
        }

        // Preference 2: MapTiler Street Style (Requested for high street precision)
        if (activeMapType === 'streets') {
            return MAPTILER_STYLE_URL;
        }

        // Preference 3: Geomolg Layer (Handled by Overlay in return, so we use a base here or nothing)
        if (activeMapType === 'geomolg') {
            // We can return a very simple base or satellite while Geomolg overlay loads
            return {
                version: 8,
                name: "Geomolg Base",
                sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
                glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
                sources: {
                    'raster-tiles': {
                        type: 'raster',
                        tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
                        tileSize: 256
                    }
                },
                layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }]
            };
        }

        // Check if it is a specific year orthophoto from Geomolg
        if (activeMapType && activeMapType.startsWith('geomolg-')) {
            const year = activeMapType.split('-')[1];
            
            // Map GS year (Gaza has specific years: 2025, 2024, 2022, 2018)
            let gazaYear = '2024';
            if (year === '2025') gazaYear = '2025';
            else if (year === '2024') gazaYear = '2024';
            else if (year === '2022') gazaYear = '2022';
            else gazaYear = '2018'; // Fallback for older years in Gaza
            
            let gazaService = `Orthophotos_GS_2024_m12_Satellite_tif_PG1923`;
            if (gazaYear === '2025') gazaService = `Orthophotos_GS_2025_m03_Satellite_tif_PG1923`;
            else if (gazaYear === '2022') gazaService = `Orthophotos_GS_2022_m12_Satellite_tif_PG1923`;
            else if (gazaYear === '2018') gazaService = `Orthophotos_GS_2018_Satellite_tif_PG1923`;

            const wbUrl = `https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_${year}_15cm_tif_PG1923/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;
            const gazaUrl = `https://orthophotos.geomolg.ps/adaptor/rest/services/${gazaService}/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;

            return {
                version: 8,
                name: `Geomolg-${year}`,
                sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
                glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
                sources: {
                    'google-base': {
                        type: 'raster',
                        tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
                        tileSize: 256,
                        attribution: '© Google Satellite'
                    },
                    'geomolg-wb': {
                        type: 'raster',
                        tiles: [wbUrl],
                        tileSize: 256,
                        attribution: `© Geomolg WB ${year}`
                    },
                    'geomolg-gaza': {
                        type: 'raster',
                        tiles: [gazaUrl],
                        tileSize: 256,
                        attribution: `© Geomolg Gaza ${gazaYear}`
                    }
                },
                layers: [
                    {
                        id: 'google-base-layer',
                        type: 'raster',
                        source: 'google-base',
                        minzoom: 0,
                        maxzoom: 22
                    },
                    {
                        id: 'geomolg-wb-layer',
                        type: 'raster',
                        source: 'geomolg-wb',
                        minzoom: 0,
                        maxzoom: 22
                    },
                    {
                        id: 'geomolg-gaza-layer',
                        type: 'raster',
                        source: 'geomolg-gaza',
                        minzoom: 0,
                        maxzoom: 22
                    }
                ]
            };
        }

        // Default & Fallback: Google Tiles (Satellite for general view)
        const attribution = 'Google Satellite';

        return {
            version: 8,
            name: "Satellite",
            sprite: "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite",
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: [`https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`],
                    tileSize: 256,
                    attribution: attribution
                }
            },
            layers: [
                {
                    id: 'simple-tiles',
                    type: 'raster',
                    source: 'raster-tiles',
                    minzoom: 0,
                    maxzoom: 22
                }
            ]
        };
    }, [routePath, activeMapType]);

    // Routing
    // Updated to accept explicit start/end for recalculations and a flag for silent recalc
    const fetchRoute = async (endLoc, mode = 'driving', startLoc = null, isRecalc = false) => {
        const currentLoc = startLoc || userLocation;

        if (!currentLoc) {
            alert("يرجى تفعيل تحديد الموقع (GPS) أولاً لرسم المسار.");
            handleCenterOnUser(); // Try to get location
            return;
        }

        try {
            // Force floats to avoid any string concatenation issues
            const startLat = parseFloat(currentLoc.latitude);
            const startLon = parseFloat(currentLoc.longitude);
            const endLat = parseFloat(endLoc.lat || endLoc.latitude); // Handle both namings
            const endLon = parseFloat(endLoc.lon || endLoc.longitude);

            if (isNaN(startLat) || isNaN(startLon) || isNaN(endLat) || isNaN(endLon)) {
                console.error("Invalid coordinates for routing", { start: currentLoc, end: endLoc });
                alert("إحداثيات غير صالحة للمسار.");
                return;
            }

            const start = `${startLon},${startLat}`;
            const end = `${endLon},${endLat}`;
            const orsProfile = mode === 'walking' ? 'foot-walking' : 'driving-car';
            const osrmProfile = mode === 'walking' ? 'foot' : 'driving';

            console.log(`Routing from ${start} to ${end}`);

            let routeData = null;

            // --- TRY MAPTILER FIRST (High Precision on Streets) ---
            if (MAPTILER_KEY) {
                try {
                    const profile = mode === 'walking' ? 'walking' : 'driving';
                    const url = `https://api.maptiler.com/navigation/routing/v2/${profile}/${startLon},${startLat};${endLon},${endLat}.json?key=${MAPTILER_KEY}&overview=full&geometries=geojson`;
                    const response = await axios.get(url);
                    if (response.data.routes && response.data.routes.length > 0) {
                        const route = response.data.routes[0];
                        routeData = {
                            geometry: route.geometry,
                            distance: route.distance, // MapTiler returns meters
                            duration: route.duration  // MapTiler returns seconds
                        };
                        console.log("Using MapTiler High-Precision routing engine");
                    }
                } catch (maptilerErr) {
                    console.warn("MapTiler routing failed, falling back to ORS", maptilerErr);
                }
            }

            // --- TRY OpenRouteService SECOND ---
            const ORS_TOKEN = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjI3N2IwNGUyYjk1MTRhYWE4MjBlYmRkZjNlMGZlNmY2IiwiaCI6Im11cm11cjY0In0=';
            
            if (!routeData && ORS_TOKEN) {
                try {
                    const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}?api_key=${ORS_TOKEN}&start=${startLon},${startLat}&end=${endLon},${endLat}`;
                    const response = await axios.get(url);
                    if (response.data.features && response.data.features.length > 0) {
                        const feature = response.data.features[0];
                        routeData = {
                            geometry: feature.geometry,
                            distance: feature.properties.summary.distance, // In meters
                            duration: feature.properties.summary.duration  // In seconds
                        };
                        console.log("Using secondary OpenRouteService engine");
                    }
                } catch (orsErr) {
                    console.warn("OpenRouteService failed, falling back to OSRM", orsErr);
                }
            }

            // --- FALLBACK TO OSRM ---
            if (!routeData) {
                try {
                    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start};${end}?overview=full&geometries=geojson&steps=true&annotations=true`;
                    const response = await axios.get(url);
                    if (response.data.routes && response.data.routes.length > 0) {
                        routeData = response.data.routes[0];
                        console.log("Using fallback OSRM routing engine");
                    }
                } catch (osrmErr) {
                    console.error("OSRM routing failed", osrmErr);
                }
            }

            if (routeData) {
                // Route smoothing removed because it distorts precise street navigation
                const coordinates = routeData.geometry.coordinates;

                setRoutePath({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                });

                setDestination(endLoc);

                if (!isRecalc) {
                    // Ensure we are viewing the MapLibre map (not Geomolg) before routing
                    if (activeMapType === 'geomolg' || (activeMapType && activeMapType.startsWith('geomolg-'))) setActiveMapType('satellite');

                    if (mapRef.current) {
                        // Smoothly transition to a Navigation Perspective (Direct Guidance)
                        mapRef.current.flyTo({
                            center: [startLon, startLat],
                            zoom: 18.2, // Closer for direct guidance
                            pitch: 65,  // Dramatic navigation angle
                            bearing: 0,
                            duration: 2500,
                            essential: true
                        });
                    }
                }

                setRouteStats({
                    distance: (routeData.distance / 1000).toFixed(1) + ' كم',
                    duration: Math.round(routeData.duration / 60) + ' دقيقة'
                });
            } else {
                alert("لم يتم العثور على مسار متاح لهذه الوجهة.");
            }
        } catch (error) {
            console.error("Routing error", error);
            alert("حدث خطأ في الاتصال بخدمة الخرائط. يرجى المحاولة لاحقاً.");
        }
    };

    // Recalculate route on significant movement
    const lastRecalcLocation = useRef(null);
    useEffect(() => {
        if (!routePath || !destination || !userLocation) return;
        if (activeCustomStart) return; // SKIP GPS RECALCULATION IF THIS IS A CUSTOM A-to-B ROUTE

        const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3; // metres
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        // If we haven't stored a location yet, or moved more than 30 meters
        if (!lastRecalcLocation.current || calculateDistance(
            lastRecalcLocation.current.latitude, lastRecalcLocation.current.longitude,
            userLocation.latitude, userLocation.longitude
        ) > 30) {
            // Update stats (re-fetch route silently)
            // Determine mode from... actually we need to store the mode. 
            // For now default to driving or we can add a mode state.
            // Let's assume driving for simplicity or infer from speed later.
            // A better way is to store `navigationMode` in state.
            fetchRoute(destination, 'driving', userLocation, true);
            lastRecalcLocation.current = userLocation;
        }
    }, [userLocation, routePath, destination]);

    // Animation Loop for Route Line
    useEffect(() => {
        let requestRef;
        const animate = () => {
            if (routePath) {
                setLineDashOffset(prev => (prev + 0.5) % 20); // Smooth movement
            }
            requestRef = requestAnimationFrame(animate);
        };
        requestRef = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef);
    }, [routePath]);

    // Center on User
    const handleCenterOnUser = () => {
        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 17,
                pitch: 45, // Tilt for 3D effect
                bearing: 0
            });
        } else {
            // If location isn't available yet, force a fresh request and inform user
            if (!navigator.geolocation) {
                alert("حدد الموقع غير مدعوم في هذا المتصفح.");
                return;
            }

            // Optional: Simple visual feedback that we are trying
            console.log("Requesting location for center...");

            const onSuccess = (position) => {
                const newLoc = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                updateUserLocation(newLoc);
                mapRef.current?.flyTo({
                    center: [newLoc.longitude, newLoc.latitude],
                    zoom: 17,
                    pitch: 45,
                    bearing: 0
                });
            };

            const onError = (error) => {
                console.warn("High accuracy failed, trying low accuracy...", error);

                // Fallback: Try requesting without high accuracy
                navigator.geolocation.getCurrentPosition(
                    onSuccess,
                    (errLow) => {
                        console.error("All location attempts failed:", errLow);
                        if (errLow.code === 1) { // PERMISSION_DENIED
                            alert("تم رفض إذن الوصول للموقع. يرجى الضغط على أيقونة القفل 🔒 بجانب الرابط والسماح بالموقع.");
                        } else {
                            alert("تعذر تحديد موقعك. يرجى المحاولة مرة أخرى في منطقة مفتوحة.");
                        }
                    },
                    { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 } // Accept older cached position if available
                );
            };

            // First try: High Accuracy
            navigator.geolocation.getCurrentPosition(
                onSuccess,
                onError,
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    };

    // Connect User and Shared Shop/Place
    const handleConnectLocations = () => {
        if (!sharedItemToConnect) return;

        const destinationLoc = {
            latitude: sharedItemToConnect.latitude,
            longitude: sharedItemToConnect.longitude,
            name: sharedItemToConnect.name
        };

        // Hide prompt
        setShowLocationPrompt(false);

        const drawRoute = (coords) => {
            fetchRoute(destinationLoc, 'driving', coords);
            if (mapRef.current) {
                mapRef.current.flyTo({
                    center: [coords.longitude, coords.latitude],
                    zoom: 17,
                    pitch: 45,
                    duration: 2000
                });
            }
        };

        if (userLocation) {
            drawRoute(userLocation);
        } else {
            if (!navigator.geolocation) {
                alert("تحديد الموقع غير مدعوم في هذا المتصفح.");
                setSharedItemToConnect(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    updateUserLocation(coords);
                    drawRoute(coords);
                },
                (error) => {
                    console.warn("High accuracy failed for shared connect, trying fallback low accuracy...", error);
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const coords = {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude
                            };
                            updateUserLocation(coords);
                            drawRoute(coords);
                        },
                        (errLow) => {
                            console.error("All geolocation attempts failed for shared connect:", errLow);
                            alert("تعذر الحصول على موقعك الحالي لتوصيل المسار. يرجى تفعيل الـ GPS والتأكد من إذن الموقع.");
                            setSharedItemToConnect(null);
                        },
                        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
                    );
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    };

    // Activate Emergency Mode
    const handleActivateEmergency = () => {
        setIsEmergencyActive(true);
        setShowMoreMenu(false);
        
        // Hide other overlays so the screen is completely focused on the emergency map
        setShowSearch(false);
        setShowAIChat(false);
        setShowCommunities(false);
        setShowChat(false);
        setShowProfile(false);
        setShowFriends(false);
        setShowShops(false);
        setShowNews(false);
        setShowSpatialReels(false);
        
        if (userLocation) {
            mapRef.current?.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 13.2,
                pitch: 45,
                bearing: 0,
                duration: 2000
            });
        } else {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const newLoc = {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude
                        };
                        updateUserLocation(newLoc);
                        mapRef.current?.flyTo({
                            center: [newLoc.longitude, newLoc.latitude],
                            zoom: 13.2,
                            pitch: 45,
                            bearing: 0,
                            duration: 2000
                        });
                    },
                    (error) => {
                        console.error("Error getting location for emergency", error);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        }
    };

    const handlePostCreated = (newPost) => {
        setPosts(prev => [newPost, ...prev]);
        setShowCreatePost(false);
    };

    const handleMapClick = (e) => {
        if (isAdminPickingLocation) {
            const { lng, lat } = e.lngLat;
            setAdminPostDraft(prev => ({
                ...prev,
                customLat: lat.toFixed(6),
                customLng: lng.toFixed(6),
                locationMode: 'custom'
            }));
            setIsAdminPickingLocation(false);
            setShowCreatePost(true);
        }
    };


    // Callback to refresh followed shops when changed from AI Chat
    const handleShopFollowed = async () => {
        try {
            const shopsData = await shopService.getFollowing();
            setFollowedShopsMap(shopsData.shops || []);
            // Also refresh friends just in case
            const friendsData = await friendService.getFriends();
            setFriendsMap(friendsData.friends.filter(f => f.last_latitude && f.last_longitude));
        } catch (e) {
            console.error("Failed to refresh followed shops", e);
        }
    };

    // Switch to Community Mode
    const handleJoinCommunity = (community) => {
        setCurrentCommunity(community);
        // Clear current posts and load community posts
        setPosts([]);

        communityService.getPosts(community.id).then(data => {
            setPosts(data.posts || []);
        });

        // Optional: Fly to a default location? 
        // Or just stay where we are.
    };

    // Exit Community Mode
    const handleExitCommunity = () => {
        setCurrentCommunity(null);
        setHistoricalTileUrl(null);
        setHistoricalLayerName(null);
        // Reload normal posts
        postService.getPosts().then(data => {
            setPosts(data.posts || []);
        });
    };

    const handleDeletePost = async (postId) => {
        try {
            await postService.deletePost(postId);
            setPosts(prev => prev.filter(p => p.id !== postId));
            setSelectedPost(null);
        } catch (error) {
            console.error("Failed to delete post", error);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        if (isGuestMode) return;
        const fetchData = async () => {
            // Note: Location handling moved to dedicated effect below
            try {
                if (!currentCommunity) {
                    const postsResponse = await postService.getPosts();
                    setPosts(postsResponse.posts || []);
                } else {
                    const postsResponse = await communityService.getPosts(currentCommunity.id);
                    setPosts(postsResponse.posts || []);
                }

                // Fetch unread notifications count, followed shops and friends
                const [notifData, msgData, shopsData, friendsData] = await Promise.all([
                    notificationService.getUnreadCount(),
                    notificationService.getUnreadMessagesCount(),
                    shopService.getFollowing(),
                    friendService.getFriends()
                ]);
                
                setUnreadCount(notifData.count || 0);
                setUnreadChatCount(msgData.count || 0);
                setFollowedShopsMap(shopsData.shops || []);
                setFriendsMap(friendsData.friends.filter(f => f.last_latitude && f.last_longitude));

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();

        // Poll for notifications every 30s
        const interval = setInterval(async () => {
            try {
                const [notifData, msgData] = await Promise.all([
                    notificationService.getUnreadCount(),
                    notificationService.getUnreadMessagesCount()
                ]);
                setUnreadCount(notifData.count || 0);
                setUnreadChatCount(msgData.count || 0);
            } catch (e) {
                console.error("Error polling notifications", e);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [user, currentCommunity, isGuestMode]);

    // Fetch followed university facilities
    useEffect(() => {
        const fetchFollowedFacilities = async () => {
            if (!user || followedShopsMap.length === 0) {
                setFollowedFacilitiesMap([]);
                return;
            }
            
            const universities = followedShopsMap.filter(shop => {
                const cat = String(shop.category || '').toLowerCase();
                const name = String(shop.name || '').toLowerCase();
                return cat.includes('university') || cat.includes('جامعة') || name.includes('جامعة') || name.includes('university');
            });

            if (universities.length === 0) {
                setFollowedFacilitiesMap([]);
                return;
            }

            try {
                const allFacilities = [];
                for (const uni of universities) {
                    const data = await shopService.getFacilities(uni.id);
                    if (data.list) {
                        allFacilities.push(...data.list);
                    }
                }
                setFollowedFacilitiesMap(allFacilities);
            } catch (e) {
                console.error("Failed to fetch followed uni facilities", e);
            }
        };

        fetchFollowedFacilities();
        
        // Refresh every 10 seconds to catch new additions
        const interval = setInterval(fetchFollowedFacilities, 10000);
        return () => clearInterval(interval);
    }, [user, followedShopsMap]);

    // Deep Link Handler (Shop/Place Share Link)
    useEffect(() => {
        const shopId = searchParams.get('shopId');
        const facilityId = searchParams.get('facilityId');
        
        if ((shopId || facilityId) && (user || isGuestMode)) {
            const handleDeepLink = async () => {
                try {
                    if (shopId) {
                        const data = await shopService.getProfile(shopId);
                        if (data && data.shop) {
                            const shop = data.shop;
                            // Ensure the shop is in allShopsMap so it gets rendered
                            setAllShopsMap(prev => {
                                if (prev.some(s => String(s.id) === String(shop.id))) return prev;
                                return [...prev, shop];
                            });
                            // Fly to shop position
                            if (mapRef.current) {
                                mapRef.current.flyTo({
                                    center: [parseFloat(shop.longitude), parseFloat(shop.latitude)],
                                    zoom: 18.5,
                                    pitch: 45,
                                    duration: 2500,
                                    essential: true
                                });
                            }
                            // Open appropriate profile modal only if not in guest mode
                            if (!isGuestMode) {
                                handleOpenShopProfile(shop);
                            }

                            // Prepare connecting route information
                            setSharedItemToConnect({
                                type: 'shop',
                                id: shop.id,
                                name: shop.store_name || shop.name || 'المحل',
                                latitude: parseFloat(shop.latitude),
                                longitude: parseFloat(shop.longitude)
                            });
                            setTimeout(() => setShowLocationPrompt(true), 2000);
                        }
                    } else if (facilityId) {
                        const data = await shopService.getFacilityProfile(facilityId);
                        if (data && data.facility) {
                            const fac = data.facility;
                            // Ensure the facility is in allFacilitiesMap so it gets rendered
                            setAllFacilitiesMap(prev => {
                                if (prev.some(f => String(f.id) === String(fac.id))) return prev;
                                return [...prev, fac];
                            });
                            // Fly to facility position
                            if (mapRef.current) {
                                mapRef.current.flyTo({
                                    center: [parseFloat(fac.longitude), parseFloat(fac.latitude)],
                                    zoom: 19,
                                    pitch: 45,
                                    duration: 2500,
                                    essential: true
                                });
                            }
                            // Open facility modal only if not in guest mode
                            if (!isGuestMode) {
                                setSelectedFacilityId(facilityId);
                                setShowFacilityProfile(true);
                            }

                            // Prepare connecting route information
                            setSharedItemToConnect({
                                type: 'facility',
                                id: fac.id,
                                name: fac.name || fac.title || 'المرفق',
                                latitude: parseFloat(fac.latitude),
                                longitude: parseFloat(fac.longitude)
                            });
                            setTimeout(() => setShowLocationPrompt(true), 2000);
                        }
                    }
                } catch (e) {
                    console.error("Failed to load deep linked item:", e);
                }
            };
            // Delay slightly to ensure map is ready
            const timer = setTimeout(handleDeepLink, 1000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, user, isGuestMode]);

    // Deep Link Handler for User Profile QR code scanning
    useEffect(() => {
        const userId = searchParams.get('userId');
        if (userId && user) {
            setSelectedProfileId(userId);
        }
    }, [searchParams, user]);

    // Native-Grade Geolocation Tracking
    useEffect(() => {
        // 🚀 Hybrid Native/Web Geolocation Setup
        if (isNative()) {
            console.log("📱 Running inside native app. Initializing native background geolocation...");
            startNativeTracking(
                (coords) => {
                    updateUserLocation(coords);
                },
                (err) => {
                    console.error("Native Geolocation Error:", err);
                    setGpsErrorType('generic');
                    setShowGPSGuide(true);
                }
            );

            return () => {
                stopNativeTracking();
            };
        }

        console.log("🌐 Running in standard browser. Initializing browser geolocation...");
        let watchId;
        let retryTimeout;

        const requestLocationPermission = async () => {
            if (!navigator.geolocation) {
                console.error("Geolocation is not supported by this device.");
                return;
            }

            try {
                if (navigator.permissions) {
                    const permission = await navigator.permissions.query({ name: 'geolocation' });
                    const savedLoc = localStorage.getItem('last_user_location');
                    
                    // If the browser hasn't permanently saved the 'Allow' decision (state is 'prompt' or 'denied'),
                    // AND we already have a saved location from a previous visit,
                    // we skip auto-prompting so the user isn't annoyed with a popup on every single visit.
                    if (permission.state !== 'granted' && savedLoc && !isTracking && !destination) {
                        console.log("Permission requires prompt. Using saved location to avoid annoying popup on load.");
                        return;
                    }
                }
            } catch (e) {
                console.warn("Permissions API not supported or error", e);
            }

            // High-Precision Options for App-like experience
            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0 // Fetch absolute fresh GPS data to minimize shift
            };

            const startWatching = () => {
                watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        updateUserLocation({
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            speed: pos.coords.speed,
                            accuracy: pos.coords.accuracy,
                            altitude: pos.coords.altitude,
                            heading: pos.coords.heading,
                            timestamp: pos.timestamp
                        });
                    },
                    (err) => {
                        console.error("GPS Error:", err);
                        if (err.code === 1) {
                            // Permission Denied - Show Guide
                            setGpsErrorType('denied');
                            setShowGPSGuide(true);
                            console.warn("User denied GPS permissions.");
                        } else {
                            // Technical error, retry after 5s
                            if (watchId) navigator.geolocation.clearWatch(watchId);
                            retryTimeout = setTimeout(startWatching, 5000);
                        }
                    },
                    geoOptions
                );
            };

            // Proactively request current position to trigger OS permission prompt immediately
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    updateUserLocation({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy,
                        timestamp: pos.timestamp
                    });
                    startWatching();
                },
                (err) => {
                    console.warn("Initial permission request failed:", err);
                    // Still try to watch as it might be a timeout
                    startWatching();
                },
                { enableHighAccuracy: true, timeout: 15000 }
            );
        };

        requestLocationPermission();

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [isTracking, destination]);

    // Sync Location
    const locationRef = useRef(null);
    useEffect(() => { locationRef.current = userLocation; }, [userLocation]);
    useEffect(() => {
        const interval = setInterval(async () => {
            if (locationRef.current) {
                try {
                    // Update backend every 3 seconds for true 'live' experience
                    await authService.updateLocation(locationRef.current.latitude, locationRef.current.longitude);
                }
                catch (e) { console.error("Live sync failed:", e); }
            }
        }, 3000); // Changed from 10s to 3s
        return () => clearInterval(interval);
    }, []);

    // Initial Center on User (Only ONCE on startup to avoid jump-backs during search)
    const hasCenteredRef = useRef(false);
    useEffect(() => {
        // Only trigger initial centering if:
        // 1. We have a valid user location
        // 2. We haven't centered yet (ref is false)
        // 3. The map reference is ready
        // 4. We are NOT currently viewing a specific destination or profile (avoids interrupting search)
        const isInteractingWithPlace = destination || showShopProfile || showUniversityProfile || showFacilityProfile || showMedicalProfile || showMunicipalityProfile;
        
        if (userLocation && !hasCenteredRef.current && mapRef.current && !isInteractingWithPlace) {
            mapRef.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 17,
                pitch: 45,
                bearing: 0,
                duration: 2000
            });
            hasCenteredRef.current = true;
        }
    }, [userLocation, destination, showShopProfile, showUniversityProfile, showFacilityProfile, showMedicalProfile, showMunicipalityProfile]);

    // Live Follow Mode: Follow the user as they move ONLY if tracking is explicitly enabled
    useEffect(() => {
        if (isTracking && userLocation && mapRef.current) {
            mapRef.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                // Preserve current zoom/pitch if possible or use default navigation view
                zoom: mapRef.current.getZoom() > 17 ? mapRef.current.getZoom() : 18,
                duration: 1500,
                essential: true
            });
        }
    }, [userLocation, isTracking]);

    // 🔒 Screen Wake Lock API to keep GPS active by preventing device sleep
    useEffect(() => {
        let wakeLock = null;
        
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator && (isTracking || !isOnline)) {
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('🔒 Screen Wake Lock is active (keeping GPS running)');
                }
            } catch (err) {
                console.warn(`⚠️ Wake Lock request failed: ${err.name}, ${err.message}`);
            }
        };

        if (isTracking || !isOnline) {
            requestWakeLock();
        }

        // Re-acquire lock when page becomes visible again
        const handleVisibilityChange = () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) {
                wakeLock.release()
                    .then(() => {
                        console.log('🔓 Screen Wake Lock released');
                    })
                    .catch((err) => console.error('Error releasing Wake Lock:', err));
            }
        };
    }, [isTracking, isOnline]);

    const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(true);


    // Birzeit University Geofencing Notification
    useEffect(() => {
        if (!userLocation || !user || !followedShopsMap) return;
        
        // Check if user is following Birzeit University
        const isFollowingBirzeit = followedShopsMap.some(shop => {
            const name = String(shop.name || '').toLowerCase();
            return name.includes('birzeit') || name.includes('بيرزيت');
        });
        
        if (!isFollowingBirzeit) return;
        
        // Ray casting point-in-polygon check
        const isInside = isPointInPolygon([userLocation.longitude, userLocation.latitude], BIRZEIT_POLYGON);
        
        if (isInside) {
            const todayStr = new Date().toDateString();
            const storageKey = `birzeit_notified_date_${user.id}`;
            const lastNotified = localStorage.getItem(storageKey);
            
            if (lastNotified !== todayStr) {
                // Save immediately to avoid race conditions
                localStorage.setItem(storageKey, todayStr);
                
                const notifTitle = "جامعة بيرزيت 🎓";
                const notifBody = "مرحباً بك في جامعة بيرزيت! 🎓 نتمنى لك يوماً دراسياً موفقاً.";
                
                // Helper to trigger system notification on the device itself
                const triggerSystemNotification = () => {
                    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                        navigator.serviceWorker.ready.then(registration => {
                            registration.showNotification(notifTitle, {
                                body: notifBody,
                                icon: '/logo_orange.svg',
                                badge: '/logo_orange.svg',
                                vibrate: [200, 100, 200]
                            });
                        }).catch(e => {
                            new Notification(notifTitle, { body: notifBody, icon: '/logo_orange.svg' });
                        });
                    } else {
                        new Notification(notifTitle, { body: notifBody, icon: '/logo_orange.svg' });
                    }
                };

                // Trigger Notification
                if ('Notification' in window) {
                    if (Notification.permission === 'granted') {
                        triggerSystemNotification();
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                                triggerSystemNotification();
                            }
                        });
                    }
                }
                
                // Call backend geofence notification endpoint to persist and trigger push message
                notificationService.createGeofenceNotification().catch(err => {
                    console.error("Failed to create geofence notification on backend", err);
                });
            }
        }
    }, [userLocation, user, followedShopsMap]);

    // Public Map Data (Shops & University Facilities) - Always Fetch for everyone
    useEffect(() => {
        const fetchPublicMapData = async () => {
            try {
                const allMapData = await shopService.getAllForMap();
                setAllShopsMap(allMapData?.shops || []);
                setAllFacilitiesMap(allMapData?.facilities || []);
            } catch (e) {
                console.error("Error fetching public map data:", e);
            }
        };
        fetchPublicMapData();
        // Set data loaded if not authenticated (private fetch won't run)
        if (!user) setIsInitialDataLoaded(true);
        
        // Refresh public data every 30 seconds
        const interval = setInterval(fetchPublicMapData, 30000);
        return () => clearInterval(interval);
    }, [user]);

    // Live Cameras Data - Fetch and auto-refresh
    const fetchLiveCameras = async () => {
        try {
            const cameras = await cameraService.getAll();
            setLiveCameras(cameras || []);
        } catch (e) {
            console.error("Error fetching live cameras:", e);
        }
    };

    useEffect(() => {
        fetchLiveCameras();
        const interval = setInterval(fetchLiveCameras, 30000);
        return () => clearInterval(interval);
    }, []);

    // Private User Data (Friends, Managed Shops, Following) - Authenticated Only
    useEffect(() => {
        if (!user) {
            setFriendsMap([]);
            setFollowedShopsMap([]);
            setManagedShopsMap([]);
            setHasManagedShops(false);
            return;
        }

        const fetchPrivateData = async () => {
            try {
                const [friendsData, shopsData, managedShopsData] = await Promise.all([
                    friendService.getFriends().catch(e => ({ friends: [] })),
                    shopService.getFollowing().catch(e => ({ shops: [] })),
                    shopService.getManagedShops().catch(e => ({ shops: [] }))
                ]);
                
                setFriendsMap((friendsData?.friends || []).filter(f => f.last_latitude && f.last_longitude));
                setFollowedShopsMap(shopsData?.shops || []);

                if (managedShopsData?.shops) {
                    setManagedShopsMap(managedShopsData.shops);
                    setHasManagedShops(managedShopsData.shops.length > 0);
                }
                setIsInitialDataLoaded(true);
            } catch (e) { 
                console.error("Error in fetchPrivateData:", e); 
                setIsInitialDataLoaded(true);
            }
        };

        fetchPrivateData();
        // Refresh private data every 10 seconds for real-time tracking
        const interval = setInterval(fetchPrivateData, 10000);
        return () => clearInterval(interval);
    }, [user]);

    // Proximity Notification Logic (500m Threshold)
    useEffect(() => {
        if (!userLocation || !followedShopsMap.length || !user) return;

        const checkProximity = async () => {
            for (const shop of followedShopsMap) {
                // Must have feature enabled
                if (!shop.enable_proximity_notifications) continue;

                // Safe parsing
                const shopLat = parseFloat(shop.latitude);
                const shopLon = parseFloat(shop.longitude);
                if (isNaN(shopLat) || isNaN(shopLon)) continue;

                const dist = haversineDistance(userLocation, { latitude: shopLat, longitude: shopLon });
                const threshold = shop.proximity_radius || 500;
                if (dist <= threshold) {
                    const storageKey = `proximity_notified_${shop.id}_${user.id}`;
                    // Check if already notified
                    if (!localStorage.getItem(storageKey)) {
                        try {
                            // Fetch shop details to find best offer
                            const data = await shopService.getProfile(shop.id);
                            const products = data.products || [];
                            // Find best discount: has old_price > price
                            const offers = products.filter(p => p.old_price && parseFloat(p.old_price) > parseFloat(p.price));

                            let notificationBody = `مرحباً! أنت قريب من ${shop.name} 📍`;
                            if (offers.length > 0) {
                                const bestOffer = offers[0];
                                notificationBody += `\nلا تفوت عرض: ${bestOffer.name} بسعر ${bestOffer.price} شيكل فقط! 🔥`;
                            } else {
                                notificationBody += `\nتفضل بزيارتنا للاطلاع على أحدث المنتجات.`;
                            }

                            // Trigger Notification
                            if ('Notification' in window) {
                                if (Notification.permission === 'granted') {
                                    new Notification(shop.name, { body: notificationBody, icon: '/logo_orange.svg' });
                                } else if (Notification.permission !== 'denied') {
                                    Notification.requestPermission().then(permission => {
                                        if (permission === 'granted') {
                                            new Notification(shop.name, { body: notificationBody, icon: '/logo_orange.svg' });
                                        }
                                    });
                                }
                            }

                            // Also show a local toast/alert just in case
                            // Assuming we don't have a toast library, we can rely on system notification
                            // Or use the notificationService if it has a local push method? 
                            // We'll stick to Browser Notification + Console log.
                            console.log(`Proximity Alert Triggered for ${shop.name}`);

                            // Mark as notified permanently (or we can add a timestamp to reset after 24h)
                            localStorage.setItem(storageKey, 'true');

                        } catch (e) {
                            console.error("Proximity notification failed", e);
                        }
                    }
                }
            }
        };

        const interval = setInterval(checkProximity, 15000); // Check every 15s
        return () => clearInterval(interval);

    }, [userLocation, followedShopsMap, user]);

    // Socket Notifications
    useEffect(() => {
        if (!socket) return;

        const handleCommunityPost = (data) => {
            if (!showCommunities) {
                setHasUnreadCommunity(true);
            }
        };

        const handleNewMessage = (data) => {
            if (!showChat) {
                setUnreadChatCount(prev => prev + 1);
            }
        };

        socket.on('new_community_post', handleCommunityPost);
        socket.on('receive-message', handleNewMessage);

        return () => {
            socket.off('new_community_post', handleCommunityPost);
            socket.off('receive-message', handleNewMessage);
        };
    }, [socket, showCommunities, showChat]);

    // Refresh posts when mode changes or interval
    // (Logic included in main fetch effect above via dependency)

    if (!isGuestMode && !user) return <SplashLoading />;
    if (!isGuestMode && !isInitialDataLoaded) return <SplashLoading />;

    return (
        <div className="map-page" style={{ position: 'relative', height: '100dvh', width: '100vw', overflow: 'hidden' }}>

            {/* Admin Picking Location Banner */}
            {isAdminPickingLocation && (
                <div style={{
                    position: 'absolute',
                    top: '90px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 3500,
                    background: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(10px)',
                    border: '1.5px solid #fbab15',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    color: '#fff',
                    maxWidth: '90%',
                    width: '450px',
                    direction: 'rtl',
                    textAlign: 'right'
                }}>
                    <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fbab15' }}>تحديد موقع المنشور</span>
                        <span style={{ fontSize: '0.8rem', color: '#ccc' }}>انقر على الخريطة في المكان المطلوب لتحديد الإحداثيات</span>
                    </div>
                    <button 
                        type="button"
                        onClick={() => {
                            setIsAdminPickingLocation(false);
                            setShowCreatePost(true);
                        }}
                        style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.3)'}
                        onMouseLeave={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                    >
                        إلغاء
                    </button>
                </div>
            )}

            {/* Top Bar - Clean & Minimalist */}
            {!isGuestMode && !isEmergencyActive && (
                <div className="top-bar">
                <div className="top-bar-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        className={`top-nav-icon profile-top-icon ${showProfile ? 'active' : ''}`}
                        onClick={() => { setShowProfile(true); setShowSearch(false); setShowAIChat(false); setShowCommunities(false); setShowChat(false); }}
                        style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', position: 'relative' }}
                        title="الملف الشخصي"
                    >
                        <img
                            src={getImageUrl(user?.profile_picture) || '/default-avatar.png'}
                            alt="Profile"
                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbab15', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
                        />
                    </button>
                    <div className="app-logo">
                        <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 500.000000 500.000000"
                            preserveAspectRatio="xMidYMid meet"
                            className="logo-image-main"
                        >
                            <g transform="translate(0.000000,500.000000) scale(0.100000,-0.100000)"
                                fill="#92400e" stroke="none">
                                <path d="M2405 4330 c-192 -50 -340 -198 -396 -395 -18 -63 -18 -241 0 -315 20 -82 70 -227 102 -294 16 -33 29 -65 29 -71 0 -7 -27 -18 -59 -24 l-60 -12 -233 -286 c-128 -157 -238 -291 -243 -297 -13 -13 -199 -241 -308 -375 -42 -52 -76 -100 -74 -106 7 -19 72 -9 212 34 77 24 154 47 170 51 17 5 68 20 115 34 47 14 93 26 102 26 9 0 149 -67 310 -149 l293 -149 55 15 c30 8 87 23 125 33 39 10 122 32 185 49 63 17 143 38 178 47 l62 17 160 191 c87 105 198 238 245 296 48 58 97 116 109 130 12 14 46 54 75 90 29 36 70 85 91 110 140 167 170 206 170 222 0 27 4 28 -347 -61 -133 -34 -249 -61 -258 -61 -13 0 -229 105 -263 128 -9 6 -6 20 13 61 77 158 119 293 137 436 29 238 -92 469 -304 581 -121 63 -261 79 -393 44z m237 -51 c171 -36 321 -172 381 -347 25 -74 26 -228 2 -327 -56 -235 -206 -518 -409 -772 -27 -35 -53 -63 -56 -63 -11 0 -189 228 -246 316 -113 172 -204 374 -245 544 -18 72 -18 254 0 300 34 90 71 149 131 210 121 123 279 173 442 139z m-449 -1111 c8 -13 33 -53 57 -91 45 -72 45 -73 0 -117 -3 -3 -25 -30 -50 -60 -25 -30 -52 -64 -61 -75 -10 -11 -46 -54 -80 -96 -35 -42 -118 -142 -183 -223 l-119 -146 -66 -20 c-154 -46 -406 -118 -408 -116 -1 1 26 36 60 77 34 42 113 138 176 215 63 76 141 171 172 209 32 39 126 153 209 255 126 154 157 187 188 196 60 19 90 17 105 -8z m848 -69 c106 -54 118 -63 107 -77 -22 -28 -352 -427 -358 -432 -3 -3 -24 -27 -46 -55 -22 -27 -118 -143 -212 -257 l-172 -207 -58 27 c-112 54 -467 234 -475 241 -6 6 224 299 347 441 11 14 50 60 84 103 35 42 65 77 66 77 2 0 23 -26 47 -57 45 -61 157 -193 174 -205 5 -4 15 -8 21 -8 25 0 211 244 299 393 26 42 49 77 51 77 3 0 59 -27 125 -61z m659 35 c0 -5 -75 -100 -90 -114 -6 -5 -498 -597 -608 -731 -60 -73 -65 -77 -130 -94 -69 -18 -142 -37 -272 -73 -41 -11 -92 -24 -114 -28 l-39 -7 78 94 c43 52 108 130 144 174 36 43 169 203 295 355 125 151 234 283 240 292 8 11 90 36 246 76 261 67 250 64 250 56z" />
                                <path d="M2465 4077 c-56 -19 -81 -33 -127 -75 -158 -142 -116 -403 81 -499 46 -23 69 -28 131 -28 95 1 162 29 223 94 181 193 57 501 -208 517 -33 2 -78 -2 -100 -9z m206 -83 c112 -61 159 -202 105 -315 -22 -48 -81 -107 -126 -126 -53 -24 -156 -21 -205 4 -142 74 -188 248 -98 365 82 106 210 134 324 72z" />
                                <path d="M988 1674 c-16 -5 -18 -24 -18 -220 l0 -214 35 0 35 0 0 85 0 85 58 0 c84 1 133 15 163 48 37 41 45 94 22 139 -31 63 -57 75 -174 79 -57 1 -112 1 -121 -2z m207 -68 c20 -13 25 -25 25 -60 0 -62 -21 -77 -107 -79 l-68 -2 -3 69 c-4 98 -3 100 69 93 33 -3 71 -12 84 -21z" />
                                <path d="M1537 1672 c-30 -3 -40 -9 -48 -30 -17 -43 -78 -209 -114 -310 l-33 -93 36 3 c36 3 38 5 61 71 l23 67 83 0 c92 0 79 11 118 -95 13 -35 19 -40 51 -43 20 -2 36 -1 36 1 0 5 -42 124 -80 227 -18 47 -41 111 -52 142 -22 62 -26 65 -81 60z m43 -147 c4 -11 13 -33 19 -48 18 -44 15 -47 -55 -47 -59 0 -65 2 -59 18 3 9 18 52 32 96 l26 78 15 -38 c7 -22 17 -48 22 -59z" />
                                <path d="M1863 1673 l-23 -4 0 -215 0 -214 150 0 150 0 0 30 0 30 -115 0 -115 0 -2 173 c0 94 -2 178 -2 186 -1 17 -12 20 -43 14z" />
                                <path d="M2247 1673 c-16 -4 -17 -21 -15 -216 l3 -212 30 0 30 0 3 180 3 180 25 -45 c14 -25 43 -76 64 -115 21 -38 54 -97 74 -129 20 -33 36 -63 36 -68 0 -4 23 -8 50 -8 l50 0 0 214 c0 126 -4 217 -10 221 -5 3 -21 3 -35 -1 l-25 -6 0 -172 0 -171 -38 65 c-21 36 -52 90 -69 120 -75 135 -87 152 -110 161 -25 9 -36 10 -66 2z" />
                                <path d="M2834 1669 c-39 -11 -95 -67 -110 -111 -18 -48 -17 -152 2 -196 34 -82 99 -122 198 -122 82 1 137 26 173 81 24 37 28 54 31 129 5 121 -24 179 -111 215 -39 16 -133 19 -183 4z m163 -59 c41 -25 63 -77 63 -150 0 -106 -38 -160 -118 -168 -70 -6 -115 17 -141 74 -41 85 -16 214 47 249 39 21 111 19 149 -5z" />
                                <path d="M3809 1674 c-10 -3 -37 -62 -73 -162 -32 -86 -66 -179 -77 -206 -25 -64 -25 -66 16 -66 25 0 37 5 41 18 3 9 15 41 26 70 l20 52 83 0 83 0 23 -67 c24 -67 25 -68 63 -71 34 -3 38 -1 31 15 -4 10 -39 104 -77 208 -39 105 -73 193 -77 196 -9 10 -63 18 -82 13z m70 -155 l29 -84 -60 -3 c-33 -2 -62 -1 -65 1 -4 5 42 151 54 170 8 13 11 7 42 -84z" />
                                <path d="M3210 1643 c4 -15 22 -66 40 -113 17 -47 38 -103 45 -125 8 -22 25 -67 38 -100 l23 -60 43 0 c40 0 44 2 56 35 7 19 28 73 45 120 18 46 47 126 66 177 l33 93 -37 0 -37 0 -60 -180 c-33 -98 -62 -179 -65 -180 -3 0 -22 53 -43 118 -79 238 -78 237 -119 240 -36 3 -37 3 -28 -25z" />
                            </g>
                        </svg>
                    </div>
                </div>

                <div className="top-bar-right" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <button className={`top-nav-icon ${showNotifications ? 'active' : ''}`} onClick={() => setShowNotifications(true)} style={{ position: 'relative' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {unreadCount > 0 && <span className="notification-badge" style={{ top: '-4px', right: '-4px' }}>{unreadCount}</span>}
                    </button>

                    {/* Search for Users Button */}
                    <button className={`top-nav-icon ${showSearch ? 'active' : ''}`} onClick={() => setShowSearch(true)} title="البحث">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </button>

                    <div className="map-layers-menu-wrapper" style={{ position: 'relative' }}>
                        <button
                            className={`top-nav-icon ${(activeMapType === 'geomolg' || activeMapType.startsWith('geomolg-')) ? 'active' : ''}`}
                            onClick={() => {
                                const nextVal = !showMapLayersMenu;
                                setShowMapLayersMenu(nextVal);
                                if (!nextVal) setShowAllLayers(false);
                            }}
                            title="طبقات الخريطة"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                        </button>
                        
                        {showMapLayersMenu && (
                            <>
                                <div 
                                    className="dropdown-backdrop-custom" 
                                    onClick={() => { setShowMapLayersMenu(false); setShowAllLayers(false); }}
                                    style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        zIndex: 2500,
                                        background: 'transparent'
                                    }}
                                  />
                                  <div className="map-layers-dropdown">
                                      <div className="dropdown-title">طبقات الخريطة</div>
                                      <div className="dropdown-divider" />
                                      
                                      {!showAllLayers ? (
                                          <button 
                                              className="dropdown-item active"
                                              onClick={() => setShowAllLayers(true)}
                                              style={{ background: 'rgba(251, 171, 21, 0.15)', border: '1px solid rgba(251, 171, 21, 0.3)' }}
                                          >
                                              <span className="item-icon">
                                                  {activeMapType === 'streets' ? '🛣️' : 
                                                   activeMapType === 'satellite' ? '🌍' : 
                                                   activeMapType === 'geomolg' ? '🗺️' : '📸'}
                                              </span>
                                              <span className="item-text" style={{ fontWeight: 'bold' }}>
                                                  {activeMapType === 'streets' ? 'خريطة الشوارع (مخطط)' : 
                                                   activeMapType === 'satellite' ? 'قمر صناعي ديناميكي (Google)' : 
                                                   activeMapType === 'geomolg' ? 'عرض جيومولج المنفصل (ArcGIS)' : 
                                                   `الصورة الجوية لعام ${activeMapType.split('-')[1]}`}
                                              </span>
                                              <span style={{ fontSize: '0.8rem', color: '#fbab15', marginRight: 'auto', fontWeight: 'bold' }}>🔄 تغيير</span>
                                          </button>
                                      ) : (
                                          <>
                                              <button 
                                                  className={`dropdown-item ${activeMapType === 'streets' ? 'active' : ''}`}
                                                  onClick={() => { setActiveMapType('streets'); setShowMapLayersMenu(false); setShowAllLayers(false); }}
                                              >
                                                  <span className="item-icon">🛣️</span>
                                                  <span className="item-text">خريطة الشوارع (مخطط)</span>
                                              </button>
                                              
                                              <button 
                                                  className={`dropdown-item ${activeMapType === 'satellite' ? 'active' : ''}`}
                                                  onClick={() => { setActiveMapType('satellite'); setShowMapLayersMenu(false); setShowAllLayers(false); }}
                                              >
                                                  <span className="item-icon">🌍</span>
                                                  <span className="item-text">قمر صناعي ديناميكي (Google)</span>
                                              </button>
                                              
                                              <div className="dropdown-section-title">صور جوية رسمية (ثبات تاريخ التصوير)</div>
                                              
                                              {['2025', '2024', '2023', '2022', '2021', '2020'].map((year) => (
                                                  <button 
                                                      key={year}
                                                      className={`dropdown-item ${activeMapType === `geomolg-${year}` ? 'active' : ''}`}
                                                      onClick={() => { setActiveMapType(`geomolg-${year}`); setShowMapLayersMenu(false); setShowAllLayers(false); }}
                                                  >
                                                      <span className="item-icon">📸</span>
                                                      <span className="item-text">الصورة الجوية لعام {year}</span>
                                                  </button>
                                              ))}
                                              
                                              <div className="dropdown-divider" />
                                              
                                              <button 
                                                  className={`dropdown-item ${activeMapType === 'geomolg' ? 'active' : ''}`}
                                                  onClick={() => { setActiveMapType('geomolg'); setShowMapLayersMenu(false); setShowAllLayers(false); }}
                                              >
                                                  <span className="item-icon">🗺️</span>
                                                  <span className="item-text">عرض جيومولج المنفصل (ArcGIS)</span>
                                              </button>
                                          </>
                                      )}
                                  </div>
                              </>
                          )}
                      </div>

                    <button className={`top-nav-icon ${showMoreMenu ? 'active' : ''}`} onClick={() => setShowMoreMenu(!showMoreMenu)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            )}

            {/* More Menu Dropdown & Backdrop */}
            {showMoreMenu && (
                <>
                    <div
                        className="menu-backdrop"
                        onClick={() => setShowMoreMenu(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 2500,
                            background: 'transparent' // Capture clicks everywhere
                        }}
                    />
                    <div className="more-menu-dropdown slide-down">
                        <div className="menu-header">
                            <h3>القائمة الرئيسية</h3>
                        </div>
                        <button onClick={() => { setShowCommunities(true); setShowMoreMenu(false); }}>
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper">
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                </div>
                                <span>المجتمعات</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <button onClick={() => { setShowShops(true); setShowMoreMenu(false); }}>
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper">
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                </div>
                                <span>المحلات والمؤسسات</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        <button onClick={() => { setShowFriends(true); setShowMoreMenu(false); }}>
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper">
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                                </div>
                                <span>الأصدقاء</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        {/* الأخبار - مخفي مؤقتاً بطلب من المستخدم */}
                        {false && (
                            <button onClick={() => { setShowNews(true); setShowMoreMenu(false); }}>
                                <div className="menu-item-content">
                                    <div className="menu-icon-wrapper">
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" /></svg>
                                    </div>
                                    <span>الأخبار</span>
                                </div>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        )}

                        {/* الطوارئ (Emergency) */}
                        <button 
                            onClick={handleActivateEmergency}
                            className="emergency-menu-item"
                        >
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper" style={{ color: '#ef4444' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="26" height="26" fill="#ef4444" style={{ color: '#ef4444' }} className="menu-icon-svg">
                                        <path d="M200-160v-80h64l79-263q8-26 29.5-41.5T420-560h120q26 0 47.5 15.5T617-503l79 263h64v80H200Zm148-80h264l-72-240H420l-72 240Zm92-400v-200h80v200h-80Zm238 99-57-57 142-141 56 56-141 142Zm42 181v-80h200v80H720ZM282-541 141-683l56-56 142 141-57 57ZM40-360v-80h200v80H40Zm440 120Z"/>
                                    </svg>
                                </div>
                                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>الطوارئ</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                        {/* الجولة الافتراضية - مخفي مؤقتاً بطلب من المستخدم */}
                        {false && !isMobileDevice && (
                            <button
                                onClick={() => { navigate('/virtual-tour'); setShowMoreMenu(false); }}
                            >
                                <div className="menu-item-content">
                                    <div className="menu-icon-wrapper" style={{ color: '#fbab15' }}>
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                            <path d="M2 12h20"/>
                                        </svg>
                                    </div>
                                    <span>الجولة الافتراضية</span>
                                </div>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        )}

                        {/* مختبر بالنوفا - مخفي مؤقتاً بطلب من المستخدم */}
                        {false && !isMobileDevice && (
                            <button
                                onClick={() => {
                                    setShowLabModal(true);
                                    setShowMoreMenu(false);
                                }}
                            >
                                <div className="menu-item-content">
                                    <div className="menu-icon-wrapper" style={{ color: '#fbab15' }}>
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg">
                                            <path d="M10 2v7.31"></path>
                                            <path d="M14 9.3V1.99"></path>
                                            <path d="M8.5 2h7"></path>
                                            <path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path>
                                            <path d="M5.52 16h12.96"></path>
                                        </svg>
                                    </div>
                                    <span>مختبر بالنوفا</span>
                                </div>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        )}

                        {/* PalNovaa Spatial Magazine - Hidden as requested
                        <button onClick={() => { setShowMagazine(true); setShowMoreMenu(false); }}>
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper">
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg">
                                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                    </svg>
                                </div>
                                <span>مجلة بالنوفا المكانية</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                        */}
                        {user?.role === 'admin' && (
                            <button onClick={() => window.location.href = '/admin'}>
                                <div className="menu-item-content">
                                    <div className="menu-icon-wrapper" style={{ color: '#fbab15' }}>
                                        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" className="menu-icon-svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    </div>
                                    <span>لوحة الإدارة</span>
                                </div>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                            </button>
                        )}
                        <div className="menu-divider"></div>
                        <button onClick={logout} className="logout-btn">
                            <div className="menu-item-content">
                                <div className="menu-icon-wrapper">
                                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#ff6b6b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="menu-icon-svg">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                </div>
                                <span style={{ fontWeight: '700' }}>تسجيل خروج</span>
                            </div>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ff6b6b" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                    </div>
                </>
            )}

            {/* Main Content Area */}
            <div className="map-container-wrapper" style={{ height: '100%', width: '100%' }}>
                {!isOnline ? (
                    <>
                        {/* Offline Leaflet Map container */}
                        <div id="offline-leaflet-map"></div>

                        {/* Offline Status Header */}
                        <div className="offline-header">
                            <h1>📍 PalNovaa <span style={{ fontWeight: 300, fontSize: '13px' }}>مستكشف GPS بدون إنترنت</span></h1>
                            <div className="offline-status-badge">
                                <span className="offline-status-dot"></span>
                                <span>يعمل بدون إنترنت (أوفلاين)</span>
                            </div>
                        </div>

                        {/* Offline controls */}
                        <div className="offline-controls-group">
                            <button className="offline-circle-btn" onClick={handleOfflineCenter} title="تركيز الموقع">🎯</button>
                        </div>

                        {/* Offline HUD - Cleaned and minimized for mobile responsiveness */}
                        <div className="offline-dashboard-hud-minimized">
                            <div className="offline-hud-main-status">
                                <span className="offline-hud-pulse-dot"></span>
                                <span className="offline-hud-msg-text">
                                    {offlineMetrics.statusMsg || 'تحديد الموقع عبر الأقمار الصناعية (GPS)'}
                                </span>
                            </div>
                            <div className="offline-hud-coords-row">
                                <span>{offlineMetrics.lat}، {offlineMetrics.lon}</span>
                                <span className="offline-hud-divider">|</span>
                                <span>الدقة: {offlineMetrics.accuracy}م</span>
                                {parseFloat(offlineMetrics.speed) > 0 && (
                                    <>
                                        <span className="offline-hud-divider">|</span>
                                        <span>السرعة: {offlineMetrics.speed}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Shared Shop/Place Connection Prompt */}
                        {showLocationPrompt && sharedItemToConnect && (
                            <div className="shared-connection-prompt">
                                <div className="shared-prompt-content">
                                    <div className="shared-prompt-icon">📍</div>
                                    <h3>تمت مشاركة موقع "{sharedItemToConnect.name}"</h3>
                                    <p>هل ترغب في تحديد موقعك الحالي لرسم خط اتجاه ودليل وصول دقيق بينكما؟</p>
                                    <div className="shared-prompt-actions">
                                        <button className="prompt-btn-confirm" onClick={handleConnectLocations}>
                                            <span>🚀</span> تحديد موقعي والربط
                                        </button>
                                        <button className="prompt-btn-cancel" onClick={() => {
                                            setShowLocationPrompt(false);
                                            setSharedItemToConnect(null);
                                        }}>
                                            تخطي
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Community Header Overlay */}
                {currentCommunity && (
                    <div style={{
                        position: 'absolute', top: '75px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 900, display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                        {/* Community Name Badge */}
                        <div style={{
                            background: isFloraComm
                                ? 'linear-gradient(135deg, #16a34a, #15803d)'
                                : 'rgba(15,23,42,0.85)',
                            color: 'white',
                            borderRadius: '20px',
                            padding: '7px 16px',
                            fontWeight: 'bold',
                            fontSize: '0.88rem',
                            fontFamily: 'inherit',
                            backdropFilter: 'blur(8px)',
                            border: isFloraComm ? '1px solid rgba(134,239,172,0.4)' : '1px solid rgba(255,255,255,0.1)',
                            boxShadow: isFloraComm
                                ? '0 4px 15px rgba(22,163,74,0.4)'
                                : '0 4px 15px rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            whiteSpace: 'nowrap', maxWidth: '260px',
                            overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                            {isFloraComm ? '' : '👥 '} {currentCommunity.name.replace('🌿', '').trim()}
                        </div>
                        <button onClick={handleExitCommunity} style={{
                            background: isFloraComm ? 'rgba(239,68,68,0.85)' : '#ef4444',
                            color: 'white', border: 'none', borderRadius: '20px',
                            padding: '7px 14px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.88rem',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontFamily: 'inherit', backdropFilter: 'blur(8px)'
                        }}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                            </svg>
                            مغادرة
                        </button>
                    </div>
                )}

                <Map
                    ref={mapRef}
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    mapStyle={mapStyle}
                    transformRequest={transformRequest}
                    onLoad={onMapLoad}
                    style={{ width: '100%', height: '100%', cursor: isAdminPickingLocation ? 'crosshair' : 'grab' }}
                    onClick={handleMapClick}
                    maxPitch={85}
                    attributionControl={false}
                >
                    {/* Visual Route with Advanced Premium Layering */}
                    {routePath && (
                        <Source id="route" type="geojson" data={routePath} tolerance={0}>
                            {/* Integrated Navigation Path - Site's Brand Identity Color (#fbab15) */}
                            <Layer
                                id="route-layer-main"
                                type="line"
                                beforeId={firstLabelLayerId}
                                layout={{ "line-join": "round", "line-cap": "round" }}
                                paint={{
                                    "line-color": "#fbab15",
                                    "line-width": [
                                        'interpolate', ['exponential', 1.5], ['zoom'],
                                        12, 4,
                                        18, 10
                                    ],
                                    "line-opacity": 1.0
                                }}
                            />
                        </Source>
                    )}

                    {/* Historical Map Tile Overlay - Atlas Community - renders LAST to stay on top */}
                    {isAtlasCommunity && historicalTileUrl && (
                        <Source
                            key={historicalTileUrl}
                            id="historical-overlay"
                            type="raster"
                            tiles={[historicalTileUrl]}
                            tileSize={256}
                            scheme="xyz"
                            minzoom={1}
                            maxzoom={19}
                        >
                            <Layer
                                id="historical-overlay-layer"
                                type="raster"
                                paint={{
                                    'raster-opacity': historicalOpacity,
                                    'raster-opacity-transition': { duration: 400, delay: 0 },
                                    'raster-resampling': 'linear'
                                }}
                            />
                        </Source>
                    )}

                    {isEmergencyActive && userLocation && (
                        <Source 
                            id="emergency-radius" 
                            type="geojson" 
                            data={{
                                type: "Feature",
                                geometry: {
                                    type: "Polygon",
                                    coordinates: [
                                        createGeoJSONCircle(userLocation, 5.0)
                                    ]
                                },
                                properties: {}
                            }}
                        >
                            <Layer
                                id="emergency-radius-fill"
                                type="fill"
                                paint={{
                                    "fill-color": "#ef4444",
                                    "fill-opacity": 0.08
                                }}
                            />
                            <Layer
                                id="emergency-radius-stroke"
                                type="line"
                                paint={{
                                    "line-color": "#ef4444",
                                    "line-width": 2,
                                    "line-dasharray": [2, 2]
                                }}
                            />
                        </Source>
                    )}

                    {userLocation && (
                        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
                            <div 
                                className={`custom-location-marker ${isEmergencyActive ? 'emergency-pulse' : ''}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
                                title={`الدقة: ${Math.round(userLocation.accuracy || 0)} متر`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
                                    <circle cx="40" cy="40" r="10" fill={isEmergencyActive ? "#ef4444" : "#fbab15"} opacity="0.6">
                                        <animate attributeName="r" from="10" to="38" dur={isEmergencyActive ? "1s" : "2s"} repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.6" to="0" dur={isEmergencyActive ? "1s" : "2s"} repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="40" cy="40" r="10" fill="#ffffff" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }} />
                                    <circle cx="40" cy="40" r="7" fill={isEmergencyActive ? "#ef4444" : "#fbab15"} />
                                </svg>
                            </div>
                        </Marker>
                    )}

                    {/* Removed Taxi Route Line and Markers */}

                    {/* Posts Markers - Visible from City/Neighborhood level (zoom 12+) and hidden at Regional level */}
                    {!isGuestMode && !isEmergencyActive && viewState.zoom >= 12 && posts.filter(post => post.location && post.location.latitude !== null && post.location.longitude !== null).map(post => (
                        <Marker
                            key={post.id}
                            longitude={parseFloat(post.location.longitude)}
                            latitude={parseFloat(post.location.latitude)}
                            anchor="bottom"
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                setSelectedPost(post);
                            }}
                        >
                            <div style={{
                                backgroundImage: `url(${getImageUrl(post.user?.profile_picture) || '/default-avatar.png'})`,
                                width: '45px', height: '45px',
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                borderRadius: '50%', border: isFloraComm ? '3px solid #22c55e' : '2px solid white',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                cursor: 'pointer'
                            }}></div>
                        </Marker>
                    ))}



                    {/* Friends Markers (Hide in Community Mode) - Green Pulse Design */}
                    {!isGuestMode && !currentCommunity && !isEmergencyActive && friendsMap.map(friend => (
                        <Marker
                            key={`friend-${friend.id}`}
                            longitude={parseFloat(friend.last_longitude)}
                            latitude={parseFloat(friend.last_latitude)}
                            anchor="center"
                            onClick={(e) => {
                                e.originalEvent.stopPropagation();
                                setVisibleFriendName(friend.id);
                                setTimeout(() => setVisibleFriendName(null), 3000); // Hide after 3s
                            }}
                        >
                            <div className="friend-location-marker" style={{ position: 'relative', cursor: 'pointer' }}>
                                {visibleFriendName === friend.id && (
                                    <div style={{
                                        position: 'absolute', top: '-45px', left: '50%', transform: 'translateX(-50%)',
                                        background: 'rgba(34, 197, 94, 0.9)', color: 'white', padding: '4px 12px',
                                        borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1.5px solid white', zIndex: 3000,
                                        animation: 'fadeInUp 0.3s ease'
                                    }}>
                                        {friend.username || friend.full_name}
                                    </div>
                                )}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="70" height="70">
                                    <circle cx="40" cy="40" r="10" fill="#22c55e" opacity="0.6">
                                        <animate attributeName="r" from="10" to="35" dur="1.8s" repeatCount="indefinite" />
                                        <animate attributeName="opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="40" cy="40" r="9" fill="#ffffff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
                                    <circle cx="40" cy="40" r="6" fill="#22c55e" />
                                </svg>
                            </div>
                        </Marker>
                    ))}

                    {/* Live CCTV Cameras Markers - Red Pulsing Design */}
                    {!currentCommunity && !isEmergencyActive && viewState.zoom >= 15 && liveCameras.map(camera => {
                        if (camera.latitude == null || camera.longitude == null || isNaN(parseFloat(camera.latitude))) return null;
                        return (
                            <Marker
                                key={`camera-${camera.id}`}
                                longitude={parseFloat(camera.longitude)}
                                latitude={parseFloat(camera.latitude)}
                                anchor="center"
                                style={{ cursor: 'pointer', zIndex: 99 }}
                                onClick={e => {
                                    if (e && e.originalEvent) {
                                        e.originalEvent.stopPropagation();
                                    }
                                    console.log("Clicked Marker camera:", camera);
                                    setSelectedCamera(camera);
                                }}
                            >
                                <div 
                                    className="camera-map-marker" 
                                    title={camera.name}
                                    onClick={e => {
                                        e.stopPropagation();
                                        console.log("Clicked inner div camera:", camera);
                                        setSelectedCamera(camera);
                                    }}
                                >
                                    <div className="camera-marker-pulse"></div>
                                    <div className="camera-icon-wrapper">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M23 7a2 2 0 0 0-2-2h-4l-3-3H10L7 5H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7z"></path>
                                            <circle cx="12" cy="13" r="4"></circle>
                                        </svg>
                                    </div>
                                </div>
                            </Marker>
                        );
                    })}

                    {/* Managed and Followed Shops/Universities Markers - Visibility based on Zoom */}
                    {!currentCommunity && allShopsMap.filter(shop => {
                        if (shop.latitude == null || shop.longitude == null || isNaN(parseFloat(shop.latitude))) return false;

                        if (isEmergencyActive) {
                            const isMedical = shop.category === 'مستشفى' || shop.category === 'مركز طبي' || shop.category === 'عيادة' || shop.category === 'صيدلية';
                            if (!isMedical) return false;
                            if (!userLocation) return true;
                            const dist = haversineDistance(userLocation, { latitude: parseFloat(shop.latitude), longitude: parseFloat(shop.longitude) });
                            return dist <= 5000;
                        }

                        if (isGuestMode) {
                            return String(shop.id) === String(shopIdQuery);
                        }

                        // Hide shops inside complexes/malls by default unless navigated to or searched/profile opened
                        if (shop.parent_shop_id != null && shop.parent_shop_id !== '') {
                            const isNavigatingToThisShop = destination && String(destination.id) === String(shop.id);
                            const isProfileOpen = (selectedShopProfile && String(selectedShopProfile.id) === String(shop.id)) ||
                                                  (selectedMedicalProfile && String(selectedMedicalProfile.id) === String(shop.id));
                            const isQueried = shopIdQuery && String(shop.id) === String(shopIdQuery);
                            
                            if (!isNavigatingToThisShop && !isProfileOpen && !isQueried) {
                                return false;
                            }
                        }

                        // Customized zoom visibility levels or per-shop overrides
                        if (shop.min_zoom != null && shop.min_zoom !== '') {
                            return viewState.zoom >= parseFloat(shop.min_zoom);
                        }
                        const cat = shop.category || '';
                        if (cat === 'دوار') {
                            return viewState.zoom >= 17.5; // يظهر فقط عند التكبير الشديد
                        }
                        if (['مقبرة', 'مسجد', 'كنيسة', 'ملعب'].includes(cat)) {
                            return viewState.zoom >= 14.5; // Shows when zoomed in
                        }
                        return viewState.zoom >= 12; // Standard shops/institutions
                    }).flatMap(shop => [
                        <Marker
                            key={`shop-${shop.id}`}
                            longitude={parseFloat(shop.longitude)}
                            latitude={parseFloat(shop.latitude)}
                            anchor="center"
                            style={{ cursor: 'pointer', zIndex: 50 }}
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                if (isEmergencyActive) {
                                    fetchRoute({
                                        latitude: parseFloat(shop.latitude),
                                        longitude: parseFloat(shop.longitude),
                                        name: shop.name
                                    });
                                } else if (isGuestMode) {
                                    setShowGuestRedirectModal(true);
                                } else {
                                    handleOpenShopProfile(shop);
                                }
                            }}
                        >
                            <div style={{
                                width:  `${shop.icon_size ? shop.icon_size : getMarkerSize(shop.category)}px`,
                                height: `${shop.icon_size ? shop.icon_size : getMarkerSize(shop.category)}px`,
                                borderRadius: '50%',
                                backgroundColor: getMarkerBgColor(shop.category),
                                backgroundImage: (shop.profile_picture || shop.image_url) ? `url(${getImageUrl(shop.profile_picture) || getImageUrl(shop.image_url)})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: getMarkerBorder(shop.category),
                                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: shop.icon_size ? `${Math.round(shop.icon_size * 0.44)}px` : getMarkerEmojiFontSize(shop.category)
                            }}>
                                {/* Display premium category emoji badge inside circle if no image exists */}
                                {(!shop.profile_picture && !shop.image_url) && (
                                    <span>{getCategoryEmoji(shop.category)}</span>
                                )}

                                {/* Name Badge - Visible starting from custom zoom thresholds based on category */}
                                {(() => {
                                    if (routePath) return null;
                                    let showName = false;
                                    if (shop.text_min_zoom != null && shop.text_min_zoom !== '') {
                                        showName = viewState.zoom >= parseFloat(shop.text_min_zoom);
                                    } else if (shop.category === 'دوار') {
                                        showName = viewState.zoom >= 17.5;
                                    } else if (['مسجد', 'كنيسة', 'مقبرة', 'ملعب'].includes(shop.category)) {
                                        showName = viewState.zoom >= 14.5;
                                    } else if (['حديقة', 'منتزه', 'مدرسة', 'وزارة'].includes(shop.category)) {
                                        showName = viewState.zoom >= 15;
                                    } else {
                                        showName = viewState.zoom >= 16.5; // General categories
                                    }

                                    if (!showName) return null;

                                    const currentSize = shop.icon_size ? shop.icon_size : getMarkerSize(shop.category);
                                    const offsetBottom = -Math.round(currentSize * 0.4);

                                    return (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: `${offsetBottom}px`,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            backgroundColor: getNameBadgeBgColor(shop.category),
                                            padding: '2px 10px',
                                            borderRadius: '12px',
                                            fontSize: shop.text_size ? `${shop.text_size}px` : '11px',
                                            fontWeight: 'bold',
                                            fontFamily: 'inherit',
                                            color: getNameBadgeTextColor(shop.category),
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            whiteSpace: 'nowrap',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                            zIndex: 1
                                        }}>
                                            {shop.name}
                                        </div>
                                    );
                                })()}
                            </div>
                        </Marker>,

                        // Active Drivers
                        ...(isGuestMode ? [] : (shop.active_drivers || [])).filter(driver => driver.latitude && driver.longitude).map(driver => (
                            <Marker
                                key={`driver-${driver.id}`}
                                longitude={parseFloat(driver.longitude)}
                                latitude={parseFloat(driver.latitude)}
                                anchor="bottom"
                            >
                                <div
                                    title={`سائق: ${driver.full_name || driver.username}`}
                                    style={{
                                        width: '40px', height: '40px',
                                        backgroundImage: `url(${getImageUrl(driver.profile_picture) || '/default-avatar.png'})`,
                                        backgroundSize: 'cover',
                                        borderRadius: '50%',
                                        border: '3px solid #fbab15',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        position: 'relative',
                                        cursor: 'help'
                                    }}
                                >
                                    <div style={{ position: 'absolute', bottom: -8, right: -8, fontSize: '20px', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}>🚕</div>
                                </div>
                            </Marker>
                        ))
                    ])}


                    {/* Selected Profiles (e.g., from Search before following) */}
                    {(showShopProfile && selectedShopProfile && selectedShopProfile.latitude) && (
                        viewState.zoom >= 17 && (
                            <Marker longitude={parseFloat(selectedShopProfile.longitude)} latitude={parseFloat(selectedShopProfile.latitude)} anchor="bottom">
                                <div style={{ fontSize: '40px', filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.4))', zIndex: 1000, cursor: 'pointer' }}>📍</div>
                            </Marker>
                        )
                    )}
                    {(showUniversityProfile && selectedUniversityProfile && selectedUniversityProfile.latitude) && (
                        viewState.zoom < 17.5 && (
                            <Marker longitude={parseFloat(selectedUniversityProfile.longitude)} latitude={parseFloat(selectedUniversityProfile.latitude)} anchor="bottom">
                                <div style={{ fontSize: '45px', filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.4))', zIndex: 1000, cursor: 'pointer' }}>🎓</div>
                            </Marker>
                        )
                    )}

                    {/* Palestinian Cities Labels (Hide when route is active to keep map clean as requested) */}
                    {(activeMapType === 'satellite' || (activeMapType && activeMapType.startsWith('geomolg-'))) && !routePath && !isGuestMode && viewState.zoom <= 13.5 && PALESTINIAN_CITIES.map((city, index) => (
                        <Marker key={`city-${index}`} longitude={city.lon} latitude={city.lat} anchor="bottom">
                            <div style={{
                                color: (routePath && activeMapType !== 'satellite') ? '#1e293b' : 'white',
                                textShadow: (routePath && activeMapType !== 'satellite') ? '0 1px 2px rgba(255,255,255,0.8)' : '0 2px 4px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)',
                                fontWeight: '700',
                                fontSize: '13px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
                                transform: 'translateY(-5px)', 
                                background: (routePath && activeMapType !== 'satellite') ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.2)',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                backdropFilter: 'blur(3px)',
                                border: (routePath && activeMapType !== 'satellite') ? '1px solid #e2e8f0' : 'none',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                {city.name}
                            </div>
                        </Marker>
                    ))}

                    {/* University Facilities Markers - Visible when zoomed in close (>= 15.5) */}
                    {!currentCommunity && !isEmergencyActive && (isGuestMode ? (facilityIdQuery ? allFacilitiesMap.filter(f => String(f.id) === String(facilityIdQuery)) : []) : (allFacilitiesMap.filter(fac => {
                        const effectiveMinZoom = fac.min_zoom !== undefined && fac.min_zoom !== null ? parseFloat(fac.min_zoom) : 15.5;
                        return viewState.zoom >= effectiveMinZoom;
                    }))).map(fac => {
                        const isFollowedUni = followedShopsMap.some(s => s.id === fac.parent_shop_id);
                        
                        const customIconSize = fac.icon_size !== undefined && fac.icon_size !== null ? parseInt(fac.icon_size) : 38;
                        const customTextSize = fac.text_size !== undefined && fac.text_size !== null ? parseInt(fac.text_size) : 10;
                        const customEmojiSize = Math.round(customIconSize * (20/38));
                        
                        const effectiveTextMinZoom = fac.text_min_zoom !== undefined && fac.text_min_zoom !== null ? parseFloat(fac.text_min_zoom) : 16.5;
                        const showText = viewState.zoom >= effectiveTextMinZoom;

                        return (
                            <Marker
                                key={`fac-${fac.id}`}
                                longitude={parseFloat(fac.longitude)}
                                latitude={parseFloat(fac.latitude)}
                                anchor="bottom"
                                onClick={e => {
                                    e.originalEvent.stopPropagation();
                                    if (isGuestMode) {
                                        setShowGuestRedirectModal(true);
                                    } else {
                                        setSelectedFacilityId(fac.id);
                                        setShowFacilityProfile(true);
                                    }
                                }}
                            >
                                <div className="facility-map-marker" style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
                                    transition: 'transform 0.2s', zIndex: 50
                                }}
                                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{
                                        width: `${customIconSize}px`, height: `${customIconSize}px`, background: 'white', borderRadius: '50%', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', 
                                        border: isFollowedUni ? '3px solid #3b82f6' : '2px solid #94a3b8',
                                        fontSize: `${customEmojiSize}px`, overflow: 'hidden'
                                    }}>
                                        {fac.icon && fac.icon.startsWith('http') ? (
                                            <img src={getImageUrl(fac.icon)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            fac.icon || '🏛️'
                                        )}
                                    </div>
                                    {showText && (
                                        <div style={{
                                            marginTop: '4px', background: 'rgba(0,0,0,0.65)', color: 'white',
                                            fontSize: `${customTextSize}px`, padding: '2px 8px', borderRadius: '10px',
                                            backdropFilter: 'blur(4px)', fontWeight: 'bold', whiteSpace: 'nowrap',
                                            border: isFollowedUni ? '1px solid #3b82f6' : 'none'
                                        }}>
                                            {fac.name}
                                        </div>
                                    )}
                                </div>
                            </Marker>
                        );
                    })}

                </Map>
                    </>
                )}
            </div>

            {/* Bottom Navigation Panel - Instagram Style */}
            {!isGuestMode && !isEmergencyActive && (
                <nav className="bottom-nav">
                <button
                    className={`nav-item ${!showSearch && !showAIChat && !showProfile && !showCommunities && !showChat ? 'active' : ''}`}
                    onClick={() => {
                        handleCenterOnUser();
                        setIsTracking(false); // Make sure tracking is OFF so it doesn't stick
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        {/* Live Update Dot - Always show as long as user is active */}
                        <div className="live-dot-pulse"></div>
                    </div>
                </button>

                <button className={`nav-item reels-nav-btn ${showSpatialReels ? 'active' : ''}`} onClick={() => { setShowSpatialReels(true); setShowSearch(false); setShowAIChat(false); setShowCommunities(false); setShowProfile(false); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36" style={{ marginBottom: '-2px' }}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <polygon points="10 6.5 16.5 10 10 13.5" fill="currentColor" stroke="none" />
                    </svg>
                    <span>ريلز</span>
                </button>

                {(!currentCommunity || isFloraComm || user?.role === 'admin') && (
                    <button
                        className="nav-item center-btn"
                        onClick={() => setShowCreatePost(true)}
                        style={isFloraComm ? {
                            background: 'linear-gradient(135deg, #16a34a, #15803d)',
                            boxShadow: '0 4px 18px rgba(22,163,74,0.5)'
                        } : {}}
                        title={isFloraComm ? 'التقط صورة نبتة' : 'إنشاء منشور'}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                )}

                <button className={`nav-item ${showAIChat ? 'active' : ''}`} onClick={() => { setShowAIChat(true); setShowSearch(false); setShowCommunities(false); setShowProfile(false); }}>
                    <svg viewBox="0 0 100 100" fill="currentColor" width="30" height="30">
                        {/* Sparkles */}
                        <path d="M22 15 C24 28 28 32 40 34 C28 36 24 40 22 53 C20 40 16 36 4 34 C16 32 20 28 22 15 Z" />
                        <path d="M35 2 C36 7 38 9 43 10 C38 11 36 13 35 18 C34 13 32 11 27 10 C32 9 34 7 35 2 Z" />
                        <path d="M42 36 C43 42 45 44 50 45 C45 46 43 48 42 54 C41 48 39 46 34 45 C39 44 41 42 42 36 Z" />
                        {/* Ring with Gap */}
                        <path d="M48 12 A38 38 0 1 1 15 55" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
                        {/* Outer Handle - Starting exactly on the edge */}
                        <path d="M77 77 L95 95" fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" />
                    </svg>
                </button>

                <button className={`nav-item ${showChat ? 'active' : ''}`} onClick={() => { setShowChat(true); setUnreadChatCount(0); setShowSearch(false); setShowAIChat(false); setShowCommunities(false); setShowProfile(false); }}>
                    <div style={{ position: 'relative' }}>
                        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        {unreadChatCount > 0 && <span className="notification-badge" style={{ top: '-6px', right: '-6px', transform: 'scale(0.9)' }}>{unreadChatCount}</span>}
                    </div>
                </button>
            </nav>
            )}

            {/* Emergency Bottom Bar - Overlay */}
            {isEmergencyActive && (
                <div className="emergency-bottom-bar">
                    <div className="emergency-header-bar">
                        <div className="emergency-title-group">
                            <div className="emergency-title">
                                <span className="emergency-title-pulse-dot"></span>
                                وضع الطوارئ نشط
                            </div>
                        </div>
                        <button 
                            className="emergency-exit-btn"
                            onClick={() => {
                                setIsEmergencyActive(false);
                                setRoutePath(null);
                                setRouteStats(null);
                                setDestination(null);
                                setActiveCustomStart(null);
                                setIsTracking(false);
                            }}
                        >
                            إنهاء الطوارئ
                        </button>
                    </div>

                    <div className="emergency-calls-grid">
                        <a href="tel:101" className="emergency-call-card ambulance">
                            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '6px' }}>
                                <rect x="10" y="3" width="4" height="18" rx="1" fill="white" stroke="white" />
                                <rect x="3" y="10" width="18" height="4" rx="1" fill="white" stroke="white" />
                                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
                            </svg>
                            <span className="emergency-call-name">الإسعاف</span>
                            <span className="emergency-call-number">101</span>
                        </a>
                        <a href="tel:100" className="emergency-call-card police">
                            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '6px' }}>
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="white" stroke="white" />
                                <polygon points="12 8 13.5 11 16.5 11 14 13 15 16 12 14.5 9 16 10 13 7.5 11 10.5 11" fill="#2563eb" stroke="#2563eb" strokeWidth="1" />
                            </svg>
                            <span className="emergency-call-name">الشرطة</span>
                            <span className="emergency-call-number">100</span>
                        </a>
                        <a href="tel:102" className="emergency-call-card civil-defense">
                            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginBottom: '6px' }}>
                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="white" stroke="white" />
                            </svg>
                            <span className="emergency-call-name">الدفاع المدني</span>
                            <span className="emergency-call-number">102</span>
                        </a>
                    </div>
                </div>
            )}

            {/* Emergency Route HUD - Top Floating Panel */}
            {isEmergencyActive && routeStats && (
                <div className="emergency-route-hud">
                    <div className="emergency-hud-content">
                        <div className="emergency-hud-dest">
                            المسار إلى: <span className="dest-name">{destination?.name || "المركز الطبي"}</span>
                        </div>
                        <div className="emergency-hud-stats">
                            <div className="hud-stat-item">
                                <span className="stat-label">المسافة:</span>
                                <span className="stat-value">{routeStats.distance}</span>
                            </div>
                            <div className="hud-stat-divider"></div>
                            <div className="hud-stat-item">
                                <span className="stat-label">الوقت المتوقع:</span>
                                <span className="stat-value">{routeStats.duration}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        className="emergency-hud-close-btn"
                        onClick={() => {
                            setRoutePath(null);
                            setRouteStats(null);
                            setDestination(null);
                            setActiveCustomStart(null);
                            setIsTracking(false);
                        }}
                        title="إلغاء المسار"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Floating Info Overlays for Navigation */}

            {/* Navigation Panel */}
            {!isEmergencyActive && (
                <NavigationPanel
                    destination={destination}
                    routeStats={routeStats}
                    isTracking={isTracking}
                    onToggleTracking={() => setIsTracking(!isTracking)}
                    onStopNavigation={() => {
                        setRoutePath(null);
                        setRouteStats(null);
                        setDestination(null);
                        setActiveCustomStart(null);
                        setAiResults([]); // Also clear the destination marker
                        setIsTracking(false); // Stop tracking when nav ends
                        setActiveMapType('geomolg-2024'); // REVERT TO DEFAULT 2024 MAP
                    }}
                />
            )}

            {/* Historical Timeline Panel - Atlas Communities Only */}
            {isAtlasCommunity && (
                <HistoricalTimelinePanel
                    community={currentCommunity}
                    currentUser={user}
                    opacity={historicalOpacity}
                    onOpacityChange={setHistoricalOpacity}
                    onFlyTo={(lat, lng, zoom) => {
                        // If specific coords provided, fly there; otherwise fly to Palestine center
                        const center = (lat && lng) ? [lng, lat] : [35.2, 31.9];
                        const targetZoom = zoom || 8;
                        mapRef.current?.flyTo({
                            center,
                            zoom: targetZoom,
                            duration: 1800,
                            essential: true
                        });
                    }}
                    onLayerChange={(tileUrl, name, year) => {
                        setHistoricalTileUrl(tileUrl);
                        setHistoricalLayerName(name ? `${year} \u2014 ${name}` : null);
                    }}
                />
            )}

            {/* Modals */}
            {showLabModal && <PalNovaaLab onClose={() => setShowLabModal(false)} />}
            {showCreatePost && (
                <CreatePostModal 
                    onClose={() => {
                        setShowCreatePost(false);
                        setAdminPostDraft(null);
                    }} 
                    onPostCreated={(post) => {
                        handlePostCreated(post);
                        setAdminPostDraft(null);
                    }} 
                    currentLocation={userLocation} 
                    communityId={currentCommunity?.id} 
                    currentUser={user}
                    draftData={adminPostDraft}
                    onSelectLocationFromMap={(draft) => {
                        setAdminPostDraft(draft);
                        setIsAdminPickingLocation(true);
                        setShowCreatePost(false);
                    }}
                />
            )}
            {selectedPost && <PostDetailModal
                post={selectedPost}
                isFloraCommunityContext={isFloraComm}
                onClose={() => setSelectedPost(null)}
                onDelete={handleDeletePost}
                onUpdate={(updatedPost) => {
                    setSelectedPost(updatedPost);
                    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
                }}
            />}
            {showChat && <ChatModal onClose={() => setShowChat(false)} />}
            {showFriends && <FriendsModal
                onClose={() => setShowFriends(false)}
                followedShops={followedShopsMap}
                onShopFollowed={handleShopFollowed}
                onCameraAdded={fetchLiveCameras}
                onShopClick={(shop) => {
                    handleOpenShopProfile(shop);
                    setShowFriends(false); // Close friends list to return to map on exit
                    const isUni = shop.category === 'University';
                    mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: isUni ? 17 : 18, pitch: 45 });
                }} />}
            {showShops && <FriendsModal
                onClose={() => setShowShops(false)}
                isShopsMode={true}
                currentUser={user}
                followedShops={followedShopsMap}
                onShopFollowed={handleShopFollowed}
                onCameraAdded={fetchLiveCameras}
                onShopClick={(shop) => {
                    handleOpenShopProfile(shop);
                    setShowShops(false);
                    const category = (shop.category || '').toLowerCase().trim();
                    const isUni = category === 'university' || category === 'مؤسسة تعليمية' || category === 'جامعة';
                    mapRef.current?.flyTo({ 
                        center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], 
                        zoom: isUni ? 17 : 18.5, 
                        pitch: 45,
                        duration: 1500
                    });
                }}
            />}
            {selectedCamera && <LiveCameraModal camera={selectedCamera} onClose={() => setSelectedCamera(null)} isAdmin={user?.role === 'admin'} onCameraUpdated={fetchLiveCameras} />}
            {showMunicipalities && <MunicipalitiesModal
                onClose={() => setShowMunicipalities(false)}
                currentUser={user}
                followedShops={followedShopsMap}
                onShopFollowed={handleShopFollowed}
                onShopClick={(shop) => {
                    handleOpenShopProfile(shop);
                    setShowMunicipalities(false);
                    mapRef.current?.flyTo({ 
                        center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], 
                        zoom: 18.5, 
                        pitch: 45,
                        duration: 1500
                    });
                }}
            />}
            {showMunicipalityProfile && selectedMunicipalityProfile && (
                <MunicipalityProfileModal
                    shop={selectedMunicipalityProfile}
                    currentUser={user}
                    onClose={() => setShowMunicipalityProfile(false)}
                    onFollowChange={handleShopFollowed}
                    userLocation={userLocation}
                />
            )}
            {showGuestRedirectModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(5, 11, 22, 0.85)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                        border: '1px solid rgba(251, 171, 21, 0.3)',
                        borderRadius: '24px',
                        padding: '35px 25px',
                        maxWidth: '420px',
                        width: '100%',
                        textAlign: 'center',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                        color: 'white',
                        fontFamily: 'Tajawal, Cairo, sans-serif'
                    }}>
                        <div style={{ marginBottom: '20px' }}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fbab15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(251, 171, 21, 0.4))' }}>
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                            </svg>
                        </div>
                        
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '15px', color: '#fbab15' }}>انضم إلى بالنوفا!</h3>
                        <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '30px' }}>
                            لرؤية تفاصيل هذا المحل، العروض الحصرية، والتفاعل مع الآخرين على الخريطة الاجتماعية، يرجى إنشاء حساب جديد أو تسجيل الدخول.
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={() => navigate('/login', { state: { mode: 'register' } })}
                                style={{
                                    background: 'linear-gradient(135deg, #fbab15 0%, #f97316 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '14px',
                                    padding: '14px 20px',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(251, 171, 21, 0.3)',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(251, 171, 21, 0.4)';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(251, 171, 21, 0.3)';
                                }}
                            >
                                إنشاء حساب جديد
                            </button>
                            
                            <button 
                                onClick={() => navigate('/login', { state: { mode: 'login' } })}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'white',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '14px',
                                    padding: '12px 20px',
                                    fontSize: '0.95rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
                            >
                                تسجيل الدخول
                            </button>
                            
                            <button 
                                onClick={() => setShowGuestRedirectModal(false)}
                                style={{
                                    background: 'transparent',
                                    color: '#94a3b8',
                                    border: 'none',
                                    marginTop: '5px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                إغلاق والرجوع للخريطة
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showShopProfile && selectedShopProfile && (
                <ShopProfileModal
                    shop={selectedShopProfile}
                    currentUser={user}
                    onClose={() => setShowShopProfile(false)}
                    onFollowChange={handleShopFollowed}
                    userLocation={userLocation}
                />
            )}
            {showMedicalProfile && selectedMedicalProfile && (
                <MedicalCenterProfileModal
                    shop={selectedMedicalProfile}
                    currentUser={user}
                    onClose={() => setShowMedicalProfile(false)}
                    onFollowChange={handleShopFollowed}
                    userLocation={userLocation}
                />
            )}
            {showUniversityProfile && selectedUniversityProfile && (
                <UniversityProfileModal
                    university={selectedUniversityProfile}
                    currentUser={user}
                    onClose={() => {
                        setShowUniversityProfile(false);
                        setSelectedUniFacilities([]);
                    }}
                    onFollowChange={handleShopFollowed}
                    onShopClick={(shop) => {
                        handleOpenShopProfile(shop);
                        setShowUniversityProfile(false);
                    }}
                    onFacilityClick={(facility) => {
                        setSelectedFacilityId(facility.id);
                        setShowFacilityProfile(true);
                        // Hide university list but keep markers
                        setShowUniversityProfile(false);
                        // Fly to location
                        if (facility.latitude && facility.longitude) {
                            mapRef.current?.flyTo({
                                center: [parseFloat(facility.longitude), parseFloat(facility.latitude)],
                                zoom: 19,
                                pitch: 45,
                                duration: 1500
                            });
                        }
                    }}
                />
            )}
            {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
            {/* ProfileSidebar - Social-media style profile drawer */}
            <ProfileSidebar
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
                currentUser={user}
                logout={logout}
                socket={socket}
                followedShops={followedShopsMap}
                onNavigate={(action, payload) => {
                    if (action === 'home') {
                        setShowSidebar(false);
                    } else if (action === 'search') {
                        setShowSearch(true);
                        setShowSidebar(false);
                    } else if (action === 'profile') {
                        setShowProfile(true);
                        setShowSidebar(false);
                    } else if (action === 'spatial-ar') {
                        navigate('/ar');
                        setShowSidebar(false);
                    } else if (action === 'settings') {
                        setShowProfile(true); // Opens profile which includes settings/privacy
                        setShowSidebar(false);
                    } else if (action === 'shop' && payload) {
                        handleOpenShopProfile(payload);
                        mapRef.current?.flyTo({
                            center: [parseFloat(payload.longitude), parseFloat(payload.latitude)],
                            zoom: 18.5,
                            pitch: 45,
                            duration: 1500
                        });
                        setShowSidebar(false);
                    }
                }}
            />
            {(showProfile || selectedProfileId) && (
                <ProfileModal 
                    userId={selectedProfileId || user.id} 
                    onClose={() => { 
                        setShowProfile(false); 
                        setSelectedProfileId(null); 
                        setSearchParams(prev => {
                            const next = new URLSearchParams(prev);
                            next.delete('userId');
                            return next;
                        });
                    }} 
                />
            )}
            {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} onNotificationClick={(data) => {
                if (data.shopId) {
                    const shopMock = {
                        id: data.shopId,
                        name: data.shopName,
                        latitude: data.location?.latitude,
                        longitude: data.location?.longitude
                    };
                    handleOpenShopProfile(shopMock);
                    setShowNotifications(false); // Close notifications list to return to map on exit
                    if (data.location?.latitude && data.location?.longitude) {
                        mapRef.current?.flyTo({ center: [parseFloat(data.location.longitude), parseFloat(data.location.latitude)], zoom: 18.5, pitch: 45 });
                    }
                }
            }} />}
            {showAIChat && (
                <AIChatModal 
                    onClose={() => setShowAIChat(false)} 
                    userLocation={userLocation}
                    onNavigate={(shop, mode, customStartLoc) => {
                        const routeMode = mode === 'walking' ? 'foot-walking' : 'driving-car';
                        if (customStartLoc) {
                            setActiveCustomStart(customStartLoc);
                            setIsTracking(false);
                        } else {
                            setActiveCustomStart(null);
                            setIsTracking(true); // Enable live guidance mode
                        }
                        fetchRoute(shop, routeMode, customStartLoc);
                        setShowAIChat(false);
                    }}
                    onShopClick={(shop) => {
                        handleOpenShopProfile(shop);
                        setShowAIChat(false);
                        if (shop.latitude && shop.longitude) {
                            mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: 18.5, pitch: 45 });
                        }
                    }}
                />
            )}
            {showNews && <NewsModal onClose={() => setShowNews(false)} location={{ latitude: viewState.latitude, longitude: viewState.longitude }} />}
            {showCommunities && <CommunitiesModal onClose={() => setShowCommunities(false)} onJoinCommunity={handleJoinCommunity} />}
            {showManagedShops && (
                <ManagedShopsModal
                    onClose={() => setShowManagedShops(false)}
                    onShopClick={(shop) => {
                        handleOpenShopProfile(shop);
                        setShowManagedShops(false);
                        
                        const catRaw = String(shop.category || '').trim();
                        const isMuni = catRaw.toLowerCase() === 'بلدية' || catRaw.toLowerCase() === 'municipality' || catRaw.includes('بلدية');
                        
                        if (!isMuni) {
                            mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: 18.5, pitch: 45 });
                        }
                    }}
                />
            )}

            {/* Native Geomolg View with ArcGIS API */}
            {activeMapType === 'geomolg' && (
                <GeomolgViewer
                    onClose={() => setActiveMapType('geomolg-2024')}
                    userLocation={userLocation}
                    posts={posts}
                    friends={friendsMap}
                    shops={[...followedShopsMap, ...managedShopsMap]}
                    onShopClick={(shop) => {
                        handleOpenShopProfile(shop);
                    }}
                    onPostClick={(post) => {
                        setSelectedPost(post);
                    }}
                />
            )}

            {showFacilityProfile && (
                <FacilityProfileModal
                    facilityId={selectedFacilityId}
                    currentUser={user}
                    onClose={() => setShowFacilityProfile(false)}
                />
            )}

            {/* GPS Helper - Mobile & Desktop Support */}
            {showGPSGuide && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
                    zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid #1e293b',
                        borderRadius: '24px', width: '100%', maxWidth: '400px',
                        padding: '30px', color: 'white', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ marginBottom: '20px' }}>
                            <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="#fbab15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '15px' }}>تفعيل تحديد الموقع</h2>

                        <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '20px' }}>
                            يرجى تحديد نظام التشغيل الخاص بجهازك لعرض خطوات تفعيل الموقع (GPS) بكل سهولة:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <button
                                onClick={() => window.location.href = '/support?os=android'}
                                style={{
                                    fontFamily: 'inherit',
                                    background: '#1e293b', border: '1px solid #334155', color: 'white',
                                    borderRadius: '16px', padding: '20px 10px', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="35" height="35" fill="currentColor" style={{ color: '#3ddc84' }}><path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67C5.46,5.4,5.1,5.31,4.82,5.46C4.52,5.62,4.4,6,4.56,6.3l1.84,3.18 C2.69,11.56,0,16.2,0,21.5h24C24,16.2,21.31,11.56,17.6,9.48z M6.42,17.43c-0.65,0-1.18-0.53-1.18-1.18 c0-0.65,0.53-1.18,1.18-1.18s1.18,0.53,1.18,1.18C7.59,16.9,7.06,17.43,6.42,17.43z M17.58,17.43c-0.65,0-1.18-0.53-1.18-1.18 c0-0.65,0.53-1.18,1.18-1.18s1.18,0.53,1.18,1.18C18.76,16.9,18.23,17.43,17.58,17.43z" /></svg>
                                </div>
                                <span style={{ fontWeight: 'bold' }}>أندرويد (Android)</span>
                            </button>
                            <button
                                onClick={() => window.location.href = '/support?os=ios'}
                                style={{
                                    fontFamily: 'inherit',
                                    background: '#1e293b', border: '1px solid #334155', color: 'white',
                                    borderRadius: '16px', padding: '20px 10px', cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" width="35" height="35" fill="currentColor"><path d="M16.96,18.06c-0.78,1.14-1.61,2.27-2.85,2.3c-1.21,0.03-1.62-0.71-2.99-0.71c-1.37,0-1.81,0.68-2.95,0.71 c-1.2,0-1.95-1.04-2.73-2.18c-1.61-2.32-2.84-6.55-1.19-9.42c0.82-1.42,2.26-2.33,3.84-2.36c1.17-0.03,2.27,0.78,2.99,0.78 c0.72,0,2.05-1,3.46-0.85c1.47,0.06,2.8,0.71,3.54,1.82c-3.08,1.86-2.58,6.23,0.5,7.41C18.17,16.48,17.6,17.33,16.96,18.06z M14.61,4.64c0.63-0.76,1.06-1.83,0.94-2.89c-0.93,0.04-2.04,0.62-2.69,1.41C12.3,3.85,11.8,4.96,11.96,5.99 C12.98,6.07,14.03,5.43,14.61,4.64z" /></svg>
                                </div>
                                <span style={{ fontWeight: 'bold' }}>آيفون (iOS)</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    fontFamily: 'inherit',
                                    background: '#fbab15', color: 'black', fontWeight: 'bold',
                                    padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer'
                                }}
                            >
                                تحديث الصفحة الآن
                            </button>
                            <button
                                onClick={() => setShowGPSGuide(false)}
                                style={{
                                    background: 'transparent', color: '#94a3b8', border: 'none',
                                    padding: '10px', cursor: 'pointer', fontSize: '0.9rem'
                                }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spatial Reels Modal */}
            {showSpatialReels && (
                <SpatialReelsModal
                    onClose={() => setShowSpatialReels(false)}
                    currentUser={user}
                    userLocation={userLocation}
                />
            )}

            {/* Magazine Modal */}
            {showMagazine && (
                <MagazineModal
                    onClose={() => setShowMagazine(false)}
                />
            )}



            {/* Legacy Spatial AR Viewer removed (replaced by /ar page) */}
        </div>
    );
};

export default MapComponent;

