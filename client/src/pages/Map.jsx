import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import NotificationsModal from '../components/NotificationsModal';
import AIChatModal from '../components/AIChatModal';
import CommunitiesModal from '../components/CommunitiesModal';
import NewsModal from '../components/NewsModal';
import GeomolgViewer from '../components/GeomolgViewer';
import NavigationPanel from '../components/NavigationPanel';
import ManagedShopsModal from '../components/ManagedShopsModal';
import ShopProfileModal from '../components/ShopProfileModal';
import { postService, friendService, authService, notificationService, communityService, shopService, getImageUrl } from '../services/api';
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

const MapComponent = () => {
    const { user, logout } = useAuth();



    // Time state
    const [currentTime, setCurrentTime] = useState(new Date());
    // Live Tracking State
    const [isTracking, setIsTracking] = useState(false);

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
    const [activeMapType, setActiveMapType] = useState('satellite');

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



    // View State for 3D Map
    const [viewState, setViewState] = useState({
        longitude: 35.2034,
        latitude: 31.9038,
        zoom: 14,
        pitch: 0,
        bearing: 0
    });

    const [userLocation, setUserLocation] = useState(null);

    // UI States
    const [showSearch, setShowSearch] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showFriends, setShowFriends] = useState(false);
    const [showShops, setShowShops] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [isUserInfoExpanded, setIsUserInfoExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const [showChat, setShowChat] = useState(false);
    const [showAIChat, setShowAIChat] = useState(false);
    const [showNews, setShowNews] = useState(false);
    const [showCommunities, setShowCommunities] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [hasUnreadCommunity, setHasUnreadCommunity] = useState(false);

    // Community Mode State
    const [currentCommunity, setCurrentCommunity] = useState(null);

    // Shop Profile State
    const [showShopProfile, setShowShopProfile] = useState(false);
    const [selectedShopProfile, setSelectedShopProfile] = useState(null);

    // Data States
    const [posts, setPosts] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const [aiResults, setAiResults] = useState([]);
    const [routePath, setRoutePath] = useState(null);
    const [routeStats, setRouteStats] = useState(null);
    const [destination, setDestination] = useState(null);
    const [friendsMap, setFriendsMap] = useState([]);
    const [followedShopsMap, setFollowedShopsMap] = useState([]);
    // --- Dynamic Map Style ---
    const mapStyle = useMemo(() => {
        return {
            version: 8,
            sources: {
                'raster-tiles': {
                    type: 'raster',
                    tiles: activeMapType === 'geomolg' 
                        // Using the standard Web Mercator compatible tile service URL
                        ? ['https://orthophotos.geomolg.ps/adaptor/rest/services/Orthophotos_WB_2023_15cm_jp2_PG1923_jp2/MapServer/tile/{z}/{y}/{x}']
                        : ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                    tileSize: 256,
                    attribution: activeMapType === 'geomolg' ? 'Geomolg Palestine Orthophoto 2023' : 'Google Maps'
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
    }, [activeMapType]);

    // Routing
    // Updated to accept explicit start/end for recalculations
    const fetchRoute = async (endLoc, mode = 'driving', startLoc = null) => {
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
            const profile = mode === 'walking' ? 'foot' : 'driving';

            console.log(`Routing from ${start} to ${end} via ${profile}`);

            const url = `https://router.project-osrm.org/route/v1/${profile}/${start};${end}?overview=full&geometries=geojson&steps=true&alternatives=true&continue_straight=true&annotations=true`;

            const response = await axios.get(url);

            if (response.data.routes && response.data.routes.length > 0) {
                const allRoutes = response.data.routes;

                // Filter routes logic...
                const hebrewRegex = /[\u0590-\u05FF]/;
                const militaryRegex = /military/i;

                const safeRoutes = allRoutes.filter(r => {
                    return r.legs.every(leg =>
                        leg.steps.every(step => {
                            const name = step.name || "";
                            return !hebrewRegex.test(name) && !militaryRegex.test(name);
                        })
                    );
                });

                let route = safeRoutes.length > 0 ? safeRoutes[0] : allRoutes[0];
                const coordinates = route.geometry.coordinates;

                setRoutePath({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                });

                if (!startLoc) {
                    setDestination(endLoc);
                    if (mapRef.current) {
                        const bounds = coordinates.reduce((bounds, coord) => {
                            return bounds.extend(coord);
                        }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
                        mapRef.current.fitBounds(bounds, { padding: 100 });
                    }
                }

                setRouteStats({
                    distance: (route.distance / 1000).toFixed(1) + ' كم',
                    duration: Math.round(route.duration / 60) + ' دقيقة'
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
            fetchRoute(destination, 'driving', userLocation);
            lastRecalcLocation.current = userLocation;
        }
    }, [userLocation, routePath, destination]);

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
                setUserLocation(newLoc);
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

    const handlePostCreated = (newPost) => {
        setPosts(prev => [newPost, ...prev]);
        setShowCreatePost(false);
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

                // Fetch unread notifications count
                const countData = await notificationService.getUnreadCount();
                setUnreadCount(countData.count || 0);

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();

        // Poll for notifications every 30s
        const interval = setInterval(async () => {
            try {
                const countData = await notificationService.getUnreadCount();
                setUnreadCount(countData.count || 0);
            } catch (e) {
                console.error("Error polling notifications", e);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [user, currentCommunity]);

    // Native-Grade Geolocation Tracking
    useEffect(() => {
        let watchId;
        let retryTimeout;

        const requestLocationPermission = async () => {
            if (!navigator.geolocation) {
                console.error("Geolocation is not supported by this device.");
                return;
            }

            // High-Precision Options for App-like experience
            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0 // Always get fresh GPS data
            };

            const startWatching = () => {
                watchId = navigator.geolocation.watchPosition(
                    (pos) => {
                        setUserLocation({
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
                            // Permission Denied - Guide the user
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
                    setUserLocation({
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
    }, []);

    // Sync Location
    const locationRef = useRef(null);
    useEffect(() => { locationRef.current = userLocation; }, [userLocation]);
    useEffect(() => {
        const interval = setInterval(async () => {
            if (locationRef.current) {
                try { await authService.updateLocation(locationRef.current.latitude, locationRef.current.longitude); }
                catch (e) { console.error(e); }
            }
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Initial Center on User (Once)
    const hasCenteredRef = useRef(false);
    useEffect(() => {
        if (userLocation && !hasCenteredRef.current && mapRef.current) {
            mapRef.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 16,
                pitch: 45,
                bearing: 0,
                duration: 2000 // Smooth fly to user
            });
            hasCenteredRef.current = true;
        }
    }, [userLocation]);

    // Live Follow Mode (Tracking)
    useEffect(() => {
        if (isTracking && userLocation && mapRef.current) {
            mapRef.current.easeTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 18,
                pitch: 60,
                bearing: userLocation.heading || mapRef.current.getBearing(),
                duration: 1000,
                easing: t => t * (2 - t)
            });
        }
    }, [userLocation, isTracking]);

    // Friends Location
    useEffect(() => {
        if (!user) return;
        const fetchFriendsLocs = async () => {
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
                    if (managedShopsData.shops.length > 0) setHasManagedShops(true);
                }
            } catch (e) { console.error("Error in fetchFriendsLocs:", e); }
        };
        fetchFriendsLocs();
        const interval = setInterval(fetchFriendsLocs, 10000);
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

                if (dist <= 500) {
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

    // Community Notifications Socket
    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

        socket.on('new_community_post', (data) => {
            // Logic: If user is not currently viewing communities, show the dot
            if (!showCommunities) {
                setHasUnreadCommunity(true);
            }
        });

        return () => socket.disconnect();
    }, [showCommunities]);

    // Refresh posts when mode changes or interval
    // (Logic included in main fetch effect above via dependency)

    if (!user) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

    return (
        <div className="map-page" style={{ position: 'relative', height: '100dvh', width: '100vw', overflow: 'hidden' }}>

            {/* Top Bar - Clean & Minimalist */}
            <div className="top-bar">
                <div className="top-bar-left">
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

                <div className="top-bar-right" style={{ display: 'flex', gap: '20px' }}>
                    <button className={`top-nav-icon ${showNotifications ? 'active' : ''}`} onClick={() => setShowNotifications(true)} style={{ position: 'relative' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        {unreadCount > 0 && <span className="notification-badge" style={{ top: '-4px', right: '-4px' }}>{unreadCount}</span>}
                    </button>

                    <button className={`top-nav-icon ${activeMapType === 'geomolg' ? 'active' : ''}`} onClick={() => setActiveMapType(prev => prev === 'satellite' ? 'geomolg' : 'satellite')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <polygon points="12 2 2 7 12 12 22 7 12 2" />
                            <polyline points="2 17 12 22 22 17" />
                            <polyline points="2 12 12 17 22 12" />
                        </svg>
                    </button>

                    <button className={`top-nav-icon ${showMoreMenu ? 'active' : ''}`} onClick={() => setShowMoreMenu(!showMoreMenu)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {/* More Menu Dropdown */}
            {showMoreMenu && (
                <div className="more-menu-dropdown fade-in">
                    <button onClick={() => { setShowCommunities(true); setShowMoreMenu(false); }}>
                        <span>مجتمعاتي</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </button>
                    <button onClick={() => { setShowShops(true); setShowMoreMenu(false); }}>
                        <span>محلاتي</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                    </button>
                    <button onClick={() => { setShowFriends(true); setShowMoreMenu(false); }}>
                        <span>الأصدقاء</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    </button>
                    <button onClick={() => { setShowNews(true); setShowMoreMenu(false); }}>
                        <span>الأخبار</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" /></svg>
                    </button>
                    {user?.role === 'admin' && (
                        <button onClick={() => window.location.href = '/admin'}>
                            <span>الإدارة</span>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" /></svg>
                        </button>
                    )}
                    <div className="menu-divider"></div>
                    <button onClick={logout} style={{ color: '#ff4757' }}>
                        <span>تسجيل خروج</span>
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="map-container-wrapper" style={{ height: '100%', width: '100%' }}>
                {/* Community Header Overlay */}
                {currentCommunity && (
                    <div style={{
                        position: 'absolute', top: '120px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 900, background: 'rgba(255,255,255,0.9)', padding: '10px 20px', borderRadius: '20px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '10px',
                        backdropFilter: 'blur(5px)'
                    }}>
                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#1a5f7a' }}>مجتمع: {currentCommunity.name}</span>
                        <button onClick={handleExitCommunity} style={{
                            background: '#ff4757', color: 'white', border: 'none', borderRadius: '15px',
                            padding: '5px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
                        }}>خروج</button>
                    </div>
                )}

                <Map
                    ref={mapRef}
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    mapStyle={mapStyle}
                    style={{ width: '100%', height: '100%' }}
                    maxPitch={85}
                    attributionControl={false}
                >
                    {/* Visual Route with High Precision Layering */}
                    {routePath && (
                        <Source id="route" type="geojson" data={routePath} tolerance={0}>
                            {/* Outer Glow/Border for better visibility on satellite */}
                            <Layer
                                id="route-layer-glow"
                                type="line"
                                layout={{ "line-join": "round", "line-cap": "round" }}
                                paint={{
                                    "line-color": "#ffffff",
                                    "line-width": 8,
                                    "line-opacity": 0.3
                                }}
                            />
                            {/* Main Precise Path */}
                            <Layer
                                id="route-layer"
                                type="line"
                                layout={{ "line-join": "round", "line-cap": "round" }}
                                paint={{
                                    "line-color": "#fbab15",
                                    "line-width": 5,
                                    "line-opacity": 1
                                }}
                            />
                        </Source>
                    )}

                    {/* User Location Marker */}
                    {userLocation && (
                        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
                            <div className="custom-location-marker" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
                                    <circle cx="40" cy="40" r="10" fill="#fbab15" opacity="0.6"><animate attributeName="r" from="10" to="38" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" /></circle>
                                    <circle cx="40" cy="40" r="10" fill="#ffffff" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }} />
                                    <circle cx="40" cy="40" r="7" fill="#fbab15" />
                                </svg>
                            </div>
                        </Marker>
                    )}

                    {/* Posts Markers - Visible from West Bank level (zoom 8+) and hidden at Arab World level */}
                    {viewState.zoom >= 8 && posts.map(post => (
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
                                borderRadius: '50%', border: '2px solid white',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                cursor: 'pointer'
                            }}></div>
                        </Marker>
                    ))}



                    {/* Friends Markers (Hide in Community Mode) */}
                    {!currentCommunity && friendsMap.map(friend => (
                        <Marker
                            key={`friend-${friend.id}`}
                            longitude={parseFloat(friend.last_longitude)}
                            latitude={parseFloat(friend.last_latitude)}
                            anchor="bottom"
                        >
                            <div style={{
                                backgroundImage: `url(${getImageUrl(friend.profile_picture) || '/default-avatar.png'})`,
                                width: '45px', height: '45px',
                                backgroundSize: 'cover', backgroundPosition: 'center',
                                borderRadius: '50%', border: '2px solid #22c55e',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                cursor: 'pointer'
                            }}></div>
                        </Marker>
                    ))}

                    {/* Managed and Followed Shops Markers - Visible only at close zoom and World Mode */}
                    {viewState.zoom >= 17 && !currentCommunity && [...followedShopsMap, ...managedShopsMap.filter(m => !followedShopsMap.some(f => f.id === m.id))].filter(shop =>
                        shop.latitude != null &&
                        shop.longitude != null &&
                        !isNaN(parseFloat(shop.latitude))
                    ).flatMap(shop => [
                        <Marker
                            key={`shop-${shop.id}`}
                            longitude={parseFloat(shop.longitude)}
                            latitude={parseFloat(shop.latitude)}
                            anchor="center"
                            style={{ cursor: 'pointer', zIndex: 50 }}
                            onClick={e => {
                                e.originalEvent.stopPropagation();
                                setSelectedShopProfile(shop);
                                setShowShopProfile(true);
                            }}
                        >
                            <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                backgroundColor: '#fbab15',
                                backgroundImage: `url(${getImageUrl(shop.profile_picture) || getImageUrl(shop.image_url) || '/default-shop.png'})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                border: '3px solid white',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                                position: 'relative'
                            }}>
                                {/* Simple Name Badge */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-22px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: 'black',
                                    border: '1px solid #fbab15',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}>
                                    {shop.name}
                                </div>
                                {/* Category Emoji Badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    background: 'white',
                                    borderRadius: '50%',
                                    width: '22px',
                                    height: '22px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    border: '1px solid #ddd'
                                }}>
                                    {shop.category === 'مكتب تاكسي' ? '🚕' : '🏪'}
                                </div>
                            </div>
                        </Marker>,

                        // Active Drivers
                        ...(shop.active_drivers || []).filter(driver => driver.latitude && driver.longitude).map(driver => (
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


                    {/* Search Results */}
                    {aiResults.map((place, index) => (
                        <Marker key={`ai-${index}`} longitude={parseFloat(place.lon)} latitude={parseFloat(place.lat)} color="red">
                            {/* Default Red Pin */}
                        </Marker>
                    ))}

                    {/* Palestinian Cities Labels (Satellite Only) - Hide when zoomed in to show shops */}
                    {activeMapType === 'satellite' && viewState.zoom <= 13.5 && PALESTINIAN_CITIES.map((city, index) => (
                        <Marker key={`city-${index}`} longitude={city.lon} latitude={city.lat} anchor="bottom">
                            <div style={{
                                color: 'white',
                                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)',
                                fontWeight: '600',
                                fontSize: '13px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                fontFamily: "'Tajawal', 'Segoe UI', sans-serif",
                                transform: 'translateY(-5px)', // Slight lift
                                background: 'rgba(0, 0, 0, 0.2)', // Subtle backing
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backdropFilter: 'blur(2px)'
                            }}>
                                {city.name}
                            </div>
                        </Marker>
                    ))}

                </Map>
            </div>

            {/* Bottom Navigation Panel - Instagram Style */}
            <nav className="bottom-nav">
                <button className={`nav-item ${!showSearch && !showAIChat && !showProfile && !showCommunities ? 'active' : ''}`} onClick={handleCenterOnUser}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                </button>

                <button className={`nav-item ${showSearch ? 'active' : ''}`} onClick={() => { setShowSearch(true); setShowAIChat(false); setShowCommunities(false); setShowProfile(false); }}>
                    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
                        {/* User Head */}
                        <circle cx="42" cy="30" r="18" strokeWidth="8" />
                        {/* User Body */}
                        <path d="M10 88 C 10 60, 30 55, 45 55" strokeWidth="8" />
                        {/* Plus Circle */}
                        <circle cx="72" cy="72" r="20" strokeWidth="7" />
                        {/* Neat Plus - Normal thickness */}
                        <path d="M72 62 V 82 M 62 72 H 82" strokeWidth="7" />
                    </svg>
                </button>

                <button className="nav-item center-btn" onClick={() => setShowCreatePost(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>

                <button className={`nav-item ${showAIChat ? 'active' : ''}`} onClick={() => { setShowAIChat(true); setShowSearch(false); setShowCommunities(false); setShowProfile(false); }}>
                    <svg viewBox="0 0 100 100" fill="currentColor">
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

                <button className={`nav-item profile-nav-item ${showProfile ? 'active' : ''}`} onClick={() => { setShowProfile(true); setShowSearch(false); setShowAIChat(false); setShowCommunities(false); }}>
                    <div className="nav-profile-frame">
                        <img
                            src={getImageUrl(user.profile_picture) || '/default-avatar.png'}
                            alt="Profile"
                            className="nav-profile-img"
                        />
                    </div>
                </button>
            </nav>

            {/* Floating Info Overlays for Navigation */}

            {/* Navigation Panel */}
            <NavigationPanel
                destination={destination}
                routeStats={routeStats}
                isTracking={isTracking}
                onToggleTracking={() => setIsTracking(!isTracking)}
                onStopNavigation={() => {
                    setRoutePath(null);
                    setRouteStats(null);
                    setDestination(null);
                    setAiResults([]); // Also clear the destination marker
                    setIsTracking(false); // Stop tracking when nav ends
                }}
            />

            {/* Modals */}
            {showCreatePost && <CreatePostModal onClose={() => setShowCreatePost(false)} onPostCreated={handlePostCreated} currentLocation={userLocation} communityId={currentCommunity?.id} />}
            {selectedPost && <PostDetailModal
                post={selectedPost}
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
                onShopClick={(shop) => {
                    setSelectedShopProfile(shop);
                    setShowShopProfile(true);
                    mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: 18, pitch: 45 });
                }} />}
            {showShops && <FriendsModal
                onClose={() => setShowShops(false)}
                isShopsMode={true}
                currentUser={user}
                followedShops={followedShopsMap}
                onShopFollowed={handleShopFollowed}
                onShopClick={(shop) => {
                    setSelectedShopProfile(shop);
                    setShowShopProfile(true);
                    mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: 18.5, pitch: 45 });
                }}
            />}
            {showShopProfile && selectedShopProfile && (
                <ShopProfileModal
                    shop={selectedShopProfile}
                    currentUser={user}
                    onClose={() => setShowShopProfile(false)}
                    onFollowChange={handleShopFollowed}
                />
            )}
            {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
            {showProfile && <ProfileModal userId={user.id} onClose={() => setShowProfile(false)} />}
            {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} onNotificationClick={(data) => {
                if (data.shopId) {
                    const shopMock = {
                        id: data.shopId,
                        name: data.shopName,
                        latitude: data.location?.latitude,
                        longitude: data.location?.longitude
                    };
                    setSelectedShopProfile(shopMock);
                    setShowShopProfile(true);
                    if (data.location?.latitude && data.location?.longitude) {
                        mapRef.current?.flyTo({ center: [parseFloat(data.location.longitude), parseFloat(data.location.latitude)], zoom: 18.5, pitch: 45 });
                    }
                }
            }} />}
            {showAIChat && (
                <AIChatModal
                    onShopFollowed={handleShopFollowed}
                    onClose={() => setShowAIChat(false)}
                    onSearchResults={(results) => {
                        setAiResults(results);
                        setRoutePath(null); setRouteStats(null); setDestination(null);
                        if (results.length > 0) {
                            mapRef.current?.flyTo({ center: [parseFloat(results[0].lon), parseFloat(results[0].lat)], zoom: 18.5, pitch: 45 });
                        }
                    }}
                    onRouteRequest={(destination, mode) => {
                        setAiResults([destination]);
                        fetchRoute(destination, mode);
                        setShowAIChat(false);
                    }}
                    onClearMap={() => { setAiResults([]); setRoutePath(null); setRouteStats(null); setDestination(null); setShowAIChat(false); }}
                    userLocation={userLocation}
                />
            )}
            {showNews && <NewsModal onClose={() => setShowNews(false)} location={{ latitude: viewState.latitude, longitude: viewState.longitude }} />}
            {showCommunities && <CommunitiesModal onClose={() => setShowCommunities(false)} onJoinCommunity={handleJoinCommunity} />}
            {showManagedShops && (
                <ManagedShopsModal
                    onClose={() => setShowManagedShops(false)}
                    onShopClick={(shop) => {
                        setSelectedShopProfile(shop);
                        setShowShopProfile(true);
                        setShowManagedShops(false);
                        mapRef.current?.flyTo({ center: [parseFloat(shop.longitude), parseFloat(shop.latitude)], zoom: 18.5, pitch: 45 });
                    }}
                />
            )}
        </div>
    );
};

export default MapComponent;
