import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useNavigate } from 'react-router-dom';
import './ARView.css';

// ═══════════════════════════════════════════════════════════════
// 📐  GEOSPATIAL ENGINE
// ═══════════════════════════════════════════════════════════════
const GEO = {
  /** Bearing (0-360) from A → B */
  bearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  },
  /** Haversine distance in metres */
  distance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  /** GPS → Three.js world offset (metres). East=+X, North=-Z */
  toWorld(uLat, uLng, tLat, tLng) {
    const R = 6371000;
    const avgLat = ((uLat + tLat) / 2) * Math.PI / 180;
    return {
      x: (tLng - uLng) * Math.PI / 180 * R * Math.cos(avgLat),
      z: -(tLat - uLat) * Math.PI / 180 * R,
    };
  },
  /** Signed angle difference -180…180 */
  angleDiff(a, b) {
    let d = ((a - b) % 360 + 360) % 360;
    return d > 180 ? d - 360 : d;
  },
  /** Is target bearing within fovAngle of deviceHeading? */
  inFOV(targetBearing, deviceHeading, fovAngle = 25) {
    return Math.abs(this.angleDiff(targetBearing, deviceHeading)) <= fovAngle;
  },
  /** Bearing → screen X % (centre = 50, H_FOV = 60°) */
  bearingToScreenX(targetBearing, deviceHeading) {
    const diff = this.angleDiff(targetBearing, deviceHeading);
    return Math.max(5, Math.min(95, 50 + (diff / 60) * 100));
  },
  /** Elevation angle → screen Y % */
  elevToScreenY(elevM, distM, deviceBeta) {
    const angleDeg = Math.atan2(elevM || 2, distM) * 180 / Math.PI;
    const diff = angleDeg - (deviceBeta || 0);
    return Math.max(8, Math.min(88, 50 - (diff / 45) * 100));
  },
  /** Format distance */
  fmt(m) { return m < 1000 ? `${Math.round(m)} م` : `${(m / 1000).toFixed(1)} كم`; },
};

// ═══════════════════════════════════════════════════════════════
// 🎨  HOLOGRAPHIC SHADER MATERIAL
// ═══════════════════════════════════════════════════════════════
function makeHoloMaterial(color = 0x00d4ff, opacity = 0.72) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main(){
        vNormal   = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3  uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main(){
        float fresnel  = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 2.5);
        float scan     = step(0.92, fract(vPosition.y * 4.0 + uTime * 0.6)) * 0.4;
        float grid     = step(0.96, fract(vPosition.x * 8.0)) * 0.15
                       + step(0.96, fract(vPosition.z * 8.0)) * 0.15;
        float alpha    = uOpacity * (0.25 + fresnel * 0.55 + scan + grid);
        gl_FragColor   = vec4(uColor + vec3(scan * 0.5), alpha);
      }`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// ═══════════════════════════════════════════════════════════════
// 🏛️  AR VIEW COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ARView() {
  const navigate  = useNavigate();

  // ─ DOM refs ──────────────────────────────────────────────────
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const overlayRef  = useRef(null);

  // ─ Three.js refs ─────────────────────────────────────────────
  const sceneRef    = useRef(null);
  const camRef      = useRef(null);
  const rendRef     = useRef(null);
  const clockRef    = useRef(new THREE.Clock());
  const objMapRef   = useRef({});          // id → THREE.Object3D
  const holoMatsRef = useRef([]);          // holographic materials to tick
  const loaderRef   = useRef(new GLTFLoader());
  const rafRef      = useRef(null);

  // ─ Sensor refs (avoid re-renders) ────────────────────────────
  const orientRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const gpsRef    = useRef({ lat: null, lng: null });
  const watchRef  = useRef(null);

  // ─ State ─────────────────────────────────────────────────────
  const [phase, setPhase]           = useState('permission'); // permission|loading|active|error
  const [permMsg, setPermMsg]       = useState('');
  const [compass, setCompass]       = useState(0);
  const [beta, setBeta]             = useState(0);
  const [userPos, setUserPos]       = useState(null);
  const [arItems, setArItems]       = useState([]);
  const [visibleItems, setVisible]  = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const [statusMsg, setStatus]      = useState('جارٍ تحديد موقعك...');
  const [iOSPerm, setIOSPerm]       = useState(false);

  // ─ Fetch AR content from backend ─────────────────────────────
  const fetchAR = useCallback(async (lat, lng) => {
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const r = await fetch(`${base}/api/ar/nearby?lat=${lat}&lng=${lng}&radius=500`);
      if (!r.ok) return;
      const data = await r.json();
      setArItems(data.contents || []);
      setStatus(`وُجد ${data.contents?.length || 0} عناصر AR`);
    } catch { setStatus('لا يوجد اتصال بالخادم — وضع تجريبي'); }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🎥 CAMERA STREAM
  // ══════════════════════════════════════════════════════════════
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (e) {
      setPermMsg('لم نتمكن من فتح الكاميرا — ' + e.message);
      return false;
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // 🗺️  THREE.JS ENGINE
  // ══════════════════════════════════════════════════════════════
  const initThree = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, w / h, 0.05, 2000);
    camera.position.set(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x88aaff, 0.5));
    const sun = new THREE.DirectionalLight(0xaaddff, 1.2);
    sun.position.set(5, 10, 5);
    scene.add(sun);

    sceneRef.current = scene;
    camRef.current   = camera;
    rendRef.current  = renderer;

    // Resize
    const onResize = () => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Device orientation → camera quaternion ───────────────────
  const updateCamera = useCallback(() => {
    const cam = camRef.current;
    if (!cam) return;
    const { alpha, beta: b, gamma: g } = orientRef.current;

    // Standard WebAR quaternion derivation (Three.js DeviceOrientationControls approach)
    const euler = new THREE.Euler();
    euler.set(
      THREE.MathUtils.degToRad(b  || 0),
      THREE.MathUtils.degToRad(alpha || 0),
      THREE.MathUtils.degToRad(-(g || 0)),
      'YXZ'
    );
    const q = new THREE.Quaternion().setFromEuler(euler);
    // Portrait correction: rotate -90° around X
    const qPortrait = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);
    q.multiply(qPortrait);
    cam.quaternion.copy(q);
  }, []);

  // ── Place / update 3-D object for an AR item ─────────────────
  const placeObject = useCallback((item) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const { lat, lng } = gpsRef.current;
    if (!lat) return;

    const { x, z } = GEO.toWorld(lat, lng, item.latitude, item.longitude);
    const y = parseFloat(item.elevation) || 0;

    // Remove existing
    if (objMapRef.current[item.id]) {
      scene.remove(objMapRef.current[item.id]);
      delete objMapRef.current[item.id];
    }

    if (item.type === 'building') {
      if (item.model_url) {
        loaderRef.current.load(
          item.model_url,
          (gltf) => {
            const model = gltf.scene;
            const mat   = makeHoloMaterial(0x00d4ff, 0.7);
            holoMatsRef.current.push(mat);
            model.traverse(c => {
              if (c.isMesh) {
                c.material = mat;
                // Add wireframe overlay
                const wfMat  = new THREE.MeshBasicMaterial({ color: 0x00aaff, wireframe: true, transparent: true, opacity: 0.25 });
                const wfMesh = new THREE.Mesh(c.geometry, wfMat);
                c.add(wfMesh);
              }
            });
            const sx = parseFloat(item.scale_x) || 1;
            const sy = parseFloat(item.scale_y) || 1;
            const sz = parseFloat(item.scale_z) || 1;
            model.scale.set(sx, sy, sz);
            model.position.set(x, y, z);
            model.rotation.y = -THREE.MathUtils.degToRad(parseFloat(item.bearing) || 0);
            scene.add(model);
            objMapRef.current[item.id] = model;
          },
          undefined,
          () => addPlaceholderBuilding(item, x, y, z)
        );
      } else {
        addPlaceholderBuilding(item, x, y, z);
      }
    } else if (item.type === 'nav_point') {
      addNavArrow3D(item, x, y, z);
    }
    // 'story' items are rendered in HTML overlay only
  }, []);

  const addPlaceholderBuilding = (item, x, y, z) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const group = new THREE.Group();

    // Main body — cuboid
    const bodyGeo = new THREE.BoxGeometry(8, 12, 8);
    const holoMat = makeHoloMaterial(0x00d4ff, 0.65);
    holoMatsRef.current.push(holoMat);
    const body = new THREE.Mesh(bodyGeo, holoMat);
    body.position.y = 6;
    group.add(body);

    // Roof triangle
    const roofGeo = new THREE.ConeGeometry(6.5, 5, 4);
    const roofMat = makeHoloMaterial(0x44eeff, 0.55);
    holoMatsRef.current.push(roofMat);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 14.5;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Wireframe outlines
    [body, roof].forEach(mesh => {
      const wf = new THREE.Mesh(
        mesh.geometry,
        new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 })
      );
      mesh.add(wf);
    });

    const sx = parseFloat(item.scale_x) || 1;
    group.scale.set(sx, parseFloat(item.scale_y) || 1, parseFloat(item.scale_z) || 1);
    group.position.set(x, y, z);
    group.rotation.y = -THREE.MathUtils.degToRad(parseFloat(item.bearing) || 0);
    scene.add(group);
    objMapRef.current[item.id] = group;
  };

  const addNavArrow3D = (item, x, y, z) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const dir    = new THREE.Vector3(0, 0, -1);
    const origin = new THREE.Vector3(x, y + 2, z);
    const arrow  = new THREE.ArrowHelper(dir, origin, 4, 0x00ff88, 1.5, 0.8);
    scene.add(arrow);
    objMapRef.current[item.id] = arrow;
  };

  // ── Update all 3-D object positions when GPS changes ─────────
  const updateWorldPositions = useCallback(() => {
    const { lat, lng } = gpsRef.current;
    if (!lat || !sceneRef.current) return;
    arItems.forEach(item => {
      const obj = objMapRef.current[item.id];
      if (!obj) return;
      const { x, z } = GEO.toWorld(lat, lng, item.latitude, item.longitude);
      obj.position.set(x, obj.position.y, z);
    });
  }, [arItems]);

  // ── Animate loop ─────────────────────────────────────────────
  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    const delta = clockRef.current.getDelta();
    const elapsed = clockRef.current.getElapsedTime();

    // Tick holographic materials
    holoMatsRef.current.forEach(m => { if (m.uniforms) m.uniforms.uTime.value = elapsed; });

    // Sync camera to device orientation
    updateCamera();

    if (rendRef.current && sceneRef.current && camRef.current) {
      rendRef.current.render(sceneRef.current, camRef.current);
    }
  }, [updateCamera]);

  // ══════════════════════════════════════════════════════════════
  // 🧭 SENSORS
  // ══════════════════════════════════════════════════════════════
  const startOrientation = useCallback(() => {
    const handler = (e) => {
      const a = e.webkitCompassHeading ?? (e.alpha ? (360 - e.alpha) : 0);
      orientRef.current = { alpha: a, beta: e.beta || 0, gamma: e.gamma || 0 };
      setCompass(Math.round(a));
      setBeta(Math.round(e.beta || 0));
    };
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+
      setIOSPerm(true);
    } else {
      window.addEventListener('deviceorientation', handler, true);
    }
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  const requestIOSOrientation = async () => {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm === 'granted') {
        const handler = (e) => {
          const a = e.webkitCompassHeading ?? (360 - (e.alpha || 0));
          orientRef.current = { alpha: a, beta: e.beta || 0, gamma: e.gamma || 0 };
          setCompass(Math.round(a));
          setBeta(Math.round(e.beta || 0));
        };
        window.addEventListener('deviceorientation', handler, true);
        setIOSPerm(false);
      }
    } catch { setIOSPerm(false); }
  };

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    const opts = { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 };
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        gpsRef.current = { lat, lng };
        setUserPos({ lat, lng });
        fetchAR(lat, lng);
        updateWorldPositions();
      },
      (err) => setStatus(`GPS: ${err.message}`),
      opts
    );
  }, [fetchAR, updateWorldPositions]);

  // ══════════════════════════════════════════════════════════════
  // 🚀 BOOT SEQUENCE
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    let cleanupOrientation;
    (async () => {
      setPhase('loading');
      const camOk = await startCamera();
      if (!camOk) { setPhase('error'); return; }
      cleanupOrientation = startOrientation();
      startGPS();
      const cleanupThree = initThree();
      animate();
      setPhase('active');
      return cleanupThree;
    })();

    return () => {
      // Cleanup
      cancelAnimationFrame(rafRef.current);
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      window.removeEventListener('deviceorientation', () => {}, true);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      if (rendRef.current) rendRef.current.dispose();
      cleanupOrientation?.();
    };
  }, []); // eslint-disable-line

  // ── Place 3D objects when items arrive ───────────────────────
  useEffect(() => {
    arItems.forEach(item => {
      if (!objMapRef.current[item.id]) placeObject(item);
    });
  }, [arItems, placeObject]);

  // ══════════════════════════════════════════════════════════════
  // 🖥️  VISIBLE ITEMS CALCULATION (runs per compass update)
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!userPos || arItems.length === 0) return;
    const visible = arItems
      .map(item => {
        const dist = GEO.distance(userPos.lat, userPos.lng, item.latitude, item.longitude);
        const bear = GEO.bearing(userPos.lat, userPos.lng, item.latitude, item.longitude);
        const fov  = parseInt(item.fov_angle) || 25;
        const inView = GEO.inFOV(bear, compass, fov);
        const inRange = dist <= (parseInt(item.trigger_radius) || 50);
        const screenX = GEO.bearingToScreenX(bear, compass);
        const screenY = GEO.elevToScreenY(parseFloat(item.elevation) || 2, dist, beta);
        return { ...item, dist, bear, inView, inRange, screenX, screenY };
      })
      .filter(i => i.inRange);
    setVisible(visible);
  }, [compass, userPos, arItems, beta]);

  // ── Compass direction label ───────────────────────────────────
  const compassLabel = () => {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(compass / 45) % 8];
  };

  // ══════════════════════════════════════════════════════════════
  // 🖼️  RENDER
  // ══════════════════════════════════════════════════════════════

  if (phase === 'permission') {
    return (
      <div className="ar-permission-screen">
        <div className="ar-perm-card">
          <div className="ar-perm-icon">📡</div>
          <h2>الواقع المعزز</h2>
          <p>يحتاج التطبيق إلى صلاحيات:</p>
          <ul>
            <li>📷 الكاميرا</li>
            <li>📍 الموقع الجغرافي</li>
            <li>🧭 البوصلة</li>
          </ul>
          <button className="ar-perm-btn" onClick={() => setPhase('loading')}>
            منح الصلاحيات
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="ar-permission-screen">
        <div className="ar-perm-card error">
          <div className="ar-perm-icon">⚠️</div>
          <h2>تعذّر تشغيل AR</h2>
          <p>{permMsg || 'تأكد من منح صلاحيات الكاميرا والموقع'}</p>
          <button className="ar-perm-btn" onClick={() => navigate(-1)}>رجوع</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ar-root">
      {/* ── Camera background ── */}
      <video ref={videoRef} className="ar-video" playsInline muted autoPlay />

      {/* ── Three.js canvas (3-D buildings) ── */}
      <canvas ref={canvasRef} className="ar-canvas" />

      {/* ── HTML overlay ── */}
      <div className="ar-overlay" ref={overlayRef}>

        {/* iOS orientation permission banner */}
        {iOSPerm && (
          <div className="ar-ios-banner" onClick={requestIOSOrientation}>
            اضغط لتفعيل البوصلة على iOS 🧭
          </div>
        )}

        {/* ─── TOP HUD ─── */}
        <div className="ar-hud-top">
          <button className="ar-back-btn" onClick={() => navigate(-1)}>
            ✕
          </button>

          {/* Compass */}
          <div className="ar-compass-ring">
            <div className="ar-compass-needle" style={{ transform: `rotate(${-compass}deg)` }}>
              <span className="ar-compass-n">N</span>
            </div>
            <div className="ar-compass-value">{compass}° {compassLabel()}</div>
          </div>

          {/* Status */}
          <div className="ar-status-pill">
            <span className={`ar-gps-dot ${userPos ? 'active' : ''}`} />
            {userPos
              ? `${userPos.lat.toFixed(5)}, ${userPos.lng.toFixed(5)}`
              : statusMsg}
          </div>
        </div>

        {/* ─── STORY PANELS (HTML AR overlays) ─── */}
        {visibleItems
          .filter(i => i.type === 'story' && i.inView)
          .map(item => (
            <div
              key={item.id}
              className="ar-story-panel"
              style={{ left: `${item.screenX}%`, top: `${item.screenY}%` }}
              onClick={() => setActiveItem(item)}
            >
              {item.image_url && (
                <img className="ar-story-img" src={item.image_url} alt={item.title} />
              )}
              <div className="ar-story-body">
                {item.era_year && <span className="ar-story-year">{item.era_year}</span>}
                <h3>{item.title}</h3>
                {item.subtitle && <p className="ar-story-sub">{item.subtitle}</p>}
              </div>
              <div className="ar-story-dist">{GEO.fmt(item.dist)}</div>
              <div className="ar-story-anchor-line" />
            </div>
          ))}

        {/* ─── NAVIGATION ARROWS (in-view) ─── */}
        {visibleItems
          .filter(i => i.type === 'nav_point' && i.inView)
          .map(item => (
            <div
              key={item.id}
              className="ar-nav-inview"
              style={{ left: `${item.screenX}%`, top: '60%' }}
              onClick={() => setActiveItem(item)}
            >
              <div className="ar-nav-arrow-icon">↑</div>
              <div className="ar-nav-label">{item.title}</div>
              <div className="ar-nav-dist">{GEO.fmt(item.dist)}</div>
            </div>
          ))}

        {/* ─── BUILDING BADGES (in-view) ─── */}
        {visibleItems
          .filter(i => i.type === 'building' && i.inView)
          .map(item => (
            <div
              key={item.id}
              className="ar-building-badge"
              style={{ left: `${item.screenX}%`, top: `${item.screenY - 10}%` }}
              onClick={() => setActiveItem(item)}
            >
              🏛️ {item.title}
              {item.era_year && <span className="ar-badge-year"> — {item.era_year}</span>}
            </div>
          ))}

        {/* ─── EDGE INDICATORS (out of FOV but in range) ─── */}
        {visibleItems
          .filter(i => !i.inView)
          .map(item => {
            const angle = GEO.angleDiff(item.bear, compass) * Math.PI / 180;
            const ex = 50 + Math.sin(angle) * 42;
            const ey = 50 - Math.cos(angle) * 42;
            return (
              <div
                key={`edge-${item.id}`}
                className={`ar-edge-indicator ar-edge-${item.type}`}
                style={{
                  left: `${Math.max(5, Math.min(90, ex))}%`,
                  top:  `${Math.max(5, Math.min(88, ey))}%`,
                  transform: `rotate(${GEO.angleDiff(item.bear, compass)}deg)`,
                }}
                onClick={() => setActiveItem(item)}
              >
                <span className="ar-edge-arrow">▲</span>
                <span className="ar-edge-label">{GEO.fmt(item.dist)}</span>
              </div>
            );
          })}

        {/* ─── BOTTOM HUD BAR ─── */}
        <div className="ar-hud-bottom">
          {visibleItems.length === 0 ? (
            <div className="ar-no-items">لا توجد معالم AR في نطاق {500} م</div>
          ) : (
            <div className="ar-items-strip">
              {visibleItems.map(item => (
                <div
                  key={`strip-${item.id}`}
                  className={`ar-strip-item ar-strip-${item.type} ${item.inView ? 'in-view' : ''}`}
                  onClick={() => setActiveItem(item)}
                >
                  <span className="ar-strip-icon">
                    {item.type === 'building' ? '🏛️' : item.type === 'nav_point' ? '🧭' : '📜'}
                  </span>
                  <span className="ar-strip-name">{item.title}</span>
                  <span className="ar-strip-dist">{GEO.fmt(item.dist)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── ACTIVE ITEM DETAIL PANEL ─── */}
        {activeItem && (
          <div className="ar-detail-panel" onClick={e => e.target === e.currentTarget && setActiveItem(null)}>
            <div className="ar-detail-card">
              <button className="ar-detail-close" onClick={() => setActiveItem(null)}>✕</button>

              {activeItem.image_url && (
                <div className="ar-detail-img-wrap">
                  <img src={activeItem.image_url} alt={activeItem.title} className="ar-detail-img" />
                  {activeItem.era_year && (
                    <div className="ar-detail-era">{activeItem.era_year}</div>
                  )}
                </div>
              )}

              <div className="ar-detail-body">
                <div className={`ar-detail-type-badge ar-type-${activeItem.type}`}>
                  {activeItem.type === 'building' ? '🏛️ معلم تاريخي'
                    : activeItem.type === 'nav_point' ? '🧭 نقطة توجيه'
                    : '📜 قصة المكان'}
                </div>
                <h2 className="ar-detail-title">{activeItem.title}</h2>
                {activeItem.subtitle && <p className="ar-detail-subtitle">{activeItem.subtitle}</p>}
                {activeItem.content && <p className="ar-detail-content">{activeItem.content}</p>}

                <div className="ar-detail-meta">
                  <span>📍 {GEO.fmt(activeItem.dist)}</span>
                  <span>🧭 {Math.round(activeItem.bear)}°</span>
                  {activeItem.era_year && <span>📅 {activeItem.era_year}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── LOADING OVERLAY ─── */}
        {phase === 'loading' && (
          <div className="ar-loading-overlay">
            <div className="ar-loading-ring" />
            <p>جارٍ تهيئة الواقع المعزز...</p>
          </div>
        )}
      </div>
    </div>
  );
}
