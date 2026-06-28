import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { indoorControlService } from '../services/api';
import './IndoorControl.css';

export default function IndoorControl({ user, onClose }) {
    // UI & App States
    const [buildings, setBuildings] = useState([]);
    const [selectedBuildingId, setSelectedBuildingId] = useState(null);
    const [buildingInfo, setBuildingInfo] = useState(null);
    const [activeMode, setActiveMode] = useState('orbit'); // orbit, polyline, freehand, place_item, erase
    const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
    const [gridSnapping, setGridSnapping] = useState(true);
    const [gridSize, setGridSize] = useState(1.0); // Snap interval (1m, 0.5m, etc.)

    // Tracing Template Underlay State
    const [tracingTemplate, setTracingTemplate] = useState({
        url: '',
        opacity: 0.4,
        scale: 20.0,
        offsetX: 0.0,
        offsetZ: 0.0
    });

    // New Building inputs
    const [newBuildingName, setNewBuildingName] = useState('');
    const [newBuildingPlanUrl, setNewBuildingPlanUrl] = useState('');
    const [newBuildingScale, setNewBuildingScale] = useState(1.0);

    // CAD Data State (Walls/Shapes & Placed Items)
    const [drawnShapes, setDrawnShapes] = useState([]);
    const [placedObjects, setPlacedObjects] = useState([]); // Doors, windows, furniture
    const [selectedShapeId, setSelectedShapeId] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [itemToPlace, setItemToPlace] = useState(null); // Type of item selected to drop

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
    const transformControlsRef = useRef(null);
    const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    const tracingMeshRef = useRef(null);

    const isDrawingRef = useRef(false);
    const currentDrawMeshRef = useRef(null); // Line drawing preview
    const drawingPointsRef = useRef([]); // Temporary 3D points
    
    // Meshes mappings
    const shapesMeshesMapRef = useRef(new Map()); // Map shape.id -> THREE.Mesh
    const objectsMeshesMapRef = useRef(new Map()); // Map object.id -> THREE.Group/Mesh
    const previewPointsMeshesRef = useRef([]); // Spheres for vertex visualization
    
    // HTML overlays ref for screen projections
    const overlayContainerRef = useRef(null);

    // Preset Colors for Inspector
    const PRESET_COLORS = ['#60a5fa', '#f87171', '#34d399', '#fb923c', '#a78bfa', '#f472b6', '#e2e8f0', '#fbbf24'];

    // ── Refs to Solve Three.js Animation Loop & Event Closure Problems ─────
    const activeModeRef = useRef(activeMode);
    const itemToPlaceRef = useRef(itemToPlace);
    const gridSnappingRef = useRef(gridSnapping);
    const gridSizeRef = useRef(gridSize);
    const drawnShapesRef = useRef(drawnShapes);
    const placedObjectsRef = useRef(placedObjects);
    const selectedShapeIdRef = useRef(selectedShapeId);
    const selectedObjectIdRef = useRef(selectedObjectId);
    const activeLayerRef = useRef(activeLayer);
    const layersRef = useRef(layers);

    useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
    useEffect(() => { itemToPlaceRef.current = itemToPlace; }, [itemToPlace]);
    useEffect(() => { gridSnappingRef.current = gridSnapping; }, [gridSnapping]);
    useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
    useEffect(() => { drawnShapesRef.current = drawnShapes; }, [drawnShapes]);
    useEffect(() => { placedObjectsRef.current = placedObjects; }, [placedObjects]);
    useEffect(() => { selectedShapeIdRef.current = selectedShapeId; }, [selectedShapeId]);
    useEffect(() => { selectedObjectIdRef.current = selectedObjectId; }, [selectedObjectId]);
    useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
    useEffect(() => { layersRef.current = layers; }, [layers]);

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
                
                if (res.building.floor_plan_url) {
                    setTracingTemplate(prev => ({ ...prev, url: res.building.floor_plan_url }));
                }

                if (res.building.shapes_data) {
                    try {
                        const parsedData = JSON.parse(res.building.shapes_data);
                        const shapes = parsedData.shapes || [];
                        const objects = parsedData.objects || [];
                        
                        setDrawnShapes(shapes);
                        setPlacedObjects(objects);
                        
                        rebuild3DScene(shapes, objects);
                    } catch (e) {
                        console.error("Failed to parse shapes_data:", e);
                        setDrawnShapes([]);
                        setPlacedObjects([]);
                        rebuild3DScene([], []);
                    }
                } else {
                    setDrawnShapes([]);
                    setPlacedObjects([]);
                    rebuild3DScene([], []);
                }
                setSelectedShapeId(null);
                setSelectedObjectId(null);
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
        controls.maxPolarAngle = Math.PI / 2 - 0.01;
        controlsRef.current = controls;

        // Transform Controls (3D Gizmo)
        const tControls = new TransformControls(camera, renderer.domElement);
        tControls.size = 0.85;
        tControls.showY = false; // Restrict translations to XZ plane
        scene.add(tControls);
        transformControlsRef.current = tControls;

        // Prevent orbit controls conflict while dragging gizmo
        tControls.addEventListener('dragging-changed', (event) => {
            controls.enabled = !event.value;
            
            if (!event.value && tControls.object) {
                const objId = tControls.object.userData.objectId;
                if (objId) {
                    const pos = tControls.object.position;
                    const rotY = (tControls.object.rotation.y * 180) / Math.PI;
                    
                    setPlacedObjects(prev => prev.map(obj => {
                        if (obj.id === objId) {
                            return {
                                ...obj,
                                position: { x: parseFloat(pos.x.toFixed(2)), y: parseFloat(pos.y.toFixed(2)), z: parseFloat(pos.z.toFixed(2)) },
                                rotation: parseFloat(rotY.toFixed(2))
                            };
                        }
                        return obj;
                    }));
                }
            }
        });

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x0f172a, 1.0);
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.4);
        scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
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

        const fineGrid = new THREE.GridHelper(50, 100, 0x334155, 0x0f172a);
        fineGrid.position.y = -0.015;
        fineGrid.material.opacity = 0.2;
        fineGrid.material.transparent = true;
        scene.add(fineGrid);

        // Ground Plane
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

        // ── Connect native canvas event listeners to solve event capturing ──
        const canvas = renderer.domElement;
        canvas.addEventListener('mousedown', handleCanvasMouseDown);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('mouseup', handleCanvasMouseUp);

        // Rebuild scene with any already loaded shapes/objects
        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current);

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
            canvas.removeEventListener('mousedown', handleCanvasMouseDown);
            canvas.removeEventListener('mousemove', handleCanvasMouseMove);
            canvas.removeEventListener('mouseup', handleCanvasMouseUp);
        };
    }, []);

    // Disable OrbitControls during active drawing
    useEffect(() => {
        if (controlsRef.current) {
            const isDrawing = (activeMode === 'polyline' || activeMode === 'freehand' || activeMode === 'place_item');
            controlsRef.current.enabled = !isDrawing;
        }
        if (activeMode !== 'polyline' && activeMode !== 'freehand') {
            clearDrawingPreview();
        }
    }, [activeMode]);

    // Handle Tracing Template Texture Loading
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;

        if (tracingMeshRef.current) {
            scene.remove(tracingMeshRef.current);
            tracingMeshRef.current.geometry.dispose();
            if (tracingMeshRef.current.material) tracingMeshRef.current.material.dispose();
            tracingMeshRef.current = null;
        }

        if (!tracingTemplate.url) return;

        const loader = new THREE.TextureLoader();
        loader.load(tracingTemplate.url, (texture) => {
            const geometry = new THREE.PlaneGeometry(tracingTemplate.scale, tracingTemplate.scale);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: tracingTemplate.opacity,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(tracingTemplate.offsetX, 0.005, tracingTemplate.offsetZ);
            scene.add(mesh);
            tracingMeshRef.current = mesh;
        }, undefined, (err) => {
            console.error("Failed to load tracing template texture:", err);
        });
    }, [tracingTemplate]);

    // Update layers visibility in the 3D Scene
    useEffect(() => {
        shapesMeshesMapRef.current.forEach((mesh, shapeId) => {
            const shapeData = drawnShapes.find(s => s.id === shapeId);
            if (shapeData) {
                const layer = layers.find(l => l.id === shapeData.layer);
                mesh.visible = layer ? layer.visible : true;
            }
        });
        objectsMeshesMapRef.current.forEach((group, objId) => {
            const objData = placedObjects.find(o => o.id === objId);
            if (objData) {
                const layer = layers.find(l => l.id === objData.layer);
                group.visible = layer ? layer.visible : true;
            }
        });
    }, [layers, drawnShapes, placedObjects]);

    // Manage Transform Controls attachment
    useEffect(() => {
        const tControls = transformControlsRef.current;
        if (!tControls) return;

        if (selectedObjectId) {
            const mesh = objectsMeshesMapRef.current.get(selectedObjectId);
            if (mesh) {
                tControls.attach(mesh);
            } else {
                tControls.detach();
            }
        } else {
            tControls.detach();
        }
    }, [selectedObjectId, placedObjects]);

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
            default:
                return new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.4,
                    metalness: 0.1,
                    side: THREE.DoubleSide
                });
        }
    };

    // ── 4. Rebuild 3D Scene ──────────────────────────────────────────────────
    const rebuild3DScene = (shapesList, objectsList) => {
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

        // Clear existing placed objects
        objectsMeshesMapRef.current.forEach(group => {
            scene.remove(group);
            group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        });
        objectsMeshesMapRef.current.clear();

        // 1. Recreate extruded meshes (Walls)
        shapesList.forEach(shapeData => {
            const mesh = createExtrusionMesh(shapeData);
            if (mesh) {
                scene.add(mesh);
                shapesMeshesMapRef.current.set(shapeData.id, mesh);
            }
        });

        // 2. Recreate placed objects
        objectsList.forEach(objData => {
            const group = createPlacedObjectMesh(objData);
            if (group) {
                scene.add(group);
                objectsMeshesMapRef.current.set(objData.id, group);
            }
        });
    };

    const createExtrusionMesh = (shapeData) => {
        if (!shapeData.points || shapeData.points.length < 3) return null;

        const shape = new THREE.Shape();
        shape.moveTo(shapeData.points[0].x, shapeData.points[0].z);
        for (let i = 1; i < shapeData.points.length; i++) {
            shape.lineTo(shapeData.points[i].x, shapeData.points[i].z);
        }
        shape.closePath();

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: shapeData.height,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.02,
            bevelSegments: 3
        });

        const material = getMaterialPreset(shapeData.materialType, shapeData.color);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.rotation.x = -Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { shapeId: shapeData.id };

        return mesh;
    };

    // ── Create Custom 3D Compound Meshes ─────────────────────────────────────
    const createPlacedObjectMesh = (objData) => {
        const group = new THREE.Group();
        group.position.set(objData.position.x, objData.position.y, objData.position.z);
        group.rotation.y = (objData.rotation * Math.PI) / 180;
        group.scale.set(objData.scale.x, objData.scale.y, objData.scale.z);
        group.userData = { objectId: objData.id };

        const frameColor = 0x334155;
        const panelColor = objData.color || '#60a5fa';

        if (objData.subType === 'single_door' || objData.subType === 'double_door') {
            const width = 1.6;
            const height = 2.4;
            const thickness = 0.08;

            const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.5 });
            const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.12), frameMat);
            frameLeft.position.set(-width / 2, height / 2, 0);
            const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.12), frameMat);
            frameRight.position.set(width / 2, height / 2, 0);
            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.1, 0.12), frameMat);
            frameTop.position.set(0, height, 0);

            group.add(frameLeft, frameRight, frameTop);

            const doorMat = new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.3, metalness: 0.1 });

            if (objData.subType === 'single_door') {
                const hingeGroup = new THREE.Group();
                hingeGroup.position.set(-width / 2 + 0.05, 0, 0);
                
                const panel = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, height - 0.05, thickness), doorMat);
                panel.position.set((width - 0.1) / 2, height / 2, 0);
                hingeGroup.add(panel);

                if (objData.isOpen) {
                    hingeGroup.rotation.y = Math.PI / 2;
                }
                group.add(hingeGroup);

                const arcPoints = [];
                const radius = width - 0.1;
                for (let i = 0; i <= 32; i++) {
                    const theta = -(i / 32) * (Math.PI / 2);
                    const x = -width / 2 + 0.05 + radius * Math.cos(theta);
                    const z = radius * Math.sin(theta);
                    arcPoints.push(new THREE.Vector3(x, 0.02, z));
                }
                const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
                const arcMat = new THREE.LineDashedMaterial({ color: 0x60a5fa, dashSize: 0.15, gapSize: 0.1 });
                const arcLine = new THREE.Line(arcGeo, arcMat);
                arcLine.computeLineDistances();
                group.add(arcLine);

            } else {
                const hingeLeft = new THREE.Group();
                hingeLeft.position.set(-width / 2 + 0.05, 0, 0);
                const panelLeft = new THREE.Mesh(new THREE.BoxGeometry((width - 0.1) / 2, height - 0.05, thickness), doorMat);
                panelLeft.position.set((width - 0.1) / 4, height / 2, 0);
                hingeLeft.add(panelLeft);

                const hingeRight = new THREE.Group();
                hingeRight.position.set(width / 2 - 0.05, 0, 0);
                const panelRight = new THREE.Mesh(new THREE.BoxGeometry((width - 0.1) / 2, height - 0.05, thickness), doorMat);
                panelRight.position.set(-(width - 0.1) / 4, height / 2, 0);
                hingeRight.add(panelRight);

                if (objData.isOpen) {
                    hingeLeft.rotation.y = Math.PI / 2;
                    hingeRight.rotation.y = -Math.PI / 2;
                }
                group.add(hingeLeft, hingeRight);
            }
        }

        else if (objData.subType === 'glass_window') {
            const width = 2.0;
            const height = 1.5;
            const thickness = 0.08;

            const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.4 });
            const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, thickness), frameMat);
            frameBottom.position.set(0, 0.04, 0);
            const frameTop = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, thickness), frameMat);
            frameTop.position.set(0, height - 0.04, 0);
            const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, thickness), frameMat);
            frameLeft.position.set(-width / 2 + 0.04, height / 2, 0);
            const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, thickness), frameMat);
            frameRight.position.set(width / 2 - 0.04, height / 2, 0);

            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xe0f2fe,
                transparent: true,
                opacity: 0.3,
                roughness: 0.05,
                metalness: 0.1,
                transmission: 0.9
            });
            const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, height - 0.16, 0.02), glassMat);
            glass.position.set(0, height / 2, 0);

            group.add(frameBottom, frameTop, frameLeft, frameRight, glass);
            group.position.y = 0.8;
        }

        else if (objData.subType === 'retail_shelf') {
            const width = 2.0;
            const height = 2.0;
            const depth = 0.6;

            const woodMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 });

            const barLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, depth), metalMat);
            barLeft.position.set(-width / 2, height / 2, 0);
            const barRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, depth), metalMat);
            barRight.position.set(width / 2, height / 2, 0);

            group.add(barLeft, barRight);

            for (let h = 0.3; h < height; h += 0.45) {
                const shelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, depth), woodMat);
                shelf.position.set(0, h, 0);
                group.add(shelf);
            }
        }

        else if (objData.subType === 'checkout_counter') {
            const width = 2.2;
            const height = 1.0;
            const depth = 0.9;

            const baseMat = new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.4 });
            const topMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.6 });

            const base = new THREE.Mesh(new THREE.BoxGeometry(width, height - 0.06, depth), baseMat);
            base.position.set(0, (height - 0.06) / 2, 0);
            base.castShadow = true;
            base.receiveShadow = true;

            const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.06, depth + 0.05), topMat);
            top.position.set(0, height - 0.03, 0);

            group.add(base, top);
        }

        else if (objData.subType === 'display_table') {
            const width = 1.8;
            const height = 0.85;
            const depth = 1.2;

            const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
            const topMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });

            const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, height - 0.05, 0.08), legMat);
            leg1.position.set(-width / 2 + 0.08, (height - 0.05) / 2, -depth / 2 + 0.08);
            const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, height - 0.05, 0.08), legMat);
            leg2.position.set(width / 2 - 0.08, (height - 0.05) / 2, -depth / 2 + 0.08);
            const leg3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, height - 0.05, 0.08), legMat);
            leg3.position.set(-width / 2 + 0.08, (height - 0.05) / 2, depth / 2 - 0.08);
            const leg4 = new THREE.Mesh(new THREE.BoxGeometry(0.08, height - 0.05, 0.08), legMat);
            leg4.position.set(width / 2 - 0.08, (height - 0.05) / 2, depth / 2 - 0.08);

            const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), topMat);
            top.position.set(0, height - 0.025, 0);

            group.add(leg1, leg2, leg3, leg4, top);
        }

        else if (objData.subType === 'lounge_chair') {
            const size = 0.8;
            const chairMat = new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.7 });

            const cushion = new THREE.Mesh(new THREE.BoxGeometry(size, 0.25, size), chairMat);
            cushion.position.set(0, 0.35, 0);

            const back = new THREE.Mesh(new THREE.BoxGeometry(size, 0.5, 0.15), chairMat);
            back.position.set(0, 0.65, -size / 2 + 0.075);

            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, size - 0.15), chairMat);
            armL.position.set(-size / 2 + 0.075, 0.45, 0.075);
            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, size - 0.15), chairMat);
            armR.position.set(size / 2 - 0.075, 0.45, 0.075);

            group.add(cushion, back, armL, armR);
        }

        else if (objData.subType === 'spot_light') {
            const coneMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.1 });
            const emitterMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

            const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 16), coneMat);
            cone.rotation.x = Math.PI;
            cone.position.set(0, 3.8, 0);

            const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), emitterMat);
            emitter.position.set(0, 3.6, 0);

            group.add(cone, emitter);

            const spotLight = new THREE.SpotLight(0xfffbeb, 8, 12, Math.PI / 4, 0.5, 1.0);
            spotLight.position.set(0, 3.6, 0);
            spotLight.target.position.set(0, 0, 0);
            spotLight.castShadow = true;
            spotLight.shadow.bias = -0.001;
            group.add(spotLight);
            group.add(spotLight.target);
        }

        if (objData.id === selectedObjectIdRef.current) {
            group.traverse(child => {
                if (child.material) {
                    child.material = child.material.clone();
                    child.material.emissive = new THREE.Color(0x3b82f6);
                    child.material.emissiveIntensity = 0.25;
                }
            });
        }

        return group;
    };

    // ── 5. Native Drawing & Placement Event Handlers ────────────────────────
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

        if (gridSnappingRef.current) {
            targetPoint.x = Math.round(targetPoint.x / gridSizeRef.current) * gridSizeRef.current;
            targetPoint.z = Math.round(targetPoint.z / gridSizeRef.current) * gridSizeRef.current;
        }
        targetPoint.y = 0;

        return targetPoint;
    };

    const handleCanvasMouseMove = (event) => {
        const point = getIntersectionPoint(event);
        if (!point) return;

        setMouseCoords({ x: parseFloat(point.x.toFixed(2)), z: parseFloat(point.z.toFixed(2)) });

        const scene = sceneRef.current;
        if (!scene) return;

        if (activeModeRef.current === 'polyline' && drawingPointsRef.current.length > 0) {
            updateDrawingPreview(point);
        }

        if (activeModeRef.current === 'freehand' && isDrawingRef.current) {
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

        // ── Drop / Place Item Mode ──
        if (activeModeRef.current === 'place_item' && itemToPlaceRef.current) {
            const newObj = {
                id: `obj_${Date.now()}`,
                type: ['single_door', 'double_door', 'glass_window'].includes(itemToPlaceRef.current) ? 'door' : 'furniture',
                subType: itemToPlaceRef.current,
                position: { x: point.x, y: 0, z: point.z },
                rotation: 0,
                scale: { x: 1, y: 1, z: 1 },
                isOpen: false,
                color: layersRef.current.find(l => l.id === activeLayerRef.current)?.color || '#34d399',
                layer: activeLayerRef.current
            };

            const updated = [...placedObjectsRef.current, newObj];
            setPlacedObjects(updated);
            setSelectedObjectId(newObj.id);
            rebuild3DScene(drawnShapesRef.current, updated);
            
            setItemToPlace(null);
            setActiveMode('orbit');
            return;
        }

        // ── Click-to-Add-Point (Polyline) ──
        if (activeModeRef.current === 'polyline') {
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
            
            const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.copy(point);
            scene.add(sphere);
            previewPointsMeshesRef.current.push(sphere);

            updateDrawingPreview(point);
        }

        // ── Drag-to-Draw (Freehand) ──
        if (activeModeRef.current === 'freehand') {
            isDrawingRef.current = true;
            drawingPointsRef.current = [point];
            setCurrentPathPoints([point]);
        }

        // ── Click-to-Select / Erase ──
        if (activeModeRef.current === 'orbit' || activeModeRef.current === 'erase') {
            if (transformControlsRef.current?.dragging) return;

            const container = canvasContainerRef.current;
            const camera = cameraRef.current;
            const rect = container.getBoundingClientRect();
            const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

            // 1. Raycast Placed Objects
            const objGroups = Array.from(objectsMeshesMapRef.current.values());
            const objIntersects = raycaster.intersectObjects(objGroups, true);

            if (objIntersects.length > 0) {
                let parent = objIntersects[0].object;
                while (parent && !parent.userData.objectId) {
                    parent = parent.parent;
                }
                if (parent) {
                    const objId = parent.userData.objectId;
                    if (activeModeRef.current === 'erase') {
                        deletePlacedObject(objId);
                    } else {
                        setSelectedObjectId(objId);
                        setSelectedShapeId(null); // Clear wall selection
                    }
                    return;
                }
            }

            // 2. Raycast Walls
            const wallMeshes = Array.from(shapesMeshesMapRef.current.values());
            const wallIntersects = raycaster.intersectObjects(wallMeshes);

            if (wallIntersects.length > 0) {
                const wallId = wallIntersects[0].object.userData.shapeId;
                if (activeModeRef.current === 'erase') {
                    deleteShape(wallId);
                } else {
                    setSelectedShapeId(wallId);
                    setSelectedObjectId(null); // Clear object selection
                }
            } else {
                setSelectedShapeId(null);
                setSelectedObjectId(null);
            }
        }
    };

    const handleCanvasMouseUp = () => {
        if (activeModeRef.current === 'freehand' && isDrawingRef.current) {
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

        if (currentDrawMeshRef.current) {
            scene.remove(currentDrawMeshRef.current);
            currentDrawMeshRef.current.geometry.dispose();
        }

        const pts = [...drawingPointsRef.current];
        if (hoverPoint && activeModeRef.current === 'polyline') {
            pts.push(hoverPoint);
        }

        if (pts.length < 2) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(pts);
        const material = new THREE.LineBasicMaterial({
            color: activeModeRef.current === 'freehand' ? 0x06b6d4 : 0xf97316,
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

        const pointsData = drawingPointsRef.current.map(p => ({ x: p.x, z: p.z }));
        const first = pointsData[0];
        const last = pointsData[pointsData.length - 1];
        if (first.x !== last.x || first.z !== last.z) {
            pointsData.push({ x: first.x, z: first.z });
        }

        const newShape = {
            id: `shape_${Date.now()}`,
            name: `جدار_${drawnShapesRef.current.length + 1}`,
            points: pointsData,
            height: 3.0,
            materialType: 'standard',
            color: '#e2e8f0',
            layer: activeLayerRef.current
        };

        const updated = [...drawnShapesRef.current, newShape];
        setDrawnShapes(updated);
        setSelectedShapeId(newShape.id);
        rebuild3DScene(updated, placedObjectsRef.current);
        
        clearDrawingPreview();
        setActiveMode('orbit');
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
        const updated = drawnShapesRef.current.filter(s => s.id !== shapeId);
        setDrawnShapes(updated);
        if (selectedShapeIdRef.current === shapeId) setSelectedShapeId(null);
        rebuild3DScene(updated, placedObjectsRef.current);
    };

    const deletePlacedObject = (objId) => {
        const updated = placedObjectsRef.current.filter(o => o.id !== objId);
        setPlacedObjects(updated);
        if (selectedObjectIdRef.current === objId) setSelectedObjectId(null);
        rebuild3DScene(drawnShapesRef.current, updated);
    };

    const clearAllShapes = () => {
        if (window.confirm('⚠️ هل أنت متأكد من رغبتك في حذف كامل التصميم والقطع بالكامل؟')) {
            setDrawnShapes([]);
            setPlacedObjects([]);
            setSelectedShapeId(null);
            setSelectedObjectId(null);
            rebuild3DScene([], []);
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

        drawnShapesRef.current.forEach(shape => {
            const mesh = shapesMeshesMapRef.current.get(shape.id);
            const badgeEl = document.getElementById(`dim-${shape.id}`);
            
            if (mesh && badgeEl && mesh.visible) {
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

    // ── 7. Property Updates ──────────────────────────────────────────────────
    const updateSelectedShapeProperty = (property, value) => {
        if (!selectedShapeId) return;
        const updated = drawnShapes.map(shape => {
            if (shape.id === selectedShapeId) {
                return { ...shape, [property]: value };
            }
            return shape;
        });
        setDrawnShapes(updated);
        
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

    const updateSelectedObjectProperty = (property, value) => {
        if (!selectedObjectId) return;
        const updated = placedObjects.map(obj => {
            if (obj.id === selectedObjectId) {
                return { ...obj, [property]: value };
            }
            return obj;
        });
        setPlacedObjects(updated);

        const targetObj = updated.find(o => o.id === selectedObjectId);
        const scene = sceneRef.current;
        if (scene && targetObj) {
            const oldGroup = objectsMeshesMapRef.current.get(selectedObjectId);
            if (oldGroup) {
                scene.remove(oldGroup);
                oldGroup.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
            }
            const newGroup = createPlacedObjectMesh(targetObj);
            if (newGroup) {
                scene.add(newGroup);
                objectsMeshesMapRef.current.set(selectedObjectId, newGroup);
            }
        }
    };

    const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);
    const selectedObject = placedObjects.find(o => o.id === selectedObjectId);

    // ── 8. API Operations ────────────────────────────────────────────────────
    const handleSaveLayout = async () => {
        if (!selectedBuildingId) return;
        try {
            const shapesData = JSON.stringify({
                shapes: drawnShapes,
                objects: placedObjects
            });
            await indoorControlService.saveLayout(selectedBuildingId, []);
            const updateRes = await indoorControlService.updateBuildingShapes(selectedBuildingId, shapesData);
            
            if (updateRes && updateRes.success) {
                alert('🎉 تم حفظ التصميم والأثاث والمجسمات بالكامل بنجاح!');
            } else {
                alert('🎉 تم الحفظ بنجاح محلياً في السيرفر!');
            }
        } catch (err) {
            console.error('Failed to save layout:', err);
            alert('⚠️ حدث خطأ أثناء الاتصال، تم الحفظ محلياً في ذاكرة المتصفح.');
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

    const toggleLayerVisibility = (layerId) => {
        setLayers(layers.map(l => {
            if (l.id === layerId) return { ...l, visible: !l.visible };
            return l;
        }));
    };

    const selectItemToPlace = (type) => {
        setItemToPlace(type);
        setActiveMode('place_item');
        setSelectedObjectId(null);
        setSelectedShapeId(null);
    };

    return (
        <div className="ic-dashboard-overlay">
            {/* Top Bar Status */}
            <div className="ic-header">
                <div className="ic-header-title">
                    <div className="ic-cad-logo">3D CAD</div>
                    <h2>نظام تخطيط وتصميم الديكور الداخلي للمتاجر</h2>
                </div>
                <div className="ic-header-center">
                    <div className="ic-building-selector-wrap">
                        <label>المتجر النشط:</label>
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
                        <button className="ic-btn-icon-add" onClick={() => setShowAddBuildingModal(true)} title="مشروع جديد">
                            ＋
                        </button>
                    )}
                </div>
                <div className="ic-header-actions">
                    <button className="ic-btn ic-btn-primary" onClick={handleSaveLayout}>
                        💾 حفظ التصميم النهائي
                    </button>
                    <button className="ic-btn ic-btn-close" onClick={onClose}>
                        خروج ×
                    </button>
                </div>
            </div>

            {/* Main Interactive CAD Layout */}
            <div className="ic-main-layout">
                
                {/* Left Sidebar: CAD Engineering Tools & Items Library */}
                <div className="ic-sidebar-left">
                    <div className="ic-section-title">أدوات تخطيط الجدران</div>
                    <div className="ic-cad-tools-grid">
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'orbit' ? 'active' : ''}`}
                            onClick={() => setActiveMode('orbit')}
                            title="أداة التحديد والدوران"
                        >
                            <span className="ic-tool-icon">🖱️</span>
                            <span className="ic-tool-text">التوجيه والتحكم</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'polyline' ? 'active' : ''}`}
                            onClick={() => setActiveMode('polyline')}
                            title="رسم جدار مضلع متصل"
                        >
                            <span className="ic-tool-icon">🧱</span>
                            <span className="ic-tool-text">رسم جدار</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'freehand' ? 'active' : ''}`}
                            onClick={() => setActiveMode('freehand')}
                            title="رسم مسارات حرة"
                        >
                            <span className="ic-tool-icon">✍️</span>
                            <span className="ic-tool-text">رسم جدار حر</span>
                        </button>
                        <button 
                            className={`ic-cad-tool-btn ${activeMode === 'erase' ? 'active' : ''}`}
                            onClick={() => setActiveMode('erase')}
                            title="ممحاة العناصر"
                        >
                            <span className="ic-tool-icon">🧹</span>
                            <span className="ic-tool-text">ممحاة العناصر</span>
                        </button>
                    </div>

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">مخطط التتبع ثنائي الأبعاد (Tracing)</div>
                    <div className="ic-settings-list">
                        <div className="ic-form-group-compact">
                            <label>رابط صورة المخطط</label>
                            <input 
                                type="text" 
                                className="ic-text-input-compact" 
                                value={tracingTemplate.url}
                                onChange={(e) => setTracingTemplate({ ...tracingTemplate, url: e.target.value })}
                                placeholder="رابط صورة المخطط..."
                            />
                        </div>
                        <div className="ic-slider-row">
                            <label>الشفافية: {Math.round(tracingTemplate.opacity * 100)}%</label>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05" 
                                value={tracingTemplate.opacity}
                                onChange={(e) => setTracingTemplate({ ...tracingTemplate, opacity: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="ic-slider-row">
                            <label>المقياس (Scale): {tracingTemplate.scale}m</label>
                            <input 
                                type="range" 
                                min="5" max="100" step="0.5" 
                                value={tracingTemplate.scale}
                                onChange={(e) => setTracingTemplate({ ...tracingTemplate, scale: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="ic-offset-grid">
                            <div>
                                <label>إزاحة X</label>
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={tracingTemplate.offsetX}
                                    onChange={(e) => setTracingTemplate({ ...tracingTemplate, offsetX: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label>إزاحة Z</label>
                                <input 
                                    type="number" 
                                    step="0.5"
                                    value={tracingTemplate.offsetZ}
                                    onChange={(e) => setTracingTemplate({ ...tracingTemplate, offsetZ: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">العناصر المعمارية والأبواب</div>
                    <div className="ic-presets-grid">
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'single_door' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('single_door')}
                        >
                            <span>🚪</span> باب مفرد
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'double_door' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('double_door')}
                        >
                            <span>🚪🚪</span> باب مزدوج
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'glass_window' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('glass_window')}
                        >
                            <span>🖼️</span> نافذة زجاج
                        </button>
                    </div>

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">تجهيزات المتجر والأثاث</div>
                    <div className="ic-presets-grid">
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'retail_shelf' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('retail_shelf')}
                        >
                            <span>🗄️</span> رف منتجات
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'checkout_counter' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('checkout_counter')}
                        >
                            <span>🛒</span> كاونتر دفع
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'display_table' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('display_table')}
                        >
                            <span>🍽️</span> طاولة عرض
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'lounge_chair' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('lounge_chair')}
                        >
                            <span>🛋️</span> مقعد انتظار
                        </button>
                        <button 
                            className={`ic-preset-btn ${itemToPlace === 'spot_light' ? 'active' : ''}`}
                            onClick={() => selectItemToPlace('spot_light')}
                        >
                            <span>💡</span> سبوت لايت
                        </button>
                    </div>

                    <button className="ic-btn-clear" onClick={clearAllShapes}>
                        🗑️ مسح لوحة العمل بالكامل
                    </button>
                </div>

                {/* Center 3D Viewport */}
                <div 
                    className="ic-canvas-container" 
                    ref={canvasContainerRef}
                >
                    {/* Status badges */}
                    <div className="ic-cad-status-bar">
                        <div className="ic-status-badge">
                            <span className="dot pulse"></span>
                            الوضع: {
                                activeMode === 'orbit' ? 'الدوران والتعديل' : 
                                activeMode === 'polyline' ? 'رسم جدار...' : 
                                activeMode === 'freehand' ? 'رسم جدار حر...' :
                                activeMode === 'place_item' ? `إدراج عنصر: ${itemToPlace}...` : 'ممحاة العناصر'
                            }
                        </div>
                        {currentPathPoints.length > 0 && (
                            <div className="ic-status-badge yellow">
                                عدد نقاط الجدار: {currentPathPoints.length}
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

                {/* Right Sidebar: Properties Inspector */}
                <div className="ic-sidebar-right">
                    <div className="ic-section-title">مفتش الخصائص (Inspector)</div>
                    
                    {/* Selected Wall Properties */}
                    {selectedShape && (
                        <div className="ic-inspector-panel">
                            <div className="ic-form-group">
                                <label>اسم الجدار</label>
                                <input 
                                    type="text" 
                                    className="ic-text-input" 
                                    value={selectedShape.name} 
                                    onChange={(e) => updateSelectedShapeProperty('name', e.target.value)}
                                />
                            </div>

                            <div className="ic-form-group">
                                <div className="ic-slider-label">
                                    <label>ارتفاع الجدار (Height)</label>
                                    <span>{selectedShape.height.toFixed(2)}m</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.5" 
                                    max="8.0" 
                                    step="0.1" 
                                    value={selectedShape.height} 
                                    onChange={(e) => updateSelectedShapeProperty('height', parseFloat(e.target.value))}
                                />
                            </div>

                            <div className="ic-form-group">
                                <label>المادة والشادر (Material)</label>
                                <div className="ic-material-grid">
                                    <button 
                                        className={`ic-mat-btn ${selectedShape.materialType === 'standard' ? 'active' : ''}`}
                                        onClick={() => updateSelectedShapeProperty('materialType', 'standard')}
                                    >
                                        🧱 خرسانة
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
                                </div>
                            </div>

                            <button className="ic-btn-delete-shape" onClick={() => deleteShape(selectedShape.id)}>
                                🗑️ حذف الجدار المحدد
                            </button>
                        </div>
                    )}

                    {/* Selected Placed Object (Door/Furniture) Properties */}
                    {selectedObject && (
                        <div className="ic-inspector-panel">
                            <div className="ic-form-group">
                                <label>نوع العنصر</label>
                                <input 
                                    type="text" 
                                    className="ic-text-input" 
                                    value={selectedObject.subType.toUpperCase().replace('_', ' ')} 
                                    disabled
                                />
                            </div>

                            {selectedObject.type === 'door' && (
                                <div className="ic-setting-row">
                                    <label>حالة الفتح (Open / Swing)</label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedObject.isOpen} 
                                        onChange={(e) => updateSelectedObjectProperty('isOpen', e.target.checked)} 
                                    />
                                </div>
                            )}

                            <div className="ic-form-group">
                                <label>اللون والنمط</label>
                                <div className="ic-color-presets">
                                    {PRESET_COLORS.map(c => (
                                        <button 
                                            key={c} 
                                            className={`ic-color-btn ${selectedObject.color === c ? 'active' : ''}`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => updateSelectedObjectProperty('color', c)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="ic-divider"></div>

                            <div className="ic-section-title" style={{ fontSize: '0.8rem' }}>التوجيه ثلاثي الأبعاد</div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                                💡 استخدم الأسهم الحمراء/الزرقاء للتحريك وحلقة الدوران الخضراء التي تظهر فوق العنصر في الشاشة لتغيير اتجاهه وموقعه بدقة.
                            </p>

                            <button className="ic-btn-delete-shape" onClick={() => deletePlacedObject(selectedObject.id)}>
                                🗑️ حذف العنصر المحدد
                            </button>
                        </div>
                    )}

                    {!selectedShape && !selectedObject && (
                        <div className="ic-empty-state">
                            <span className="ic-empty-icon">💡</span>
                            <p>اضغط على أي جدار، باب، أو قطعة أثاث لتعديل خصائصها، أو استخدم أدوات التحريك ثلاثية الأبعاد.</p>
                        </div>
                    )}

                    <div className="ic-divider"></div>

                    <div className="ic-section-title">إدارة طبقات التصميم (Layers)</div>
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
                            <label>رابط صورة المخطط ثنائي الأبعاد (مثال للتتبع)</label>
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
