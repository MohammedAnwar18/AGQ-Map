import React, { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const StreetMap = () => {
    const { isAuthenticated, loading } = useAuth();
    const [viewState, setViewState] = useState(() => {
        const simulate = localStorage.getItem('simulate_location') === 'true';
        let lat = 31.9038;
        let lng = 35.2034;

        if (!simulate) {
            try {
                const saved = localStorage.getItem('last_user_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    lat = parsed.latitude;
                    lng = parsed.longitude;
                }
            } catch (e) {}
        } else {
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
        }

        return {
            longitude: lng,
            latitude: lat,
            zoom: 17,
            pitch: 0,
            bearing: 0
        };
    });

    useEffect(() => {
        const simulate = localStorage.getItem('simulate_location') === 'true';
        let lat = 31.9038;
        let lng = 35.2034;

        if (!simulate) {
            try {
                const saved = localStorage.getItem('last_user_location');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    lat = parsed.latitude;
                    lng = parsed.longitude;
                }
            } catch (e) {}
        } else {
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
        }

        setViewState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            zoom: 17
        }));
    }, []);

    if (loading) return <div>Loading...</div>;
    if (!isAuthenticated) return <Navigate to="/login" />;

    // Use a clean street style (Voyager is beautiful and free)
    const STREET_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

    return (
        <div style={{ width: '100vw', height: '100dvh', position: 'relative' }}>
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                mapStyle={STREET_STYLE}
                style={{ width: '100%', height: '100%' }}
            >
                <NavigationControl position="top-right" />
            </Map>
            
            {/* Back Button */}
            <button 
                onClick={() => window.location.href = '/map'}
                style={{
                    position: 'absolute',
                    top: 'calc(20px + env(safe-area-inset-top, 0px))',
                    left: 'calc(20px + env(safe-area-inset-left, 0px))',
                    padding: '12px 20px', borderRadius: '30px',
                    background: 'white', border: '1px solid #ddd',
                    fontWeight: 'bold', cursor: 'pointer', zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', gap: 8
                }}
            >
                <span>←</span> العودة للخريطة الرئيسية
            </button>

            <div style={{
                position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.9)', padding: '10px 20px', borderRadius: '20px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.1)', fontWeight: 'bold', zIndex: 1000,
                color: '#1a5f7a'
            }}>
                خريطة الشوارع التفصيلية 🗺️
            </div>
        </div>
    );
};

export default StreetMap;
