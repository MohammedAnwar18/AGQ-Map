import React, { Suspense, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

import WorldScene from './WorldScene';
import { useWorld, live, input, drive, resetInput } from './worldStore';
import { useGame, self, remotes, fullAppearance } from './gameStore';
import { RemotePlayers, SelfAvatar } from './avatar';
import { heightAt } from './terrain';
import { cityPlan, districtAt } from './city';
import { WalkControls, DriveControls } from './walk';
import MiniMap from './MiniMap';
import GameHud from './GameHud';
import './GameWorld.css';

/* ============================================================
   عالم اللعب

   نفس مشهد المحرّر بلا لوحاته: من له حساب يدخل فيمشي ويقود، ومن
   هو الأدمن وحده من يبني.

   الفرق الجوهري عن المحرّر أن كل شيء هنا يبدأ من التفاعل لا من
   قائمة: تقترب من سيارة فتُعرض عليك، وتضغط فتركب. لا زرّ اسمه
   «وضع القيادة» في لوحة جانبية.
   ============================================================ */

const EYE = 1.68;
const WALK_SPEED = 4.6;
const RUN_SPEED = 8.4;
const BODY_RADIUS = 0.45;

// كم متراً قبل أن تُعرض عليك السيارة — مدى ذراع لا مدى نظر
const REACH = 3.6;

const UP = new THREE.Vector3(0, 1, 0);

// ── كاميرا الشخص الثالث ─────────────────────────────────────

const CAM_BACK = 4.2;
const CAM_HIGH = 1.05;

/**
 * المشي بمنظور الشخص الثالث.
 *
 * لا أوّل: أنت تختار شكل شخصيتك، ورؤيتها وهي تمشي هي نصف المعنى.
 * والكاميرا خلفها لا فيها — ترتفع مع النظر لأعلى وتقترب عند الجدار
 * بدل أن تدخله.
 */
const Player = ({ look, onInteract }) => {
    const { camera, scene } = useThree();

    const pos = useRef(new THREE.Vector3(0, 0, 96));
    const yaw = useRef(0);
    const pitch = useRef(0.22);
    const walking = useRef(false);
    const dir = useRef(new THREE.Vector3());
    const target = useRef(new THREE.Vector3());
    const desired = useRef(new THREE.Vector3());
    const ray = useRef(new THREE.Raycaster());

    const poseRef = useRef({ x: 0, z: 96, heading: 0 });

    useEffect(() => {
        // نبدأ على حافّة المدينة ناظرين إليها
        pos.current.set(0, heightAt(0, 96), 96);
        yaw.current = Math.PI;
    }, []);

    useFrame((_, dt) => {
        const step = Math.min(dt, 0.05);
        const riding = useGame.getState().vehicleId;

        // ── النظر ──
        yaw.current -= input.yaw;
        pitch.current = THREE.MathUtils.clamp(pitch.current - input.pitch, -0.35, 1.0);
        input.yaw = 0;
        input.pitch = 0;

        if (riding) {
            // نحن في سيارة: الجسد يختفي ويتبع موضعها كي نخرج بجانبها
            pos.current.set(drive.x, heightAt(drive.x, drive.z), drive.z);
            yaw.current = drive.heading;
            walking.current = false;
            poseRef.current = { x: drive.x, z: drive.z, heading: drive.heading };
            return;
        }

        // ── الحركة ──
        const speed = (input.run ? RUN_SPEED : WALK_SPEED) * step;
        dir.current.set(input.strafe, 0, -input.forward);
        walking.current = dir.current.lengthSq() > 0.0001;

        if (walking.current) {
            dir.current.normalize().applyAxisAngle(UP, yaw.current).multiplyScalar(speed);

            const next = pos.current.clone().add(dir.current);
            resolveWalls(next);

            const limit = 236;
            next.x = THREE.MathUtils.clamp(next.x, -limit, limit);
            next.z = THREE.MathUtils.clamp(next.z, -limit, limit);
            pos.current.copy(next);
        }

        pos.current.y = heightAt(pos.current.x, pos.current.z);

        // الشخصية تدور نحو وجهة سيرها لا نحو نظر الكاميرا: الوقوف
        // ثم تحريك الفأرة يُدير المشهد لا الجسد
        const facing = walking.current
            ? Math.atan2(dir.current.x, dir.current.z)
            : poseRef.current.heading;

        let turn = facing - poseRef.current.heading;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;

        poseRef.current = {
            x: pos.current.x,
            z: pos.current.z,
            heading: poseRef.current.heading + turn * (1 - Math.exp(-step / 0.09))
        };

        // ── الكاميرا ──
        const back = CAM_BACK * Math.cos(pitch.current);
        desired.current.set(
            pos.current.x - Math.sin(yaw.current) * back,
            pos.current.y + EYE + CAM_HIGH + Math.sin(pitch.current) * CAM_BACK,
            pos.current.z - Math.cos(yaw.current) * back
        );

        // جدار خلفك؟ تقترب الكاميرا بدل أن تدخله
        target.current.set(pos.current.x, pos.current.y + EYE, pos.current.z);
        const toCam = desired.current.clone().sub(target.current);
        const reach = toCam.length();
        ray.current.set(target.current, toCam.normalize());
        ray.current.far = reach;

        const blocked = ray.current.intersectObjects(scene.children, true)
            .find(hit => hit.distance > 0.4 && hit.object.visible && !hit.object.userData.noClip);

        if (blocked) desired.current.copy(target.current).addScaledVector(toCam, blocked.distance - 0.3);

        camera.position.lerp(desired.current, 1 - Math.exp(-step / 0.05));
        camera.lookAt(target.current);

        // ── النشر ──
        live.x = pos.current.x;
        live.z = pos.current.z;
        live.heading = poseRef.current.heading;
        live.moving = walking.current;

        self.x = pos.current.x;
        self.y = pos.current.y;
        self.z = pos.current.z;
        self.heading = poseRef.current.heading;
        self.mode = 'walk';

        onInteract(pos.current.x, pos.current.z);
    });

    const riding = useGame(s => Boolean(s.vehicleId));
    if (riding) return null;

    return <SelfAvatar look={look} positionRef={poseRef} walking={walking} />;
};

/** يدفع اللاعب خارج مباني المدينة وما وُضع فيها */
const resolveWalls = (next) => {
    const state = useWorld.getState();
    const plan = cityPlan(state.city);

    const bump = (cx, cz, radius) => {
        const dx = next.x - cx;
        const dz = next.z - cz;
        const min = radius + BODY_RADIUS;
        const d2 = dx * dx + dz * dz;

        if (d2 < min * min && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            next.x = cx + (dx / d) * min;
            next.z = cz + (dz / d) * min;
        }
    };

    for (const item of state.placed) {
        const r = FOOTPRINTS[item.type];
        if (r) bump(item.x, item.z, r * (item.scale || 1));
    }

    if (!plan) return;
    for (const b of nearbySolids(plan, next.x, next.z)) bump(b.x, b.z, b.radius);
};

// نُبقي نسخة من أنصاف الأقطار هنا كي لا يجرّ ملفّ اللعب سجلّ
// الأصول كلّه — وهو يجرّ معه three وخطّ أنابيب glTF
const FOOTPRINTS = {
    house: 3.6, cottage: 2.9, tower: 3.4, shop: 3.8, fountain: 2.5,
    tree: 0.6, pine: 0.55, palm: 0.5, bush: 0.7, rock: 0.9,
    car: 1.5, van: 1.7, bench: 1.1, lamp: 0.3, fence: 1.9,
    traffic_light: 0.32, bin: 0.4, hydrant: 0.3, bus_stop: 1.8, hill: 5,
    tower_glass: 5.4, tower_brick: 5.2, apartment: 4.4, villa: 4.4,
    shop_row: 4.6, market_hall: 6.2, kiosk: 1.7, warehouse: 6.8,
    mosque: 6.8, school: 5.6, clinic: 5.2, pickup: 1.6, bus: 2.4
};

let solidIndex = null;

const nearbySolids = (plan, x, z) => {
    if (!solidIndex || solidIndex.plan !== plan) {
        const cells = new Map();
        const key = (a, b) => `${a},${b}`;

        for (const item of [...plan.buildings, ...plan.props]) {
            const radius = (FOOTPRINTS[item.type] || 0) * (item.scale || 1);
            if (!radius) continue;

            const k = key(Math.floor(item.x / 24), Math.floor(item.z / 24));
            if (!cells.has(k)) cells.set(k, []);
            cells.get(k).push({ x: item.x, z: item.z, radius });
        }
        solidIndex = { plan, cells, key };
    }

    const out = [];
    const ix = Math.floor(x / 24);
    const iz = Math.floor(z / 24);
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const bucket = solidIndex.cells.get(solidIndex.key(ix + dx, iz + dz));
            if (bucket) out.push(...bucket);
        }
    }
    return out;
};

// ── الجسر بين الواجهة والمشهد ───────────────────────────────

const GameScene = ({ look, codes, carOverrides }) => {
    const cityCfg = useWorld(s => s.city);
    const plan = useMemo(() => cityPlan(cityCfg), [cityCfg]);

    const setPrompt = useGame(s => s.setPrompt);
    const setDistrict = useGame(s => s.setDistrict);
    const vehicleId = useGame(s => s.vehicleId);

    const lastCheck = useRef(0);

    /**
     * ما الذي يمكنك فعله من حيث تقف؟
     *
     * يُسأل خمس مرّات في الثانية لا ستّين: السؤال يمرّ على المركبات
     * القريبة، والإجابة لا تتغيّر بين إطار وإطار.
     */
    const onInteract = useCallback((x, z) => {
        const now = performance.now();
        if (now - lastCheck.current < 200) return;
        lastCheck.current = now;

        if (plan) setDistrict(districtAt(plan, x, z));

        if (vehicleId || !plan) { setPrompt(null); return; }

        let best = null;
        let bestDist = REACH;

        for (const car of plan.cars) {
            const place = carOverrides[car.id] || car;
            const d = Math.hypot(place.x - x, place.z - z);
            if (d < bestDist) { bestDist = d; best = { ...car, ...place }; }
        }

        setPrompt(best ? { kind: 'enter', label: 'اركب', car: best } : null);
    }, [plan, vehicleId, carOverrides, setPrompt, setDistrict]);

    return (
        <>
            <WorldScene hiddenCarId={vehicleId} carOverrides={carOverrides} />
            <Player look={look} onInteract={onInteract} />
            <RemotePlayers codes={codes} />
        </>
    );
};

// ── الحضور ──────────────────────────────────────────────────

const PULSE_MS = 1000;

/**
 * نبضة الحضور.
 *
 * ذهاب وإياب واحد كل ثانية: تُرسل موضعي وتعود بمواضع من معي.
 * والمواضع تُكتب في خريطة خارج React — الرسم يقرأها في حلقته،
 * ولا يُعاد بناء شيء إلا حين تتغيّر **قائمة** الحاضرين.
 */
const usePresence = (worldCode, service, onOffline) => {
    const [codes, setCodes] = useState([]);
    const setNearby = useGame(s => s.setNearby);

    useEffect(() => {
        if (!worldCode) return undefined;

        let alive = true;
        let timer = 0;
        let failures = 0;

        const beat = async () => {
            try {
                const data = await service.presence({
                    world: worldCode,
                    x: +self.x.toFixed(2),
                    y: +self.y.toFixed(2),
                    z: +self.z.toFixed(2),
                    heading: +self.heading.toFixed(4),
                    mode: self.mode,
                    vehicle: self.vehicle
                });

                if (!alive) return;
                failures = 0;
                onOffline(true);

                const seen = new Set();
                for (const p of data.players || []) {
                    seen.add(p.code);
                    remotes.set(p.code, {
                        ...p,
                        appearance: fullAppearance(p.appearance)
                    });
                }

                for (const code of [...remotes.keys()]) {
                    if (!seen.has(code)) remotes.delete(code);
                }

                setCodes(prev => {
                    const next = [...seen];
                    // نتجنّب إعادة الرسم حين لا تتغيّر القائمة فعلاً
                    if (prev.length === next.length && prev.every(c => seen.has(c))) return prev;
                    return next;
                });
                setNearby(seen.size);
            } catch {
                // انقطاع عابر لا يُفرّغ المشهد: نُبقي من كان حاضراً
                // ونُعلن الانقطاع بعد ثلاث نبضات فائتة
                if (++failures >= 3) onOffline(false);
            } finally {
                if (alive) timer = setTimeout(beat, PULSE_MS);
            }
        };

        beat();

        return () => {
            alive = false;
            clearTimeout(timer);
            remotes.clear();
            service.leave();
        };
    }, [worldCode, service, onOffline, setNearby]);

    return codes;
};

// ── الغلاف ──────────────────────────────────────────────────

const GameWorld = ({ onClose, service }) => {
    const canvasRef = useRef(null);
    const rootRef = useRef(null);

    const [fps, setFps] = useState(null);
    const [notice, setNotice] = useState(null);
    const [carOverrides, setCarOverrides] = useState({});

    const player = useGame(s => s.player);
    const visiting = useGame(s => s.visiting);
    const vehicleId = useGame(s => s.vehicleId);
    const prompt = useGame(s => s.prompt);
    const enterVehicle = useGame(s => s.enterVehicle);
    const exitVehicle = useGame(s => s.exitVehicle);
    const setOnline = useGame(s => s.setOnline);

    const setMode = useWorld(s => s.setMode);
    const setPhysics = useWorld(s => s.setPhysics);

    const look = useMemo(() => fullAppearance(player?.appearance), [player]);
    const worldCode = visiting?.code || player?.code || null;

    const flash = useCallback((message, kind = 'ok') => {
        setNotice({ message, kind });
        setTimeout(() => setNotice(null), 2600);
    }, []);

    const onOffline = useCallback((ok) => setOnline(ok), [setOnline]);
    const codes = usePresence(worldCode, service, onOffline);

    // ── الركوب والترجّل ──
    const toggleVehicle = useCallback(() => {
        const state = useGame.getState();

        if (state.vehicleId) {
            // نترك السيارة حيث أوقفناها، ونقف بجانبها لا داخلها
            setCarOverrides(prev => ({
                ...prev,
                [state.vehicleId]: {
                    x: +drive.x.toFixed(2),
                    z: +drive.z.toFixed(2),
                    rotation: +drive.heading.toFixed(4)
                }
            }));

            exitVehicle();
            setMode('walk');
            self.vehicle = null;
            resetInput();
            flash('ترجّلت');
            return;
        }

        const car = state.prompt?.car;
        if (!car) return;

        enterVehicle(car);
        setPhysics('enabled', true);
        setMode('drive');
        self.vehicle = car.id;
        resetInput();
        flash('اركب وانطلق — W للتسارع');
    }, [enterVehicle, exitVehicle, setMode, setPhysics, flash]);

    // ── المفاتيح ──
    useEffect(() => {
        const onKey = (e) => {
            if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;

            if (e.code === 'KeyE' || e.code === 'KeyF') {
                e.preventDefault();
                toggleVehicle();
            }
            if (e.key === 'Escape') {
                const state = useGame.getState();
                if (state.sheet) state.openSheet(null);
                else if (state.vehicleId) toggleVehicle();
                else onClose?.();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleVehicle, onClose]);

    // ── تنظيف ──
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        setMode('walk');

        return () => {
            document.body.style.overflow = '';
            setMode('orbit');
            setPhysics('enabled', false);
            resetInput();
            useGame.getState().reset();
        };
    }, [setMode, setPhysics]);

    // ارتفاع مرئي بالبكسل — نفس علّة المحرّر: ‎100vh‎ على الجوال
    // تقيس الشاشة الكبيرة لا المرئية
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        const fit = () => {
            const h = window.visualViewport?.height || window.innerHeight;
            if (h > 0) root.style.setProperty('--gw-h', `${Math.round(h)}px`);
        };

        fit();
        window.addEventListener('resize', fit);
        window.addEventListener('orientationchange', fit);
        window.visualViewport?.addEventListener('resize', fit);

        return () => {
            window.removeEventListener('resize', fit);
            window.removeEventListener('orientationchange', fit);
            window.visualViewport?.removeEventListener('resize', fit);
        };
    }, []);

    const driving = Boolean(vehicleId);

    return (
        <div className="gw" dir="rtl" ref={rootRef}>
            <div className="gw-stage">
                <Canvas
                    shadows
                    dpr={[1, 1.75]}
                    camera={{ position: [0, 6, 104], fov: 58, near: 0.3, far: 900 }}
                    gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
                    onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
                >
                    <Suspense fallback={null}>
                        <GameScene look={look} codes={codes} carOverrides={carOverrides} />
                    </Suspense>
                    <FpsProbe onSample={setFps} />
                </Canvas>

                {fps === null && (
                    <div className="gw-loading">
                        <span className="gw-spin" />
                        يفتح العالم…
                    </div>
                )}

                {driving
                    ? <DriveControls onExit={toggleVehicle} />
                    : <WalkControls canvasRef={canvasRef} onExit={onClose} onFlash={flash} bare />}

                <GameHud
                    fps={fps}
                    driving={driving}
                    prompt={prompt}
                    onInteract={toggleVehicle}
                    onClose={onClose}
                    onFlash={flash}
                    service={service}
                    notice={notice}
                />

                <div className="gw-map"><MiniMap compact /></div>
            </div>
        </div>
    );
};

const FpsProbe = ({ onSample }) => {
    const frames = useRef(0);
    const since = useRef(performance.now());

    useFrame(() => {
        frames.current++;
        const now = performance.now();
        if (now - since.current >= 1000) {
            onSample(Math.round((frames.current * 1000) / (now - since.current)));
            frames.current = 0;
            since.current = now;
        }
    });

    return null;
};

export default GameWorld;
