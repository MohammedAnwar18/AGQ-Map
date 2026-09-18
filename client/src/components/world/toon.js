import * as THREE from 'three';

/* ============================================================
   لغة المشهد البصرية: خريطة التدرّج الكرتونية، وموضع الشمس،
   وألوان السماء عبر ساعات اليوم.

   كل ما هنا حساب خالص بلا React، فيمكن استدعاؤه من داخل حلقة
   الإطار دون أن يُسبّب إعادة رسم.
   ============================================================ */

// ── خريطة التدرّج: قلب المظهر الأنمي ──
// أربع درجات حادّة بدل تدرّج ناعم، وNearestFilter هو ما يمنع
// المتصفّح من تنعيم الحواف بينها فيعود المظهر واقعياً.
export const makeGradientMap = (steps = 4) => {
    const data = new Uint8Array(steps);
    for (let i = 0; i < steps; i++) {
        data[i] = Math.round((i / (steps - 1)) * 255);
    }

    const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
};

// نسخة واحدة تكفي المشهد كلّه — خريطة التدرّج لا تحمل حالة
let sharedGradient = null;
export const gradientMap = () => {
    if (!sharedGradient) sharedGradient = makeGradientMap(4);
    return sharedGradient;
};

/**
 * يحوّل مشهداً مجلوباً (.glb) إلى المظهر الكرتوني: يستبدل كل خامة
 * بـ MeshToonMaterial محتفظاً باللون والخريطة الأصليين، ويفعّل الظلال.
 *
 * تُستدعى بعد useGLTF حين تجهز الأصول الحقيقية؛ الأشكال الإجرائية
 * تُبنى كرتونية من أصلها فلا تمرّ من هنا.
 */
export const applyToonMaterial = (root) => {
    const gm = gradientMap();

    root.traverse((child) => {
        if (!child.isMesh) return;

        const source = Array.isArray(child.material) ? child.material[0] : child.material;

        child.material = new THREE.MeshToonMaterial({
            color: source?.color ? source.color.clone() : new THREE.Color('#ffffff'),
            map: source?.map || null,
            gradientMap: gm,
            transparent: source?.transparent || false,
            opacity: source?.opacity ?? 1,
            side: source?.side ?? THREE.FrontSide
        });

        child.castShadow = true;
        child.receiveShadow = true;
    });

    return root;
};

// ── الشمس ──

const SUN_DISTANCE = 120;

// نحدّ أقصى ارتفاع للشمس دون السمت: الظلال تبقى طويلة ومتّجهة،
// وهو ما يعطي المشهد عمقه بدل ظلال الظهيرة المسطّحة تحت المجسمات.
const MAX_ELEVATION = THREE.MathUtils.degToRad(52);

/** موضع الشمس لساعة معيّنة — يُعيد [x, y, z] وارتفاعاً مُطبّعاً */
export const sunFor = (hour) => {
    // النهار من ٦ صباحاً إلى ٦ مساءً؛ خارجه الشمس تحت الأفق
    const dayT = (hour - 6) / 12;
    const elevation = Math.sin(dayT * Math.PI) * MAX_ELEVATION;
    const azimuth = Math.PI * (0.12 + dayT * 0.76);

    const cosEl = Math.cos(elevation);

    return {
        position: [
            SUN_DISTANCE * cosEl * Math.cos(azimuth),
            SUN_DISTANCE * Math.sin(elevation),
            SUN_DISTANCE * cosEl * Math.sin(azimuth)
        ],
        // 0 عند الأفق، 1 عند الذروة — نشتقّ منه شدّة الضوء ودفء لونه
        height: Math.max(0, Math.sin(elevation) / Math.sin(MAX_ELEVATION))
    };
};

// ── لوحة السماء عبر اليوم ──
// مفاتيح مرتّبة بالساعة، ونستوفي خطياً بين كل مفتاحين.

const KEYS = [
    { h: 0,    top: '#070C1C', bottom: '#131F3E', sun: '#8FA6D8', light: '#9FB6E8', intensity: 0.18, ambient: 0.34 },
    { h: 5,    top: '#132145', bottom: '#4A3B63', sun: '#D89A86', light: '#C08CA0', intensity: 0.30, ambient: 0.38 },
    { h: 6.6,  top: '#3E5F8A', bottom: '#FFB07C', sun: '#FFD2A0', light: '#FFC58F', intensity: 1.35, ambient: 0.44 },
    { h: 9,    top: '#57A3DE', bottom: '#BFE6FF', sun: '#FFF0BE', light: '#FFE9B0', intensity: 2.05, ambient: 0.52 },
    { h: 12,   top: '#4C9FE0', bottom: '#CFEBFF', sun: '#FFF8DA', light: '#FFF4CE', intensity: 2.30, ambient: 0.58 },
    { h: 15.5, top: '#5AA2DA', bottom: '#DCE9F5', sun: '#FFEEB4', light: '#FFE9B0', intensity: 2.10, ambient: 0.54 },
    { h: 17.4, top: '#6E8FC0', bottom: '#FFD2A1', sun: '#FFCF8C', light: '#FFD79A', intensity: 1.70, ambient: 0.48 },
    { h: 18.6, top: '#2F4A7A', bottom: '#FF9E63', sun: '#FF9A4D', light: '#FFA86B', intensity: 1.05, ambient: 0.42 },
    { h: 20,   top: '#182A55', bottom: '#5C4570', sun: '#9E7FA8', light: '#8E86C0', intensity: 0.34, ambient: 0.36 },
    { h: 24,   top: '#070C1C', bottom: '#131F3E', sun: '#8FA6D8', light: '#9FB6E8', intensity: 0.18, ambient: 0.34 }
];

const cA = new THREE.Color();
const cB = new THREE.Color();

const mixHex = (a, b, t) => {
    cA.set(a);
    cB.set(b);
    return `#${cA.lerp(cB, t).getHexString()}`;
};

// لون الطقس الغائم: نجرّ كل لون نحوه بمقدار «الغيمية»
const OVERCAST = '#AFB8C4';

export const skyFor = (hour, climate = 0) => {
    const h = ((hour % 24) + 24) % 24;

    let lo = KEYS[0];
    let hi = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
        if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { lo = KEYS[i]; hi = KEYS[i + 1]; break; }
    }

    const span = hi.h - lo.h || 1;
    const t = THREE.MathUtils.clamp((h - lo.h) / span, 0, 1);
    const c = THREE.MathUtils.clamp(climate, 0, 1);

    // الغيوم تُسطّح التباين: تُبهت الألوان، تُضعف الشمس، وترفع الإضاءة المحيطة
    const dim = 1 - c * 0.45;

    return {
        top: mixHex(mixHex(lo.top, hi.top, t), OVERCAST, c * 0.55),
        bottom: mixHex(mixHex(lo.bottom, hi.bottom, t), OVERCAST, c * 0.62),
        sun: mixHex(mixHex(lo.sun, hi.sun, t), OVERCAST, c * 0.5),
        light: mixHex(mixHex(lo.light, hi.light, t), '#E8EEF5', c * 0.5),
        intensity: THREE.MathUtils.lerp(lo.intensity, hi.intensity, t) * dim,
        ambient: THREE.MathUtils.lerp(lo.ambient, hi.ambient, t) * (1 + c * 0.55)
    };
};

/** كثافة الضباب ولونه — يزدادان مع الغيمية ومع اقتراب الليل */
export const fogFor = (hour, climate, bottomColor) => {
    const night = hour < 6 || hour > 19 ? 1 : 0;
    return {
        color: bottomColor,
        density: 0.0016 + climate * 0.0052 + night * 0.0016
    };
};

// ── لوحة ألوان المجسمات ──
// عائلة واحدة مشبعة قليلاً وفاتحة، وهو ما يجعل الحزم تبدو متجانسة
export const PALETTE = {
    grass: '#86C45A',
    grassDark: '#6FAE49',
    road: '#5B6270',
    roadLine: '#F2E9C9',
    sidewalk: '#C9C2B2',
    trunk: '#8A5A36',
    leaf: '#4FA85C',
    leafLight: '#6DC06F',
    pine: '#357A4E',
    palm: '#5FB86A',
    wallA: '#F3EAD8',
    wallB: '#D9E7F0',
    wallC: '#F6DCC4',
    roofA: '#D4564B',
    roofB: '#4E7FA8',
    roofC: '#B4654A',
    tower: '#B9C3CE',
    towerGlass: '#7FA9C9',
    carA: '#D45B4A',
    carB: '#4E8FC0',
    carC: '#E8C15A',
    glass: '#BFE2F2',
    wood: '#A9784E',
    metal: '#9AA3AE',
    skin: '#F0C39A',
    outline: '#22303F'
};
