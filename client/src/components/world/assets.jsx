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

/** نمط العرض الساري على المشهد: 'toon' أو 'real' */
export const StyleContext = createContext('toon');

const OUTLINE = 0.04;

/**
 * خامة السطح بحسب النمط.
 *
 * الكرتوني: تظليل بأربع درجات حادّة بلا انعكاس.
 * الواقعي: خامة فيزيائية تقرأ إضاءة البيئة وتعكسها.
 */
export const Surface = ({ color, flat = false, roughness = 0.88, metalness = 0, ...rest }) => {
    const style = useContext(StyleContext);

    return style === 'real'
        ? <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} flatShading={flat} {...rest} />
        : <meshToonMaterial color={color} gradientMap={gradientMap()} flatShading={flat} {...rest} />;
};

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
    const style = useContext(StyleContext);

    // الحدود المحيطة لغة رسم كرتونية بحتة؛ في النمط الواقعي تُفسده
    const drawOutline = outlines && style !== 'real' && outline > 0;

    return (
        <group {...props}>
            <mesh castShadow receiveShadow>
                <Geo kind={kind} args={args} />
                <Surface color={color} flat={flat} />
            </mesh>

            {drawOutline && (
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

/** نافذة بإطار وعارضة — الإطار هو ما يفصلها عن مربّع أزرق على جدار */
const Window = ({ w = 1.1, h = 1.1, x = 0, y = 0, z = 0, ry = 0, sill = true }) => (
    <group position={[x, y, z]} rotation={[0, ry, 0]}>
        <Part kind="box" args={[w + 0.18, h + 0.18, 0.1]} color="#E8E2D4" outline={0.04} />
        <Part kind="box" args={[w, h, 0.12]} color={PALETTE.glass} position={[0, 0, 0.04]} outline={0} />
        <Part kind="box" args={[0.06, h, 0.15]} color="#E8E2D4" position={[0, 0, 0.05]} outline={0} />
        <Part kind="box" args={[w, 0.06, 0.15]} color="#E8E2D4" position={[0, 0, 0.05]} outline={0} />
        {sill && <Part kind="box" args={[w + 0.3, 0.1, 0.22]} color="#D8D2C4" position={[0, -h / 2 - 0.14, 0.06]} outline={0.03} />}
    </group>
);

/** باب بإطار ومقبض ودرجة */
const Door = ({ x = 0, z = 0, color = PALETTE.wood }) => (
    <group position={[x, 0, z]}>
        <Part kind="box" args={[1.12, 2.12, 0.1]} color="#E8E2D4" position={[0, 1.02, 0]} outline={0.04} />
        <Part kind="box" args={[0.92, 1.96, 0.14]} color={color} position={[0, 0.98, 0.04]} outline={0} />
        <Part kind="box" args={[0.7, 0.7, 0.16]} color="#8A6240" position={[0, 1.34, 0.06]} outline={0} />
        <Part kind="sphere" args={[0.07, 8, 6]} color="#C9A227" position={[0.33, 0.98, 0.14]} outline={0} />
        <Part kind="box" args={[1.5, 0.14, 0.7]} color={PALETTE.sidewalk} position={[0, 0.07, 0.42]} outline={0.03} />
    </group>
);

const House = ({ wall = PALETTE.wallA, roof = PALETTE.roofA }) => (
    <group>
        {/* أساس بارز: يمنع المنزل من أن يبدو ملصقاً على الأرض */}
        <Part kind="box" args={[6.24, 0.36, 5.24]} color="#B9B2A3" position={[0, 0.18, 0]} outline={0.03} />
        <Part kind="box" args={[6, 3.4, 5]} color={wall} position={[0, 2, 0]} />

        {/* السقف وطنفه البارز عن الجدار */}
        <Part kind="box" args={[6.5, 0.16, 5.5]} color={PALETTE.roofC} position={[0, 3.78, 0]} outline={0.03} />
        <Part kind="cone" args={[4.9, 2.3, 4]} color={roof} position={[0, 5.0, 0]} rotation={[0, Math.PI / 4, 0]} />

        <Door z={2.52} />
        <Window w={1.05} h={1.05} x={-2} y={2.5} z={2.55} />
        <Window w={1.05} h={1.05} x={2} y={2.5} z={2.55} />
        <Window w={1.05} h={1.05} x={-3.05} y={2.5} z={0} ry={-Math.PI / 2} />
        <Window w={1.05} h={1.05} x={3.05} y={2.5} z={0} ry={Math.PI / 2} />

        {/* المدخنة بغطائها */}
        <Part kind="box" args={[0.66, 1.5, 0.66]} color={PALETTE.roofC} position={[1.7, 5.5, -0.9]} outline={0.04} />
        <Part kind="box" args={[0.86, 0.14, 0.86]} color="#8A7A68" position={[1.7, 6.3, -0.9]} outline={0.03} />
    </group>
);

const Cottage = () => (
    <group>
        <Part kind="box" args={[4.84, 0.32, 4.44]} color="#B9B2A3" position={[0, 0.16, 0]} outline={0.03} />
        <Part kind="box" args={[4.6, 2.7, 4.2]} color={PALETTE.wallC} position={[0, 1.65, 0]} />
        <Part kind="box" args={[5.1, 0.14, 4.7]} color={PALETTE.roofC} position={[0, 3.08, 0]} outline={0.03} />
        <Part kind="cone" args={[3.9, 1.9, 4]} color={PALETTE.roofB} position={[0, 4.1, 0]} rotation={[0, Math.PI / 4, 0]} />

        <Door z={2.12} color="#8A6240" />
        <Window w={1.2} h={0.85} x={-1.5} y={2.1} z={2.15} />
        <Window w={1.2} h={0.85} x={1.5} y={2.1} z={2.15} />

        {/* شرفة صغيرة بعمودين */}
        {[-1.4, 1.4].map(x => (
            <Part key={x} kind="cyl" args={[0.1, 0.12, 2.1, 7]} color="#E8E2D4" position={[x, 1.05, 3.0]} outline={0.04} />
        ))}
        <Part kind="box" args={[3.4, 0.14, 1.9]} color={PALETTE.roofB} position={[0, 2.18, 3.0]} outline={0.03} />
    </group>
);

const TOWER_FLOORS = [2.6, 5.4, 8.2, 11];

const Tower = () => (
    <group>
        {/* طابق أرضي أغمق، وهو ما يميّز البرج عن العمود المصمت */}
        <Part kind="box" args={[5.6, 1.6, 5.6]} color="#8E99A6" position={[0, 0.8, 0]} />
        <Part kind="box" args={[5.4, 11.6, 5.4]} color={PALETTE.tower} position={[0, 7.4, 0]} />
        <Part kind="box" args={[5.7, 0.7, 5.7]} color={PALETTE.wallB} position={[0, 13.4, 0]} outline={0.03} />

        {/* غرفة المعدّات على السطح */}
        <Part kind="box" args={[2.2, 1.1, 2.2]} color="#A7B0BB" position={[-1.2, 14.3, 1.2]} outline={0.04} />
        <Part kind="cyl" args={[0.09, 0.09, 2.4, 6]} color="#6B7280" position={[1.6, 14.9, -1.4]} outline={0} />

        {TOWER_FLOORS.map((y, i) => (
            <group key={i}>
                {/* شريط زجاجي على كل واجهة، يفصله حزام أفقي */}
                <Part kind="box" args={[5.0, 1.3, 0.14]} color={PALETTE.towerGlass} position={[0, y, 2.73]} outline={0} />
                <Part kind="box" args={[0.14, 1.3, 5.0]} color={PALETTE.towerGlass} position={[2.73, y, 0]} outline={0} />
                <Part kind="box" args={[0.14, 1.3, 5.0]} color={PALETTE.towerGlass} position={[-2.73, y, 0]} outline={0} />
                <Part kind="box" args={[5.5, 0.22, 5.5]} color="#9AA5B1" position={[0, y - 0.85, 0]} outline={0} />

                {/* أعمدة رأسية تقطع الزجاج فيُقرأ نوافذ لا مرآة */}
                {[-1.6, 0, 1.6].map(x => (
                    <Part key={x} kind="box" args={[0.16, 1.3, 0.16]} color={PALETTE.tower} position={[x, y, 2.76]} outline={0} />
                ))}
            </group>
        ))}

        <Door z={2.86} color="#3E4A57" />
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

/** عجلة: إطار داكن وجنط فاتح — الفرق بينهما هو ما يجعلها تُقرأ عجلةً */
/**
 * عجلة حول نقطة أصلها.
 *
 * مفصولة عن موضعها عمداً: العجلة المعلّقة على نظام تعليق فيزيائي
 * تتحرّك وتدور وتنعطف وحدها، فلا يصلح أن يكون موضعها مخبوءاً فيها.
 */
export const CarWheel = ({ r = 0.37, width = 0.3 }) => (
    <group rotation={[0, 0, Math.PI / 2]}>
        <Part kind="cyl" args={[r, r, width, 12]} color="#20262F" outline={0.04} />
        <Part kind="cyl" args={[r * 0.56, r * 0.56, width + 0.04, 10]} color="#9AA3AE" outline={0} />
        <Part kind="cyl" args={[r * 0.22, r * 0.22, width + 0.07, 8]} color="#6B7280" outline={0} />
    </group>
);

const Wheel = ({ x, z, r = 0.37, width = 0.3 }) => (
    <group position={[x, r, z]}>
        <CarWheel r={r} width={width} />
    </group>
);

/**
 * سيارة.
 *
 * الواقعية هنا ليست مضلّعات أكثر بل العلامات التي تقرأها العين أوّلاً:
 * زجاج أمامي مائل لا قائم، قوس عجلة يفصل الهيكل عن الإطار، مصدّان
 * بارزان، ومرايا جانبية. كلّها قطع صغيرة بلا حدود محيطة، فلا تُضاعف
 * الرسمات على المركبات المتحرّكة.
 *
 * simple: نسخة مختصرة لحركة المرور — تسير ولا يُحدَّق فيها.
 */
const Car = ({ body = PALETTE.carA, simple = false, wheels = true }) => (
    <group>
        {/* الهيكل: قاعدة عريضة وحزام أغمق يكسر الكتلة */}
        <Part kind="box" args={[1.88, 0.5, 4.2]} color={body} position={[0, 0.66, 0]} />
        <Part kind="box" args={[1.92, 0.22, 3.9]} color="#2F3742" position={[0, 0.38, 0]} outline={0} />

        {/* غطاء المحرّك وصندوق الخلف أخفض من المقصورة */}
        <Part kind="box" args={[1.78, 0.3, 1.25]} color={body} position={[0, 1.04, 1.4]} outline={0.035} />
        <Part kind="box" args={[1.76, 0.26, 0.95]} color={body} position={[0, 1.02, -1.6]} outline={0.035} />

        {/* المقصورة وسقفها */}
        <Part kind="box" args={[1.62, 0.6, 2.0]} color={body} position={[0, 1.3, -0.12]} outline={0.035} />
        <Part kind="box" args={[1.5, 0.1, 1.72]} color={body} position={[0, 1.63, -0.2]} outline={0.03} />

        {/* الزجاج: الأمامي مائل، والخلفي بميل معاكس */}
        <Part kind="box" args={[1.48, 0.62, 0.09]} color={PALETTE.glass}
            position={[0, 1.34, 0.86]} rotation={[-0.42, 0, 0]} outline={0} />
        <Part kind="box" args={[1.44, 0.5, 0.09]} color={PALETTE.glass}
            position={[0, 1.34, -1.1]} rotation={[0.4, 0, 0]} outline={0} />
        {[-0.8, 0.8].map(x => (
            <Part key={x} kind="box" args={[0.08, 0.42, 1.5]} color={PALETTE.glass}
                position={[x, 1.36, -0.16]} outline={0} />
        ))}

        {/* أقواس العجلات: تفصل الهيكل عن الإطار فيبدو محمولاً لا ملتصقاً */}
        {[[-0.94, 1.35], [0.94, 1.35], [-0.94, -1.35], [0.94, -1.35]].map(([x, z], i) => (
            <Part key={i} kind="box" args={[0.1, 0.42, 1.12]} color="#2F3742"
                position={[x, 0.72, z]} outline={0} />
        ))}

        {wheels && (
            <>
                <Wheel x={-0.95} z={1.35} />
                <Wheel x={0.95} z={1.35} />
                <Wheel x={-0.95} z={-1.35} />
                <Wheel x={0.95} z={-1.35} />
            </>
        )}

        {/* مصدّان بارزان عن الهيكل */}
        <Part kind="box" args={[1.9, 0.26, 0.24]} color="#3A434F" position={[0, 0.55, 2.12]} outline={0.03} />
        <Part kind="box" args={[1.9, 0.26, 0.24]} color="#3A434F" position={[0, 0.55, -2.08]} outline={0.03} />

        {/* الأنوار — بخامة غير مضاءة فتتوهّج ليلاً تحت Bloom */}
        {[-0.62, 0.62].map(x => (
            <group key={`h${x}`}>
                <mesh position={[x, 0.86, 2.16]}>
                    <boxGeometry args={[0.44, 0.2, 0.1]} />
                    <meshBasicMaterial color="#FFF6D0" />
                </mesh>
                <mesh position={[x, 0.86, -2.14]}>
                    <boxGeometry args={[0.38, 0.18, 0.1]} />
                    <meshBasicMaterial color="#F0533F" />
                </mesh>
            </group>
        ))}

        {!simple && (
            <>
                <Part kind="box" args={[1.05, 0.18, 0.08]} color="#20262F" position={[0, 0.64, 2.18]} outline={0} />
                <Part kind="box" args={[0.52, 0.16, 0.05]} color="#E8E4D8" position={[0, 0.5, 2.24]} outline={0} />
                <Part kind="box" args={[0.52, 0.16, 0.05]} color="#E8E4D8" position={[0, 0.5, -2.2]} outline={0} />

                {/* مرايا على ساق قصيرة، كما هي فعلاً */}
                {[-1.0, 1.0].map(x => (
                    <group key={`m${x}`}>
                        <Part kind="box" args={[0.14, 0.05, 0.05]} color="#2F3742" position={[x * 0.95, 1.28, 0.68]} outline={0} />
                        <Part kind="box" args={[0.1, 0.16, 0.2]} color={body} position={[x, 1.28, 0.68]} outline={0} />
                    </group>
                ))}

                {/* خطّ الباب ومقبضه */}
                {[-0.95, 0.95].map(x => (
                    <group key={`d${x}`}>
                        <Part kind="box" args={[0.03, 0.5, 0.04]} color="#2F3742" position={[x, 0.82, -0.1]} outline={0} />
                        <Part kind="box" args={[0.06, 0.06, 0.24]} color="#B9C3CE" position={[x, 0.98, -0.42]} outline={0} />
                    </group>
                ))}
            </>
        )}
    </group>
);

const Van = ({ simple = false }) => (
    <group>
        <Part kind="box" args={[2.08, 2.1, 4.6]} color={PALETTE.wallA} position={[0, 1.62, -0.7]} />
        <Part kind="box" args={[2.12, 0.3, 4.4]} color="#2F3742" position={[0, 0.62, -0.7]} outline={0} />

        {/* المقصورة أخفض من الصندوق، بزجاج مائل */}
        <Part kind="box" args={[2.04, 1.5, 1.6]} color={PALETTE.carB} position={[0, 1.3, 2.3]} outline={0.035} />
        <Part kind="box" args={[1.8, 0.7, 0.1]} color={PALETTE.glass}
            position={[0, 1.62, 3.06]} rotation={[-0.3, 0, 0]} outline={0} />
        {[-1.0, 1.0].map(x => (
            <Part key={x} kind="box" args={[0.08, 0.5, 1.1]} color={PALETTE.glass}
                position={[x, 1.55, 2.3]} outline={0} />
        ))}

        {/* باب خلفي وشريط جانبي */}
        <Part kind="box" args={[0.05, 1.6, 0.05]} color="#C3BCAD" position={[0, 1.6, -3.0]} outline={0} />
        {[-1.05, 1.05].map(x => (
            <Part key={`s${x}`} kind="box" args={[0.05, 0.22, 4.2]} color={PALETTE.carB}
                position={[x, 1.2, -0.7]} outline={0} />
        ))}

        <Wheel x={-1.0} z={1.85} r={0.42} width={0.34} />
        <Wheel x={1.0} z={1.85} r={0.42} width={0.34} />
        <Wheel x={-1.0} z={-1.9} r={0.42} width={0.34} />
        <Wheel x={1.0} z={-1.9} r={0.42} width={0.34} />

        <Part kind="box" args={[2.1, 0.26, 0.22]} color="#3A434F" position={[0, 0.58, 3.12]} outline={0.03} />

        {[-0.7, 0.7].map(x => (
            <group key={`l${x}`}>
                <mesh position={[x, 0.92, 3.16]}>
                    <boxGeometry args={[0.42, 0.22, 0.1]} />
                    <meshBasicMaterial color="#FFF6D0" />
                </mesh>
                <mesh position={[x, 1.0, -3.02]}>
                    <boxGeometry args={[0.32, 0.4, 0.1]} />
                    <meshBasicMaterial color="#F0533F" />
                </mesh>
            </group>
        ))}

        {!simple && [-1.04, 1.04].map(x => (
            <Part key={`m${x}`} kind="box" args={[0.1, 0.22, 0.18]} color="#2F3742"
                position={[x * 1.06, 1.6, 2.86]} outline={0} />
        ))}
    </group>
);

const Bench = () => (
    <group>
        {/* ألواح منفصلة لا لوح واحد: الفواصل هي ما يجعله مقعد حديقة */}
        {[-0.24, 0, 0.24].map(z => (
            <Part key={`s${z}`} kind="box" args={[2.4, 0.1, 0.2]} color={PALETTE.wood} position={[0, 0.62, z]} outline={0.04} />
        ))}
        {[0.85, 1.12].map(y => (
            <Part key={`b${y}`} kind="box" args={[2.4, 0.2, 0.1]} color={PALETTE.wood} position={[0, y, -0.32]} outline={0.04} />
        ))}
        {[-1.05, 1.05].map(x => (
            <group key={x}>
                <Part kind="box" args={[0.12, 0.62, 0.6]} color={PALETTE.metal} position={[x, 0.31, 0]} outline={0.04} />
                <Part kind="box" args={[0.12, 0.62, 0.12]} color={PALETTE.metal} position={[x, 0.92, -0.32]} outline={0.04} />
                <Part kind="box" args={[0.12, 0.1, 0.7]} color="#6B7280" position={[x, 0.05, 0]} outline={0} />
            </group>
        ))}
    </group>
);

const Lamp = () => (
    <group>
        <Part kind="cyl" args={[0.26, 0.3, 0.3, 8]} color="#6B7280" position={[0, 0.15, 0]} outline={0.04} />
        <Part kind="cyl" args={[0.11, 0.16, 5, 8]} color={PALETTE.metal} position={[0, 2.6, 0]} />
        {/* ذراع منحنية: قطعتان بزاوية بدل عارضة أفقية جافّة */}
        <Part kind="box" args={[0.6, 0.12, 0.12]} color={PALETTE.metal} position={[0.28, 5.02, 0]} rotation={[0, 0, -0.5]} outline={0.04} />
        <Part kind="box" args={[0.7, 0.12, 0.12]} color={PALETTE.metal} position={[0.88, 5.12, 0]} outline={0.04} />
        <Part kind="box" args={[0.72, 0.16, 0.44]} color="#4B5563" position={[1.16, 5.0, 0]} outline={0.04} />
        {/* الكشّاف بخامة غير مضاءة: يتوهّج ليلاً تحت Bloom */}
        <mesh position={[1.16, 4.86, 0]}>
            <boxGeometry args={[0.6, 0.14, 0.34]} />
            <meshBasicMaterial color="#FFF3C4" />
        </mesh>
    </group>
);

const TrafficLight = () => (
    <group>
        <Part kind="cyl" args={[0.3, 0.34, 0.24, 8]} color="#4B5563" position={[0, 0.12, 0]} outline={0.04} />
        <Part kind="cyl" args={[0.1, 0.13, 4.4, 8]} color="#3E4A57" position={[0, 2.2, 0]} />
        <Part kind="box" args={[0.4, 1.1, 0.34]} color="#2B3440" position={[0, 3.9, 0]} outline={0.04} />
        {[['#F0533F', 4.24], ['#F5C542', 3.9], ['#4ADE80', 3.56]].map(([color, y]) => (
            <mesh key={y} position={[0, y, 0.2]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 10]} />
                <meshBasicMaterial color={color} />
            </mesh>
        ))}
    </group>
);

const TrashBin = () => (
    <group>
        <Part kind="cyl" args={[0.34, 0.28, 0.9, 10]} color="#3F6B52" position={[0, 0.45, 0]} outline={0.04} />
        <Part kind="cyl" args={[0.37, 0.37, 0.08, 10]} color="#2F5340" position={[0, 0.94, 0]} outline={0.04} />
        <Part kind="box" args={[0.4, 0.12, 0.05]} color="#1F3A2C" position={[0, 0.98, 0.18]} outline={0} />
        <Part kind="cyl" args={[0.05, 0.05, 1.1, 6]} color={PALETTE.metal} position={[0.4, 0.55, 0]} outline={0} />
    </group>
);

const Hydrant = () => (
    <group>
        <Part kind="cyl" args={[0.26, 0.3, 0.14, 9]} color="#B33A2C" position={[0, 0.07, 0]} outline={0.04} />
        <Part kind="cyl" args={[0.17, 0.2, 0.62, 9]} color="#D4564B" position={[0, 0.45, 0]} outline={0.04} />
        <Part kind="sphere" args={[0.19, 10, 8]} color="#D4564B" position={[0, 0.8, 0]} outline={0.04} />
        <Part kind="cyl" args={[0.06, 0.06, 0.18, 7]} color="#B33A2C" position={[0, 0.94, 0]} outline={0} />
        {[-1, 1].map(side => (
            <Part key={side} kind="cyl" args={[0.09, 0.09, 0.18, 8]} color="#B33A2C"
                position={[side * 0.22, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} outline={0} />
        ))}
    </group>
);

const BusStop = () => (
    <group>
        {[-1.5, 1.5].map(x => (
            <Part key={x} kind="box" args={[0.12, 2.5, 0.12]} color={PALETTE.metal} position={[x, 1.25, -0.6]} outline={0.04} />
        ))}
        <Part kind="box" args={[3.4, 0.12, 1.5]} color="#4B5563" position={[0, 2.55, -0.1]} outline={0.03} />
        <Part kind="box" args={[3.2, 2.2, 0.08]} color={PALETTE.glass} position={[0, 1.3, -0.72]} outline={0} />
        <Part kind="box" args={[3.0, 0.1, 0.24]} color={PALETTE.wood} position={[0, 0.5, -0.5]} outline={0.04} />
        <Part kind="box" args={[0.7, 0.9, 0.06]} color="#4E8FC0" position={[1.5, 1.9, 0]} outline={0.04} />
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
        <Surface color={color} />
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
            <Surface color={PALETTE.grass} flat />
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
    traffic_light: { label: 'إشارة مرور', group: 'street', Proc: TrafficLight, glb: null },
    bin:      { label: 'سلة مهملات', group: 'street', Proc: TrashBin, glb: null },
    hydrant:  { label: 'حنفية حريق', group: 'street', Proc: Hydrant, glb: null },
    bus_stop: { label: 'موقف باص',  group: 'street',  Proc: BusStop,  glb: null },

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
 * هيكل السيارة بلا عجلات — للمركبة الفيزيائية.
 *
 * عجلاتها تُركَّب خارجه على نظام تعليق raycast: ترتفع وتنخفض مع
 * التضاريس وتنعطف وتدور، وهو ما لا تفعله عجلات ملحومة في الهيكل.
 */
export const CarChassis = (props) => <Car {...props} wheels={false} />;

/**
 * نصف قطر الاصطدام بالمتر — يمنع المشي عبر المباني في منظور الشخص
 * الأوّل. صفر يعني أن المجسم يُمشى فوقه أو خلاله: البلاطات والأعشاب
 * وما يُتجاوز طبيعياً.
 */
export const FOOTPRINT = {
    house: 3.6, cottage: 2.9, tower: 3.4, shop: 3.8, fountain: 2.5,
    tree: 0.6, pine: 0.55, palm: 0.5, bush: 0.7, rock: 0.9,
    car: 1.5, van: 1.7, bench: 1.1, lamp: 0.3, fence: 1.9,
    traffic_light: 0.32, bin: 0.4, hydrant: 0.3, bus_stop: 1.8,
    hill: 5.0
};

export const footprintOf = (type) => {
    if (type?.startsWith('custom:')) return 1.8;   // تقدير معقول لمجسم لا نعرف حجمه
    return FOOTPRINT[type] || 0;
};

// ── الجسر إلى ملفات glTF ────────────────────────────────────

/**
 * علامة مكان المجسم ريثما يُحمَّل، أو مكان فشله.
 *
 * الفشل صلب ومضيء لا شبكي باهت: مجسم لم يظهر وشيء شبه شفّاف مكانه
 * يُقرأ كـ«لم يحدث شيء»، فيظنّ المستخدم أن الوضع نفسه لم ينجح.
 */
const Placeholder = ({ failed }) => (
    <group>
        {failed ? (
            <>
                <mesh position={[0, 1.7, 0]} castShadow>
                    <boxGeometry args={[2, 3.4, 2]} />
                    <meshBasicMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0, 4.2, 0]}>
                    <coneGeometry args={[0.55, 1.1, 4]} />
                    <meshBasicMaterial color="#fbbf24" />
                </mesh>
            </>
        ) : (
            <mesh position={[0, 1.6, 0]}>
                <boxGeometry args={[2.2, 3.2, 2.2]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} wireframe />
            </mesh>
        )}
    </group>
);

/**
 * يجلب مجسماً (من مسار مسجّل أو من مخزن المتصفّح) وينسخه لهذه النسخة.
 * النسخ يتشارك الهندسة والخامات، فعشر نسخ لا تعني عشر عمليات تحميل.
 */
const LoadedAsset = ({ source, fromStore }) => {
    const style = useContext(StyleContext);
    const [state, setState] = useState({ status: 'loading' });

    useEffect(() => {
        let alive = true;
        setState({ status: 'loading' });

        (fromStore ? loadCustom(source, style) : loadUrl(source, style))
            .then(({ root }) => { if (alive) setState({ status: 'ok', object: root.clone(true) }); })
            .catch((err) => {
                console.warn('تعذّر تحميل المجسم:', source, err?.message);
                if (alive) setState({ status: 'fail' });
            });

        return () => { alive = false; };
    }, [source, fromStore, style]);

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
