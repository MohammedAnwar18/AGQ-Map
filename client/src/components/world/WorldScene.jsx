import React, { useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Instances, Instance } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import { useWorld, WORLD_BOUNDS } from './worldStore';
import { Asset, OutlineContext } from './assets';
import { gradientMap, sunFor, skyFor, fogFor, PALETTE } from './toon';

/* ============================================================
   المشهد

   القيم المستمرّة (الوقت، الطقس) تُطبَّق داخل حلقة الإطار على
   المراجع مباشرة — لا عبر حالة React. سحب المسطرة يحرّك الشمس
   والسماء والضباب بلا إعادة رسم شجرة المكوّنات، فيبقى السحب
   ناعماً مهما كثر ما في المشهد.

   والقيم المتقطّعة (نمط المباني، المفاتيح، قائمة الأصول) تُقرأ
   بالاشتراك المعتاد، لأنها تتغيّر بالضغطة لا بالكسر العشري.
   ============================================================ */

const ROAD_HALF = 4.6;
const WALK_W = 2.6;
const ROAD_LEN = WORLD_BOUNDS * 2.2;

// مولّد عشوائي بذرته ثابتة: نفس المشهد في كل فتح، وهو شرط
// أن يكون «العالم المحفوظ» هو نفسه العالم الذي تراه عند الاسترجاع
const rng = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};

// ── السماء ──────────────────────────────────────────────────

const SKY_VERT = `
    varying vec3 vDir;
    void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// قبّة متدرّجة مرسومة بالشيدر بدل سماء فيزيائية: نتحكّم بالألوان
// بالكامل فتبقى ضمن لوحة الأنمي، وقرص الشمس جزء من التدرّج نفسه.
const SKY_FRAG = `
    uniform vec3 uTop;
    uniform vec3 uBottom;
    uniform vec3 uSun;
    uniform vec3 uSunDir;
    varying vec3 vDir;

    void main() {
        float h = vDir.y * 0.5 + 0.5;
        vec3 col = mix(uBottom, uTop, smoothstep(0.34, 0.78, h));

        float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);

        // هالة واسعة ناعمة، وقرص حادّ الحافة في مركزها
        col += uSun * pow(d, 7.0) * 0.42;
        col += uSun * smoothstep(0.9975, 0.9990, d) * 1.5;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
    }
`;

const Sky = () => {
    const mat = useRef();

    const uniforms = useMemo(() => ({
        uTop: { value: new THREE.Color('#4C9FE0') },
        uBottom: { value: new THREE.Color('#CFEBFF') },
        uSun: { value: new THREE.Color('#FFF8DA') },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }
    }), []);

    useFrame(() => {
        const { timeOfDay, climate } = useWorld.getState().environment;
        const sky = skyFor(timeOfDay, climate);
        const sun = sunFor(timeOfDay);

        const u = mat.current.uniforms;
        u.uTop.value.set(sky.top);
        u.uBottom.value.set(sky.bottom);
        u.uSun.value.set(sky.sun);
        u.uSunDir.value.set(...sun.position).normalize();
    });

    return (
        <mesh scale={[-1, 1, 1]} frustumCulled={false}>
            <sphereGeometry args={[430, 24, 16]} />
            <shaderMaterial
                ref={mat}
                uniforms={uniforms}
                vertexShader={SKY_VERT}
                fragmentShader={SKY_FRAG}
                depthWrite={false}
                fog={false}
                side={THREE.BackSide}
            />
        </mesh>
    );
};

// ── الشمس والإضاءة والضباب ──────────────────────────────────

const Sun = () => {
    const light = useRef();
    const ambient = useRef();
    const { scene } = useThree();

    useLayoutEffect(() => {
        scene.fog = new THREE.FogExp2('#CFEBFF', 0.002);
        return () => { scene.fog = null; };
    }, [scene]);

    useFrame(() => {
        const { timeOfDay, climate } = useWorld.getState().environment;
        const sky = skyFor(timeOfDay, climate);
        const sun = sunFor(timeOfDay);

        // قرص الشمس في السماء يغيب تحت الأفق فعلاً، أما مصدر الضوء فلا:
        // ضوء اتجاهي من تحت الأرض يُنير المجسمات من أسفلها ويقلب الظلال.
        // نُبقيه فوق الأفق بقليل — فتطول الظلال كما يليق بالغروب — ونُخفت
        // شدّته بحسب ارتفاع الشمس الحقيقي حتى يحلّ الليل على مهل.
        const [sx, sy, sz] = sun.position;
        const dusk = THREE.MathUtils.clamp((sy + 10) / 26, 0.06, 1);

        light.current.position.set(sx, Math.max(sy, 2.5), sz);
        light.current.color.set(sky.light);
        light.current.intensity = sky.intensity * dusk;

        ambient.current.color.set(sky.top);
        ambient.current.intensity = sky.ambient;

        const fog = fogFor(timeOfDay, climate, sky.bottom);
        if (scene.fog) {
            scene.fog.color.set(fog.color);
            scene.fog.density = fog.density;
        }
    });

    return (
        <>
            <directionalLight
                ref={light}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0006}
                shadow-normalBias={0.03}
                shadow-camera-near={1}
                shadow-camera-far={340}
                shadow-camera-left={-85}
                shadow-camera-right={85}
                shadow-camera-top={85}
                shadow-camera-bottom={-85}
            />
            <ambientLight ref={ambient} />
        </>
    );
};

// ── الغيوم ──────────────────────────────────────────────────

const Clouds = () => {
    const group = useRef();

    const puffs = useMemo(() => {
        const r = rng(7331);
        return Array.from({ length: 9 }, () => {
            const x = (r() - 0.5) * 300;
            const y = 48 + r() * 34;
            const z = (r() - 0.5) * 300;
            const s = 6 + r() * 7;
            return {
                x, y, z, s,
                lobes: Array.from({ length: 4 }, () => ({
                    dx: (r() - 0.5) * 2.1,
                    dy: (r() - 0.5) * 0.5,
                    dz: (r() - 0.5) * 1.3,
                    sc: 0.55 + r() * 0.5
                })),
                drift: 0.5 + r() * 0.8
            };
        });
    }, []);

    useFrame((_, dt) => {
        group.current.children.forEach((cloud, i) => {
            cloud.position.x += puffs[i].drift * dt;
            if (cloud.position.x > 170) cloud.position.x = -170;
        });
    });

    return (
        <group ref={group}>
            {puffs.map((c, i) => (
                <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
                    {c.lobes.map((l, j) => (
                        <mesh key={j} position={[l.dx, l.dy, l.dz]} scale={l.sc}>
                            <icosahedronGeometry args={[1, 0]} />
                            <meshToonMaterial
                                color="#FFFFFF"
                                gradientMap={gradientMap()}
                                flatShading
                                fog={false}
                            />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
};

// ── الأرض والطريق ───────────────────────────────────────────

const Ground = () => {
    const place = useWorld(s => s.place);
    const select = useWorld(s => s.select);

    const onDown = (e) => {
        const { placementType } = useWorld.getState();
        if (!placementType) { select(null); return; }

        e.stopPropagation();
        place(placementType, +e.point.x.toFixed(2), +e.point.z.toFixed(2));
    };

    // الخطّ المتقطّع في منتصف الطريق
    const dashes = useMemo(() => {
        const out = [];
        for (let z = -ROAD_LEN / 2; z < ROAD_LEN / 2; z += 8) out.push(z);
        return out;
    }, []);

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={onDown}>
                <planeGeometry args={[520, 520]} />
                <meshToonMaterial color={PALETTE.grass} gradientMap={gradientMap()} />
            </mesh>

            {/* الطريق ورصيفاه مرفوعة قليلاً لتجنّب تزاحم العمق مع الأرض */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                <planeGeometry args={[ROAD_HALF * 2, ROAD_LEN]} />
                <meshToonMaterial color={PALETTE.road} gradientMap={gradientMap()} />
            </mesh>

            {[-1, 1].map(side => (
                <mesh
                    key={side}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[side * (ROAD_HALF + WALK_W / 2), 0.04, 0]}
                    receiveShadow
                >
                    <planeGeometry args={[WALK_W, ROAD_LEN]} />
                    <meshToonMaterial color={PALETTE.sidewalk} gradientMap={gradientMap()} />
                </mesh>
            ))}

            {dashes.map(z => (
                <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, z]}>
                    <planeGeometry args={[0.28, 3.4]} />
                    <meshBasicMaterial color={PALETTE.roadLine} />
                </mesh>
            ))}
        </group>
    );
};

// ── الأشجار المكرّرة (instancing) ────────────────────────────
// عدد كبير من الأشجار برسمتين فقط بدل رسمة لكل شجرة

const FOLIAGE_MAX = 300;

/** مجموعة شجر واحدة: جذوع وتيجان يتقاسمان نفس المواضع والترتيب */
const FoliageGroup = ({ items, count, crown, crownColor, crownY }) => {
    // عناصر النسخ ثابتة، ولا يتغيّر مع المسطرة إلا range — وإلا أعدنا
    // بناء ثلاثمئة عنصر React في كل كسر عشري أثناء السحب
    const trunks = useMemo(() => items.map((it, i) => (
        <Instance key={i} position={[it.x, it.s, it.z]} scale={it.s} rotation={[0, it.rot, 0]} />
    )), [items]);

    const crowns = useMemo(() => items.map((it, i) => (
        <Instance key={i} position={[it.x, it.s * crownY, it.z]} scale={it.s} rotation={[0, it.rot, 0]} />
    )), [items, crownY]);

    return (
        <>
            <Instances limit={items.length} range={count} castShadow receiveShadow>
                <cylinderGeometry args={[0.22, 0.3, 2, 6]} />
                <meshToonMaterial color={PALETTE.trunk} gradientMap={gradientMap()} />
                {trunks}
            </Instances>

            <Instances limit={items.length} range={count} castShadow receiveShadow>
                {crown}
                <meshToonMaterial color={crownColor} gradientMap={gradientMap()} flatShading />
                {crowns}
            </Instances>
        </>
    );
};

const Foliage = () => {
    const density = useWorld(s => s.environment.foliageDensity);

    // نوعان منفصلان منذ التوليد: الجذع وتاجه في نفس الفهرس من نفس
    // المصفوفة، وإلا ظهرت جذوع بلا تيجان حين تُقلَّص الكثافة
    const { pines, rounds } = useMemo(() => {
        const r = rng(20260918);
        const pines = [];
        const rounds = [];

        for (let i = 0; i < FOLIAGE_MAX; i++) {
            const side = r() > 0.5 ? 1 : -1;
            const item = {
                // نُبعدها عن الطريق وعن شريط البيوت حتى لا تتداخل معهما
                x: side * (19 + r() * 46),
                z: (r() - 0.5) * ROAD_LEN,
                s: 0.75 + r() * 0.7,
                rot: r() * Math.PI * 2
            };
            (r() > 0.45 ? pines : rounds).push(item);
        }
        return { pines, rounds };
    }, []);

    return (
        <group>
            <FoliageGroup
                items={pines}
                count={Math.round(pines.length * density)}
                crown={<coneGeometry args={[1.35, 3.4, 7]} />}
                crownColor={PALETTE.pine}
                crownY={3.1}
            />
            <FoliageGroup
                items={rounds}
                count={Math.round(rounds.length * density)}
                crown={<icosahedronGeometry args={[1.5, 0]} />}
                crownColor={PALETTE.leaf}
                crownY={3}
            />
        </group>
    );
};

// ── الكيانات المتحرّكة ──────────────────────────────────────

const TRAFFIC_LANES = [
    { x: -2.3, dir: 1, speed: 9 },
    { x: 2.3, dir: -1, speed: 11 }
];

const Traffic = () => {
    const on = useWorld(s => s.entities.traffic);
    const group = useRef();

    const cars = useMemo(() => {
        const r = rng(4242);
        return Array.from({ length: 6 }, (_, i) => {
            const lane = TRAFFIC_LANES[i % 2];
            return {
                lane,
                z: (r() - 0.5) * ROAD_LEN,
                speed: lane.speed * (0.85 + r() * 0.35),
                type: r() > 0.75 ? 'van' : 'car'
            };
        });
    }, []);

    useFrame((_, dt) => {
        if (!on || !group.current) return;

        group.current.children.forEach((car, i) => {
            const c = cars[i];
            car.position.z += c.lane.dir * c.speed * dt;

            // لفّ دائري: الخارج من طرف يدخل من الطرف المقابل
            const limit = ROAD_LEN / 2;
            if (car.position.z > limit) car.position.z = -limit;
            if (car.position.z < -limit) car.position.z = limit;
        });
    });

    if (!on) return null;

    return (
        // المركبات المتحرّكة بلا حدود محيطة: الحركة تُخفيها، والمقابل رسمات مضاعفة
        <OutlineContext.Provider value={false}>
            <group ref={group}>
                {cars.map((c, i) => (
                    <group
                        key={i}
                        position={[c.lane.x, 0, c.z]}
                        rotation={[0, c.lane.dir > 0 ? 0 : Math.PI, 0]}
                        scale={0.92}
                    >
                        <Asset type={c.type} />
                    </group>
                ))}
            </group>
        </OutlineContext.Provider>
    );
};

const NPC_COLORS = ['#E06C75', '#61AFEF', '#E5C07B', '#98C379', '#C678DD', '#56B6C2'];

const NPCs = () => {
    const on = useWorld(s => s.entities.npcs);
    const group = useRef();

    const walkers = useMemo(() => {
        const r = rng(909);
        return Array.from({ length: 10 }, () => {
            const side = r() > 0.5 ? 1 : -1;
            return {
                x: side * (ROAD_HALF + 0.5 + r() * (WALK_W - 0.9)),
                z: (r() - 0.5) * ROAD_LEN,
                dir: r() > 0.5 ? 1 : -1,
                speed: 1.5 + r() * 1.4,
                color: NPC_COLORS[Math.floor(r() * NPC_COLORS.length)],
                phase: r() * Math.PI * 2
            };
        });
    }, []);

    useFrame((state, dt) => {
        if (!on || !group.current) return;
        const t = state.clock.elapsedTime;

        group.current.children.forEach((npc, i) => {
            const w = walkers[i];
            npc.position.z += w.dir * w.speed * dt;

            const limit = ROAD_LEN / 2;
            if (npc.position.z > limit) npc.position.z = -limit;
            if (npc.position.z < -limit) npc.position.z = limit;

            // نطّة خفيفة تقرأ كمشي دون هيكل عظمي
            npc.position.y = Math.abs(Math.sin(t * w.speed * 2.1 + w.phase)) * 0.12;
        });
    });

    if (!on) return null;

    return (
        <group ref={group}>
            {walkers.map((w, i) => (
                <group key={i} position={[w.x, 0, w.z]} rotation={[0, w.dir > 0 ? 0 : Math.PI, 0]}>
                    <mesh position={[0, 0.62, 0]} castShadow>
                        <capsuleGeometry args={[0.24, 0.62, 4, 8]} />
                        <meshToonMaterial color={w.color} gradientMap={gradientMap()} />
                    </mesh>
                    <mesh position={[0, 1.34, 0]} castShadow>
                        <sphereGeometry args={[0.25, 10, 8]} />
                        <meshToonMaterial color={PALETTE.skin} gradientMap={gradientMap()} />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

// ── الأصول الموضوعة ────────────────────────────────────────

// نمط المباني يبدّل العائلة المعمارية كاملة، لا كثافتها فقط
const STYLE_SWAP = {
    suburban: { tower: 'house', shop: 'cottage' },
    urban: { house: 'tower', cottage: 'shop' }
};

const Placed = () => {
    const placed = useWorld(s => s.placed);
    const selectedId = useWorld(s => s.selectedId);
    const style = useWorld(s => s.environment.buildingStyle);
    const select = useWorld(s => s.select);

    const swap = STYLE_SWAP[style] || {};

    return (
        <group>
            {placed.map(item => {
                const type = swap[item.type] || item.type;
                const isSelected = item.id === selectedId;

                return (
                    <group
                        key={item.id}
                        position={[item.x, 0, item.z]}
                        rotation={[0, item.rotation || 0, 0]}
                        scale={item.scale || 1}
                        onPointerDown={(e) => {
                            if (useWorld.getState().placementType) return;
                            e.stopPropagation();
                            select(item.id);
                        }}
                    >
                        <Asset type={type} />

                        {isSelected && (
                            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
                                <ringGeometry args={[2.4, 3.1, 28]} />
                                <meshBasicMaterial color="#FBAB15" transparent opacity={0.85} side={THREE.DoubleSide} />
                            </mesh>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

// ── الكاميرا ────────────────────────────────────────────────

/**
 * تتبع هدف الكاميرا القادم من محرّر العقد، بانتقال ناعم لا قفز،
 * مع الحفاظ على زاوية الدوران التي اختارها المستخدم بالفأرة.
 */
const Rig = () => {
    const controls = useRef();
    const { camera } = useThree();
    const desired = useRef(new THREE.Vector3(0, 0, 34));
    const offset = useRef(new THREE.Vector3(0, 14, 26));

    useFrame(() => {
        if (!controls.current) return;

        const t = useWorld.getState().cameraTarget;
        desired.current.set(t.x, 0, t.z);

        const target = controls.current.target;

        // الإزاحة الحالية بين الكاميرا وهدفها هي زاوية المستخدم — نحفظها
        if (target.distanceTo(desired.current) < 0.05) {
            offset.current.copy(camera.position).sub(target);
            return;
        }

        target.lerp(desired.current, 0.07);
        camera.position.copy(target).add(offset.current);
        controls.current.update();
    });

    return (
        <OrbitControls
            ref={controls}
            makeDefault
            enablePan={false}
            minDistance={10}
            maxDistance={120}
            maxPolarAngle={Math.PI / 2.14}
            target={[0, 0, 34]}
        />
    );
};

// ── المعالجة البصرية ───────────────────────────────────────

const Effects = () => {
    const heavy = useWorld(s => s.environment.heavyShading);

    return (
        <EffectComposer enableNormalPass={heavy} multisampling={0}>
            {/* عتبة إضاءة عالية: تتوهّج الشمس والغيوم والأنوار، لا المشهد كلّه */}
            <Bloom intensity={0.42} luminanceThreshold={0.86} luminanceSmoothing={0.25} mipmapBlur />

            {heavy ? (
                <SSAO
                    blendFunction={BlendFunction.MULTIPLY}
                    samples={12}
                    radius={0.08}
                    intensity={18}
                    luminanceInfluence={0.55}
                    worldDistanceThreshold={45}
                    worldDistanceFalloff={12}
                    worldProximityThreshold={4}
                    worldProximityFalloff={1}
                />
            ) : null}

            <Vignette eskil={false} offset={0.24} darkness={0.55} />
        </EffectComposer>
    );
};

// ============================================================

const WorldScene = () => {
    const outlines = useWorld(s => s.environment.outlines !== false);

    return (
        <OutlineContext.Provider value={outlines}>
            <Sky />
            <Sun />
            <Clouds />
            <Ground />
            <Foliage />
            <Placed />
            <Traffic />
            <NPCs />
            <Rig />
            <Effects />
        </OutlineContext.Provider>
    );
};

export default WorldScene;
