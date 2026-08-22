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

// Generate high-resolution procedural Earth texture with continents and night city lights
const createProceduralEarthTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Deep ocean gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#060d1f');
    oceanGrad.addColorStop(0.5, '#0b1938');
    oceanGrad.addColorStop(1, '#060d1f');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw latitude / longitude tactical grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw stylized landmass polygons for Earth continents
    const toCanvasX = (lon) => ((lon + 180) / 360) * canvas.width;
    const toCanvasY = (lat) => ((90 - lat) / 180) * canvas.height;

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

    // Render Landmasses with glowing futuristic borders and terrain gradient
    continents.forEach((poly) => {
        ctx.beginPath();
        poly.forEach(([lon, lat], idx) => {
            const cx = toCanvasX(lon);
            const cy = toCanvasY(lat);
            if (idx === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        });
        ctx.closePath();

        // Land fill
        ctx.fillStyle = '#172e54';
        ctx.fill();

        // Land border glow
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
    });

    // Draw Golden & Cyan City Lights (Dense clusters across world cities)
    const cityClusters = [
        // Palestine & Levant (Dense golden hub)
        { lon: 35.2, lat: 31.9, count: 40, color: '#fbab15', rad: 3.5 },
        { lon: 34.4, lat: 31.5, count: 25, color: '#ffd27a', rad: 2.5 },
        { lon: 35.9, lat: 31.9, count: 30, color: '#fbab15', rad: 3.0 },
        { lon: 35.5, lat: 33.8, count: 25, color: '#fbab15', rad: 2.5 },
        // Gulf & Middle East
        { lon: 55.3, lat: 25.2, count: 35, color: '#fbab15', rad: 3.0 },
        { lon: 46.7, lat: 24.7, count: 30, color: '#fbab15', rad: 3.0 },
        { lon: 31.2, lat: 30.0, count: 45, color: '#ffd27a', rad: 3.5 },
        { lon: 51.5, lat: 25.3, count: 25, color: '#fbab15', rad: 2.5 },
        // Europe & UK
        { lon: -0.1, lat: 51.5, count: 35, color: '#38bdf8', rad: 2.5 },
        { lon: 2.3, lat: 48.8, count: 35, color: '#38bdf8', rad: 2.5 },
        { lon: 13.4, lat: 52.5, count: 25, color: '#38bdf8', rad: 2.0 },
        { lon: 12.5, lat: 41.9, count: 25, color: '#ffd27a', rad: 2.0 },
        { lon: 37.6, lat: 55.7, count: 30, color: '#38bdf8', rad: 2.0 },
        // North America
        { lon: -74.0, lat: 40.7, count: 45, color: '#38bdf8', rad: 3.0 },
        { lon: -118.2, lat: 34.0, count: 35, color: '#ffd27a', rad: 2.8 },
        { lon: -87.6, lat: 41.8, count: 30, color: '#38bdf8', rad: 2.5 },
        // Asia
        { lon: 139.7, lat: 35.6, count: 45, color: '#38bdf8', rad: 3.0 },
        { lon: 121.5, lat: 31.2, count: 40, color: '#ffd27a', rad: 2.8 },
        { lon: 103.8, lat: 1.3, count: 30, color: '#fbab15', rad: 2.5 },
        { lon: 77.2, lat: 28.6, count: 35, color: '#ffd27a', rad: 2.5 }
    ];

    cityClusters.forEach((cluster) => {
        const cx = toCanvasX(cluster.lon);
        const cy = toCanvasY(cluster.lat);

        for (let i = 0; i < cluster.count; i++) {
            const offsetDist = Math.random() * (cluster.count > 30 ? 24 : 14);
            const angle = Math.random() * Math.PI * 2;
            const px = cx + Math.cos(angle) * offsetDist;
            const py = cy + Math.sin(angle) * offsetDist;
            const size = Math.random() * cluster.rad + 0.8;

            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fillStyle = cluster.color;
            ctx.shadowColor = cluster.color;
            ctx.shadowBlur = size * 4;
            ctx.fill();
        }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
};

// Generate Clouds Layer
const createProceduralCloudTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 160; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 45 + 15;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
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

    // State for interactive tooltip position
    const [pinScreenPos, setPinScreenPos] = useState({ x: 0, y: 0, visible: false });
    const [locationInfo, setLocationInfo] = useState({
        name: 'جاري تحديد موقعك...',
        lat: 31.95,
        lon: 35.23,
        accuracy: null
    });
    const [isLocating, setIsLocating] = useState(false);
    const [userInteracting, setUserInteracting] = useState(false);

    // Target angles and zoom
    const targetRotationRef = useRef({ x: 0.2, y: 0 });
    const currentRotationRef = useRef({ x: 0.2, y: 0 });
    const targetCameraDistRef = useRef(230);
    const currentCameraDistRef = useRef(230);
    const isFocusedRef = useRef(false);

    // Track active pinpoint
    const activeCoordsRef = useRef({ lat: 31.95, lon: 35.23 });

    // Fly camera smoothly to target lat/lon
    const flyToCoordinates = useCallback((lat, lon, zoomDist = 145) => {
        isFocusedRef.current = true;
        const targetRotY = -((lon + 180) * (Math.PI / 180)) + Math.PI / 2;
        const targetRotX = (lat * (Math.PI / 180)) * 0.7;

        targetRotationRef.current = { x: targetRotX, y: targetRotY };
        targetCameraDistRef.current = zoomDist;

        if (pinGroupRef.current) {
            const GLOBE_RADIUS = 85;
            const pinPos = latLongToVector3(lat, lon, GLOBE_RADIUS);
            pinGroupRef.current.position.copy(pinPos);

            const normal = pinPos.clone().normalize();
            pinGroupRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            pinGroupRef.current.visible = true;
        }
    }, []);

    // Request user location with high accuracy
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

                    flyToCoordinates(lat, lon, 140);
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
                    flyToCoordinates(lat, lon, 145);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        } else {
            setIsLocating(false);
        }
    }, [onLocationFound, flyToCoordinates]);

    // Watch targetCity changes
    useEffect(() => {
        if (targetCity && targetCity.lat && targetCity.lon) {
            activeCoordsRef.current = { lat: targetCity.lat, lon: targetCity.lon };
            setLocationInfo({
                name: targetCity.name || 'المدينة المحددة',
                lat: targetCity.lat,
                lon: targetCity.lon,
                accuracy: targetCity.accuracy || 15
            });
            flyToCoordinates(targetCity.lat, targetCity.lon, 145);
        }
    }, [targetCity, flyToCoordinates]);

    // Initialize 3D Scene
    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
        camera.position.z = currentCameraDistRef.current;
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
        sunLight.position.set(250, 120, 200);
        scene.add(sunLight);

        const blueBackLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
        blueBackLight.position.set(-200, -100, -150);
        scene.add(blueBackLight);

        const amberAccent = new THREE.PointLight(0xfbab15, 2.5, 400);
        amberAccent.position.set(100, 100, 150);
        scene.add(amberAccent);

        // --- Starfield Background ---
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1200;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 450 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);

            starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i + 2] = r * Math.cos(phi);

            const colorType = Math.random();
            if (colorType > 0.7) {
                starColors[i] = 0.98; starColors[i + 1] = 0.67; starColors[i + 2] = 0.08;
            } else if (colorType > 0.4) {
                starColors[i] = 0.22; starColors[i + 1] = 0.74; starColors[i + 2] = 0.97;
            } else {
                starColors[i] = 0.95; starColors[i + 1] = 0.95; starColors[i + 2] = 1.0;
            }
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

        const starMat = new THREE.PointsMaterial({
            size: 2.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.85
        });
        const starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);

        // --- 3D Earth Mesh ---
        const GLOBE_RADIUS = 85;
        const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
        const earthTexture = createProceduralEarthTexture();
        const earthMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            roughness: 0.55,
            metalness: 0.25,
            bumpScale: 0.05
        });
        const earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);
        globeRef.current = earth;

        // --- Atmosphere Glow Mesh ---
        const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 48, 48);
        const atmoMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
        scene.add(atmosphere);

        // --- Outer Amber Atmosphere Halo ---
        const haloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.07, 48, 48);
        const haloMat = new THREE.MeshBasicMaterial({
            color: 0xfbab15,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        scene.add(halo);

        // --- Clouds Sphere ---
        const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 48, 48);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: createProceduralCloudTexture(),
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending
        });
        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        scene.add(clouds);
        cloudsRef.current = clouds;

        // --- Orbital Rings ---
        const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.35, GLOBE_RADIUS * 1.37, 64);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xfbab15,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.25
        });
        const orbitalRing = new THREE.Mesh(ringGeo, ringMat);
        orbitalRing.rotation.x = Math.PI / 2.3;
        orbitalRing.rotation.y = Math.PI / 8;
        scene.add(orbitalRing);

        const ring2Geo = new THREE.RingGeometry(GLOBE_RADIUS * 1.55, GLOBE_RADIUS * 1.56, 64);
        const ring2Mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.18
        });
        const orbitalRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
        orbitalRing2.rotation.x = Math.PI / 1.7;
        orbitalRing2.rotation.y = -Math.PI / 6;
        scene.add(orbitalRing2);

        // --- 3D User Location Pin & Radar Ripples ---
        const pinGroup = new THREE.Group();

        const stemGeo = new THREE.CylinderGeometry(0.5, 0.2, 7, 16);
        stemGeo.translate(0, 3.5, 0);
        const stemMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        pinGroup.add(stem);

        const headGeo = new THREE.SphereGeometry(2.4, 16, 16);
        headGeo.translate(0, 7.5, 0);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xfbab15,
            emissive: 0xfbab15,
            emissiveIntensity: 1.2,
            roughness: 0.2
        });
        const head = new THREE.Mesh(headGeo, headMat);
        pinGroup.add(head);

        const ripple1Geo = new THREE.RingGeometry(0.8, 2.2, 32);
        ripple1Geo.rotateX(-Math.PI / 2);
        const ripple1Mat = new THREE.MeshBasicMaterial({
            color: 0xfbab15,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        const ripple1 = new THREE.Mesh(ripple1Geo, ripple1Mat);
        pinGroup.add(ripple1);

        const ripple2Geo = new THREE.RingGeometry(1.5, 3.8, 32);
        ripple2Geo.rotateX(-Math.PI / 2);
        const ripple2Mat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const ripple2 = new THREE.Mesh(ripple2Geo, ripple2Mat);
        pinGroup.add(ripple2);

        scene.add(pinGroup);
        pinGroup.visible = false;
        pinGroupRef.current = pinGroup;

        // Auto trigger location
        const autoLocateTimer = setTimeout(() => {
            requestLocation();
        }, 600);

        // Mouse handlers
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

            targetRotationRef.current.y += deltaX * 0.006;
            targetRotationRef.current.x = Math.max(-1.2, Math.min(1.2, targetRotationRef.current.x + deltaY * 0.006));
        };

        const onMouseUp = () => {
            isDragging = false;
            setTimeout(() => setUserInteracting(false), 2500);
        };

        const onWheel = (e) => {
            if (e.target !== renderer.domElement) return;
            targetCameraDistRef.current = Math.max(120, Math.min(320, targetCameraDistRef.current + e.deltaY * 0.15));
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
                targetRotationRef.current.y += 0.003;
            }

            currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.06;
            currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.06;
            currentCameraDistRef.current += (targetCameraDistRef.current - currentCameraDistRef.current) * 0.06;

            if (globeRef.current) {
                globeRef.current.rotation.x = currentRotationRef.current.x;
                globeRef.current.rotation.y = currentRotationRef.current.y;
            }
            if (cloudsRef.current) {
                cloudsRef.current.rotation.x = currentRotationRef.current.x * 1.05;
                cloudsRef.current.rotation.y = currentRotationRef.current.y + elapsed * 0.015;
            }

            if (pinGroupRef.current && pinGroupRef.current.visible) {
                const GLOBE_RADIUS = 85;
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

                const scale1 = 1 + Math.sin(elapsed * 4) * 0.4;
                const scale2 = 1 + Math.cos(elapsed * 3) * 0.5;
                ripple1.scale.set(scale1, scale1, scale1);
                ripple2.scale.set(scale2, scale2, scale2);

                const screenVec = basePos.clone().add(normal.clone().multiplyScalar(10));
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
            starField.rotation.y = elapsed * 0.002;
            orbitalRing.rotation.z = elapsed * 0.02;
            orbitalRing2.rotation.z = -elapsed * 0.015;

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
        <div className={`earth-globe-wrapper ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* 3D WebGL Canvas */}
            <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

            {/* Floating 3D Target Marker HUD on Globe */}
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
                            <span>Lat: {locationInfo.lat}° N</span>
                            <span>Lon: {locationInfo.lon}° E</span>
                        </div>
                        {locationInfo.accuracy && (
                            <div className="pin-hud-badge">دقة الاستشعار: ±{locationInfo.accuracy}م</div>
                        )}
                    </div>
                </div>
            )}

            {/* Globe Quick Overlay Controls */}
            <div className="globe-quick-controls">
                <button
                    className={`btn-locate-action ${isLocating ? 'loading' : ''}`}
                    onClick={requestLocation}
                    title="التقريب إلى موقعي الفعلي"
                >
                    <span className="locate-icon">🎯</span>
                    <span>{isLocating ? 'جارٍ الرصد...' : 'التقريب لموقعي'}</span>
                </button>

                <div className="globe-city-pills">
                    {[
                        { name: 'القدس', lat: 31.7683, lon: 35.2137 },
                        { name: 'رام الله', lat: 31.9038, lon: 35.2034 },
                        { name: 'غزة', lat: 31.5017, lon: 34.4668 },
                        { name: 'عمان', lat: 31.9454, lon: 35.9284 },
                        { name: 'دبي', lat: 25.2048, lon: 55.2708 },
                        { name: 'الرياض', lat: 24.7136, lon: 46.6753 }
                    ].map((city) => (
                        <button
                            key={city.name}
                            className="city-pill-btn"
                            onClick={() => flyToCoordinates(city.lat, city.lon, 145)}
                        >
                            {city.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
