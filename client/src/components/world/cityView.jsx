import React, { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useWorld } from './worldStore';
import { Asset, OutlineContext } from './assets';
import { PALETTE } from './toon';
import { heightAt } from './terrain';
import { nightFactor } from './districts';
import { BLOCK, ROAD, LANE, SIDEWALK, CITY_SPAN } from './city';

/* ============================================================
   رسم المدينة

   الشوارع ليست بلاطات متجاورة بل أربع طبقات مدموجة، كل واحدة
   هندسة واحدة:

     ١) صفيحة إسفلت تغطّي المدينة كلّها
     ٢) الأرصفة: صفيحة لكل مربّع سكني مع هامشه، مدموجة في واحدة
     ٣) أرض المربّعات فوق الرصيف
     ٤) خطوط المسارب

   التقاطع هو ما فرض هذا الترتيب: شريطان متقاطعان في نفس الارتفاع
   يتزاحمان على العمق فيرتجف السطح. فنفرش الإسفلت تحت الجميع ونرفع
   المربّعات فوقه — فلا يلتقي سطحان في مستوى واحد أبداً.

   وكل رأس في هذه الطبقات منسدل على ارتفاع الأرض تحته، فالمدينة
   تتبع التضاريس كما يفعل الإسفلت.
   ============================================================ */

const STEP = 6;          // متر بين رؤوس الصفائح — دقّة انسدالها
const ASPHALT_LIFT = 0.05;
const MARK_LIFT = 0.10;
const WALK_LIFT = 0.16;
const YARD_LIFT = 0.22;

/**
 * يبني هندسة واحدة من مستطيلات منسدلة على الأرض.
 *
 * غير مفهرسة عمداً: الدمج أبسط، والمكسب من الفهرسة هنا ضئيل أمام
 * ثمن بناء جدول الرؤوس المشتركة لآلاف المربّعات.
 */
const drapedSheet = (rects, lift, step = STEP) => {
    const positions = [];
    const normals = [];
    const uvs = [];

    const push = (x, z) => {
        positions.push(x, heightAt(x, z) + lift, z);
        normals.push(0, 1, 0);
        uvs.push(x / 8, z / 8);
    };

    for (const r of rects) {
        const w = r.x1 - r.x0;
        const d = r.z1 - r.z0;
        const nx = Math.max(1, Math.round(w / step));
        const nz = Math.max(1, Math.round(d / step));

        for (let j = 0; j < nz; j++) {
            const z0 = r.z0 + (d * j) / nz;
            const z1 = r.z0 + (d * (j + 1)) / nz;

            for (let i = 0; i < nx; i++) {
                const x0 = r.x0 + (w * i) / nx;
                const x1 = r.x0 + (w * (i + 1)) / nx;

                push(x0, z0); push(x0, z1); push(x1, z1);
                push(x0, z0); push(x1, z1); push(x1, z0);
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
};

/** طبقة صفيحة واحدة — بخامة كرتونية أو فيزيائية بحسب النمط */
const Sheet = ({ geometry, color, basic = false, ...rest }) => {
    const style = useWorld(s => s.environment.renderStyle || 'toon');

    return (
        <mesh geometry={geometry} receiveShadow={!basic} {...rest}>
            {basic
                ? <meshBasicMaterial color={color} />
                : style === 'real'
                    ? <meshStandardMaterial color={color} roughness={0.95} />
                    : <meshToonMaterial color={color} />}
        </mesh>
    );
};

// ── أرض المدينة ─────────────────────────────────────────────

const CityGround = ({ city }) => {
    const revision = useWorld(s => s.terrainRevision);

    const sheets = useMemo(() => {
        const half = city.span / 2;

        // ١) الإسفلت: صفيحة واحدة تحت المدينة كلّها
        const asphalt = drapedSheet([{ x0: -half, z0: -half, x1: half, z1: half }], ASPHALT_LIFT, 8);

        // ٢) الأرصفة ثم ٣) أفنية المربّعات
        const walks = [];
        const yards = [];

        for (const b of city.blocks) {
            walks.push({
                x0: b.x0 - SIDEWALK, z0: b.z0 - SIDEWALK,
                x1: b.x1 + SIDEWALK, z1: b.z1 + SIDEWALK
            });
            yards.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 });
        }

        // ٤) خطّ منتصف متقطّع على كل شارع
        const marks = [];
        for (const road of city.roads) {
            for (let t = -half + 3; t < half - 3; t += 9) {
                marks.push(road.axis === 'x'
                    ? { x0: road.at - 0.16, z0: t, x1: road.at + 0.16, z1: t + 4.2 }
                    : { x0: t, z0: road.at - 0.16, x1: t + 4.2, z1: road.at + 0.16 });
            }
        }

        // حوافّ الرصيف: شريط أفتح على طرف الإسفلت يفصله عن الرصيف
        const curbs = [];
        for (const road of city.roads) {
            for (const side of [-1, 1]) {
                const at = road.at + side * LANE;
                curbs.push(road.axis === 'x'
                    ? { x0: at - 0.22, z0: -half, x1: at + 0.22, z1: half }
                    : { x0: -half, z0: at - 0.22, x1: half, z1: at + 0.22 });
            }
        }

        return {
            asphalt,
            walks: drapedSheet(walks, WALK_LIFT, 8),
            yards: drapedSheet(yards, YARD_LIFT, 10),
            marks: drapedSheet(marks, MARK_LIFT, 6),
            curbs: drapedSheet(curbs, MARK_LIFT, 10)
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [city, revision]);

    useEffect(() => () => {
        Object.values(sheets).forEach(g => g.dispose());
    }, [sheets]);

    return (
        <group>
            <Sheet geometry={sheets.asphalt} color={PALETTE.road} />
            <Sheet geometry={sheets.curbs} color="#8C9099" basic />
            <Sheet geometry={sheets.marks} color={PALETTE.roadLine} basic />
            <Sheet geometry={sheets.walks} color={PALETTE.sidewalk} />
            <Sheet geometry={sheets.yards} color="#7FA65A" />
        </group>
    );
};

// ── المباني ─────────────────────────────────────────────────

/**
 * محتوى مربّع سكني واحد.
 *
 * التقسيم على المربّعات هو ما يجعل القصّ بالمسافة ممكناً: إخفاء
 * ستّ وثلاثين مجموعة أرخص من اختبار ألف مجسم، والمشهد يتخطّى
 * الشجرة المخفيّة وما تحتها كلّه دفعةً واحدة.
 *
 * والمقارنة بمربّع المسافة لا بجذرها: جذر تربيعي ستّاً وثلاثين مرّة
 * في كل إطار ثمنٌ بلا مقابل.
 */
const Block = ({ block, buildings, props, cars, hiddenId, overrides, night, rangeRef }) => {
    const ref = useRef();
    const shown = useRef(true);

    useFrame(({ camera }) => {
        const g = ref.current;
        if (!g) return;

        const dx = camera.position.x - block.cx;
        const dz = camera.position.z - block.cz;
        const range = rangeRef.current;

        const near = dx * dx + dz * dz < range * range;
        if (near !== shown.current) {
            shown.current = near;
            g.visible = near;
        }
    });

    return (
        <group ref={ref}>
            {buildings.map(b => (
                <group key={b.id} position={[b.x, b.y, b.z]} rotation={[0, b.rotation, 0]} scale={b.scale}>
                    <Asset type={b.type} night={night} seed={b.seed} />
                </group>
            ))}

            {props.map(p => (
                <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.rotation, 0]} scale={p.scale}>
                    <Asset type={p.type} />
                </group>
            ))}

            {cars.filter(c => c.id !== hiddenId).map(c => (
                <group key={c.id} position={[c.x, c.y, c.z]} rotation={[0, c.rotation, 0]}>
                    <Asset type={c.type} body={c.color} simple />
                </group>
            ))}
        </group>
    );
};

/**
 * يوزّع المخطّط على مربّعاته.
 *
 * مرّة واحدة لكل مخطّط: المرور على ألف عنصر في كل إطار بحثاً عمّا
 * يقع في مربّع هو نفس الكلفة التي نهرب منها.
 */
const groupByBlock = (city, overrides, revision) => {
    const size = BLOCK + ROAD;
    const half = city.span / 2;

    const indexOf = (x, z) => {
        const bx = Math.min(city.grid - 1, Math.max(0, Math.floor((x + half) / size)));
        const bz = Math.min(city.grid - 1, Math.max(0, Math.floor((z + half) / size)));
        return bz * city.grid + bx;
    };

    const cells = city.blocks.map(block => ({ block, buildings: [], props: [], cars: [] }));

    for (const b of city.buildings) {
        cells[indexOf(b.x, b.z)].buildings.push({ ...b, y: heightAt(b.x, b.z) });
    }
    for (const p of city.props) {
        cells[indexOf(p.x, p.z)].props.push({ ...p, y: heightAt(p.x, p.z) });
    }
    for (const c of city.cars) {
        const at = overrides?.[c.id] ? { ...c, ...overrides[c.id] } : c;
        cells[indexOf(at.x, at.z)].cars.push({ ...at, y: heightAt(at.x, at.z) });
    }

    // بذرة معدّات السطح: ثابتة لكل مبنى فلا تتبدّل حين يُعاد الرسم
    let seed = 0;
    for (const cell of cells) for (const b of cell.buildings) b.seed = ++seed;

    return cells;
};

const Blocks = ({ city, night, hiddenId, overrides }) => {
    const revision = useWorld(s => s.terrainRevision);
    const viewDistance = useWorld(s => s.environment.viewDistance || 170);

    // المدى يُقرأ من مرجع داخل الحلقة: تغييره بالمسطرة لا يُعيد
    // بناء ستّ وثلاثين مجموعة مع كل كسر عشري
    const rangeRef = useRef(viewDistance);
    rangeRef.current = viewDistance;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const cells = useMemo(() => groupByBlock(city, overrides, revision), [city, overrides, revision]);

    return (
        <group>
            {cells.map(cell => (
                <Block
                    key={`${cell.block.bx}_${cell.block.bz}`}
                    {...cell}
                    night={night}
                    hiddenId={hiddenId}
                    rangeRef={rangeRef}
                />
            ))}
        </group>
    );
};

// ── التجميع ─────────────────────────────────────────────────

const City = ({ city, hiddenCarId = null, overrides = null }) => {
    const hour = useWorld(s => s.environment.timeOfDay);

    // شدّة الليل مقسّمة إلى أربع درجات: تتدرّج مع الغروب، ولا
    // تُعيد رسم مئتي مبنى مع كل كسر عشري تسحبه في المسطرة
    const night = useMemo(() => Math.round(nightFactor(hour) * 4) / 4, [hour]);

    if (!city) return null;

    return (
        // المدينة كلّها بلا حدود محيطة.
        //
        // الحدّ المحيط قطعةٌ ثانية لكل قطعة — مجسم مقلوب الوجوه أكبر
        // قليلاً — فهو يُضاعف ما يُرسَم حرفياً. يليق بمجسم قريب
        // تُحدّق فيه، لا بمئتي مبنى في الخلفية.
        <OutlineContext.Provider value={false}>
            <group>
                <CityGround city={city} />
                <Blocks city={city} night={night} hiddenId={hiddenCarId} overrides={overrides} />
            </group>
        </OutlineContext.Provider>
    );
};

export default City;
