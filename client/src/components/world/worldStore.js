import { create } from 'zustand';

/* ============================================================
   مخزن العالم — مصدر الحقيقة الوحيد لمحرّر المشهد

   طبقة الواجهة (لوحات HTML) وطبقة المشهد (R3F) لا تتحدّثان مباشرة:
   كلتاهما تقرأ وتكتب هنا. هذا يمنع تمرير الخصائص عبر الـ Canvas
   ويُبقي إعادة الرسم محصورة في المكوّن الذي يشترك في القيمة فعلاً.

   أربعة أقسام كما في خطة المشروع: البيئة، الكيانات، الأصول، التسجيل.
   ============================================================ */

// حدود العالم بالمتر — تُستخدم في المشهد وفي محرّر العقد معاً
export const WORLD_BOUNDS = 70;

const DEFAULT_ENVIRONMENT = {
    timeOfDay: 17.2,        // ساعة (0-24) — الافتراضي غروب دافئ
    climate: 0.25,          // 0 مشمس ← 1 غائم
    foliageDensity: 0.55,   // 0-1 → عدد الأشجار
    buildingStyle: 'suburban',
    outlines: true,         // الحدود المحيطة — تُضاعف الرسمات، فتُطفأ عند الحاجة
    heavyShading: false,    // SSAO — ثقيل، فيبقى اختيارياً

    // الطريق المبنيّ في المشهد — يُطفأ لمن يرسم شبكته بنفسه
    defaultRoad: true,
    gridSnap: true,
    gridSize: 8            // متر — مقاس قطعة الطريق الواحدة
};

const DEFAULT_ENTITIES = {
    traffic: true,
    npcs: true
};

// مشهد البداية: بيوت على الجانبين وأشجار متفرّقة، كي لا تُفتح اللوحة فارغة
const seedWorld = () => {
    const placed = [];
    let n = 0;
    const id = () => `seed_${++n}`;

    for (let i = 0; i < 6; i++) {
        const z = -42 + i * 17;
        placed.push({ id: id(), type: 'house', x: -15.5, z, rotation: Math.PI / 2, scale: 1 });
        placed.push({ id: id(), type: 'house', x: 15.5, z: z + 8, rotation: -Math.PI / 2, scale: 1 });
    }

    placed.push({ id: id(), type: 'pine', x: -24, z: -30, rotation: 0, scale: 1.2 });
    placed.push({ id: id(), type: 'pine', x: -27, z: -12, rotation: 0, scale: 1 });
    placed.push({ id: id(), type: 'palm', x: 23, z: -18, rotation: 0, scale: 1.1 });
    placed.push({ id: id(), type: 'palm', x: 26, z: 4, rotation: 0, scale: 1 });
    placed.push({ id: id(), type: 'tree', x: -22, z: 14, rotation: 0, scale: 1.15 });
    placed.push({ id: id(), type: 'tree', x: 22, z: 26, rotation: 0, scale: 1 });
    placed.push({ id: id(), type: 'bench', x: -9.5, z: -4, rotation: Math.PI / 2, scale: 1 });
    placed.push({ id: id(), type: 'lamp', x: -9.5, z: 20, rotation: 0, scale: 1 });
    placed.push({ id: id(), type: 'car', x: 3.2, z: -26, rotation: 0, scale: 1 });

    return placed;
};

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
export const live = { x: 0, z: 34, heading: 0, moving: false };

/** مدخلات المشي — من لوحة المفاتيح أو عصا اللمس، بلا حالة React */
export const input = { forward: 0, strafe: 0, run: false, yaw: 0, pitch: 0 };

export const resetInput = () => {
    input.forward = 0; input.strafe = 0; input.run = false;
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
    // orbit: نظرة مدارية للتحرير | walk: منظور الشخص الأوّل
    mode: 'orbit',
    setMode: (mode) => set({ mode, placementType: null }),

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
    cameraTarget: { x: 0, z: 34 },
    setCameraTarget: (x, z) => set({ cameraTarget: { x, z } }),

    // ── الحفظ والاسترجاع ──
    exportWorld: () => {
        const { environment, entities, placed, cameraTarget } = get();
        return {
            version: 1,
            savedAt: new Date().toISOString(),
            environment,
            entities,
            cameraTarget,
            placed
        };
    },

    importWorld: (data) => {
        if (!data || typeof data !== 'object') throw new Error('ملف غير صالح');

        // نُدمج فوق الافتراضي بدل الاستبدال، فملف قديم ينقصه مفتاح لا يكسر المشهد
        set({
            environment: { ...DEFAULT_ENVIRONMENT, ...(data.environment || {}) },
            entities: { ...DEFAULT_ENTITIES, ...(data.entities || {}) },
            cameraTarget: data.cameraTarget || { x: 0, z: 34 },
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
        });
    },

    resetWorld: () => set({
        environment: { ...DEFAULT_ENVIRONMENT },
        entities: { ...DEFAULT_ENTITIES },
        placed: seedWorld(),
        cameraTarget: { x: 0, z: 34 },
        selectedId: null,
        placementType: null
    }),

    clearAll: () => set({ placed: [], selectedId: null, placementType: null })
}));
