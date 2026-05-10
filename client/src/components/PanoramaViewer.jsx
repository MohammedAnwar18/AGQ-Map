import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const PanoramaViewer = ({ imageSrc, onClose }) => {
    const containerRef = useRef(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 0.1);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // Sphere Geometry
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Invert the sphere so we are inside

        // Texture
        const loader = new THREE.TextureLoader();
        const texture = loader.load(imageSrc, () => {
            setLoading(false);
        });
        
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // Interaction
        let isUserInteracting = false;
        let onPointerDownPointerX = 0, onPointerDownPointerY = 0;
        let onPointerDownLon = 0, onPointerDownLat = 0;
        let lon = 0, lat = 0;
        let phi = 0, theta = 0;

        const onPointerDown = (event) => {
            isUserInteracting = true;
            const clientX = event.clientX || (event.touches && event.touches[0].clientX);
            const clientY = event.clientY || (event.touches && event.touches[0].clientY);
            onPointerDownPointerX = clientX;
            onPointerDownPointerY = clientY;
            onPointerDownLon = lon;
            onPointerDownLat = lat;
        };

        const onPointerMove = (event) => {
            if (isUserInteracting) {
                const clientX = event.clientX || (event.touches && event.touches[0].clientX);
                const clientY = event.clientY || (event.touches && event.touches[0].clientY);
                lon = (onPointerDownPointerX - clientX) * 0.1 + onPointerDownLon;
                lat = (clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
            }
        };

        const onPointerUp = () => {
            isUserInteracting = false;
        };

        const onDocumentMouseWheel = (event) => {
            const fov = camera.fov + event.deltaY * 0.05;
            camera.fov = THREE.MathUtils.clamp(fov, 10, 100);
            camera.updateProjectionMatrix();
        };

        containerRef.current.addEventListener('mousedown', onPointerDown);
        containerRef.current.addEventListener('mousemove', onPointerMove);
        containerRef.current.addEventListener('mouseup', onPointerUp);
        containerRef.current.addEventListener('touchstart', onPointerDown);
        containerRef.current.addEventListener('touchmove', onPointerMove);
        containerRef.current.addEventListener('touchend', onPointerUp);
        containerRef.current.addEventListener('wheel', onDocumentMouseWheel);

        // Animation Loop
        const animate = () => {
            requestAnimationFrame(animate);

            lat = Math.max(-85, Math.min(85, lat));
            phi = THREE.MathUtils.degToRad(90 - lat);
            theta = THREE.MathUtils.degToRad(lon);

            const x = 500 * Math.sin(phi) * Math.cos(theta);
            const y = 500 * Math.cos(phi);
            const z = 500 * Math.sin(phi) * Math.sin(theta);

            camera.lookAt(x, y, z);
            renderer.render(scene, camera);
        };

        animate();

        // Handle Resize
        const handleResize = () => {
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
            // Clean up resources
            geometry.dispose();
            material.dispose();
            texture.dispose();
            renderer.dispose();
        };
    }, [imageSrc]);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'black', display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
                position: 'absolute', top: '20px', left: '20px', right: '20px', 
                zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
            }}>
                <div style={{ 
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', 
                    padding: '8px 16px', borderRadius: '20px', color: 'white', 
                    fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                        <path d="M2 12h20"/>
                    </svg>
                    جولة افتراضية 360°
                </div>
                <button 
                    onClick={onClose}
                    style={{ 
                        width: '40px', height: '40px', borderRadius: '50%', 
                        background: 'rgba(255,255,255,0.2)', border: 'none', 
                        color: 'white', fontSize: '20px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    ✕
                </button>
            </div>

            <div ref={containerRef} style={{ flex: 1, width: '100%', height: '100%', cursor: 'move' }} />

            {loading && (
                <div style={{ 
                    position: 'absolute', inset: 0, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', 
                    background: 'rgba(0,0,0,0.8)', color: 'white', zIndex: 2 
                }}>
                    <div className="loader-ring"></div>
                    <span style={{ marginLeft: '10px' }}>جاري تحميل البانوراما...</span>
                </div>
            )}

            <div style={{ 
                position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', 
                padding: '10px 20px', borderRadius: '30px', color: 'white',
                fontSize: '0.8rem', pointerEvents: 'none', textAlign: 'center'
            }}>
                اسحب الصورة للتدوير • استخدم العجلة للتكبير
            </div>
        </div>
    );
};

export default PanoramaViewer;
