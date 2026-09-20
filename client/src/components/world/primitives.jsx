import React, { createContext, useContext } from 'react';
import * as THREE from 'three';
import { gradientMap, PALETTE } from './toon';

/* ============================================================
   لبنات الرسم

   ثلاث قطع يبني عليها كل مجسم في المشهد: سياق الحدود، سياق النمط،
   والقطعة الواحدة. مفصولة في وحدتها لا داخل سجلّ الأصول، لأن أحياء
   المدينة تبني عليها أيضاً — ولو بقيت هناك لدار الاستيراد في حلقة.
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
export const Part = ({ kind = 'box', args, color, outline = OUTLINE, flat = false, ...props }) => {
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
