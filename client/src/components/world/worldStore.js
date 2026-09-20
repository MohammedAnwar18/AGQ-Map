import { create } from 'zustand';
import {
    field, flattenArea, serializeField, loadField, measureField,
    generateTerrain as buildField,
    flattenTerrain as levelField,
    DEFAULT_GENERATION
} from './terrain.js';

/* ============================================================
   مخزن العالم — مصدر الحقيقة الوحيد لمحرّر المشهد

   طبقة الواجهة (لوحات HTML) وطبقة المشهد (R3F) لا تتحدّثان مباشرة:
   كلتاهما تقرأ وتكتب هنا. هذا يمنع تمرير الخصائص عبر الـ Canvas
   ويُبقي إعادة الرسم محصورة في المكوّن الذي يشترك في القيمة فعلاً.

   أربعة أقسام كما في خطة المشروع: البيئة، الكيانات، الأصول، التسجيل.
   ============================================================ */

// حدود العالم بالمتر — تُستخدم في المشهد وفي محرّر العقد معاً.
// اتّسعت مع المدينة: شبكة ستّة مربّعات سكنية تمتدّ ٤٢٢ متراً.
export const WORLD_BOUNDS = 200;

const DEFAULT_ENVIRONMENT = {
    timeOfDay: 17.2,        // ساعة (0-24) — الافتراضي غروب دافئ
    climate: 0.25,          // 0 مشمس ← 1 غائم
    foliageDensity: 0.55,   // 0-1 → عدد الأشجار
    buildingStyle: 'suburban',

    // toon: تظليل مسطّح بدرجات حادّة | real: خامات PBR كما صُدّرت
    renderStyle: 'toon',
    outlines: true,         // الحدود المحيطة — تُضاعف الرسمات، فتُطفأ عند الحاجة
    heavyShading: false,    // SSAO — ثقيل، فيبقى اختيارياً

    // الطريق المبنيّ في المشهد — شريط مستقيم واحد من قبل المدينة.
    // مطفأ الآن لأن للمدينة شبكة شوارعها، ويبقى لمن يبني من الصفر.
    defaultRoad: false,
    gridSnap: true,
    gridSize: 8            // متر — مقاس قطعة الطريق الواحدة
};

const DEFAULT_ENTITIES = {
    traffic: true,
    npcs: true
};

/* ── التضاريس والماء ──────────────────────────────────────────
   الإعدادات هنا؛ أما شبكة الارتفاعات نفسها فخارج المخزن في
   terrain.js، لأنها تُكتب بالفرشاة ستّين مرّة في الثانية.

   الافتراضي أرض مستوية وبلا ماء: عالم محفوظ قبل هذه الطبقة يُفتح
   كما كان تماماً، ولا يدفع أحد ثمن ميزة لم يطلبها. */
const DEFAULT_TERRAIN = {
    ...DEFAULT_GENERATION,
    water: false,
    waterLevel: -1.2,      // متر — ما تحته يمتلئ ماءً
    waveHeight: 0.45,
    autoFlatten: true      // تسوية الأرض تحت بلاطة الشارع عند رصفها
};

/* ── الفيزياء ────────────────────────────────────────────────
   مُطفأة افتراضياً، وتُحمَّل حزمتها كسولاً عند أول تشغيل: من لا
   يشغّلها لا يُنزّل منها بايتاً واحداً. */
const DEFAULT_PHYSICS = {
    enabled: false,
    gravity: 9.81,
    debug: false,
    vehicle: true,
    debris: 0,
    buoyancy: true
};

/* ── المدينة ──────────────────────────────────────────────────
   المخطّط كلّه يُولَّد من هذه الأرقام، فلا يُحفظ منه في ملف العالم
   إلا هي. ثلاثمئة مبنى تُصبح ثلاثة أسطر، ومن يفتح عالمك يرى
   المدينة نفسها بلا أن يُنزّل مخطّطها. */
const DEFAULT_CITY = {
    enabled: true,
    seed: 20260920,
    density: 1        // 0.5 إلى 1 — تُخفّف المباني على الأجهزة الضعيفة
};

const DEFAULT_BRUSH = {
    tool: null,       // null يعني أن الفرشاة مطفأة والنقر يضع/يحدّد كالعادة
    radius: 12,
    strength: 0.7
};

/**
 * المشهد الابتدائي.
 *
 * فارغ عمداً منذ أن صارت المدينة تُولَّد: كانت هنا اثنا عشر بيتاً
 * تملأ الفراغ، وهي الآن تقع وسط الشوارع. ما يضعه المستخدم بيده
 * يبقى وحده في ‎placed‎، والمدينة خلفية تحته.
 */
const seedWorld = () => [];

let counter = 0;
const nextId = () => `a_${Date.now().toString(36)}_${++counter}`;

/**
 * البلاطات التي تُبنى منها الشوارع والتضاريس. مذكورة هنا لا في سجلّ
 * الأصول حتى لا يستورد المخزن طبقة العرض — ويبقى قابلاً للاختبار وحده.
 */
export const TILE_TYPES = new Set([
    'road_straight', 'road_cross', 'road_turn', 'road_tee',
    'crosswalk', 'sidewalk', 'plaza',
    'grass_patch', 'dirt_patch', 'water'
]);

const round2 = (n) => +Number(n).toFixed(2);

const snapFor = (type, x, z, gridSnap, gridSize) => {
    const size = gridSize || 8;
    if (!TILE_TYPES.has(type) && !gridSnap) return { x: round2(x), z: round2(z) };

    // البلاطة تُركَّز في خليّتها، فتتلاصق حوافّها مع جاراتها تماماً
    if (TILE_TYPES.has(type)) {
        return {
            x: Math.round((x - size / 2) / size) * size + size / 2,
            z: Math.round((z - size / 2) / size) * size + size / 2
        };
    }

    // وغيرها يلتقط أنصاف الخلايا: دقّة أعلى دون أن يفقد الانتظام
    const half = size / 2;
    return { x: Math.round(x / half) * half, z: Math.round(z / half) * half };
};

/**
 * موضع المشاهد الحيّ.
 *
 * خارج المخزن عمداً: يُكتب في كل إطار أثناء المشي، ولو مرّ
 * من zustand لأعاد رسم شجرة المكوّنات ستين مرّة في الثانية.
 * المشهد يكتب هنا والخريطة تقرأ منه في حلقتها الخاصة.
 */
export const live = { x: 0, z: 96, heading: 0, moving: false };

/**
 * حالة المركبة الحيّة.
 *
 * هنا لا في طبقة الفيزياء: عدّاد السرعة في الواجهة يقرأ منه، ولو
 * استورده من هناك لجرّ حزمة Rapier إلى كل من يفتح المحرّر — وهي
 * حزمة لا يدفع ثمنها إلا من شغّل الفيزياء فعلاً.
 */
export const drive = { speed: 0, gear: 'ط', onGround: 0, x: 0, z: 0, heading: 0 };

/** مدخلات المشي والقيادة — من لوحة المفاتيح أو عصا اللمس، بلا حالة React */
export const input = { forward: 0, strafe: 0, run: false, brake: false, yaw: 0, pitch: 0 };

export const resetInput = () => {
    input.forward = 0; input.strafe = 0; input.run = false; input.brake = false;
    input.yaw = 0; input.pitch = 0;
};

export const useWorld = create((set, get) => ({
    // ── البيئة ──
    environment: { ...DEFAULT_ENVIRONMENT },
    setEnv: (key, value) => set(state => ({
        environment: { ...state.environment, [key]: value }
    })),

    // ── الكيانات ──
    entities: { ...DEFAULT_ENTITIES },
    toggleEntity: (key) => set(state => ({
        entities: { ...state.entities, [key]: !state.entities[key] }
    })),

    // ── الأصول الموضوعة ──
    placed: seedWorld(),
    selectedId: null,

    // نوع الأصل المنتظر وضعه — غير فارغ يعني «وضع الوضع» مفعّل
    placementType: null,

    setPlacement: (type) => set(state => ({
        placementType: state.placementType === type ? null : type,
        selectedId: null
    })),

    place: (type, x, z) => {
        const { gridSnap, gridSize } = get().environment;

        // البلاطات تلتقط الشبكة دائماً مهما كان الإعداد: قطعتا شارع
        // بينهما نصف متر تُقرأ كخطأ لا كتصميم
        const snapped = snapFor(type, x, z, gridSnap, gridSize);

        // البلاطة صفيحة مستوية: على منحدر تبقى حافّتها معلّقة في
        // الهواء. نُسوّي ما تحتها أوّلاً فيصير الشارع مشقوقاً في
        // الأرض كما يُشقّ فعلاً، لا مرمياً فوقها.
        const terrain = get().terrain;
        if (terrain.autoFlatten && field.touched && TILE_TYPES.has(type)) {
            flattenArea(snapped.x, snapped.z, gridSize || 8);
            set(state => ({ terrainRevision: state.terrainRevision + 1 }));
        }

        const item = { id: nextId(), type, ...snapped, rotation: 0, scale: 1 };
        set(state => ({ placed: [...state.placed, item], selectedId: item.id }));
        return item.id;
    },

    moveItem: (id, x, z) => set(state => {
        const item = state.placed.find(p => p.id === id);
        if (!item) return {};

        const { gridSnap, gridSize } = state.environment;
        const snapped = snapFor(item.type, x, z, gridSnap, gridSize);

        return { placed: state.placed.map(p => (p.id === id ? { ...p, ...snapped } : p)) };
    }),

    updateItem: (id, patch) => set(state => ({
        placed: state.placed.map(p => (p.id === id ? { ...p, ...patch } : p))
    })),

    removeItem: (id) => set(state => ({
        placed: state.placed.filter(p => p.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId
    })),

    select: (id) => set({ selectedId: id, placementType: null }),

    // ── وضع التجوّل ──
    // orbit: نظرة مدارية للتحرير | walk: منظور الشخص الأوّل | drive: قيادة
    mode: 'orbit',
    setMode: (mode) => set(state => ({
        mode,
        placementType: null,
        // الفرشاة أداة تحرير: لا معنى لها ونحن داخل العالم
        brush: mode === 'orbit' ? state.brush : { ...state.brush, tool: null },
        // القيادة بلا فيزياء ليست قيادة — نُشغّلها معها
        physics: mode === 'drive'
            ? { ...state.physics, enabled: true, vehicle: true }
            : state.physics
    })),

    // ── المدينة ──
    // المخطّط نفسه يُبنى في المشهد بـ useMemo من هذه الأرقام: المخزن
    // لا يحمل ثلاثمئة مبنى، بل البذرة التي تُولّدها
    city: { ...DEFAULT_CITY },

    setCity: (key, value) => set(state => ({ city: { ...state.city, [key]: value } })),

    /** مدينة جديدة كاملة — نفس الشوارع بأحياء مختلفة */
    rollCity: () => set(state => ({
        city: { ...state.city, seed: Math.floor(Math.random() * 900000) + 1000 }
    })),

    // ── التضاريس ──
    // العدّاد وحده في المخزن؛ الارتفاعات في terrain.js خارج React.
    // رفعه يُعلم المشهد أن يُعيد بناء الشبكة والهياكل، ويحدث مرّة
    // عند نهاية السحبة لا مع كل بكسل.
    terrain: { ...DEFAULT_TERRAIN },
    terrainRevision: 0,

    setTerrain: (key, value) => set(state => ({
        terrain: { ...state.terrain, [key]: value }
    })),

    bumpTerrain: () => set(state => ({ terrainRevision: state.terrainRevision + 1 })),

    generateTerrain: (overrides = {}) => {
        const state = get();
        const t = { ...state.terrain, ...overrides };

        // الطريق الجاهز شريط مستقيم: نُسطّح ممرّه كي لا يتسلّق كل نتوء
        const corridor = state.environment.defaultRoad !== false ? 11 : 0;

        buildField({
            seed: t.seed,
            amplitude: t.amplitude,
            roughness: t.roughness,
            featureScale: t.featureScale,
            corridor
        });

        set(s => ({ terrain: t, terrainRevision: s.terrainRevision + 1 }));
        return measureField();
    },

    levelTerrain: () => {
        levelField();
        set(s => ({ terrainRevision: s.terrainRevision + 1 }));
    },

    // ── الفرشاة ──
    brush: { ...DEFAULT_BRUSH },
    setBrush: (key, value) => set(state => ({
        brush: { ...state.brush, [key]: value },
        // اختيار أداة نحت يُلغي وضع الوضع: النقرة الواحدة لا تفعل شيئين
        placementType: key === 'tool' && value ? null : state.placementType
    })),

    // ── الفيزياء ──
    physics: { ...DEFAULT_PHYSICS },
    setPhysics: (key, value) => set(state => {
        const next = { ...state.physics, [key]: value };
        return {
            physics: next,
            // إطفاء الفيزياء ونحن نقود يُعيدنا إلى التحرير بدل كاميرا معلّقة
            mode: key === 'enabled' && !value && state.mode === 'drive' ? 'orbit' : state.mode
        };
    }),

    // ── مجسماتي المستوردة ──
    // الملفات نفسها في IndexedDB؛ هذه بطاقاتها فقط
    customAssets: [],
    setCustomAssets: (list) => set({ customAssets: list }),
    addCustomAsset: (card) => set(state => ({ customAssets: [...state.customAssets, card] })),
    dropCustomAsset: (key) => set(state => ({
        customAssets: state.customAssets.filter(c => c.key !== key),
        // ونزيل ما وُضِع منه في المشهد، وإلا بقيت صناديق بديلة معلّقة
        placed: state.placed.filter(p => p.type !== `custom:${key}`),
        placementType: state.placementType === `custom:${key}` ? null : state.placementType
    })),

    // ── الكاميرا ──
    // المشهد يقرأ هذا الهدف ويتحرّك إليه بالتنعيم، فلا تقفز الكاميرا
    cameraTarget: { x: 0, z: 0 },
    setCameraTarget: (x, z) => set({ cameraTarget: { x, z } }),

    // ── الحفظ والاسترجاع ──
    exportWorld: () => {
        const { environment, entities, placed, cameraTarget, terrain, physics, city } = get();
        return {
            version: 2,
            savedAt: new Date().toISOString(),
            environment,
            entities,
            cameraTarget,
            placed,
            city,
            terrain,
            physics,
            // null حين تكون الأرض مستوية — لا نُثقل الملف بستّة عشر ألف صفر
            heightField: serializeField()
        };
    },

    importWorld: (data) => {
        if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');

        // ملف من قبل طبقة التضاريس لا يحمل حقل ارتفاعات: نُسوّي الأرض
        // فيُفتح مستوياً كما حُفظ، لا فوق تضاريس الجلسة السابقة
        if (data.heightField) loadField(data.heightField);
        else levelField();

        // نُدمج فوق الافتراضي بدل الاستبدال، فملف قديم ينقصه مفتاح لا يكسر المشهد
        set(state => ({
            environment: { ...DEFAULT_ENVIRONMENT, ...(data.environment || {}) },
            entities: { ...DEFAULT_ENTITIES, ...(data.entities || {}) },
            city: { ...DEFAULT_CITY, ...(data.city || {}) },
            terrain: { ...DEFAULT_TERRAIN, ...(data.terrain || {}) },
            physics: { ...DEFAULT_PHYSICS, ...(data.physics || {}) },
            brush: { ...DEFAULT_BRUSH },
            terrainRevision: state.terrainRevision + 1,
            mode: 'orbit',
            cameraTarget: data.cameraTarget || { x: 0, z: 0 },
            placed: Array.isArray(data.placed)
                ? data.placed
                    .filter(p => p && typeof p.type === 'string'
                        && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)))
                    .map(p => ({
                        id: p.id || nextId(),
                        type: p.type,
                        x: Number(p.x),
                        z: Number(p.z),
                        rotation: Number(p.rotation) || 0,
                        scale: Number(p.scale) || 1
                    }))
                : [],
            selectedId: null,
            placementType: null
        }));
    },

    resetWorld: () => {
        levelField();
        set(state => ({
            environment: { ...DEFAULT_ENVIRONMENT },
            entities: { ...DEFAULT_ENTITIES },
            city: { ...DEFAULT_CITY },
            terrain: { ...DEFAULT_TERRAIN },
            physics: { ...DEFAULT_PHYSICS },
            brush: { ...DEFAULT_BRUSH },
            terrainRevision: state.terrainRevision + 1,
            mode: 'orbit',
            placed: seedWorld(),
            cameraTarget: { x: 0, z: 0 },
            selectedId: null,
            placementType: null
        }));
    },

    clearAll: () => set({ placed: [], selectedId: null, placementType: null })
}));
