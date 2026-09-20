import React, { useMemo, useEffect } from 'react';
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
 * مبانٍ ثابتة لا تُحدَّد ولا تُنقل.
 *
 * منفصلة عن ‎Placed‎ عمداً: تلك للمجسمات التي يضعها المستخدم بيده
 * ويحرّكها ويحذفها، وهذه خلفية مولّدة من بذرة. خلطهما يعني أن كل
 * نقرة على المشهد تمرّ على ثلاثمئة مبنى تبحث عمّا نُقِر.
 */
const Buildings = ({ city, night }) => {
    const revision = useWorld(s => s.terrainRevision);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const items = useMemo(() => city.buildings.map((b, i) => ({
        ...b, y: heightAt(b.x, b.z), seed: i + 1
    })), [city, revision]);

    return (
        <group>
            {items.map(b => (
                <group key={b.id} position={[b.x, b.y, b.z]} rotation={[0, b.rotation, 0]} scale={b.scale}>
                    <Asset type={b.type} night={night} seed={b.seed} />
                </group>
            ))}
        </group>
    );
};

const Props = ({ city }) => {
    const revision = useWorld(s => s.terrainRevision);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const items = useMemo(() => city.props.map(p => ({
        ...p, y: heightAt(p.x, p.z)
    })), [city, revision]);

    return (
        // بلا حدود محيطة: أربعمئة قطعة صغيرة، والحدّ المحيط يعني
        // رسمة ثانية لكل قطعة مقابل خطّ لا يُرى على عمود إنارة
        <OutlineContext.Provider value={false}>
            <group>
                {items.map(p => (
                    <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.rotation, 0]} scale={p.scale}>
                        <Asset type={p.type} />
                    </group>
                ))}
            </group>
        </OutlineContext.Provider>
    );
};

/**
 * المركبات المتوقّفة.
 *
 * كل واحدة قابلة للركوب لاحقاً، فتحمل معرّفها. والمركبة التي يركبها
 * اللاعب تختفي من هنا ويحلّ محلّها جسم فيزيائي — ولهذا تُستثنى
 * بمعرّفها لا بموضعها.
 */
const ParkedCars = ({ city, hiddenId, overrides }) => {
    const revision = useWorld(s => s.terrainRevision);

    // التجاوزات: مركبة ركبها اللاعب وتركها في مكان آخر تبقى هناك
    // لا تعود إلى موقفها الأوّل بقفزة
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const items = useMemo(() => city.cars.map(c => {
        const moved = overrides?.[c.id];
        const at = moved ? { ...c, ...moved } : c;
        return { ...at, y: heightAt(at.x, at.z) };
    }), [city, revision, overrides]);

    return (
        // المركبات بلا حدود محيطة: قِطع صغيرة كثيرة، والحدود تُضاعف رسمها
        <OutlineContext.Provider value={false}>
            <group>
                {items.filter(c => c.id !== hiddenId).map(c => (
                    <group key={c.id} position={[c.x, c.y, c.z]} rotation={[0, c.rotation, 0]}>
                        <Asset type={c.type} body={c.color} simple />
                    </group>
                ))}
            </group>
        </OutlineContext.Provider>
    );
};

// ── التجميع ─────────────────────────────────────────────────

const City = ({ city, hiddenCarId = null, overrides = null }) => {
    const hour = useWorld(s => s.environment.timeOfDay);

    // شدّة الليل مقسّمة إلى ثماني درجات: تتدرّج مع الغروب، ولا
    // تُعيد رسم ثلاثمئة مبنى مع كل كسر عشري تسحبه في المسطرة
    const night = useMemo(() => Math.round(nightFactor(hour) * 8) / 8, [hour]);

    if (!city) return null;

    return (
        <group>
            <CityGround city={city} />
            <Buildings city={city} night={night} />
            <Props city={city} />
            <ParkedCars city={city} hiddenId={hiddenCarId} overrides={overrides} />
        </group>
    );
};

export default City;
