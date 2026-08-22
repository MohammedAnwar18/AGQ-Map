import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || atob('cGsuZXlKMWlqb2liVzlvWVcxdFpXUXRNVE16TVNJc0ltRWlPaUpqYldsc2FHaDFhbkF4TTJrem0yZHlOSFI1ZVRVNEFtOWhJbjAuYXJzWmlrV05wdW9jZXlXZG5NMzBWQQ==');

export default function EarthGlobe({ className = '' }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const animRef = useRef(null);
    const isInteractingRef = useRef(false);

    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/satellite-v9',
            projection: 'globe',
            zoom: 1.55,
            center: [35.2, 31.9], // Center around Palestine/Middle East
            pitch: 0,
            attributionControl: false,
            logoPosition: 'bottom-left'
        });

        mapRef.current = map;

        map.on('style.load', () => {
            // Google Satellite Tile Layer
            if (!map.getSource('google-satellite')) {
                map.addSource('google-satellite', {
                    type: 'raster',
                    tiles: ['https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                    tileSize: 256
                });
            }

            if (!map.getLayer('google-satellite-layer')) {
                map.addLayer({
                    id: 'google-satellite-layer',
                    type: 'raster',
                    source: 'google-satellite',
                    paint: {}
                });
            }

            // Atmosphere, Glow & Space Background blending seamlessly with page
            map.setFog({
                'color': 'rgb(186, 210, 235)',
                'high-color': 'rgb(36, 92, 223)',
                'horizon-blend': 0.02,
                'space-color': 'rgb(4, 8, 20)',
                'star-intensity': 0.75
            });

            // Smooth slow auto-rotation (cinematic 60fps)
            let lastTime = performance.now();
            const rotateGlobe = (now) => {
                const delta = (now - lastTime) / 1000;
                lastTime = now;

                if (!isInteractingRef.current && map.getProjection()?.name === 'globe') {
                    const zoom = map.getZoom();
                    if (zoom < 4) {
                        const center = map.getCenter();
                        // 1 full revolution (360 deg) every 160 seconds
                        center.lng += 2.25 * delta;
                        if (center.lng > 180) center.lng -= 360;
                        map.jumpTo({ center });
                    }
                }

                animRef.current = requestAnimationFrame(rotateGlobe);
            };

            animRef.current = requestAnimationFrame(rotateGlobe);
        });

        // User interaction pause/resume
        let resumeTimer = null;
        const pauseSpin = () => {
            isInteractingRef.current = true;
            if (resumeTimer) clearTimeout(resumeTimer);
        };

        const resumeSpinAfterDelay = () => {
            if (resumeTimer) clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => {
                isInteractingRef.current = false;
            }, 2500);
        };

        map.on('mousedown', pauseSpin);
        map.on('touchstart', pauseSpin);
        map.on('dragstart', pauseSpin);
        map.on('zoomstart', pauseSpin);

        map.on('mouseup', resumeSpinAfterDelay);
        map.on('touchend', resumeSpinAfterDelay);
        map.on('dragend', resumeSpinAfterDelay);
        map.on('zoomend', resumeSpinAfterDelay);

        return () => {
            if (resumeTimer) clearTimeout(resumeTimer);
            if (animRef.current) cancelAnimationFrame(animRef.current);
            map.remove();
        };
    }, []);

    return (
        <div
            className={`realistic-earth-wrapper ${className}`}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                borderRadius: '0'
            }}
        >
            <div
                ref={mapContainerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none'
                }}
            />
        </div>
    );
}
