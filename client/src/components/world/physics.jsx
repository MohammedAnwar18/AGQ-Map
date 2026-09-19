import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
    Physics, RigidBody, useRapier, useBeforePhysicsStep,
    HeightfieldCollider, CuboidCollider, CylinderCollider, BallCollider
} from '@react-three/rapier';

import { useWorld, live, input, drive } from './worldStore';
import { CarChassis, CarWheel, Surface, footprintOf, OutlineContext } from './assets';
import { PALETTE } from './toon';
import {
    heightAt, heightsForRapier,
    TERRAIN_SPAN, TERRAIN_GRID, DEPTH_LIMIT
} from './terrain';

/* ============================================================
   طبقة الفيزياء — Rigid Body Dynamics فوق التضاريس

   هذا الملف وحده هو ما يجرّ Rapier، ولا يُستورَد إلا حين تُشغَّل
   الفيزياء فعلاً: من لا يفتحها لا يُنزّل منها بايتاً.

   أربع طبقات:

     ١) هيكل الأرض — Heightfield Collider مبنيّ من نفس حقل الارتفاعات
        الذي تُرسم منه الشبكة المرئية، فالحفرة التي تراها هي الحفرة
        التي تسقط فيها. يُعاد بناؤه عند نهاية سحبة النحت لا في كل
        إطار: إعادة بناء BVH ستّين مرّة في الثانية تُجمّد المشهد.

     ٢) هياكل ثابتة — أسطوانة حول كل مبنى وشجرة، فلا تعبرها الأجسام.

     ٣) مركبة Raycast — أربع أشعّة تنزل من مواضع العجلات، ومن طول
        الشعاع يُحسب ضغط نابض التعليق. هكذا تُبنى السيارات في محرّكات
        الألعاب: أرخص من أربعة أجسام صلبة، وأثبت منها بكثير.

     ٤) الطفو — قوّة أرخميدس على ما يغوص تحت سطح الماء.
   ============================================================ */

// ── ١) الأرض ────────────────────────────────────────────────

const TerrainBody = () => {
    const revision = useWorld(s => s.terrainRevision);

    // Rapier ينسخ المصفوفة عند الإنشاء، فالنسخة المؤقّتة هنا كافية.
    // الترتيب منقول — تحقّقنا منه بشعاع نازل على حقل غير متماثل.
    const heights = useMemo(() => heightsForRapier(), [revision]);

    return (
        <RigidBody key={revision} type="fixed" friction={1.15} restitution={0.02} colliders={false}>
            <HeightfieldCollider
                args={[
                    TERRAIN_GRID - 1,
                    TERRAIN_GRID - 1,
                    heights,
                    { x: TERRAIN_SPAN, y: 1, z: TERRAIN_SPAN }
                ]}
            />
        </RigidBody>
    );
};

/**
 * أرضية بعيدة وشبكة أمان.
 *
 * الحقل يغطّي مربّعاً من ٢٥٦ متراً؛ خارجه أرض مستوية كما في المشهد
 * المرئي. والقاع السحيق يلتقط ما يفلت فلا يسقط جسم إلى الأبد.
 */
const OuterGround = () => {
    const ring = TERRAIN_SPAN / 2;
    const arm = 240;

    return (
        <>
            {[[0, ring + arm], [0, -(ring + arm)], [ring + arm, 0], [-(ring + arm), 0]].map(([x, z], i) => (
                <RigidBody key={i} type="fixed" friction={1} colliders={false} position={[x, -0.5, z]}>
                    <CuboidCollider args={[x ? arm : ring + arm * 2, 0.5, x ? ring + arm * 2 : arm]} />
                </RigidBody>
            ))}

            <RigidBody type="fixed" colliders={false} position={[0, DEPTH_LIMIT - 12, 0]}>
                <CuboidCollider args={[600, 1, 600]} />
            </RigidBody>
        </>
    );
};

// ── ٢) الهياكل الثابتة ──────────────────────────────────────

// ارتفاع تقريبي للاصطدام — لا يُرى، فيكفي أن يكون قريباً
const SOLID_HEIGHT = {
    house: 6.4, cottage: 5, tower: 18, shop: 5.6, fountain: 1.4,
    tree: 5, pine: 6, palm: 6.5, bush: 1.2, rock: 1.6,
    bench: 0.9, lamp: 5, fence: 1.4, bus_stop: 2.8,
    traffic_light: 3.6, bin: 1, hydrant: 0.9, hill: 5
};

const StaticBodies = () => {
    const placed = useWorld(s => s.placed);
    const revision = useWorld(s => s.terrainRevision);

    const solids = useMemo(() => placed
        .map(item => {
            const radius = footprintOf(item.type) * (item.scale || 1);
            if (!radius) return null;
            const height = (SOLID_HEIGHT[item.type] || 3) * (item.scale || 1);
            return { id: item.id, x: item.x, z: item.z, radius, height };
        })
        .filter(Boolean), [placed]);

    return (
        <group key={revision}>
            {solids.map(s => (
                <RigidBody
                    key={s.id}
                    type="fixed"
                    colliders={false}
                    friction={0.9}
                    position={[s.x, heightAt(s.x, s.z), s.z]}
                >
                    <CylinderCollider args={[s.height / 2, s.radius]} position={[0, s.height / 2, 0]} />
                </RigidBody>
            ))}
        </group>
    );
};

// ── ٣) المركبة ──────────────────────────────────────────────

const WHEEL_RADIUS = 0.37;
const SUSPENSION_REST = 0.34;

// مواضع تركيب العجلات في إحداثيات الهيكل. الأمام ‎+Z‎ لأن السيارة
// في سجلّ الأصول تنظر إلى ‎+Z‎ (مصابيحها هناك)، وهو أيضاً محور
// «الأمام» الافتراضي في Rapier.
const WHEELS = [
    { x: -0.95, z: 1.35, steer: true, drive: false },
    { x: 0.95, z: 1.35, steer: true, drive: false },
    { x: -0.95, z: -1.35, steer: false, drive: true },
    { x: 0.95, z: -1.35, steer: false, drive: true }
];

const ENGINE_FORCE = 2600;    // نيوتن على كل عجلة دافعة
const BRAKE_FORCE = 9;
const HANDBRAKE = 24;
const MAX_STEER = 0.58;       // راديان عند السرعة المنخفضة
const STEER_RATE = 3.4;       // راديان في الثانية — الانعطاف ليس فورياً

// كائنات عمل مشتركة: تخصيص كائن في كل إطار يُتعب جامع القمامة
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * سيارة تُقاد.
 *
 * الهيكل جسم صلب واحد، والعجلات ليست أجساماً بل أشعّة: من المسافة
 * بين نقطة التركيب ونقطة ارتطام الشعاع بالأرض يُحسب انضغاط النابض،
 * ومنه قوّة دفع رأسية بمعادلة نابض-مخمّد. لذلك تميل السيارة مع ميل
 * الأرض وحدها، وتنزل عجلة في حفرة بينما الثلاث الأخرى على المستوي.
 */
const Vehicle = ({ start }) => {
    const bodyRef = useRef(null);
    const wheelRefs = useRef([]);
    const spinRefs = useRef([]);
    const { world } = useRapier();

    const controller = useRef(null);
    const steer = useRef(0);

    /**
     * يُركّب وحدة التحكّم على الهيكل.
     *
     * تُستدعى من حلقة الفيزياء لا من useEffect وحده: ترتيب إنشاء
     * الجسم الصلب بين المكتبة وReact ليس مضموناً، ومحاولة واحدة
     * تفوت تعني سيارة لا تتحرّك بلا رسالة خطأ واحدة.
     */
    const attach = useCallback(() => {
        const rb = bodyRef.current;
        if (!rb || !world || controller.current) return controller.current;

        const c = world.createVehicleController(rb);
        c.indexUpAxis = 1;
        c.setIndexForwardAxis = 2;

        WHEELS.forEach((w, i) => {
            c.addWheel(
                { x: w.x, y: -0.12, z: w.z },
                { x: 0, y: -1, z: 0 },
                { x: -1, y: 0, z: 0 },
                SUSPENSION_REST,
                WHEEL_RADIUS
            );

            // نابض قويّ ومخمّد غير متماثل: الانضغاط أسرع من الارتداد،
            // وإلا ارتدّت السيارة كالكرة بعد كل مطبّ
            c.setWheelSuspensionStiffness(i, 34);
            c.setWheelSuspensionCompression(i, 0.82);
            c.setWheelSuspensionRelaxation(i, 0.88);
            c.setWheelMaxSuspensionTravel(i, 0.3);
            c.setWheelMaxSuspensionForce(i, 22000);
            c.setWheelFrictionSlip(i, 2.1);
            c.setWheelSideFrictionStiffness(i, 0.85);
        });

        controller.current = c;
        return c;
    }, [world]);

    useEffect(() => {
        attach();
        return () => {
            const c = controller.current;
            controller.current = null;
            // نزعها من العالم صراحةً: تركها يُبقي أربعة أشعّة تُحسب
            // في كل خطوة لسيارة لم تعد موجودة
            if (c) { try { world?.removeVehicleController(c); } catch { /* رُفع سلفاً */ } }
        };
    }, [attach, world]);

    useBeforePhysicsStep((w) => {
        const c = controller.current || attach();
        const rb = bodyRef.current;
        if (!c || !rb) return;

        const dt = w.timestep || 1 / 60;
        const speed = c.currentVehicleSpeed();

        // الانعطاف يضيق مع السرعة: مقود حادّ عند مئة كيلومتر يقلب
        const limit = MAX_STEER / (1 + Math.abs(speed) * 0.055);
        const wanted = THREE.MathUtils.clamp(-input.strafe, -1, 1) * limit;
        steer.current += THREE.MathUtils.clamp(wanted - steer.current, -STEER_RATE * dt, STEER_RATE * dt);

        const throttle = THREE.MathUtils.clamp(input.forward, -1, 1);
        const boost = input.run ? 1.55 : 1;

        // الدفعة عكس اتجاه السير تُقرأ فرملةً لا رجوعاً
        const braking = throttle !== 0 && Math.sign(throttle) !== Math.sign(speed) && Math.abs(speed) > 1.2;
        const engine = braking ? 0 : throttle * ENGINE_FORCE * boost * (throttle < 0 ? 0.45 : 1);
        const brake = input.brake ? HANDBRAKE : braking ? BRAKE_FORCE : 0;

        WHEELS.forEach((wheel, i) => {
            c.setWheelEngineForce(i, wheel.drive ? engine : 0);
            c.setWheelSteering(i, wheel.steer ? steer.current : 0);
            // الفرامل اليدوية على الخلفيّتين وحدهما — هكذا ينزلق الخلف
            c.setWheelBrake(i, input.brake ? (wheel.drive ? HANDBRAKE : 0) : brake);
        });

        c.updateVehicle(dt);

        // مقاومة الهواء: بدونها تتسارع السيارة بلا سقف
        const v = rb.linvel();
        const mag = Math.hypot(v.x, v.y, v.z);
        if (mag > 0.1) {
            const dragK = 4;
            rb.applyImpulse({
                x: -v.x * mag * dragK * dt,
                y: 0,
                z: -v.z * mag * dragK * dt
            }, true);
        }

        drive.speed = Math.abs(speed) * 3.6;
        drive.gear = speed > 0.4 ? 'د' : speed < -0.4 ? 'خ' : 'ط';
        drive.onGround = [0, 1, 2, 3].filter(i => c.wheelIsInContact(i)).length;
    });

    useFrame(() => {
        const c = controller.current;
        const rb = bodyRef.current;
        if (!c || !rb) return;

        // العجلة تتبع طول نابضها لا الهيكل: هذا هو ما يُرى انضغاطاً
        WHEELS.forEach((wheel, i) => {
            const group = wheelRefs.current[i];
            const spin = spinRefs.current[i];
            if (!group) return;

            const travel = c.wheelSuspensionLength(i);
            const rest = Number.isFinite(travel) ? travel : SUSPENSION_REST;

            group.position.set(wheel.x, -0.12 - rest, wheel.z);
            group.rotation.y = c.wheelSteering(i) || 0;
            if (spin) spin.rotation.x = c.wheelRotation(i) || 0;
        });

        const p = rb.translation();
        const q = rb.rotation();

        drive.x = p.x;
        drive.z = p.z;

        tmpQuat.set(q.x, q.y, q.z, q.w);
        tmpEuler.setFromQuaternion(tmpQuat, 'YXZ');
        drive.heading = tmpEuler.y;

        // الخريطة تتابع السيارة كما تتابع المشاة
        if (useWorld.getState().mode === 'drive') {
            live.x = p.x;
            live.z = p.z;
            live.heading = tmpEuler.y;
            live.moving = drive.speed > 1;
        }
    });

    return (
        <OutlineContext.Provider value={false}>
            <RigidBody
                ref={bodyRef}
                colliders={false}
                position={start}
                canSleep={false}
                linearDamping={0.05}
                angularDamping={0.6}
            >
                {/* مركز الكتلة مرفوع قليلاً عن محور العجلات لا عالياً:
                    مرتفع يقلب السيارة، ومنخفض يجعلها تنزلق كالصابونة */}
                <CuboidCollider args={[0.95, 0.42, 2.05]} position={[0, 0.34, 0]} density={168} />

                <group position={[0, -0.83, 0]}>
                    <CarChassis body={PALETTE.carB} />
                </group>

                {WHEELS.map((w, i) => (
                    <group key={i} ref={(el) => { wheelRefs.current[i] = el; }} position={[w.x, -0.12, w.z]}>
                        <group ref={(el) => { spinRefs.current[i] = el; }}>
                            <CarWheel r={WHEEL_RADIUS} />
                        </group>
                    </group>
                ))}
            </RigidBody>
        </OutlineContext.Provider>
    );
};

/** كاميرا تتبع السيارة من الخلف وتعلو قليلاً */
const ChaseCamera = () => {
    const { camera } = useThree();
    const desired = useRef(new THREE.Vector3());
    const look = useRef(new THREE.Vector3());

    useFrame((_, dt) => {
        if (useWorld.getState().mode !== 'drive') return;

        const back = 9.5 + Math.min(drive.speed * 0.045, 3.5);
        const sin = Math.sin(drive.heading);
        const cos = Math.cos(drive.heading);

        desired.current.set(
            drive.x - sin * back,
            heightAt(drive.x, drive.z) + 4.6,
            drive.z - cos * back
        );

        // تتبّع ناعم مستقلّ عن معدّل الإطارات
        const k = 1 - Math.exp(-7 * Math.min(dt, 0.05));
        camera.position.lerp(desired.current, k);

        look.current.set(
            drive.x + sin * 6,
            heightAt(drive.x, drive.z) + 1.4,
            drive.z + cos * 6
        );
        camera.lookAt(look.current);
    });

    return null;
};

// ── ٤) الأجسام الحرّة والطفو ────────────────────────────────

const CRATE_COLORS = ['#C98B4B', '#B4654A', '#8FA8B8', '#CBB185'];

/**
 * صناديق وكرات تتدحرج.
 *
 * ليست زينة: هي الدليل المرئي على أن الأرض التي نحتّها أرض فعلاً —
 * الصندوق ينزلق على المنحدر، ويستقرّ في الحفرة، ويطفو إن امتلأت ماءً.
 */
const Debris = ({ count }) => {
    const items = useMemo(() => {
        let seed = 20260919;
        const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

        return Array.from({ length: count }, (_, i) => {
            const x = (r() - 0.5) * 60;
            const z = (r() - 0.5) * 60;
            return {
                id: i,
                ball: r() > 0.62,
                size: 0.45 + r() * 0.4,
                color: CRATE_COLORS[Math.floor(r() * CRATE_COLORS.length)],
                position: [x, heightAt(x, z) + 9 + r() * 14, z],
                spin: [(r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2]
            };
        });
    }, [count]);

    return (
        <>
            {items.map(item => (
                <FloatingBody key={item.id} item={item} />
            ))}
        </>
    );
};

const FloatingBody = ({ item }) => {
    const ref = useRef(null);
    const buoyancy = useWorld(s => s.physics.buoyancy);
    const waterOn = useWorld(s => s.terrain.water);
    const level = useWorld(s => s.terrain.waterLevel);

    // قوّة أرخميدس: دفع لأعلى يتناسب مع الحجم المغمور، مع تخميد
    // يمنع الجسم من التأرجح إلى الأبد حول سطح الماء
    useBeforePhysicsStep((w) => {
        if (!waterOn || !buoyancy) return;
        const rb = ref.current;
        if (!rb) return;

        const p = rb.translation();
        const submerged = level - (p.y - item.size);
        if (submerged <= 0) return;

        const dt = w.timestep || 1 / 60;
        const ratio = Math.min(1, submerged / (item.size * 2));
        const volume = item.size * item.size * item.size * 8;

        rb.applyImpulse({ x: 0, y: 9.81 * volume * ratio * 62 * dt, z: 0 }, true);

        const v = rb.linvel();
        const dragK = 3.6 * ratio;
        rb.applyImpulse({ x: -v.x * dragK * dt * 30, y: -v.y * dragK * dt * 30, z: -v.z * dragK * dt * 30 }, true);
    });

    return (
        <RigidBody
            ref={ref}
            position={item.position}
            rotation={item.spin}
            colliders={false}
            friction={0.75}
            restitution={item.ball ? 0.45 : 0.12}
            linearDamping={0.06}
            angularDamping={0.14}
        >
            {item.ball
                ? <BallCollider args={[item.size]} density={420} />
                : <CuboidCollider args={[item.size, item.size, item.size]} density={340} />}

            <mesh castShadow receiveShadow>
                {item.ball
                    ? <sphereGeometry args={[item.size, 18, 12]} />
                    : <boxGeometry args={[item.size * 2, item.size * 2, item.size * 2]} />}
                <Surface color={item.color} roughness={0.85} />
            </mesh>
        </RigidBody>
    );
};

// ── التجميع ─────────────────────────────────────────────────

const PhysicsLayer = () => {
    const gravity = useWorld(s => s.physics.gravity);
    const debug = useWorld(s => s.physics.debug);
    const wantVehicle = useWorld(s => s.physics.vehicle);
    const debris = useWorld(s => s.physics.debris);
    const mode = useWorld(s => s.mode);

    // نقطة انطلاق السيارة: على الطريق أمام الكاميرا، فوق الأرض
    const start = useMemo(() => {
        const x = 3.2;
        const z = 10;
        return [x, heightAt(x, z) + 1.3, z];
    }, []);

    return (
        <Physics
            gravity={[0, -gravity, 0]}
            timeStep="vary"
            debug={debug}
        >
            <TerrainBody />
            <OuterGround />
            <StaticBodies />

            {wantVehicle && <Vehicle start={start} />}
            {mode === 'drive' && <ChaseCamera />}
            {debris > 0 && <Debris count={debris} />}
        </Physics>
    );
};

export default PhysicsLayer;
