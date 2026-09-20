import React, { createContext, useContext, useMemo } from 'react';
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

/* ── مخزن الهندسات ──────────────────────────────────────────
   الشكل الواحد يتكرّر مئات المرّات في المدينة: نفس الصندوق بنفس
   القياس في مئتي مبنى. وبناؤه في كل مرّة يعني مئتي مخزن رؤوس في
   كرت الرسم لشيء واحد.

   المفتاح هو النوع والقياسات، والنتيجة مشتركة بين كل من يطلبها.
   ولا تُتلَف عند إزالة مجسم: غيره ما زال يستعملها — وهي محدودة
   العدد أصلاً لأن الأشكال محدودة. */

const GEOMETRY_CACHE = new Map();

const BUILDERS = {
    box: (a) => new THREE.BoxGeometry(...a),
    cone: (a) => new THREE.ConeGeometry(...a),
    cyl: (a) => new THREE.CylinderGeometry(...a),
    sphere: (a) => new THREE.SphereGeometry(...a),
    ico: (a) => new THREE.IcosahedronGeometry(...a),
    dodeca: (a) => new THREE.DodecahedronGeometry(...a)
};

export const sharedGeometry = (kind, args) => {
    const key = `${kind}|${(args || []).join(',')}`;
    let geometry = GEOMETRY_CACHE.get(key);

    if (!geometry) {
        geometry = (BUILDERS[kind] || BUILDERS.box)(args || [1, 1, 1]);
        GEOMETRY_CACHE.set(key, geometry);
    }
    return geometry;
};

export const geometryCacheSize = () => GEOMETRY_CACHE.size;

/**
 * قطعة واحدة من مجسم: شبكة كرتونية، ومعها — إن كانت الحدود مفعّلة —
 * نسخة مقلوبة الوجوه أكبر قليلاً بلون داكن، فتظهر كخطّ محيط.
 */
export const Part = ({ kind = 'box', args, color, outline = OUTLINE, flat = false, cast = true, ...props }) => {
    const outlines = useContext(OutlineContext);
    const style = useContext(StyleContext);

    // الحدود المحيطة لغة رسم كرتونية بحتة؛ في النمط الواقعي تُفسده
    const drawOutline = outlines && style !== 'real' && outline > 0;

    const geometry = useMemo(() => sharedGeometry(kind, args), [kind, args]);

    return (
        <group {...props}>
            <mesh geometry={geometry} castShadow={cast} receiveShadow>
                <Surface color={color} flat={flat} />
            </mesh>

            {drawOutline && (
                <mesh geometry={geometry} scale={1 + outline} renderOrder={-1}>
                    <meshBasicMaterial color={PALETTE.outline} side={THREE.BackSide} />
                </mesh>
            )}
        </group>
    );
};
