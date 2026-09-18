import React, { Suspense, createContext, useContext, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { gradientMap, applyToonMaterial, PALETTE } from './toon';

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
    fountain: { label: 'نافورة',    group: 'street',  Proc: Fountain, glb: null }
};

export const ASSET_KEYS = Object.keys(ASSETS);

// ── الجسر إلى ملفات ‎.glb‎ ─────────────────────────────────────

const GLBAsset = ({ url }) => {
    const { scene } = useGLTF(url);
    // ننسخ قبل التحويل: نفس الملف قد يُستخدم لعدّة نسخ في المشهد
    const model = useMemo(() => applyToonMaterial(scene.clone(true)), [scene]);
    return <primitive object={model} />;
};

/** ملف ناقص أو تالف يسقط إلى الشكل الإجرائي بدل أن يُفرّغ المشهد */
class AssetBoundary extends React.Component {
    constructor(props) { super(props); this.state = { failed: false }; }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.warn('تعذّر تحميل مجسم، سنستخدم الشكل الإجرائي:', error?.message); }
    render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * المجسم الموحّد. كل ما في المشهد يمرّ من هنا.
 */
export const Asset = ({ type, ...props }) => {
    const def = ASSETS[type] || ASSETS.tree;
    const Proc = def.Proc;

    if (!def.glb) return <Proc {...props} />;

    return (
        <AssetBoundary fallback={<Proc {...props} />}>
            <Suspense fallback={<Proc {...props} />}>
                <GLBAsset url={def.glb} />
            </Suspense>
        </AssetBoundary>
    );
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
        default: return (
            <svg {...common}><circle cx="16" cy="13" r="7" fill="#4FA85C" stroke="#22303F" /><path d="M14 20h4v7h-4z" fill="#8A5A36" stroke="#22303F" /></svg>
        );
    }
};
