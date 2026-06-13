import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import './VirtualTourViewer.css';

// Creates a canvas-based placeholder texture when no image is provided
const createPlaceholderTexture = (label) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
    sky.addColorStop(0, '#0f1e3a');
    sky.addColorStop(1, '#1a4a7a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.55);

    // Ground
    const ground = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    ground.addColorStop(0, '#3a5c3a');
    ground.addColorStop(1, '#1a2e1a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

    // Grid lines on ground for depth effect
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, canvas.height * 0.55);
        ctx.lineTo(i * (canvas.width / 20), canvas.height);
        ctx.stroke();
    }
    for (let j = 1; j < 5; j++) {
        const y = canvas.height * 0.55 + j * (canvas.height * 0.45 / 5);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Label text
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, canvas.height * 0.42);

    ctx.fillStyle = 'rgba(251,171,21,0.85)';
    ctx.font = '36px Arial';
    ctx.fillText('أضف صورة 360° لهذه النقطة', canvas.width / 2, canvas.height * 0.42 + 70);

    return new THREE.CanvasTexture(canvas);
};

const VirtualTourViewer = ({ location, onClose }) => {
    const containerRef = useRef(null);

    // Three.js refs — never trigger re-renders
    const sceneRef    = useRef(null);
    const cameraRef   = useRef(null);
    const rendererRef = useRef(null);
    const meshRef     = useRef(null);
    const rafRef      = useRef(null);

    // Interaction state refs
    const isDragging      = useRef(false);
    const prevMouseRef    = useRef({ x: 0, y: 0 });
    const lonRef          = useRef(0);
    const latRef          = useRef(0);

    // Current panorama id tracked as ref so the animation loop can read it
    const currentIdRef = useRef(location.panoramas[0].id);

    // React state only for what drives UI re-renders
    const [currentId,    setCurrentId]    = useState(location.panoramas[0].id);
    const [isTransition, setIsTransition] = useState(false);
    const [hotspotPos,   setHotspotPos]   = useState([]);
    const [showControls, setShowControls] = useState(true);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getPanorama = useCallback(
        (id) => location.panoramas.find(p => p.id === id) || location.panoramas[0],
        [location]
    );

    // Converts a hotspot direction/pitch to projected 2D screen position
    const projectHotspot = useCallback((direction, pitch, camera, width, height) => {
        const phi   = THREE.MathUtils.degToRad(90 - (pitch || 0));
        const theta = THREE.MathUtils.degToRad(direction);
        const world = new THREE.Vector3(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
        );
        world.project(camera);
        return {
            x: (world.x * 0.5 + 0.5) * width,
            y: (-world.y * 0.5 + 0.5) * height,
            visible: world.z < 1
        };
    }, []);

    // ── Load / swap texture ───────────────────────────────────────────────────

    const loadTexture = useCallback((panorama) => {
        if (!meshRef.current) return;
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');

        if (panorama.image) {
            loader.load(
                panorama.image,
                (tex) => {
                    if (!meshRef.current) return;
                    const old = meshRef.current.material.map;
                    meshRef.current.material.map = tex;
                    meshRef.current.material.needsUpdate = true;
                    if (old) old.dispose();
                    setIsTransition(false);
                },
                undefined,
                () => {
                    const tex = createPlaceholderTexture(panorama.label);
                    if (!meshRef.current) return;
                    const old = meshRef.current.material.map;
                    meshRef.current.material.map = tex;
                    meshRef.current.material.needsUpdate = true;
                    if (old) old.dispose();
                    setIsTransition(false);
                }
            );
        } else {
            const tex = createPlaceholderTexture(panorama.label);
            const old = meshRef.current.material.map;
            meshRef.current.material.map = tex;
            meshRef.current.material.needsUpdate = true;
            if (old) old.dispose();
            setIsTransition(false);
        }
    }, []);

    // ── Navigate to another panorama ─────────────────────────────────────────

    const navigateTo = useCallback((targetId) => {
        if (isTransition) return;
        setIsTransition(true);
        currentIdRef.current = targetId;
        setCurrentId(targetId);
        const pano = getPanorama(targetId);
        loadTexture(pano);
    }, [isTransition, getPanorama, loadTexture]);

    // ── Three.js init — runs once ─────────────────────────────────────────────

    useEffect(() => {
        if (!containerRef.current) return;

        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;

        // Scene & camera
        const scene    = new THREE.Scene();
        const camera   = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        camera.position.set(0, 0, 0.1);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        // Sphere
        const geo  = new THREE.SphereGeometry(500, 60, 40);
        geo.scale(-1, 1, 1);
        const mat  = new THREE.MeshBasicMaterial({ map: null });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        sceneRef.current    = scene;
        cameraRef.current   = camera;
        rendererRef.current = renderer;
        meshRef.current     = mesh;

        // Load first panorama
        loadTexture(getPanorama(currentIdRef.current));

        // ── Animation loop ─────────────────────────────────────────────────
        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);

            const lat = Math.max(-85, Math.min(85, latRef.current));
            const phi   = THREE.MathUtils.degToRad(90 - lat);
            const theta = THREE.MathUtils.degToRad(lonRef.current);

            camera.lookAt(
                500 * Math.sin(phi) * Math.cos(theta),
                500 * Math.cos(phi),
                500 * Math.sin(phi) * Math.sin(theta)
            );
            renderer.render(scene, camera);

            // Update hotspot 2D positions every frame
            const cw = containerRef.current?.clientWidth  || w;
            const ch = containerRef.current?.clientHeight || h;
            const pano = getPanorama(currentIdRef.current);
            if (pano?.hotspots?.length) {
                const positions = pano.hotspots.map(hs =>
                    ({ ...hs, ...projectHotspot(hs.direction, hs.pitch, camera, cw, ch) })
                );
                setHotspotPos(positions);
            } else {
                setHotspotPos([]);
            }
        };
        animate();

        // ── Resize ────────────────────────────────────────────────────────
        const onResize = () => {
            if (!containerRef.current) return;
            const nw = containerRef.current.clientWidth;
            const nh = containerRef.current.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', onResize);
            if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geo.dispose();
            mat.dispose();
            if (mat.map) mat.map.dispose();
            renderer.dispose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Pointer / touch interaction ───────────────────────────────────────────

    const onPointerDown = useCallback((e) => {
        isDragging.current = true;
        const x = e.clientX ?? e.touches?.[0]?.clientX;
        const y = e.clientY ?? e.touches?.[0]?.clientY;
        prevMouseRef.current = { x, y, lon: lonRef.current, lat: latRef.current };
    }, []);

    const onPointerMove = useCallback((e) => {
        if (!isDragging.current) return;
        const x = e.clientX ?? e.touches?.[0]?.clientX;
        const y = e.clientY ?? e.touches?.[0]?.clientY;
        lonRef.current = (prevMouseRef.current.x - x) * 0.1 + prevMouseRef.current.lon;
        latRef.current = (y - prevMouseRef.current.y) * 0.1 + prevMouseRef.current.lat;
    }, []);

    const onPointerUp = useCallback(() => { isDragging.current = false; }, []);

    const onWheel = useCallback((e) => {
        if (!cameraRef.current) return;
        const fov = THREE.MathUtils.clamp(cameraRef.current.fov + e.deltaY * 0.05, 20, 100);
        cameraRef.current.fov = fov;
        cameraRef.current.updateProjectionMatrix();
    }, []);

    // Auto-hide controls hint
    useEffect(() => {
        const t = setTimeout(() => setShowControls(false), 4000);
        return () => clearTimeout(t);
    }, [currentId]);

    const currentPano = getPanorama(currentId);

    return (
        <div className="vtour-overlay">

            {/* ── Top bar ── */}
            <div className="vtour-topbar">
                <div className="vtour-topbar-left">
                    <div className="vtour-globe-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                            <path d="M2 12h20"/>
                        </svg>
                    </div>
                    <div className="vtour-info">
                        <span className="vtour-location-name">{location.name}</span>
                        <span className="vtour-pano-label">{currentPano.label}</span>
                    </div>
                </div>
                <button className="vtour-close-btn" onClick={onClose}>✕</button>
            </div>

            {/* ── Panorama canvas ── */}
            <div
                ref={containerRef}
                className="vtour-canvas-area"
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onWheel={onWheel}
            />

            {/* ── Transition fade ── */}
            {isTransition && <div className="vtour-transition-fade" />}

            {/* ── Hotspot arrows ── */}
            {hotspotPos.map((hs) =>
                hs.visible && (
                    <button
                        key={hs.targetId}
                        className="vtour-hotspot"
                        style={{ left: hs.x, top: hs.y }}
                        onClick={() => navigateTo(hs.targetId)}
                    >
                        <div className="vtour-hotspot-arrow">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="19" x2="12" y2="5"/>
                                <polyline points="5 12 12 5 19 12"/>
                            </svg>
                        </div>
                        <span className="vtour-hotspot-label">{hs.label}</span>
                    </button>
                )
            )}

            {/* ── Panorama thumbnails (bottom strip) ── */}
            <div className="vtour-pano-strip">
                {location.panoramas.map((pano) => (
                    <button
                        key={pano.id}
                        className={`vtour-pano-thumb ${pano.id === currentId ? 'active' : ''}`}
                        onClick={() => navigateTo(pano.id)}
                    >
                        <div className="vtour-thumb-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
                                <path d="M2 12h20"/>
                            </svg>
                        </div>
                        <span>{pano.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Controls hint ── */}
            {showControls && (
                <div className="vtour-hint">
                    اسحب للتدوير · عجلة الفأرة للتكبير · اضغط الأسهم للتنقل
                </div>
            )}
        </div>
    );
};

export default VirtualTourViewer;
