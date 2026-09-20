import * as THREE from 'three';

/* ============================================================
   واجهات المباني

   المشكلة: مدينة فيها ثلاثمئة مبنى، ولو رُسمت نوافذ كل مبنى قطعاً
   مستقلّة لصار المشهد عشرات الآلاف من الرسمات. ولو رُسمت بلا نوافذ
   لصارت صناديق.

   الحلّ هو حلّ محرّكات الألعاب: صورة نافذة واحدة تتكرّر على الواجهة.
   لكن التكرار هنا ليس على الخامة بل **مخبوز في إحداثيات الهندسة**:
   لكل وجه من الصندوق نضرب إحداثياته بقياسه الحقيقي بالمتر، فتخرج
   نافذة بمقاس واحد على برج من ستّين متراً وعلى بيت من ستّة — من
   خامة واحدة مشتركة بينهما. صورة واحدة لكل طراز، لا واحدة لكل مبنى.

   ولأن الصورة تحمل قناع الزجاج وحده في قناة الإضاءة الذاتية، تُضيء
   النوافذ ليلاً ويبقى الجدار مظلماً.
   ============================================================ */

// متر لكل خليّة نافذة — القياس الذي تُبنى عليه كل الواجهات
export const FACADE_CELL = 3.4;

const CANVAS = 128;

const cache = new Map();

/** رسم خليّة واحدة تتكرّر بلا خطّ ظاهر عند حوافّها */
const paintCell = (ctx, spec) => {
    const { wall, glass, frame, margin, sill } = spec;

    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    // تعريق خفيف على الجدار: سطح مصمت تماماً يُقرأ بلاستيكاً
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    for (let i = 0; i < 90; i++) {
        const x = (i * 37.7) % CANVAS;
        const y = (i * 71.3) % CANVAS;
        ctx.fillRect(x, y, 2, 2);
    }

    const m = Math.round(CANVAS * margin);
    const w = CANVAS - m * 2;
    const h = Math.round(w * 0.86);
    const top = Math.round((CANVAS - h) / 2);

    // إطار ثم زجاج غائر داخله
    ctx.fillStyle = frame;
    ctx.fillRect(m - 3, top - 3, w + 6, h + 6);

    ctx.fillStyle = glass;
    ctx.fillRect(m, top, w, h);

    // انعكاس مائل في ركن الزجاج
    const gradient = ctx.createLinearGradient(m, top, m + w, top + h);
    gradient.addColorStop(0, 'rgba(255,255,255,.34)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,.05)');
    gradient.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = gradient;
    ctx.fillRect(m, top, w, h);

    // عارضة رأسية وأخرى أفقية — بهما تُقرأ نافذةً لا لوحاً
    ctx.fillStyle = frame;
    ctx.fillRect(m + w / 2 - 1.5, top, 3, h);
    ctx.fillRect(m, top + h * 0.45, w, 3);

    if (sill) {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(m - 4, top + h + 3, w + 8, 4);
    }
};

/** قناع الزجاج وحده — ما يُضيء ليلاً */
const paintLit = (ctx, spec, seedOffset) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS, CANVAS);

    const m = Math.round(CANVAS * spec.margin);
    const w = CANVAS - m * 2;
    const h = Math.round(w * 0.86);
    const top = Math.round((CANVAS - h) / 2);

    // ليست كل نافذة مضاءة، لكن الخليّة الواحدة تتكرّر — فنُخفت القناع
    // بدل إطفاء نوافذ بعينها. النتيجة توهّج عامّ لا مصابيح متطابقة.
    ctx.fillStyle = spec.lit;
    ctx.globalAlpha = 0.62 + seedOffset * 0.2;
    ctx.fillRect(m, top, w, h);
    ctx.globalAlpha = 1;
};

const SPECS = {
    glass: {
        wall: '#8D9AAB', glass: '#5E8CB0', frame: '#6C7887',
        margin: 0.07, sill: false, lit: '#FFE9A8'
    },
    office: {
        wall: '#B9BEC6', glass: '#6E93B4', frame: '#8A9099',
        margin: 0.13, sill: false, lit: '#FFF0C0'
    },
    plaster: {
        wall: '#EADFC9', glass: '#7FA8C4', frame: '#F4EEE2',
        margin: 0.2, sill: true, lit: '#FFD98A'
    },
    brick: {
        wall: '#C08464', glass: '#79A0BD', frame: '#E8DCCB',
        margin: 0.2, sill: true, lit: '#FFD07A'
    },
    concrete: {
        wall: '#C6C2B8', glass: '#7C9AAE', frame: '#DAD5C9',
        margin: 0.18, sill: true, lit: '#FFE1A0'
    },
    shop: {
        wall: '#E3D6BE', glass: '#86B3C9', frame: '#B9865A',
        margin: 0.1, sill: false, lit: '#FFE7B0'
    }
};

export const FACADE_KINDS = Object.keys(SPECS);

const makeTexture = (draw) => {
    if (typeof document === 'undefined') return null;   // Node: لا لوحة رسم

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS;
    canvas.height = CANVAS;
    draw(canvas.getContext('2d'));

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
};

/**
 * خامتا الطراز: اللون والإضاءة الذاتية.
 *
 * محفوظتان في خريطة مشتركة: ثلاثمئة مبنى تتقاسم ستّ صور لا ثلاثمئة.
 */
export const facadeMaps = (kind = 'plaster') => {
    if (cache.has(kind)) return cache.get(kind);

    const spec = SPECS[kind] || SPECS.plaster;
    const seedOffset = (FACADE_KINDS.indexOf(kind) % 3) / 3;

    const maps = {
        map: makeTexture(ctx => paintCell(ctx, spec)),
        emissiveMap: makeTexture(ctx => paintLit(ctx, spec, seedOffset)),
        lit: spec.lit
    };

    cache.set(kind, maps);
    return maps;
};

export const disposeFacades = () => {
    for (const maps of cache.values()) {
        maps.map?.dispose();
        maps.emissiveMap?.dispose();
    }
    cache.clear();
};

/**
 * صندوق إحداثياته بمقياس المتر.
 *
 * ‎BoxGeometry‎ تُعطي كل وجه إحداثيات من صفر إلى واحد، فتتمدّد النافذة
 * مع المبنى. نضرب إحداثيات كل وجه بقياسه الحقيقي مقسوماً على خليّة
 * النافذة، فتصير النافذة بمقاس ثابت مهما كبر المبنى — وهو ما يجعل
 * العين تقرأ ارتفاعه من عدد صفوف نوافذه.
 *
 * ترتيب أوجه ‎BoxGeometry‎: ‎+x, -x, +y, -y, +z, -z‎.
 */
const boxCache = new Map();

export const facadeBox = (w, h, d, cell = FACADE_CELL) => {
    // المقاسات محدودة: كل طراز مبنى قياس واحد، والتفاوت بينها في
    // مقياس المجموعة لا في الهندسة. فمئتان وستّون مبنى تتقاسم نحو
    // خمس عشرة هندسة لا مئتين وستّين.
    const key = `${w}|${h}|${d}|${cell}`;
    const cached = boxCache.get(key);
    if (cached) return cached;

    const geometry = new THREE.BoxGeometry(w, h, d);
    const uv = geometry.attributes.uv;

    // (عرض الوجه، ارتفاعه) لكل وجه بالترتيب أعلاه
    const faces = [
        [d, h], [d, h],
        [w, d], [w, d],
        [w, h], [w, h]
    ];

    let vertex = 0;
    for (const [fw, fh] of faces) {
        const su = Math.max(1, Math.round(fw / cell)) ;
        const sv = Math.max(1, Math.round(fh / cell));

        // أربعة رؤوس لكل وجه. التقريب إلى عدد صحيح يضمن أن تنتهي
        // الواجهة بنافذة كاملة لا بنصف نافذة مقصوصة عند الركن.
        for (let i = 0; i < 4; i++) {
            uv.setXY(vertex, uv.getX(vertex) * su, uv.getY(vertex) * sv);
            vertex++;
        }
    }

    uv.needsUpdate = true;
    boxCache.set(key, geometry);
    return geometry;
};

/** كم صفّ نوافذ يحمل هذا الارتفاع — للعرض في الواجهة */
export const floorsIn = (height) => Math.max(1, Math.round(height / FACADE_CELL));
