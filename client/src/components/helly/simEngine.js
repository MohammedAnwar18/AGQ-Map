/* ============================================================
   محرّك المحاكاة الجماعية

   مجتمعٌ من وكلاء، لكلٍّ رأيه وعنادُه وثقله ومن يسمع منه. نمضي
   بهم جولةً جولة فنرى كيف يتحرّك الرأي: يتوافق، أو ينشقّ إلى
   كتلتين، أو يبقى مبثوثاً.

   ولا نموذج لغويّ ولا مفتاح. وليس هذا تنازلاً: ديناميكا الرأي
   حقلٌ حسابيّ له نماذجه المنشورة، وهي أدقّ من نموذج يُمثّل أدواراً
   لأنّها تُقاس وتُعاد وتُفسَّر.

   والمستعمل هنا تركيبٌ من ثلاثة نماذج معروفة:

     Friedkin–Johnsen    لكل وكيل عنادٌ يُرجعه إلى رأيه الأوّل، فلا
                         يُجرَف الجميع إلى المتوسّط كما في النموذج
                         الساذج
     Hegselmann–Krause   الثقة المحدودة: لا يسمع الوكيل إلّا من كان
                         رأيه قريباً منه، وهذا ما يُنتج الانشقاق
                         بدل التوافق القسريّ
     Watts–Strogatz      شبكةُ «عالم صغير»: جيرانٌ قريبون وقفزات
                         بعيدة قليلة، وهي بنية المجتمعات الحقيقية

   وكل جولة محسوبة لا مُولَّدة: نفس البذرة تُعطي نفس المسار بالضبط،
   فالنتيجة تُراجَع ويُبنى عليها.
   ============================================================ */

/* ============================================================
   العشوائية المحكومة
   ============================================================ */

/**
 * مولّد عشوائي ببذرة — ‎mulberry32‎.
 *
 * ‎Math.random‎ لا يُبذَّر، فمحاكاتان بنفس المُدخل تُعطيان نتيجتين
 * مختلفتين — وتلك محاكاةٌ لا يُبنى عليها قرار ولا تُراجَع. وهذا
 * المولّد قصير وجودته كافية لهذا الغرض، والأهمّ أنّه يُعاد.
 */
export const seeded = (seed) => {
    let a = (seed | 0) || 1;

    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** بذرة من نصّ — فنفس السيناريو يُعطي نفس المجتمع */
export const seedOf = (text) => {
    let h = 2166136261;
    for (const ch of String(text || 'helly')) {
        h ^= ch.codePointAt(0);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

/* توزيع طبيعي مقصوص — صفات الناس تتجمّع حول وسط لا تتوزّع بالتساوي */
const normal = (rand, mean, spread, lo, hi) => {
    // Box–Muller
    const u = Math.max(1e-9, rand());
    const v = rand();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.min(hi, Math.max(lo, mean + z * spread));
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ============================================================
   المجتمع
   ============================================================ */

/*
 * أنماط الوكلاء.
 *
 * ليس الناس سواءً في العناد ولا في الثقل ولا في سعة الاستماع.
 * وهذه الأنماط الأربعة تكفي لإنتاج سلوك واقعي: مؤثّرون قليلو
 * العدد عظيمو الثقل، ومتشدّدون لا يتزحزحون، ومتردّدون يتبعون،
 * ووسطٌ عاديّ.
 */
export const ARCHETYPES = {
    influencer: { label: 'مؤثّر', share: 0.08, reach: [3.2, 0.8], stubborn: [0.45, 0.12], tolerance: [0.55, 0.12] },
    hardliner: { label: 'متشدّد', share: 0.18, reach: [1.1, 0.3], stubborn: [0.82, 0.08], tolerance: [0.22, 0.07] },
    swayable: { label: 'متردّد', share: 0.3, reach: [0.8, 0.25], stubborn: [0.12, 0.07], tolerance: [0.72, 0.14] },
    regular: { label: 'عاديّ', share: 0.44, reach: [1, 0.25], stubborn: [0.38, 0.12], tolerance: [0.48, 0.12] }
};

/**
 * يبني مجتمعاً.
 *
 * الرأي يبدأ مستقطباً قليلاً لا موزّعاً بالتساوي: المجتمعات تبدأ
 * بميل، والبدءُ من توزيع متساوٍ تمامًا يُنتج توافقاً سريعاً مصطنعاً.
 */
/* الانقسام الابتدائي ‎0.62‎: دون ‎0.5‎ يبدأ المجتمع متّصلاً بلا
   كتل فلا يُرى استقطاب، وفوقه يبدأ بكتلتين واضحتين — وهو ما
   يُراد رؤيته يتوافق أو يتفكّك */
export const buildCrowd = (count, { seed = 1, lean = 0, split = 0.62 } = {}) => {
    const rand = seeded(seed);
    const n = clamp(Math.round(count) || 0, 0, 600);
    const agents = [];

    const kinds = Object.entries(ARCHETYPES);

    for (let i = 0; i < n; i++) {
        // اختيار النمط بالاحتمال التراكمي
        const roll = rand();
        let acc = 0;
        let kind = 'regular';
        for (const [key, def] of kinds) {
            acc += def.share;
            if (roll <= acc) { kind = key; break; }
        }

        const def = ARCHETYPES[kind];

        /* الرأي: كتلتان حول ‎±split‎ مع ميل عامّ، فالانشقاق ممكن
           من البداية لا مفروضاً لاحقاً */
        const side = rand() < 0.5 + lean * 0.5 ? 1 : -1;
        const opinion = clamp(normal(rand, side * split + lean * 0.2, 0.26, -1, 1), -1, 1);

        agents.push({
            id: i,
            kind,
            label: def.label,
            opinion,
            start: opinion,
            reach: Math.max(0.1, normal(rand, def.reach[0], def.reach[1], 0.1, 6)),
            stubborn: clamp(normal(rand, def.stubborn[0], def.stubborn[1], 0, 0.97), 0, 0.97),
            tolerance: clamp(normal(rand, def.tolerance[0], def.tolerance[1], 0.05, 1.6), 0.05, 1.6),
            moved: 0,
            swayed: 0
        });
    }

    return agents;
};

/**
 * شبكة «عالم صغير» — ‎Watts–Strogatz‎.
 *
 * حلقةٌ يعرف فيها كلٌّ جيرانه، ثم تُعاد توصيل نسبة من الروابط
 * عشوائياً. فتجتمع الخصلتان اللتان تُميّزان المجتمعات: تجمّع محلّيّ
 * عالٍ، ومسافة قصيرة بين أي شخصين.
 *
 * والشبكة الكاملة — حيث يسمع الجميع الجميع — تُنتج توافقاً سريعاً
 * لا يشبه شيئاً. والحلقة المحضة تُنتج بطئاً لا يشبه شيئاً كذلك.
 */
export const buildNetwork = (agents, { seed = 7, degree = 6, rewire = 0.12 } = {}) => {
    const n = agents.length;
    const links = agents.map(() => new Set());

    if (n < 2) return links.map(set => [...set]);

    const rand = seeded(seed);

    /* درجةٌ صفر تعني مجتمعاً بلا روابط — وهي حالة مشروعة تُقاس:
       مجتمعٌ لا يسمع بعضه بعضاً لا يتحرّك، وبها يُعرف أثر الشبكة
       نفسها. وكان ‎Math.max(1, …)‎ يفرض جاراً فلا تُمكن دراستها */
    if (degree < 1) return links.map(set => [...set]);

    const half = Math.max(1, Math.min(Math.floor(degree / 2), Math.floor((n - 1) / 2)));

    for (let i = 0; i < n; i++) {
        for (let step = 1; step <= half; step++) {
            let j = (i + step) % n;

            // إعادة توصيل: قفزة بعيدة بدل الجار
            if (rand() < rewire) {
                for (let tries = 0; tries < 12; tries++) {
                    const pick = Math.floor(rand() * n);
                    if (pick !== i && !links[i].has(pick)) { j = pick; break; }
                }
            }

            if (j === i) continue;
            links[i].add(j);
            links[j].add(i);
        }
    }

    return links.map(set => [...set]);
};

/* ============================================================
   الجولة
   ============================================================ */

/**
 * جولة واحدة.
 *
 *   اجتماعيّ = متوسّط آراء من يسمع منهم، موزوناً بثقلهم
 *   رأيٌ جديد = عناد·رأيه الأوّل + (١−عناد)·اجتماعيّ + أثر الحدث
 *
 * والسماع مشروط بالثقة المحدودة: من بَعُد رأيه عن رأي الوكيل أكثر
 * من سعته لا يُسمع منه. وهذا الشرط وحده هو ما يُنتج الكتل: بلا
 * ثقة محدودة ينجرف الكلّ إلى متوسّط واحد دائماً.
 *
 * والحساب متزامن: نقرأ الحالة القديمة كلّها ثم نكتب الجديدة. وبلا
 * ذلك يسمع الوكيل العشرون رأي العاشر بعد تحديثه، فيصير الترتيب
 * داخل المصفوفة مؤثّراً في النتيجة — وهو أثرٌ لا معنى له.
 */
export const stepCrowd = (agents, links, { field = 0, pull = 0, noise = 0, rand = null } = {}) => {
    const before = agents.map(a => a.opinion);
    const next = [];

    for (let i = 0; i < agents.length; i++) {
        const me = agents[i];

        // نفسه أوّلاً بثقله: لا يُهمل الوكيل رأيه في المتوسّط
        let sum = before[i] * me.reach;
        let weight = me.reach;
        let heard = 0;

        for (const j of links[i] || []) {
            if (Math.abs(before[j] - before[i]) > me.tolerance) continue;
            sum += before[j] * agents[j].reach;
            weight += agents[j].reach;
            heard += 1;
        }

        const social = weight > 0 ? sum / weight : before[i];

        let value = me.stubborn * me.start + (1 - me.stubborn) * social;

        /* أثر الحدث: حقلٌ خارجيّ يجذب الآراء، وقوّته على المتردّد
           أكبر — وهو ما يُلاحَظ فعلاً عند الأحداث */
        if (pull > 0) {
            const give = pull * (1 - me.stubborn);
            value = value * (1 - give) + field * give;
        }

        if (noise > 0 && rand) value += (rand() - 0.5) * 2 * noise;

        next.push({ value: clamp(value, -1, 1), heard });
    }

    return agents.map((a, i) => ({
        ...a,
        opinion: next[i].value,
        heard: next[i].heard,
        moved: Math.abs(next[i].value - before[i]),
        swayed: a.swayed + Math.abs(next[i].value - before[i])
    }));
};

/* ============================================================
   المقاييس
   ============================================================ */

export const meanOf = (values) => {
    if (!values?.length) return 0;
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
};

export const varianceOf = (values) => {
    if (!values || values.length < 2) return 0;
    const m = meanOf(values);
    let sum = 0;
    for (const v of values) sum += (v - m) ** 2;
    return sum / values.length;
};

/**
 * كتل الرأي — كم رأياً مستقلّاً بقي في المجتمع؟
 *
 * نرتّب الآراء ونقطعها حيث تتجاوز الفجوة حدّاً. وهذا هو الجواب
 * على «هل توافقوا أم انشقّوا؟»: كتلةٌ واحدة توافق، واثنتان
 * استقطاب، وكثيرٌ تشتّت.
 */
export const clustersOf = (values, gap = 0.18) => {
    const live = (values || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!live.length) return [];

    const groups = [[live[0]]];

    for (let i = 1; i < live.length; i++) {
        if (live[i] - live[i - 1] > gap) groups.push([live[i]]);
        else groups[groups.length - 1].push(live[i]);
    }

    return groups.map(g => ({
        centre: meanOf(g),
        size: g.length,
        share: g.length / live.length,
        from: g[0],
        to: g[g.length - 1]
    })).sort((a, b) => b.size - a.size);
};

/**
 * مؤشّر الاستقطاب.
 *
 * التباين وحده لا يكفي: مجتمعٌ مبثوث بالتساوي تباينُه عالٍ وليس
 * مستقطباً. والاستقطاب كتلتان متباعدتان متكافئتان — فنضرب تباعد
 * الكتلتين الكبريين في تكافؤ حجمهما.
 *
 *     P = (المسافة بين المركزين ÷ 2) × 4·p₁·p₂
 *
 * فالكتلتان المتساويتان على الطرفين تُعطيان واحداً، وكتلةٌ واحدة
 * تُعطي صفراً، وكتلةٌ كبيرة مع شاذّ صغير تُعطي قليلاً.
 */
export const polarisationOf = (values, gap = 0.18) => {
    const groups = clustersOf(values, gap);
    if (groups.length < 2) return 0;

    const [a, b] = groups;
    const distance = Math.abs(a.centre - b.centre) / 2;
    const balance = 4 * a.share * b.share;

    return clamp(distance * balance, 0, 1);
};

/** التوافق: كتلة واحدة وتباين ضئيل */
export const isConsensus = (values, { gap = 0.18, spread = 0.02 } = {}) =>
    clustersOf(values, gap).length === 1 && varianceOf(values) < spread;

/* ============================================================
   التشغيل الكامل
   ============================================================ */

/**
 * يُشغّل المحاكاة من أوّلها إلى آخرها ويُعيد كل جولة.
 *
 * الحوادث تُحقن في جولاتها المحدّدة ويخبو أثرها بعدها: حدثٌ أثرُه
 * دائم يجعل كل محاكاة تنتهي عنده، وخبوُّ الأثر هو ما يُظهر إن كان
 * التغيير رسخ أم ارتدّ المجتمع إلى ما كان.
 */
/**
 * فجوة قياس الكتل المناسبة لمجتمع.
 *
 * نظرية ‎Hegselmann–Krause‎ تقول إنّ الكتل النهائية تتباعد بأكثر من
 * سعة الثقة — وإلّا لاندمجت. فسعةُ الثقة هي مقياس «متى يكون
 * رأيان رأياً واحداً»، وثابتٌ مفروض يُخفي الكتل أو يُفرّق الواحدة.
 *
 * ومجتمعٌ سعته ‎0.08‎ قيس بفجوة ‎0.18‎ ظهر كتلةً واحدة وهو اثنتا
 * عشرة — وهذا ما كان يحدث قبل هذا الحساب.
 */
export const gapFor = (agents) => {
    const tol = (agents || []).map(a => a.tolerance).filter(Number.isFinite).sort((a, b) => a - b);
    if (!tol.length) return 0.18;

    const mid = tol[Math.floor(tol.length / 2)];

    /*
     * السقف ‎0.22‎ لا ‎0.4‎.
     *
     * نظرية ‎Hegselmann–Krause‎ تقول إنّ الكتل تتباعد بأكثر من السعة،
     * لكنّ ذلك في حالتها النقية: سعةٌ واحدة للجميع وبلا عناد. وهذا
     * المحرّك يخلط سعاتٍ متفاوتة مع عنادٍ يُرجع الآراء، فالتوزيع
     * يبقى متّصلاً ولا يتفكّك إلى مجموعات تفصلها السعة.
     *
     * ومجتمعٌ سعته الوسطى ‎0.48‎ قيس بفجوة ‎0.4‎ ظهر كتلةً واحدة
     * دائماً واستقطابه صفراً دائماً — مؤشّرٌ لا يُخبر بشيء. والسقف
     * الأدنى يُبقي الفجوة قادرة على تمييز كتلتين على طرفي المدى.
     */
    return clamp(mid * 0.9, 0.02, 0.22);
};

export const runSimulation = ({
    agents: seedAgents,
    rounds = 30,
    gap = null,
    events = [],
    noise = 0,
    seed = 11,
    degree = 6,
    rewire = 0.12
} = {}) => {
    const agents0 = seedAgents || [];
    if (!agents0.length) return { rounds: [], agents: [], links: [], events: [] };

    /* الفجوة من المجتمع نفسه حين لا تُفرض، فالقياس يتبع الديناميكا */
    const band = Number.isFinite(gap) ? gap : gapFor(agents0);

    const links = buildNetwork(agents0, { seed: seed + 1, degree, rewire });
    const rand = seeded(seed + 2);

    const total = clamp(Math.round(rounds) || 0, 1, 200);

    /* الحوادث مرتّبة ومفهرسة بجولتها، فالبحث عنها في كل جولة مرّة */
    const byRound = new Map();
    for (const ev of events || []) {
        const at = clamp(Math.round(ev.at) || 1, 1, total);
        if (!byRound.has(at)) byRound.set(at, []);
        byRound.get(at).push(ev);
    }

    let live = agents0.map(a => ({ ...a, opinion: a.start ?? a.opinion, swayed: 0 }));

    const history = [];
    const pushFrame = (round, note) => {
        const values = live.map(a => a.opinion);
        const groups = clustersOf(values, band);

        history.push({
            round,
            note: note || null,
            mean: meanOf(values),
            variance: varianceOf(values),
            polarisation: polarisationOf(values, band),
            clusters: groups.length,
            biggest: groups[0]?.share || 0,
            moved: meanOf(live.map(a => a.moved || 0)),
            values
        });
    };

    pushFrame(0, 'الحالة الابتدائية');

    /* أثر الحدث الحاليّ، يخبو بالضرب في كل جولة */
    let field = 0;
    let pull = 0;
    const fired = [];

    for (let round = 1; round <= total; round++) {
        let note = null;

        for (const ev of byRound.get(round) || []) {
            field = clamp(+ev.toward || 0, -1, 1);
            pull = clamp(+ev.force || 0.3, 0, 1);
            note = ev.label || 'حدث';
            fired.push({ ...ev, at: round });
        }

        live = stepCrowd(live, links, { field, pull, noise, rand });
        pushFrame(round, note);

        // الخبوّ: ثلاثة أرباع في كل جولة، فيذوب الأثر في ست جولات
        pull *= 0.75;
        if (pull < 0.01) pull = 0;
    }

    /* الجولة التي استقرّ عندها المجتمع — أوّل جولة لم يتحرّك فيها
       أحد تحرّكاً ملموساً وبقي كذلك */
    let settled = null;
    for (let i = 1; i < history.length; i++) {
        if (history[i].moved < 0.002) { settled = history[i].round; break; }
    }

    const values = live.map(a => a.opinion);

    return {
        links,
        agents: live,
        rounds: history,
        events: fired,
        gap: band,
        outcome: {
            mean: meanOf(values),
            variance: varianceOf(values),
            polarisation: polarisationOf(values, band),
            clusters: clustersOf(values, band),
            consensus: isConsensus(values, { gap: band }),
            settled,
            shift: meanOf(values) - meanOf(agents0.map(a => a.start ?? a.opinion))
        }
    };
};

/**
 * من أثّر فعلاً.
 *
 * لا الأعلى ثقلاً ولا الأكثر روابط، بل من تحرّك جيرانُه نحوه: نقيس
 * لكل وكيل كم اقترب منه مَن يسمعه بين البداية والنهاية.
 *
 * فمؤثّرٌ يصيح في فراغ ثقلُه عالٍ وأثره صفر — وهذا ما يُفرّق بين
 * الثقل المُعلَن والنفوذ الواقع.
 */
export const influenceRanking = (result, top = 8) => {
    const { agents, links } = result || {};
    if (!agents?.length) return [];

    const scored = agents.map((me, i) => {
        let pulled = 0;
        let counted = 0;

        for (const j of links[i] || []) {
            const other = agents[j];

            /*
             * كم تحرّك الجار في اتّجاهي — لا كم قلّت المسافة بيننا.
             *
             * وكان الحساب فرقَ المسافة، وهو يقلّ سواءٌ جئتُه أو
             * جاءني. فكان المتردّدون — وهم أكثر من يتحرّك — يتصدّرون
             * قائمة «النفوذ» وقد كانوا المتأثّرين لا المؤثّرين.
             *
             * والصحيح إسقاط حركة الجار على الاتّجاه نحوي: موجبٌ إن
             * جاءني، وسالبٌ إن ابتعد، وصفرٌ إن لم يتحرّك.
             */
            const gapWas = (me.start ?? 0) - (other.start ?? 0);
            const otherMoved = other.opinion - (other.start ?? 0);

            if (Math.abs(gapWas) > 1e-9) {
                pulled += otherMoved * Math.sign(gapWas);
            }
            counted += 1;
        }

        return {
            id: me.id,
            label: me.label,
            kind: me.kind,
            reach: me.reach,
            stubborn: me.stubborn,
            start: me.start,
            opinion: me.opinion,
            degree: counted,
            influence: counted > 0 ? pulled / counted : 0,
            moved: me.opinion - (me.start ?? 0)
        };
    });

    scored.sort((a, b) => b.influence - a.influence);
    return scored.slice(0, top);
};

/**
 * نقطة الانقلاب — أيّ جولة تغيّر فيها المسار أكثر ما تغيّر.
 *
 * أكبر فرق في المتوسّط بين جولتين متتاليتين. وهي ما يُقال عنه
 * «هنا انقلب الرأي»، وتُقارَن بجولة الحدث لنعرف هل الحدث هو
 * السبب أم أن المجتمع كان ينقلب أصلاً.
 */
export const tippingPoint = (rounds) => {
    if (!rounds || rounds.length < 3) return null;

    let best = null;
    for (let i = 1; i < rounds.length; i++) {
        const jump = Math.abs(rounds[i].mean - rounds[i - 1].mean);
        if (!best || jump > best.jump) best = { round: rounds[i].round, jump, note: rounds[i].note };
    }

    return best && best.jump > 0.01 ? best : null;
};
