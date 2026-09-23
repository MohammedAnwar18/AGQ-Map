/* اختبارات إطار نانوتراك — وأهمّها أن النقطة تعود غداً إلى موضعها */
import {
    makeFrame, toVenue, fromVenue, pathFromVenue,
    bearingError, errorAt, gradeBase, MIN_BASE, GOOD_BASE
} from '../src/components/nanotrack/nanoFrame.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

// يحاكي جلسة: مشيك يُقاس ببوصلة منحرفة انحرافاً ثابتاً، وبخطوة
// أطول أو أقصر من الحقيقة بنسبة ما. هذا بالضبط ما يحدث في الواقع.
const session = (truth, { bias = 0, stride = 1, origin = { x: 0, z: 0 } } = {}) => {
    const rad = (bias * Math.PI) / 180;
    const c = Math.cos(rad), s = Math.sin(rad);
    return truth.map(q => ({
        x: origin.x + (q.x * c + q.z * s) * stride,
        z: origin.z + (-q.x * s + q.z * c) * stride
    }));
};

// ── ١) بناء الإطار ──────────────────────────────────────────
head('١) بناء الإطار');

ok('قاعدة أقصر من متر تُرفض', makeFrame({ x: 0, z: 0 }, { x: 0, z: 0.9 }) === null);
ok('والشريطان في نفس النقطة يُرفضان', makeFrame({ x: 2, z: 2 }, { x: 2, z: 2 }) === null);
ok('ومتر بالضبط يُقبل', makeFrame({ x: 0, z: 0 }, { x: 0, z: MIN_BASE }) !== null);

let fr = makeFrame({ x: 0, z: 0 }, { x: 0, z: 3 });
ok('القاعدة تُقاس', near(fr.span, 3));
ok('وبلا قاعدة محفوظة لا تصحيح للمقياس', near(fr.scale, 1));

// ── ٢) الشريطان نفساهما ─────────────────────────────────────
head('٢) الشريطان نفساهما');

for (const [name, b] of [
    ['شمالاً', { x: 0, z: 4 }],
    ['شرقاً', { x: 4, z: 0 }],
    ['جنوباً', { x: 0, z: -4 }],
    ['غرباً', { x: -4, z: 0 }],
    ['مائلاً', { x: 2.5, z: -3.1 }]
]) {
    const frame = makeFrame({ x: 1.3, z: -0.7 }, { x: 1.3 + b.x, z: -0.7 + b.z });
    const zero = toVenue({ x: 1.3, z: -0.7 }, frame);
    const dir = toVenue({ x: 1.3 + b.x, z: -0.7 + b.z }, frame);

    ok(`${name}: الشريط الأوّل هو الصفر`, near(zero.x, 0) && near(zero.z, 0));
    ok(`${name}: والثاني على المحور «قُدّام»`,
        near(dir.x, 0, 1e-12) && near(dir.z, Math.hypot(b.x, b.z), 1e-12),
        `${dir.x},${dir.z}`);
}

// ── ٣) الذهاب والإياب ───────────────────────────────────────
head('٣) الذهاب والإياب');

fr = makeFrame({ x: -2.4, z: 5.1 }, { x: 0.9, z: 7.8 });
let worst = 0;
for (let i = 0; i < 400; i++) {
    const q = { x: (i * 7.3) % 40 - 20, z: (i * 3.1) % 40 - 20 };
    const back = fromVenue(toVenue(q, fr), fr);
    worst = Math.max(worst, Math.hypot(back.x - q.x, back.z - q.z));
}
ok('التحويل وعكسه يعودان بالنقطة نفسها', worst < 1e-12, `${worst.toExponential(2)}`);

// المسافات محفوظة: الدوران لا يُطيل ولا يُقصّر
const d0 = Math.hypot(3 - 1, 9 - 4);
const d1 = (() => {
    const u = toVenue({ x: 1, z: 4 }, fr), v = toVenue({ x: 3, z: 9 }, fr);
    return Math.hypot(v.x - u.x, v.z - u.z);
})();
ok('والمسافات لا تتغيّر', near(d0, d1, 1e-12));

// ── ٤) الوعد نفسه: النقطة تعود غداً ─────────────────────────
// جلستان مختلفتان في كل شيء — موضع الصفر، وانحراف البوصلة —
// ومع ذلك تُقرأ النقاط في الموضع نفسه.
head('٤) النقطة تعود غداً');

const tapes = [{ x: 0, z: 0 }, { x: 0.6, z: 3.4 }];
const marks = [{ x: 1.2, z: 2.0 }, { x: -0.8, z: 5.5 }, { x: 4.0, z: 9.3 }, { x: -3.3, z: 12.1 }];

// اليوم: بوصلة منحرفة ١٧°، والهاتف بدأ عند نقطة عشوائية
const today = session([...tapes, ...marks], { bias: 17, origin: { x: 12, z: -30 } });
const frToday = makeFrame(today[0], today[1]);
const stored = marks.map((_, i) => toVenue(today[2 + i], frToday));

// غداً: بوصلة منحرفة ‎−41°‎ هذه المرّة، وبداية أخرى
const tomorrow = session([...tapes, ...marks], { bias: -41, origin: { x: -7, z: 4 } });
const frTomorrow = makeFrame(tomorrow[0], tomorrow[1]);

let driftWorst = 0;
stored.forEach((venue, i) => {
    const drawn = fromVenue(venue, frTomorrow);
    driftWorst = Math.max(driftWorst, Math.hypot(drawn.x - tomorrow[2 + i].x, drawn.z - tomorrow[2 + i].z));
});
ok('انحراف البوصلة يسقط تماماً', driftWorst < 1e-12, `${driftWorst.toExponential(2)} م`);

// والمخزون نفسه لا يعتمد على الجلسة: الجلستان تُنتجان نفس الأرقام
const storedTomorrow = marks.map((_, i) => toVenue(tomorrow[2 + i], frTomorrow));
let sameWorst = 0;
stored.forEach((a, i) => {
    sameWorst = Math.max(sameWorst, Math.hypot(a.x - storedTomorrow[i].x, a.z - storedTomorrow[i].z));
});
ok('والمحفوظ واحد مهما اختلفت الجلسة', sameWorst < 1e-12, `${sameWorst.toExponential(2)} م`);

// ── ٥) تصحيح مقياس الخطوة ───────────────────────────────────
// خطوة اليوم أقصر ١٢٪ من يوم التسجيل. بلا تصحيح ينكمش المسار كلّه.
head('٥) تصحيح مقياس الخطوة');

const shortStride = session([...tapes, ...marks], { bias: 5, stride: 0.88 });
const naive = makeFrame(shortStride[0], shortStride[1]);
const fixed = makeFrame(shortStride[0], shortStride[1], { base: Math.hypot(0.6, 3.4) });

ok('القاعدة المقيسة انكمشت فعلاً', near(naive.span, Math.hypot(0.6, 3.4) * 0.88, 1e-9));
ok('والتصحيح يُعيدها', near(fixed.scale, 1 / 0.88, 1e-9), `${fixed.scale}`);

// إحداثيات المكان ليست إحداثيات الحقيقة: الإطار يدوّرها عمداً
// حتّى يصير الشريطان هما المحور. فالمرجع هو ما سُجّل يوم الإنشاء.
const clean = session([...tapes, ...marks]);
const frClean = makeFrame(clean[0], clean[1]);
const recorded = marks.map((_, i) => toVenue(clean[2 + i], frClean));
const trueBase = frClean.span;

const naiveOff = Math.max(...recorded.map((want, i) => {
    const got = toVenue(shortStride[2 + i], naive);
    return Math.hypot(got.x - want.x, got.z - want.z);
}));

const fixedOff = Math.max(...recorded.map((want, i) => {
    const got = toVenue(shortStride[2 + i], fixed);
    return Math.hypot(got.x - want.x, got.z - want.z);
}));

ok('بلا تصحيح تزحف النقطة البعيدة', naiveOff > 1.4, `${naiveOff.toFixed(2)} م`);
ok('ومعه تعود إلى مكانها', fixedOff < 1e-9, `${fixedOff.toExponential(2)} م`);
ok('والقاعدة المحفوظة هي المقيسة يوم الإنشاء', near(trueBase, Math.hypot(0.6, 3.4), 1e-12));

// ── ٦) الخطّ كاملاً ─────────────────────────────────────────
head('٦) الخطّ كاملاً');

const line = pathFromVenue([{ x: 0, z: 0 }, { x: 0, z: 2, label: 'الباب' }], fr);
ok('كل نقاطه تُحوّل', line.length === 2);
ok('والتسمية تبقى معها', line[1].label === 'الباب');
ok('وما لا اسم له يبقى بلا اسم', !('label' in line[0]));
ok('ونقطة الصفر تقع على الشريط الأوّل', near(line[0].x, fr.ox) && near(line[0].z, fr.oz));

// ── ٧) الصدق في الدقّة ──────────────────────────────────────
// الأرقام التي تُعرض للمستخدم: لا تُجمّل ولا تُخوّف.
head('٧) الصدق في الدقّة');

ok('القاعدة الأطول تُقلّل الخطأ', bearingError(6) < bearingError(2));
ok('والقاعدة المعدومة خطؤها أقصاه', bearingError(0) === 90);

const e2 = bearingError(2);
ok('متران يعطيان زاوية معقولة', e2 > 1 && e2 < 3, `${e2.toFixed(2)}°`);

ok('والخطأ يكبر مع البعد', errorAt(20, 3) > errorAt(5, 3));
ok('وعند الشريط نفسه لا يزيد عن خطأ اللصق', near(errorAt(0, 3), 0.04, 1e-9));

// رقم ملموس: قاعدة مترين، هدف على عشرة أمتار
const ten = errorAt(10, 2);
ok('قاعدة مترين تزحف نصف متر على بُعد عشرة', ten > 0.25 && ten < 0.65, `${ten.toFixed(2)} م`);
ok('وقاعدة ستّة أمتار تُنصّف ذلك', errorAt(10, 6) < ten / 1.8, `${errorAt(10, 6).toFixed(2)} م`);

ok('الحكم على القاعدة القصيرة', gradeBase(0.4) === 'short');
ok('وعلى المقبولة', gradeBase(1.8) === 'fair');
ok('وعلى الجيّدة', gradeBase(GOOD_BASE) === 'good');

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
