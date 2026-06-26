import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import './ARWorkspace.css';

// ═══════════════════════════════════════════════════
// MATH & CONSTANTS
// ═══════════════════════════════════════════════════
const DEG = Math.PI / 180;
const H_FOV = 60; // Horizontal field of view of phone camera
const V_FOV = 45; // Vertical field of view

function tiltCompensatedHeading(alpha, beta, gamma) {
    const a = alpha * DEG, b = beta * DEG, g = gamma * DEG;
    const x = -Math.cos(a) * Math.sin(b) * Math.sin(g) + Math.sin(a) * Math.cos(g);
    const y =  Math.cos(a) * Math.cos(g) + Math.sin(a) * Math.sin(b) * Math.sin(g);
    return (Math.atan2(x, y) / DEG + 360) % 360;
}

function angleDiff(a, b) {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

const DIRS = ['الشمال (N)', 'الشمال الشرقي (NE)', 'الشرق (E)', 'الجنوب الشرقي (SE)', 'الجنوب (S)', 'الجنوب الغربي (SW)', 'الغرب (W)', 'الشمال الغربي (NW)'];
const getDirectionName = (h) => DIRS[Math.round(((h % 360) + 360) % 360 / 45) % 8];

// ═══════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════
export default function ARWorkspace() {
    const navigate = useNavigate();
    const { socket, user, token } = useAuth();

    // Auto login via pairToken query parameter
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

    // Common states
    const [objects, setObjects] = useState([
        { id: 'initial-cube', type: 'cube', position: { x: 0, y: 0.5, z: -4 }, color: '#00f0ff', label: 'صندوق افتراضي' },
        { id: 'welcome-marker', type: 'marker', position: { x: 2, y: 1, z: -5 }, color: '#ff007f', label: 'بوابة العالم الافتراضي' }
    ]);
    const [captures, setCaptures] = useState([]); // Spatial snapshots

    // ────────────────────────────────────────────────
    // MOBILE CONTROLLER STATE & REFS
    // ────────────────────────────────────────────────
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const canvasRef = useRef(null);

    const [heading, setHeading] = useState(0);
    const [pitch, setPitch] = useState(90);
    const [roll, setRoll] = useState(0);
    const [compassOk, setCompassOk] = useState(false);
    const [needIosPerm, setNeedIosPerm] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);

    // ────────────────────────────────────────────────
    // DESKTOP WORKSPACE REFS & STATE
    // ────────────────────────────────────────────────
    const threeContainerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const orbitControlsRef = useRef(null);
    const phoneMeshRef = useRef(null);
    const phoneFrustumRef = useRef(null);
    const meshesMapRef = useRef(new Map()); // id -> ThreeMesh

    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [livePhoneOrientation, setLivePhoneOrientation] = useState({ alpha: 0, beta: 90, gamma: 0, heading: 0 });

    // QR Pairing states
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

    // Detect device automatically but allow override
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

        // Tell peer we are here
        socket.emit('ar-spatial-update', { type: 'ping' });

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket]);

    // Handle incoming socket messages (Common to both modes)
    useEffect(() => {
        if (!socket) return;

        const handleSpatialUpdate = (data) => {
            if (data.type === 'ping') {
                setPeerConnected(true);
                // Reply with pong
                socket.emit('ar-spatial-update', { type: 'pong' });
                return;
            }
            if (data.type === 'pong') {
                setPeerConnected(true);
                return;
            }

            setPeerConnected(true);

            if (deviceMode === 'desktop') {
                // We are on desktop, receiving gyro and capture data from phone
                if (data.orientation) {
                    const { alpha, beta, gamma, heading } = data.orientation;
                    setLivePhoneOrientation({ alpha, beta, gamma, heading });

                    // Update Virtual Phone orientation in ThreeJS
                    if (phoneMeshRef.current) {
                        const phone = phoneMeshRef.current;
                        
                        // DeviceOrientation to Three.js Euler angles rotation (order YXZ)
                        const a = alpha * DEG;
                        const b = beta * DEG;
                        const g = gamma * DEG;
                        
                        phone.rotation.set(b, a, -g, 'YXZ');
                    }
                }

                if (data.type === 'snapshot' && data.dataUrl) {
                    // Receive base64 snapshot
                    const newCap = {
                        id: `cap-${Date.now()}`,
                        dataUrl: data.dataUrl,
                        heading: data.heading,
                        pitch: data.pitch,
                        timestamp: new Date().toLocaleTimeString(),
                        position: data.position || { x: 0, y: 1.2, z: -5 }
                    };
                    setCaptures(prev => [newCap, ...prev]);
                    
                    // Add photo billboard mesh into 3D scene
                    addSpatialSnapshotToScene(newCap);
                }
            }
        };

        const handleObjectManipulation = (data) => {
            setPeerConnected(true);
            if (data.action === 'sync-list') {
                setObjects(data.objects);
            } else if (data.action === 'update' || data.action === 'create') {
                setObjects(prev => {
                    const idx = prev.findIndex(o => o.id === data.object.id);
                    if (idx > -1) {
                        const next = [...prev];
                        next[idx] = data.object;
                        return next;
                    }
                    return [...prev, data.object];
                });
            } else if (data.action === 'delete') {
                setObjects(prev => prev.filter(o => o.id !== data.objectId));
            }
        };

        socket.on('ar-spatial-update', handleSpatialUpdate);
        socket.on('ar-object-manipulation', handleObjectManipulation);

        return () => {
            socket.off('ar-spatial-update', handleSpatialUpdate);
            socket.off('ar-object-manipulation', handleObjectManipulation);
        };
    }, [socket, deviceMode]);

    // Broadcast object list when a new peer connects
    useEffect(() => {
        if (peerConnected && deviceMode === 'desktop' && socket) {
            socket.emit('ar-object-manipulation', {
                action: 'sync-list',
                objects
            });
        }
    }, [peerConnected, deviceMode, socket]);


    // ═══════════════════════════════════════════════════
    // MOBILE CONTROLLER LOGIC (Camera + Gyro + HUD)
    // ═══════════════════════════════════════════════════
    
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

    // Handle gyroscope/orientation on mobile
    const onOrientation = useCallback((e) => {
        let rawH = 0;
        if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
            rawH = e.webkitCompassHeading;
        } else if (e.absolute === true && e.alpha != null) {
            rawH = tiltCompensatedHeading(e.alpha, e.beta, e.gamma);
        } else {
            rawH = 360 - (e.alpha || 0); // fallback
        }

        const alpha = e.alpha || 0;
        const beta = e.beta || 90;
        const gamma = e.gamma || 0;

        setHeading(Math.round(rawH));
        setPitch(Math.round(beta));
        setRoll(Math.round(gamma));
        setCompassOk(true);

        // Stream orientation to desktop
        if (socket && socket.connected) {
            socket.emit('ar-spatial-update', {
                type: 'telemetry',
                orientation: { alpha, beta, gamma, heading: rawH }
            });
        }
    }, [socket]);

    useEffect(() => {
        if (deviceMode !== 'mobile') return;

        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            setNeedIosPerm(true);
            return;
        }

        const evt = 'ondeviceorientationabsolute' in window
            ? 'deviceorientationabsolute' : 'deviceorientation';
        
        window.addEventListener(evt, onOrientation, true);
        return () => window.removeEventListener(evt, onOrientation, true);
    }, [deviceMode, onOrientation]);

    const handleRequestIosPermission = async () => {
        try {
            if (await DeviceOrientationEvent.requestPermission() === 'granted') {
                setNeedIosPerm(false);
                window.addEventListener('deviceorientation', onOrientation, true);
            }
        } catch (err) {
            alert("فشل الحصول على صلاحيات الاستشعار: " + err.message);
        }
    };

    // Capture Spatial Photo on mobile
    const handleSpatialCapture = async () => {
        if (isCapturing || !videoRef.current) return;
        setIsCapturing(true);

        // Play feedback vibration
        try { if (navigator.vibrate) navigator.vibrate(100); } catch{}

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current || document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

            // Calculate target position in 3D space: 5 meters in front of phone
            // Using spherical coordinates based on heading and pitch
            const radH = heading * DEG;
            const radP = (90 - pitch) * DEG; // relative pitch to horizontal

            // Direction vector
            const x = Math.sin(radH) * Math.cos(radP) * 5;
            const z = -Math.cos(radH) * Math.cos(radP) * 5;
            const y = Math.sin(radP) * 5;

            if (socket) {
                socket.emit('ar-spatial-update', {
                    type: 'snapshot',
                    dataUrl,
                    heading,
                    pitch,
                    position: { x, y, z }
                });
            }
            
            // Show brief flash overlay
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

    // Project 3D objects onto mobile screen coordinates
    const projectObjectToScreen = (obj) => {
        // The mobile camera is at {x:0, y:0, z:0} relative
        // Calculate vector from camera to object
        const dx = obj.position.x;
        const dy = obj.position.y - 1.2; // assume camera height 1.2m
        const dz = obj.position.z;

        // Calculate absolute angle/bearing to object
        // atan2(x, -z) returns angle from north (+Z is south, -Z is north)
        const objHeading = (Math.atan2(dx, -dz) / DEG + 360) % 360;
        
        // Relative heading (Yaw difference)
        const yawDiff = angleDiff(objHeading, heading);

        // Distance in 2D ground plane
        const dist2D = Math.sqrt(dx * dx + dz * dz);
        
        // Pitch to object
        const objPitch = Math.atan2(dy, dist2D) / DEG;
        
        // Relative pitch (Pitch difference)
        // pitch state: 90 = vertical, 0 = flat face up.
        // Screen center pitch is (90 - pitch)
        const currentTilt = 90 - pitch;
        const pitchDiff = objPitch - currentTilt;

        // Map to percentages (0% to 100%)
        const xPct = 50 + (yawDiff / (H_FOV / 2)) * 50;
        const yPct = 50 - (pitchDiff / (V_FOV / 2)) * 50;

        const inView = Math.abs(yawDiff) < (H_FOV / 2 + 10) && Math.abs(pitchDiff) < (V_FOV / 2 + 10);
        const dist3D = Math.sqrt(dx*dx + dy*dy + dz*dz);

        return { xPct, yPct, inView, distance: dist3D.toFixed(1) };
    };


    // ═══════════════════════════════════════════════════
    // DESKTOP 3D WORKSPACE (Three.js Engine)
    // ═══════════════════════════════════════════════════

    // Add captured image as a plane in ThreeJS scene
    const addSpatialSnapshotToScene = (cap) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const loader = new THREE.TextureLoader();
        loader.load(cap.dataUrl, (texture) => {
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
            
            // Make plane face the origin (or camera)
            plane.lookAt(0, 1.2, 0);

            // Add billboard border
            const borderGeo = new THREE.EdgesGeometry(geometry);
            const borderMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
            const border = new THREE.LineSegments(borderGeo, borderMat);
            plane.add(border);
            
            scene.add(plane);
        });
    };

    // Add/Update 3D elements in Three.js Scene
    const updateThreeObjects = useCallback((objList) => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Remove meshes that are no longer in list
        const currentIds = new Set(objList.map(o => o.id));
        for (const [id, mesh] of meshesMapRef.current.entries()) {
            if (!currentIds.has(id)) {
                scene.remove(mesh);
                meshesMapRef.current.delete(id);
            }
        }

        // Add or update meshes
        objList.forEach(obj => {
            let mesh = meshesMapRef.current.get(obj.id);

            if (!mesh) {
                // Create new Mesh
                let geometry;
                let material;

                if (obj.type === 'cube') {
                    geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
                    material = new THREE.MeshStandardMaterial({
                        color: obj.color || 0x00f0ff,
                        roughness: 0.1,
                        metalness: 0.8,
                        transparent: true,
                        opacity: 0.85
                    });
                } else {
                    // Marker (Diamond shape or sphere)
                    geometry = new THREE.SphereGeometry(0.4, 16, 16);
                    material = new THREE.MeshStandardMaterial({
                        color: obj.color || 0xff007f,
                        emissive: obj.color || 0xff007f,
                        emissiveIntensity: 0.4,
                        roughness: 0.2
                    });
                }

                mesh = new THREE.Mesh(geometry, material);
                
                // Add glowing outline if selected
                const outlineGeo = new THREE.EdgesGeometry(geometry);
                const outlineMat = new THREE.LineBasicMaterial({ 
                    color: selectedObjectId === obj.id ? 0xffffff : 0x000000,
                    transparent: true,
                    opacity: selectedObjectId === obj.id ? 1.0 : 0.0 
                });
                const outline = new THREE.LineSegments(outlineGeo, outlineMat);
                outline.name = 'outline';
                mesh.add(outline);

                scene.add(mesh);
                meshesMapRef.current.set(obj.id, mesh);
            }

            // Update mesh transforms
            mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
            mesh.material.color.set(obj.color);
            if (mesh.material.emissive) mesh.material.emissive.set(obj.color);

            // Update selected outline state
            const outline = mesh.getObjectByName('outline');
            if (outline) {
                outline.material.color.set(selectedObjectId === obj.id ? 0xffffff : 0x222222);
                outline.material.opacity = selectedObjectId === obj.id ? 1.0 : 0.1;
            }
        });
    }, [selectedObjectId]);

    // Init ThreeJS engine on Desktop
    useEffect(() => {
        if (deviceMode !== 'desktop') return;

        const container = threeContainerRef.current;
        if (!container) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0b10);
        sceneRef.current = scene;

        // Fog
        scene.fog = new THREE.FogExp2(0x0a0b10, 0.03);

        // Camera
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(5, 5, 8);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.01; // don't go below floor
        controls.minDistance = 2;
        controls.maxDistance = 30;
        orbitControlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 15, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // Grid & Floor
        const gridHelper = new THREE.GridHelper(40, 40, 0x00f0ff, 0x1f2937);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        const floorGeo = new THREE.PlaneGeometry(40, 40);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.9,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // ────────── VIRTUAL PHONE REPRESENTATION ──────────
        const phoneGroup = new THREE.Group();
        phoneGroup.position.set(0, 1.2, 0); // standard hand height
        scene.add(phoneGroup);
        phoneMeshRef.current = phoneGroup;

        // Phone Chassis
        const phoneGeo = new THREE.BoxGeometry(0.8, 1.6, 0.1);
        const phoneMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.2,
            metalness: 0.8
        });
        const phoneChassis = new THREE.Mesh(phoneGeo, phoneMat);
        phoneGroup.add(phoneChassis);

        // Phone Screen (Glowing edge)
        const screenGeo = new THREE.BoxGeometry(0.76, 1.56, 0.105);
        const screenMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.3
        });
        const phoneScreen = new THREE.Mesh(screenGeo, screenMat);
        phoneGroup.add(phoneScreen);

        // Camera Lens on back
        const lensGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(-0.25, 0.6, -0.05);
        phoneGroup.add(lens);

        // Camera FOV Frustum Cone shooting forward (-Z)
        const coneGeo = new THREE.ConeGeometry(1.2, 3, 4, 1, true); // pyramid shape
        coneGeo.rotateX(-Math.PI / 2); // align pointing forward
        coneGeo.translate(0, 0, -1.5);
        
        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xff007f,
            wireframe: true,
            transparent: true,
            opacity: 0.15
        });
        const frustum = new THREE.Mesh(coneGeo, wireMat);
        phoneGroup.add(frustum);
        phoneFrustumRef.current = frustum;

        // Render loop
        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);

            // Rotate frustum cone slightly for dynamic sci-fi glow
            if (phoneFrustumRef.current) {
                // slight opacity pulse
                phoneFrustumRef.current.material.opacity = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
            }

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

        // Init existing snapshots
        captures.forEach(c => addSpatialSnapshotToScene(c));

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            if (rendererRef.current && rendererRef.current.domElement) {
                container.removeChild(rendererRef.current.domElement);
            }
            // Dispose
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

    // Trigger scene mesh updates when objects list or selection changes
    useEffect(() => {
        if (deviceMode === 'desktop') {
            updateThreeObjects(objects);
        }
    }, [objects, deviceMode, updateThreeObjects, selectedObjectId]);

    // Handle editing object details from desktop sliders
    const handleUpdateObjectProperty = (prop, val) => {
        if (!selectedObjectId) return;
        setObjects(prev => {
            const next = prev.map(o => {
                if (o.id === selectedObjectId) {
                    const updated = { ...o };
                    if (prop === 'x' || prop === 'y' || prop === 'z') {
                        updated.position = { ...o.position, [prop]: parseFloat(val) };
                    } else {
                        updated[prop] = val;
                    }

                    // Emit socket updates to phone
                    if (socket) {
                        socket.emit('ar-object-manipulation', {
                            action: 'update',
                            object: updated
                        });
                    }

                    return updated;
                }
                return o;
            });
            return next;
        });
    };

    // Add a new 3D object from desktop
    const handleAddObject = (type) => {
        // Place new object 4m in front of current camera lookat, or center
        const id = `obj-${Date.now()}`;
        const newObj = {
            id,
            type,
            position: { x: (Math.random() - 0.5) * 4, y: 0.5, z: -3 - Math.random() * 3 },
            color: type === 'cube' ? '#00f0ff' : '#ff9f0a',
            label: type === 'cube' ? 'مجسم صندوق جديد' : 'موقع مستهدف'
        };

        setObjects(prev => [...prev, newObj]);
        setSelectedObjectId(id);

        if (socket) {
            socket.emit('ar-object-manipulation', {
                action: 'create',
                object: newObj
            });
        }
    };

    // Delete 3D Object
    const handleDeleteObject = (id) => {
        setObjects(prev => prev.filter(o => o.id !== id));
        if (selectedObjectId === id) setSelectedObjectId(null);

        if (socket) {
            socket.emit('ar-object-manipulation', {
                action: 'delete',
                objectId: id
            });
        }
    };

    // Toggle simulated client roles for testing
    const handleToggleMode = () => {
        // Stop streams if moving away from mobile
        if (deviceMode === 'mobile' && streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        setDeviceMode(prev => prev === 'mobile' ? 'desktop' : 'mobile');
    };

    // ═══════════════════════════════════════════════════
    // RENDER MARKUP
    // ═══════════════════════════════════════════════════
    
    return (
        <div className="arw-root font-outfit">
            
            {/* ─── GLOBAL SCI-FI TOP BAR ─── */}
            <header className="arw-header">
                <div className="arw-logo-group">
                    <button className="arw-back-btn" onClick={() => navigate('/map')} title="العودة للخريطة">
                        ←
                    </button>
                    <div className="arw-logo-text">
                        <h2>الواقع المعزز المزدوج</h2>
                        <span>الربط اللحظي الذكي بين الأجهزة</span>
                    </div>
                </div>

                <div className="arw-status-bar">
                    <div className="arw-indicator">
                        <span className={`arw-dot ${socketConnected ? 'active' : ''}`} />
                        <span>الشبكة: {socketConnected ? 'متصل' : 'جاري الاتصال...'}</span>
                    </div>
                    <div className="arw-indicator">
                        <span className={`arw-dot ${peerConnected ? 'active' : ''}`} />
                        <span>الطرف الثاني: {peerConnected ? 'متصل' : 'بانتظار الطرف الآخر...'}</span>
                    </div>
                    {deviceMode === 'desktop' && (
                        <button className="arw-pair-btn" onClick={() => setShowPairModal(true)}>
                            ربط هاتف جديد 📱
                        </button>
                    )}
                    
                    <button className="arw-mode-toggle" onClick={handleToggleMode}>
                        تبديل إلى وضع {deviceMode === 'mobile' ? 'الكمبيوتر 💻' : 'الهاتف 📱'}
                    </button>
                </div>
            </header>

            {/* ─── MOBILE CONTROLLER HUD VIEW ─── */}
            {deviceMode === 'mobile' && (
                <div className="arw-mobile-viewport">
                    {/* Live Camera Feed */}
                    <video ref={videoRef} autoPlay playsInline muted className="arw-mobile-video" />
                    <div className="arw-mobile-overlay-grid" />

                    {/* System Compass Ring (HUD) */}
                    <div className="arw-hud-compass">
                        <div className="compass-reading">{heading}°</div>
                        <div className="compass-direction">{getDirectionName(heading)}</div>
                    </div>

                    <div className="arw-hud-telemetry">
                        <div>زاوية الالتواء: <span>{pitch}°</span></div>
                        <div>دوران الكاميرا: <span>{roll}°</span></div>
                        {!compassOk && <div className="warning">تحتاج لمعايرة مستشعر الدوران 🧭</div>}
                    </div>

                    {/* iOS Permission Prompt Overlay */}
                    {needIosPerm && (
                        <div className="arw-ios-overlay">
                            <div className="arw-ios-card">
                                <h3>تفعيل مستشعرات التوجيه</h3>
                                <p>يرجى تمكين صلاحية قراءة الجيروسكوب والبوصلة لعرض الأجسام ومزامنة الحركة ثلاثية الأبعاد بدقة.</p>
                                <button className="arw-btn-accent" onClick={handleRequestIosPermission}>
                                    تمكين الصلاحية 🧭
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Render floating AR elements overlay */}
                    <div className="arw-ar-viewport">
                        {objects.map(obj => {
                            const projection = projectObjectToScreen(obj);
                            if (!projection.inView) return null;

                            return (
                                <div 
                                    key={obj.id} 
                                    className="arw-ar-card"
                                    style={{
                                        left: `${projection.xPct}%`,
                                        top: `${projection.yPct}%`,
                                        borderColor: obj.color
                                    }}
                                >
                                    <div className="card-dot" style={{ backgroundColor: obj.color }} />
                                    <div className="card-body">
                                        <h4>{obj.label}</h4>
                                        <span>البعد: {projection.distance} متر</span>
                                    </div>
                                    <div className="card-stem" style={{ backgroundColor: obj.color }} />
                                </div>
                            );
                        })}
                    </div>

                    {/* Big Action Buttons */}
                    <div className="arw-mobile-actions">
                        <button 
                            className={`arw-capture-btn ${isCapturing ? 'capturing' : ''}`}
                            onClick={handleSpatialCapture}
                            disabled={isCapturing}
                        >
                            <span className="btn-inner" />
                        </button>
                        <span className="btn-hint">انقر لالتقاط صورة فراغية وبثها فوراً للابتوب 🚀</span>
                    </div>
                </div>
            )}

            {/* ─── DESKTOP 3D WORKSPACE VIEW ─── */}
            {deviceMode === 'desktop' && (
                <div className="arw-desktop-workspace">
                    
                    {/* LEFT PANEL: Elements Editor */}
                    <aside className="arw-sidebar left">
                        <div className="sidebar-section">
                            <h3>عناصر المشهد ثلاثي الأبعاد</h3>
                            <div className="sidebar-actions-row">
                                <button className="arw-btn-subtle" onClick={() => handleAddObject('cube')}>
                                    + مكعب زجاجي
                                </button>
                                <button className="arw-btn-subtle" onClick={() => handleAddObject('marker')}>
                                    + علامة مضيئة
                                </button>
                            </div>

                            <div className="elements-scroll-list">
                                {objects.map(obj => (
                                    <div 
                                        key={obj.id} 
                                        className={`element-row ${selectedObjectId === obj.id ? 'active' : ''}`}
                                        onClick={() => setSelectedObjectId(obj.id)}
                                    >
                                        <div className="row-info">
                                            <span className="element-dot" style={{ backgroundColor: obj.color }} />
                                            <div>
                                                <h4>{obj.label}</h4>
                                                <span>X:{obj.position.x.toFixed(1)}, Y:{obj.position.y.toFixed(1)}, Z:{obj.position.z.toFixed(1)}</span>
                                            </div>
                                        </div>
                                        <button className="row-delete" onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj.id); }}>
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Selected Object Sliders */}
                        {selectedObjectId && (
                            <div className="sidebar-section border-top">
                                {(() => {
                                    const obj = objects.find(o => o.id === selectedObjectId);
                                    if (!obj) return null;

                                    return (
                                        <div className="editor-controls">
                                            <h3>تعديل العنصر المحدد</h3>
                                            
                                            <div className="control-field">
                                                <label>العنوان</label>
                                                <input 
                                                    type="text" 
                                                    value={obj.label} 
                                                    onChange={(e) => handleUpdateObjectProperty('label', e.target.value)} 
                                                />
                                            </div>

                                            <div className="control-field">
                                                <label>اللون</label>
                                                <input 
                                                    type="color" 
                                                    value={obj.color} 
                                                    onChange={(e) => handleUpdateObjectProperty('color', e.target.value)} 
                                                />
                                            </div>

                                            <div className="control-field">
                                                <div className="slider-header">
                                                    <span>موضع أفقي (X)</span>
                                                    <span>{obj.position.x.toFixed(1)}م</span>
                                                </div>
                                                <input 
                                                    type="range" min="-8" max="8" step="0.1" 
                                                    value={obj.position.x} 
                                                    onChange={(e) => handleUpdateObjectProperty('x', e.target.value)} 
                                                />
                                            </div>

                                            <div className="control-field">
                                                <div className="slider-header">
                                                    <span>الارتفاع (Y)</span>
                                                    <span>{obj.position.y.toFixed(1)}م</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="6" step="0.1" 
                                                    value={obj.position.y} 
                                                    onChange={(e) => handleUpdateObjectProperty('y', e.target.value)} 
                                                />
                                            </div>

                                            <div className="control-field">
                                                <div className="slider-header">
                                                    <span>العمق (Z)</span>
                                                    <span>{obj.position.z.toFixed(1)}م</span>
                                                </div>
                                                <input 
                                                    type="range" min="-12" max="-1" step="0.1" 
                                                    value={obj.position.z} 
                                                    onChange={(e) => handleUpdateObjectProperty('z', e.target.value)} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </aside>

                    {/* MAIN Three.js CANVAS CONTAINER */}
                    <div ref={threeContainerRef} className="arw-canvas-container">
                        {/* Sci-Fi Overlay Crosshairs */}
                        <div className="canvas-sci-fi-overlay" />
                    </div>

                    {/* RIGHT PANEL: Live Telemetry & Captures */}
                    <aside className="arw-sidebar right">
                        <div className="sidebar-section">
                            <h3>حالة استشعار الهاتف اللحظية</h3>
                            <div className="telemetry-card">
                                <div className="telemetry-row">
                                    <span>السمت (Yaw / Compass)</span>
                                    <span className="telemetry-value font-mono">{livePhoneOrientation.heading.toFixed(1)}°</span>
                                </div>
                                <div className="telemetry-row">
                                    <span>الانحناء (Pitch)</span>
                                    <span className="telemetry-value font-mono">{livePhoneOrientation.beta.toFixed(1)}°</span>
                                </div>
                                <div className="telemetry-row">
                                    <span>الدوران الجانبي (Roll)</span>
                                    <span className="telemetry-value font-mono">{livePhoneOrientation.gamma.toFixed(1)}°</span>
                                </div>
                                <div className="telemetry-row">
                                    <span>آخر تحديث تلقائي</span>
                                    <span className="telemetry-value success">نشط</span>
                                </div>
                            </div>
                        </div>

                        <div className="sidebar-section border-top">
                            <h3>لقطات الفضاء الملتقطة ({captures.length})</h3>
                            <div className="captures-scroll-list">
                                {captures.map(cap => (
                                    <div key={cap.id} className="capture-card">
                                        <div className="capture-img-wrap">
                                            <img src={cap.dataUrl} alt="Captured" />
                                        </div>
                                        <div className="capture-details">
                                            <h4>صورة فراغية</h4>
                                            <span>الزاوية: {cap.heading}° · الوقت: {cap.timestamp}</span>
                                            <span>X:{cap.position.x.toFixed(1)}, Y:{cap.position.y.toFixed(1)}, Z:{cap.position.z.toFixed(1)}</span>
                                        </div>
                                    </div>
                                ))}

                                {captures.length === 0 && (
                                    <div className="empty-captures-state">
                                        <div className="empty-icon">📷</div>
                                        <p>بانتظار التقاط صور فراغية من الهاتف لتظهر هنا في الفضاء ثلاثي الأبعاد...</p>
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
                        <h3>ربط كاشف الهاتف الذكي 📱</h3>
                        <p>امسح الرمز التالي بكاميرا الهاتف لتسجيل الدخول التلقائي وربط الأجهزة فوراً:</p>
                        
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
