import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { indoorControlService } from '../services/api';
import './IndoorControl.css';

export default function IndoorControl({ user, onClose }) {
    // القوائم وحالات الواجهة
    const [buildings, setBuildings] = useState([]);
    const [selectedBuildingId, setSelectedBuildingId] = useState(null);
    const [buildingInfo, setBuildingInfo] = useState(null);
    const [shelves, setShelves] = useState([]);
    const [selectedShelf, setSelectedShelf] = useState(null);
    const [activeMode, setActiveMode] = useState('view'); // view, draw_shelf, delete_shelf
    const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
    
    // بيانات إدخال المبنى الجديد
    const [newBuildingName, setNewBuildingName] = useState('');
    const [newBuildingPlanUrl, setNewBuildingPlanUrl] = useState('');
    const [newBuildingScale, setNewBuildingScale] = useState(1.0);

    // مراجع الـ 3D Canvas و Three.js
    const canvasContainerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const meshesMapRef = useRef(new Map()); // لربط كائنات الـ Three.js ببيانات الرفوف

    // ── 1. جلب قائمة المباني عند فتح المكون ─────────────────────────────────
    useEffect(() => {
        loadBuildings();
    }, []);

    const loadBuildings = async () => {
        try {
            const res = await indoorControlService.getBuildings();
            if (res && res.success) {
                setBuildings(res.buildings);
                if (res.buildings.length > 0) {
                    setSelectedBuildingId(res.buildings[0].id);
                }
            }
        } catch (err) {
            console.error('Failed to load buildings:', err);
        }
    };

    // ── 2. جلب المخطط وتصميم الرفوف عند تغيير المبنى المحدد ───────────────────
    useEffect(() => {
        if (selectedBuildingId) {
            loadLayout(selectedBuildingId);
        }
    }, [selectedBuildingId]);

    const loadLayout = async (buildingId) => {
        try {
            const res = await indoorControlService.getLayout(buildingId);
            if (res && res.success) {
                setBuildingInfo(res.building);
                setShelves(res.shelves);
                setSelectedShelf(null);
                
                // إعادة رسم المشهد ثلاثي الأبعاد بالكامل
                rebuild3DScene(res.shelves);
            }
        } catch (err) {
            console.error('Failed to load layout:', err);
        }
    };

    // ── 3. إعداد وتحديث المشهد ثلاثي الأبعاد (Three.js Engine) ────────────────
    useEffect(() => {
        // إنشاء المشهد والكاميرا والرندرة لمرة واحدة
        const container = canvasContainerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x06090f);
        sceneRef.current = scene;

        // الكاميرا
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 15, 15);
        cameraRef.current = camera;

        // الرندرة
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        rendererRef.current = renderer;

        // تفريغ الحاوية وإضافة الـ Canvas الجديد
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // أدوات التحكم (OrbitControls)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05; // منع الكاميرا من النزول تحت الأرض
        controlsRef.current = controls;

        // الإضاءة
        const ambientLight = new THREE.AmbientLight(0x1e293b, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // الشبكة الأرضية (Ground Grid)
        const gridHelper = new THREE.GridHelper(30, 30, 0x3b82f6, 0x1e293b);
        gridHelper.position.y = -0.01; // أسفل الأرضية بقليل لتجنب الوميض
        scene.add(gridHelper);

        // الأرضية
        const floorGeo = new THREE.PlaneGeometry(30, 30);
        const floorMat = new THREE.MeshStandardMaterial({ 
            color: 0x090f1b, 
            roughness: 0.8,
            metalness: 0.1
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // حلقة التحديث المستمر (Animation Loop)
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // التعامل مع تغيير حجم الشاشة
        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // ── 4. إعادة بناء مجسمات الرفوف عند تغيير البيانات ────────────────────────
    const rebuild3DScene = (shelvesList) => {
        const scene = sceneRef.current;
        if (!scene) return;

        // 1. إزالة كافة مجسمات الرفوف الحالية من المشهد وتفريغ الذاكرة
        meshesMapRef.current.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        meshesMapRef.current.clear();

        // 2. بناء المجسمات الجديدة
        shelvesList.forEach(shelf => {
            const width = shelf.width || 2.0;
            const depth = shelf.depth || 0.8;
            const height = shelf.height || 1.8;

            // تحديد اللون بناءً على سعة المخزون في الرف
            let shelfColor = 0x10b981; // أخضر افتراضي (ممتاز)
            
            // حساب نسبة المخزون الإجمالية للرف
            let totalQty = 0;
            let totalCap = 0;
            shelf.levels.forEach(lvl => {
                lvl.placements.forEach(p => {
                    totalQty += p.quantity || 0;
                    totalCap += p.max_capacity || 10;
                });
            });

            if (totalCap > 0) {
                const ratio = totalQty / totalCap;
                if (ratio === 0) {
                    shelfColor = 0xef4444; // أحمر (فارغ)
                } else if (ratio <= 0.3) {
                    shelfColor = 0xf59e0b; // برتقالي (منخفض)
                }
            }

            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshStandardMaterial({
                color: shelfColor,
                roughness: 0.3,
                metalness: 0.2,
                transparent: true,
                opacity: 0.85
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(shelf.x, height / 2, shelf.y);
            mesh.rotation.y = (shelf.rotation * Math.PI) / 180;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // حفظ معرف الرف في بيانات الـ Mesh
            mesh.userData = { shelfId: shelf.id };

            scene.add(mesh);
            meshesMapRef.current.set(shelf.id, mesh);
        });
    };

    // ── 5. النقر على الـ Canvas لاختيار الرف أو رسم رف جديد ─────────────────
    const handleCanvasClick = (event) => {
        const container = canvasContainerRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!container || !scene || !camera) return;

        // حساب إحداثيات النقر النسبية (-1 إلى +1)
        const rect = container.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

        // جلب جميع التقاطعات مع المجسمات ثلاثية الأبعاد
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (activeMode === 'view') {
            // وضع العرض: تحديد الرف الذي تم الضغط عليه
            const clickedShelfMesh = intersects.find(intersect => intersect.object.userData && intersect.object.userData.shelfId);
            if (clickedShelfMesh) {
                const shelfId = clickedShelfMesh.object.userData.shelfId;
                const foundShelf = shelves.find(s => s.id === shelfId);
                if (foundShelf) {
                    setSelectedShelf(foundShelf);
                    
                    // عمل توهج خفيف للرف المختار
                    highlightSelectedMesh(shelfId);
                }
            } else {
                setSelectedShelf(null);
                resetAllHighlights();
            }
        } else if (activeMode === 'draw_shelf') {
            // وضع الرسم: وضع رف جديد عند نقطة النقر على الأرضية
            const floorIntersect = intersects.find(intersect => intersect.object.geometry instanceof THREE.PlaneGeometry);
            if (floorIntersect) {
                const point = floorIntersect.point;
                addNewShelfAt(point.x, point.z);
            }
        }
    };

    // تمييز الرف المختار
    const highlightSelectedMesh = (shelfId) => {
        meshesMapRef.current.forEach((mesh, id) => {
            if (id === shelfId) {
                mesh.material.emissive = new THREE.Color(0x3b82f6);
                mesh.material.emissiveIntensity = 0.4;
            } else {
                mesh.material.emissive = new THREE.Color(0x000000);
                mesh.material.emissiveIntensity = 0;
            }
        });
    };

    const resetAllHighlights = () => {
        meshesMapRef.current.forEach(mesh => {
            mesh.material.emissive = new THREE.Color(0x000000);
            mesh.material.emissiveIntensity = 0;
        });
    };

    // إضافة رف جديد محلياً في القائمة
    const addNewShelfAt = (x, z) => {
        const newUnitCode = `رف-${shelves.length + 1}`;
        const newShelf = {
            id: null, // null يعني رف جديد لم يحفظ بعد بالسيرفر
            unit_code: newUnitCode,
            x: parseFloat(x.toFixed(2)),
            y: parseFloat(z.toFixed(2)),
            width: 2.0,
            depth: 0.8,
            height: 1.8,
            rotation: 0,
            levels: [
                {
                    id: null,
                    level_number: 1,
                    height_offset: 0.4,
                    placements: [{ id: null, product_name: 'منتج تجريبي', product_id: 'PRD-01', quantity: 5, max_capacity: 10 }]
                },
                {
                    id: null,
                    level_number: 2,
                    height_offset: 1.0,
                    placements: [{ id: null, product_name: 'منتج تجريبي 2', product_id: 'PRD-02', quantity: 2, max_capacity: 10 }]
                }
            ]
        };

        const updatedShelves = [...shelves, newShelf];
        setShelves(updatedShelves);
        rebuild3DScene(updatedShelves);
        setSelectedShelf(newShelf);
        setActiveMode('view'); // العودة لوضع العرض بعد وضع الرف
    };

    // ── 6. حفظ التعديلات على السيرفر ───────────────────────────────────────
    const handleSaveLayout = async () => {
        if (!selectedBuildingId) return;
        try {
            const res = await indoorControlService.saveLayout(selectedBuildingId, shelves);
            if (res && res.success) {
                alert('🎉 تم حفظ وتحديث مخطط التحكم الداخلي والرفوف بنجاح!');
                loadLayout(selectedBuildingId);
            }
        } catch (err) {
            console.error('Failed to save layout:', err);
            alert('⚠️ فشل في حفظ المخطط، يرجى المحاولة لاحقاً');
        }
    };

    // ── 7. تحديث كميات المخزون مباشرة من لوحة التحكم ────────────────────────
    const handleUpdateQty = async (placement, change) => {
        const newQty = Math.max(0, Math.min(placement.max_capacity, placement.quantity + change));
        
        // تحديث محلي سريع في القائمة
        const updatedShelves = shelves.map(s => {
            return {
                ...s,
                levels: s.levels.map(l => {
                    return {
                        ...l,
                        placements: l.placements.map(p => {
                            if (p.id === placement.id) {
                                return { ...p, quantity: newQty };
                            }
                            return p;
                        })
                    };
                })
            };
        });

        setShelves(updatedShelves);
        
        // تحديث مجسم الـ 3D ليعكس الألوان الجديدة
        rebuild3DScene(updatedShelves);

        // تحديث الرف المختار حالياً بالواجهة
        if (selectedShelf) {
            const updatedSelected = updatedShelves.find(s => s.id === selectedShelf.id);
            if (updatedSelected) setSelectedShelf(updatedSelected);
        }

        // إرسال التعديل للسيرفر لحفظه في قاعدة البيانات
        if (placement.id) {
            try {
                await indoorControlService.updateStock(placement.id, newQty);
            } catch (err) {
                console.error('Failed to save stock update to database:', err);
            }
        }
    };

    // ── 8. إنشاء مبنى جديد ──────────────────────────────────────────────────
    const handleCreateBuilding = async () => {
        if (!newBuildingName.trim()) return;
        try {
            const res = await indoorControlService.createBuilding({
                name: newBuildingName,
                floor_plan_url: newBuildingPlanUrl,
                scale_ratio: newBuildingScale
            });
            if (res && res.success) {
                alert('🎉 تم إنشاء المبنى بنجاح!');
                setShowAddBuildingModal(false);
                setNewBuildingName('');
                setNewBuildingPlanUrl('');
                setNewBuildingScale(1.0);
                loadBuildings();
            }
        } catch (err) {
            console.error('Failed to create building:', err);
        }
    };

    // حذف الرف المحدد محلياً
    const handleDeleteSelectedShelf = () => {
        if (!selectedShelf) return;
        const updated = shelves.filter(s => s.unit_code !== selectedShelf.unit_code && s.id !== selectedShelf.id);
        setShelves(updated);
        rebuild3DScene(updated);
        setSelectedShelf(null);
    };

    return (
        <div className="ic-dashboard-overlay">
            {/* Header */}
            <div className="ic-header">
                <div className="ic-header-title">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#60a5fa" strokeWidth="2.2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <h2>نظام التحكم الداخلي ثلاثي الأبعاد (3D Control Tower)</h2>
                </div>
                <div className="ic-header-actions">
                    <button className="ic-btn ic-btn-primary" onClick={handleSaveLayout}>
                        💾 حفظ التغييرات والمخطط
                    </button>
                    <button className="ic-btn ic-btn-close" onClick={onClose}>
                        إغلاق لوحة التحكم ×
                    </button>
                </div>
            </div>

            {/* Main Layout */}
            <div className="ic-main-layout">
                
                {/* Sidebar Left: المباني وأدوات الرسم */}
                <div className="ic-sidebar-left">
                    <div>
                        <div className="ic-card-title">المبنى النشط</div>
                        <select 
                            className="ic-select-input" 
                            value={selectedBuildingId || ''} 
                            onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                        >
                            {buildings.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                        {user?.role === 'admin' && (
                            <button 
                                className="ic-btn" 
                                style={{ marginTop: '10px', width: '100%', justifyContent: 'center' }}
                                onClick={() => setShowAddBuildingModal(true)}
                            >
                                ➕ إضافة مبنى جديد
                            </button>
                        )}
                    </div>

                    {user?.role === 'admin' && (
                        <div>
                            <div className="ic-card-title">أدوات تعديل المخطط</div>
                            <div className="ic-draw-tools">
                                <button 
                                    className={`ic-tool-btn ${activeMode === 'view' ? 'active' : ''}`}
                                    onClick={() => setActiveMode('view')}
                                >
                                    <span>🔍 وضع العرض والتحديد</span>
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                    </svg>
                                </button>
                                <button 
                                    className={`ic-tool-btn ${activeMode === 'draw_shelf' ? 'active' : ''}`}
                                    onClick={() => setActiveMode('draw_shelf')}
                                >
                                    <span>🧱 إضافة رف جديد (أنقر على الأرضية)</span>
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 'auto' }}>
                        <div className="ic-card-title">دليل الألوان للمخزون</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '15px', height: '15px', borderRadius: '4px', background: '#10b981' }} />
                                <span>ممتاز (أكثر من 30% من السعة)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '15px', height: '15px', borderRadius: '4px', background: '#f59e0b' }} />
                                <span>منخفض (أقل من 30%)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '15px', height: '15px', borderRadius: '4px', background: '#ef4444' }} />
                                <span>فارغ تماماً (0%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Center: 3D Canvas */}
                <div 
                    className="ic-canvas-container" 
                    ref={canvasContainerRef}
                    onClick={handleCanvasClick}
                >
                    <div className="ic-mode-badge">
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeMode === 'view' ? '#10b981' : '#3b82f6', display: 'inline-block' }} />
                        <span>الوضع الحالي: {activeMode === 'view' ? 'المعاينة والتحديد' : 'إضافة رفوف'}</span>
                    </div>
                </div>

                {/* Sidebar Right: تفاصيل الرف والمخزون والتحكم */}
                <div className="ic-sidebar-right">
                    <div className="ic-card-title">تفاصيل الرف المختار</div>
                    
                    {selectedShelf ? (
                        <div className="ic-shelf-details">
                            <div className="ic-detail-row">
                                <span className="ic-detail-label">كود الرف</span>
                                <span className="ic-detail-value">{selectedShelf.unit_code}</span>
                            </div>
                            <div className="ic-detail-row">
                                <span className="ic-detail-label">الإحداثيات</span>
                                <span className="ic-detail-value">X: {selectedShelf.x} | Y: {selectedShelf.y}</span>
                            </div>
                            
                            <div style={{ marginTop: '10px' }}>
                                <div className="ic-card-title" style={{ fontSize: '0.9rem' }}>المستويات والمخزون</div>
                                <div className="ic-levels-list">
                                    {selectedShelf.levels.map(level => {
                                        const placement = level.placements[0] || { product_name: 'لا يوجد منتج', quantity: 0, max_capacity: 10 };
                                        const ratio = placement.quantity / placement.max_capacity;
                                        let indicatorClass = 'green';
                                        if (ratio === 0) indicatorClass = 'red';
                                        else if (ratio <= 0.3) indicatorClass = 'yellow';

                                        return (
                                            <div key={level.level_number} className="ic-level-card">
                                                <div className="ic-level-header">
                                                    <span>مستوى الارتفاع {level.level_number}</span>
                                                    <span className={`ic-stock-indicator ${indicatorClass}`}>
                                                        {placement.quantity} / {placement.max_capacity} وحدة
                                                    </span>
                                                </div>
                                                <div className="ic-product-info">
                                                    <span style={{ color: '#94a3b8' }}>المنتج:</span>
                                                    <span style={{ fontWeight: '600' }}>{placement.product_name}</span>
                                                </div>
                                                <div className="ic-stock-actions">
                                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>تحديث المخزون:</span>
                                                    <button className="ic-stock-btn" onClick={() => handleUpdateQty(placement, -1)}>-</button>
                                                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{placement.quantity}</span>
                                                    <button className="ic-stock-btn" onClick={() => handleUpdateQty(placement, 1)}>+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {user?.role === 'admin' && (
                                <button 
                                    className="ic-btn ic-btn-close" 
                                    style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                                    onClick={handleDeleteSelectedShelf}
                                >
                                    🗑️ حذف هذا الرف بالكامل
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px', fontSize: '0.95rem' }}>
                            💡 يرجى النقر على أي رف في الشاشة ثلاثية الأبعاد لعرض وإدارة تفاصيل المخزون الخاص به.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: إضافة مبنى جديد */}
            {showAddBuildingModal && (
                <div className="ic-modal-backdrop" onClick={() => setShowAddBuildingModal(false)}>
                    <div className="ic-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ic-modal-header">إضافة مبنى أو طابق جديد</div>
                        <div className="ic-form-group">
                            <label>اسم المبنى/الطابق</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newBuildingName} 
                                onChange={(e) => setNewBuildingName(e.target.value)}
                                placeholder="مثال: مبنى المكتبة - الطابق الأرضي"
                            />
                        </div>
                        <div className="ic-form-group">
                            <label>رابط صورة مخطط الطابق (اختياري)</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newBuildingPlanUrl} 
                                onChange={(e) => setNewBuildingPlanUrl(e.target.value)}
                                placeholder="https://example.com/floorplan.png"
                            />
                        </div>
                        <div className="ic-modal-footer">
                            <button className="ic-btn" onClick={() => setShowAddBuildingModal(false)}>إلغناء</button>
                            <button className="ic-btn ic-btn-primary" onClick={handleCreateBuilding}>إنشاء وحفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
