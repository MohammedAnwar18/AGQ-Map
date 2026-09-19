import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

import { useWorld } from './worldStore';
import { Surface } from './assets';
import { PALETTE, skyFor, sunFor } from './toon';
import {
    field, heightAt, sculptAt,
    TERRAIN_SPAN, TERRAIN_GRID, TERRAIN_CELL
} from './terrain';

/* ============================================================
   طبقة الأرض والماء

   ثلاثة مكوّنات تتقاسم حقل الارتفاعات نفسه:

     Terrain — الشبكة المرئية. ترفع رؤوسها من الحقل، وتُلوّن كل رأس
               بحسب ارتفاعه وميله: عشب على المستوي، صخر على المنحدر،
               رمل على حافّة الماء. التلوين في الرؤوس لا في صورة،
               فلا خامة تُنزَّل ولا إحداثيات تُرسم.

     Water   — سطح متموّج بمعادلة Gerstner داخل الشيدر: إزاحة رؤوس
               لا محاكاة سوائل. كل رأس يحمل عمق الماء تحته محسوباً
               على المعالج، فيختفي السطح حيث ترتفع الأرض فوقه —
               وهكذا تمتلئ الحفرة وحدها بلا أن نرسم لها حوضاً.

     Brush   — حلقة تُظهر مدى الفرشاة قبل أن تضرب.

   النحت يجري في حلقة الإطار بالزمن الحقيقي (dt) لا بحدث المؤشّر،
   فسرعة النحت واحدة على جهاز بطيء وسريع.
   ============================================================ */

const VERTS = TERRAIN_GRID * TERRAIN_GRID;
const HALF = TERRAIN_SPAN / 2;

// ── ألوان الأرض ─────────────────────────────────────────────

const COLORS = {
    grass: new THREE.Color(PALETTE.grass),
    grassDark: new THREE.Color(PALETTE.grassDark),
    rock: new THREE.Color('#8F8A7C'),
    dirt: new THREE.Color('#A98B5F'),
    sand: new THREE.Color('#D9C79B')
};

const tmpColor = new THREE.Color();

// ── شبكة الأرض ──────────────────────────────────────────────

/** يبني الهندسة مرّة: مواضع وفهارس ثابتة، والارتفاع يُحدَّث لاحقاً */
const buildTerrainGeometry = () => {
    const positions = new Float32Array(VERTS * 3);
    const normals = new Float32Array(VERTS * 3);
    const colors = new Float32Array(VERTS * 3);
    const uvs = new Float32Array(VERTS * 2);

    for (let iz = 0; iz < TERRAIN_GRID; iz++) {
        for (let ix = 0; ix < TERRAIN_GRID; ix++) {
            const i = iz * TERRAIN_GRID + ix;
            positions[i * 3] = ix * TERRAIN_CELL - HALF;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = iz * TERRAIN_CELL - HALF;

            normals[i * 3 + 1] = 1;

            uvs[i * 2] = ix / (TERRAIN_GRID - 1);
            uvs[i * 2 + 1] = iz / (TERRAIN_GRID - 1);
        }
    }

    const cells = TERRAIN_GRID - 1;
    const indices = new Uint32Array(cells * cells * 6);
    let p = 0;

    for (let iz = 0; iz < cells; iz++) {
        for (let ix = 0; ix < cells; ix++) {
            const a = iz * TERRAIN_GRID + ix;
            const b = a + 1;
            const c = a + TERRAIN_GRID;
            const d = c + 1;

            indices[p++] = a; indices[p++] = c; indices[p++] = b;
            indices[p++] = b; indices[p++] = c; indices[p++] = d;
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), TERRAIN_SPAN);
    return geometry;
};

/**
 * يرفع الرؤوس ويحسب النواظم والألوان من الحقل.
 *
 * النواظم محسوبة تحليلياً من فرق الارتفاعات لا بـ computeVertexNormals:
 * الأخيرة تمرّ على كل مثلّث وتجمع، وهذا ثلاثة أضعاف العمل لنتيجة
 * أخشن على شبكة منتظمة كهذه.
 */
const syncTerrainGeometry = (geometry, waterOn, waterLevel) => {
    const pos = geometry.attributes.position.array;
    const nor = geometry.attributes.normal.array;
    const col = geometry.attributes.color.array;
    const h = field.heights;

    const at = (ix, iz) => h[
        (iz < 0 ? 0 : iz > TERRAIN_GRID - 1 ? TERRAIN_GRID - 1 : iz) * TERRAIN_GRID +
        (ix < 0 ? 0 : ix > TERRAIN_GRID - 1 ? TERRAIN_GRID - 1 : ix)
    ];

    const shore = waterOn ? waterLevel : -Infinity;

    for (let iz = 0; iz < TERRAIN_GRID; iz++) {
        for (let ix = 0; ix < TERRAIN_GRID; ix++) {
            const i = iz * TERRAIN_GRID + ix;
            const y = h[i];
            pos[i * 3 + 1] = y;

            // الناظم من الفروق المركزية
            const dx = at(ix + 1, iz) - at(ix - 1, iz);
            const dz = at(ix, iz + 1) - at(ix, iz - 1);
            const ny = 2 * TERRAIN_CELL;
            const len = Math.hypot(-dx, ny, -dz) || 1;

            nor[i * 3] = -dx / len;
            nor[i * 3 + 1] = ny / len;
            nor[i * 3 + 2] = -dz / len;

            // الميل: صفر على المستوي، واحد على الجدار
            const steep = 1 - nor[i * 3 + 1];

            // عشب يغمق قليلاً في المنخفضات — تباين يقرؤه العين كعمق
            tmpColor.copy(COLORS.grass).lerp(
                COLORS.grassDark,
                THREE.MathUtils.clamp(0.35 - y * 0.035, 0, 0.6)
            );

            // الصخر يظهر حيث لا يثبت التراب
            if (steep > 0.06) {
                tmpColor.lerp(COLORS.dirt, THREE.MathUtils.clamp((steep - 0.06) * 5, 0, 1));
            }
            if (steep > 0.18) {
                tmpColor.lerp(COLORS.rock, THREE.MathUtils.clamp((steep - 0.18) * 4, 0, 1));
            }

            // شاطئ رملي على حافّة الماء — الانتقال من العشب للماء
            // مباشرةً يُقرأ كقصّ لا كضفّة
            if (y < shore + 1.4) {
                const t = THREE.MathUtils.clamp((shore + 1.4 - y) / 1.9, 0, 1);
                tmpColor.lerp(COLORS.sand, t * 0.85);
            }

            col[i * 3] = tmpColor.r;
            col[i * 3 + 1] = tmpColor.g;
            col[i * 3 + 2] = tmpColor.b;
        }
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
};

/**
 * الأرض القابلة للنحت — وهي أيضاً سطح الالتقاط لوضع المجسمات.
 *
 * نقرة واحدة تحمل معنيين بحسب الحال: فرشاة مُختارة تعني نحتاً،
 * وبلا فرشاة تعني وضعاً أو إلغاء تحديد كما كان قبل هذه الطبقة.
 */
export const Terrain = ({ onBrushMove }) => {
    const meshRef = useRef();
    const geometry = useMemo(buildTerrainGeometry, []);

    const place = useWorld(s => s.place);
    const select = useWorld(s => s.select);
    const bumpTerrain = useWorld(s => s.bumpTerrain);

    const water = useWorld(s => s.terrain.water);
    const waterLevel = useWorld(s => s.terrain.waterLevel);

    // آخر مراجعة رُفعت إلى كرت الرسم، وحالة السحبة الجارية
    const synced = useRef(-1);
    const shading = useRef({ water, waterLevel });
    shading.current = { water, waterLevel };

    // نشترك في العدّاد بلا أن نقرأه: إعادة الرسم بعد كل سحبة هي
    // ما يجعل إلقاء الظلّ يتبدّل حين تُصبح الأرض غير مستوية
    useWorld(s => s.terrainRevision);

    const stroke = useRef(null);

    useEffect(() => () => geometry.dispose(), [geometry]);

    // تغيّر مستوى الماء يُغيّر لون الشاطئ، فنُجبر إعادة التلوين
    useEffect(() => { synced.current = -1; }, [water, waterLevel]);

    // السحبة تنتهي أينما رُفع الإصبع، ولو خارج المشهد
    useEffect(() => {
        const end = () => {
            if (!stroke.current) return;
            stroke.current = null;
            // نُعلم بقيّة المشهد مرّة واحدة عند نهاية السحبة: الهياكل
            // الفيزيائية والمجسمات تُعاد مواءمتها هنا لا في كل إطار
            bumpTerrain();
        };
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', end);
        return () => {
            window.removeEventListener('pointerup', end);
            window.removeEventListener('pointercancel', end);
        };
    }, [bumpTerrain]);

    useFrame((_, dt) => {
        const s = stroke.current;
        if (s) {
            const { brush } = useWorld.getState();
            sculptAt(s.x, s.z, {
                tool: brush.tool,
                radius: brush.radius,
                strength: brush.strength,
                level: s.level,
                dt
            });
        }

        if (synced.current !== field.revision) {
            synced.current = field.revision;
            syncTerrainGeometry(geometry, shading.current.water, shading.current.waterLevel);
        }
    });

    const onDown = (e) => {
        const { placementType, mode, brush } = useWorld.getState();
        if (mode !== 'orbit') return;   // داخل العالم السحب نظر لا تحرير

        if (brush.tool) {
            e.stopPropagation();
            stroke.current = {
                x: e.point.x,
                z: e.point.z,
                // «التسوية» تحتاج هدفاً ثابتاً طوال السحبة، وإلا زحف
                // المستوى مع الفرشاة ولم يستوِ شيء
                level: heightAt(e.point.x, e.point.z)
            };
            return;
        }

        if (!placementType) { select(null); return; }

        e.stopPropagation();
        place(placementType, +e.point.x.toFixed(2), +e.point.z.toFixed(2));
    };

    const onMove = (e) => {
        if (stroke.current) {
            stroke.current.x = e.point.x;
            stroke.current.z = e.point.z;
        }
        onBrushMove?.(e.point.x, e.point.z);
    };

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            receiveShadow
            // أرض مستوية لا تُلقي ظلاً على شيء، وإلحاقها بمرور الظلال
            // يعني اثنين وثلاثين ألف مثلّث تُرسم مرّتين بلا مقابل
            castShadow={field.touched}
            onPointerDown={onDown}
            onPointerMove={onMove}
        >
            <Surface color="#ffffff" vertexColors roughness={0.97} />
        </mesh>
    );
};

// ── الماء ───────────────────────────────────────────────────

const WATER_SEGMENTS = 128;

const WATER_VERT = /* glsl */`
    uniform float uTime;
    uniform float uAmp;

    attribute float aDepth;

    varying float vDepth;
    varying vec3 vNormalW;
    varying vec3 vWorld;

    #include <fog_pars_vertex>

    /**
     * موجة Gerstner واحدة.
     *
     * ليست جيباً في الارتفاع فقط: الرأس يتحرّك أفقياً أيضاً نحو قمّة
     * الموجة، فتصير القمم حادّة والبطون عريضة — وهو ما يُميّز شكل
     * الماء الحقيقي عن قماش يتموّج.
     *
     * والمشتقّات تُجمع هنا نفسها، فالناظم محسوب تحليلياً لا مُخمَّناً.
     */
    void addWave(
        vec2 p, vec2 dir, float wavelength, float steepness,
        inout vec3 offset, inout vec3 tangent, inout vec3 binormal
    ) {
        vec2 d = normalize(dir);
        float k = 6.28318530718 / wavelength;
        float c = sqrt(9.81 / k);
        float f = k * (dot(d, p) - c * uTime);
        float a = steepness / k;

        float sf = sin(f);
        float cf = cos(f);

        offset += vec3(d.x * a * cf, a * sf, d.y * a * cf);

        tangent += vec3(
            -d.x * d.x * steepness * sf,
             d.x * steepness * cf,
            -d.x * d.y * steepness * sf
        );
        binormal += vec3(
            -d.x * d.y * steepness * sf,
             d.y * steepness * cf,
            -d.y * d.y * steepness * sf
        );
    }

    void main() {
        vDepth = aDepth;

        vec3 p = position;
        vec2 xz = p.xz;

        // الموجة تخفت في الضحل: الماء قرب الشاطئ أهدأ، وبلا ذلك
        // تخترق القمم الأرض عند الحافّة
        float shallow = clamp(aDepth / 2.2, 0.0, 1.0);
        float amp = uAmp * shallow;

        vec3 offset = vec3(0.0);
        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 0.0, 1.0);

        // ثلاث موجات متقاطعة الاتجاه: موجة واحدة تُقرأ كقماش مشدود،
        // والتقاطع هو ما يُعطي السطح عشوائيته
        addWave(xz, vec2(1.0, 0.35), 17.0, 0.42 * amp, offset, tangent, binormal);
        addWave(xz, vec2(-0.6, 1.0), 9.5, 0.30 * amp, offset, tangent, binormal);
        addWave(xz, vec2(0.25, -1.0), 5.0, 0.20 * amp, offset, tangent, binormal);

        p += offset;

        vNormalW = normalize(cross(binormal, tangent));

        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;

        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;

        #include <fog_vertex>
    }
`;

const WATER_FRAG = /* glsl */`
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uSun;
    uniform vec3 uSunDir;
    uniform vec3 uCamera;
    uniform float uTime;

    varying float vDepth;
    varying vec3 vNormalW;
    varying vec3 vWorld;

    #include <fog_pars_fragment>

    void main() {
        // خارج الحوض لا ماء: الأرض هناك أعلى من مستوى السطح
        if (vDepth <= 0.02) discard;

        vec3 normal = normalize(vNormalW);
        vec3 view = normalize(uCamera - vWorld);

        vec3 base = mix(uShallow, uDeep, clamp(vDepth / 4.5, 0.0, 1.0));

        // فرينل: الماء مرآة عند النظر المائل وشفّاف من فوق
        float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);
        base = mix(base, uSun * 0.7, fresnel * 0.5);

        // بريق الشمس على القمم
        vec3 halfway = normalize(uSunDir + view);
        float spec = pow(max(dot(normal, halfway), 0.0), 90.0);
        base += uSun * spec * 1.4;

        // زبد رفيع على الحافّة يُخفي خطّ التقاء الماء بالأرض
        float foam = smoothstep(0.5, 0.06, vDepth) * 0.65;
        base = mix(base, vec3(1.0), foam);

        float alpha = mix(0.35, 0.92, clamp(vDepth / 1.6, 0.0, 1.0));
        alpha = max(alpha, foam);

        gl_FragColor = vec4(base, alpha);

        #include <fog_fragment>
    }
`;

/**
 * سطح الماء.
 *
 * منسوب واحد للعالم كلّه لا حوض لكل بركة: هكذا تعمل المياه الجوفية
 * فعلاً — تحفر تحت المنسوب فيمتلئ، وترفع الأرض فوقه فينحسر. وهذا
 * أيضاً ما يجعل «احفر واملأ ماءً» ضربة فرشاة واحدة لا رسم حوض.
 */
export const Water = () => {
    const on = useWorld(s => s.terrain.water);
    const level = useWorld(s => s.terrain.waterLevel);
    const waveHeight = useWorld(s => s.terrain.waveHeight);

    const matRef = useRef();
    const synced = useRef(-1);
    const lastSync = useRef(0);

    const geometry = useMemo(() => {
        const g = new THREE.PlaneGeometry(TERRAIN_SPAN, TERRAIN_SPAN, WATER_SEGMENTS, WATER_SEGMENTS);
        g.rotateX(-Math.PI / 2);
        g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
        return g;
    }, []);

    const uniforms = useMemo(() => ({
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: { value: 0 },
        uAmp: { value: 1 },
        uShallow: { value: new THREE.Color('#5FD3D8') },
        uDeep: { value: new THREE.Color('#12506E') },
        uSun: { value: new THREE.Color('#FFF3C8') },
        uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
        uCamera: { value: new THREE.Vector3() }
    }), []);

    useEffect(() => () => geometry.dispose(), [geometry]);
    useEffect(() => { synced.current = -1; lastSync.current = 0; }, [level, on]);

    useFrame((state, dt) => {
        if (!on) return;

        // عمق الماء تحت كل رأس — يُحسب على المعالج فلا نحتاج قراءة
        // خامة داخل شيدر الرؤوس، وهي عملية لا تُضمن على كل جهاز.
        //
        // ومخنوق بعُشر ثانية: أثناء سحبة النحت تتغيّر الأرض في كل
        // إطار، وستّة عشر ألف استيفاء ستّين مرّة في الثانية ثمن
        // باهظ لتأخّر لا تراه العين.
        const now = state.clock.elapsedTime;
        if (synced.current !== field.revision && now - lastSync.current > 0.1) {
            synced.current = field.revision;
            lastSync.current = now;

            const pos = geometry.attributes.position.array;
            const depth = geometry.attributes.aDepth.array;
            for (let i = 0; i < depth.length; i++) {
                depth[i] = level - heightAt(pos[i * 3], pos[i * 3 + 2]);
            }
            geometry.attributes.aDepth.needsUpdate = true;
        }

        const u = matRef.current?.uniforms;
        if (!u) return;

        u.uTime.value += dt;
        u.uAmp.value = waveHeight;
        u.uCamera.value.copy(state.camera.position);

        const { timeOfDay, climate } = useWorld.getState().environment;
        const sky = skyFor(timeOfDay, climate);
        u.uSun.value.set(sky.sun);
        u.uSunDir.value.set(...sunFor(timeOfDay).position).normalize();

        // الماء يعكس السماء: أزرق ظهيرة وبرتقالي غروب وأسود ليل
        u.uShallow.value.set(sky.bottom).lerp(new THREE.Color('#3FBFC8'), 0.55);
        u.uDeep.value.set(sky.top).lerp(new THREE.Color('#0C4463'), 0.6);
    });

    if (!on) return null;

    return (
        <mesh geometry={geometry} position={[0, level, 0]} renderOrder={2}>
            <shaderMaterial
                ref={matRef}
                uniforms={uniforms}
                vertexShader={WATER_VERT}
                fragmentShader={WATER_FRAG}
                transparent
                fog
                depthWrite={false}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
};

// ── حلقة الفرشاة ────────────────────────────────────────────

const TOOL_TONE = {
    raise: '#4ADE80',
    lower: '#F97316',
    flatten: '#38BDF8',
    smooth: '#C084FC',
    dig: '#22D3EE'
};

/** تُظهر مدى الفرشاة ومركزها قبل الضربة — النحت أعمى بدونها */
export const BrushRing = ({ pointRef }) => {
    const group = useRef();
    const tool = useWorld(s => s.brush.tool);
    const radius = useWorld(s => s.brush.radius);

    useFrame(() => {
        const g = group.current;
        if (!g) return;
        const p = pointRef.current;
        g.position.set(p.x, heightAt(p.x, p.z) + 0.25, p.z);
    });

    if (!tool) return null;

    return (
        <group ref={group}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius * 0.94, radius, 64]} />
                <meshBasicMaterial color={TOOL_TONE[tool] || '#38BDF8'} transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius * 0.42, radius * 0.46, 48]} />
                <meshBasicMaterial color={TOOL_TONE[tool] || '#38BDF8'} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};
