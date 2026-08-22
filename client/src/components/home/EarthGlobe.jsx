import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Procedural Earth texture fallback
const createRealisticEarthTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    oceanGrad.addColorStop(0, '#0c2340');
    oceanGrad.addColorStop(0.3, '#103761');
    oceanGrad.addColorStop(0.5, '#17487c');
    oceanGrad.addColorStop(0.7, '#103761');
    oceanGrad.addColorStop(1, '#0c2340');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const toCanvasX = (lon) => ((lon + 180) / 360) * canvas.width;
    const toCanvasY = (lat) => ((90 - lat) / 180) * canvas.height;

    const continents = [
        [[-17,15],[-5,36],[10,37],[25,32],[32,31],[35,33],[36,30],[43,12],[51,11],[58,24],[55,26],[48,30],[36,36],[32,32],[40,20],[51,10],[42,-5],[35,-20],[28,-34],[18,-34],[12,-18],[9,4],[0,6],[-15,12],[-17,15]],
        [[-10,36],[-8,44],[-4,48],[2,51],[8,55],[10,58],[18,60],[25,70],[32,70],[40,65],[45,55],[35,45],[26,40],[20,38],[15,40],[5,43],[-2,40],[-6,36],[-10,36]],
        [[40,65],[60,70],[90,75],[120,75],[145,70],[170,65],[140,50],[130,42],[122,30],[108,20],[100,5],[80,8],[70,22],[60,25],[50,35],[45,45],[40,65]],
        [[-165,65],[-140,70],[-90,75],[-60,65],[-55,50],[-70,42],[-80,25],[-90,20],[-100,22],[-105,20],[-85,15],[-77,8],[-85,12],[-105,23],[-115,32],[-124,48],[-140,60],[-165,65]],
        [[-77,8],[-60,10],[-50,0],[-35,-6],[-38,-18],[-48,-28],[-58,-38],[-66,-55],[-75,-50],[-72,-35],[-78,-15],[-80,-2],[-77,8]],
        [[115,-22],[130,-12],[142,-10],[152,-24],[150,-38],[138,-38],[118,-35],[114,-26],[115,-22]]
    ];

    continents.forEach((poly) => {
        ctx.beginPath();
        poly.forEach(([lon, lat], idx) => {
            const cx = toCanvasX(lon);
            const cy = toCanvasY(lat);
            if (idx === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
        const landGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        landGrad.addColorStop(0, '#2e5a36');
        landGrad.addColorStop(0.35, '#8c764b');
        landGrad.addColorStop(0.65, '#5c7846');
        landGrad.addColorStop(1, '#2c4b31');
        ctx.fillStyle = landGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(78,178,220,0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
};

const createRealisticCloudTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 220; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 55 + 20;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.45)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
};

export default function EarthGlobe({ className = '' }) {
    const mountRef = useRef(null);
    const animFrameRef = useRef(null);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2500);
        camera.position.z = 240;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        container.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x334155, 1.2);
        scene.add(ambientLight);
        const sunLight = new THREE.DirectionalLight(0xffffff, 2.8);
        sunLight.position.set(300, 150, 220);
        scene.add(sunLight);
        const earthBackglow = new THREE.DirectionalLight(0x1e3a8a, 1.6);
        earthBackglow.position.set(-250, -120, -180);
        scene.add(earthBackglow);

        // Starfield
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1600;
        const starPositions = new Float32Array(starCount * 3);
        const starColors = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i += 3) {
            const r = 500 + Math.random() * 600;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            starPositions[i]     = r * Math.sin(phi) * Math.cos(theta);
            starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPositions[i + 2] = r * Math.cos(phi);
            const rnd = Math.random();
            if (rnd > 0.8) {
                starColors[i] = 0.98; starColors[i+1] = 0.85; starColors[i+2] = 0.55;
            } else if (rnd > 0.5) {
                starColors[i] = 0.55; starColors[i+1] = 0.85; starColors[i+2] = 1.0;
            } else {
                starColors[i] = 0.95; starColors[i+1] = 0.95; starColors[i+2] = 0.98;
            }
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        const starMat = new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, opacity: 0.85 });
        const starField = new THREE.Points(starGeo, starMat);
        scene.add(starField);

        // Earth Globe
        const GLOBE_RADIUS = 90;
        const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
        const fallbackTexture = createRealisticEarthTexture();
        const earthMat = new THREE.MeshStandardMaterial({ map: fallbackTexture, roughness: 0.65, metalness: 0.1 });

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; earthMat.map = tex; earthMat.needsUpdate = true; },
            undefined,
            () => {}
        );
        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
            (normTex) => { earthMat.normalMap = normTex; earthMat.normalScale.set(0.6, 0.6); earthMat.needsUpdate = true; }
        );

        const earth = new THREE.Mesh(earthGeo, earthMat);
        scene.add(earth);

        // Atmosphere
        const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.025, 64, 64);
        const atmoMat = new THREE.MeshStandardMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.BackSide });
        scene.add(new THREE.Mesh(atmoGeo, atmoMat));

        const outerGlowGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.06, 48, 48);
        const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.BackSide });
        scene.add(new THREE.Mesh(outerGlowGeo, outerGlowMat));

        // Clouds
        const cloudGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.012, 64, 64);
        const cloudMat = new THREE.MeshStandardMaterial({ map: createRealisticCloudTexture(), transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending });
        textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
            (cloudTex) => { cloudMat.map = cloudTex; cloudMat.needsUpdate = true; }
        );
        const clouds = new THREE.Mesh(cloudGeo, cloudMat);
        scene.add(clouds);

        // Mouse drag to rotate
        let isDragging = false;
        let prevMouseX = 0;
        let prevMouseY = 0;
        let rotX = 0.25;
        let rotY = -0.5;

        const onMouseDown = (e) => {
            if (e.target !== renderer.domElement) return;
            isDragging = true;
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        };
        const onMouseMove = (e) => {
            if (!isDragging) return;
            rotY += (e.clientX - prevMouseX) * 0.005;
            rotX = Math.max(-1.1, Math.min(1.1, rotX + (e.clientY - prevMouseY) * 0.005));
            prevMouseX = e.clientX;
            prevMouseY = e.clientY;
        };
        const onMouseUp = () => { isDragging = false; };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        const handleResize = () => {
            if (!container || !renderer || !camera) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // Animation — smooth continuous rotation only
        const clock = new THREE.Clock();
        const animate = () => {
            animFrameRef.current = requestAnimationFrame(animate);
            const elapsed = clock.getElapsedTime();

            // Slowly auto-rotate when not dragging
            if (!isDragging) {
                rotY += 0.0018;
            }

            earth.rotation.x = rotX;
            earth.rotation.y = rotY;
            clouds.rotation.x = rotX * 1.02;
            clouds.rotation.y = rotY + elapsed * 0.012;
            starField.rotation.y = elapsed * 0.0015;

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('resize', handleResize);
            if (container && renderer.domElement) container.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    return (
        <div className={`realistic-earth-wrapper ${className}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
        </div>
    );
}
