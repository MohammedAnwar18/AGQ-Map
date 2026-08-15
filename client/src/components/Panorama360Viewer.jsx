import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { shopService, getImageUrl } from '../services/api';
import './Panorama360Viewer.css';

// ── Small icons ──────────────────────────────────────────────────────────
const GlobeIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
    </svg>
);

const ArrowIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </svg>
);

const TagIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.36-4.36a2 2 0 0 0 0-2.82Z" />
        <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
);

// ── Placeholder texture when a panorama has no image yet ──────────────────
const createPlaceholderTexture = (label) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
    sky.addColorStop(0, '#0f1e3a');
    sky.addColorStop(1, '#1a4a7a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.55);
    const ground = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    ground.addColorStop(0, '#3a5c3a');
    ground.addColorStop(1, '#1a2e1a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 56px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'صورة 360', canvas.width / 2, canvas.height * 0.42);
    return new THREE.CanvasTexture(canvas);
};

const CLICK_MOVE_THRESHOLD = 8;

const Panorama360Viewer = ({ shopId, shopName, isAdmin, initialPanoramas, onClose }) => {
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const meshRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const rafRef = useRef(null);

    const isDragging = useRef(false);
    const prevMouseRef = useRef({ x: 0, y: 0 });
    const downPosRef = useRef({ x: 0, y: 0 });
    const lonRef = useRef(0);
    const latRef = useRef(0);
    const pinchStartDistRef = useRef(null);
    const pinchStartFovRef = useRef(75);

    const [panoramas, setPanoramas] = useState(initialPanoramas || []);
    const [loading, setLoading] = useState(!initialPanoramas);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const currentIdRef = useRef(null);
    const [currentId, setCurrentId] = useState(null);
    const [isTransition, setIsTransition] = useState(false);
    const [hotspotPos, setHotspotPos] = useState([]);
    const [showControls, setShowControls] = useState(true);

    const [editMode, setEditMode] = useState(false);
    const [infoCard, setInfoCard] = useState(null); // hotspot object being shown to a normal viewer
    const [hotspotForm, setHotspotForm] = useState(null); // { mode: 'create'|'edit', point?, hotspot? }
    const [uploadingPano, setUploadingPano] = useState(false);
    const fileInputRef = useRef(null);

    // ── Data helpers ────────────────────────────────────────────────────
    const panoramasRef = useRef(panoramas);
    useEffect(() => { panoramasRef.current = panoramas; }, [panoramas]);

    const getPanorama = useCallback((id) => panoramas.find(p => p.id === id) || panoramas[0], [panoramas]);
    const getPanoramaLive = useCallback((id) => panoramasRef.current.find(p => p.id === id) || panoramasRef.current[0], []);

    const refreshPanoramas = useCallback(async (keepId) => {
        try {
            const data = await shopService.getPanoramas(shopId);
            const list = data.panoramas || [];
            setPanoramas(list);
            if (list.length) {
                const stillExists = keepId && list.some(p => p.id === keepId);
                const nextId = stillExists ? keepId : list[0].id;
                currentIdRef.current = nextId;
                setCurrentId(nextId);
            }
            return list;
        } catch (e) {
            console.error('refreshPanoramas error:', e);
            return panoramas;
        }
    }, [shopId, panoramas]);

    // Initial fetch (if not provided)
    useEffect(() => {
        if (initialPanoramas && initialPanoramas.length) {
            currentIdRef.current = initialPanoramas[0].id;
            setCurrentId(initialPanoramas[0].id);
            setLoading(false);
            return;
        }
        (async () => {
            setLoading(true);
            try {
                const data = await shopService.getPanoramas(shopId);
                const list = data.panoramas || [];
                setPanoramas(list);
                if (list.length) {
                    currentIdRef.current = list[0].id;
                    setCurrentId(list[0].id);
                } else {
                    setError('no-panoramas');
                }
            } catch (e) {
                console.error('getPanoramas error:', e);
                setError('load-failed');
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopId]);

    // ── Screen <-> sphere angle helpers ─────────────────────────────────
    const projectHotspot = useCallback((yaw, pitch, camera, width, height) => {
        const phi = THREE.MathUtils.degToRad(90 - (pitch || 0));
        const theta = THREE.MathUtils.degToRad(yaw);
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

    const screenToYawPitch = useCallback((clientX, clientY) => {
        if (!containerRef.current || !meshRef.current || !cameraRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(mouse, cameraRef.current);
        const intersects = raycasterRef.current.intersectObject(meshRef.current);
        if (!intersects.length) return null;
        const p = intersects[0].point;
        const r = p.length();
        const phi = Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1));
        const theta = Math.atan2(p.z, p.x);
        let yaw = THREE.MathUtils.radToDeg(theta);
        if (yaw < 0) yaw += 360;
        const pitch = 90 - THREE.MathUtils.radToDeg(phi);
        return { yaw, pitch };
    }, []);

    // ── Texture loading ──────────────────────────────────────────────────
    const loadTexture = useCallback((panorama) => {
        if (!meshRef.current) return;
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        const src = panorama?.equirect_url ? getImageUrl(panorama.equirect_url) : null;

        const applyTexture = (tex) => {
            if (!meshRef.current) return;
            const old = meshRef.current.material.map;
            meshRef.current.material.map = tex;
            meshRef.current.material.needsUpdate = true;
            if (old) old.dispose();
            setIsTransition(false);
        };

        if (src) {
            loader.load(src, applyTexture, undefined, () => applyTexture(createPlaceholderTexture(panorama.title)));
        } else {
            applyTexture(createPlaceholderTexture(panorama?.title));
        }
    }, []);

    const navigateTo = useCallback((targetId) => {
        if (isTransition || !targetId) return;
        setIsTransition(true);
        setInfoCard(null);
        currentIdRef.current = targetId;
        setCurrentId(targetId);
        const pano = panoramas.find(p => p.id === targetId);
        if (pano) loadTexture(pano);
    }, [isTransition, panoramas, loadTexture]);

    // ── Three.js scene init (once panoramas are ready) ───────────────────
    useEffect(() => {
        if (loading || !panoramas.length || !containerRef.current) return;

        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        camera.position.set(0, 0, 0.1);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.current.appendChild(renderer.domElement);

        const geo = new THREE.SphereGeometry(500, 60, 40);
        geo.scale(-1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({ map: null });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);

        sceneRef.current = scene;
        cameraRef.current = camera;
        rendererRef.current = renderer;
        meshRef.current = mesh;

        loadTexture(getPanorama(currentIdRef.current));

        const animate = () => {
            rafRef.current = requestAnimationFrame(animate);
            const lat = Math.max(-85, Math.min(85, latRef.current));
            const phi = THREE.MathUtils.degToRad(90 - lat);
            const theta = THREE.MathUtils.degToRad(lonRef.current);
            camera.lookAt(
                500 * Math.sin(phi) * Math.cos(theta),
                500 * Math.cos(phi),
                500 * Math.sin(phi) * Math.sin(theta)
            );
            renderer.render(scene, camera);

            const cw = containerRef.current?.clientWidth || w;
            const ch = containerRef.current?.clientHeight || h;
            const pano = getPanoramaLive(currentIdRef.current);
            if (pano?.hotspots?.length) {
                setHotspotPos(pano.hotspots.map(hs => ({ ...hs, ...projectHotspot(hs.yaw, hs.pitch, camera, cw, ch) })));
            } else {
                setHotspotPos([]);
            }
        };
        animate();

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, panoramas.length === 0]);

    // Swap texture whenever currentId changes (after the scene already exists)
    useEffect(() => {
        if (!meshRef.current || !currentId) return;
        const pano = getPanorama(currentId);
        if (pano) loadTexture(pano);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentId]);

    // ── Pointer / touch interaction ───────────────────────────────────────
    const getPoint = (e) => ({
        x: e.clientX ?? e.touches?.[0]?.clientX,
        y: e.clientY ?? e.touches?.[0]?.clientY
    });

    const onPointerDown = useCallback((e) => {
        if (e.touches && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchStartDistRef.current = Math.hypot(dx, dy);
            pinchStartFovRef.current = cameraRef.current?.fov || 75;
            isDragging.current = false;
            return;
        }
        isDragging.current = true;
        const { x, y } = getPoint(e);
        downPosRef.current = { x, y };
        prevMouseRef.current = { x, y, lon: lonRef.current, lat: latRef.current };
    }, []);

    const onPointerMove = useCallback((e) => {
        if (e.touches && e.touches.length === 2 && pinchStartDistRef.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = pinchStartDistRef.current / Math.max(dist, 1);
            if (cameraRef.current) {
                cameraRef.current.fov = THREE.MathUtils.clamp(pinchStartFovRef.current * ratio, 20, 100);
                cameraRef.current.updateProjectionMatrix();
            }
            return;
        }
        if (!isDragging.current) return;
        const { x, y } = getPoint(e);
        lonRef.current = (prevMouseRef.current.x - x) * 0.1 + prevMouseRef.current.lon;
        latRef.current = (y - prevMouseRef.current.y) * 0.1 + prevMouseRef.current.lat;
    }, []);

    const onPointerUp = useCallback((e) => {
        pinchStartDistRef.current = null;
        if (!isDragging.current) return;
        isDragging.current = false;

        const { x, y } = getPoint(e) || {};
        if (x === undefined) return;
        const moved = Math.hypot(x - downPosRef.current.x, y - downPosRef.current.y);
        if (moved > CLICK_MOVE_THRESHOLD) return; // was a drag, not a tap

        if (editMode) {
            const angles = screenToYawPitch(x, y);
            if (angles) {
                setHotspotForm({ mode: 'create', point: angles });
            }
        }
    }, [editMode, screenToYawPitch]);

    const onWheel = useCallback((e) => {
        if (!cameraRef.current) return;
        const fov = THREE.MathUtils.clamp(cameraRef.current.fov + e.deltaY * 0.05, 20, 100);
        cameraRef.current.fov = fov;
        cameraRef.current.updateProjectionMatrix();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setShowControls(false), 4000);
        return () => clearTimeout(t);
    }, [currentId]);

    // ── Admin actions ──────────────────────────────────────────────────
    const handleHotspotClick = (hs) => {
        if (editMode) {
            setHotspotForm({ mode: 'edit', hotspot: hs });
        } else if (hs.type === 'link') {
            navigateTo(hs.target_panorama_id);
        } else {
            setInfoCard(hs);
        }
    };

    const handleDeleteHotspot = async (e, hotspotId) => {
        e.stopPropagation();
        if (!window.confirm('حذف هذه النقطة؟')) return;
        setBusy(true);
        try {
            await shopService.deletePanoramaHotspot(hotspotId);
            await refreshPanoramas(currentId);
        } catch (err) {
            console.error('deleteHotspot error:', err);
            alert('فشل حذف النقطة');
        } finally {
            setBusy(false);
        }
    };

    const submitHotspotForm = async (values) => {
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append('type', values.type);
            fd.append('label', values.label || '');
            fd.append('value', values.value || '');
            if (values.type === 'link' && values.target_panorama_id) {
                fd.append('target_panorama_id', values.target_panorama_id);
            }
            if (values.imageFile) fd.append('image', values.imageFile);

            if (hotspotForm.mode === 'create') {
                fd.append('yaw', hotspotForm.point.yaw);
                fd.append('pitch', hotspotForm.point.pitch);
                await shopService.addPanoramaHotspot(currentId, fd);
            } else {
                await shopService.updatePanoramaHotspot(hotspotForm.hotspot.id, fd);
            }
            setHotspotForm(null);
            await refreshPanoramas(currentId);
        } catch (err) {
            console.error('submitHotspotForm error:', err);
            alert('فشل حفظ النقطة');
        } finally {
            setBusy(false);
        }
    };

    const handleUploadPanorama = async (file) => {
        if (!file) return;
        setUploadingPano(true);
        try {
            const fd = new FormData();
            fd.append('title', `صورة ${panoramas.length + 1}`);
            fd.append('equirect_file', file);
            const created = await shopService.addPanorama(shopId, fd);
            const list = await refreshPanoramas(created.id);
            const target = list.find(p => p.id === created.id);
            if (target) navigateTo(target.id);
        } catch (err) {
            console.error('addPanorama error:', err);
            alert('فشل رفع الصورة');
        } finally {
            setUploadingPano(false);
        }
    };

    const handleDeletePanorama = async (panoramaId) => {
        if (panoramas.length <= 1) {
            alert('لا يمكن حذف آخر صورة');
            return;
        }
        if (!window.confirm('حذف هذه الصورة وكل النقاط عليها؟')) return;
        setBusy(true);
        try {
            await shopService.deletePanorama(panoramaId);
            await refreshPanoramas(panoramaId === currentId ? null : currentId);
        } catch (err) {
            console.error('deletePanorama error:', err);
            alert('فشل حذف الصورة');
        } finally {
            setBusy(false);
        }
    };

    const movePanorama = async (index, direction) => {
        const list = [...panoramas];
        const target = index + direction;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        setPanoramas(list);
        try {
            await shopService.reorderPanoramas(list.map(p => p.id));
        } catch (err) {
            console.error('reorderPanoramas error:', err);
        }
    };

    // ── Render ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p360-overlay" onClick={e => e.stopPropagation()}>
                <div className="p360-center-msg">
                    <div className="p360-spinner" />
                    <span>جاري تحميل الجولة...</span>
                </div>
                <button className="p360-close-btn p360-close-standalone" onClick={onClose}>✕</button>
            </div>
        );
    }

    if (!panoramas.length) {
        return (
            <div className="p360-overlay" onClick={e => e.stopPropagation()}>
                <div className="p360-center-msg">
                    <GlobeIcon size={40} />
                    <span>لا توجد صور 360° لهذا المحل بعد</span>
                    {isAdmin && (
                        <>
                            <button className="p360-btn p360-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadingPano}>
                                {uploadingPano ? 'جاري الرفع...' : '+ إضافة أول صورة 360'}
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                                onChange={e => handleUploadPanorama(e.target.files?.[0])} />
                        </>
                    )}
                </div>
                <button className="p360-close-btn p360-close-standalone" onClick={onClose}>✕</button>
            </div>
        );
    }

    const currentPano = getPanorama(currentId);

    return (
        <div className="p360-overlay" onClick={e => e.stopPropagation()}>
            {/* Top bar */}
            <div className="p360-topbar">
                <div className="p360-topbar-left">
                    <div className="p360-globe-icon"><GlobeIcon /></div>
                    <div className="p360-info">
                        <span className="p360-shop-name">{shopName}</span>
                        <span className="p360-pano-title">{currentPano?.title || '360°'}</span>
                    </div>
                </div>
                <div className="p360-topbar-right">
                    {isAdmin && (
                        <button
                            className={`p360-btn p360-edit-toggle ${editMode ? 'active' : ''}`}
                            onClick={() => setEditMode(v => !v)}
                        >
                            {editMode ? 'إنهاء التعديل' : 'وضع التعديل'}
                        </button>
                    )}
                    <button className="p360-close-btn" onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className={`p360-canvas-area ${editMode ? 'editing' : ''}`}
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
                onWheel={onWheel}
            />

            {isTransition && <div className="p360-transition-fade" />}
            {busy && <div className="p360-busy-overlay"><div className="p360-spinner" /></div>}

            {/* Hotspots */}
            {hotspotPos.map(hs => hs.visible && (
                <div key={hs.id} className="p360-hotspot" style={{ left: hs.x, top: hs.y }}>
                    <button
                        className={`p360-hotspot-btn ${hs.type === 'link' ? 'link' : 'info'}`}
                        onClick={() => handleHotspotClick(hs)}
                    >
                        {hs.type === 'link' ? <ArrowIcon /> : <TagIcon />}
                    </button>
                    {hs.label && <span className="p360-hotspot-label">{hs.label}</span>}
                    {editMode && (
                        <button className="p360-hotspot-delete" onClick={(e) => handleDeleteHotspot(e, hs.id)}>×</button>
                    )}
                </div>
            ))}

            {/* Bottom thumbnail strip */}
            <div className="p360-pano-strip">
                {panoramas.map((pano, idx) => (
                    <div key={pano.id} className={`p360-pano-thumb-wrap ${pano.id === currentId ? 'active' : ''}`}>
                        <button className="p360-pano-thumb" onClick={() => navigateTo(pano.id)}>
                            <GlobeIcon size={16} />
                            <span>{pano.title || `صورة ${idx + 1}`}</span>
                        </button>
                        {editMode && (
                            <div className="p360-thumb-admin-row">
                                <button title="تحريك للأعلى" onClick={() => movePanorama(idx, -1)} disabled={idx === 0}>↑</button>
                                <button title="تحريك للأسفل" onClick={() => movePanorama(idx, 1)} disabled={idx === panoramas.length - 1}>↓</button>
                                <button title="حذف" className="danger" onClick={() => handleDeletePanorama(pano.id)}>×</button>
                            </div>
                        )}
                    </div>
                ))}
                {editMode && (
                    <>
                        <button className="p360-add-pano-btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingPano}>
                            {uploadingPano ? '...' : '+'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { handleUploadPanorama(e.target.files?.[0]); e.target.value = ''; }} />
                    </>
                )}
            </div>

            {showControls && !editMode && (
                <div className="p360-hint">اسحب للتدوير · عجلة الفأرة أو التقريب بإصبعين للتكبير</div>
            )}
            {editMode && (
                <div className="p360-hint p360-hint-edit">اضغط بأي مكان على الصورة لإضافة نقطة جديدة</div>
            )}

            {/* Info card (viewer clicking an info hotspot) */}
            {infoCard && (
                <div className="p360-info-card-overlay" onClick={() => setInfoCard(null)}>
                    <div className="p360-info-card" onClick={e => e.stopPropagation()}>
                        <button className="p360-info-card-close" onClick={() => setInfoCard(null)}>✕</button>
                        {infoCard.image_url && (
                            <img className="p360-info-card-img" src={getImageUrl(infoCard.image_url)} alt={infoCard.label || ''} />
                        )}
                        <h3>{infoCard.label}</h3>
                        {infoCard.value && <p>{infoCard.value}</p>}
                    </div>
                </div>
            )}

            {/* Admin hotspot create/edit form */}
            {hotspotForm && (
                <HotspotForm
                    mode={hotspotForm.mode}
                    initial={hotspotForm.hotspot}
                    panoramaOptions={panoramas.filter(p => p.id !== currentId)}
                    busy={busy}
                    onCancel={() => setHotspotForm(null)}
                    onSubmit={submitHotspotForm}
                />
            )}
        </div>
    );
};

// ── Admin hotspot form (create / edit) ─────────────────────────────────
const HotspotForm = ({ mode, initial, panoramaOptions, busy, onCancel, onSubmit }) => {
    const [type, setType] = useState(initial?.type || 'info');
    const [label, setLabel] = useState(initial?.label || '');
    const [value, setValue] = useState(initial?.value || '');
    const [targetId, setTargetId] = useState(initial?.target_panorama_id || (panoramaOptions[0]?.id || ''));
    const [imageFile, setImageFile] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!label.trim()) { alert('الرجاء إدخال عنوان للنقطة'); return; }
        if (type === 'link' && !targetId) { alert('الرجاء اختيار الصورة الهدف'); return; }
        onSubmit({ type, label: label.trim(), value: value.trim(), target_panorama_id: targetId, imageFile });
    };

    return (
        <div className="p360-form-overlay" onClick={onCancel}>
            <form className="p360-form" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
                <h3>{mode === 'create' ? 'إضافة نقطة جديدة' : 'تعديل النقطة'}</h3>

                <label className="p360-form-label">النوع</label>
                <div className="p360-type-toggle">
                    <button type="button" className={type === 'info' ? 'active' : ''} onClick={() => setType('info')}>معلومة / بضاعة</button>
                    <button type="button" className={type === 'link' ? 'active' : ''} onClick={() => setType('link')}>رابط تنقل لصورة أخرى</button>
                </div>

                <label className="p360-form-label">العنوان</label>
                <input className="p360-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="مثال: بضاعة، مدخل القاعة..." autoFocus />

                {type === 'info' ? (
                    <>
                        <label className="p360-form-label">التفاصيل (اختياري)</label>
                        <textarea className="p360-textarea" value={value} onChange={e => setValue(e.target.value)} rows={3} placeholder="وصف، سعر، ملاحظات..." />
                        <label className="p360-form-label">صورة (اختياري)</label>
                        <input className="p360-input" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                    </>
                ) : (
                    <>
                        <label className="p360-form-label">الانتقال إلى</label>
                        {panoramaOptions.length ? (
                            <select className="p360-input" value={targetId} onChange={e => setTargetId(e.target.value)}>
                                {panoramaOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        ) : (
                            <p className="p360-form-note">أضف صورة 360 أخرى أولاً لتتمكن من الربط بها.</p>
                        )}
                    </>
                )}

                <div className="p360-form-actions">
                    <button type="button" className="p360-btn" onClick={onCancel} disabled={busy}>إلغاء</button>
                    <button type="submit" className="p360-btn p360-btn-primary" disabled={busy || (type === 'link' && !panoramaOptions.length)}>
                        {busy ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Panorama360Viewer;
