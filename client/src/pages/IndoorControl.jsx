import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { indoorControlService } from '../services/api';
import './IndoorControl.css';

export default function IndoorControl({ user, onClose }) {
    // UI & App Modes
    const [buildings, setBuildings] = useState([]);
    const [selectedBuildingId, setSelectedBuildingId] = useState(null);
    const [buildingInfo, setBuildingInfo] = useState(null);
    const [activeMode, setActiveMode] = useState('orbit'); // orbit, polyline, freehand, place_item, draw_zone, path_node, path_edge, erase
    const [visitorMode, setVisitorMode] = useState(false); // Dual-mode Toggle
    const [currentFloor, setCurrentFloor] = useState('floor_1'); // floor_1, floor_2, floor_3
    const [showAddBuildingModal, setShowAddBuildingModal] = useState(false);
    const [gridSnapping, setGridSnapping] = useState(true);
    const [gridSize, setGridSize] = useState(1.0);

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
    const [newBuildingLat, setNewBuildingLat] = useState('');
    const [newBuildingLng, setNewBuildingLng] = useState('');

    const [buildingLat, setBuildingLat] = useState('');
    const [buildingLng, setBuildingLng] = useState('');

    const floorMeshRef = useRef(null);
    const selectedBuilding = useMemo(() => buildings.find(b => b.id === Number(selectedBuildingId)), [buildings, selectedBuildingId]);

    // CAD Data States (Partitioned by floor in rendering)
    const [drawnShapes, setDrawnShapes] = useState([]);
    const [placedObjects, setPlacedObjects] = useState([]); 
    const [zones, setZones] = useState([]); // Stores POIs / Shop Zones
    const [wayfindingNodes, setWayfindingNodes] = useState([]); // Nodes for navigation network
    const [wayfindingEdges, setWayfindingEdges] = useState([]); // Edges connecting nodes

    // Selection States
    const [selectedShapeId, setSelectedShapeId] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [selectedZoneId, setSelectedZoneId] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [itemToPlace, setItemToPlace] = useState(null); 
    const [connectingStartNodeId, setConnectingStartNodeId] = useState(null); // For path_edge creation
    const [gizmoMode, setGizmoMode] = useState('translate'); // translate, rotate, scale

    // Modal/Prompt state for new Zone
    const [showZoneModal, setShowZoneModal] = useState(false);
    const [tempZonePoints, setTempZonePoints] = useState(null);
    const [newZoneName, setNewZoneName] = useState('');
    const [newZoneCategory, setNewZoneCategory] = useState('shopping'); // shopping, food, services, amenity
    const [newZoneColor, setNewZoneColor] = useState('#fb923c');

    // Visitor Navigation States
    const [navStartZoneId, setNavStartZoneId] = useState('');
    const [navEndZoneId, setNavEndZoneId] = useState('');
    const [navigationRoute, setNavigationRoute] = useState(null); // Calculated path nodes
    const [stepDirections, setStepDirections] = useState([]);

    const [layers, setLayers] = useState([
        { id: 'structure', name: 'الهيكل الرئيسي (Structure)', visible: true, color: '#60a5fa' },
        { id: 'walls', name: 'الجدران الداخلية (Walls)', visible: true, color: '#fb923c' },
        { id: 'furniture', name: 'الأثاث والتجهيزات (Furniture)', visible: true, color: '#34d399' },
        { id: 'lighting', name: 'أنظمة الإضاءة (Lighting)', visible: true, color: '#a78bfa' },
        { id: 'zones', name: 'مناطق المحلات (Store Zones)', visible: true, color: '#f43f5e' },
        { id: 'paths', name: 'مسارات الحركة (Wayfinding)', visible: true, color: '#14b8a6' }
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
    const navPathLineRef = useRef(null); // 3D Neon Route line

    const isDrawingRef = useRef(false);
    const currentDrawMeshRef = useRef(null); 
    const drawingPointsRef = useRef([]); 
    
    // Meshes mappings
    const shapesMeshesMapRef = useRef(new Map()); 
    const objectsMeshesMapRef = useRef(new Map()); 
    const zonesMeshesMapRef = useRef(new Map()); // Map zone.id -> THREE.Mesh
    const nodesMeshesMapRef = useRef(new Map()); // Map node.id -> THREE.Mesh
    const edgesMeshesMapRef = useRef(new Map()); // Map edge.id -> THREE.Line
    const previewPointsMeshesRef = useRef([]); 
    
    // HTML overlays ref for screen projections
    const overlayContainerRef = useRef(null);

    // Preset Colors for Inspector
    const PRESET_COLORS = ['#60a5fa', '#f87171', '#34d399', '#fb923c', '#a78bfa', '#f472b6', '#e2e8f0', '#fbbf24', '#f43f5e', '#14b8a6'];

    // ── Refs to Solve Three.js Animation Loop & Event Closure Problems ─────
    const activeModeRef = useRef(activeMode);
    const itemToPlaceRef = useRef(itemToPlace);
    const gridSnappingRef = useRef(gridSnapping);
    const gridSizeRef = useRef(gridSize);
    const currentFloorRef = useRef(currentFloor);
    const drawnShapesRef = useRef(drawnShapes);
    const placedObjectsRef = useRef(placedObjects);
    const zonesRef = useRef(zones);
    const wayfindingNodesRef = useRef(wayfindingNodes);
    const wayfindingEdgesRef = useRef(wayfindingEdges);
    const selectedShapeIdRef = useRef(selectedShapeId);
    const selectedObjectIdRef = useRef(selectedObjectId);
    const selectedZoneIdRef = useRef(selectedZoneId);
    const selectedNodeIdRef = useRef(selectedNodeId);
    const activeLayerRef = useRef(activeLayer);
    const layersRef = useRef(layers);
    const connectingStartNodeIdRef = useRef(connectingStartNodeId);
    const gizmoModeRef = useRef(gizmoMode);

    useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
    useEffect(() => { itemToPlaceRef.current = itemToPlace; }, [itemToPlace]);
    useEffect(() => { gridSnappingRef.current = gridSnapping; }, [gridSnapping]);
    useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);
    useEffect(() => { currentFloorRef.current = currentFloor; }, [currentFloor]);
    useEffect(() => { drawnShapesRef.current = drawnShapes; }, [drawnShapes]);
    useEffect(() => { placedObjectsRef.current = placedObjects; }, [placedObjects]);
    useEffect(() => { zonesRef.current = zones; }, [zones]);
    useEffect(() => { wayfindingNodesRef.current = wayfindingNodes; }, [wayfindingNodes]);
    useEffect(() => { wayfindingEdgesRef.current = wayfindingEdges; }, [wayfindingEdges]);
    useEffect(() => { selectedShapeIdRef.current = selectedShapeId; }, [selectedShapeId]);
    useEffect(() => { selectedObjectIdRef.current = selectedObjectId; }, [selectedObjectId]);
    useEffect(() => { selectedZoneIdRef.current = selectedZoneId; }, [selectedZoneId]);
    useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
    useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
    useEffect(() => { layersRef.current = layers; }, [layers]);
    useEffect(() => { connectingStartNodeIdRef.current = connectingStartNodeId; }, [connectingStartNodeId]);
    useEffect(() => { gizmoModeRef.current = gizmoMode; }, [gizmoMode]);

    // Snapping logic for doors & windows to walls
    const snapToNearestWall = (point) => {
        let nearestPoint = null;
        let nearestRotation = 0;
        let minDistance = Infinity;

        const fId = currentFloorRef.current;
        const walls = drawnShapesRef.current.filter(s => !s.floor || s.floor === fId);

        walls.forEach(wall => {
            for (let i = 0; i < wall.points.length - 1; i++) {
                const pA = wall.points[i];
                const pB = wall.points[i+1];

                const abX = pB.x - pA.x;
                const abZ = pB.z - pA.z;
                const abLenSq = abX*abX + abZ*abZ;
                if (abLenSq === 0) continue;

                let t = ((point.x - pA.x) * abX + (point.z - pA.z) * abZ) / abLenSq;
                t = Math.max(0, Math.min(1, t));

                const projX = pA.x + t * abX;
                const projZ = pA.z + t * abZ;

                const dist = Math.sqrt((point.x - projX)**2 + (point.z - projZ)**2);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestPoint = new THREE.Vector3(projX, 0, projZ);
                    nearestRotation = -Math.atan2(abZ, abX) * 180 / Math.PI;
                }
            }
        });

        // Snap threshold: 1.5 meters
        if (minDistance < 1.5) {
            return { position: nearestPoint, rotation: nearestRotation };
        }
        return null;
    };

    const changeGizmoMode = (mode) => {
        setGizmoMode(mode);
        const tControls = transformControlsRef.current;
        if (tControls) {
            tControls.setMode(mode);
            if (mode === 'translate') {
                tControls.showX = true;
                tControls.showY = false;
                tControls.showZ = true;
            } else if (mode === 'rotate') {
                tControls.showX = false;
                tControls.showY = true;
                tControls.showZ = false;
            } else if (mode === 'scale') {
                tControls.showX = true;
                tControls.showY = true;
                tControls.showZ = true;
            }
        }
    };

    // Rebuild 3D Scene when floor changes
    useEffect(() => {
        rebuild3DScene(drawnShapes, placedObjects, zones, wayfindingNodes, wayfindingEdges);
        // Clear active selections
        setSelectedShapeId(null);
        setSelectedObjectId(null);
        setSelectedZoneId(null);
        setSelectedNodeId(null);
        setConnectingStartNodeId(null);
        clearNavigationRoute();
    }, [currentFloor]);

    // Automatically attach TransformControls to selected object or node
    useEffect(() => {
        const tControls = transformControlsRef.current;
        if (!tControls) return;

        tControls.detach();

        if (selectedObjectId) {
            const mesh = objectsMeshesMapRef.current.get(selectedObjectId);
            if (mesh) {
                tControls.setMode(gizmoMode);
                if (gizmoMode === 'translate') {
                    tControls.showX = true;
                    tControls.showY = false;
                    tControls.showZ = true;
                } else if (gizmoMode === 'rotate') {
                    tControls.showX = false;
                    tControls.showY = true;
                    tControls.showZ = false;
                } else if (gizmoMode === 'scale') {
                    tControls.showX = true;
                    tControls.showY = true;
                    tControls.showZ = true;
                }
                tControls.attach(mesh);
            }
        } else if (selectedNodeId) {
            const mesh = nodesMeshesMapRef.current.get(selectedNodeId);
            if (mesh) {
                tControls.setMode('translate');
                tControls.showX = true;
                tControls.showY = false;
                tControls.showZ = true;
                tControls.attach(mesh);
            }
        }
    }, [selectedObjectId, selectedNodeId, gizmoMode]);

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
                        const loadedZones = parsedData.zones || [];
                        const loadedNodes = parsedData.wayfindingNodes || [];
                        const loadedEdges = parsedData.wayfindingEdges || [];
                        
                        setDrawnShapes(shapes);
                        setPlacedObjects(objects);
                        setZones(loadedZones);
                        setWayfindingNodes(loadedNodes);
                        setWayfindingEdges(loadedEdges);
                        
                        rebuild3DScene(shapes, objects, loadedZones, loadedNodes, loadedEdges);
                    } catch (e) {
                        console.error("Failed to parse shapes_data:", e);
                        resetAllStates();
                    }
                } else {
                    resetAllStates();
                }
                setSelectedShapeId(null);
                setSelectedObjectId(null);
                setSelectedZoneId(null);
                setSelectedNodeId(null);
            }
        } catch (err) {
            console.error('Failed to load layout:', err);
        }
    };

    const resetAllStates = () => {
        setDrawnShapes([]);
        setPlacedObjects([]);
        setZones([]);
        setWayfindingNodes([]);
        setWayfindingEdges([]);
        rebuild3DScene([], [], [], [], []);
    };

    // ── 2. Setup Three.js Canvas and Animation Loop ──────────────────────────
    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);
        scene.fog = new THREE.FogExp2(0xf1f5f9, 0.015);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 15, 20);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        rendererRef.current = renderer;

        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.01;
        controlsRef.current = controls;

        const tControls = new TransformControls(camera, renderer.domElement);
        tControls.size = 0.85;
        tControls.showY = false; 
        scene.add(tControls);
        transformControlsRef.current = tControls;

        // Snapping during drag
        tControls.addEventListener('change', () => {
            if (tControls.object && tControls.dragging) {
                const objId = tControls.object.userData.objectId;
                if (objId) {
                    const objData = placedObjectsRef.current.find(o => o.id === objId);
                    if (objData && ['single_door', 'double_door', 'glass_window'].includes(objData.subType)) {
                        const snapped = snapToNearestWall(tControls.object.position);
                        if (snapped) {
                            tControls.object.position.copy(snapped.position);
                            tControls.object.rotation.y = (snapped.rotation * Math.PI) / 180;
                        }
                    }
                }
            }
        });

        tControls.addEventListener('dragging-changed', (event) => {
            controls.enabled = !event.value;
            
            if (!event.value && tControls.object) {
                const objId = tControls.object.userData.objectId;
                const zoneId = tControls.object.userData.zoneId;
                const nodeId = tControls.object.userData.nodeId;

                const pos = tControls.object.position;

                if (objId) {
                    const rotY = (tControls.object.rotation.y * 180) / Math.PI;
                    const sc = tControls.object.scale;
                    setPlacedObjects(prev => prev.map(obj => {
                        if (obj.id === objId) {
                            return {
                                ...obj,
                                position: { x: parseFloat(pos.x.toFixed(2)), y: parseFloat(pos.y.toFixed(2)), z: parseFloat(pos.z.toFixed(2)) },
                                rotation: parseFloat(rotY.toFixed(2)),
                                scale: { x: parseFloat(sc.x.toFixed(2)), y: parseFloat(sc.y.toFixed(2)), z: parseFloat(sc.z.toFixed(2)) }
                            };
                        }
                        return obj;
                    }));
                } else if (nodeId) {
                    setWayfindingNodes(prev => prev.map(node => {
                        if (node.id === nodeId) {
                            return { ...node, x: parseFloat(pos.x.toFixed(2)), z: parseFloat(pos.z.toFixed(2)) };
                        }
                        return node;
                    }));
                    // Need to rebuild edges since node position moved
                    setTimeout(() => {
                        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, wayfindingNodesRef.current, wayfindingEdgesRef.current);
                    }, 50);
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

        // Grid & Floor
        const gridHelper = new THREE.GridHelper(50, 50, 0x94a3b8, 0xe2e8f0);
        gridHelper.position.y = -0.01;
        scene.add(gridHelper);

        const fineGrid = new THREE.GridHelper(50, 100, 0xcbd5e1, 0xf1f5f9);
        fineGrid.position.y = -0.015;
        fineGrid.material.opacity = 0.35;
        fineGrid.material.transparent = true;
        scene.add(fineGrid);

        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            metalness: 0.0
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        floorMeshRef.current = floor;

        // Native canvas event listeners
        const canvas = renderer.domElement;
        canvas.addEventListener('mousedown', handleCanvasMouseDown);
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('mouseup', handleCanvasMouseUp);

        // Rebuild scene
        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, wayfindingNodesRef.current, wayfindingEdgesRef.current);

        // Animation loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
            
            // Animate Neon Path (glowing dashed line)
            if (navPathLineRef.current) {
                navPathLineRef.current.material.dashOffset -= 0.08;
            }

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

    // Dynamically update TransformControls snapping
    useEffect(() => {
        const tControls = transformControlsRef.current;
        if (tControls) {
            if (gridSnapping) {
                tControls.setTranslationSnap(gridSize);
                tControls.setRotationSnap(THREE.MathUtils.degToRad(15)); // 15 degrees snap
            } else {
                tControls.setTranslationSnap(null);
                tControls.setRotationSnap(null);
            }
        }
    }, [gridSnapping, gridSize]);

    // Load Mapbox satellite map texture when selectedBuilding changes
    useEffect(() => {
        const floor = floorMeshRef.current;
        if (!floor) return;

        const lat = selectedBuilding?.latitude;
        const lng = selectedBuilding?.longitude;

        if (lat && lng) {
            console.log('🗺️ Loading Mapbox Satellite texture for coordinates:', lat, lng);
            const textureLoader = new THREE.TextureLoader();
            const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
            const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},18.5,0/1024x1024?access_token=${mapboxToken}`;
            
            textureLoader.load(mapUrl, (texture) => {
                floor.material.map = texture;
                floor.material.color.setHex(0xffffff); // Reset color to white so texture renders properly
                floor.material.needsUpdate = true;
            }, undefined, (err) => {
                console.error('Failed to load map texture:', err);
            });
        } else {
            // Revert to plain white floor if no coordinates
            floor.material.map = null;
            floor.material.color.setHex(0xffffff);
            floor.material.needsUpdate = true;
        }
    }, [selectedBuilding]);

    // Populate coordinates editing fields when selectedBuilding changes
    useEffect(() => {
        if (selectedBuilding) {
            setBuildingLat(selectedBuilding.latitude || '');
            setBuildingLng(selectedBuilding.longitude || '');
        } else {
            setBuildingLat('');
            setBuildingLng('');
        }
    }, [selectedBuilding]);

    // Save updated geographical coordinates for current building
    const handleUpdateBuildingLocation = async () => {
        if (!selectedBuildingId || !selectedBuilding) return;
        try {
            const res = await indoorControlService.updateBuilding(selectedBuildingId, {
                name: selectedBuilding.name,
                floor_plan_url: selectedBuilding.floor_plan_url,
                scale_ratio: parseFloat(selectedBuilding.scale_ratio),
                latitude: buildingLat ? parseFloat(buildingLat) : null,
                longitude: buildingLng ? parseFloat(buildingLng) : null
            });
            if (res && res.success) {
                alert('🗺️ تم تحديث الموقع الجغرافي للمبنى بنجاح!');
                // Reload buildings to update coordinates in React state
                const bList = await indoorControlService.getBuildings();
                if (bList && bList.buildings) {
                    setBuildings(bList.buildings);
                }
            }
        } catch (err) {
            console.error('Failed to update building location:', err);
            alert('❌ فشل في تحديث الموقع الجغرافي');
        }
    };

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
    const rebuild3DScene = (shapesList, objectsList, zonesList, nodesList, edgesList) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const fId = currentFloorRef.current;

        // Clear existing extruded meshes (Walls)
        shapesMeshesMapRef.current.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        shapesMeshesMapRef.current.clear();

        // Clear placed objects
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

        // Clear Zones
        zonesMeshesMapRef.current.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        zonesMeshesMapRef.current.clear();

        // Clear Nodes
        nodesMeshesMapRef.current.forEach(mesh => {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        nodesMeshesMapRef.current.clear();

        // Clear Edges
        edgesMeshesMapRef.current.forEach(line => {
            scene.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        });
        edgesMeshesMapRef.current.clear();

        // 1. Recreate Walls (filtered by floor)
        shapesList.filter(s => !s.floor || s.floor === fId).forEach(shapeData => {
            const mesh = createExtrusionMesh(shapeData);
            if (mesh) {
                scene.add(mesh);
                shapesMeshesMapRef.current.set(shapeData.id, mesh);
            }
        });

        // 2. Recreate placed objects
        objectsList.filter(o => !o.floor || o.floor === fId).forEach(objData => {
            const group = createPlacedObjectMesh(objData);
            if (group) {
                scene.add(group);
                objectsMeshesMapRef.current.set(objData.id, group);
            }
        });

        // 3. Recreate Shop Zones (polygons on floor)
        zonesList.filter(z => z.floor === fId).forEach(zoneData => {
            const mesh = createZoneFloorMesh(zoneData);
            if (mesh) {
                scene.add(mesh);
                zonesMeshesMapRef.current.set(zoneData.id, mesh);
            }
        });

        // 4. Recreate Wayfinding Nodes (only in Editor Mode)
        if (!visitorMode) {
            nodesList.filter(n => n.floor === fId).forEach(nodeData => {
                const mesh = createWayfindingNodeMesh(nodeData);
                if (mesh) {
                    scene.add(mesh);
                    nodesMeshesMapRef.current.set(nodeData.id, mesh);
                }
            });

            // 5. Recreate Wayfinding Edges (only in Editor Mode)
            edgesList.filter(e => e.floor === fId).forEach(edgeData => {
                const line = createWayfindingEdgeLine(edgeData, nodesList);
                if (line) {
                    scene.add(line);
                    edgesMeshesMapRef.current.set(edgeData.id, line);
                }
            });
        }
    };

    const createZoneFloorMesh = (zoneData) => {
        if (!zoneData.points || zoneData.points.length < 3) return null;

        // Draw flat 2D shape on floor
        const shape = new THREE.Shape();
        shape.moveTo(zoneData.points[0].x, zoneData.points[0].z);
        for (let i = 1; i < zoneData.points.length; i++) {
            shape.lineTo(zoneData.points[i].x, zoneData.points[i].z);
        }
        shape.closePath();

        const geometry = new THREE.ShapeGeometry(shape);
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(zoneData.color || '#fb923c'),
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.015; // Placed slightly above floor plan
        mesh.userData = { zoneId: zoneData.id };

        // Emissive border line
        const borderGeo = new THREE.BufferGeometry().setFromPoints(
            zoneData.points.map(p => new THREE.Vector3(p.x, 0.02, p.z))
        );
        const borderMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(zoneData.color || '#fb923c'),
            linewidth: 2
        });
        const border = new THREE.Line(borderGeo, borderMat);
        mesh.add(border);

        return mesh;
    };

    const createWayfindingNodeMesh = (nodeData) => {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: nodeData.id === selectedNodeIdRef.current ? 0xf43f5e : 0x14b8a6,
            depthTest: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(nodeData.x, 0.1, nodeData.z);
        mesh.userData = { nodeId: nodeData.id };
        mesh.renderOrder = 2;
        return mesh;
    };

    const createWayfindingEdgeLine = (edgeData, nodesList) => {
        const nodeA = nodesList.find(n => n.id === edgeData.nodeA);
        const nodeB = nodesList.find(n => n.id === edgeData.nodeB);
        if (!nodeA || !nodeB) return null;

        const points = [
            new THREE.Vector3(nodeA.x, 0.1, nodeA.z),
            new THREE.Vector3(nodeB.x, 0.1, nodeB.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x0d9488,
            linewidth: 2,
            depthTest: false
        });
        const line = new THREE.Line(geometry, material);
        line.renderOrder = 2;
        return line;
    };

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

        if ((activeModeRef.current === 'polyline' || activeModeRef.current === 'draw_zone') && drawingPointsRef.current.length > 0) {
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
            let pos = { x: point.x, y: itemToPlaceRef.current === 'glass_window' ? 0.8 : 0, z: point.z };
            let rot = 0;

            // Snap doors and windows to nearest wall
            if (['single_door', 'double_door', 'glass_window'].includes(itemToPlaceRef.current)) {
                const snapped = snapToNearestWall(point);
                if (snapped) {
                    pos = { x: snapped.position.x, y: itemToPlaceRef.current === 'glass_window' ? 0.8 : 0, z: snapped.position.z };
                    rot = snapped.rotation;
                }
            }

            const newObj = {
                id: `obj_${Date.now()}`,
                type: ['single_door', 'double_door', 'glass_window'].includes(itemToPlaceRef.current) ? 'door' : 'furniture',
                subType: itemToPlaceRef.current,
                position: pos,
                rotation: rot,
                scale: { x: 1, y: 1, z: 1 },
                isOpen: false,
                color: '#60a5fa',
                layer: 'furniture',
                floor: currentFloorRef.current
            };

            const updated = [...placedObjectsRef.current, newObj];
            setPlacedObjects(updated);
            setSelectedObjectId(newObj.id);
            rebuild3DScene(drawnShapesRef.current, updated, zonesRef.current, wayfindingNodesRef.current, wayfindingEdgesRef.current);
            
            setItemToPlace(null);
            setActiveMode('orbit');
            return;
        }

        // ── Place Wayfinding Node Mode ──
        if (activeModeRef.current === 'path_node') {
            const newNode = {
                id: `node_${Date.now()}`,
                x: point.x,
                z: point.z,
                floor: currentFloorRef.current
            };
            const updated = [...wayfindingNodesRef.current, newNode];
            setWayfindingNodes(updated);
            rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, updated, wayfindingEdgesRef.current);
            return;
        }

        // ── Click-to-Add-Point (Polyline or Zone Drawing) ──
        if (activeModeRef.current === 'polyline' || activeModeRef.current === 'draw_zone') {
            if (drawingPointsRef.current.length >= 3) {
                const firstPoint = drawingPointsRef.current[0];
                const dist = point.distanceTo(firstPoint);
                if (dist < 0.6) {
                    if (activeModeRef.current === 'draw_zone') {
                        finishDrawingZone();
                    } else {
                        finishDrawingShape();
                    }
                    return;
                }
            }

            drawingPointsRef.current.push(point);
            setCurrentPathPoints([...drawingPointsRef.current]);
            
            const sphereGeo = new THREE.SphereGeometry(0.12, 16, 16);
            const sphereMat = new THREE.MeshBasicMaterial({ color: activeModeRef.current === 'draw_zone' ? 0xf43f5e : 0xf97316 });
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

        // ── Click-to-Select / Connect Nodes / Erase ──
        if (activeModeRef.current === 'orbit' || activeModeRef.current === 'path_edge' || activeModeRef.current === 'erase') {
            if (transformControlsRef.current?.dragging) return;

            const container = canvasContainerRef.current;
            const camera = cameraRef.current;
            const rect = container.getBoundingClientRect();
            const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

            // 1. Raycast Nodes (Wayfinding)
            const nodeMeshes = Array.from(nodesMeshesMapRef.current.values());
            const nodeIntersects = raycaster.intersectObjects(nodeMeshes);

            if (nodeIntersects.length > 0) {
                const nodeId = nodeIntersects[0].object.userData.nodeId;
                
                if (activeModeRef.current === 'path_edge') {
                    // Node Connection logic
                    if (!connectingStartNodeIdRef.current) {
                        setConnectingStartNodeId(nodeId);
                    } else {
                        if (connectingStartNodeIdRef.current !== nodeId) {
                            // Check if edge already exists
                            const edgeExists = wayfindingEdgesRef.current.some(
                                e => (e.nodeA === connectingStartNodeIdRef.current && e.nodeB === nodeId) ||
                                     (e.nodeA === nodeId && e.nodeB === connectingStartNodeIdRef.current)
                            );
                            if (!edgeExists) {
                                const newEdge = {
                                    id: `edge_${Date.now()}`,
                                    nodeA: connectingStartNodeIdRef.current,
                                    nodeB: nodeId,
                                    floor: currentFloorRef.current
                                };
                                const updated = [...wayfindingEdgesRef.current, newEdge];
                                setWayfindingEdges(updated);
                                rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, wayfindingNodesRef.current, updated);
                            }
                        }
                        setConnectingStartNodeId(null);
                    }
                } else if (activeModeRef.current === 'erase') {
                    deleteWayfindingNode(nodeId);
                } else {
                    setSelectedNodeId(nodeId);
                    // Attach gizmo to node for moving
                    const nodeMesh = nodesMeshesMapRef.current.get(nodeId);
                    if (nodeMesh) transformControlsRef.current.attach(nodeMesh);
                    
                    setSelectedShapeId(null);
                    setSelectedObjectId(null);
                    setSelectedZoneId(null);
                }
                return;
            }

            // 2. Raycast Placed Objects
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
                        setSelectedShapeId(null);
                        setSelectedZoneId(null);
                        setSelectedNodeId(null);
                    }
                    return;
                }
            }

            // 3. Raycast Shop Zones
            const zoneMeshes = Array.from(zonesMeshesMapRef.current.values());
            const zoneIntersects = raycaster.intersectObjects(zoneMeshes);

            if (zoneIntersects.length > 0) {
                const zoneId = zoneIntersects[0].object.userData.zoneId;
                if (activeModeRef.current === 'erase') {
                    deleteZone(zoneId);
                } else {
                    setSelectedZoneId(zoneId);
                    setSelectedShapeId(null);
                    setSelectedObjectId(null);
                    setSelectedNodeId(null);
                }
                return;
            }

            // 4. Raycast Walls (Recursive to support hollow wall box groups)
            const wallMeshes = Array.from(shapesMeshesMapRef.current.values());
            const wallIntersects = raycaster.intersectObjects(wallMeshes, true);

            if (wallIntersects.length > 0) {
                let parent = wallIntersects[0].object;
                while (parent && !parent.userData.shapeId) {
                    parent = parent.parent;
                }
                if (parent) {
                    const wallId = parent.userData.shapeId;
                    if (activeModeRef.current === 'erase') {
                        deleteShape(wallId);
                    } else {
                        setSelectedShapeId(wallId);
                        setSelectedObjectId(null);
                        setSelectedZoneId(null);
                        setSelectedNodeId(null);
                        
                        // Detach transform controls if selecting a wall
                        transformControlsRef.current?.detach();
                    }
                }
            } else {
                setSelectedShapeId(null);
                setSelectedObjectId(null);
                setSelectedZoneId(null);
                setSelectedNodeId(null);
                setConnectingStartNodeId(null);
                transformControlsRef.current.detach();
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
        if (hoverPoint && (activeModeRef.current === 'polyline' || activeModeRef.current === 'draw_zone')) {
            pts.push(hoverPoint);
        }

        if (pts.length < 2) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(pts);
        const material = new THREE.LineBasicMaterial({
            color: activeModeRef.current === 'freehand' ? 0x06b6d4 : activeModeRef.current === 'draw_zone' ? 0xf43f5e : 0xf97316,
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
            color: '#cbd5e1',
            layer: 'walls',
            floor: currentFloorRef.current
        };

        const updated = [...drawnShapesRef.current, newShape];
        setDrawnShapes(updated);
        setSelectedShapeId(newShape.id);
        rebuild3DScene(updated, placedObjectsRef.current, zonesRef.current, wayfindingNodesRef.current, wayfindingEdgesRef.current);
        
        clearDrawingPreview();
        setActiveMode('orbit');
    };

    const finishDrawingZone = () => {
        if (drawingPointsRef.current.length < 3) return;

        const pointsData = drawingPointsRef.current.map(p => ({ x: p.x, z: p.z }));
        const first = pointsData[0];
        const last = pointsData[pointsData.length - 1];
        if (first.x !== last.x || first.z !== last.z) {
            pointsData.push({ x: first.x, z: first.z });
        }

        // Open Zone Information prompt/modal
        setTempZonePoints(pointsData);
        setNewZoneName(`مساحة_${zonesRef.current.length + 1}`);
        setNewZoneCategory('shopping');
        setNewZoneColor('#fb923c');
        setShowZoneModal(true);
    };

    const saveCreatedZone = () => {
        if (!tempZonePoints) return;
        const newZone = {
            id: `zone_${Date.now()}`,
            name: newZoneName || 'مساحة محل',
            points: tempZonePoints,
            color: newZoneColor,
            category: newZoneCategory,
            floor: currentFloorRef.current
        };

        const updated = [...zonesRef.current, newZone];
        setZones(updated);
        setSelectedZoneId(newZone.id);
        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, updated, wayfindingNodesRef.current, wayfindingEdgesRef.current);

        setShowZoneModal(false);
        setTempZonePoints(null);
        clearDrawingPreview();
        setActiveMode('orbit');
    };

    const deleteWayfindingNode = (nodeId) => {
        // Delete node & any connected edges
        const updatedNodes = wayfindingNodesRef.current.filter(n => n.id !== nodeId);
        const updatedEdges = wayfindingEdgesRef.current.filter(e => e.nodeA !== nodeId && e.nodeB !== nodeId);
        
        setWayfindingNodes(updatedNodes);
        setWayfindingEdges(updatedEdges);
        if (selectedNodeIdRef.current === nodeId) setSelectedNodeId(null);
        
        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, updatedNodes, updatedEdges);
    };

    const deleteZone = (zoneId) => {
        const updated = zonesRef.current.filter(z => z.id !== zoneId);
        setZones(updated);
        if (selectedZoneIdRef.current === zoneId) setSelectedZoneId(null);
        rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, updated, wayfindingNodesRef.current, wayfindingEdgesRef.current);
    };

    // ── 6. HTML Dimension & Zone Label Overlay System ────────────────────────
    const updateDimensionOverlayPositions = () => {
        const container = canvasContainerRef.current;
        const camera = cameraRef.current;
        if (!container || !camera || !overlayContainerRef.current) return;

        const tempV = new THREE.Vector3();
        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;
        const fId = currentFloorRef.current;

        // Update Wall Dimension overlays
        drawnShapesRef.current.filter(s => !s.floor || s.floor === fId).forEach(shape => {
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

        // Update Zone Label overlays
        zonesRef.current.filter(z => z.floor === fId).forEach(zone => {
            const badgeEl = document.getElementById(`label-${zone.id}`);
            
            if (badgeEl) {
                let sumX = 0;
                let sumZ = 0;
                zone.points.forEach(p => {
                    sumX += p.x;
                    sumZ += p.z;
                });
                const avgX = sumX / zone.points.length;
                const avgZ = sumZ / zone.points.length;

                tempV.set(avgX, 0.2, avgZ);
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
            }
        });
    };

    // ── 7. A* / Dijkstra Wayfinding Pathfinding Engine ────────────────────────
    const findWayfindingRoute = () => {
        if (!navStartZoneId || !navEndZoneId) return;
        const startZone = zones.find(z => z.id === navStartZoneId);
        const endZone = zones.find(z => z.id === navEndZoneId);
        if (!startZone || !endZone) return;

        // Find center points of start and end zones
        const getZoneCenter = (zone) => {
            let sumX = 0, sumZ = 0;
            zone.points.forEach(p => { sumX += p.x; sumZ += p.z; });
            return { x: sumX / zone.points.length, z: sumZ / zone.points.length };
        };

        const startCenter = getZoneCenter(startZone);
        const endCenter = getZoneCenter(endZone);

        // Find closest wayfinding nodes on the current floor
        const floorNodes = wayfindingNodes.filter(n => n.floor === currentFloor);
        if (floorNodes.length < 2) {
            alert('⚠️ لم يتم رسم شبكة مسارات ملاحة كافية في هذا الطابق للربط بينهما.');
            return;
        }

        let startNode = null;
        let endNode = null;
        let minDistStart = Infinity;
        let minDistEnd = Infinity;

        floorNodes.forEach(node => {
            const distStart = Math.sqrt((node.x - startCenter.x)**2 + (node.z - startCenter.z)**2);
            const distEnd = Math.sqrt((node.x - endCenter.x)**2 + (node.z - endCenter.z)**2);
            
            if (distStart < minDistStart) {
                minDistStart = distStart;
                startNode = node;
            }
            if (distEnd < minDistEnd) {
                minDistEnd = distEnd;
                endNode = node;
            }
        });

        if (!startNode || !endNode || startNode.id === endNode.id) {
            setNavigationRoute([startCenter, endCenter]);
            draw3DNavigationPath([startCenter, endCenter]);
            setStepDirections([`اتجه مباشرة من ${startZone.name} إلى ${endZone.name}`]);
            return;
        }

        // Dijkstra algorithm
        const graph = {};
        floorNodes.forEach(n => { graph[n.id] = []; });
        wayfindingEdges.filter(e => e.floor === currentFloor).forEach(e => {
            const nA = floorNodes.find(n => n.id === e.nodeA);
            const nB = floorNodes.find(n => n.id === e.nodeB);
            if (nA && nB) {
                const dist = Math.sqrt((nA.x - nB.x)**2 + (nA.z - nB.z)**2);
                graph[e.nodeA].push({ id: e.nodeB, dist });
                graph[e.nodeB].push({ id: e.nodeA, dist });
            }
        });

        const distances = {};
        const previous = {};
        const queue = [];

        floorNodes.forEach(n => {
            distances[n.id] = Infinity;
            previous[n.id] = null;
            queue.push(n.id);
        });
        distances[startNode.id] = 0;

        while (queue.length > 0) {
            queue.sort((a, b) => distances[a] - distances[b]);
            const smallest = queue.shift();

            if (smallest === endNode.id) {
                const pathIds = [];
                let curr = smallest;
                while (curr) {
                    pathIds.push(curr);
                    curr = previous[curr];
                }
                pathIds.reverse();

                // Build path points including exact zone centers
                const pathPoints = [startCenter];
                pathIds.forEach(id => {
                    const node = floorNodes.find(n => n.id === id);
                    if (node) pathPoints.push({ x: node.x, z: node.z });
                });
                pathPoints.push(endCenter);

                setNavigationRoute(pathPoints);
                draw3DNavigationPath(pathPoints);
                generateStepDirections(pathPoints, startZone.name, endZone.name);
                return;
            }

            if (distances[smallest] === Infinity) break;

            const neighbors = graph[smallest] || [];
            neighbors.forEach(neighbor => {
                const alt = distances[smallest] + neighbor.dist;
                if (alt < distances[neighbor.id]) {
                    distances[neighbor.id] = alt;
                    previous[neighbor.id] = smallest;
                }
            });
        }

        // Fallback: Direct line
        setNavigationRoute([startCenter, endCenter]);
        draw3DNavigationPath([startCenter, endCenter]);
        setStepDirections([`تحرك بشكل مباشر من ${startZone.name} نحو ${endZone.name}`]);
    };

    const draw3DNavigationPath = (points) => {
        const scene = sceneRef.current;
        if (!scene) return;

        clearNavigationRoute();

        // Create a CatmullRomCurve3 or simple line
        const vectorPoints = points.map(p => new THREE.Vector3(p.x, 0.15, p.z));
        
        let geometry;
        if (vectorPoints.length > 2) {
            const curve = new THREE.CatmullRomCurve3(vectorPoints);
            // Get more points along the curve for smooth rendering
            const curvePoints = curve.getPoints(50);
            geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        } else {
            geometry = new THREE.BufferGeometry().setFromPoints(vectorPoints);
        }

        // Glowing Dashed Neon Route Material
        const material = new THREE.LineDashedMaterial({
            color: 0x06b6d4, // Bright cyan
            dashSize: 0.8,
            gapSize: 0.4,
            linewidth: 5,
            depthTest: false
        });

        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.renderOrder = 3;
        scene.add(line);
        navPathLineRef.current = line;
    };

    const clearNavigationRoute = () => {
        const scene = sceneRef.current;
        if (scene && navPathLineRef.current) {
            scene.remove(navPathLineRef.current);
            navPathLineRef.current.geometry.dispose();
            navPathLineRef.current.material.dispose();
            navPathLineRef.current = null;
        }
        setNavigationRoute(null);
        setStepDirections([]);
    };

    const generateStepDirections = (points, startName, endName) => {
        const steps = [];
        steps.push(`🚩 انطلق من ${startName}`);
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i-1];
            const curr = points[i];
            const next = points[i+1];

            const d1 = { x: curr.x - prev.x, z: curr.z - prev.z };
            const d2 = { x: next.x - curr.x, z: next.z - curr.z };

            // Calculate cross product to determine turn direction
            const cross = d1.x * d2.z - d1.z * d2.x;
            const dist = Math.sqrt(d1.x**2 + d1.z**2);

            if (dist > 2.0) {
                steps.push(`🚶 امشِ لمسافة ${Math.round(dist)} متر على طول الممر`);
            }

            if (Math.abs(cross) > 1.5) {
                if (cross > 0) {
                    steps.push(`↩️ انعطف يساراً عند التقاطع التالي`);
                } else {
                    steps.push(`↪️ انعطف يميناً عند التقاطع التالي`);
                }
            }
        }
        steps.push(`🎉 لقد وصلت إلى وجهتك: ${endName}`);
        setStepDirections(steps);
    };

    // ── 8. Property & Inspector Updates ──────────────────────────────────────
    const updateSelectedZoneProperty = (property, value) => {
        if (!selectedZoneId) return;
        const updated = zones.map(zone => {
            if (zone.id === selectedZoneId) {
                return { ...zone, [property]: value };
            }
            return zone;
        });
        setZones(updated);
        
        // Rebuild zone mesh
        const targetZone = updated.find(z => z.id === selectedZoneId);
        const scene = sceneRef.current;
        if (scene && targetZone) {
            const oldMesh = zonesMeshesMapRef.current.get(selectedZoneId);
            if (oldMesh) {
                scene.remove(oldMesh);
                oldMesh.geometry.dispose();
            }
            const newMesh = createZoneFloorMesh(targetZone);
            if (newMesh) {
                scene.add(newMesh);
                zonesMeshesMapRef.current.set(selectedZoneId, newMesh);
            }
        }
    };

    // Save/Update full layout data
    const handleSaveLayoutComplete = async () => {
        if (!selectedBuildingId) return;
        try {
            const shapesData = JSON.stringify({
                shapes: drawnShapes,
                objects: placedObjects,
                zones: zones,
                wayfindingNodes: wayfindingNodes,
                wayfindingEdges: wayfindingEdges
            });
            await indoorControlService.saveLayout(selectedBuildingId, []);
            const updateRes = await indoorControlService.updateBuildingShapes(selectedBuildingId, shapesData);
            
            if (updateRes && updateRes.success) {
                alert('🎉 تم حفظ وتحديث شبكة الملاحة والمسارات والمحلات بالكامل!');
            }
        } catch (err) {
            console.error(err);
        }
    };

    // --- Missing Helper Functions ---
    const selectItemToPlace = (itemType) => {
        setItemToPlace(itemType);
        setActiveMode('place_item');
        transformControlsRef.current?.detach();
    };

    const clearAllShapes = () => {
        if (window.confirm('هل أنت متأكد من رغبتك في مسح لوحة العمل بالكامل؟')) {
            setDrawnShapes([]);
            setPlacedObjects([]);
            setZones([]);
            setWayfindingNodes([]);
            setWayfindingEdges([]);
            setSelectedShapeId(null);
            setSelectedObjectId(null);
            setSelectedZoneId(null);
            setSelectedNodeId(null);
            clearNavigationRoute();
            rebuild3DScene([], [], [], [], []);
        }
    };

    const updateSelectedShapeProperty = (property, value) => {
        if (!selectedShapeId) return;
        const updated = drawnShapes.map(shape => {
            if (shape.id === selectedShapeId) {
                return { ...shape, [property]: value };
            }
            return shape;
        });
        setDrawnShapes(updated);
        rebuild3DScene(updated, placedObjects, zones, wayfindingNodes, wayfindingEdges);
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
        rebuild3DScene(drawnShapes, updated, zones, wayfindingNodes, wayfindingEdges);
    };

    const toggleLayerVisibility = (layerId) => {
        const updatedLayers = layers.map(l => {
            if (l.id === layerId) {
                return { ...l, visible: !l.visible };
            }
            return l;
        });
        setLayers(updatedLayers);
        
        const visible = updatedLayers.find(l => l.id === layerId).visible;
        
        if (layerId === 'walls') {
            shapesMeshesMapRef.current.forEach(mesh => { mesh.visible = visible; });
        } else if (layerId === 'furniture') {
            objectsMeshesMapRef.current.forEach(group => { group.visible = visible; });
        } else if (layerId === 'zones') {
            zonesMeshesMapRef.current.forEach(mesh => { mesh.visible = visible; });
        }
    };

    const handleCreateBuilding = async () => {
        if (!newBuildingName) return;
        try {
            const res = await indoorControlService.createBuilding({
                name: newBuildingName,
                floor_plan_url: newBuildingPlanUrl,
                scale_ratio: parseFloat(newBuildingScale),
                latitude: newBuildingLat ? parseFloat(newBuildingLat) : null,
                longitude: newBuildingLng ? parseFloat(newBuildingLng) : null
            });
            if (res && res.success) {
                alert('🎉 تم إنشاء المشروع بنجاح!');
                setShowAddBuildingModal(false);
                setNewBuildingName('');
                setNewBuildingPlanUrl('');
                setNewBuildingLat('');
                setNewBuildingLng('');
                loadBuildings();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteShape = (shapeId) => {
        const updated = drawnShapes.filter(s => s.id !== shapeId);
        setDrawnShapes(updated);
        if (selectedShapeId === shapeId) setSelectedShapeId(null);
        rebuild3DScene(updated, placedObjects, zones, wayfindingNodes, wayfindingEdges);
    };

    const deletePlacedObject = (objId) => {
        const updated = placedObjects.filter(o => o.id !== objId);
        setPlacedObjects(updated);
        if (selectedObjectId === objId) {
            setSelectedObjectId(null);
            transformControlsRef.current?.detach();
        }
        rebuild3DScene(drawnShapes, updated, zones, wayfindingNodes, wayfindingEdges);
    };

    const clearDrawingPreview = () => {
        const scene = sceneRef.current;
        if (scene && currentDrawMeshRef.current) {
            scene.remove(currentDrawMeshRef.current);
            currentDrawMeshRef.current.geometry.dispose();
            currentDrawMeshRef.current.material.dispose();
            currentDrawMeshRef.current = null;
        }
        previewPointsMeshesRef.current.forEach(sphere => {
            if (scene) scene.remove(sphere);
            sphere.geometry.dispose();
            sphere.material.dispose();
        });
        previewPointsMeshesRef.current = [];
        drawingPointsRef.current = [];
        setCurrentPathPoints([]);
    };

    const createExtrusionMesh = (shapeData) => {
        if (!shapeData.points || shapeData.points.length < 2) return null;

        const group = new THREE.Group();
        group.userData = { shapeId: shapeData.id };

        const thickness = 0.15; // 15cm wall thickness
        const height = shapeData.height || 3.0;
        const material = getMaterialPreset(shapeData.materialType || 'standard', shapeData.color || '#cbd5e1');

        for (let i = 0; i < shapeData.points.length - 1; i++) {
            const pA = shapeData.points[i];
            const pB = shapeData.points[i+1];

            const dx = pB.x - pA.x;
            const dz = pB.z - pA.z;
            const len = Math.sqrt(dx*dx + dz*dz);
            if (len === 0) continue;

            const wallGeo = new THREE.BoxGeometry(len, height, thickness);
            const wallMesh = new THREE.Mesh(wallGeo, material);

            // Position at midpoint of the segment
            const midX = (pA.x + pB.x) / 2;
            const midZ = (pA.z + pB.z) / 2;
            wallMesh.position.set(midX, height / 2, midZ);

            // Rotate Y to align with the segment
            const angle = -Math.atan2(dz, dx);
            wallMesh.rotation.y = angle;

            wallMesh.castShadow = true;
            wallMesh.receiveShadow = true;

            group.add(wallMesh);
        }

        return group;
    };

    const selectedShape = drawnShapes.find(s => s.id === selectedShapeId);
    const selectedObject = placedObjects.find(o => o.id === selectedObjectId);
    const selectedZone = zones.find(z => z.id === selectedZoneId);

    return (
        <div className="ic-dashboard-overlay">
            {/* Top Bar Status */}
            <div className="ic-header">
                <div className="ic-header-title">
                    <div className="ic-cad-logo">3D Editor</div>
                    <h2>تخطيط وملاحة المتجر والمساحات الداخلية (MappedIn)</h2>
                </div>
                <div className="ic-header-center">
                    {!visitorMode && (
                        <div className="ic-building-selector-wrap" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label>المتجر:</label>
                            <select 
                                className="ic-select-input" 
                                value={selectedBuildingId || ''} 
                                onChange={(e) => setSelectedBuildingId(Number(e.target.value))}
                                style={{ minWidth: '130px' }}
                            >
                                {buildings.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <button 
                                className="ic-btn ic-btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '16px', minWidth: 'auto', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setShowAddBuildingModal(true)}
                                title="إنشاء مبنى جديد"
                            >
                                +
                            </button>
                        </div>
                    )}
                    
                    {/* Floor Switcher (Pill style) */}
                    <div className="ic-floor-pills">
                        <button className={currentFloor === 'floor_1' ? 'active' : ''} onClick={() => setCurrentFloor('floor_1')}>أرضي</button>
                        <button className={currentFloor === 'floor_2' ? 'active' : ''} onClick={() => setCurrentFloor('floor_2')}>أول</button>
                        <button className={currentFloor === 'floor_3' ? 'active' : ''} onClick={() => setCurrentFloor('floor_3')}>ثاني</button>
                    </div>
                </div>
                <div className="ic-header-actions">
                    <button 
                        className={`ic-btn ${visitorMode ? 'ic-btn-primary' : 'ic-btn-secondary'}`}
                        onClick={() => {
                            setVisitorMode(!visitorMode);
                            setSelectedShapeId(null);
                            setSelectedObjectId(null);
                            setSelectedZoneId(null);
                            setSelectedNodeId(null);
                            clearNavigationRoute();
                            // Rebuild scene to hide/show nodes
                            setTimeout(() => {
                                rebuild3DScene(drawnShapesRef.current, placedObjectsRef.current, zonesRef.current, wayfindingNodesRef.current, wayfindingEdgesRef.current);
                            }, 50);
                        }}
                    >
                        {visitorMode ? '⚙️ وضع المصمم' : '👤 وضع الزائر والملاحة'}
                    </button>
                    {!visitorMode && (
                        <button className="ic-btn ic-btn-primary" onClick={handleSaveLayoutComplete}>
                            💾 حفظ التغييرات
                        </button>
                    )}
                    <button className="ic-btn ic-btn-close" onClick={onClose}>
                        إغلاق ×
                    </button>
                </div>
            </div>

            {/* Main Interactive CAD Layout */}
            <div className="ic-main-layout">
                
                {/* ── VISITOR SIDEBAR (Search Directory & Directions) ── */}
                {visitorMode && (
                    <div className="ic-sidebar-left glass visitor-sidebar">
                        <div className="ic-section-title">🔍 البحث والملاحة الداخلية</div>
                        
                        <div className="ic-form-group">
                            <label>موقعي الحالي (From)</label>
                            <select 
                                className="ic-select-input-styled"
                                value={navStartZoneId}
                                onChange={(e) => setNavStartZoneId(e.target.value)}
                            >
                                <option value="">اختر نقطة الانطلاق...</option>
                                {zones.filter(z => z.floor === currentFloor).map(z => (
                                    <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="ic-form-group">
                            <label>الوجهة (To)</label>
                            <select 
                                className="ic-select-input-styled"
                                value={navEndZoneId}
                                onChange={(e) => setNavEndZoneId(e.target.value)}
                            >
                                <option value="">اختر الوجهة...</option>
                                {zones.filter(z => z.floor === currentFloor).map(z => (
                                    <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                            </select>
                        </div>

                        <button className="ic-btn-navigate" onClick={findWayfindingRoute}>
                            🚀 ارسم لي مسار الملاحة
                        </button>

                        {stepDirections.length > 0 && (
                            <div className="ic-directions-panel">
                                <div className="ic-section-title" style={{ fontSize: '0.85rem' }}>📋 إرشادات التحرك خطوة بخطوة</div>
                                <div className="ic-steps-list">
                                    {stepDirections.map((step, idx) => (
                                        <div key={idx} className="ic-step-item">
                                            <span className="ic-step-num">{idx + 1}</span>
                                            <span className="ic-step-text">{step}</span>
                                        </div>
                                    ))}
                                </div>
                                <button className="ic-btn-clear-route" onClick={clearNavigationRoute}>
                                    ✕ مسح مسار الملاحة
                                </button>
                            </div>
                        )}

                        <div className="ic-divider" style={{ marginTop: '20px' }}></div>
                        <div className="ic-section-title" style={{ fontSize: '0.8rem' }}>🏬 دليل المحلات المتوفرة</div>
                        <div className="ic-store-directory-list">
                            {zones.filter(z => z.floor === currentFloor).map(z => (
                                <div key={z.id} className="ic-directory-item" onClick={() => setNavEndZoneId(z.id)}>
                                    <span className="ic-dir-emoji">🏪</span>
                                    <div>
                                        <span className="ic-dir-name">{z.name}</span>
                                        <span className="ic-dir-cat">{z.category.toUpperCase()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── EDITOR SIDEBAR LEFT: Tools & Libraries ── */}
                {!visitorMode && (
                    <div className="ic-sidebar-left">
                        <div className="ic-section-title">أدوات تخطيط الجدران</div>
                        <div className="ic-cad-tools-grid">
                            <button 
                                className={`ic-cad-tool-btn ${activeMode === 'orbit' ? 'active' : ''}`}
                                onClick={() => setActiveMode('orbit')}
                                title="أداة التحديد والدوران"
                            >
                                <span className="ic-tool-icon">🖱️</span>
                                <span className="ic-tool-text">التحديد والتوجيه</span>
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
                                className={`ic-cad-tool-btn ${activeMode === 'draw_zone' ? 'active' : ''}`}
                                onClick={() => setActiveMode('draw_zone')}
                                title="رسم مساحة محل/غرفة (Zone)"
                            >
                                <span className="ic-tool-icon">🏬</span>
                                <span className="ic-tool-text">رسم منطقة محل</span>
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

                        <div className="ic-section-title">رسم شبكة الملاحة والمسارات</div>
                        <div className="ic-cad-tools-grid">
                            <button 
                                className={`ic-cad-tool-btn ${activeMode === 'path_node' ? 'active' : ''}`}
                                onClick={() => setActiveMode('path_node')}
                                title="وضع نقطة ملاحة"
                            >
                                <span className="ic-tool-icon">📍</span>
                                <span className="ic-tool-text">وضع نقطة ملاحة</span>
                            </button>
                            <button 
                                className={`ic-cad-tool-btn ${activeMode === 'path_edge' ? 'active' : ''}`}
                                onClick={() => setActiveMode('path_edge')}
                                title="توصيل مسار الملاحة"
                            >
                                <span className="ic-tool-icon">🔗</span>
                                <span className="ic-tool-text">توصيل مسار</span>
                            </button>
                        </div>

                        <div className="ic-divider"></div>

                        <div className="ic-section-title">الموقع الجغرافي للمبنى (Map Location)</div>
                        <div className="ic-settings-list" style={{ marginBottom: '15px' }}>
                            <div className="ic-offset-grid" style={{ marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>خط العرض (Lat)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="ic-text-input-compact"
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        value={buildingLat}
                                        onChange={(e) => setBuildingLat(e.target.value)}
                                        placeholder="مثال: 32.2211"
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>خط الطول (Lng)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        className="ic-text-input-compact"
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        value={buildingLng}
                                        onChange={(e) => setBuildingLng(e.target.value)}
                                        placeholder="مثال: 35.2544"
                                    />
                                </div>
                            </div>
                            <button 
                                className="ic-btn ic-btn-secondary" 
                                style={{ width: '100%', padding: '6px', fontSize: '12px', height: '30px' }}
                                onClick={handleUpdateBuildingLocation}
                            >
                                حفظ الموقع الجغرافي 🗺️
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
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('single_door')}>
                                <span>🚪</span> باب مفرد
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('double_door')}>
                                <span>🚪🚪</span> باب مزدوج
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('glass_window')}>
                                <span>🖼️</span> نافذة زجاج
                            </button>
                        </div>

                        <div className="ic-divider"></div>

                        <div className="ic-section-title">الأثاث وتجهيزات المتجر</div>
                        <div className="ic-presets-grid">
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('retail_shelf')}>
                                <span>🗄️</span> رف منتجات
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('checkout_counter')}>
                                <span>🛒</span> كاونتر دفع
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('display_table')}>
                                <span>🍽️</span> طاولة عرض
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('lounge_chair')}>
                                <span>🛋️</span> مقعد انتظار
                            </button>
                            <button className="ic-preset-btn" onClick={() => selectItemToPlace('spot_light')}>
                                <span>💡</span> سبوت لايت
                            </button>
                        </div>

                        <button className="ic-btn-clear" onClick={clearAllShapes}>
                            🗑️ مسح لوحة العمل بالكامل
                        </button>
                    </div>
                )}

                {/* Center 3D Viewport with HTML Dimension & POI Labels Overlay */}
                <div 
                    className="ic-canvas-container" 
                    ref={canvasContainerRef}
                >
                    {/* Status badges */}
                    <div className="ic-cad-status-bar">
                        <div className="ic-status-badge">
                            <span className="dot pulse"></span>
                            الوضع: {
                                visitorMode ? 'المعاينة والملاحة' :
                                activeMode === 'orbit' ? 'الدوران والتعديل' : 
                                activeMode === 'polyline' ? 'رسم جدار...' : 
                                activeMode === 'draw_zone' ? 'رسم منطقة محل...' :
                                activeMode === 'place_item' ? `إدراج عنصر: ${itemToPlace}...` : 
                                activeMode === 'path_node' ? 'وضع نقاط ملاحة...' : 
                                activeMode === 'path_edge' ? (connectingStartNodeId ? 'اختر النقطة الثانية للتوصيل...' : 'اختر النقطة الأولى للتوصيل...') : 'ممحاة العناصر'
                            }
                        </div>
                        {currentPathPoints.length > 0 && (
                            <div className="ic-status-badge yellow">
                                عدد النقاط: {currentPathPoints.length}
                            </div>
                        )}
                    </div>

                    {/* Gizmo Mode Toolbar (Only in Editor Mode when an object is selected) */}
                    {!visitorMode && selectedObjectId && (
                        <div className="ic-gizmo-toolbar">
                            <button 
                                className={gizmoMode === 'translate' ? 'active' : ''} 
                                onClick={() => changeGizmoMode('translate')}
                                title="تحريك العنصر (Move)"
                            >
                                ➡️ تحريك
                            </button>
                            <button 
                                className={gizmoMode === 'rotate' ? 'active' : ''} 
                                onClick={() => changeGizmoMode('rotate')}
                                title="تدوير العنصر (Rotate)"
                            >
                                🔄 تدوير
                            </button>
                            <button 
                                className={gizmoMode === 'scale' ? 'active' : ''} 
                                onClick={() => changeGizmoMode('scale')}
                                title="تكبير/تصغير العنصر (Scale)"
                            >
                                📐 تكبير/تصغير
                            </button>
                        </div>
                    )}

                    {/* Coordinates overlay */}
                    <div className="ic-coordinates-info">
                        <span>X: {mouseCoords.x}m</span>
                        <span>Z: {mouseCoords.z}m</span>
                    </div>

                    {/* Dimension Overlays & POI Labels Container */}
                    <div className="ic-dimension-overlays-wrapper" ref={overlayContainerRef}>
                        {/* 1. Dimension Badges */}
                        {!visitorMode && drawnShapes.map(shape => (
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

                        {/* 2. POI Shop Labels (Always visible) */}
                        {zones.filter(z => z.floor === currentFloor).map(zone => (
                            <div 
                                key={zone.id} 
                                id={`label-${zone.id}`} 
                                className={`ic-poi-label-badge ${selectedZoneId === zone.id ? 'selected' : ''}`}
                                onClick={() => {
                                    if (!visitorMode) {
                                        setSelectedZoneId(zone.id);
                                        setSelectedShapeId(null);
                                        setSelectedObjectId(null);
                                        setSelectedNodeId(null);
                                    } else {
                                        setNavEndZoneId(zone.id);
                                    }
                                }}
                                style={{ '--theme-color': zone.color || '#fb923c' }}
                            >
                                <span className="ic-poi-icon">🏪</span>
                                <span className="ic-poi-text">{zone.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── EDITOR SIDEBAR RIGHT: Properties Inspector ── */}
                {!visitorMode && (
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
                                    💡 استخدم الأسهم ثلاثية الأبعاد التي تظهر فوق العنصر في الشاشة لتغيير اتجاهه وموقعه بدقة.
                                </p>

                                <button className="ic-btn-delete-shape" onClick={() => deletePlacedObject(selectedObject.id)}>
                                    🗑️ حذف العنصر المحدد
                                </button>
                            </div>
                        )}

                        {/* Selected Zone Properties */}
                        {selectedZone && (
                            <div className="ic-inspector-panel">
                                <div className="ic-form-group">
                                    <label>اسم المحل/المنطقة (POI Name)</label>
                                    <input 
                                        type="text" 
                                        className="ic-text-input" 
                                        value={selectedZone.name} 
                                        onChange={(e) => updateSelectedZoneProperty('name', e.target.value)}
                                    />
                                </div>

                                <div className="ic-form-group">
                                    <label>تصنيف المنطقة (Category)</label>
                                    <select 
                                        className="ic-select-input-styled"
                                        value={selectedZone.category}
                                        onChange={(e) => updateSelectedZoneProperty('category', e.target.value)}
                                    >
                                        <option value="shopping">تسوق (Shopping)</option>
                                        <option value="food">مطاعم ومقاهي (Food)</option>
                                        <option value="services">خدمات (Services)</option>
                                        <option value="amenity">مرافق (Amenity)</option>
                                    </select>
                                </div>

                                <div className="ic-form-group">
                                    <label>لون الهوية البصرية للمنطقة</label>
                                    <div className="ic-color-presets">
                                        {PRESET_COLORS.map(c => (
                                            <button 
                                                key={c} 
                                                className={`ic-color-btn ${selectedZone.color === c ? 'active' : ''}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => updateSelectedZoneProperty('color', c)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <button className="ic-btn-delete-shape" onClick={() => deleteZone(selectedZone.id)}>
                                    🗑️ حذف المنطقة المحددة
                                </button>
                            </div>
                        )}

                        {!selectedShape && !selectedObject && !selectedZone && (
                            <div className="ic-empty-state">
                                <span className="ic-empty-icon">💡</span>
                                <p>اضغط على أي جدار، منطقة محل، أو قطعة أثاث لتعديل خصائصها، أو استخدم أدوات تحريك المسارات.</p>
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
                )}
            </div>

            {/* Modal: Add New POI Zone */}
            {showZoneModal && (
                <div className="ic-modal-backdrop" onClick={() => setShowZoneModal(false)}>
                    <div className="ic-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ic-modal-header">إدخال بيانات منطقة المحل / الغرفة</div>
                        
                        <div className="ic-form-group">
                            <label>اسم المحل / الغرفة</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newZoneName} 
                                onChange={(e) => setNewZoneName(e.target.value)}
                                placeholder="مثال: Zara, Starbucks, دورات المياه..."
                            />
                        </div>

                        <div className="ic-form-group">
                            <label>التصنيف</label>
                            <select 
                                className="ic-select-input-styled"
                                value={newZoneCategory}
                                onChange={(e) => setNewZoneCategory(e.target.value)}
                            >
                                <option value="shopping">تسوق (Shopping)</option>
                                <option value="food">مطاعم ومقاهي (Food)</option>
                                <option value="services">خدمات (Services)</option>
                                <option value="amenity">مرافق (Amenity)</option>
                            </select>
                        </div>

                        <div className="ic-form-group">
                            <label>لون التمييز</label>
                            <div className="ic-color-presets">
                                {PRESET_COLORS.map(c => (
                                    <button 
                                        key={c} 
                                        className={`ic-color-btn ${newZoneColor === c ? 'active' : ''}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setNewZoneColor(c)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="ic-modal-footer">
                            <button className="ic-btn" onClick={() => { setShowZoneModal(false); setTempZonePoints(null); clearDrawingPreview(); setActiveMode('orbit'); }}>إلغاء</button>
                            <button className="ic-btn ic-btn-primary" onClick={saveCreatedZone}>حفظ وإنشاء المنطقة</button>
                        </div>
                    </div>
                </div>
            )}

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
                            <label>رابط صورة المخطط ثنائي الأبعاد</label>
                            <input 
                                type="text" 
                                className="ic-text-input" 
                                value={newBuildingPlanUrl} 
                                onChange={(e) => setNewBuildingPlanUrl(e.target.value)}
                                placeholder="https://example.com/blueprint.png"
                            />
                        </div>
                        <div className="ic-form-row" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div className="ic-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label>خط العرض (Latitude)</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    className="ic-text-input" 
                                    value={newBuildingLat} 
                                    onChange={(e) => setNewBuildingLat(e.target.value)}
                                    placeholder="مثال: 32.22111"
                                />
                            </div>
                            <div className="ic-form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label>خط الطول (Longitude)</label>
                                <input 
                                    type="number" 
                                    step="any"
                                    className="ic-text-input" 
                                    value={newBuildingLng} 
                                    onChange={(e) => setNewBuildingLng(e.target.value)}
                                    placeholder="مثال: 35.25444"
                                />
                            </div>
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
