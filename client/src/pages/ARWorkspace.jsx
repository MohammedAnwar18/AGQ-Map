import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { arService } from '../services/api';
import './ARWorkspace.css';

export default function ARWorkspace() {
    const navigate = useNavigate();
    const { socket, token } = useAuth();

    // Auto login via pairToken query parameter (mobile scanning)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pairToken = params.get('pairToken');
        if (pairToken) {
            localStorage.setItem('token', pairToken);
            // Redirect to clean path without query parameters
            window.location.href = window.location.origin + window.location.pathname;
        }
    }, []);

    // Device selection / detection
    const [deviceMode, setDeviceMode] = useState(null); // 'mobile' | 'desktop'
    const [socketConnected, setSocketConnected] = useState(false);
    const [peerConnected, setPeerConnected] = useState(false);

    // Snapshot list
    const [captures, setCaptures] = useState([]);
    const [isCapturing, setIsCapturing] = useState(false);

    // Mobile camera refs
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);

    // Desktop Three.js refs
    const threeContainerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const orbitControlsRef = useRef(null);

    // QR pairing states
    const [showPairModal, setShowPairModal] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
        if (token && deviceMode === 'desktop') {
            const pairingUrl = `${window.location.origin}/ar-workspace?pairToken=${token}`;
            QRCode.toDataURL(pairingUrl, { width: 256, margin: 2 }, (err, url) => {
                if (!err) setQrCodeUrl(url);
            });
        }
    }, [token, deviceMode]);

    // Detect device type automatically
    useEffect(() => {
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isTouch || isMobileUA) {
            setDeviceMode('mobile');
        } else {
            setDeviceMode('desktop');
        }
    }, []);

    // Socket status checks
    useEffect(() => {
        if (!socket) return;
        setSocketConnected(socket.connected);

        const handleConnect = () => setSocketConnected(true);
        const handleDisconnect = () => {
            setSocketConnected(false);
            setPeerConnected(false);
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        // Tell peer we are online
        socket.emit('ar-spatial-update', { type: 'ping' });

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket]);

    // Add captured image as a plane in ThreeJS scene
    const addSpatialSnapshotToScene = (cap) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');

        let textureUrl = cap.dataUrl;
        if (textureUrl && textureUrl.startsWith('http') && !textureUrl.includes(window.location.hostname) && !textureUrl.includes('localhost')) {
            // Route through server proxy to bypass WebGL CORS policies
            textureUrl = `/api/tours/proxy?url=${encodeURIComponent(textureUrl)}`;
        }

        loader.load(
            textureUrl,
            (texture) => {
                // 16:9 aspect ratio plane
                const geometry = new THREE.PlaneGeometry(3.2, 1.8);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                    transparent: true
                });
                const plane = new THREE.Mesh(geometry, material);
                
                // Set position
                plane.position.set(cap.position.x, cap.position.y, cap.position.z);
                
                // Make plane face current desktop camera (or default origin)
                if (cameraRef.current) {
                    plane.lookAt(cameraRef.current.position);
                } else {
                    plane.lookAt(0, 1.2, 0);
                }

                // Add billboard border
                const borderGeo = new THREE.EdgesGeometry(geometry);
                const borderMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
                const border = new THREE.LineSegments(borderGeo, borderMat);
                plane.add(border);
                
                scene.add(plane);
            },
            undefined,
            (err) => {
                console.error("Failed to load spatial snapshot texture:", err);
            }
        );
    };

    // Handle incoming socket messages (on desktop)
    useEffect(() => {
        if (!socket) return;

        const handleSpatialUpdate = (data) => {
            if (data.type === 'ping') {
                setPeerConnected(true);
                socket.emit('ar-spatial-update', { type: 'pong' });
                return;
            }
            if (data.type === 'pong') {
                setPeerConnected(true);
                return;
            }

            setPeerConnected(true);

            if (deviceMode === 'desktop') {
                if (data.type === 'snapshot' && data.dataUrl) {
                    // Calculate spawn position in front of current OrbitControls camera
                    let spawnPos = { x: (Math.random() - 0.5) * 2, y: 1.2, z: -3 };
                    if (cameraRef.current) {
                        const dir = new THREE.Vector3();
                        cameraRef.current.getWorldDirection(dir);
                        const pos = new THREE.Vector3()
                            .copy(cameraRef.current.position)
                            .add(dir.multiplyScalar(4)); // 4 meters ahead
                        spawnPos = { x: pos.x, y: pos.y, z: pos.z };
                    }

                    const newCap = {
                        id: `cap-${Date.now()}`,
                        dataUrl: data.dataUrl,
                        timestamp: new Date().toLocaleTimeString(),
                        position: spawnPos
                    };
                    setCaptures(prev => [newCap, ...prev]);
                    addSpatialSnapshotToScene(newCap);
                }
            }
        };

        socket.on('ar-spatial-update', handleSpatialUpdate);
        return () => {
            socket.off('ar-spatial-update', handleSpatialUpdate);
        };
    }, [socket, deviceMode]);

    // Start camera stream on mobile
    useEffect(() => {
        if (deviceMode !== 'mobile') return;

        async function initCamera() {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false
                });
                if (videoRef.current) videoRef.current.srcObject = s;
                streamRef.current = s;
            } catch (err) {
                console.error("Camera access failed:", err);
            }
        }
        initCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [deviceMode]);

    // Capture Spatial Photo on mobile
    const handleSpatialCapture = async () => {
        if (isCapturing || !videoRef.current) return;
        setIsCapturing(true);

        try { if (navigator.vibrate) navigator.vibrate(100); } catch{}

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current || document.createElement('canvas');
            
            // Downscale to 640px for low-footprint payload
            let width = video.videoWidth || 640;
            let height = video.videoHeight || 480;
            const maxDim = 640;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.45); // JPEG quality 0.45

            // Upload compressed image to Cloudflare R2
            let finalImageUrl = null;
            try {
                const response = await arService.uploadSnapshot(dataUrl);
                if (response && response.success) {
                    finalImageUrl = response.imageUrl;
                }
            } catch (uploadErr) {
                console.error("R2 Upload failed, falling back to base64:", uploadErr);
            }

            if (socket) {
                socket.emit('ar-spatial-update', {
                    type: 'snapshot',
                    dataUrl: finalImageUrl || dataUrl
                });
            }
            
            // Flash feedback
            const flash = document.createElement('div');
            flash.className = 'ar-capture-flash';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 300);

        } catch (err) {
            console.error("Capture failed:", err);
        } finally {
            setIsCapturing(false);
        }
    };

    // Init Three.js (on desktop)
    useEffect(() => {
        if (deviceMode !== 'desktop') return;

        const container = threeContainerRef.current;
        if (!container) return;

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

        // Camera
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 3, 6);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0f172a, 1);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground
        controls.minDistance = 2;
        controls.maxDistance = 30;
        orbitControlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 15, 10);
        scene.add(dirLight);

        // Grid & Floor
        const gridHelper = new THREE.GridHelper(40, 40, 0x00f0ff, 0x1f2937);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        // Render loop
        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Resize handler
        const handleResize = () => {
            if (!container) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // Load existing snapshots
        captures.forEach(c => addSpatialSnapshotToScene(c));

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            if (rendererRef.current && rendererRef.current.domElement) {
                container.removeChild(rendererRef.current.domElement);
            }
            scene.traverse(node => {
                if (node instanceof THREE.Mesh) {
                    node.geometry.dispose();
                    if (Array.isArray(node.material)) {
                        node.material.forEach(m => m.dispose());
                    } else {
                        node.material.dispose();
                    }
                }
            });
        };
    }, [deviceMode]);

    const handleToggleMode = () => {
        if (deviceMode === 'mobile' && streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        setDeviceMode(prev => prev === 'mobile' ? 'desktop' : 'mobile');
    };

    return (
        <div className="arw-root font-outfit">
            
            {/* ─── GLOBAL SCI-FI TOP BAR ─── */}
            <header className="arw-header">
                <div className="arw-logo-group">
                    <button className="arw-back-btn" onClick={() => navigate('/map')} title="العودة للرئيسية">
                        ←
                    </button>
                    <div className="arw-logo-text">
                        <h2>جهاز عرض الصور ثلاثي الأبعاد</h2>
                        <span>مشروع الكاميرا الفضائية الفورية</span>
                    </div>
                </div>

                <div className="arw-status-bar">
                    <div className="arw-indicator">
                        <span className={`arw-dot ${socketConnected ? 'active' : ''}`} />
                        <span>الشبكة: {socketConnected ? 'متصل' : 'جاري الاتصال...'}</span>
                    </div>
                    <div className="arw-indicator">
                        <span className={`arw-dot ${peerConnected ? 'active' : ''}`} />
                        <span>الهاتف: {peerConnected ? 'متصل' : 'بانتظار مسح رمز QR...'}</span>
                    </div>
                    {deviceMode === 'desktop' && (
                        <button className="arw-pair-btn" onClick={() => setShowPairModal(true)}>
                            ربط كاميرا الهاتف 📱
                        </button>
                    )}
                    
                    <button className="arw-mode-toggle" onClick={handleToggleMode}>
                        محاكاة وضع {deviceMode === 'mobile' ? 'الكمبيوتر 💻' : 'الهاتف 📱'}
                    </button>
                </div>
            </header>

            {/* ─── MOBILE CONTROLLER VIEW ─── */}
            {deviceMode === 'mobile' && (
                <div className="arw-mobile-viewport">
                    <video ref={videoRef} autoPlay playsInline muted className="arw-mobile-video" />
                    <div className="arw-mobile-overlay-grid" />

                    <div className="arw-mobile-status-badge">
                        <span className={`status-dot ${socketConnected ? 'online' : 'offline'}`} />
                        <span>{socketConnected ? 'متصل بمساحة العمل 💻' : 'جاري الاتصال بمساحة العمل...'}</span>
                    </div>

                    <div className="arw-mobile-actions">
                        <button 
                            className={`arw-capture-btn ${isCapturing ? 'capturing' : ''}`}
                            onClick={handleSpatialCapture}
                            disabled={isCapturing}
                        >
                            <span className="btn-inner" />
                        </button>
                        <span className="btn-hint">انقر لالتقاط صورة وإرسالها فوراً لمتصفح الكمبيوتر 🚀</span>
                    </div>
                </div>
            )}

            {/* ─── DESKTOP 3D WORKSPACE VIEW ─── */}
            {deviceMode === 'desktop' && (
                <div className="arw-desktop-workspace single-sidebar">
                    
                    {/* MAIN Three.js CANVAS CONTAINER */}
                    <div ref={threeContainerRef} className="arw-canvas-container">
                        <div className="canvas-sci-fi-overlay" />
                    </div>

                    {/* RIGHT PANEL: Live Captures List */}
                    <aside className="arw-sidebar right">
                        <div className="sidebar-section">
                            <h3>الصور المستلمة من الهاتف ({captures.length})</h3>
                            <div className="captures-scroll-list">
                                {captures.map(cap => (
                                    <div key={cap.id} className="capture-card">
                                        <div className="capture-img-wrap">
                                            <img src={cap.dataUrl} alt="Captured" />
                                        </div>
                                        <div className="capture-details">
                                            <h4>صورة ثلاثية الأبعاد</h4>
                                            <span>الوقت: {cap.timestamp}</span>
                                            <span>الموضع: X:{cap.position.x.toFixed(1)}, Y:{cap.position.y.toFixed(1)}, Z:{cap.position.z.toFixed(1)}</span>
                                        </div>
                                    </div>
                                ))}

                                {captures.length === 0 && (
                                    <div className="empty-captures-state">
                                        <div className="empty-icon">📷</div>
                                        <p>بانتظار التقاط صور من كاميرا الهاتف لتظهر هنا في الفضاء ثلاثي الأبعاد...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            )}

            {/* QR Pairing Modal */}
            {showPairModal && (
                <div className="arw-modal-overlay" onClick={() => setShowPairModal(false)}>
                    <div className="arw-modal-card" onClick={e => e.stopPropagation()}>
                        <button className="arw-modal-close" onClick={() => setShowPairModal(false)}>✕</button>
                        <h3>ربط كاميرا الهاتف 📱</h3>
                        <p>امسح الرمز التالي بكاميرا الهاتف لتسجيل الدخول التلقائي والبدء بنقل الصور فوراً:</p>
                        
                        {window.location.hostname === 'localhost' && (
                            <div className="arw-localhost-warning" style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '12px',
                                margin: '15px 0',
                                color: '#fca5a5',
                                fontSize: '0.8rem',
                                textAlign: 'right',
                                lineHeight: '1.5'
                            }}>
                                ⚠️ <strong>تنبيه هام للربط:</strong> متصفحك الحالي يفتح الصفحة عبر <code>localhost</code>. لكي يستطيع الهاتف الاتصال بالكمبيوتر، يجب أن يكون الهاتف متصلاً **بنفس شبكة الـ Wi-Fi**، ويجب فتح هذه الصفحة على الكمبيوتر باستخدام **عنوان الـ IP المحلي لجهازك** (مثال: <code>http://192.168.1.X:5173</code>) بدلاً من <code>localhost</code> ثم مسح الرمز.
                            </div>
                        )}

                        {qrCodeUrl ? (
                            <div className="arw-qr-container">
                                <img src={qrCodeUrl} alt="Pairing QR Code" />
                            </div>
                        ) : (
                            <div className="arw-qr-placeholder">جاري توليد الرمز...</div>
                        )}
                        
                        <div className="arw-modal-info">
                            <span>أو افتح الرابط التالي على الهاتف:</span>
                            <input 
                                type="text" 
                                readOnly 
                                value={`${window.location.origin}/ar-workspace?pairToken=${token}`} 
                                onClick={e => e.target.select()}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
