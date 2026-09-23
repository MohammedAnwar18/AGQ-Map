/* اختبارات التعرّف البصري على المكان.

   المشاهد مُركّبة لا حقيقية، لكن ما تختبره هو الصحيح: هل تصمد
   البصمة أمام تغيّر الإضاءة والإزاحة والضجيج، وهل تُفرّق بين
   مشهدين مختلفين. وهذه هي الأسئلة التي يقف عليها النظام كلّه. */
import {
    describeFrame, similarity, packDescriptor, unpackDescriptor,
    matchBest, createRelocalizer, frameQuality,
    FRAME_W, FRAME_H, GRAD_SIZE, TINT_SIZE, CONFIDENT, WEAK, MIN_QUALITY
} from '../src/components/ar/visualPlace.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const head = (t) => console.log('\n' + t);

// ── مولّد مشاهد ─────────────────────────────────────────────
//
// «غرفة» مُركّبة: جدران بألوان، وإطار باب، وقطع أثاث — أشكال لها
// حوافّ في اتّجاهات مختلفة، وهو ما تصفه البصمة فعلاً.

const scene = (spec, { shiftX = 0, shiftY = 0, gain = 1, bias = 0, noise = 0, seed = 1 } = {}) => {
    const data = new Uint8ClampedArray(FRAME_W * FRAME_H * 4);
    let s = seed;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    for (let y = 0; y < FRAME_H; y++) {
        for (let x = 0; x < FRAME_W; x++) {
            const sx = x + shiftX;
            const sy = y + shiftY;

            let [r, g, b] = spec(sx, sy);

            r = r * gain + bias;
            g = g * gain + bias;
            b = b * gain + bias;

            if (noise) {
                const n = (rnd() - 0.5) * noise;
                r += n; g += n; b += n;
            }

            const i = (y * FRAME_W + x) * 4;
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
            data[i + 3] = 255;
        }
    }
    return data;
};

// مطبخ: خزائن أفقية وبلاط شبكي وجدار فاتح
const kitchen = (x, y) => {
    if (y < 14) return [232, 228, 214];                    // سقف
    if (y > 34) return (Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? [186, 180, 168] : [214, 208, 196];
    if (x > 8 && x < 30 && y > 18 && y < 32) {
        return (y % 7 < 2) ? [120, 96, 70] : [176, 140, 100];   // خزائن بخطوط أفقية
    }
    return [226, 220, 206];
};

// صالون: أريكة زرقاء ولوحة على الجدار ونافذة رأسية
const salon = (x, y) => {
    if (y < 12) return [240, 238, 232];
    if (y > 36) return [150, 120, 96];                     // أرضية خشب
    if (x > 40 && x < 58 && y > 14 && y < 26) return [90, 130, 190];   // لوحة
    if (x > 4 && x < 26 && y > 26 && y < 36) return [70, 100, 150];    // أريكة
    if (x > 30 && x < 36) return [250, 250, 245];          // نافذة عمودية
    return [234, 230, 222];
};

// ممرّ: باب في النهاية وجدران سادة — مشهد فقير عمداً
const corridor = (x, y) => {
    if (y < 10 || y > 40) return [220, 216, 208];
    if (x > 27 && x < 37 && y > 14 && y < 38) return [140, 110, 82];
    return [228, 224, 216];
};

// جدار أبيض سادة — لا شيء يُميّزه
const blank = () => [238, 238, 236];

const D = (spec, opts) => describeFrame(scene(spec, opts));

// ── ١) الشكل ────────────────────────────────────────────────
head('١) شكل البصمة');

const k = D(kitchen);
ok('الطول صحيح', k.grad.length === GRAD_SIZE && k.tint.length === TINT_SIZE);
ok('التدرّجات مُطبّعة', Math.abs(Math.hypot(...k.grad) - 1) < 1e-5);
ok('واللون مُطبّع', Math.abs(Math.hypot(...k.tint) - 1) < 1e-5);
ok('لا قيمة شاردة', k.grad.every(Number.isFinite) && k.tint.every(Number.isFinite));
ok('والقيم موجبة وسالبة بعد إزالة المتوسّط',
    k.grad.some(v => v < 0) && k.grad.some(v => v > 0));

// ── ٢) نفس المشهد ───────────────────────────────────────────
head('٢) نفس المشهد');

ok('الصورة مع نفسها = ١', Math.abs(similarity(k, D(kitchen)) - 1) < 1e-6);

const sameBright = similarity(k, D(kitchen, { gain: 1.45, bias: 20 }));
ok('إضاءة أقوى بكثير تبقى فوق العتبة', sameBright > CONFIDENT + 0.06, sameBright.toFixed(3));

const sameDark = similarity(k, D(kitchen, { gain: 0.55, bias: -15 }));
ok('وإضاءة أضعف كذلك', sameDark > CONFIDENT + 0.06, sameDark.toFixed(3));

const noisy = similarity(k, D(kitchen, { noise: 26, seed: 99 }));
ok('وضجيج المستشعر', noisy > CONFIDENT + 0.06, noisy.toFixed(3));

// ── ٣) خطوة إلى الجانب ──────────────────────────────────────
head('٣) خطوة إلى الجانب');

const shift2 = similarity(k, D(kitchen, { shiftX: 2 }));
const shift5 = similarity(k, D(kitchen, { shiftX: 5, shiftY: 2 }));

ok('إزاحة صغيرة تبقى فوق العتبة', shift2 >= CONFIDENT, shift2.toFixed(3));
ok('وإزاحة أكبر تنزل لكن لا تنهار', shift5 > 0.6 && shift5 < shift2, shift5.toFixed(3));

// ── ٤) مشاهد مختلفة ─────────────────────────────────────────
head('٤) مشاهد مختلفة');

const sal = D(salon);
const cor = D(corridor);

const ks = similarity(k, sal);
const kc = similarity(k, cor);
const sc = similarity(sal, cor);

console.log(`     مطبخ↔صالون ${ks.toFixed(3)}   مطبخ↔ممرّ ${kc.toFixed(3)}   صالون↔ممرّ ${sc.toFixed(3)}`);

ok('المطبخ ليس الصالون', ks < CONFIDENT, ks.toFixed(3));
ok('المطبخ ليس الممرّ', kc < CONFIDENT, kc.toFixed(3));
ok('الصالون ليس الممرّ', sc < CONFIDENT, sc.toFixed(3));

// الاختبار الذي يقف عليه النظام: فجوة بين أسوأ «نفسه» وأفضل «غيره»
const worstSame = Math.min(sameBright, sameDark, noisy, shift2);
const bestOther = Math.max(ks, kc, sc);

console.log(`     \u0623\u0633\u0648\u0623 \u0646\u0641\u0633\u0647 ${worstSame.toFixed(3)}   \u0623\u0641\u0636\u0644 \u063a\u064a\u0631\u0647 ${bestOther.toFixed(3)}   \u0627\u0644\u0639\u062a\u0628\u0629 ${CONFIDENT}`);

ok('\u0627\u0644\u0639\u062a\u0628\u0629 \u062a\u0642\u0639 \u0628\u064a\u0646\u0647\u0645\u0627', worstSame > CONFIDENT && bestOther < CONFIDENT,
    `${worstSame.toFixed(3)} > ${CONFIDENT} > ${bestOther.toFixed(3)}`);
ok('\u0648\u0627\u0644\u0641\u062c\u0648\u0629 \u0645\u0639\u062a\u0628\u0631\u0629', worstSame - bestOther > 0.1,
    `${(worstSame - bestOther).toFixed(3)}`);

// ── ٥) الحفظ والاسترجاع ─────────────────────────────────────
head('٥) الحفظ والاسترجاع');

const packed = packDescriptor(k);
ok('البصمة نصّ', typeof packed.grad === 'string' && typeof packed.tint === 'string');

const size = packed.grad.length + packed.tint.length;
ok('وحجمها معقول', size < 900, `${size} حرفاً`);

const back = unpackDescriptor(packed);
const round = similarity(k, back);
ok('الاسترجاع لا يُفقد التطابق', round > 0.999, round.toFixed(5));

ok('بصمة تالفة تُردّ بـ null', unpackDescriptor({ grad: 'xx', tint: 'yy' }) === null);
ok('وبصمة ناقصة كذلك', unpackDescriptor(null) === null);

// ── ٦) جودة الإطار ──────────────────────────────────────────
head('٦) جودة الإطار');

const blankQ = frameQuality(D(blank));
const kitchenQ = frameQuality(k);

console.log(`     جدار سادة ${blankQ.toFixed(3)}   مطبخ ${kitchenQ.toFixed(3)}`);

ok('الجدار السادة يُرفض', blankQ < MIN_QUALITY, blankQ.toFixed(3));
ok('والمشهد الغنيّ يُقبل', kitchenQ >= MIN_QUALITY, kitchenQ.toFixed(3));

// ── ٧) المطابقة ─────────────────────────────────────────────
head('٧) المطابقة');

const library = [
    { id: 'k', name: 'المطبخ', descriptor: k },
    { id: 's', name: 'الصالون', descriptor: sal },
    { id: 'c', name: 'الممرّ', descriptor: cor }
];

let m = matchBest(D(kitchen, { gain: 1.2, noise: 12, seed: 5 }), library);
ok('يجد المطبخ', m.entry.id === 'k', m.entry.id);
ok('وبثقة', m.confident === true, `${m.score.toFixed(3)} فارق ${m.margin.toFixed(3)}`);

m = matchBest(D(salon, { shiftX: 2, gain: 0.8 }), library);
ok('ويجد الصالون', m.entry.id === 's', `${m.entry.id} ${m.score.toFixed(3)}`);

// مشهد غريب تماماً لا ينتمي لأي منها
const alien = (x, y) => [(x * 7) % 255, (y * 11) % 255, ((x + y) * 5) % 255];
m = matchBest(D(alien), library);
ok('ومشهد غريب لا يُدّعى', !m.confident, `${m.entry.id} ${m.score.toFixed(3)}`);

ok('ومكتبة فارغة تُردّ بـ null', matchBest(k, []) === null);

// ── ٨) الاستقرار عبر الزمن ──────────────────────────────────
head('٨) الاستقرار عبر الزمن');

const reloc = createRelocalizer({ agree: 3 });

let result = reloc.push(D(kitchen), library);
ok('إطار واحد لا يكفي', result.changed === false && result.place === null);

reloc.push(D(kitchen, { noise: 8, seed: 2 }), library);
result = reloc.push(D(kitchen, { noise: 8, seed: 3 }), library);
ok('وثلاثة متّفقة تلتزم', result.changed === true && result.place.id === 'k');

// إطار عابر لا يُزحزح الالتزام
result = reloc.push(D(alien), library);
ok('إطار غريب عابر لا يُزحزحه', result.place.id === 'k');

result = reloc.push(D(blank), library);
ok('ولا جدار فارغ', result.place.id === 'k');

// الانتقال الحقيقي إلى غرفة أخرى يُقبل بعد تكرار
reloc.push(D(salon), library);
reloc.push(D(salon, { noise: 6, seed: 4 }), library);
result = reloc.push(D(salon, { noise: 6, seed: 5 }), library);
ok('والانتقال الحقيقي يُقبل', result.changed === true && result.place.id === 's');

reloc.forget();
ok('والنسيان يُصفّر', reloc.place === null);

// ── ٩) مكتبة بمشاهد كثيرة ───────────────────────────────────
head('٩) مكتبة أكبر');

// عشرون موضعاً: نفس الغرف بإزاحات مختلفة، كما يلتقطها الأدمن
const many = [];
for (let i = 0; i < 20; i++) {
    const spec = [kitchen, salon, corridor][i % 3];
    many.push({
        id: `p${i}`,
        room: ['k', 's', 'c'][i % 3],
        descriptor: D(spec, { shiftX: (i % 5) - 2, shiftY: ((i * 3) % 3) - 1 })
    });
}

let right = 0;
for (let i = 0; i < 20; i++) {
    const spec = [kitchen, salon, corridor][i % 3];
    const query = D(spec, { shiftX: (i % 5) - 2, gain: 0.9 + (i % 4) * 0.1, noise: 10, seed: i + 40 });
    const hit = matchBest(query, many);
    if (hit && hit.entry.room === ['k', 's', 'c'][i % 3]) right++;
}
ok('يُصيب الغرفة في كل الحالات', right === 20, `${right}/20`);

// السرعة: المطابقة تجري خمس مرّات في الثانية على الهاتف
const started = performance.now();
for (let i = 0; i < 200; i++) matchBest(k, many);
const each = (performance.now() - started) / 200;
ok('والمطابقة أسرع من مللي ثانية', each < 1, `${each.toFixed(3)} م.ث لكل مطابقة`);

const describeStart = performance.now();
for (let i = 0; i < 50; i++) describeFrame(scene(kitchen));
const perFrame = (performance.now() - describeStart) / 50;
ok('وحساب البصمة كذلك', perFrame < 3, `${perFrame.toFixed(2)} م.ث لكل إطار`);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
