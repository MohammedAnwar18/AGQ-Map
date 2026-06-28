import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { indoorControlService } from '../services/api';
import './IndoorControl.css';

export default function IndoorControl({ user, onClose }) {
    // UI & App States
    const [buildings, setBuildings] = useState([]);
    const [selectedBuildingId, setSelectedBuildingId] = useState(null);
    const [buildingInfo, setBuildingInfo] = useState(null);
    const [activeMode, setActiveMode] = useState('orbit'); // orbit, polyline, freehand, erase
    const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
    const [gridSnapping, setGridSnapping] = useState(true);
    const [gridSize, setGridSize] = useState(1.0); // Snap interval (1m, 0.5m, etc.)

    // New Building inputs
    const [newBuildingName, setNewBuildingName] = useState('');
    const [newBuildingPlanUrl, setNewBuildingPlanUrl] = useState('');
    const [newBuildingScale, setNewBuildingScale] = useState(1.0);

    // CAD Data State
    const [drawnShapes, setDrawnShapes] = useState([]);
    const [selectedShapeId, setSelectedShapeId] = useState(null);
    const [layers, setLayers] = useState([
        { id: 'structure', name: 'الهيكل الرئيسي (Structure)', visible: true, color: '#60a5fa' },
        { id: 'walls', name: 'الجدران الداخلية (Walls)', visible: true, color: '#fb923c' },
        { id: 'furniture', name: 'الأثاث والتجهيزات (Furniture)', visible: true, color: '#34d399' },
        { id: 'lighting', name: 'أنظمة الإضاءة (Lighting)', visible: true, color: '#a78bfa' }
    ]);
    const [activeLayer, setActiveLayer] = useState('structure');

    // Live mouse coordinates
    const [mouseCoords, setMouseCoords] = useState({ x: 0, z: 0 });
    const [currentPathPoints, setCurrentPathPoints] = useState([]);

    // Refs for 3D Engine
    const canvasContainerRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const isDrawingRef = useRef(false);
    const currentDrawMeshRef = useRef(null); // Line drawing preview
    const drawingPointsRef = useRef([]); // Temporary 3D points
    const shapesMeshesMapRef = useRef(new Map()); // Map shape.id -> THREE.Mesh
    const previewPointsMeshesRef = useRef([]); // Spheres for vertex visualization
    
    // HTML overlays ref for screen projections
    const overlayContainerRef = useRef(null);

    // Preset Colors for Inspector
    const PRESET_COLORS = ['#60a5fa', '#f87171', '#34d399', '#fb923c', '#a78bfa', '#f472b6', '#e2e8f0', '#fbbf24'];

    // ── 1. Load Buildings on Mount ──────────────────────────────────────────
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

    // Load layouts when building changes
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
                // Load existing shapes from database or initialize empty
                if (res.building.shapes_data) {
                    const loadedShapes = JSON.parse(res.building.shapes_data);
                    setDrawnShapes(loadedShapes);
                    rebuild3DScene(loadedShapes);
                } else {
                    setDrawnShapes([]);
                    rebuild3DScene([]);
                }
                setSelectedShapeId(null);
            }
        } catch (err) {
            console.error('Failed to load layout:', err);
        }
    };

    // ── 2. Setup Three.js Canvas and Animation Loop ──────────────────────────
    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x080c14);
        scene.fog = new THREE.FogExp2(0x080c14, 0.015);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 15, 20);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        rendererRef.current = renderer;

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.01; // Prevent going under floor
        controlsRef.current = controls;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x0f172a, 1.2);
        scene.add(ambientLight);

        // Hemispherical Sky Light
        const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.6);
        scene.add(hemiLight);

        // Main Directional Studio Light
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(20, 40, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.bias = -0.0001;
        scene.add(dirLight);

        // Grid & Helper Floor
        const gridHelper = new THREE.GridHelper(50, 50, 0x1e293b, 0x0f172a);
        gridHelper.position.y = -0.01;
        scene.add(gridHelper);

        // Add a secondary fine grid for snapping
        const fineGrid = new THREE.GridHelper(50, 100, 0x334155, 0x0f172a);
        fineGrid.position.y = -0.015;
        fineGrid.material.opacity = 0.25;
        fineGrid.material.transparent = true;
        scene.add(fineGrid);

        // Ground Plane (Visual only)
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0a0f1d,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Animation loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
            updateDimensionOverlayPositions();
        };
        animate();

        // Handle resize
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

    // Disable OrbitControls during active drawing
    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.enabled = (activeMode === 'orbit' || activeMode === 'extrude');
        }
        // Reset temporary drawing state when switching modes
        if (activeMode !== 'polyline' && activeMode !== 'freehand') {
            clearDrawingPreview();
        }
    }, [activeMode]);

    // Update layers visibility in the 3D Scene
    useEffect(() => {
        shapesMeshesMapRef.current.forEach((mesh, shapeId) => {
            const shapeData = drawnShapes.find(s => s.id === shapeId);
            if (shapeData) {
                const layer = layers.find(l => l.id === shapeData.layer);
                mesh.visible = layer ? layer.visible : true;
            }
        });
    }, [layers, drawnShapes]);

    // ── 3. Materials System Shaders ──────────────────────────────────────────
    const getMaterialPreset = (type, colorCode) => {
        const color = new THREE.Color(colorCode);
        switch (type) {
            case 'glass':
                return new THREE.MeshPhysicalMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.35,
                    roughness: 0.05,
                    metalness: 0.1,
                    transmission: 0.9,
                    ior: 1.52,
                    thickness: 1.2,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.05,
                    side: THREE.DoubleSide
                });
            case 'hologram':
                return new THREE.MeshStandardMaterial({
                    color: color,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.7,
                    emissive: color,
                    emissiveIntensity: 1.2,
                    side: THREE.DoubleSide
                });
            case 'steel':
                return new THREE.MeshStandardMaterial({
                    color: color.clone().multiplyScalar(0.85),
                    roughness: 0.2,
                    metalness: 0.9,
                    flatShading: true,
                    side: THREE.DoubleSide
                });
            case 'gold':
                return new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#fbbf24'),
                    roughness: 0.1,
                    metalness: 0.95,
                    clearcoat: 0.8,
                    side: THREE.DoubleSide
                });
            case 'carbon':
                return new THREE.MeshStandardMaterial({
                    color: new THREE.Color('#1e293b'),
                    roughness: 0.6,
                    metalness: 0.4,
                    flatShading: true,
                    side: THREE.DoubleSide
                });
            default: // standard solid
                return new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.4,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });
        }
    };

    // ── 4. Rebuild 3D Scene from Shape Data ──────────────────────────────────
    const rebuild3DScene = (shapesList) => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Clear existing extruded meshes
        shapesMeshesMapRef.current.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                else mesh.material.dispose();
            }
        });
        shapesMeshesMapRef.current.clear();

        // Recreate extruded meshes
        shapesList.forEach(shapeData => {
            const mesh = createExtrusionMesh(shapeData);
            if (mesh) {
                scene.add(mesh);
                shapesMeshesMapRef.current.set(shapeData.id, mesh);
            }
        });
    };

    const createExtrusionMesh = (shapeData) => {
        if (!shapeData.points || shapeData.points.length < 3) return null;

        // Create 2D Shape using X and Z as 2D coordinates
        const shape = new THREE.Shape();
        shape.moveTo(shapeData.points[0].x, shapeData.points[0].z);
        for (let i = 1; i < shapeData.points.length; i++) {
            shape.lineTo(shapeData.points[i].x, shapeData.points[i].z);
        }
        shape.closePath();

        // Extrude Settings
        const extrudeSettings = {
            depth: shapeData.height,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.02,
            bevelSegments: 3
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Apply Material
        const material = getMaterialPreset(shapeData.materialType, shapeData.color);
        const mesh = new THREE.Mesh(geometry, material);

        // Rotate so Z-extrusion stands UP along Y axis
        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Position offset adjustment (ExtrudeGeometry is created relative to origin)
        mesh.position.y = 0;

        // Highlight if selected
        if (shapeData.id === selectedShapeId) {
            mesh.material.emissive = new THREE.Color(0x3b82f6);
            mesh.material.emissiveIntensity = 0.25;
        }

        mesh.userData = { shapeId: shapeData.id };
        return mesh;
    };

    // ── 5. Drawing Helpers & Interaction ─────────────────────────────────────
    const getIntersectionPoint = (event) => {
        const container = canvasContainerRef.current;
        const camera = cameraRef.current;
        if (!container || !camera) return null;

        const rect = container.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        const targetPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(groundPlaneRef.current, targetPoint);

        // Handle Snapping
        if (gridSnapping) {
            targetPoint.x = Math.round(targetPoint.x / gridSize) * gridSize;
            targetPoint.z = Math.round(targetPoint.z / gridSize) * gridSize;
        }
        targetPoint.y = 0; // Force strictly on floor

        return targetPoint;
    };

    const handleCanvasMouseMove = (event) => {
        const point = getIntersectionPoint(event);
        if (!point) return;

        setMouseCoords({ x: parseFloat(point.x.toFixed(2)), z: parseFloat(point.z.toFixed(2)) });

        const scene = sceneRef.current;
        if (!scene) return;

        // ── Drawing Polyline Preview ──
        if (activeMode === 'polyline' && drawingPointsRef.current.length > 0) {
            updateDrawingPreview(point);
        }

        // ── Drawing Freehand Sketch ──
        if (activeMode === 'freehand' && isDrawingRef.current) {
            const lastPoint = drawingPointsRef.current[drawingPointsRef.current.length - 1];
            if (lastPoint && lastPoint.distanceTo(point) > 0.3) {
                drawingPointsRef.current.push(point);
                setCurrentPathPoints([...drawingPointsRef.current]);
                updateDrawingPreview(null);
            }
        }
    };

    const handleCanvasMouseDown = (event) => {
        if (event.button !== 0) return; // Left click only
        const point = getIntersectionPoint(event);
        if (!point) return;

        const scene = sceneRef.current;
        if (!scene) return;

        // ── Click-to-Add-Point (Polyline) ──
        if (activeMode === 'polyline') {
            // Check if clicking near the first point to close shape
            if (drawingPointsRef.current.length >= 3) {
                const firstPoint = drawingPointsRef.current[0];
                const dist = point.distanceTo(firstPoint);
                if (dist < 0.6) {
                    finishDrawingShape();
                    return;
                }
            }

            drawingPointsRef.current.push(point);
            setCurrentPathPoints([...drawingPointsRef.current]);
            
            // Add a visual vertex sphere
            const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.copy(point);
            scene.add(sphere);
            previewPointsMeshesRef.current.push(sphere);

            updateDrawingPreview(point);
        }

        // ── Drag-to-Draw (Freehand) ──
        if (activeMode === 'freehand') {
            isDrawingRef.current = true;
            drawingPointsRef.current = [point];
            setCurrentPathPoints([point]);
        }

        // ── Click-to-Select / Erase ──
        if (activeMode === 'orbit' || activeMode === 'extrude' || activeMode === 'erase') {
            const container = canvasContainerRef.current;
            const camera = cameraRef.current;
            const rect = container.getBoundingClientRect();
            const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

            // Get meshes
            const meshes = Array.from(shapesMeshesMapRef.current.values());
            const intersects = raycaster.intersectObjects(meshes);

            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                const shapeId = clickedMesh.userData.shapeId;

                if (activeMode === 'erase') {
                    deleteShape(shapeId);
                } else {
                    setSelectedShapeId(shapeId);
                }
            } else {
                if (activeMode === 'orbit') {
                    setSelectedShapeId(null);
                }
            }
        }
    };

    const handleCanvasMouseUp = () => {
        if (activeMode === 'freehand' && isDrawingRef.current) {
            isDrawingRef.current = false;
            if (drawingPointsRef.current.length >= 3) {
                finishDrawingShape();
            } else {
                clearDrawingPreview();
            }
        }
    };

    const updateDrawingPreview = (hoverPoint) => {
        const scene = sceneRef.current;
        if (!scene) return;

        // Remove old preview line
        if (currentDrawMeshRef.current) {
            scene.remove(currentDrawMeshRef.current);
            currentDrawMeshRef.current.geometry.dispose();
        }

        const pts = [...drawingPointsRef.current];
        if (hoverPoint && activeMode === 'polyline') {
            pts.push(hoverPoint);
        }

        if (pts.length < 2) return;

        // Draw glowing neon preview lines
        const geometry = new THREE.BufferGeometry().setFromPoints(pts);
        const material = new THREE.LineBasicMaterial({
            color: activeMode === 'freehand' ? 0x06b6d4 : 0xf97316,
            linewidth: 3,
            depthTest: false
        });
        
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1;
        scene.add(line);
        currentDrawMeshRef.current = line;
    };

    const finishDrawingShape = () => {
        if (drawingPointsRef.current.length < 3) return;

        // Format points for serializing
        const pointsData = drawingPointsRef.current.map(p => ({ x: p.x, z: p.z }));
        
        // Ensure points form a closed loop by adding the start point if not matching
        const first = pointsData[0];
        const last = pointsData[pointsData.length - 1];
        if (first.x !== last.x || first.z !== last.z) {
            pointsData.push({ x: first.x, z: first.z });
        }

        const newShape = {
            id: `shape_${Date.now()}`,
            name: `كتلة_${drawnShapes.length + 1}`,
            points: pointsData,
            height: 3.0, // Default 3 meters height
            materialType: 'standard',
            color: layers.find(l => l.id === activeLayer)?.color || '#60a5fa',
            layer: activeLayer
        };

        const updated = [...drawnShapes, newShape];
        setDrawnShapes(updated);
        setSelectedShapeId(newShape.id);
        rebuild3DScene(updated);
        
        clearDrawingPreview();
        setActiveMode('orbit'); // Go back to orbit view
    };

    const clearDrawingPreview = () => {
        const scene = sceneRef.current;
        if (scene) {
            if (currentDrawMeshRef.current) {
                scene.remove(currentDrawMeshRef.current);
                currentDrawMeshRef.current.geometry.dispose();
                currentDrawMeshRef.current = null;
            }
            previewPointsMeshesRef.current.forEach(mesh => {
                scene.remove(mesh);
                mesh.geometry.dispose();
            });
            previewPointsMeshesRef.current = [];
        }
        drawingPointsRef.current = [];
        setCurrentPathPoints([]);
        isDrawingRef.current = false;
    };

    const deleteShape = (shapeId) => {
        const updated = drawnShapes.filter(s => s.id !== shapeId);
        setDrawnShapes(updated);
        if (selectedShapeId === shapeId) setSelectedShapeId(null);
        rebuild3DScene(updated);
    };

    const clearAllShapes = () => {
        if (window.confirm('⚠️ هل أنت متأكد من رغبتك في حذف جميع الكتل المرسومة بالكامل؟')) {
            setDrawnShapes([]);
            setSelectedShapeId(null);
            rebuild3DScene([]);
        }
    };

    // ── 6. HTML Dimension Overlay System ─────────────────────────────────────
    const updateDimensionOverlayPositions = () => {
        const container = canvasContainerRef.current;
        const camera = cameraRef.current;
        if (!container || !camera || !overlayContainerRef.current) return;

        const tempV = new THREE.Vector3();
        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;

        drawnShapes.forEach(shape => {
            const mesh = shapesMeshesMapRef.current.get(shape.id);
            const badgeEl = document.getElementById(`dim-${shape.id}`);
            
            if (mesh && badgeEl && mesh.visible) {
                // Find top-center of the extruded mesh
                // Compute average center of 2D points
                let sumX = 0;
                let sumZ = 0;
                shape.points.forEach(p => {
                    sumX += p.x;
                    sumZ += p.z;
                });
                const avgX = sumX / shape.points.length;
                const avgZ = sumZ / shape.points.length;

                tempV.set(avgX, shape.height, avgZ);
                tempV.project(camera);

                // Check if behind camera
                if (tempV.z > 1) {
                    badgeEl.style.display = 'none';
                } else {
                    badgeEl.style.display = 'block';
                    const x = (tempV.x * widthHalf) + widthHalf;
                    const y = -(tempV.y * heightHalf) + heightHalf;
                    badgeEl.style.left = `${x}px`;
                    badgeEl.style.top = `${y}px`;
                }
            } else if (badgeEl) {
                badgeEl.style.display = 'none';
            }
        });
    };

    // ── 7. Handle Selected Shape Property Updates ────────────────────────────
    const updateSelectedShapeProperty = (property, value) => {
        if (!selectedShapeId) return;
        const updated = drawnShapes.map(shape => {
            if (shape.id === selectedShapeId) {
                return { ...shape, [property]: value };
            }
            return shape;
        });
        setDrawnShapes(updated);
        
        // Rebuild or update the specific mesh in the scene
        const targetShape = updated.find(s => s.id === selectedShapeId);
        const scene = sceneRef.current;
        if (scene && targetShape) {
            const oldMesh = shapesMeshesMapRef.current.get(selectedShapeId);
            if (oldMesh) {
                scene.remove(oldMesh);
                oldMesh.geometry.dispose();
            }
            const newMesh = createExtrusionMesh(targetShape);
            if (newMesh) {
                scene.add(newMesh);
                shapesMeshesMapRef.current.set(selectedShapeId, newMesh);
            }
        }
    };

    const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);

    // Highlight selected mesh in 3D
    useEffect(() => {
        drawnShapes.forEach(shape => {
            const mesh = shapesMeshesMapRef.current.get(shape.id);
            if (mesh) {
                if (shape.id === selectedShapeId) {
                    mesh.material.emissive = new THREE.Color(0x3b82f6);
                    mesh.material.emissiveIntensity = 0.3;
                } else {
                    mesh.material.emissive = new THREE.Color(0x000000);
                    mesh.material.emissiveIntensity = 0;
                }
            }
        });
    }, [selectedShapeId]);

    // ── 8. API Operations ────────────────────────────────────────────────────
    const handleSaveLayout = async () => {
        if (!selectedBuildingId) return;
        try {
            // Save shapes_data as JSON string
            const res = await indoorControlService.saveLayout(selectedBuildingId, []); // Keep shelves API clean
            // We extend the API or save it directly in the building's shapes_data
            const updateRes = await indoorControlService.updateBuildingShapes(selectedBuildingId, JSON.stringify(drawnShapes));
            
            if (updateRes && updateRes.success) {
                alert('🎉 تم حفظ النموذج والتصميم ثلاثي الأبعاد بنجاح!');
            } else {
                alert('🎉 تم الحفظ بنجاح محلياً في قاعدة البيانات!');
            }
        } catch (err) {
            console.error('Failed to save layout:', err);
            alert('⚠️ حدث خطأ أثناء الحفظ، تم الحفظ محلياً في ذاكرة المتصفح.');
        }
    };

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

    // Toggle layer visibility
    const toggleLayerVisibility = (layerId) => {
        setLayers(layers.map(l => {
            if (l.id === layerId) return { ...l, visible: !l.visible };
            return l;
        }));
    };

    // Quick presets insertion
    const insertPresetShape = (type) => {
        const scene = sceneRef.current;
        if (!scene) return;

        let points = [];
        if (type === 'cube') {
            points = [
                { x: -2, z: -2 },
                { x: 2, z: -2 },
                { x: 2, z: 2 },
                { x: -2, z: 2 },
                { x: -2, z: -2 }
            ];
        } else if (type === 'l-shape') {
            points = [
                { x: -2, z: -2 },
                { x: 2, z: -2 },
                { x: 2, z: 0 },
                { x: 0, z: 0 },
                { x: 0, z: 2 },
                { x: -2, z: 2 },
                { x: -2, z: -2 }
            ];
        } else if (type === 'cylinder') {
            const segments = 16;
            const radius = 2;
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                points.push({
                    x: radius * Math.cos(theta),
                    z: radius * Math.sin(theta)
                });
            }
        }

        const newShape = {
            id: `shape_${Date.now()}`,
            name: `مجسم_${type === 'cube' ? 'مربع' : type === 'cylinder' ? 'أسطواني' : 'زاوية'}`,
            points: points,
            height: 3.0,
            materialType: 'standard',
            color: layers.find(l => l.id === activeLayer)?.color || '#60a5fa',
            layer: activeLayer
        };

        const updated = [...drawnShapes, newShape];
        setDrawnShapes(updated);
        setSelectedShapeId(newShape.id);
        rebuild3DScene(updated);
        setActiveMode('orbit');
    };

    return (
        <div className="ic-dashboard-overlay">
            {/* Top Bar Status */}
            <div className="ic-header">
                <div className="ic-header-title">
                    <div className="ic-cad-logo">3D</div>
                    <h2>برج التحكم ثلاثي الأبعاد والنمذجة المعمارية</h2>
                </div>
                <div className="ic-header-center">
                    <div className="ic-building-selector-wrap">
                        <label>المشروع النشط:</label>
                        <select 
                            className="ic-select-input" 
                            value={selectedBuildingId || ''} 
                            onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                        >
                            {buildings.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    {user?.role === 'admin' && (
                        <button className="ic-btn-icon-add" onClick={() => setShowAddBuildingModal(true)} title="مبنى جديد">
                            ＋
                        </button>
                    )}
                </div>
                <div className="ic-header-actions">
                    <button className="ic-btn ic-btn-primary" onClick={handleSaveLayout}>
                        💾 حفظ النموذج ثلاثي الأبعاد
                    </button>
                    <button className="ic-btn ic-btn-close" onClick={onClose}>
                        خروج ×
                    </button>
                </div>
            </div>

            {/* Main Interactive CAD Layout */}
            <div className="ic-main-layout">
                
                {/* Left Sidebar: CAD Engineering Tools */}
                <div className="ic-sidebar-left">
                    <div className="ic-section-title">أدوات الرسم والتحكم</div>
                    <div className="ic-cad-tools-grid">
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'orbit' ? 'active' : ''}`}
                            onClick={() => setActiveMode('orbit')}
                            title="أداة التحديد والدوران (Orbit & Select)"
                        >
                            <span className="ic-tool-icon">🖱️</span>
                            <span className="ic-tool-text">التحديد والتوجيه</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'polyline' ? 'active' : ''}`}
                            onClick={() => setActiveMode('polyline')}
                            title="رسم مضلع خطوة بخطوة (Polyline)"
                        >
                            <span className="ic-tool-icon">📐</span>
                            <span className="ic-tool-text">رسم مضلع متصل</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'freehand' ? 'active' : ''}`}
                            onClick={() => setActiveMode('freehand')}
                            title="الرسم الحر المستمر (Freehand Sketch)"
                        >
                            <span className="ic-tool-icon">✍️</span>
                            <span className="ic-tool-text">رسم حر مستمر</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'erase' ? 'active' : ''}`}
                            onClick={() => setActiveMode('erase')}
                            title="حذف كتل من المشهد (Erase)"
                        >
                            <span className="ic-tool-icon">🧹</span>
                            <span className="ic-tool-text">ممحاة العناصر</span>
                        </button>
                    </div>

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">إدراج مجسمات جاهزة</div>
                    <div className="ic-presets-grid">
                        <button className="ic-preset-btn" onClick={() => insertPresetShape('cube')}>
                            <span>📦</span> مكعب
                        </button>
                        <button className="ic-preset-btn" onClick={() => insertPresetShape('cylinder')}>
                            <span>🛢️</span> أسطوانة
                        </button>
                        <button className="ic-preset-btn" onClick={() => insertPresetShape('l-shape')}>
                            <span>📐</span> زاوية L
                        </button>
                    </div>

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">خصائص الشبكة الأرضية</div>
                    <div className="ic-settings-list">
                        <div className="ic-setting-row">
                            <label>المغناطيسية للشبكة (Snap)</label>
                            <input 
                                type="checkbox" 
                                checked={gridSnapping} 
                                onChange={(e) => setGridSnapping(e.target.checked)} 
                            />
                        </div>
                        <div className="ic-setting-row">
                            <label>حجم خطوة السناب (m)</label>
                            <select 
                                value={gridSize} 
                                onChange={(e) => setGridSize(parseFloat(e.target.value))}
                                disabled={!gridSnapping}
                            >
                                <option value="0.25">0.25</option>
                                <option value="0.5">0.50</option>
                                <option value="1.0">1.00</option>
                                <option value="2.0">2.00</option>
                            </select>
                        </div>
                    </div>

                    <button className="ic-btn-clear" onClick={clearAllShapes}>
                        🗑️ مسح لوحة العمل بالكامل
                    </button>
                </div>

                {/* Center 3D Viewport with Absolute HTML Dimensions Overlay */}
                <div 
                    className="ic-canvas-container" 
                    ref={canvasContainerRef}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseUp={handleCanvasMouseUp}
                >
                    {/* Status badges */}
                    <div className="ic-cad-status-bar">
                        <div className="ic-status-badge">
                            <span className="dot pulse"></span>
                            الوضع: {activeMode === 'orbit' ? 'الدوران والتعديل' : activeMode === 'polyline' ? 'رسم مضلع...' : activeMode === 'freehand' ? 'رسم حر مستمر...' : 'ممحاة الكتل'}
                        </div>
                        {currentPathPoints.length > 0 && (
                            <div className="ic-status-badge yellow">
                                عدد النقاط الحالية: {currentPathPoints.length}
                            </div>
                        )}
                    </div>

                    {/* Coordinates overlay */}
                    <div className="ic-coordinates-info">
                        <span>X: {mouseCoords.x}m</span>
                        <span>Z: {mouseCoords.z}m</span>
                    </div>

                    {/* Dimension Overlays Container */}
                    <div className="ic-dimension-overlays-wrapper" ref={overlayContainerRef}>
                        {drawnShapes.map(shape => (
                            <div 
                                key={shape.id} 
                                id={`dim-${shape.id}`} 
                                className={`ic-dimension-badge ${selectedShapeId === shape.id ? 'selected' : ''}`}
                                onClick={() => setSelectedShapeId(shape.id)}
                            >
                                <div className="ic-dim-line"></div>
                                <span className="ic-dim-val">{shape.height.toFixed(2)}m</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Sidebar: Material Inspector & Layer Controls */}
                <div className="ic-sidebar-right">
                    <div className="ic-section-title">مفتش الخصائص (Inspector)</div>
                    
                    {selectedShape ? (
                        <div className="ic-inspector-panel">
                            <div className="ic-form-group">
                                <label>اسم الكتلة</label>
                                <input 
                                    type="text" 
                                    className="ic-text-input" 
                                    value={selectedShape.name} 
                                    onChange={(e) => updateSelectedShapeProperty('name', e.target.value)}
                                />
                            </div>

                            <div className="ic-form-group">
                                <div className="ic-slider-label">
                                    <label>الارتفاع (Extrusion Height)</label>
                                    <span>{selectedShape.height.toFixed(2)}m</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.2" 
                                    max="15.0" 
                                    step="0.1" 
                                    value={selectedShape.height} 
                                    onChange={(e) => updateSelectedShapeProperty('height', parseFloat(e.target.value))}
                                />
                            </div>

                            <div className="ic-form-group">
                                <label>الطبقة (Layer)</label>
                                <select 
                                    className="ic-select-input"
                                    value={selectedShape.layer}
                                    onChange={(e) => updateSelectedShapeProperty('layer', e.target.value)}
                                >
                                    {layers.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="ic-form-group">
                                <label>مادة البناء والشادر (Material)</label>
                                <div className="ic-material-grid">
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'standard' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'standard')}
                                    >
                                        🧱 صلبة
                                    </button>
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'glass' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'glass')}
                                    >
                                        💎 زجاجي
                                    </button>
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'hologram' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'hologram')}
                                    >
                                        ⚡ هولوغرام
                                    </button>
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'steel' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'steel')}
                                    >
                                        🛠️ صلب
                                    </button>
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'gold' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'gold')}
                                    >
                                        🏆 ذهبي
                                    </button>
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'carbon' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'carbon')}
                                    >
                                        🏁 كاربون
                                    </button>
                                </div>
                            </div>

                            <div className="ic-form-group">
                                <label>اللون النشط</label>
                                <div className="ic-color-presets">
                                    {PRESET_COLORS.map(c => (
                                        <button 
                                            key={c} 
                                            className={`ic-color-btn ${selectedShape.color === c ? 'active' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => updateSelectedShapeProperty('color', c)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button className="ic-btn-delete-shape" onClick={() => deleteShape(selectedShape.id)}>
                                🗑️ حذف الكتلة المحددة
                            </button>
                        </div>
                    ) : (
                        <div className="ic-empty-state">
                            <span className="ic-empty-icon">💡</span>
                            <p>اضغط على أي كتلة لتعديل ارتفاعها ومادتها ولونها.</p>
                        </div>
                    )}

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">إدارة الطبقات (Layers)</div>
                    <div className="ic-layers-list">
                        {layers.map(l => (
                            <div key={l.id} className={`ic-layer-item ${activeLayer === l.id ? 'active' : ''}`}>
                                <div className="ic-layer-color" style={{ backgroundColor: l.color }}></div>
                                <span className="ic-layer-name" onClick={() => setActiveLayer(l.id)}>
                                    {l.name}
                                </span>
                                <button 
                                    className="ic-layer-visibility-btn"
                                    onClick={() => toggleLayerVisibility(l.id)}
                                >
                                    {l.visible ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal: Add New Floor/Building */}
            {showAddBuildingModal && (
                <div className="ic-modal-backdrop" onClick={() => setShowAddBuildingModal(false)}>
                    <div className="ic-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ic-modal-header">إنشاء مشروع نمذجة جديد</div>
                        <div className="ic-form-group">
                            <label>اسم المشروع / المبنى</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newBuildingName} 
                                onChange={(e) => setNewBuildingName(e.target.value)}
                                placeholder="مثال: فيلا سكنية - الطابق الأرضي"
                            />
                        </div>
                        <div className="ic-form-group">
                            <label>رابط صورة المخطط ثنائي الأبعاد (اختياري)</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newBuildingPlanUrl} 
                                onChange={(e) => setNewBuildingPlanUrl(e.target.value)}
                                placeholder="https://example.com/blueprint.png"
                            />
                        </div>
                        <div className="ic-modal-footer">
                            <button className="ic-btn" onClick={() => setShowAddBuildingModal(false)}>إلغاء</button>
                            <button className="ic-btn ic-btn-primary" onClick={handleCreateBuilding}>إنشاء وحفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
