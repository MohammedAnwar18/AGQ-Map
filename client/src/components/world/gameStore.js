import { create } from 'zustand';

/* ============================================================
   مخزن اللعب

   منفصل عن مخزن العالم عمداً: ذاك يصف المشهد — ما فيه وكيف يبدو —
   وهذا يصف الجلسة: من أنا، وفي عالم من أنا، ومن معي، وهل أنا في
   سيارة الآن.

   المحرّر لا يعرف هذا المخزن أصلاً، واللعبة لا تحتاج لوحاته.
   ============================================================ */

// لوحة المظهر — نفس التي يقبلها الخادم، مكرّرة هنا كي تُعرض
const PALETTE = {
    shirt: ['#E06C75', '#61AFEF', '#E5C07B', '#98C379', '#C678DD', '#56B6C2', '#D19A66', '#EDEDED'],
    pants: ['#3B4252', '#4C566A', '#2E3440', '#5E6472', '#6B5B4A'],
    hair: ['#2B2118', '#4A3527', '#6B4A2F', '#1C1612', '#8A6B45'],
    skin: ['#F0C39A', '#E0AC83', '#C68B62', '#8D5C3D']
};

export const APPEARANCE_PALETTE = PALETTE;

export const PART_LABELS = {
    shirt: 'القميص',
    pants: 'البنطال',
    hair: 'الشعر',
    skin: 'البشرة'
};

export const DEFAULT_APPEARANCE = {
    shirt: PALETTE.shirt[1],
    pants: PALETTE.pants[0],
    hair: PALETTE.hair[0],
    skin: PALETTE.skin[0],
    height: 1,
    bag: false
};

/**
 * موضع اللاعب الحيّ ووجهته.
 *
 * خارج المخزن كما ‎live‎ في مخزن العالم: تُكتب في كل إطار، ونبضة
 * الحضور تقرؤها كل ثانية. مرورها من React يعني إعادة رسم الواجهة
 * ستّين مرّة في الثانية لأجل رقم لا يُعرض.
 */
export const self = { x: 0, y: 0, z: 0, heading: 0, mode: 'walk', vehicle: null };

/**
 * اللاعبون الآخرون بين نبضتين.
 *
 * لكل واحد موضعان: ‎from‎ حيث كان و‎to‎ حيث صار، والمشهد يستوفي
 * بينهما. بلا ذلك يقفز الآخرون قفزة كل ثانية.
 */
export const remotes = new Map();

export const useGame = create((set, get) => ({
    // ── البطاقة ──
    player: null,          // { code, name, appearance, stats }
    isAdmin: false,
    loading: true,
    error: null,

    setPlayer: (player, isAdmin) => set({ player, isAdmin, loading: false, error: null }),
    setError: (error) => set({ error, loading: false }),

    // ── العالم الجاري ──
    // code: رقم صاحب العالم | null يعني عالمي أنا
    visiting: null,        // { code, owner, mine }
    setVisiting: (visiting) => set({ visiting }),

    // ── الحضور ──
    // عدد من معي — للعرض وحده؛ مواضعهم في ‎remotes‎ خارج React
    nearby: 0,
    setNearby: (nearby) => set({ nearby }),
    online: true,
    setOnline: (online) => set({ online }),

    // ── الركوب ──
    // معرّف المركبة التي أقودها الآن، أو null وأنا ماشٍ
    vehicleId: null,
    vehicleAt: null,       // { x, z, rotation, type, color } — حيث تُترك

    enterVehicle: (car) => set({ vehicleId: car.id, vehicleAt: { ...car } }),
    exitVehicle: () => set({ vehicleId: null }),

    // ── ما يمكن التفاعل معه الآن ──
    // يُكتب من حلقة الإطار عبر ‎setPrompt‎، ومخنوق هناك: القيمة
    // تتغيّر مرّتين في السير كلّه، فلا داعي لأن تمرّ في كل إطار
    prompt: null,          // { kind, label, car }
    setPrompt: (prompt) => {
        const current = get().prompt;
        if (current?.car?.id === prompt?.car?.id && current?.kind === prompt?.kind) return;
        set({ prompt });
    },

    // ── الحيّ الذي أقف فيه ──
    district: null,
    setDistrict: (district) => {
        if (get().district?.key === district?.key) return;
        set({ district });
    },

    // ── لوحة البطاقة ──
    sheet: null,           // 'profile' | 'travel' | null
    openSheet: (sheet) => set({ sheet }),

    reset: () => {
        remotes.clear();
        set({ visiting: null, nearby: 0, vehicleId: null, vehicleAt: null, prompt: null, sheet: null });
    }
}));

/** يُكمل مظهراً ناقصاً بالافتراضي — بطاقة قديمة لا تكسر الأفاتار */
export const fullAppearance = (raw) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const out = { ...DEFAULT_APPEARANCE };

    for (const key of Object.keys(PALETTE)) {
        if (PALETTE[key].includes(source[key])) out[key] = source[key];
    }

    if (Number.isFinite(source.height)) {
        out.height = Math.min(1.12, Math.max(0.88, source.height));
    }
    out.bag = Boolean(source.bag);
    return out;
};

/** رقم اللاعب بفواصل تُسهّل قراءته بالصوت: ٤٢٩ ٧١٥ */
export const spacedCode = (code) => String(code || '')
    .replace(/(\d{3})(?=\d)/g, '$1 ');
