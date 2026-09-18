import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { gradientMap, PALETTE } from './toon';
import { loadCustom, loadUrl } from './customAssets';

/* ============================================================
   خط أنابيب المجسمات

   كل مجسم في المشهد يمرّ من <Asset type="house" />. المكوّن يقرّر
   داخلياً: إن كان للنوع ملف ‎.glb‎ مسجّل، يجلبه ويحوّله كرتونياً؛
   وإلّا يرسم الشكل الإجرائي. استبدال الأصول لاحقاً = سطر واحد في
   السجلّ أدناه، بلا لمس منطق المشهد.

   الأشكال الإجرائية ليست مؤقّتة رديئة: مبنية بنفس لوحة الألوان
   ونفس حدّة الحواف، فتصلح للعرض حتى لو لم تُرفع أصول حقيقية أبداً.
   ============================================================ */

// الحدود السوداء المحيطة تُضاعف عدد الرسومات، فتبقى قابلة للإطفاء
export const OutlineContext = createContext(true);

const OUTLINE = 0.04;

const Geo = ({ kind, args }) => {
    switch (kind) {
        case 'box': return <boxGeometry args={args} />;
        case 'cone': return <coneGeometry args={args} />;
        case 'cyl': return <cylinderGeometry args={args} />;
        case 'sphere': return <sphereGeometry args={args} />;
        case 'ico': return <icosahedronGeometry args={args} />;
        case 'dodeca': return <dodecahedronGeometry args={args} />;
        default: return <boxGeometry args={args} />;
    }
};

/**
 * قطعة واحدة من مجسم: شبكة كرتونية، ومعها — إن كانت الحدود مفعّلة —
 * نسخة مقلوبة الوجوه أكبر قليلاً بلون داكن، فتظهر كخطّ محيط.
 */
const Part = ({ kind = 'box', args, color, outline = OUTLINE, flat = false, ...props }) => {
    const outlines = useContext(OutlineContext);

    return (
        <group {...props}>
            <mesh castShadow receiveShadow>
                <Geo kind={kind} args={args} />
                <meshToonMaterial color={color} gradientMap={gradientMap()} flatShading={flat} />
            </mesh>

            {outlines && outline > 0 && (
                <mesh scale={1 + outline} renderOrder={-1}>
                    <Geo kind={kind} args={args} />
                    <meshBasicMaterial color={PALETTE.outline} side={THREE.BackSide} />
                </mesh>
            )}
        </group>
    );
};

// ── الأشكال الإجرائية ───────────────────────────────────────

const Tree = () => (
    <group>
        <Part kind="cyl" args={[0.26, 0.36, 2.2, 7]} color={PALETTE.trunk} position={[0, 1.1, 0]} />
        <Part kind="ico" args={[1.5, 0]} color={PALETTE.leaf} position={[0, 3.1, 0]} flat />
        <Part kind="ico" args={[1.05, 0]} color={PALETTE.leafLight} position={[0.75, 2.5, 0.5]} flat />
        <Part kind="ico" args={[0.9, 0]} color={PALETTE.leaf} position={[-0.7, 2.6, -0.4]} flat />
    </group>
);

const Pine = () => (
    <group>
        <Part kind="cyl" args={[0.2, 0.28, 1.2, 6]} color={PALETTE.trunk} position={[0, 0.6, 0]} />
        <Part kind="cone" args={[1.45, 2.2, 7]} color={PALETTE.pine} position={[0, 1.9, 0]} flat />
        <Part kind="cone" args={[1.15, 1.9, 7]} color={PALETTE.pine} position={[0, 3.0, 0]} flat />
        <Part kind="cone" args={[0.8, 1.6, 7]} color={PALETTE.leaf} position={[0, 4.1, 0]} flat />
    </group>
);

const Palm = () => {
    // السعف موزّع بالتساوي حول القمّة مع ميل نازل — يكفي ستّة لقراءة الشكل
    const fronds = useMemo(() => Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return { a, x: Math.cos(a) * 1.05, z: Math.sin(a) * 1.05 };
    }), []);

    return (
        <group>
            <Part kind="cyl" args={[0.22, 0.34, 4.2, 7]} color={PALETTE.wood} position={[0, 2.1, 0]} />
            {fronds.map((f, i) => (
                <Part
                    key={i}
                    kind="box" args={[2.1, 0.12, 0.62]}
                    color={i % 2 ? PALETTE.palm : PALETTE.leaf}
                    position={[f.x, 4.25, f.z]}
                    rotation={[0, -f.a, -0.34]}
                />
            ))}
            <Part kind="sphere" args={[0.32, 7, 6]} color={PALETTE.carC} position={[0, 4.0, 0]} outline={0} />
        </group>
    );
};

const Bush = () => (
    <group>
        <Part kind="ico" args={[0.78, 0]} color={PALETTE.leaf} position={[0, 0.7, 0]} flat />
        <Part kind="ico" args={[0.58, 0]} color={PALETTE.leafLight} position={[0.6, 0.5, 0.2]} flat />
        <Part kind="ico" args={[0.5, 0]} color={PALETTE.leaf} position={[-0.5, 0.48, -0.25]} flat />
    </group>
);

const House = ({ wall = PALETTE.wallA, roof = PALETTE.roofA }) => (
    <group>
        <Part kind="box" args={[6, 3.4, 5]} color={wall} position={[0, 1.7, 0]} />
        <Part kind="cone" args={[4.7, 2.3, 4]} color={roof} position={[0, 4.55, 0]} rotation={[0, Math.PI / 4, 0]} />
        <Part kind="box" args={[0.9, 1.9, 0.18]} color={PALETTE.wood} position={[0, 0.95, 2.55]} outline={0.05} />
        <Part kind="box" args={[1.1, 1.1, 0.16]} color={PALETTE.glass} position={[-2, 2.1, 2.55]} outline={0.05} />
        <Part kind="box" args={[1.1, 1.1, 0.16]} color={PALETTE.glass} position={[2, 2.1, 2.55]} outline={0.05} />
        <Part kind="box" args={[0.7, 1.3, 0.7]} color={PALETTE.roofC} position={[1.7, 5.2, -0.9]} outline={0.05} />
    </group>
);

const Cottage = () => (
    <group>
        <Part kind="box" args={[4.6, 2.7, 4.2]} color={PALETTE.wallC} position={[0, 1.35, 0]} />
        <Part kind="cone" args={[3.8, 1.8, 4]} color={PALETTE.roofB} position={[0, 3.6, 0]} rotation={[0, Math.PI / 4, 0]} />
        <Part kind="box" args={[0.85, 1.7, 0.16]} color={PALETTE.wood} position={[0, 0.85, 2.15]} outline={0.05} />
        <Part kind="box" args={[1.5, 0.9, 0.16]} color={PALETTE.glass} position={[-1.4, 1.9, 2.15]} outline={0.05} />
    </group>
);

const Tower = () => (
    <group>
        <Part kind="box" args={[5.4, 13, 5.4]} color={PALETTE.tower} position={[0, 6.5, 0]} />
        <Part kind="box" args={[5.6, 0.7, 5.6]} color={PALETTE.wallB} position={[0, 13.3, 0]} outline={0.03} />
        {[2.6, 5.4, 8.2, 11].map((y, i) => (
            <Part key={i} kind="box" args={[5.0, 1.3, 0.14]} color={PALETTE.towerGlass} position={[0, y, 2.73]} outline={0} />
        ))}
        {[2.6, 5.4, 8.2, 11].map((y, i) => (
            <Part key={`s${i}`} kind="box" args={[0.14, 1.3, 5.0]} color={PALETTE.towerGlass} position={[2.73, y, 0]} outline={0} />
        ))}
    </group>
);

const Shop = () => (
    <group>
        <Part kind="box" args={[6.4, 4, 5]} color={PALETTE.wallB} position={[0, 2, 0]} />
        <Part kind="box" args={[6.8, 0.5, 5.4]} color={PALETTE.roofA} position={[0, 4.25, 0]} outline={0.03} />
        <Part kind="box" args={[5.2, 1.6, 0.16]} color={PALETTE.glass} position={[0, 1.6, 2.55]} outline={0.04} />
        {/* مظلّة مخطّطة: شريحتان بلونين تكفيان لقراءة الخطوط */}
        <Part kind="box" args={[3.2, 0.16, 1.5]} color={PALETTE.roofA} position={[-1.6, 2.9, 3.1]} rotation={[-0.3, 0, 0]} outline={0.05} />
        <Part kind="box" args={[3.2, 0.16, 1.5]} color={PALETTE.wallA} position={[1.6, 2.9, 3.1]} rotation={[-0.3, 0, 0]} outline={0.05} />
    </group>
);

const Car = ({ body = PALETTE.carA }) => (
    <group>
        <Part kind="box" args={[1.9, 0.72, 4.3]} color={body} position={[0, 0.72, 0]} />
        <Part kind="box" args={[1.66, 0.72, 2.1]} color={body} position={[0, 1.4, -0.24]} outline={0.045} />
        <Part kind="box" args={[1.5, 0.5, 0.12]} color={PALETTE.glass} position={[0, 1.45, 0.83]} outline={0} />
        <Part kind="box" args={[1.5, 0.5, 0.12]} color={PALETTE.glass} position={[0, 1.45, -1.3]} outline={0} />
        {[[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].map(([x, z], i) => (
            <Part key={i} kind="cyl" args={[0.42, 0.42, 0.34, 9]} color="#2B3440"
                position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]} outline={0.05} />
        ))}
        <Part kind="box" args={[0.4, 0.22, 0.12]} color={PALETTE.roofA} position={[-0.6, 0.78, -2.2]} outline={0} />
        <Part kind="box" args={[0.4, 0.22, 0.12]} color={PALETTE.roofA} position={[0.6, 0.78, -2.2]} outline={0} />
        <Part kind="box" args={[0.42, 0.24, 0.12]} color="#FFF3C4" position={[-0.6, 0.78, 2.18]} outline={0} />
        <Part kind="box" args={[0.42, 0.24, 0.12]} color="#FFF3C4" position={[0.6, 0.78, 2.18]} outline={0} />
    </group>
);

const Van = () => (
    <group>
        <Part kind="box" args={[2.1, 2.2, 5]} color={PALETTE.wallA} position={[0, 1.6, -0.5]} />
        <Part kind="box" args={[2.05, 1.5, 1.7]} color={PALETTE.carB} position={[0, 1.25, 2.35]} outline={0.045} />
        <Part kind="box" args={[1.8, 0.62, 0.12]} color={PALETTE.glass} position={[0, 1.6, 3.2]} outline={0} />
        {[[-1.02, 1.9], [1.02, 1.9], [-1.02, -1.9], [1.02, -1.9]].map(([x, z], i) => (
            <Part key={i} kind="cyl" args={[0.46, 0.46, 0.36, 9]} color="#2B3440"
                position={[x, 0.46, z]} rotation={[0, 0, Math.PI / 2]} outline={0.05} />
        ))}
    </group>
);

const Bench = () => (
    <group>
        <Part kind="box" args={[2.4, 0.16, 0.7]} color={PALETTE.wood} position={[0, 0.62, 0]} outline={0.05} />
        <Part kind="box" args={[2.4, 0.62, 0.14]} color={PALETTE.wood} position={[0, 0.98, -0.32]} outline={0.05} />
        <Part kind="box" args={[0.16, 0.62, 0.62]} color={PALETTE.metal} position={[-1.05, 0.31, 0]} outline={0.05} />
        <Part kind="box" args={[0.16, 0.62, 0.62]} color={PALETTE.metal} position={[1.05, 0.31, 0]} outline={0.05} />
    </group>
);

const Lamp = () => (
    <group>
        <Part kind="cyl" args={[0.14, 0.2, 5, 7]} color={PALETTE.metal} position={[0, 2.5, 0]} />
        <Part kind="box" args={[1.3, 0.14, 0.14]} color={PALETTE.metal} position={[0.55, 4.95, 0]} outline={0.04} />
        <Part kind="box" args={[0.7, 0.3, 0.42]} color="#FFF3C4" position={[1.1, 4.75, 0]} outline={0.04} />
    </group>
);

const Rock = () => (
    <group>
        <Part kind="dodeca" args={[0.9, 0]} color="#9AA3AE" position={[0, 0.55, 0]} flat />
        <Part kind="dodeca" args={[0.5, 0]} color="#B4BCC6" position={[0.8, 0.3, 0.3]} flat />
    </group>
);

const Fence = () => (
    <group>
        <Part kind="box" args={[4, 0.14, 0.12]} color={PALETTE.wallA} position={[0, 0.95, 0]} outline={0.05} />
        <Part kind="box" args={[4, 0.14, 0.12]} color={PALETTE.wallA} position={[0, 0.55, 0]} outline={0.05} />
        {[-1.8, -0.6, 0.6, 1.8].map((x, i) => (
            <Part key={i} kind="box" args={[0.16, 1.3, 0.16]} color={PALETTE.wallA} position={[x, 0.65, 0]} outline={0.05} />
        ))}
    </group>
);

const Fountain = () => (
    <group>
        <Part kind="cyl" args={[2.2, 2.4, 0.6, 12]} color={PALETTE.sidewalk} position={[0, 0.3, 0]} />
        <Part kind="cyl" args={[1.9, 1.9, 0.2, 12]} color={PALETTE.glass} position={[0, 0.62, 0]} outline={0} />
        <Part kind="cyl" args={[0.3, 0.42, 1.4, 9]} color={PALETTE.sidewalk} position={[0, 1.2, 0]} outline={0.05} />
        <Part kind="sphere" args={[0.5, 9, 7]} color={PALETTE.glass} position={[0, 2.1, 0]} outline={0.04} />
    </group>
);

// ── الطرق والتضاريس ─────────────────────────────────────────
//
// بلاطات بمقاس الشبكة نفسه (٨ أمتار) لتتلاصق بلا فجوات. تُرسم
// صفائح رقيقة مرفوعة قليلاً عن الأرض بدل مستويات بلا سماكة: الحافّة
// تُقرأ بصرياً، والارتفاع يمنع تزاحم العمق مع الأرضية تحتها.

export const TILE = 8;

const Slab = ({ w = TILE, d = TILE, h = 0.09, y = 0.05, color, ...props }) => (
    <mesh position={[0, y, 0]} receiveShadow {...props}>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={color} gradientMap={gradientMap()} />
    </mesh>
);

/** علامة مسطّحة فوق البلاطة — خطوط ممرّات ومنتصف الطريق */
const Paint = ({ w, d, x = 0, z = 0, color = PALETTE.roadLine, rot = 0 }) => (
    <mesh position={[x, 0.105, z]} rotation={[-Math.PI / 2, 0, rot]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} />
    </mesh>
);

const RoadStraight = () => (
    <group>
        <Slab color={PALETTE.road} />
        {[-2.6, 0, 2.6].map(z => <Paint key={z} w={0.26} d={1.9} z={z} />)}
    </group>
);

const RoadCross = () => (
    <group>
        <Slab color={PALETTE.road} />
        {/* أربعة ممرّات مشاة عند أطراف التقاطع */}
        {[[0, -3.2, 0], [0, 3.2, 0], [-3.2, 0, Math.PI / 2], [3.2, 0, Math.PI / 2]].map(([x, z, rot], i) => (
            <group key={i}>
                {[-1.8, -0.6, 0.6, 1.8].map(o => (
                    <Paint
                        key={o} w={0.42} d={1.3}
                        x={rot ? x : o} z={rot ? o : z}
                        rot={rot}
                    />
                ))}
            </group>
        ))}
    </group>
);

const RoadTurn = () => (
    <group>
        <Slab color={PALETTE.road} />
        {/* منعطف ربع دائرة: قوس منقّط يوجّه العين */}
        {[0.2, 0.42, 0.64, 0.86].map((t, i) => {
            const a = t * (Math.PI / 2);
            return <Paint key={i} w={0.26} d={0.9} x={-4 + Math.cos(a) * 4} z={4 - Math.sin(a) * 4} rot={a} />;
        })}
    </group>
);

const RoadTee = () => (
    <group>
        <Slab color={PALETTE.road} />
        {[-2.6, 2.6].map(z => <Paint key={z} w={0.26} d={1.9} z={z} />)}
        {[-1.8, -0.6, 0.6, 1.8].map(o => <Paint key={o} w={0.42} d={1.3} x={3.2} z={o} rot={Math.PI / 2} />)}
    </group>
);

const Crosswalk = () => (
    <group>
        <Slab color={PALETTE.road} />
        {[-3, -1.8, -0.6, 0.6, 1.8, 3].map(x => <Paint key={x} w={0.62} d={6.4} x={x} />)}
    </group>
);

const Sidewalk = () => (
    <group>
        <Slab color={PALETTE.sidewalk} h={0.22} y={0.11} />
        <Paint w={TILE - 0.5} d={TILE - 0.5} color="#B8B1A2" />
    </group>
);

const Plaza = () => (
    <group>
        <Slab color="#CFC7B6" h={0.16} y={0.08} />
        {[-2, 0, 2].map(x => <Paint key={`v${x}`} w={0.14} d={TILE - 0.4} x={x} color="#B0A796" />)}
        {[-2, 0, 2].map(z => <Paint key={`h${z}`} w={TILE - 0.4} d={0.14} z={z} color="#B0A796" />)}
    </group>
);

const GrassPatch = () => <Slab color={PALETTE.grassDark} h={0.07} y={0.04} />;
const DirtPatch = () => <Slab color="#A98A62" h={0.07} y={0.04} />;

const Water = () => (
    <group>
        <Slab color="#4FA3C7" h={0.06} y={0.03} />
        <Paint w={TILE - 1.2} d={TILE - 1.2} color="#6FC0DE" />
    </group>
);

const Hill = () => (
    <group>
        <mesh position={[0, 0, 0]} receiveShadow castShadow>
            <sphereGeometry args={[5.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshToonMaterial color={PALETTE.grass} gradientMap={gradientMap()} flatShading />
        </mesh>
    </group>
);

// ── سجلّ الأصول ──────────────────────────────────────────────
// glb: ضع هنا مسار الملف تحت public/ حين ترفع الأصول الحقيقية،
// مثال: glb: '/assets/models/tree_01.glb' — ولا شيء آخر يتغيّر.

export const ASSETS = {
    tree:     { label: 'شجرة',      group: 'nature',  Proc: Tree,     glb: null },
    pine:     { label: 'صنوبر',     group: 'nature',  Proc: Pine,     glb: null },
    palm:     { label: 'نخلة',      group: 'nature',  Proc: Palm,     glb: null },
    bush:     { label: 'شجيرة',     group: 'nature',  Proc: Bush,     glb: null },
    rock:     { label: 'صخرة',      group: 'nature',  Proc: Rock,     glb: null },
    house:    { label: 'بيت',       group: 'build',   Proc: House,    glb: null },
    cottage:  { label: 'كوخ',       group: 'build',   Proc: Cottage,  glb: null },
    tower:    { label: 'برج',       group: 'build',   Proc: Tower,    glb: null },
    shop:     { label: 'محل',       group: 'build',   Proc: Shop,     glb: null },
    car:      { label: 'سيارة',     group: 'vehicle', Proc: Car,      glb: null },
    van:      { label: 'شاحنة',     group: 'vehicle', Proc: Van,      glb: null },
    bench:    { label: 'مقعد',      group: 'street',  Proc: Bench,    glb: null },
    lamp:     { label: 'عمود إنارة', group: 'street', Proc: Lamp,     glb: null },
    fence:    { label: 'سياج',      group: 'street',  Proc: Fence,    glb: null },
    fountain: { label: 'نافورة',    group: 'street',  Proc: Fountain, glb: null },

    // بلاطات الشبكة — تلتصق ببعضها فتُبنى منها شبكة شوارع كاملة
    road_straight: { label: 'شارع',      group: 'road', Proc: RoadStraight, glb: null, tile: true },
    road_cross:    { label: 'تقاطع',     group: 'road', Proc: RoadCross,    glb: null, tile: true },
    road_turn:     { label: 'منعطف',     group: 'road', Proc: RoadTurn,     glb: null, tile: true },
    road_tee:      { label: 'تفرّع',      group: 'road', Proc: RoadTee,      glb: null, tile: true },
    crosswalk:     { label: 'ممرّ مشاة',  group: 'road', Proc: Crosswalk,    glb: null, tile: true },
    sidewalk:      { label: 'رصيف',      group: 'road', Proc: Sidewalk,     glb: null, tile: true },
    plaza:         { label: 'ساحة',      group: 'road', Proc: Plaza,        glb: null, tile: true },

    grass_patch:   { label: 'مرج',       group: 'terrain', Proc: GrassPatch, glb: null, tile: true },
    dirt_patch:    { label: 'تراب',      group: 'terrain', Proc: DirtPatch,  glb: null, tile: true },
    water:         { label: 'ماء',       group: 'terrain', Proc: Water,      glb: null, tile: true },
    hill:          { label: 'تلّة',       group: 'terrain', Proc: Hill,       glb: null }
};

export const ASSET_KEYS = Object.keys(ASSETS);

/**
 * نصف قطر الاصطدام بالمتر — يمنع المشي عبر المباني في منظور الشخص
 * الأوّل. صفر يعني أن المجسم يُمشى فوقه أو خلاله: البلاطات والأعشاب
 * وما يُتجاوز طبيعياً.
 */
export const FOOTPRINT = {
    house: 3.6, cottage: 2.9, tower: 3.4, shop: 3.8, fountain: 2.5,
    tree: 0.6, pine: 0.55, palm: 0.5, bush: 0.7, rock: 0.9,
    car: 1.5, van: 1.7, bench: 1.1, lamp: 0.3, fence: 1.9,
    hill: 5.0
};

export const footprintOf = (type) => {
    if (type?.startsWith('custom:')) return 1.8;   // تقدير معقول لمجسم لا نعرف حجمه
    return FOOTPRINT[type] || 0;
};

// ── الجسر إلى ملفات glTF ────────────────────────────────────

/** صندوق شفّاف يشغل مكان مجسم يُحمَّل، أو يُعلن أنه تعذّر */
const Placeholder = ({ failed }) => (
    <group>
        <mesh position={[0, 1.6, 0]}>
            <boxGeometry args={[2.4, 3.2, 2.4]} />
            <meshBasicMaterial
                color={failed ? '#ef4444' : '#38bdf8'}
                transparent opacity={failed ? 0.28 : 0.16}
                wireframe
            />
        </mesh>
    </group>
);

/**
 * يجلب مجسماً (من مسار مسجّل أو من مخزن المتصفّح) وينسخه لهذه النسخة.
 * النسخ يتشارك الهندسة والخامات، فعشر نسخ لا تعني عشر عمليات تحميل.
 */
const LoadedAsset = ({ source, fromStore }) => {
    const [state, setState] = useState({ status: 'loading' });

    useEffect(() => {
        let alive = true;
        setState({ status: 'loading' });

        (fromStore ? loadCustom(source) : loadUrl(source))
            .then(({ root }) => { if (alive) setState({ status: 'ok', object: root.clone(true) }); })
            .catch((err) => {
                console.warn('تعذّر تحميل المجسم:', source, err?.message);
                if (alive) setState({ status: 'fail' });
            });

        return () => { alive = false; };
    }, [source, fromStore]);

    if (state.status === 'ok') return <primitive object={state.object} />;
    return <Placeholder failed={state.status === 'fail'} />;
};

/**
 * المجسم الموحّد. كل ما في المشهد يمرّ من هنا.
 * النوع إمّا مفتاح من السجلّ، أو ‎custom:<key>‎ لمجسم استورده المستخدم.
 */
export const Asset = ({ type, ...props }) => {
    if (typeof type === 'string' && type.startsWith('custom:')) {
        return <LoadedAsset source={type.slice(7)} fromStore />;
    }

    const def = ASSETS[type] || ASSETS.tree;
    if (def.glb) return <LoadedAsset source={def.glb} />;

    const Proc = def.Proc;
    return <Proc {...props} />;
};

// ── مصغّرات متصفّح الأصول ────────────────────────────────────
// مرسومة SVG لا صوراً: تبقى حادّة في كل حجم ولا تُضيف ملفات تُحمَّل.

const s = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const AssetThumb = ({ type, size = 34 }) => {
    const common = { viewBox: '0 0 32 32', width: size, height: size, ...s };

    switch (type) {
        case 'pine': return (
            <svg {...common}><path d="M16 4 22 13H10z" fill="#357A4E" stroke="#22303F" /><path d="M16 10l7 10H9z" fill="#4FA85C" stroke="#22303F" /><path d="M14 20h4v6h-4z" fill="#8A5A36" stroke="#22303F" /></svg>
        );
        case 'palm': return (
            <svg {...common}><path d="M15 12h2l1 14h-4z" fill="#A9784E" stroke="#22303F" /><path d="M16 12C11 9 8 10 6 13M16 12c5-3 8-2 10 1M16 12c-2-4-5-5-8-4M16 12c2-4 5-5 8-4" stroke="#4FA85C" strokeWidth="2.4" /></svg>
        );
        case 'bush': return (
            <svg {...common}><circle cx="13" cy="20" r="6" fill="#4FA85C" stroke="#22303F" /><circle cx="20" cy="19" r="5" fill="#6DC06F" stroke="#22303F" /></svg>
        );
        case 'rock': return (
            <svg {...common}><path d="M6 24l5-11 7-3 8 6-2 8z" fill="#9AA3AE" stroke="#22303F" /></svg>
        );
        case 'house': return (
            <svg {...common}><path d="M5 15 16 6l11 9" stroke="#D4564B" strokeWidth="2.6" /><path d="M8 15h16v11H8z" fill="#F3EAD8" stroke="#22303F" /><path d="M14 26v-6h4v6" fill="#A9784E" stroke="#22303F" /></svg>
        );
        case 'cottage': return (
            <svg {...common}><path d="M6 16 16 8l10 8" stroke="#4E7FA8" strokeWidth="2.6" /><path d="M9 16h14v10H9z" fill="#F6DCC4" stroke="#22303F" /><rect x="11" y="18" width="4" height="4" fill="#BFE2F2" stroke="#22303F" /></svg>
        );
        case 'tower': return (
            <svg {...common}><path d="M10 4h12v24H10z" fill="#B9C3CE" stroke="#22303F" /><path d="M13 8h6M13 13h6M13 18h6M13 23h6" stroke="#7FA9C9" strokeWidth="2" /></svg>
        );
        case 'shop': return (
            <svg {...common}><path d="M7 12h18v14H7z" fill="#D9E7F0" stroke="#22303F" /><path d="M6 8h20v4H6z" fill="#D4564B" stroke="#22303F" /><rect x="11" y="16" width="10" height="6" fill="#BFE2F2" stroke="#22303F" /></svg>
        );
        case 'car': return (
            <svg {...common}><path d="M5 20l2-5h4l3-4h6l2 4h5l1 5z" fill="#D45B4A" stroke="#22303F" /><circle cx="10" cy="22" r="3" fill="#2B3440" stroke="#22303F" /><circle cx="23" cy="22" r="3" fill="#2B3440" stroke="#22303F" /></svg>
        );
        case 'van': return (
            <svg {...common}><path d="M4 10h14v11H4z" fill="#F3EAD8" stroke="#22303F" /><path d="M18 14h6l4 4v3H18z" fill="#4E8FC0" stroke="#22303F" /><circle cx="9" cy="23" r="3" fill="#2B3440" stroke="#22303F" /><circle cx="23" cy="23" r="3" fill="#2B3440" stroke="#22303F" /></svg>
        );
        case 'bench': return (
            <svg {...common}><path d="M6 17h20M6 21h20" stroke="#A9784E" strokeWidth="2.6" /><path d="M8 21v6M24 21v6M7 13h18" stroke="#22303F" /></svg>
        );
        case 'lamp': return (
            <svg {...common}><path d="M12 28V8h8" stroke="#9AA3AE" strokeWidth="2.4" /><rect x="18" y="8" width="7" height="5" rx="1.4" fill="#FFF3C4" stroke="#22303F" /></svg>
        );
        case 'fence': return (
            <svg {...common}><path d="M5 26V12M12 26V12M20 26V12M27 26V12" stroke="#F3EAD8" strokeWidth="2.6" /><path d="M4 16h24M4 21h24" stroke="#22303F" /></svg>
        );
        case 'fountain': return (
            <svg {...common}><ellipse cx="16" cy="24" rx="10" ry="4" fill="#BFE2F2" stroke="#22303F" /><path d="M16 20V12" stroke="#9AA3AE" strokeWidth="2.4" /><circle cx="16" cy="9" r="3" fill="#BFE2F2" stroke="#22303F" /></svg>
        );
        case 'road_straight': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#5B6270" stroke="#22303F" /><path d="M16 7v5M16 15v5M16 23v3" stroke="#F2E9C9" strokeWidth="2" /></svg>
        );
        case 'road_cross': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#5B6270" stroke="#22303F" /><path d="M10 8h12M10 24h12" stroke="#F2E9C9" strokeWidth="2" strokeDasharray="2 2" /><path d="M8 10v12M24 10v12" stroke="#F2E9C9" strokeWidth="2" strokeDasharray="2 2" /></svg>
        );
        case 'road_turn': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#5B6270" stroke="#22303F" /><path d="M6 26A20 20 0 0 1 26 6" stroke="#F2E9C9" strokeWidth="2" strokeDasharray="3 3" /></svg>
        );
        case 'road_tee': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#5B6270" stroke="#22303F" /><path d="M16 6v20" stroke="#F2E9C9" strokeWidth="2" strokeDasharray="3 3" /><path d="M18 16h8" stroke="#F2E9C9" strokeWidth="2" strokeDasharray="3 3" /></svg>
        );
        case 'crosswalk': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#5B6270" stroke="#22303F" /><path d="M9 7v18M13 7v18M17 7v18M21 7v18M25 7v18" stroke="#F2E9C9" strokeWidth="2.2" /></svg>
        );
        case 'sidewalk': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#C9C2B2" stroke="#22303F" /><path d="M4 12h24M4 20h24M12 4v24M20 4v24" stroke="#A9A292" /></svg>
        );
        case 'plaza': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#CFC7B6" stroke="#22303F" /><path d="M4 11h24M4 18h24M4 25h24M11 4v24M18 4v24M25 4v24" stroke="#B0A796" /></svg>
        );
        case 'grass_patch': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#6FAE49" stroke="#22303F" /><path d="M9 22v-4M13 23v-6M17 22v-4M21 23v-5" stroke="#4FA85C" strokeWidth="2" /></svg>
        );
        case 'dirt_patch': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#A98A62" stroke="#22303F" /><circle cx="12" cy="13" r="1.6" fill="#8A6F4E" stroke="none" /><circle cx="20" cy="19" r="2" fill="#8A6F4E" stroke="none" /></svg>
        );
        case 'water': return (
            <svg {...common}><rect x="4" y="4" width="24" height="24" rx="2" fill="#4FA3C7" stroke="#22303F" /><path d="M7 13c3-2 5 2 8 0s5-2 8 0M7 20c3-2 5 2 8 0s5-2 8 0" stroke="#BFE2F2" strokeWidth="1.8" /></svg>
        );
        case 'hill': return (
            <svg {...common}><path d="M3 25c4-11 9-15 13-15s9 4 13 15z" fill="#86C45A" stroke="#22303F" /></svg>
        );
        case 'custom': return (
            <svg {...common}><path d="M16 4 27 10v12L16 28 5 22V10z" fill="#38bdf8" fillOpacity=".22" stroke="#38bdf8" /><path d="M5 10l11 6 11-6M16 16v12" stroke="#38bdf8" /></svg>
        );
        default: return (
            <svg {...common}><circle cx="16" cy="13" r="7" fill="#4FA85C" stroke="#22303F" /><path d="M14 20h4v7h-4z" fill="#8A5A36" stroke="#22303F" /></svg>
        );
    }
};
