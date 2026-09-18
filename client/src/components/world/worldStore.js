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
    heavyShading: false     // SSAO — ثقيل، فيبقى اختيارياً
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
        const item = { id: nextId(), type, x, z, rotation: 0, scale: 1 };
        set(state => ({ placed: [...state.placed, item], selectedId: item.id }));
        return item.id;
    },

    moveItem: (id, x, z) => set(state => ({
        placed: state.placed.map(p => (p.id === id ? { ...p, x, z } : p))
    })),

    updateItem: (id, patch) => set(state => ({
        placed: state.placed.map(p => (p.id === id ? { ...p, ...patch } : p))
    })),

    removeItem: (id) => set(state => ({
        placed: state.placed.filter(p => p.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId
    })),

    select: (id) => set({ selectedId: id, placementType: null }),

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
