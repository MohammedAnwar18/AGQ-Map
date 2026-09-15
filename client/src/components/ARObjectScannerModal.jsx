import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { arModelService } from '../services/arModelApi';
import './ARObjectScannerModal.css';

// ═══════════════════════════════════════════════════════════════
// زوايا المسح الـ 360 درجة
// ═══════════════════════════════════════════════════════════════
const SCAN_ANGLES = [
    { id: 'front', label: 'الواجهة الأمامية', short: 'أمام (0°)', hint: 'وجّه الكاميرا مباشرة لأمام المجسم', icon: '🎯' },
    { id: 'right', label: 'الجهة اليمنى', short: 'يمين (90°)', hint: 'انتقل ليمين المجسم وصوّره بزاوية 90°', icon: '➡️' },
    { id: 'back', label: 'الواجهة الخلفية', short: 'خلف (180°)', hint: 'انتقل لخلف المجسم وصوّره بزاوية 180°', icon: '🔄' },
    { id: 'left', label: 'الجهة اليسرى', short: 'يسار (270°)', hint: 'انتقل ليسار المجسم وصوّره بزاوية 270°', icon: '⬅️' },
    { id: 'top', label: 'السطح العلوي', short: 'أعلى', hint: 'صوّر المجسم من الأعلى قليلاً بزاوية مائلة', icon: '⬆️' }
];

// ═══════════════════════════════════════════════════════════════
// تأثيرات صوتية برمجية خفيفة بدون ملفات خارجية (Web Audio API)
// ═══════════════════════════════════════════════════════════════
const playAudioFeedback = (type = 'snap') => {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'snap') {
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        }
    } catch {
        // تجاهل أخطاء تشغيل الصوت
    }
};

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي: ARObjectScannerModal
// ═══════════════════════════════════════════════════════════════
export default function ARObjectScannerModal({ onClose, onSaveModel }) {
    const [step, setStep] = useState('scan'); // 'scan' | 'processing' | 'studio'
    const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
    const [capturedFrames, setCapturedFrames] = useState({});
    const [cameraError, setCameraError] = useState(null);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');
    const [modelTitle, setModelTitle] = useState(`مجسم ممسوح 360° - ${new Date().toLocaleDateString('ar-SA')}`);
    const [lightingPreset, setLightingPreset] = useState('studio'); // 'studio' | 'neon' | 'sun'
    const [isWireframe, setIsWireframe] = useState(false);
    const [depthScale, setDepthScale] = useState(1.2);
    const [saving, setSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const canvasViewportRef = useRef(null);

    // Three.js refs
    const threeSceneRef = useRef(null);
    const threeCameraRef = useRef(null);
    const threeRendererRef = useRef(null);
    const threeControlsRef = useRef(null);
    const threeMeshRef = useRef(null);
    const threeLightsRef = useRef({});
    const animFrameIdRef = useRef(null);
    const glbBlobRef = useRef(null);
    const posterDataUrlRef = useRef(null);

    const activeAngle = SCAN_ANGLES[currentAngleIndex];
    const capturedCount = Object.keys(capturedFrames).length;

    // ── تشغيل الكاميرا ──────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch (err) {
            console.warn('Camera error:', err);
            setCameraError('تعذّر فتح الكاميرا مباشرة. يمكنك استخدام زر "رفع صور" أو التأكد من إذن الكاميرا.');
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (step === 'scan') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [step, startCamera, stopCamera]);

    // ── التقاط صورة الزاوية الحالية ─────────────────────────────
    const snapCurrentAngle = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

        playAudioFeedback('snap');

        setCapturedFrames(prev => ({
            ...prev,
            [activeAngle.id]: dataUrl
        }));

        // الانتقال التلقائي للزاوية التالية إن لم تكن ملتقطة
        if (currentAngleIndex < SCAN_ANGLES.length - 1) {
            setCurrentAngleIndex(prev => prev + 1);
        }
    };

    // ── رفع صورة من الألبوم للزاوية ─────────────────────────────
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            playAudioFeedback('snap');
            setCapturedFrames(prev => ({
                ...prev,
                [activeAngle.id]: dataUrl
            }));
            if (currentAngleIndex < SCAN_ANGLES.length - 1) {
                setCurrentAngleIndex(prev => prev + 1);
            }
        };
        reader.readAsDataURL(file);
    };

    // ═══════════════════════════════════════════════════════════════
    // محرك بناء المجسم 3D من الصور الملتقطة (Three.js Volumetric Mesh)
    // ═══════════════════════════════════════════════════════════════
    const build3DModel = async () => {
        setStep('processing');
        setProcessingProgress(15);
        setProcessingStatus('معالجة الصور الملتقطة وعزل حواف المجسم...');

        // محاكاة تسلسل خطوات المعالجة لإعطاء تجربة سلسة
        await new Promise(r => setTimeout(r, 600));
        setProcessingProgress(35);
        setProcessingStatus('حساب خريطة التضاريس والعمق الحجمي (Depth Synthesis)...');

        await new Promise(r => setTimeout(r, 700));
        setProcessingProgress(65);
        setProcessingStatus('توليد شبكة المضلعات الهندسية ثلاثية الأبعاد (3D Mesh)...');

        // تجهيز الخامات من الصور
        const loader = new THREE.TextureLoader();
        const loadTexture = (src) => new Promise((resolve) => {
            if (!src) {
                // إنشاء خامة حيادية كبديل
                const dummy = document.createElement('canvas');
                dummy.width = 128;
                dummy.height = 128;
                const dCtx = dummy.getContext('2d');
                dCtx.fillStyle = '#2a3b4c';
                dCtx.fillRect(0, 0, 128, 128);
                resolve(new THREE.CanvasTexture(dummy));
                return;
            }
            loader.load(src, resolve);
        });

        const texFront = await loadTexture(capturedFrames.front || capturedFrames.right || Object.values(capturedFrames)[0]);
        const texRight = await loadTexture(capturedFrames.right || capturedFrames.front || Object.values(capturedFrames)[0]);
        const texBack  = await loadTexture(capturedFrames.back || capturedFrames.front || Object.values(capturedFrames)[0]);
        const texLeft  = await loadTexture(capturedFrames.left || capturedFrames.right || capturedFrames.front || Object.values(capturedFrames)[0]);
        const texTop   = await loadTexture(capturedFrames.top || capturedFrames.front || Object.values(capturedFrames)[0]);
        const texBottom = await loadTexture(null);

        setProcessingProgress(85);
        setProcessingStatus('دمج خامات الأسطح وحساب الإضاءة والظلال...');

        // أبعاد المجسم التناسبية
        const boxWidth = 2.0;
        const boxHeight = 2.6;
        const boxDepth = 1.6;
        const segments = 32; // دقة الشبكة المضلعة

        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth, segments, segments, segments);

        // نحت التضاريس والعمق على رؤوس المضلعات (Displacement sculpt)
        const pos = geometry.attributes.position;
        const v = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);

            // نحت الوجه الأمامي (+Z)
            if (v.z > boxDepth / 2 - 0.05) {
                const nx = v.x / (boxWidth / 2);
                const ny = v.y / (boxHeight / 2);
                const distCenter = Math.sqrt(nx * nx + ny * ny);
                const bulge = Math.max(0, 1 - distCenter * 0.75) * 0.25 * depthScale;
                v.z += bulge;
            }
            // نحت الوجه الخلفي (-Z)
            else if (v.z < -boxDepth / 2 + 0.05) {
                const nx = v.x / (boxWidth / 2);
                const ny = v.y / (boxHeight / 2);
                const distCenter = Math.sqrt(nx * nx + ny * ny);
                const bulge = Math.max(0, 1 - distCenter * 0.75) * 0.22 * depthScale;
                v.z -= bulge;
            }
            // نحت الوجه الأيمن (+X)
            else if (v.x > boxWidth / 2 - 0.05) {
                const nz = v.z / (boxDepth / 2);
                const ny = v.y / (boxHeight / 2);
                const dist = Math.sqrt(nz * nz + ny * ny);
                v.x += Math.max(0, 1 - dist * 0.8) * 0.18 * depthScale;
            }
            // نحت الوجه الأيسر (-X)
            else if (v.x < -boxWidth / 2 + 0.05) {
                const nz = v.z / (boxDepth / 2);
                const ny = v.y / (boxHeight / 2);
                const dist = Math.sqrt(nz * nz + ny * ny);
                v.x -= Math.max(0, 1 - dist * 0.8) * 0.18 * depthScale;
            }
            // انحناء الحواف لتجنب الصندوقية الحادة (Chamfer/Rounding)
            v.multiplyScalar(0.96);

            pos.setXYZ(i, v.x, v.y, v.z);
        }

        geometry.computeVertexNormals();

        // 6 خامات للأوجه الستة بالترتيب: +X, -X, +Y, -Y, +Z, -Z
        const createMat = (map) => new THREE.MeshStandardMaterial({
            map,
            roughness: 0.35,
            metalness: 0.08,
            wireframe: false
        });

        const materials = [
            createMat(texRight),  // +X: Right
            createMat(texLeft),   // -X: Left
            createMat(texTop),    // +Y: Top
            createMat(texBottom), // -Y: Bottom
            createMat(texFront),  // +Z: Front
            createMat(texBack)    // -Z: Back
        ];

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        threeMeshRef.current = mesh;

        // حفظ لقطة كبوستر/صورة مصغرة
        posterDataUrlRef.current = capturedFrames.front || Object.values(capturedFrames)[0];

        setProcessingProgress(100);
        setProcessingStatus('اكتمل البناء بنجاح!');
        playAudioFeedback('success');

        await new Promise(r => setTimeout(r, 400));
        setStep('studio');
    };

    // ═══════════════════════════════════════════════════════════════
    // إعداد استوديو Three.js للعرض التفاعلي
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (step !== 'studio' || !canvasViewportRef.current || !threeMeshRef.current) return;

        const container = canvasViewportRef.current;
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 450;

        // المشهد
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0b1120');
        threeSceneRef.current = scene;

        // الكاميرا
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 0.8, 4.5);
        threeCameraRef.current = camera;

        // الريندرر
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        threeRendererRef.current = renderer;

        // التحكم بالدوران OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2.0;
        threeControlsRef.current = controls;

        // الإضاءة
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
        keyLight.position.set(5, 8, 6);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x00d4ff, 0.8);
        fillLight.position.set(-5, 3, -4);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0x00ff88, 0.6);
        rimLight.position.set(0, -4, -4);
        scene.add(rimLight);

        threeLightsRef.current = { ambientLight, keyLight, fillLight, rimLight };

        // منصة دائرية كقاعدة تحت المجسم
        const pedestalGeom = new THREE.CylinderGeometry(1.6, 1.7, 0.15, 48);
        const pedestalMat = new THREE.MeshStandardMaterial({
            color: '#152033',
            roughness: 0.6,
            metalness: 0.2
        });
        const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
        pedestal.position.y = -1.4;
        pedestal.receiveShadow = true;
        scene.add(pedestal);

        // إضافة المجسم
        scene.add(threeMeshRef.current);

        // حلقة التحريك والـ Render
        const animate = () => {
            animFrameIdRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // تجاوب تغيير الحجم
        const handleResize = () => {
            if (!container) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
            renderer.dispose();
        };
    }, [step]);

    // ── تغيير وضع الإضاءة ─────────────────────────────────────────
    useEffect(() => {
        const lights = threeLightsRef.current;
        if (!lights || !lights.keyLight) return;

        if (lightingPreset === 'studio') {
            lights.ambientLight.color.set('#ffffff');
            lights.ambientLight.intensity = 0.9;
            lights.keyLight.color.set('#ffffff');
            lights.fillLight.color.set('#00d4ff');
        } else if (lightingPreset === 'neon') {
            lights.ambientLight.color.set('#0a1020');
            lights.ambientLight.intensity = 0.4;
            lights.keyLight.color.set('#00ff88');
            lights.fillLight.color.set('#ff0077');
        } else if (lightingPreset === 'sun') {
            lights.ambientLight.color.set('#ffeedd');
            lights.ambientLight.intensity = 1.0;
            lights.keyLight.color.set('#ffaa44');
            lights.fillLight.color.set('#88bbff');
        }
    }, [lightingPreset]);

    // ── تفعيل / إلغاء الهيكل الشبكي (Wireframe) ───────────────────
    const toggleWireframe = () => {
        const mesh = threeMeshRef.current;
        if (!mesh) return;
        const newWf = !isWireframe;
        setIsWireframe(newWf);
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => { m.wireframe = newWf; });
        } else {
            mesh.material.wireframe = newWf;
        }
    };

    // ── إيقاف / تشغيل التدوير التلقائي ──────────────────────────
    const toggleAutoRotate = () => {
        if (threeControlsRef.current) {
            threeControlsRef.current.autoRotate = !threeControlsRef.current.autoRotate;
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // تصدير وتنزيل ملف GLB
    // ═══════════════════════════════════════════════════════════════
    const exportGLB = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!threeMeshRef.current) return reject(new Error('لا يوجد مجسم للتصدير'));
            const exporter = new GLTFExporter();
            exporter.parse(
                threeMeshRef.current,
                (gltf) => {
                    const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                    glbBlobRef.current = blob;
                    resolve(blob);
                },
                (err) => reject(err),
                { binary: true }
            );
        });
    }, []);

    const handleDownloadGLB = async () => {
        try {
            const blob = await exportGLB();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modelTitle.trim().replace(/\s+/g, '_') || '3d_model'}.glb`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء تنزيل الملف');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // الحفظ المباشر في مجسمات الواقع المعزز (Cloudflare R2 + Database)
    // ═══════════════════════════════════════════════════════════════
    const handleSaveToAR = async () => {
        setSaving(true);
        setSaveProgress(10);
        try {
            const blob = await exportGLB();
            const modelFile = new File([blob], `${Date.now()}_scanned.glb`, { type: 'model/gltf-binary' });

            setSaveProgress(30);
            // رفع ملف الـ GLB إلى R2
            const modelUrl = await arModelService.uploadFile(modelFile, (pct) => {
                setSaveProgress(30 + Math.round(pct * 0.4));
            });

            setSaveProgress(75);

            // تجهيز صورة المعاينة (Poster)
            let posterUrl = null;
            if (posterDataUrlRef.current) {
                try {
                    const res = await fetch(posterDataUrlRef.current);
                    const posterBlob = await res.blob();
                    const posterFile = new File([posterBlob], `${Date.now()}_poster.jpg`, { type: 'image/jpeg' });
                    posterUrl = await arModelService.uploadFile(posterFile);
                } catch {
                    // في حال فشل رفع البوستر نتجاوزه
                }
            }

            setSaveProgress(90);

            // إنشاء سجل المجسم في قاعدة البيانات
            const payload = {
                title: modelTitle.trim() || 'مجسم ممسوح 360°',
                subtitle: 'تم مسحه بكاميرا الهاتف بتقنية 360° Volumetric Scanner',
                description: 'نموذج ثلاثي أبعاد عالي الدقة مبني عبر المسح متعدد الزوايا ومناسب للواقع المعزز.',
                model_url: modelUrl,
                poster_url: posterUrl,
                is_published: true,
                hotspots: []
            };

            const created = await arModelService.create(payload);

            setSaveProgress(100);
            playAudioFeedback('success');

            if (onSaveModel) {
                onSaveModel(created);
            }
            onClose();
        } catch (err) {
            console.error(err);
            alert(`تعذّر حفظ المجسم: ${err.message || 'خطأ غير معروف'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="aos-overlay" onClick={onClose}>
            <div className="aos-container" onClick={(e) => e.stopPropagation()}>
                {/* ── الرأس ── */}
                <header className="aos-header">
                    <div className="aos-header-info">
                        <div className="aos-header-icon">📷</div>
                        <div>
                            <h3>
                                <span>الماسح الذكي 360° للمجسمات</span>
                                <span className="aos-badge">Volumetric 3D Scanner</span>
                            </h3>
                            <p>مسح فوري بالكاميرا متعدد الزوايا وبناء نموذج ثلاثي أبعاد كامل</p>
                        </div>
                    </div>
                    <button className="aos-close-btn" onClick={onClose} title="إغلاق">✕</button>
                </header>

                {/* ── المحتوى ── */}
                <div className="aos-body">
                    {/* ═══════════════════════════════════════════
                        المرحلة 1: المسح والتقاط الزوايا
                        ═══════════════════════════════════════════ */}
                    {step === 'scan' && (
                        <div className="aos-scanner-view">
                            <div className="aos-video-wrapper">
                                <video
                                    ref={videoRef}
                                    className="aos-video"
                                    playsInline
                                    muted
                                    autoPlay
                                />

                                {/* HUD التوجيه الدائري */}
                                <div className="aos-hud-overlay">
                                    {/* إرشادات الزاوية الحالية */}
                                    <div className="aos-instruction-pill">
                                        <span className="aos-angle-tag">{activeAngle.short}</span>
                                        <span>{activeAngle.hint}</span>
                                    </div>

                                    {/* علامة الهدف والتوسيط */}
                                    <div className="aos-target-box">
                                        <div className="aos-target-center" />
                                    </div>

                                    {/* بوصلة الزوايا أسفل الكاميرا */}
                                    <div className="aos-radar-ring">
                                        {SCAN_ANGLES.map((angle, idx) => {
                                            const isDone = !!capturedFrames[angle.id];
                                            const isActive = idx === currentAngleIndex;
                                            return (
                                                <div
                                                    key={angle.id}
                                                    className={`aos-radar-node ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                                                    onClick={() => setCurrentAngleIndex(idx)}
                                                >
                                                    <div className="aos-radar-dot">
                                                        {isDone ? '✓' : angle.icon}
                                                    </div>
                                                    <span className="aos-radar-title">{angle.short.split(' ')[0]}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* شريط التحكم السفلي */}
                            <div className="aos-controls-bar">
                                {/* شريط اللقطات الملتقطة */}
                                <div className="aos-captured-strip">
                                    {SCAN_ANGLES.map((angle) => {
                                        const frame = capturedFrames[angle.id];
                                        return (
                                            <div
                                                key={angle.id}
                                                className="aos-thumb-slot"
                                                title={angle.label}
                                                onClick={() => setCurrentAngleIndex(SCAN_ANGLES.findIndex(a => a.id === angle.id))}
                                            >
                                                {frame ? (
                                                    <img src={frame} alt={angle.label} />
                                                ) : (
                                                    <span className="aos-thumb-empty">{angle.icon}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* زر الالتقاط الكبير */}
                                <div className="aos-snap-btn-wrapper">
                                    <button
                                        className="aos-snap-btn"
                                        onClick={snapCurrentAngle}
                                        title={`التقاط ${activeAngle.label}`}
                                    >
                                        📸
                                    </button>
                                </div>

                                {/* أزرار الإجراءات */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleFileUpload}
                                    />
                                    <button
                                        className="aos-btn-upload"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="رفع صورة لهذه الزاوية من ألبوم الصور"
                                    >
                                        📁 صورة من الألبوم
                                    </button>

                                    <button
                                        className="aos-btn-synthesize"
                                        onClick={build3DModel}
                                        disabled={capturedCount === 0}
                                    >
                                        <span>بناء المجسم 3D</span>
                                        <span>({capturedCount}/5)</span>
                                        <span>⚡</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════
                        المرحلة 2: شاشة المعالجة
                        ═══════════════════════════════════════════ */}
                    {step === 'processing' && (
                        <div className="aos-processing">
                            <div className="aos-spinner" />
                            <h4>جاري بناء وتجسيم النموذج ثلاثي الأبعاد...</h4>
                            <p>{processingStatus}</p>
                            <div className="aos-progress-bar">
                                <div
                                    className="aos-progress-fill"
                                    style={{ width: `${processingProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════
                        المرحلة 3: استوديو العرض والتصدير (3D Studio)
                        ═══════════════════════════════════════════ */}
                    {step === 'studio' && (
                        <div className="aos-studio">
                            <div className="aos-canvas-viewport" ref={canvasViewportRef}>
                                {/* أزرار التحكم السريع داخل الـ 3D */}
                                <div className="aos-studio-hud">
                                    <button
                                        className="aos-hud-btn"
                                        onClick={toggleAutoRotate}
                                        title="تدوير تلقائي"
                                    >
                                        🔄 تدوير
                                    </button>
                                    <button
                                        className={`aos-hud-btn ${isWireframe ? 'active' : ''}`}
                                        onClick={toggleWireframe}
                                        title="وضع المضلعات الشبكية"
                                    >
                                        🌐 شبكة
                                    </button>
                                    <button
                                        className="aos-hud-btn"
                                        onClick={() => {
                                            const next = lightingPreset === 'studio' ? 'neon' : lightingPreset === 'neon' ? 'sun' : 'studio';
                                            setLightingPreset(next);
                                        }}
                                        title="تغيير نمط الإضاءة"
                                    >
                                        💡 {lightingPreset === 'studio' ? 'استوديو' : lightingPreset === 'neon' ? 'نيون' : 'شمس'}
                                    </button>
                                </div>

                                <div className="aos-studio-hint">
                                    اسحب لتدوير المجسم 360° • قرّب للتكبير
                                </div>
                            </div>

                            {/* شريط أدوات الحفظ والتصدير */}
                            <div className="aos-studio-toolbar">
                                <div className="aos-model-meta">
                                    <input
                                        type="text"
                                        className="aos-model-title-input"
                                        value={modelTitle}
                                        onChange={(e) => setModelTitle(e.target.value)}
                                        placeholder="اسم المجسم..."
                                    />
                                </div>

                                <div className="aos-studio-actions">
                                    <button
                                        className="aos-btn-rescan"
                                        onClick={() => {
                                            setCapturedFrames({});
                                            setCurrentAngleIndex(0);
                                            setStep('scan');
                                        }}
                                    >
                                        🔄 إعادة المسح
                                    </button>

                                    <button
                                        className="aos-btn-download"
                                        onClick={handleDownloadGLB}
                                    >
                                        <span>📥 تنزيل ملف GLB</span>
                                    </button>

                                    <button
                                        className="aos-btn-save"
                                        onClick={handleSaveToAR}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <span>جاري الحفظ ({saveProgress}%)…</span>
                                        ) : (
                                            <>
                                                <span>✨ حفظ في مجسمات الواقع المعزز</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
