import React, { useMemo, useContext, useEffect } from 'react';
import * as THREE from 'three';

import { Part, StyleContext } from './primitives';
import { PALETTE } from './toon';
import { facadeMaps, facadeBox } from './facade';

/* ============================================================
   عمارة الأحياء

   مبانٍ رخيصة الرسم لا فقيرة الشكل. كل مبنى هنا كتلة واحدة تحمل
   واجهته في خامتها، لا عشرات النوافذ المرسومة قطعاً — فالمدينة
   كلّها تبقى في حدود ما يستطيع كرت الرسم، ويبقى المبنى يُقرأ طوابق
   لا صندوقاً.

   وما تراه العين أوّلاً قطع قليلة فوق الكتلة: طنف السطح، شريط
   الطابق الأرضي، مظلّة المدخل، ومعدّات السطح. هذه وحدها هي الفرق
   بين «مبنى» و«صندوق ملوّن».
   ============================================================ */

// ── الكتلة ذات الواجهة ──────────────────────────────────────

/**
 * كتلة مبنى.
 *
 * الإضاءة الذاتية مربوطة بالليل: يُمرَّرها الأب من ساعة المشهد،
 * فتُضيء النوافذ وحدها — القناع في الصورة لا يشمل الجدار.
 */
const Block = ({
    w, h, d, kind = 'plaster', tint = '#ffffff',
    x = 0, y = null, z = 0, night = 0
}) => {
    const style = useContext(StyleContext);
    const maps = useMemo(() => facadeMaps(kind), [kind]);
    const geometry = useMemo(() => facadeBox(w, h, d), [w, h, d]);

    useEffect(() => () => geometry.dispose(), [geometry]);

    const common = {
        map: maps.map || null,
        emissiveMap: maps.emissiveMap || null,
        emissive: new THREE.Color(maps.lit),
        emissiveIntensity: night * 0.85,
        color: tint
    };

    return (
        <mesh geometry={geometry} position={[x, y === null ? h / 2 : y, z]} castShadow receiveShadow>
            {style === 'real'
                ? <meshStandardMaterial {...common} roughness={0.82} metalness={kind === 'glass' ? 0.25 : 0.02} />
                : <meshToonMaterial {...common} />}
        </mesh>
    );
};

/** طنف بارز: الحافّة العليا هي ما يفصل المبنى عن السماء */
const Cornice = ({ w, d, y, color = '#B9B2A3', t = 0.34 }) => (
    <Part kind="box" args={[w + 0.5, t, d + 0.5]} color={color} position={[0, y, 0]} outline={0.02} />
);

/** شريط الطابق الأرضي — أغمق دائماً في المدن الحقيقية */
const Plinth = ({ w, d, h = 1.1, color = '#7E8794' }) => (
    <Part kind="box" args={[w + 0.24, h, d + 0.24]} color={color} position={[0, h / 2, 0]} outline={0.02} />
);

/** مظلّة مدخل — القطعة التي تُخبر أين الباب */
const Canopy = ({ w = 4, z, color = '#C4553F' }) => (
    <group position={[0, 2.5, z]}>
        <Part kind="box" args={[w, 0.16, 1.5]} color={color} outline={0.02} />
        {[-w / 2 + 0.2, w / 2 - 0.2].map(x => (
            <Part key={x} kind="cyl" args={[0.06, 0.06, 2.4, 6]} color="#5A6472" position={[x, -1.2, 0.6]} outline={0} />
        ))}
    </group>
);

/** معدّات السطح: خزّانات ومصاعد وهوائيات — بها لا يبدو السطح مقصوصاً */
const RoofKit = ({ w, d, y, seed = 0 }) => {
    const bits = useMemo(() => {
        let s = (seed * 9301 + 49297) % 233280;
        const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

        return Array.from({ length: 3 }, () => ({
            x: (r() - 0.5) * (w - 2.4),
            z: (r() - 0.5) * (d - 2.4),
            w: 0.9 + r() * 1.4,
            h: 0.7 + r() * 1.1,
            tank: r() > 0.55
        }));
    }, [w, d, seed]);

    return (
        <group position={[0, y, 0]}>
            {bits.map((b, i) => (b.tank
                ? <Part key={i} kind="cyl" args={[b.w * 0.34, b.w * 0.34, b.h, 9]} color="#C9CDD2" position={[b.x, b.h / 2, b.z]} outline={0.02} />
                : <Part key={i} kind="box" args={[b.w, b.h, b.w * 0.8]} color="#9AA3AE" position={[b.x, b.h / 2, b.z]} outline={0.02} />
            ))}
            {/* هوائي: خطّ رفيع يكسر استواء السطح */}
            <Part kind="cyl" args={[0.05, 0.05, 2.6, 5]} color="#6B7280" position={[w * 0.3, 1.3, -d * 0.3]} outline={0} />
        </group>
    );
};

// ── قراءة الليل من المشهد ───────────────────────────────────

/**
 * شدّة إضاءة النوافذ.
 *
 * تُقرأ من ساعة المشهد مقرّبةً إلى العُشر: تتدرّج مع الغروب ولا
 * تُعيد رسم ثلاثمئة مبنى مع كل كسر عشري في المسطرة.
 */
export const nightFactor = (hour) => {
    const h = ((hour % 24) + 24) % 24;
    if (h >= 7 && h <= 16.5) return 0;
    if (h > 16.5 && h < 19.5) return (h - 16.5) / 3;
    if (h > 5 && h < 7) return (7 - h) / 2;
    return 1;
};

// ── الأبراج ─────────────────────────────────────────────────

const TowerGlass = ({ night = 0, seed = 1 }) => {
    const h = 34;
    return (
        <group>
            <Plinth w={11} d={11} h={4.2} color="#5C6675" />
            <Block w={10.6} h={h} d={10.6} kind="glass" y={4.2 + h / 2} night={night} />
            <Cornice w={10.6} d={10.6} y={4.2 + h + 0.2} color="#6C7887" />

            {/* برج ثانٍ أنحف فوقه: الكتلة الواحدة تُقرأ عموداً */}
            <Block w={6.4} h={9} d={6.4} kind="glass" y={4.2 + h + 4.9} night={night} tint="#DCE6F0" />
            <Cornice w={6.4} d={6.4} y={4.2 + h + 9.6} color="#6C7887" t={0.26} />
            <RoofKit w={6} d={6} y={4.2 + h + 9.8} seed={seed} />

            <Canopy w={5} z={5.6} color="#37465A" />
        </group>
    );
};

const TowerBrick = ({ night = 0, seed = 2 }) => {
    const h = 26;
    return (
        <group>
            <Plinth w={12} d={10} h={3.6} color="#7A6A5C" />
            <Block w={11.6} h={h} d={9.6} kind="office" y={3.6 + h / 2} night={night} tint="#D8CDBE" />
            <Cornice w={11.6} d={9.6} y={3.6 + h + 0.2} color="#8A7A68" />
            <RoofKit w={10} d={8} y={3.6 + h + 0.4} seed={seed} />
            <Canopy w={4.6} z={5.1} color="#8A5A36" />
        </group>
    );
};

// ── السكن ───────────────────────────────────────────────────

const Apartment = ({ night = 0, seed = 3 }) => {
    const h = 13.6;
    return (
        <group>
            <Plinth w={10.4} d={8.4} h={0.9} color="#A79C8B" />
            <Block w={10} h={h} d={8} kind="plaster" y={0.9 + h / 2} night={night} />
            <Cornice w={10} d={8} y={0.9 + h + 0.18} color="#C9BFA9" />

            {/* شرفات بارزة على الواجهة — علامة السكن الأولى */}
            {[4.4, 7.8, 11.2].map((y, i) => (
                <group key={i} position={[0, y, 4.3]}>
                    <Part kind="box" args={[6.6, 0.16, 1.3]} color="#D6CCB8" outline={0.02} />
                    <Part kind="box" args={[6.6, 0.75, 0.12]} color="#B9AF9A" position={[0, 0.45, 0.6]} outline={0.02} />
                </group>
            ))}

            <RoofKit w={8} d={6.4} y={0.9 + h + 0.36} seed={seed} />
            <Canopy w={3.4} z={4.3} color="#4E7FA8" />
        </group>
    );
};

const Villa = ({ night = 0 }) => (
    <group>
        <Plinth w={9.4} d={8.4} h={0.5} color="#B0A594" />
        <Block w={9} h={6.4} d={8} kind="plaster" y={0.5 + 3.2} night={night} tint="#F6EEDD" />

        {/* سقف قرميد بميل واحد لا هرم: أقرب إلى بيوت المتوسّط */}
        <Part kind="box" args={[10, 0.4, 9]} color={PALETTE.roofC} position={[0, 7.1, 0]} outline={0.03} />
        <Part kind="box" args={[9.4, 1.5, 8.4]} color={PALETTE.roofA} position={[0, 7.9, 0]} outline={0.03} />

        {/* سور وبوّابة أمامية — الفناء هو ما يجعلها فيلّا */}
        {[-4.2, 4.2].map(x => (
            <Part key={x} kind="box" args={[0.35, 1.5, 0.35]} color="#CFC6B5" position={[x, 0.75, 5.6]} outline={0.02} />
        ))}
        <Part kind="box" args={[8.2, 0.9, 0.16]} color="#B9AF9A" position={[0, 0.65, 5.6]} outline={0.02} />
        <Part kind="box" args={[2.6, 0.12, 3]} color={PALETTE.sidewalk} position={[0, 0.06, 4.2]} outline={0} />
    </group>
);

// ── التجاري ─────────────────────────────────────────────────

const ShopRow = ({ night = 0, seed = 5 }) => {
    const signs = ['#D4564B', '#4E7FA8', '#E8B33F', '#5B9B6E'];
    const h = 9.2;

    return (
        <group>
            {/* الطابق الأرضي زجاج والعلوي سكن — تركيب الشارع التجاري */}
            <Part kind="box" args={[13, 3.4, 9]} color="#3C4552" position={[0, 1.7, 0]} outline={0.02} />
            {[-4.2, 0, 4.2].map((x, i) => (
                <group key={i}>
                    <Part kind="box" args={[3.6, 2.4, 0.2]} color={PALETTE.glass} position={[x, 1.8, 4.55]} outline={0} />
                    <Part kind="box" args={[3.9, 0.55, 0.34]} color={signs[(seed + i) % signs.length]} position={[x, 3.35, 4.62]} outline={0.02} />
                    {/* مظلّة قماش فوق كل واجهة */}
                    <Part kind="box" args={[3.9, 0.12, 1.2]} color={signs[(seed + i + 2) % signs.length]}
                        position={[x, 3.0, 5.2]} rotation={[0.22, 0, 0]} outline={0.02} />
                </group>
            ))}

            <Block w={12.8} h={h - 3.4} d={8.8} kind="shop" y={3.4 + (h - 3.4) / 2} night={night} />
            <Cornice w={12.8} d={8.8} y={h + 0.18} color="#C2B49A" />
        </group>
    );
};

const MarketHall = ({ night = 0 }) => (
    <group>
        <Plinth w={16.4} d={12.4} h={0.8} color="#A79C8B" />
        <Block w={16} h={7} d={12} kind="shop" y={0.8 + 3.5} night={night} tint="#F0E4CC" />

        {/* سقف مقوّس بأقواس متتالية — قاعة سوق مغطّاة */}
        {[-4.8, -1.6, 1.6, 4.8].map(z => (
            <Part key={z} kind="cyl" args={[8.4, 8.4, 0.5, 14, 1, false, 0, Math.PI]}
                color="#C9CDD2" position={[0, 8.3, z]} rotation={[0, 0, 0]} outline={0.02} />
        ))}
        <Part kind="box" args={[16.6, 0.3, 12.6]} color="#8A7A68" position={[0, 7.95, 0]} outline={0.02} />

        <Canopy w={6} z={6.3} color="#C4553F" />
    </group>
);

const Kiosk = () => (
    <group>
        <Part kind="box" args={[3.2, 0.24, 2.6]} color="#9AA3AE" position={[0, 0.12, 0]} outline={0.02} />
        <Part kind="box" args={[3, 2.5, 2.4]} color="#E0D5BC" position={[0, 1.45, 0]} />
        <Part kind="box" args={[2.4, 1.2, 0.16]} color={PALETTE.glass} position={[0, 1.7, 1.24]} outline={0} />
        <Part kind="box" args={[3.4, 0.16, 1.1]} color="#C4553F" position={[0, 2.5, 1.5]} rotation={[0.26, 0, 0]} outline={0.02} />
        <Part kind="box" args={[3.5, 0.3, 2.9]} color="#5B6470" position={[0, 2.82, 0]} outline={0.03} />
        <Part kind="box" args={[0.9, 0.5, 0.12]} color="#E8B33F" position={[0, 2.35, 1.3]} outline={0.02} />
    </group>
);

// ── الصناعي ─────────────────────────────────────────────────

const Warehouse = ({ seed = 7 }) => (
    <group>
        <Part kind="box" args={[18.4, 0.4, 13.4]} color="#8A8F96" position={[0, 0.2, 0]} outline={0.02} />
        <Part kind="box" args={[18, 7, 13]} color="#B4BAC2" position={[0, 3.9, 0]} />

        {/* تضليع معدني رأسي: العلامة التي تقول «هنغار» */}
        {[-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].map(x => (
            <Part key={x} kind="box" args={[0.3, 6.6, 0.16]} color="#98A0AA" position={[x, 3.9, 6.58]} outline={0} />
        ))}

        {/* سقف جملوني منخفض */}
        <Part kind="box" args={[18.8, 0.3, 13.6]} color="#7B828B" position={[0, 7.5, 0]} outline={0.03} />
        <Part kind="cone" args={[10.5, 2.2, 4]} color="#6B7280" position={[0, 8.6, 0]} rotation={[0, Math.PI / 4, 0]} outline={0.03} />

        {/* باب شحن ورصيف تحميل */}
        <Part kind="box" args={[5.4, 4.6, 0.3]} color="#4A515D" position={[0, 2.5, 6.6]} outline={0.02} />
        <Part kind="box" args={[6.6, 1.1, 1.8]} color="#8A8F96" position={[0, 0.55, 7.6]} outline={0.02} />

        <RoofKit w={14} d={10} y={7.65} seed={seed} />
    </group>
);

// ── المعالم ─────────────────────────────────────────────────

/** مسجد: قبّة ومئذنة — أوضح معلم يُهتدى به في مدينة عربية */
const Mosque = () => (
    <group>
        <Part kind="box" args={[14.4, 0.5, 14.4]} color="#C9C2B2" position={[0, 0.25, 0]} outline={0.03} />
        <Part kind="box" args={[13, 6.4, 13]} color="#F2EADA" position={[0, 3.7, 0]} />
        <Part kind="box" args={[13.6, 0.4, 13.6]} color="#DED5C2" position={[0, 7.1, 0]} outline={0.03} />

        {/* القبّة على رقبة مثمّنة */}
        <Part kind="cyl" args={[3.4, 3.8, 1.4, 8]} color="#E6DCC8" position={[0, 8.0, 0]} outline={0.03} />
        <Part kind="sphere" args={[3.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]}
            color="#2F7D8C" position={[0, 8.6, 0]} outline={0.03} />
        <Part kind="cyl" args={[0.1, 0.1, 1.4, 6]} color="#C9A227" position={[0, 12.7, 0]} outline={0} />
        <Part kind="sphere" args={[0.34, 10, 8]} color="#C9A227" position={[0, 13.5, 0]} outline={0} />

        {/* المئذنة */}
        <group position={[5.6, 0, -5.6]}>
            <Part kind="box" args={[2.2, 0.4, 2.2]} color="#DED5C2" position={[0, 0.2, 0]} outline={0.03} />
            <Part kind="cyl" args={[0.82, 0.95, 16, 8]} color="#F2EADA" position={[0, 8.2, 0]} />
            <Part kind="cyl" args={[1.3, 1.3, 0.3, 8]} color="#DED5C2" position={[0, 12.4, 0]} outline={0.03} />
            <Part kind="cyl" args={[1.2, 1.2, 1.5, 8]} color="#F2EADA" position={[0, 13.3, 0]} outline={0.03} />
            <Part kind="cone" args={[1.15, 2.4, 8]} color="#2F7D8C" position={[0, 15.4, 0]} outline={0.03} />
            <Part kind="sphere" args={[0.26, 8, 6]} color="#C9A227" position={[0, 16.8, 0]} outline={0} />
        </group>

        {/* أقواس المدخل */}
        {[-3.4, 0, 3.4].map(x => (
            <group key={x} position={[x, 0, 6.6]}>
                <Part kind="box" args={[2.2, 3.4, 0.5]} color="#E6DCC8" position={[0, 1.7, 0]} outline={0.02} />
                <Part kind="cyl" args={[1.05, 1.05, 0.55, 12, 1, false, 0, Math.PI]}
                    color="#2F7D8C" position={[0, 3.4, 0.02]} rotation={[Math.PI / 2, 0, 0]} outline={0.02} />
            </group>
        ))}
    </group>
);

const School = ({ night = 0 }) => (
    <group>
        <Plinth w={20.4} d={11.4} h={0.7} color="#A79C8B" />
        <Block w={20} h={8.4} d={11} kind="concrete" y={0.7 + 4.2} night={night} tint="#EFE7D6" />
        <Cornice w={20} d={11} y={9.3} color="#C2B49A" />

        {/* جناح مدخل بارز وساعة فوقه */}
        <Part kind="box" args={[6, 10, 3]} color="#E2D5BC" position={[0, 5, 6]} />
        <Part kind="box" args={[6.6, 0.4, 3.6]} color="#C2B49A" position={[0, 10.2, 6]} outline={0.03} />
        <Part kind="cyl" args={[1.1, 1.1, 0.25, 16]} color="#F6F1E6" position={[0, 8, 7.6]} rotation={[Math.PI / 2, 0, 0]} outline={0.03} />
        <Part kind="box" args={[0.1, 0.8, 0.3]} color="#2F3742" position={[0, 8.3, 7.75]} outline={0} />

        <Part kind="box" args={[5, 3, 0.3]} color="#4E7FA8" position={[0, 1.7, 7.6]} outline={0.02} />

        {/* ساحة وسلّة كرة */}
        <Part kind="box" args={[9, 0.1, 7]} color="#7E8794" position={[0, 0.05, -10]} outline={0} />
        <Part kind="cyl" args={[0.12, 0.12, 3.2, 6]} color="#6B7280" position={[0, 1.6, -13]} outline={0} />
        <Part kind="box" args={[1.6, 1.1, 0.12]} color="#F6F1E6" position={[0, 3.3, -13]} outline={0.02} />
    </group>
);

const Clinic = ({ night = 0 }) => (
    <group>
        <Plinth w={14.4} d={10.4} h={0.7} color="#A79C8B" />
        <Block w={14} h={7.2} d={10} kind="concrete" y={0.7 + 3.6} night={night} tint="#F4F6F5" />
        <Cornice w={14} d={10} y={8.1} color="#DDE3E2" />

        {/* الصليب الأخضر: علامة تُقرأ من آخر الشارع */}
        <group position={[0, 6.2, 5.2]}>
            <Part kind="box" args={[2.4, 0.7, 0.24]} color="#3FA96B" outline={0.02} />
            <Part kind="box" args={[0.7, 2.4, 0.24]} color="#3FA96B" outline={0.02} />
        </group>

        <Canopy w={5.4} z={5.6} color="#3FA96B" />
        <Part kind="box" args={[4.4, 3, 0.3]} color={PALETTE.glass} position={[0, 1.9, 5.1]} outline={0} />
    </group>
);

// ── المركبات الإضافية ───────────────────────────────────────

const Pickup = ({ body = '#5B9B6E' }) => (
    <group>
        <Part kind="box" args={[1.94, 0.26, 4.4]} color="#2F3742" position={[0, 0.42, 0]} outline={0} />
        <Part kind="box" args={[1.9, 0.62, 2.2]} color={body} position={[0, 0.78, 0.9]} />
        <Part kind="box" args={[1.72, 0.72, 1.7]} color={body} position={[0, 1.36, 0.5]} outline={0.035} />
        <Part kind="box" args={[1.58, 0.6, 0.1]} color={PALETTE.glass} position={[0, 1.4, 1.34]} rotation={[-0.32, 0, 0]} outline={0} />

        {/* الحوض الخلفي بجدرانه */}
        <Part kind="box" args={[1.9, 0.18, 2.2]} color="#3A434F" position={[0, 0.78, -1.15]} outline={0.02} />
        {[-0.92, 0.92].map(x => (
            <Part key={x} kind="box" args={[0.12, 0.62, 2.2]} color={body} position={[x, 1.08, -1.15]} outline={0.02} />
        ))}
        <Part kind="box" args={[1.9, 0.62, 0.12]} color={body} position={[0, 1.08, -2.2]} outline={0.02} />

        {[[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].map(([x, z], i) => (
            <group key={i} position={[x, 0.42, z]} rotation={[0, 0, Math.PI / 2]}>
                <Part kind="cyl" args={[0.42, 0.42, 0.34, 12]} color="#20262F" outline={0.04} />
                <Part kind="cyl" args={[0.22, 0.22, 0.38, 8]} color="#9AA3AE" outline={0} />
            </group>
        ))}

        {[-0.62, 0.62].map(x => (
            <mesh key={x} position={[x, 0.92, 2.22]}>
                <boxGeometry args={[0.42, 0.2, 0.1]} />
                <meshBasicMaterial color="#FFF6D0" />
            </mesh>
        ))}
    </group>
);

const Bus = () => (
    <group>
        <Part kind="box" args={[2.5, 0.3, 10.4]} color="#2F3742" position={[0, 0.52, 0]} outline={0} />
        <Part kind="box" args={[2.56, 2.5, 10.2]} color="#E8B33F" position={[0, 1.95, 0]} />
        <Part kind="box" args={[2.6, 0.5, 10.2]} color="#C4553F" position={[0, 1.2, 0]} outline={0.02} />

        {/* شريط زجاج متّصل بعوارض — ما يجعله باصاً */}
        <Part kind="box" args={[2.62, 1.05, 8.4]} color={PALETTE.glass} position={[0, 2.5, -0.3]} outline={0} />
        {[-3.4, -1.7, 0, 1.7, 3.4].map(z => (
            <Part key={z} kind="box" args={[2.66, 1.1, 0.14]} color="#E8B33F" position={[0, 2.5, z]} outline={0} />
        ))}
        <Part kind="box" args={[2.3, 1.2, 0.14]} color={PALETTE.glass} position={[0, 2.4, 5.12]} outline={0} />

        <Part kind="box" args={[2.66, 0.3, 10.3]} color="#D6A234" position={[0, 3.28, 0]} outline={0.03} />
        <Part kind="box" args={[1.0, 0.34, 0.12]} color="#2F3742" position={[0, 3.0, 5.14]} outline={0} />

        {[[-1.2, 3.4], [1.2, 3.4], [-1.2, -3.2], [1.2, -3.2]].map(([x, z], i) => (
            <group key={i} position={[x, 0.52, z]} rotation={[0, 0, Math.PI / 2]}>
                <Part kind="cyl" args={[0.52, 0.52, 0.36, 12]} color="#20262F" outline={0.04} />
                <Part kind="cyl" args={[0.26, 0.26, 0.4, 8]} color="#9AA3AE" outline={0} />
            </group>
        ))}

        {[-0.8, 0.8].map(x => (
            <mesh key={x} position={[x, 1.1, 5.16]}>
                <boxGeometry args={[0.5, 0.24, 0.1]} />
                <meshBasicMaterial color="#FFF6D0" />
            </mesh>
        ))}
    </group>
);

export {
    Block, nightFactor as computeNight,
    TowerGlass, TowerBrick, Apartment, Villa,
    ShopRow, MarketHall, Kiosk, Warehouse,
    Mosque, School, Clinic,
    Pickup, Bus
};
