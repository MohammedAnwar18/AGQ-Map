import React, { useRef, useMemo, useLayoutEffect, useCallback, Suspense, lazy } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Instances, Instance, Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, SSAO } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

import { useWorld, WORLD_BOUNDS, live, input } from './worldStore';
import { Asset, OutlineContext, StyleContext, Surface, footprintOf } from './assets';
import { gradientMap, sunFor, skyFor, fogFor, PALETTE } from './toon';
import { Terrain, Water, BrushRing } from './terrainView';
import { heightAt, TERRAIN_SPAN } from './terrain';
import City from './cityView';
import { cityPlan, districtAt, buildSolidIndex, CITY_SPAN, BLOCK, ROAD, LANE, SIDEWALK } from './city';

/** خطّة المدينة الجارية — مشتركة بين كل ما يسأل عنها */
export const useCity = () => {
    const city = useWorld(s => s.city);
    return useMemo(() => cityPlan(city), [city]);
};

/**
 * طبقة الفيزياء مؤجّلة الجلب.
 *
 * حزمة Rapier ثقيلة (محرّك مكتوب بـ Rust ومُصرَّف إلى WebAssembly)،
 * فلا تُطلب إلا لحظة تشغيل المفتاح. من يفتح المحرّر ليبني مشهداً
 * ساكناً لا ينتظرها ولا يُنزّلها.
 */
const PhysicsLayer = lazy(() => import('./physics'));

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
                            <Surface color="#FFFFFF" flat fog={false} roughness={1} />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
};

// ── الأرض والطريق ───────────────────────────────────────────

const Ground = ({ onBrushMove }) => {
    const place = useWorld(s => s.place);
    const select = useWorld(s => s.select);
    const showRoad = useWorld(s => s.environment.defaultRoad !== false);

    const onDown = (e) => {
        const { placementType, mode, brush } = useWorld.getState();

        // في وضع المشي السحب على المشهد نظر لا وضع؛ الخريطة هي من تضع
        if (mode !== 'orbit') return;

        // الفرشاة تعمل داخل المساحة المنحوتة وحدها: ضربة على السهل
        // البعيد لا تفعل شيئاً، ولا يجوز أن تُفسَّر وضعاً أو إلغاء تحديد
        if (brush.tool) return;
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
            {/* السهل البعيد: ما وراء المساحة القابلة للنحت. مغروز
                تحتها بستّة سنتيمترات فلا يتزاحم معها على العمق حين
                تكون الأرض مستوية. */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.06, 0]}
                receiveShadow
                onPointerDown={onDown}
            >
                <planeGeometry args={[520, 520]} />
                <Surface color={PALETTE.grass} />
            </mesh>

            <Terrain onBrushMove={onBrushMove} />

            {showRoad && <DefaultRoad dashes={dashes} />}
        </group>
    );
};

/**
 * صفيحة تنسدل على التضاريس.
 *
 * الطريق المستوي فوق أرض متموّجة يترك حافّته معلّقة في الهواء؛
 * فنُقسّم الصفيحة ونُنزل كل رأس فيها على ارتفاع الأرض تحته، فتتبع
 * الأرض كما يفعل الإسفلت. تُعاد عند تغيّر التضاريس لا في كل إطار.
 */
const DrapedStrip = ({ w, d, x = 0, lift, color }) => {
    const revision = useWorld(s => s.terrainRevision);

    const geometry = useMemo(() => {
        const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(d / 3)));
        g.rotateX(-Math.PI / 2);

        const pos = g.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
            pos[i + 1] = heightAt(pos[i] + x, pos[i + 2]) + lift;
        }
        g.computeVertexNormals();
        return g;
    }, [w, d, x, lift, revision]);

    useLayoutEffect(() => () => geometry.dispose(), [geometry]);

    return (
        <mesh geometry={geometry} position={[x, 0, 0]} receiveShadow>
            <Surface color={color} />
        </mesh>
    );
};

/** الطريق المبنيّ في المشهد — يُطفأ لمن يرسم شبكته ببلاطاته */
const DefaultRoad = ({ dashes }) => {
    const revision = useWorld(s => s.terrainRevision);

    return (
        <group>
            {/* مرفوعة قليلاً لتجنّب تزاحم العمق مع الأرض */}
            <DrapedStrip w={ROAD_HALF * 2} d={ROAD_LEN} lift={0.03} color={PALETTE.road} />

            {[-1, 1].map(side => (
                <DrapedStrip
                    key={side}
                    w={WALK_W}
                    d={ROAD_LEN}
                    x={side * (ROAD_HALF + WALK_W / 2)}
                    lift={0.06}
                    color={PALETTE.sidewalk}
                />
            ))}

            {dashes.map(z => (
                <mesh
                    key={`${z}_${revision}`}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, heightAt(0, z) + 0.07, z]}
                >
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
        <Instance key={i} position={[it.x, it.y + it.s, it.z]} scale={it.s} rotation={[0, it.rot, 0]} />
    )), [items]);

    const crowns = useMemo(() => items.map((it, i) => (
        <Instance key={i} position={[it.x, it.y + it.s * crownY, it.z]} scale={it.s} rotation={[0, it.rot, 0]} />
    )), [items, crownY]);

    return (
        <>
            <Instances limit={items.length} range={count} castShadow receiveShadow>
                <cylinderGeometry args={[0.22, 0.3, 2, 6]} />
                <Surface color={PALETTE.trunk} />
                {trunks}
            </Instances>

            <Instances limit={items.length} range={count} castShadow receiveShadow>
                {crown}
                <Surface color={crownColor} flat />
                {crowns}
            </Instances>
        </>
    );
};

const Foliage = () => {
    const density = useWorld(s => s.environment.foliageDensity);
    const revision = useWorld(s => s.terrainRevision);
    const hasCity = useWorld(s => s.city.enabled);

    // نوعان منفصلان منذ التوليد: الجذع وتاجه في نفس الفهرس من نفس
    // المصفوفة، وإلا ظهرت جذوع بلا تيجان حين تُقلَّص الكثافة
    const { pines, rounds } = useMemo(() => {
        const r = rng(20260918);
        const pines = [];
        const rounds = [];

        for (let i = 0; i < FOLIAGE_MAX; i++) {
            const side = r() > 0.5 ? 1 : -1;
            // مع المدينة يصير الشجر ريفاً حولها لا داخلها: حزام بين
            // آخر مربّع سكني وحافّة العالم. وبلا مدينة يبقى كما كان،
            // شريطين على جانبي الطريق الجاهز.
            let x;
            let z;

            if (hasCity) {
                const inner = CITY_SPAN / 2 + 6;
                const outer = WORLD_BOUNDS + 34;
                const ring = inner + r() * (outer - inner);
                const angle = r() * Math.PI * 2;

                // مربّع لا دائرة: الحزام يتبع شكل المدينة المربّع
                const edge = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
                x = edge ? Math.sign(Math.cos(angle)) * ring : (r() - 0.5) * 2 * outer;
                z = edge ? (r() - 0.5) * 2 * outer : Math.sign(Math.sin(angle)) * ring;
            } else {
                // نُبعدها عن الطريق وعن شريط البيوت حتى لا تتداخل معهما
                x = side * (19 + r() * 46);
                z = (r() - 0.5) * ROAD_LEN;
            }

            const item = {
                x,
                z,
                y: heightAt(x, z),   // الشجرة تنبت من الأرض لا من المستوى صفر
                s: 0.75 + r() * 0.7,
                rot: r() * Math.PI * 2
            };
            (r() > 0.45 ? pines : rounds).push(item);
        }
        return { pines, rounds };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revision, hasCity]);

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

const TRAFFIC_PAINT = ['#D45B4A', '#4E8FC0', '#E8C15A', '#EDEDED', '#5B9B6E', '#2F3742'];

/**
 * حركة المرور.
 *
 * مع المدينة تسير المركبات على شبكة شوارعها: لكل مركبة شارع ومسرب
 * واتجاه، وتلفّ من طرفه إلى طرفه. وبلا مدينة تعود إلى الشريط
 * المستقيم الذي كان — فمن أطفأ المدينة لم يفقد الحركة.
 *
 * والمركبة تميل مع ميل الأرض تحتها: السيارة الأفقية فوق منحدر أوّل
 * ما تلتقطه العين خطأً.
 */
const Traffic = () => {
    const on = useWorld(s => s.entities.traffic);
    const city = useCity();
    const group = useRef();

    const cars = useMemo(() => {
        const r = rng(4242);

        if (!city) {
            return Array.from({ length: 6 }, (_, i) => {
                const lane = TRAFFIC_LANES[i % 2];
                return {
                    axis: 'z', at: lane.x, dir: lane.dir,
                    speed: lane.speed * (0.85 + r() * 0.35),
                    start: (r() - 0.5) * ROAD_LEN,
                    limit: ROAD_LEN / 2,
                    type: r() > 0.75 ? 'van' : 'car',
                    color: TRAFFIC_PAINT[i % TRAFFIC_PAINT.length]
                };
            });
        }

        const half = city.span / 2;
        return Array.from({ length: 18 }, (_, i) => {
            const road = city.roads[Math.floor(r() * city.roads.length)];
            const dir = r() > 0.5 ? 1 : -1;

            // المسرب الأيمن باتجاه السير — كما تُقاد السيارة فعلاً
            const lane = dir > 0 ? LANE * 0.45 : -LANE * 0.45;
            const roll = r();

            return {
                axis: road.axis === 'x' ? 'z' : 'x',
                at: road.at + (road.axis === 'x' ? lane : -lane),
                dir,
                speed: 7 + r() * 7,
                start: (r() - 0.5) * 2 * half,
                limit: half,
                type: roll > 0.9 ? 'bus' : roll > 0.78 ? 'van' : roll > 0.66 ? 'pickup' : 'car',
                color: TRAFFIC_PAINT[Math.floor(r() * TRAFFIC_PAINT.length)]
            };
        });
    }, [city]);

    useFrame((_, dt) => {
        if (!on || !group.current) return;

        group.current.children.forEach((car, i) => {
            const c = cars[i];
            if (!c) return;

            const axis = c.axis;
            car.position[axis] += c.dir * c.speed * dt;

            // لفّ دائري: الخارج من طرف يدخل من الطرف المقابل
            if (car.position[axis] > c.limit) car.position[axis] = -c.limit;
            if (car.position[axis] < -c.limit) car.position[axis] = c.limit;

            // محاذاة السطح: تتبع ميل الأرض تحتها بدل أن تبقى أفقية
            const x = car.position.x;
            const z = car.position.z;
            car.position.y = heightAt(x, z);

            const fx = axis === 'x' ? c.dir * 2.4 : 0;
            const fz = axis === 'z' ? c.dir * 2.4 : 0;
            const ahead = heightAt(x + fx, z + fz);
            const behind = heightAt(x - fx, z - fz);
            car.rotation.x = -Math.atan2(ahead - behind, 4.8);
        });
    });

    if (!on) return null;

    // زاوية الرأس: المجسم ينظر إلى ‎+Z‎، فنُديره نحو اتجاه سيره
    const headingOf = (c) => (c.axis === 'z'
        ? (c.dir > 0 ? 0 : Math.PI)
        : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2));

    return (
        // المركبات المتحرّكة بلا حدود محيطة: الحركة تُخفيها، والمقابل رسمات مضاعفة
        <OutlineContext.Provider value={false}>
            <group ref={group}>
                {cars.map((c, i) => (
                    <group
                        key={i}
                        position={[c.axis === 'x' ? c.start : c.at, 0, c.axis === 'z' ? c.start : c.at]}
                        // ترتيب YXZ: الميل يُطبَّق في إطار السيارة بعد
                        // دورانها، وإلا مالت في اتجاه العالم لا اتجاهها
                        rotation-order="YXZ"
                        rotation-y={headingOf(c)}
                        scale={0.92}
                    >
                        <Asset type={c.type} body={c.color} simple />
                    </group>
                ))}
            </group>
        </OutlineContext.Provider>
    );
};

const SHIRT = ['#E06C75', '#61AFEF', '#E5C07B', '#98C379', '#C678DD', '#56B6C2', '#D19A66'];
const PANTS = ['#3B4252', '#4C566A', '#2E3440', '#5E6472'];
const HAIR = ['#2B2118', '#4A3527', '#6B4A2F', '#1C1612', '#8A6B45'];
const SKIN = ['#F0C39A', '#E0AC83', '#C68B62', '#8D5C3D'];

/**
 * مارّ.
 *
 * جسد مفصّل بأطراف تتأرجح: الكتلة الواحدة المتحرّكة تُقرأ كعلبة تنزلق،
 * والساق التي تتقدّم والذراع التي تقابلها هما ما يجعل المشي مشياً.
 * كل مارّ يحمل حلقته الخاصّة — الموضع والخطوة معاً — فلا يقود المكوّن
 * الأب عشرة أجساد من مكان واحد.
 */
const Pedestrian = ({ seed, lane = null }) => {
    const group = useRef();
    const legL = useRef();
    const legR = useRef();
    const armL = useRef();
    const armR = useRef();

    const self = useMemo(() => {
        const r = rng(seed);
        const side = r() > 0.5 ? 1 : -1;

        // مع المدينة يمشون على أرصفتها، وبلا مدينة على رصيف الطريق
        // الجاهز كما كانوا
        let x;
        let z;
        let axis = 'z';

        if (lane) {
            axis = lane.axis;
            const at = lane.at + (r() - 0.5) * (SIDEWALK - 1.1);
            const along = (r() - 0.5) * lane.length;
            x = axis === 'x' ? along : at;
            z = axis === 'x' ? at : along;
        } else {
            x = side * (ROAD_HALF + 0.6 + r() * (WALK_W - 1.0));
            z = (r() - 0.5) * ROAD_LEN;
        }

        return {
            x, z, axis,
            limit: lane ? lane.length / 2 : ROAD_LEN / 2,
            dir: r() > 0.5 ? 1 : -1,
            speed: 1.3 + r() * 1.3,
            phase: r() * Math.PI * 2,
            height: 0.92 + r() * 0.16,
            shirt: SHIRT[Math.floor(r() * SHIRT.length)],
            pants: PANTS[Math.floor(r() * PANTS.length)],
            hair: HAIR[Math.floor(r() * HAIR.length)],
            skin: SKIN[Math.floor(r() * SKIN.length)],
            bag: r() > 0.62
        };
    }, [seed, lane]);

    useFrame((state, dt) => {
        const g = group.current;
        if (!g) return;

        g.position[self.axis] += self.dir * self.speed * dt;

        if (g.position[self.axis] > self.limit) g.position[self.axis] = -self.limit;
        if (g.position[self.axis] < -self.limit) g.position[self.axis] = self.limit;

        // تردّد الخطوة يتبع السرعة: السريع يخطو أكثر لا أوسع فقط
        const t = state.clock.elapsedTime * self.speed * 3.1 + self.phase;
        const swing = Math.sin(t) * 0.62;

        legL.current.rotation.x = swing;
        legR.current.rotation.x = -swing;
        armL.current.rotation.x = -swing * 0.72;
        armR.current.rotation.x = swing * 0.72;

        // ارتفاع الجسم يعلو مرّتين في كل دورة — عند كل خطوة، فوق
        // ارتفاع الأرض تحته لا فوق المستوى صفر
        g.position.y = heightAt(g.position.x, g.position.z) + Math.abs(Math.cos(t)) * 0.045;
    });

    const s = self.height;

    return (
        <group
            ref={group}
            position={[self.x, 0, self.z]}
            rotation={[0, self.axis === 'x'
                ? (self.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
                : (self.dir > 0 ? 0 : Math.PI), 0]}
            scale={s}
        >
            {/* الساقان: المحور عند الورك والقطعة معلّقة تحته */}
            {[[legL, -0.11], [legR, 0.11]].map(([ref, x], i) => (
                <group key={i} ref={ref} position={[x, 0.82, 0]}>
                    <mesh position={[0, -0.36, 0]} castShadow>
                        <boxGeometry args={[0.17, 0.72, 0.19]} />
                        <Surface color={self.pants} />
                    </mesh>
                    <mesh position={[0, -0.74, 0.04]} castShadow>
                        <boxGeometry args={[0.19, 0.1, 0.29]} />
                        <Surface color="#2A2E36" roughness={0.6} />
                    </mesh>
                </group>
            ))}

            {/* الجذع */}
            <mesh position={[0, 1.13, 0]} castShadow>
                <boxGeometry args={[0.43, 0.62, 0.25]} />
                <Surface color={self.shirt} />
            </mesh>

            {/* الذراعان */}
            {[[armL, -0.29], [armR, 0.29]].map(([ref, x], i) => (
                <group key={i} ref={ref} position={[x, 1.4, 0]}>
                    <mesh position={[0, -0.26, 0]} castShadow>
                        <boxGeometry args={[0.13, 0.52, 0.14]} />
                        <Surface color={self.shirt} />
                    </mesh>
                    <mesh position={[0, -0.57, 0]} castShadow>
                        <boxGeometry args={[0.12, 0.13, 0.13]} />
                        <Surface color={self.skin} />
                    </mesh>
                </group>
            ))}

            {/* الرقبة والرأس والشعر */}
            <mesh position={[0, 1.49, 0]} castShadow>
                <cylinderGeometry args={[0.07, 0.08, 0.1, 7]} />
                <Surface color={self.skin} />
            </mesh>
            <mesh position={[0, 1.66, 0]} castShadow>
                <boxGeometry args={[0.26, 0.28, 0.25]} />
                <Surface color={self.skin} />
            </mesh>
            <mesh position={[0, 1.78, -0.01]} castShadow>
                <boxGeometry args={[0.28, 0.13, 0.27]} />
                <Surface color={self.hair} roughness={0.95} />
            </mesh>

            {self.bag && (
                <mesh position={[0, 1.16, -0.2]} castShadow>
                    <boxGeometry args={[0.32, 0.4, 0.16]} />
                    <Surface color="#4C566A" />
                </mesh>
            )}
        </group>
    );
};

const NPCs = () => {
    const on = useWorld(s => s.entities.npcs);
    const city = useCity();

    // مسارات المشي: خطّ على كل جانب من كل شارع، في منتصف رصيفه
    const lanes = useMemo(() => {
        if (!city) return null;

        const out = [];
        for (const road of city.roads) {
            for (const side of [-1, 1]) {
                out.push({
                    axis: road.axis === 'x' ? 'z' : 'x',
                    at: road.at + side * (LANE + SIDEWALK * 0.5),
                    length: city.span
                });
            }
        }
        return out;
    }, [city]);

    const walkers = useMemo(() => {
        const count = lanes ? 26 : 10;
        return Array.from({ length: count }, (_, i) => ({
            seed: 909 + i * 137,
            lane: lanes ? lanes[(i * 7) % lanes.length] : null
        }));
    }, [lanes]);

    if (!on) return null;

    return (
        <group>
            {walkers.map((w, i) => <Pedestrian key={i} seed={w.seed} lane={w.lane} />)}
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

    // نقرأ العدّاد كي يُعاد الرسم بعد سحبة نحت: البيت يجب أن ينزل
    // مع الحفرة تحته لا أن يبقى معلّقاً في الهواء
    useWorld(s => s.terrainRevision);

    const swap = STYLE_SWAP[style] || {};

    return (
        <group>
            {placed.map(item => {
                const type = swap[item.type] || item.type;
                const isSelected = item.id === selectedId;

                return (
                    <group
                        key={item.id}
                        position={[item.x, heightAt(item.x, item.z), item.z]}
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

const EYE_HEIGHT = 1.68;
const WALK_SPEED = 6.4;
const RUN_SPEED = 12;
const BODY_RADIUS = 0.5;

/**
 * منظور الشخص الأوّل.
 *
 * الحركة تُقرأ من كائن `input` لا من حالة React، فالضغط على المفتاح
 * لا يُعيد رسم شيء. والموضع يُكتب في `live` ليقرأه المصغّر في حلقته
 * الخاصّة — الخريطة تتحرّك معك بلا وسيط.
 */
const Walker = () => {
    const { camera } = useThree();
    const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
    const pos = useRef(new THREE.Vector3());
    const dir = useRef(new THREE.Vector3());

    // نبدأ من حيث كانت الكاميرا، فلا يقفز المشهد لحظة التبديل
    useLayoutEffect(() => {
        const t = useWorld.getState().cameraTarget;
        pos.current.set(t.x, EYE_HEIGHT, t.z + 6);

        // نتّجه نحو مركز المشهد لا نحو الأفق عشوائياً
        euler.current.set(0, Math.atan2(t.x - pos.current.x, t.z - pos.current.z), 0);
        camera.position.copy(pos.current);
        camera.quaternion.setFromEuler(euler.current);
    }, [camera]);

    useFrame((_, dt) => {
        const step = Math.min(dt, 0.05);   // لقطة طويلة لا تقذف المشاهد عبر جدار

        // النظر
        euler.current.y -= input.yaw;
        euler.current.x = THREE.MathUtils.clamp(euler.current.x - input.pitch, -1.35, 1.35);
        input.yaw = 0;
        input.pitch = 0;
        camera.quaternion.setFromEuler(euler.current);

        // الحركة على المستوى الأفقي فقط: النظر لأعلى لا يرفعك عن الأرض
        const speed = (input.run ? RUN_SPEED : WALK_SPEED) * step;
        dir.current.set(input.strafe, 0, -input.forward);

        if (dir.current.lengthSq() > 0) {
            dir.current.normalize().applyAxisAngle(UP, euler.current.y).multiplyScalar(speed);

            const next = pos.current.clone().add(dir.current);
            resolveCollisions(next);

            const limit = WORLD_BOUNDS + 40;
            next.x = THREE.MathUtils.clamp(next.x, -limit, limit);
            next.z = THREE.MathUtils.clamp(next.z, -limit, limit);

            pos.current.copy(next);
            live.moving = true;
        } else {
            live.moving = false;
        }

        pos.current.y = EYE_HEIGHT + groundAt(pos.current.x, pos.current.z);
        camera.position.copy(pos.current);

        live.x = pos.current.x;
        live.z = pos.current.z;
        live.heading = euler.current.y;
    });

    return null;
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * يدفع المشاهد خارج أي مجسم صلب بدل أن يعبره.
 *
 * مباني المدينة تمرّ عبر فهرس مكاني لا عبر حلقة على ثلاثمئة مبنى:
 * السؤال يتكرّر ستّين مرّة في الثانية، والفهرس يُجيبه من تسع خلايا.
 */
const resolveCollisions = (next) => {
    const { placed, environment } = useWorld.getState();
    const swap = STYLE_SWAP[environment.buildingStyle] || {};

    const push = (cx, cz, radius) => {
        const dx = next.x - cx;
        const dz = next.z - cz;
        const min = radius + BODY_RADIUS;
        const distSq = dx * dx + dz * dz;

        if (distSq < min * min && distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            next.x = cx + (dx / dist) * min;
            next.z = cz + (dz / dist) * min;
        }
    };

    for (const item of placed) {
        const radius = footprintOf(swap[item.type] || item.type) * (item.scale || 1);
        if (radius) push(item.x, item.z, radius);
    }

    const index = citySolids();
    if (index) {
        for (const solid of index.near(next.x, next.z)) push(solid.x, solid.z, solid.radius);
    }
};

/**
 * فهرس صلبة المدينة.
 *
 * يُبنى مرّة لكل مخطّط ويُحفظ: المشي يسأله في كل إطار، وبناؤه في كل
 * سؤال يعني المرور على المدينة كلّها ستّين مرّة في الثانية.
 */
let solidCache = null;

export const citySolids = () => {
    const plan = cityPlan(useWorld.getState().city);
    if (!plan) return null;

    if (!solidCache || solidCache.plan !== plan) {
        solidCache = {
            plan,
            index: buildSolidIndex(
                [...plan.buildings, ...plan.props, ...plan.cars],
                (item) => footprintOf(item.type) * (item.scale || 1)
            )
        };
    }
    return solidCache.index;
};

/** ارتفاع الأرض عند نقطة — حقل التضاريس أوّلاً ثم قباب التلال فوقه */
const groundAt = (x, z) => {
    const { placed } = useWorld.getState();
    let height = heightAt(x, z);

    for (const item of placed) {
        if (item.type !== 'hill') continue;

        const r = 5.4 * (item.scale || 1);
        const d = Math.hypot(x - item.x, z - item.z);
        if (d >= r) continue;

        // قبّة كروية فوق الأرض المنحوتة، لا فوق المستوى صفر
        const dome = heightAt(item.x, item.z) + Math.sqrt(Math.max(0, r * r - d * d));
        height = Math.max(height, dome);
    }
    return height;
};

/**
 * تتبع هدف الكاميرا القادم من محرّر العقد، بانتقال ناعم لا قفز،
 * مع الحفاظ على زاوية الدوران التي اختارها المستخدم بالفأرة.
 */
const Rig = () => {
    const controls = useRef();
    const { camera } = useThree();

    // السحب بالفرشاة والسحب لتدوير الكاميرا حركة واحدة بإصبع واحد:
    // لو بقي الدوران مفتوحاً لدار المشهد مع كل ضربة نحت. OrbitControls
    // تستمع للوحة مباشرةً فلا يُوقفها stopPropagation على حدث R3F.
    const sculpting = useWorld(s => Boolean(s.brush.tool));
    const desired = useRef(new THREE.Vector3(0, 0, 34));
    const offset = useRef(new THREE.Vector3(0, 14, 26));

    useFrame(() => {
        if (!controls.current) return;

        const t = useWorld.getState().cameraTarget;
        desired.current.set(t.x, 0, t.z);

        const target = controls.current.target;

        // الخريطة تتابع الكاميرا في وضع التحرير كما تتابع المشاة في المشي
        live.x = target.x;
        live.z = target.z;
        live.heading = Math.atan2(target.x - camera.position.x, target.z - camera.position.z);

        // الإزاحة الحالية بين الكاميرا وهدفها هي زاوية المستخدم — نحفظها
        if (target.distanceTo(desired.current) < 0.05) {
            offset.current.copy(camera.position).sub(target);
            live.moving = false;
            return;
        }

        target.lerp(desired.current, 0.07);
        camera.position.copy(target).add(offset.current);
        controls.current.update();
        live.moving = true;
    });

    return (
        <OrbitControls
            ref={controls}
            makeDefault
            enableRotate={!sculpting}
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

/**
 * إضاءة البيئة للنمط الواقعي.
 *
 * الخامات الفيزيائية تحتاج ما تعكسه: بدونها يبدو المعدن طلاءً باهتاً
 * والزجاج لوحاً مصمتاً. نبنيها من مصادر ضوء مرسومة هنا لا من ملف HDRI
 * يُنزَّل من الإنترنت — لا انتظار ولا اعتماد على شبكة.
 *
 * المفتاح مربوط بساعة تقريبية: تتجدّد مع تقدّم النهار ولا تُعاد في كل إطار.
 */
const WorldEnvironment = () => {
    const hour = useWorld(s => Math.round(s.environment.timeOfDay));
    const climate = useWorld(s => Math.round(s.environment.climate * 3));

    const sky = skyFor(hour, climate / 3);
    const sun = sunFor(hour);

    return (
        <Environment key={`${hour}_${climate}`} resolution={128}>
            {/* القبّة: لون السماء من فوق والأفق من الجانب */}
            <Lightformer form="rect" intensity={1.1} color={sky.top}
                position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
            <Lightformer form="ring" intensity={0.55} color={sky.bottom}
                position={[0, 0, -14]} scale={[26, 10, 1]} />
            <Lightformer form="ring" intensity={0.55} color={sky.bottom}
                position={[0, 0, 14]} rotation={[0, Math.PI, 0]} scale={[26, 10, 1]} />

            {/* قرص الشمس: مصدر الوهج الحادّ في الانعكاسات */}
            <Lightformer
                form="circle" intensity={4.5} color={sky.sun}
                position={sun.position.map(v => (v / 120) * 16)}
                scale={5}
            />
        </Environment>
    );
};

const WorldScene = ({ hiddenCarId = null, carOverrides = null }) => {
    const outlines = useWorld(s => s.environment.outlines !== false);
    const style = useWorld(s => s.environment.renderStyle || 'toon');
    const mode = useWorld(s => s.mode);
    const physicsOn = useWorld(s => s.physics.enabled);
    const city = useCity();

    // موضع الفرشاة يتغيّر مع كل حركة مؤشّر: مرجع لا حالة، وإلا أعدنا
    // رسم المشهد كلّه لأجل حلقة تتحرّك
    const brushPoint = useRef({ x: 0, z: 0 });
    const onBrushMove = useCallback((x, z) => {
        brushPoint.current.x = x;
        brushPoint.current.z = z;
    }, []);

    return (
        <StyleContext.Provider value={style}>
        <OutlineContext.Provider value={outlines}>
            {style === 'real' && <WorldEnvironment />}
            <Sky />
            <Sun />
            <Clouds />
            <Ground onBrushMove={onBrushMove} />
            {city && <City city={city} hiddenCarId={hiddenCarId} overrides={carOverrides} />}
            <Water />
            <BrushRing pointRef={brushPoint} />
            <Foliage />
            <Placed />
            <Traffic />
            <NPCs />

            {/* الكاميرا: مدارية في التحرير، عين في المشي، ومتابِعة في
                القيادة — والأخيرة تعيش داخل طبقة الفيزياء */}
            {mode === 'walk' && <Walker />}
            {mode === 'orbit' && <Rig />}

            {physicsOn && (
                <Suspense fallback={null}>
                    <PhysicsLayer />
                </Suspense>
            )}

            <Effects />
        </OutlineContext.Provider>
        </StyleContext.Provider>
    );
};

export default WorldScene;
