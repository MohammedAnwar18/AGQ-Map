/* اختبارات محرّك المحاكاة — وأهمّها أن سلوكه هو سلوك النماذج المنشورة */
import {
    seeded, seedOf, buildCrowd, buildNetwork, stepCrowd,
    meanOf, varianceOf, clustersOf, polarisationOf, isConsensus,
    runSimulation, influenceRanking, tippingPoint, gapFor, ARCHETYPES
} from '../src/components/helly/simEngine.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

/* وكيل مُصنَّع يدوياً — نضبط صفاته كي نختبر الديناميكا لا التوليد */
const agent = (id, opinion, { stubborn = 0, tolerance = 2, reach = 1 } = {}) => ({
    id, kind: 'regular', label: 'عاديّ',
    opinion, start: opinion, stubborn, tolerance, reach, moved: 0, swayed: 0
});

// ── ١) العشوائية المحكومة ──────────────────────────────────
head('١) العشوائية المحكومة');

ok('نفس البذرة نفس التسلسل', (() => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 50; i++) if (a() !== b()) return false;
    return true;
})());

ok('وبذرتان مختلفتان تختلفان', seeded(1)() !== seeded(2)());
ok('والقيم في المدى', (() => {
    const r = seeded(9);
    for (let i = 0; i < 200; i++) { const v = r(); if (v < 0 || v >= 1) return false; }
    return true;
})());

ok('ونفس النصّ نفس البذرة', seedOf('إغلاق الشارع') === seedOf('إغلاق الشارع'));
ok('ونصّان مختلفان بذرتان', seedOf('أ') !== seedOf('ب'));

// ── ٢) بناء المجتمع ───────────────────────────────────────
head('٢) بناء المجتمع');

const crowd = buildCrowd(200, { seed: 5 });
ok('العدد كما طُلب', crowd.length === 200);
ok('والآراء في المدى', crowd.every(a => a.opinion >= -1 && a.opinion <= 1));
ok('والعناد في المدى', crowd.every(a => a.stubborn >= 0 && a.stubborn <= 0.97));
ok('والثقل موجب', crowd.every(a => a.reach > 0));
ok('والرأي الأوّل محفوظ', crowd.every(a => a.start === a.opinion));

ok('ونفس البذرة نفس المجتمع', (() => {
    const b = buildCrowd(60, { seed: 5 });
    const c = buildCrowd(60, { seed: 5 });
    return b.every((a, i) => a.opinion === c[i].opinion && a.kind === c[i].kind);
})());

ok('وبذرة أخرى مجتمع آخر',
    buildCrowd(60, { seed: 5 })[0].opinion !== buildCrowd(60, { seed: 6 })[0].opinion);

/* الأنماط تظهر كلّها في مجتمع كبير بنسب قريبة من المعلنة */
const kinds = {};
for (const a of buildCrowd(500, { seed: 3 })) kinds[a.kind] = (kinds[a.kind] || 0) + 1;
ok('والأنماط الأربعة كلّها تظهر', Object.keys(kinds).length === 4, Object.keys(kinds).join(','));
ok('ونسبة المؤثّرين قريبة من المعلنة',
    Math.abs(kinds.influencer / 500 - ARCHETYPES.influencer.share) < 0.05,
    `${(kinds.influencer / 500).toFixed(3)} مقابل ${ARCHETYPES.influencer.share}`);

ok('والصفر لا يُسقط', buildCrowd(0, {}).length === 0);
ok('والسقف محترم', buildCrowd(5000, {}).length === 600);

// ── ٣) الشبكة ─────────────────────────────────────────────
head('٣) الشبكة');

const ten = buildCrowd(10, { seed: 2 });
const net = buildNetwork(ten, { seed: 4, degree: 4, rewire: 0 });

ok('لكل وكيل روابط', net.length === 10 && net.every(l => l.length > 0));
ok('ولا يرتبط بنفسه', net.every((links, i) => !links.includes(i)));

/* الروابط متبادلة: إن سمعتُك سمعتَني — وهذا شرط الشبكة غير الموجّهة */
ok('والروابط متبادلة', net.every((links, i) => links.every(j => net[j].includes(i))));

ok('والدرجة قريبة من المطلوب', (() => {
    const avg = net.reduce((a, l) => a + l.length, 0) / net.length;
    return avg >= 3 && avg <= 5;
})(), `${(net.reduce((a, l) => a + l.length, 0) / net.length).toFixed(1)}`);

ok('وإعادة التوصيل تُغيّر الشبكة', (() => {
    const plain = buildNetwork(ten, { seed: 4, degree: 4, rewire: 0 });
    const mixed = buildNetwork(ten, { seed: 4, degree: 4, rewire: 0.9 });
    return JSON.stringify(plain) !== JSON.stringify(mixed);
})());

ok('والواحد بلا روابط', buildNetwork([agent(0, 0)], {}).length === 1);

// ── ٤) الجولة ─────────────────────────────────────────────
head('٤) الجولة');

/*
 * بلا عناد وبثقة واسعة: الاثنان يلتقيان في المنتصف.
 *
 * وهذا هو سلوك النموذج الساذج، ويجب أن يُنتَج بالضبط حين تُعطَّل
 * الإضافات — وإلّا فالإضافات تُخفي خطأً في الأساس.
 */
const pair = [agent(0, -1), agent(1, 1)];
const pairNet = [[1], [0]];
const after = stepCrowd(pair, pairNet, {});

ok('المتقابلان يلتقيان في المنتصف',
    near(after[0].opinion, 0, 1e-9) && near(after[1].opinion, 0, 1e-9),
    `${after[0].opinion}, ${after[1].opinion}`);

/*
 * الثقة المحدودة: من بَعُد رأيه لا يُسمع.
 *
 * وهذا الشرط هو ما يُنتج الكتل — وبلا اختباره قد يبقى معطّلاً
 * فتنتهي كل محاكاة بتوافق.
 */
const deaf = [agent(0, -1, { tolerance: 0.5 }), agent(1, 1, { tolerance: 0.5 })];
const afterDeaf = stepCrowd(deaf, pairNet, {});
ok('وما بَعُد لا يُسمع فلا يتحرّك أحد',
    near(afterDeaf[0].opinion, -1, 1e-9) && near(afterDeaf[1].opinion, 1, 1e-9));
ok('ويُعدّ من سُمع منه', afterDeaf[0].heard === 0 && after[0].heard === 1);

/*
 * العناد: ‎Friedkin–Johnsen‎.
 *
 * عنادٌ تامّ يُثبّت الوكيل على رأيه الأوّل مهما سمع. وعنادٌ نصفيّ
 * يُنصّف الحركة.
 */
const firm = [agent(0, -1, { stubborn: 1 }), agent(1, 1)];
ok('والعناد التامّ يُثبّت', near(stepCrowd(firm, pairNet, {})[0].opinion, -1, 1e-9));

const halfFirm = [agent(0, -1, { stubborn: 0.5 }), agent(1, 1)];
ok('والعناد النصفيّ يُنصّف الحركة',
    near(stepCrowd(halfFirm, pairNet, {})[0].opinion, -0.5, 1e-9),
    `${stepCrowd(halfFirm, pairNet, {})[0].opinion}`);

/* الثقل: الأثقل يجذب أكثر مّما يُجذب */
const heavy = [agent(0, -1, { reach: 9 }), agent(1, 1, { reach: 1 })];
const afterHeavy = stepCrowd(heavy, pairNet, {});
ok('والأثقل يجذب أكثر',
    Math.abs(afterHeavy[0].opinion - (-1)) < Math.abs(afterHeavy[1].opinion - 1),
    `تحرّك الثقيل ${Math.abs(afterHeavy[0].opinion + 1).toFixed(3)}`);

/*
 * التزامن.
 *
 * الحساب يقرأ الحالة القديمة كلّها ثم يكتب الجديدة. وبلا ذلك
 * يصير ترتيب الوكلاء في المصفوفة مؤثّراً في النتيجة — فنفس
 * المجتمع بترتيب معكوس يُعطي نتيجة أخرى، وهو أثرٌ لا معنى له.
 */
ok('والجولة متزامنة لا متسلسلة', (() => {
    const fwd = stepCrowd([agent(0, -1), agent(1, 0.4), agent(2, 1)],
        [[1], [0, 2], [1]], {});
    const rev = stepCrowd([agent(0, 1), agent(1, 0.4), agent(2, -1)],
        [[1], [0, 2], [1]], {});
    // الترتيب معكوس فالنتيجة معكوسة بالضبط
    return near(fwd[1].opinion, rev[1].opinion, 1e-12);
})());

/* الحدث: حقلٌ يجذب، وأثره على المتردّد أكبر */
const twoKinds = [agent(0, 0, { stubborn: 0 }), agent(1, 0, { stubborn: 0.9 })];
const pulled = stepCrowd(twoKinds, [[1], [0]], { field: 1, pull: 0.5 });
ok('والحدث يجذب نحوه', pulled[0].opinion > 0 && pulled[1].opinion > 0);
ok('وأثره على المتردّد أكبر', pulled[0].opinion > pulled[1].opinion,
    `${pulled[0].opinion.toFixed(3)} > ${pulled[1].opinion.toFixed(3)}`);

ok('والرأي يبقى في المدى', (() => {
    const wild = stepCrowd([agent(0, 1)], [[]], { field: 1, pull: 1, noise: 5, rand: seeded(1) });
    return wild[0].opinion >= -1 && wild[0].opinion <= 1;
})());

// ── ٥) المقاييس ───────────────────────────────────────────
head('٥) المقاييس');

ok('المتوسّط', near(meanOf([-1, 0, 1]), 0));
ok('والفارغ صفر', meanOf([]) === 0);
ok('والتباين صفر للمتساوي', varianceOf([5, 5, 5]) === 0);
ok('ويكبر مع التشتّت', varianceOf([-1, 1]) > varianceOf([-0.1, 0.1]));
ok('والواحد تباينه صفر', varianceOf([3]) === 0);

// الكتل
ok('المتقاربون كتلة واحدة', clustersOf([0.1, 0.12, 0.15]).length === 1);
ok('والمتباعدون كتلتان', clustersOf([-0.9, -0.88, 0.9, 0.92]).length === 2);
ok('وثلاث كتل تُعدّ ثلاثاً', clustersOf([-0.9, 0, 0.9]).length === 3);
ok('والكتل مرتّبة بالحجم', (() => {
    const g = clustersOf([-0.9, 0.9, 0.91, 0.92]);
    return g[0].size === 3 && g[1].size === 1;
})());
ok('والنِّسَب تجمع واحداً', (() => {
    const g = clustersOf([-0.9, 0.9, 0.91]);
    return near(g.reduce((a, c) => a + c.share, 0), 1, 1e-9);
})());
ok('والفارغ بلا كتل', clustersOf([]).length === 0);

/*
 * الاستقطاب ليس التباين.
 *
 * مجتمعٌ مبثوث بالتساوي تباينُه عالٍ وليس مستقطباً. والاستقطاب
 * كتلتان متباعدتان متكافئتان — وهذا ما يجب أن يُفرّق المؤشّر بينه
 * وبين التشتّت.
 */
const split = [];
for (let i = 0; i < 20; i++) split.push(i < 10 ? -0.9 : 0.9);

const spreadOut = [];
for (let i = 0; i < 20; i++) spreadOut.push(-0.95 + (i / 19) * 1.9);

ok('الكتلتان المتكافئتان أعلى استقطاباً من المبثوث',
    polarisationOf(split) > polarisationOf(spreadOut),
    `${polarisationOf(split).toFixed(3)} > ${polarisationOf(spreadOut).toFixed(3)}`);

/*
 * والمبثوث تباينه معتبر ومع ذلك استقطابه ضئيل.
 *
 * فالتباين لا يُفرّق: كتلتان على الطرفين تباينُهما أعلى من المبثوث
 * فعلاً، لكنّ الفرق بينهما ليس في المقدار بل في الشكل — والمؤشّر
 * هو ما يقرأ الشكل.
 */
ok('والمبثوث تباينه معتبر', varianceOf(spreadOut) > 0.25,
    `${varianceOf(spreadOut).toFixed(3)}`);
ok('ومع ذلك استقطابه قريب من الصفر', polarisationOf(spreadOut) < 0.2,
    `${polarisationOf(spreadOut).toFixed(3)}`);
ok('والكتلة الواحدة استقطابها صفر', polarisationOf([0.1, 0.11, 0.12]) === 0);
ok('والاستقطاب في المدى', polarisationOf(split) >= 0 && polarisationOf(split) <= 1);

/* كتلة كبيرة مع شاذّ واحد: متباعدة لكن غير متكافئة فاستقطابها قليل */
const lone = [...Array(19).fill(0.9), -0.9];
ok('والشاذّ الواحد لا يُعدّ استقطاباً',
    polarisationOf(lone) < polarisationOf(split) / 3,
    `${polarisationOf(lone).toFixed(3)} مقابل ${polarisationOf(split).toFixed(3)}`);

ok('والتوافق يُكشف', isConsensus([0.3, 0.301, 0.3005]) === true);
ok('والانشقاق ليس توافقاً', isConsensus(split) === false);

// ── ٦) التشغيل الكامل ─────────────────────────────────────
head('٦) التشغيل الكامل');

const run = runSimulation({
    agents: buildCrowd(80, { seed: 21 }),
    rounds: 25,
    seed: 21
});

ok('يُعيد كل جولة ومعها الابتدائية', run.rounds.length === 26, `${run.rounds.length}`);
ok('والجولة صفر هي الابتدائية', run.rounds[0].round === 0);
ok('ولكل جولة مقاييسها', run.rounds.every(r =>
    Number.isFinite(r.mean) && Number.isFinite(r.variance)
    && Number.isFinite(r.polarisation) && r.clusters >= 1));
ok('والنتيجة النهائية محسوبة', Number.isFinite(run.outcome.mean) && run.outcome.clusters.length >= 1);

/* الإعادة: نفس المُدخل نفس المسار بالضبط — وهذا أهمّ ما في المحرّك */
ok('ونفس البذرة نفس المسار حرفياً', (() => {
    const a = runSimulation({ agents: buildCrowd(60, { seed: 8 }), rounds: 20, seed: 8 });
    const b = runSimulation({ agents: buildCrowd(60, { seed: 8 }), rounds: 20, seed: 8 });
    return a.rounds.every((r, i) => near(r.mean, b.rounds[i].mean, 1e-15)
        && near(r.variance, b.rounds[i].variance, 1e-15));
})());

/*
 * الثقة الواسعة تُنتج توافقاً، والضيّقة تُبقي الكتل.
 *
 * وهذه هي الخصلة المميّزة لنموذج ‎Hegselmann–Krause‎: عتبةُ الثقة
 * تُحدّد إن انتهى المجتمع إلى رأي واحد أو إلى كتل.
 */
const openMinded = buildCrowd(80, { seed: 31 }).map(a => ({ ...a, tolerance: 2, stubborn: 0 }));
const narrow = buildCrowd(80, { seed: 31 }).map(a => ({ ...a, tolerance: 0.08, stubborn: 0 }));

const openRun = runSimulation({ agents: openMinded, rounds: 60, seed: 31 });
const narrowRun = runSimulation({ agents: narrow, rounds: 60, seed: 31 });

/*
 * الفجوة تتبع السعة.
 *
 * قياسُ مجتمعٍ سعته ‎0.08‎ بفجوة ‎0.18‎ يُظهره كتلةً واحدة وهو اثنتا
 * عشرة — فالمقياس كان يُخفي ما يقيسه. و‎gapFor‎ يشتقّ الفجوة من
 * المجتمع نفسه.
 */
ok('وفجوة القياس تتبع سعة الثقة',
    gapFor(narrow) < gapFor(openMinded),
    `${gapFor(narrow).toFixed(3)} مقابل ${gapFor(openMinded).toFixed(3)}`);

ok('الثقة الواسعة تُنتج كتلاً أقلّ',
    openRun.outcome.clusters.length < narrowRun.outcome.clusters.length,
    `${openRun.outcome.clusters.length} مقابل ${narrowRun.outcome.clusters.length}`);

ok('والضيّقة تتفكّك إلى كتل عدّة', narrowRun.outcome.clusters.length >= 5,
    `${narrowRun.outcome.clusters.length}`);
ok('والواسعة تنتهي إلى توافق', openRun.outcome.consensus === true);
ok('وتباينها أقلّ', openRun.outcome.variance < narrowRun.outcome.variance);

/* العناد يُبقي التشتّت: مجتمعٌ كلّه عنيد لا يتحرّك */
const allFirm = buildCrowd(60, { seed: 14 }).map(a => ({ ...a, stubborn: 0.97, tolerance: 2 }));
const firmRun = runSimulation({ agents: allFirm, rounds: 40, seed: 14 });
ok('والعناد يُبقي التشتّت', firmRun.outcome.variance > openRun.outcome.variance);

// ── ٧) الحوادث ────────────────────────────────────────────
head('٧) الحوادث');

const quiet = runSimulation({ agents: buildCrowd(70, { seed: 44 }), rounds: 30, seed: 44 });
const shaken = runSimulation({
    agents: buildCrowd(70, { seed: 44 }),
    rounds: 30,
    seed: 44,
    events: [{ at: 10, toward: 1, force: 0.8, label: 'حدث قويّ' }]
});

/*
 * الأثر يُقاس عند وقوعه لا في النهاية.
 *
 * وكان القياس في النهاية فأخفى الأثر وأظهره صفراً: ‎Friedkin–Johnsen‎
 * يُرجع كل وكيل إلى رأيه الأوّل بقدر عناده، فحدثٌ عابر يُزيح
 * المجتمع ثمّ يرتدّ إلى ما كان. وذلك سلوكٌ صحيح ومهمّ لا عطب —
 * وهو الفرق بين «هزّة» و«تغيير رسخ».
 */
const atEvent = shaken.rounds.find(r => r.round === 11).mean;
const quietThen = quiet.rounds.find(r => r.round === 11).mean;

ok('الحدث يُزيح المتوسّط نحوه عند وقوعه',
    atEvent > quietThen,
    `${atEvent.toFixed(3)} مقابل ${quietThen.toFixed(3)}`);

ok('والعناد يُرجع المجتمع بعد خبوّه',
    Math.abs(shaken.outcome.mean - quiet.outcome.mean) < Math.abs(atEvent - quietThen),
    `النهاية ${Math.abs(shaken.outcome.mean - quiet.outcome.mean).toFixed(3)} < الذروة ${Math.abs(atEvent - quietThen).toFixed(3)}`);

/* ومجتمعٌ بلا عناد لا يرتدّ: التغيير يرسخ فيه */
ok('ومجتمع بلا عناد يرسخ فيه التغيير', (() => {
    const soft = buildCrowd(70, { seed: 44 }).map(a => ({ ...a, stubborn: 0, tolerance: 2 }));
    const calmRun = runSimulation({ agents: soft, rounds: 30, seed: 44 });
    const hitRun = runSimulation({
        agents: soft, rounds: 30, seed: 44,
        events: [{ at: 10, toward: 1, force: 0.8, label: 'حدث' }]
    });
    return hitRun.outcome.mean > calmRun.outcome.mean + 0.05;
})());
ok('ويُسجَّل في جولته', shaken.events.length === 1 && shaken.events[0].at === 10);
ok('وتُعلَّم جولته بملاحظة', shaken.rounds.find(r => r.round === 10)?.note === 'حدث قويّ');

/* أثر الحدث يخبو: الجولات بعده تتحرّك أقلّ فأقلّ */
ok('وأثره يخبو لا يبقى', (() => {
    const at10 = shaken.rounds.find(r => r.round === 10).moved;
    const at16 = shaken.rounds.find(r => r.round === 16).moved;
    return at16 < at10;
})());

ok('والحدث خارج المدى يُقصّ', (() => {
    const odd = runSimulation({
        agents: buildCrowd(30, { seed: 2 }), rounds: 10, seed: 2,
        events: [{ at: 999, toward: 1, force: 0.5 }]
    });
    return odd.events[0].at === 10;
})());

// ── ٨) النفوذ ونقطة الانقلاب ──────────────────────────────
head('٨) النفوذ ونقطة الانقلاب');

const rank = influenceRanking(run, 5);
ok('يُرتّب النفوذ', rank.length === 5);
ok('نازلاً', rank.every((r, i) => i === 0 || rank[i - 1].influence >= r.influence));
ok('ولكلٍّ درجته وبياناته', rank.every(r =>
    Number.isFinite(r.influence) && Number.isFinite(r.reach) && r.label));

/*
 * النفوذ ليس الثقل.
 *
 * مؤثّرٌ معزول ثقلُه عالٍ ونفوذه صفر. والمقياس يقيس من تحرّك
 * جيرانُه نحوه، فيُفرّق بين الثقل المُعلَن والنفوذ الواقع.
 */
ok('والمعزول ثقيلٌ بلا نفوذ', (() => {
    const two = [agent(0, -1, { reach: 9 }), agent(1, 1)];
    const lonely = runSimulation({ agents: two, rounds: 5, seed: 1, degree: 0 });
    const got = influenceRanking(lonely, 2);
    const heavyOne = got.find(g => g.id === 0);
    return heavyOne && heavyOne.degree === 0 && heavyOne.influence === 0;
})());

ok('والفارغ لا يُسقط', influenceRanking(null).length === 0);

const tip = tippingPoint(shaken.rounds);
ok('نقطة الانقلاب تُوجد', tip !== null);
ok('وهي عند الحدث أو بعده مباشرةً', tip.round >= 10 && tip.round <= 12, `${tip?.round}`);
ok('والمجتمع الساكن بلا انقلاب', tippingPoint([
    { round: 0, mean: 0 }, { round: 1, mean: 0 }, { round: 2, mean: 0 }
]) === null);
ok('والقصير بلا انقلاب', tippingPoint([{ round: 0, mean: 0 }]) === null);

// ── ٩) الحدود ─────────────────────────────────────────────
head('٩) الحدود');

ok('بلا وكلاء لا يسقط', (() => {
    const none = runSimulation({ agents: [], rounds: 10 });
    return none.rounds.length === 0;
})());

ok('وجولة واحدة تعمل', runSimulation({ agents: buildCrowd(10, {}), rounds: 1 }).rounds.length === 2);
ok('وسقف الجولات محترم', runSimulation({ agents: buildCrowd(10, {}), rounds: 9999 }).rounds.length === 201);

ok('والآراء تبقى في المدى طول المحاكاة', (() => {
    const long = runSimulation({
        agents: buildCrowd(50, { seed: 77 }), rounds: 80, seed: 77, noise: 0.3,
        events: [{ at: 5, toward: 1, force: 1 }, { at: 40, toward: -1, force: 1 }]
    });
    return long.rounds.every(r => r.values.every(v => v >= -1 && v <= 1));
})());

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
