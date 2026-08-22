import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// Convert Lat/Lon to 3D Vector on Sphere
export const latLongToVector3 = (lat, lon, radius) => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
};

// Create Realistic Fallback Satellite Earth Texture
const createRealisticEarthTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep realistic ocean blue gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#0c2340');
    oceanGrad.addColorStop(0.3, '#103761');
    oceanGrad.addColorStop(0.5, '#17487c');
    oceanGrad.addColorStop(0.7, '#103761');
    oceanGrad.addColorStop(1, '#0c2340');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const toCanvasX = (lon) => ((lon + 180) / 360) * canvas.width;
    const toCanvasY = (lat) => ((90 - lat) / 180) * canvas.height;

    // Realistic terrain landmass polygons
    const continents = [
        // Africa & Middle East
        [
            [-17, 15], [-5, 36], [10, 37], [25, 32], [32, 31], [35, 33], [36, 30],
            [43, 12], [51, 11], [58, 24], [55, 26], [48, 30], [36, 36], [32, 32],
            [40, 20], [51, 10], [42, -5], [35, -20], [28, -34], [18, -34], [12, -18],
            [9, 4], [0, 6], [-15, 12], [-17, 15]
        ],
        // Europe
        [
            [-10, 36], [-8, 44], [-4, 48], [2, 51], [8, 55], [10, 58], [18, 60],
            [25, 70], [32, 70], [40, 65], [45, 55], [35, 45], [26, 40], [20, 38],
            [15, 40], [5, 43], [-2, 40], [-6, 36], [-10, 36]
        ],
        // Asia
        [
            [40, 65], [60, 70], [90, 75], [120, 75], [145, 70], [170, 65], [140, 50],
            [130, 42], [122, 30], [108, 20], [100, 5], [80, 8], [70, 22], [60, 25],
            [50, 35], [45, 45], [40, 65]
        ],
        // North America
        [
            [-165, 65], [-140, 70], [-90, 75], [-60, 65], [-55, 50], [-70, 42],
            [-80, 25], [-90, 20], [-100, 22], [-105, 20], [-85, 15], [-77, 8],
            [-85, 12], [-105, 23], [-115, 32], [-124, 48], [-140, 60], [-165, 65]
        ],
        // South America
        [
            [-77, 8], [-60, 10], [-50, 0], [-35, -6], [-38, -18], [-48, -28],
            [-58, -38], [-66, -55], [-75, -50], [-72, -35], [-78, -15], [-80, -2], [-77, 8]
        ],
        // Australia
        [
            [115, -22], [130, -12], [142, -10], [152, -24], [150, -38], [138, -38],
            [118, -35], [114, -26], [115, -22]
        ]
    ];

    continents.forEach((poly) => {
        ctx.beginPath();
        poly.forEach(([lon, lat], idx) => {
            const cx = toCanvasX(lon);
            const cy = toCanvasY(lat);
            if (idx === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        });
        ctx.closePath();

        // Natural terrain colors (Green vegetation, golden sand deserts, mountain browns)
        const landGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        landGrad.addColorStop(0, '#2e5a36');
        landGrad.addColorStop(0.35, '#8c764b');
        landGrad.addColorStop(0.65, '#5c7846');
        landGrad.addColorStop(1, '#2c4b31');
        ctx.fillStyle = landGrad;
        ctx.fill();

        // Realistic coastal shallow water shelf
        ctx.strokeStyle = 'rgba(78, 178, 220, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    // Realistic night city cluster glows
    const cityLights = [
        { lon: 35.2, lat: 31.9, count: 50, color: '#ffeaad', rad: 3.5 },
        { lon: 34.4, lat: 31.5, count: 30, color: '#ffeaad', rad: 2.8 },
        { lon: 35.9, lat: 31.9, count: 35, color: '#ffeaad', rad: 3.0 },
        { lon: 55.3, lat: 25.2, count: 40, color: '#ffd27a', rad: 3.2 },
        { lon: 46.7, lat: 24.7, count: 35, color: '#ffd27a', rad: 3.0 },
        { lon: 31.2, lat: 30.0, count: 55, color: '#ffd27a', rad: 3.5 },
        { lon: -0.1, lat: 51.5, count: 45, color: '#ffe699', rad: 2.8 },
        { lon: 2.3, lat: 48.8, count: 45, color: '#ffe699', rad: 2.8 },
        { lon: -74.0, lat: 40.7, count: 50, color: '#ffe699', rad: 3.2 },
        { lon: 139.7, lat: 35.6, count: 50, color: '#ffe699', rad: 3.2 }
    ];

    cityLights.forEach((cluster) => {
        const cx = toCanvasX(cluster.lon);
        const cy = toCanvasY(cluster.lat);

        for (let i = 0; i < cluster.count; i++) {
            const offsetDist = Math.random() * 20;
            const angle = Math.random() * Math.PI * 2;
            const px = cx + Math.cos(angle) * offsetDist;
            const py = cy + Math.sin(angle) * offsetDist;
            const size = Math.random() * cluster.rad + 0.8;

            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fillStyle = cluster.color;
            ctx.shadowColor = cluster.color;
            ctx.shadowBlur = size * 3;
            ctx.fill();
        }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
};

// Procedural Realistic Cloud Texture
const createRealisticCloudTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 220; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 55 + 20;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
};

export default function EarthGlobe({
    userLocation,
    onLocationFound,
    targetCity,
    className = ''
}) {
    const mountRef = useRef(null);
    const globeRef = useRef(null);
    const cloudsRef = useRef(null);
    const pinGroupRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const animFrameRef = useRef(null);

    const [pinScreenPos, setPinScreenPos] = useState({ x: 0, y: 0, visible: false });
    const [locationInfo, setLocationInfo] = useState({
        name: 'جاري تحديد موقعك...',
        lat: 31.90,
        lon: 35.20,
        accuracy: null
    });
    const [isLocating, setIsLocating] = useState(false);
    const [userInteracting, setUserInteracting] = useState(false);

    const targetRotationRef = useRef({ x: 0.25, y: -0.5 });
    const currentRotationRef = useRef({ x: 0.25, y: -0.5 });
    const targetCameraDistRef = useRef(240);
    const currentCameraDistRef = useRef(240);
    const isFocusedRef = useRef(false);

    const activeCoordsRef = useRef({ lat: 31.90, lon: 35.20 });

    // Fly camera smoothly to target lat/lon (like Google Earth)
    const flyToCoordinates = useCallback((lat, lon, zoomDist = 148) => {
        isFocusedRef.current = true;
        const targetRotY = -((lon + 180) * (Math.PI / 180)) + Math.PI / 2;
        const targetRotX = (lat * (Math.PI / 180)) * 0.75;

        targetRotationRef.current = { x: targetRotX, y: targetRotY };
        targetCameraDistRef.current = zoomDist;

        if (pinGroupRef.current) {
            const GLOBE_RADIUS = 90;
            const pinPos = latLongToVector3(lat, lon, GLOBE_RADIUS);
            pinGroupRef.current.position.copy(pinPos);

            const normal = pinPos.clone().normalize();
            pinGroupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            pinGroupRef.current.visible = true;
        }
    }, []);

    const requestLocation = useCallback(() => {
        setIsLocating(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const acc = Math.round(pos.coords.accuracy || 10);
                    activeCoordsRef.current = { lat, lon };

                    setLocationInfo({
                        name: 'موقعك الحالي الفعلي',
                        lat: parseFloat(lat.toFixed(4)),
                        lon: parseFloat(lon.toFixed(4)),
                        accuracy: acc
                    });
                    setIsLocating(false);
                    if (onLocationFound) onLocationFound({ lat, lon, accuracy: acc });

                    flyToCoordinates(lat, lon, 142);
                },
                (err) => {
                    console.warn('Geolocation fallback to Palestine:', err.message);
                    const lat = 31.9038;
                    const lon = 35.2034;
                    activeCoordsRef.current = { lat, lon };
                    setLocationInfo({
                        name: 'فلسطين (القدس / رام الله)',
                        lat,
                        lon,
                        accuracy: 25
                    });
                    setIsLocating(false);
                    flyToCoordinates(lat, lon, 148);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        } else {
            setIsLocating(false);
        }
    }, [onLocationFound, flyToCoordinates]);

    useEffect(() => {
        if (targetCity && targetCity.lat && targetCity.lon) {
            activeCoordsRef.current = { lat: targetCity.lat, lon: targetCity.lon };
            setLocationInfo({
                name: targetCity.name || 'المدينة المحددة',
                lat: targetCity.lat,
                lon: targetCity.lon,
                accuracy: targetCity.accuracy || 15
            });
            flyToCoordinates(targetCity.lat, targetCity.lon, 148);
        }
    }, [targetCity, flyToCoordinates]);

    // Build 3D Scene
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2500);
        camera.position.z = currentCameraDistRef.current;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Realistic Sun & Ambient Lights (Natural Space Sunlight)
        const ambientLight = new THREE.AmbientLight(0x334155, 1.2);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
        sunLight.position.set(300, 150, 220);
        scene.add(sunLight);

        const earthBackglow = new THREE.DirectionalLight(0x1e3a8a, 1.6);
        earthBackglow.position.set(-250, -120, -180);
        scene.add(earthBackglow);

        // --- Deep Space Starfield ---
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1600;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 500 + Math.random() * 600;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i + 2] = r * Math.cos(phi);

            const rnd = Math.random();
            if (rnd > 0.8) {
                starColors[i] = 0.98; starColors[i + 1] = 0.85; starColors[i + 2] = 0.55;
            } else if (rnd > 0.5) {
                starColors[i] = 0.55; starColors[i + 1] = 0.85; starColors[i + 2] = 1.0;
            } else {
                starColors[i] = 0.95; starColors[i + 1] = 0.95; starColors[i + 2] = 0.98;
            }
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 1.8,
            vertexColors: true,
            transparent: true,
            opacity: 0.85
        });
        const starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);

        // --- Realistic 3D Earth Globe ---
        const GLOBE_RADIUS = 90;
        const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);

        // Try loading photorealistic satellite textures with instant fallback
        const textureLoader = new THREE.TextureLoader();
        const fallbackTexture = createRealisticEarthTexture();

        const earthMat = new THREE.MeshStandardMaterial({
            map: fallbackTexture,
            roughness: 0.65,
            metalness: 0.1
        });

        // Attempt async satellite map load for Google Earth fidelity
        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                earthMat.map = tex;
                earthMat.needsUpdate = true;
            },
            undefined,
            () => console.log('Using high-res procedural satellite Earth map')
        );

        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
            (normTex) => {
                earthMat.normalMap = normTex;
                earthMat.normalScale.set(0.6, 0.6);
                earthMat.needsUpdate = true;
            }
        );

        const earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);
        globeRef.current = earth;

        // --- Natural Atmospheric Scattering Glow (Google Earth Atmosphere) ---
        const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 64, 64);
        const atmoMat = new THREE.MeshStandardMaterial({
            color: 0x4aa3ff,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
        scene.add(atmosphere);

        const outerGlowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 48, 48);
        const outerGlowMat = new THREE.MeshBasicMaterial({
            color: 0x2563eb,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const outerGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat);
        scene.add(outerGlow);

        // --- Realistic Clouds Layer ---
        const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 64, 64);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: createRealisticCloudTexture(),
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending
        });

        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
            (cloudTex) => {
                cloudMat.map = cloudTex;
                cloudMat.needsUpdate = true;
            }
        );

        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        scene.add(clouds);
        cloudsRef.current = clouds;

        // --- 3D User Pin & Radar Beacon ---
        const pinGroup = new THREE.Group();

        const stemGeo = new THREE.CylinderGeometry(0.4, 0.15, 6, 16);
        stemGeo.translate(0, 3, 0);
        const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        pinGroup.add(stem);

        const headGeo = new THREE.SphereGeometry(2.2, 16, 16);
        headGeo.translate(0, 6.8, 0);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xfbab15,
            emissive: 0xfbab15,
            emissiveIntensity: 1.4,
            roughness: 0.2
        });
        const head = new THREE.Mesh(headGeo, headMat);
        pinGroup.add(head);

        const rippleGeo = new THREE.RingGeometry(1.0, 3.2, 32);
        rippleGeo.rotateX(-Math.PI / 2);
        const rippleMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ripple = new THREE.Mesh(rippleGeo, rippleMat);
        pinGroup.add(ripple);

        scene.add(pinGroup);
        pinGroup.visible = false;
        pinGroupRef.current = pinGroup;

        // Initial Location Auto-Locate
        const autoLocateTimer = setTimeout(() => {
            requestLocation();
        }, 500);

        // Mouse Drag / Free Rotate Handlers
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;

        const onMouseDown = (e) => {
            if (e.target !== renderer.domElement) return;
            isDragging = true;
            setUserInteracting(true);
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - prevMouseX;
            const deltaY = e.clientY - prevMouseY;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;

            targetRotationRef.current.y += deltaX * 0.005;
            targetRotationRef.current.x = Math.max(-1.1, Math.min(1.1, targetRotationRef.current.x + deltaY * 0.005));
        };

        const onMouseUp = () => {
            isDragging = false;
            setTimeout(() => setUserInteracting(false), 2500);
        };

        const onWheel = (e) => {
            if (e.target !== renderer.domElement) return;
            targetCameraDistRef.current = Math.max(130, Math.min(300, targetCameraDistRef.current + e.deltaY * 0.15));
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        container.addEventListener('wheel', onWheel, { passive: true });

        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // Animation Loop
        let clock = new THREE.Clock();
        const animate = () => {
            animFrameRef.current = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();

            if (!isFocusedRef.current && !userInteracting) {
                targetRotationRef.current.y += 0.0025;
            }

            currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.06;
            currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.06;
            currentCameraDistRef.current += (targetCameraDistRef.current - currentCameraDistRef.current) * 0.06;

            if (globeRef.current) {
                globeRef.current.rotation.x = currentRotationRef.current.x;
                globeRef.current.rotation.y = currentRotationRef.current.y;
            }
            if (cloudsRef.current) {
                cloudsRef.current.rotation.x = currentRotationRef.current.x * 1.02;
                cloudsRef.current.rotation.y = currentRotationRef.current.y + elapsed * 0.012;
            }

            if (pinGroupRef.current && pinGroupRef.current.visible) {
                const GLOBE_RADIUS = 90;
                const basePos = latLongToVector3(
                    activeCoordsRef.current.lat,
                    activeCoordsRef.current.lon,
                    GLOBE_RADIUS
                );

                const euler = new THREE.Euler(
                    currentRotationRef.current.x,
                    currentRotationRef.current.y,
                    0,
                    'XYZ'
                );
                basePos.applyEuler(euler);
                pinGroupRef.current.position.copy(basePos);

                const normal = basePos.clone().normalize();
                pinGroupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

                const scale = 1 + Math.sin(elapsed * 3.5) * 0.45;
                ripple.scale.set(scale, scale, scale);

                const screenVec = basePos.clone().add(normal.clone().multiplyScalar(9));
                screenVec.project(camera);

                const isFront = screenVec.z < 1;
                const screenX = (screenVec.x * 0.5 + 0.5) * width;
                const screenY = (-(screenVec.y * 0.5) + 0.5) * height;

                setPinScreenPos({
                    x: screenX,
                    y: screenY,
                    visible: isFront && pinGroupRef.current.visible
                });
            }

            camera.position.z = currentCameraDistRef.current;
            starField.rotation.y = elapsed * 0.0015;

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            clearTimeout(autoLocateTimer);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('resize', handleResize);
            if (container) {
                container.removeEventListener('wheel', onWheel);
                if (renderer.domElement) container.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [requestLocation, userInteracting, flyToCoordinates]);

    return (
        <div className={`realistic-earth-wrapper ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Seamless 3D WebGL Canvas */}
            <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

            {/* Floating 3D Pin Tooltip on Globe */}
            {pinScreenPos.visible && (
                <div
                    className="pin-floating-hud"
                    style={{
                        position: 'absolute',
                        left: `${pinScreenPos.x}px`,
                        top: `${pinScreenPos.y}px`,
                        transform: 'translate(-50%, -120%)',
                        pointerEvents: 'none',
                        zIndex: 20
                    }}
                >
                    <div className="pin-hud-card">
                        <div className="pin-hud-header">
                            <span className="live-dot-pulse"></span>
                            <span className="pin-hud-title">{locationInfo.name}</span>
                        </div>
                        <div className="pin-hud-coords">
                            <span>{locationInfo.lat}° N, {locationInfo.lon}° E</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Locate Floating Button */}
            <div className="realistic-earth-controls">
                <button
                    className={`btn-locate-action ${isLocating ? 'loading' : ''}`}
                    onClick={requestLocation}
                    title="التقريب إلى موقعي الفعلي"
                >
                    <span className="locate-icon">🎯</span>
                    <span>{isLocating ? 'جارٍ الرصد والتقريب...' : 'التقريب لموقعي الفعلي'}</span>
                </button>
            </div>
        </div>
    );
}
