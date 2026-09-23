/* اختبارات هندسة الملاحة الداخلية — وأهمّها أن الإصبع يرسم على الأرض فعلاً */
import {
    normalizeAngle, angleDelta, cameraBasis, poseFromOrientation,
    screenToFloor, worldToScreen, toPixels, fromPixels,
    distance2D, bearingTo, polylineLength, simplifyPath, projectOnPath,
    nextInstruction, shortestRoute, routePolyline, pointAlongRay, aimPoint, screenRay,
    strideFor, createStepDetector, createHeadingFilter, advance, readableDistance,
    triangulate, createRangeFinder, slicePath
} from '../src/components/ar/indoorGeo.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

// ── ١) الزوايا ──────────────────────────────────────────────
head('١) الزوايا');
ok('التطبيع يلفّ', normalizeAngle(-90) === 270 && normalizeAngle(450) === 90);
ok('أقصر فرق عبر الشمال', angleDelta(359, 1) === 2, `${angleDelta(359, 1)}`);
ok('وبالاتجاه المعاكس', angleDelta(1, 359) === -2);
ok('١٨٠ تبقى موجبة', angleDelta(0, 180) === 180);

// ── ٢) قاعدة الكاميرا ───────────────────────────────────────
head('٢) قاعدة الكاميرا');
const v = (a) => a.map(n => +n.toFixed(6)).join();

let b = cameraBasis({ heading: 0, pitch: 0 });
ok('شمالاً: الأمام شمال', v(b.forward) === '0,0,1');
ok('واليمين شرق', v(b.right) === '1,0,0');
ok('والأعلى أعلى', v(b.up) === '0,1,0');

b = cameraBasis({ heading: 90, pitch: 0 });
ok('شرقاً: الأمام شرق', v(b.forward) === '1,0,0');
ok('واليمين جنوب', v(b.right) === '0,0,-1', v(b.right));

b = cameraBasis({ heading: 0, pitch: -90 });
ok('نظر لأسفل: الأمام للأرض', v(b.forward) === '0,-1,0');
ok('وأعلى الصورة شمال', v(b.up) === '0,0,1');

let orthoFail = 0;
for (let h = 0; h < 360; h += 37) {
    for (let pi = -80; pi <= 80; pi += 23) {
        const k = cameraBasis({ heading: h, pitch: pi });
        const d = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
        if (Math.abs(d(k.forward, k.right)) > 1e-9) orthoFail++;
        if (Math.abs(d(k.forward, k.up)) > 1e-9) orthoFail++;
        if (Math.abs(d(k.right, k.up)) > 1e-9) orthoFail++;
        if (Math.abs(d(k.forward, k.forward) - 1) > 1e-9) orthoFail++;
    }
}
ok('القاعدة متعامدة معيارية في كل وضع', orthoFail === 0, `${orthoFail} إخفاقاً`);

// ── ٣) الإسقاط على الأرض ────────────────────────────────────
head('٣) الإسقاط على الأرض');

const EYE = 1.5;
const FOV = 65;
const ASPECT = 0.5625;

ok('مركز الشاشة والنظر أفقي: لا أرض',
    screenToFloor(0, 0, { heading: 0, pitch: 0, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT) === null);

let hit = screenToFloor(0, 0, { heading: 0, pitch: -45, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT);
ok('ميل ٤٥°: المسافة = ارتفاع العين', near(hit.distance, EYE, 1e-6), `${hit.distance}`);
ok('وهي أمامنا شمالاً', near(hit.z, EYE, 1e-6) && near(hit.x, 0, 1e-9));

hit = screenToFloor(0, 0, { heading: 0, pitch: -63.43494882292201, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT);
ok('ميل أحدّ يُقرّب النقطة', near(hit.distance, EYE / 2, 1e-5), `${hit.distance}`);

hit = screenToFloor(0, 0, { heading: 90, pitch: -45, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT);
ok('نحو الشرق: النقطة شرقنا', near(hit.x, EYE, 1e-6) && near(hit.z, 0, 1e-9), `${hit.x},${hit.z}`);

hit = screenToFloor(0, 0, { heading: 0, pitch: -45, roll: 0 }, { x: 10, z: -4 }, EYE, FOV, ASPECT);
ok('الوقوف في مكان آخر يُزيح النتيجة', near(hit.x, 10) && near(hit.z, -4 + EYE));

// الميل الأحدّ يعني نقطة أقرب — دائماً
let monotone = true;
let last = Infinity;
for (let pitch = -10; pitch >= -85; pitch -= 5) {
    const h = screenToFloor(0, 0, { heading: 0, pitch, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT);
    if (!h || h.distance >= last) monotone = false;
    last = h ? h.distance : last;
}
ok('كلما نظرتَ أسفل قربت النقطة', monotone);

// ── ٤) الذهاب والإياب ───────────────────────────────────────
head('٤) الإسقاط وعكسه');

let worst = 0;
let skipped = 0;
for (const heading of [0, 47, 123, 271, 350]) {
    for (const pitch of [-15, -30, -55, -80]) {
        for (const roll of [0, 12, -35]) {
            for (const sx of [-0.8, -0.3, 0, 0.45, 0.9]) {
                for (const sy of [-0.9, -0.5, -0.1]) {
                    const pose = { heading, pitch, roll };
                    const floor = screenToFloor(sx, sy, pose, { x: 3, z: -7 }, EYE, FOV, ASPECT);
                    if (!floor) { skipped++; continue; }

                    const back = worldToScreen({ x: floor.x, y: 0, z: floor.z }, pose, { x: 3, z: -7 }, EYE, FOV, ASPECT);
                    if (!back) { skipped++; continue; }

                    worst = Math.max(worst, Math.hypot(back.sx - sx, back.sy - sy));
                }
            }
        }
    }
}
ok('النقطة تعود إلى مكانها على الشاشة', worst < 1e-9, `أقصى انحراف ${worst.toExponential(2)}`);
ok('وما فوق الأفق يُستبعد صراحةً', skipped > 0, `${skipped} نقطة`);

ok('ما خلف الكاميرا يُرفض',
    worldToScreen({ x: 0, y: 0, z: -5 }, { heading: 0, pitch: 0, roll: 0 }, { x: 0, z: 0 }, EYE, FOV, ASPECT) === null);

// ── ٥) البكسلات ─────────────────────────────────────────────
head('٥) البكسلات');
ok('المركز في المنتصف', JSON.stringify(toPixels({ sx: 0, sy: 0 }, 400, 800)) === '{"x":200,"y":400}');
ok('أعلى اليمين', JSON.stringify(toPixels({ sx: 1, sy: 1 }, 400, 800)) === '{"x":400,"y":0}');
const rt = fromPixels(300, 200, 400, 800);
ok('اللمس يعود مُطبّعاً', near(rt.sx, 0.5) && near(rt.sy, 0.5));

// ── ٦) قياسات الأرض ─────────────────────────────────────────
head('٦) قياسات الأرض');
ok('شمالاً صفر', bearingTo({ x: 0, z: 0 }, { x: 0, z: 5 }) === 0);
ok('شرقاً تسعون', bearingTo({ x: 0, z: 0 }, { x: 5, z: 0 }) === 90);
ok('جنوباً مئة وثمانون', bearingTo({ x: 0, z: 0 }, { x: 0, z: -5 }) === 180);
ok('غرباً مئتان وسبعون', bearingTo({ x: 0, z: 0 }, { x: -5, z: 0 }) === 270);
ok('المسافة إقليدية', distance2D({ x: 0, z: 0 }, { x: 3, z: 4 }) === 5);
ok('طول الخطّ', polylineLength([{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }]) === 20);

// ── ٧) تبسيط الرسم ──────────────────────────────────────────
head('٧) تبسيط الرسم');
const drawn = [];
for (let i = 0; i <= 200; i++) drawn.push({ x: i * 0.05, z: i * 0.05 + (i % 2 ? 0.002 : -0.002) });
const simple = simplifyPath(drawn, 0.25);
ok('يُقلّل النقاط كثيراً', simple.length < 8, `${drawn.length} ← ${simple.length}`);
ok('ويُبقي الطرفين', simple[0].x === drawn[0].x && simple[simple.length - 1].x === drawn[drawn.length - 1].x);

const corner = [{ x: 0, z: 0 }, { x: 0, z: 5 }, { x: 0, z: 10 }, { x: 5, z: 10 }, { x: 10, z: 10 }];
ok('ولا يبتلع زاوية حقيقية', simplifyPath(corner, 0.25).length === 3, `${simplifyPath(corner, 0.25).length}`);

// ── ٨) الموضع على المسار ────────────────────────────────────
head('٨) الموضع على المسار');
const path = [{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }];

let pr = projectOnPath(path, { x: 0, z: 4 });
ok('على المسار: الانحراف صفر', near(pr.offset, 0) && near(pr.along, 4));
ok('والمتبقّي صحيح', near(pr.remaining, 16), `${pr.remaining}`);

pr = projectOnPath(path, { x: 3, z: 4 });
ok('الانحراف يُقاس عمودياً', near(pr.offset, 3), `${pr.offset}`);

pr = projectOnPath(path, { x: 20, z: 10 });
ok('وما بعد النهاية يُثبَّت عليها', near(pr.remaining, 0) && near(pr.along, 20));

// ── ٩) التعليمة التالية ─────────────────────────────────────
head('٩) التعليمة التالية');
let ins = nextInstruction(path, 0);
ok('أوّلاً: شمالاً', ins.heading === 0);
ok('ثم انعطاف يمين بعد ١٠ م', ins.side === 'right' && near(ins.distance, 10), `${ins.side} ${ins.distance}`);
ok('وهو تسعون درجة', near(ins.turn, 90));

ins = nextInstruction(path, 12);
ok('بعد الانعطاف: الوصول', ins.arrive === true);
ok('والمسافة الباقية', near(ins.distance, 8), `${ins.distance}`);

ok('انحناءة ممشى ليست انعطافاً',
    nextInstruction([{ x: 0, z: 0 }, { x: 0, z: 5 }, { x: 0.3, z: 12 }, { x: 0, z: 20 }], 0).arrive === true);

// ── ١٠) المسار الأقصر ───────────────────────────────────────
head('١٠) المسار الأقصر');

const nodes = [
    { id: 'in', name: 'المدخل', x: 0, z: 0 },
    { id: 'j1', name: 'تقاطع', x: 0, z: 20 },
    { id: 'shop', name: 'مطعم', x: 15, z: 20 },
    { id: 'long', name: 'طريق طويل', x: -30, z: 20 },
    { id: 'far', name: 'بعيد', x: 60, z: 60 }
];
const edges = [
    { id: 'e1', from: 'in', to: 'j1' },
    { id: 'e2', from: 'j1', to: 'shop' },
    { id: 'e3', from: 'in', to: 'long' },
    { id: 'e4', from: 'long', to: 'shop' }
];

let route = shortestRoute(nodes, edges, 'in', 'shop');
ok('وُجد طريق', route !== null);
ok('واختار الأقصر', route.nodes.join('>') === 'in>j1>shop', route.nodes.join('>'));
ok('وطوله صحيح', near(route.length, 35), `${route.length}`);
ok('عقدة معزولة لا طريق إليها', shortestRoute(nodes, edges, 'in', 'far') === null);
ok('من النقطة إلى نفسها طريق فارغ', shortestRoute(nodes, edges, 'in', 'in').length === 0);
ok('معرّف مجهول يُردّ بـ null', shortestRoute(nodes, edges, 'in', 'xxx') === null);

const bentEdges = [
    { id: 'a1', from: 'in', to: 'j1', path: [{ x: 0, z: 0 }, { x: 40, z: 10 }, { x: 0, z: 20 }] },
    { id: 'a2', from: 'j1', to: 'shop' },
    { id: 'a3', from: 'in', to: 'long' },
    { id: 'a4', from: 'long', to: 'shop' }
];
ok('الحافّة الملتوية تُوزن بطول خطّها',
    shortestRoute(nodes, bentEdges, 'in', 'shop').nodes.join('>') === 'in>long>shop');

// ── ١١) فرد المسار ──────────────────────────────────────────
head('١١) فرد المسار إلى خطّ');

route = shortestRoute(nodes, edges, 'in', 'shop');
let line = routePolyline(route, nodes, edges);
ok('يبدأ من المدخل', near(line[0].x, 0) && near(line[0].z, 0));
ok('وينتهي عند الوجهة', near(line[line.length - 1].x, 15) && near(line[line.length - 1].z, 20));
ok('وطوله كطول الطريق', near(polylineLength(line), 35), `${polylineLength(line)}`);

const rev = [
    { id: 'r1', from: 'j1', to: 'in', path: [{ x: 0, z: 20 }, { x: -5, z: 10 }, { x: 0, z: 0 }] },
    { id: 'r2', from: 'j1', to: 'shop' }
];
line = routePolyline(shortestRoute(nodes, rev, 'in', 'shop'), nodes, rev);
ok('الحافّة المعكوسة تُقلَب', near(line[1].x, -5) && near(line[1].z, 10), JSON.stringify(line.slice(0, 3)));
// القفزة تعني أن الحافّة قُرئت بالاتجاه الخطأ: الخطّ ينتقل من
// طرفها إلى طرفها بلا مرور بانحنائها
const longest = Math.max(...line.map((pt, i) => (i ? distance2D(line[i - 1], pt) : 0)));
ok('ولا يقفز الخطّ على نفسه', longest <= 15.01, `أطول مقطع ${longest.toFixed(2)} م`);

// ── ١٢) تتبّع الخطوات ───────────────────────────────────────
head('١٢) تتبّع الخطوات');

ok('طول الخطوة من القامة', near(strideFor(1.75), 1.75 * 0.415, 1e-9));
ok('ومحدود من الطرفين', strideFor(3) === 0.95 && strideFor(0.5) === 0.45);

const det = createStepDetector();
let counted = 0;
let t = 0;
for (let i = 0; i < 1200; i++) {
    t += 20;
    const phase = (t % 550) / 550;
    if (det.push(9.81 + Math.sin(phase * Math.PI * 2) * 2.4, t)) counted++;
}
ok('يعدّ خطوات مشية منتظمة', counted >= 36 && counted <= 46, `${counted} من ~43`);

const still = createStepDetector();
let falseSteps = 0;
t = 0;
for (let i = 0; i < 1200; i++) {
    t += 20;
    if (still.push(9.81 + (Math.random() - 0.5) * 0.3, t)) falseSteps++;
}
ok('ولا يعدّ الوقوف خطوات', falseSteps === 0, `${falseSteps}`);

// ── ١٣) تنعيم البوصلة ───────────────────────────────────────
head('١٣) تنعيم البوصلة');

const filter = createHeadingFilter(0.25);
for (let i = 0; i < 60; i++) filter.push(90);
ok('يستقرّ على القيمة', near(filter.push(90), 90, 0.01));

const cross = createHeadingFilter(0.5);
for (let i = 0; i < 40; i++) cross.push(358);
const crossed = cross.push(2);
ok('ويعبر الشمال بلا قفزة', crossed > 355 || crossed < 5, `${crossed}`);

// ── ١٤) التقدّم والعرض ──────────────────────────────────────
head('١٤) التقدّم والعرض');
const moved = advance({ x: 0, z: 0 }, 90, 3);
ok('شرقاً ثلاثة أمتار', near(moved.x, 3, 1e-9) && near(moved.z, 0, 1e-9));
ok('المسافة تُعرض مقروءة',
    readableDistance(0.4) === 'أقل من متر' && readableDistance(47.2) === '47 م');

// ── ١٥) قراءة المستشعر ──────────────────────────────────────
head('١٥) قراءة المستشعر');
let pose = poseFromOrientation({ alpha: 0, beta: 90, gamma: 0 });
ok('هاتف قائم ينظر للأفق', pose.pitch === 0 && pose.heading === 0);

pose = poseFromOrientation({ alpha: 90, beta: 90, gamma: 0 });
ok('ألفا تُقلب إلى بوصلة', pose.heading === 270, `${pose.heading}`);

pose = poseFromOrientation({ webkitCompassHeading: 45, alpha: 315, beta: 40, gamma: 10 });
ok('بوصلة iOS تُؤخذ كما هي', pose.heading === 45);
ok('والنظر للأرض ميل سالب', pose.pitch === -50);

pose = poseFromOrientation({ alpha: 0, beta: 90, gamma: 0 }, 90);
ok('دوران الشاشة يُزيح البوصلة', pose.heading === 90);
ok('وغياب الحدث لا يكسر شيئاً', poseFromOrientation(null).heading === 0);

// ── ١٦) التصويب ──────────────────
head('١٦) التصويب');

const flat = { heading: 0, pitch: 0, roll: 0 };

ok('شعاع المركز متّجه وحدة', (() => {
    const [dx, dy, dz] = screenRay(0, 0, flat, FOV, ASPECT);
    return near(Math.hypot(dx, dy, dz), 1, 1e-12);
})());

let ray = pointAlongRay(0, 0, flat, { x: 0, z: 0 }, EYE, 4, FOV, ASPECT);
ok('نظر أفقي: النقطة على ارتفاع العين', near(ray.y, EYE, 1e-9) && near(ray.z, 4, 1e-9));

ray = pointAlongRay(0, 0, { heading: 0, pitch: 30, roll: 0 }, { x: 0, z: 0 }, EYE, 4, FOV, ASPECT);
ok('نظر لأعلى ٣٠°: ترتفع نصف المسافة', near(ray.y, EYE + 2, 1e-9), `${ray.y}`);

ray = pointAlongRay(0, 0, { heading: 90, pitch: 0, roll: 0 }, { x: 0, z: 0 }, EYE, 5, FOV, ASPECT);
ok('نحو الشرق: النقطة شرقنا', near(ray.x, 5, 1e-9) && near(ray.z, 0, 1e-9));

ok('الارتفاع لا ينزل تحت الأرض',
    pointAlongRay(0, 0, { heading: 0, pitch: -80, roll: 0 }, { x: 0, z: 0 }, EYE, 9, FOV, ASPECT).y >= 0);

let aim = aimPoint({ heading: 0, pitch: -40, roll: 0 }, { x: 0, z: 0 }, EYE, 3, FOV, ASPECT);
ok('النظر لأسفل يقع على الأرض', aim.onFloor === true && near(aim.y, 0));

aim = aimPoint({ heading: 0, pitch: 6, roll: 0 }, { x: 0, z: 0 }, EYE, 3, FOV, ASPECT);
ok('النظر للأفق يقع على الشعاع', aim.onFloor === false);
ok('وبالمسافة التي طُلبت', near(aim.distance, 3));

aim = aimPoint({ heading: 0, pitch: -40, roll: 0 }, { x: 0, z: 0 }, EYE, 3, FOV, ASPECT, { preferRay: true });
ok('و«مرتفع» يتجاوز الأرض عمداً', aim.onFloor === false);

aim = aimPoint({ heading: 0, pitch: -1, roll: 0 }, { x: 0, z: 0 }, EYE, 3, FOV, ASPECT);
ok('والأرض البعيدة جداً تُرفض', aim.onFloor === false);

// ما يُصوّب عليه يجب أن يعود إلى وسط الشاشة تماماً —
// وإلا وقعت النقطة في غير ما يراه المستخدم في الحلقة
let centreWorst = 0;
for (const heading of [0, 88, 200, 317]) {
    for (const pitch of [-60, -25, 5, 40]) {
        for (const roll of [0, 20]) {
            const pose = { heading, pitch, roll };
            const a = aimPoint(pose, { x: 2, z: -3 }, EYE, 5, FOV, ASPECT);
            const back = worldToScreen({ x: a.x, y: a.y, z: a.z }, pose, { x: 2, z: -3 }, EYE, FOV, ASPECT);
            if (!back) continue;
            centreWorst = Math.max(centreWorst, Math.hypot(back.sx, back.sy));
        }
    }
}
ok('المُصوّب عليه يعود إلى مركز الشاشة', centreWorst < 1e-9, `${centreWorst.toExponential(2)}`);

// ── ١٠) البُعد من الحركة ──
// هذا ما يُغني الأدمن عن إدخال المسافة بيده: يمشي، فيُقاس.
head('١٠) البُعد من الحركة');

const target = { x: 0, z: 10 };
const shot = (x, z) => ({ x, z, bearing: bearingTo({ x, z }, target) });

const tri = triangulate(shot(0, 0), shot(3, 0));
ok('يُثلّث موضع الهدف', tri && near(tri.x, 0, 1e-6) && near(tri.z, 10, 1e-6),
   tri ? `${tri.x},${tri.z}` : 'null');
ok('ويُعطي بُعده عن أوّل موضع', tri && near(tri.distance, 10, 1e-6));
ok('ويقيس الاختلاف الزاويّ', tri && near(tri.parallax, 16.699244, 1e-4), `${tri && tri.parallax}`);

const back2 = triangulate(shot(3, 0), shot(0, 0));
ok('والعكس يُعطي نفس الموضع', back2 && near(back2.x, 0, 1e-6) && near(back2.z, 10, 1e-6));
ok('ومسافته من موضعه هو', back2 && near(back2.distance, Math.hypot(3, 10), 1e-6));

ok('المتوازيان يُرفضان',
   triangulate({ x: 0, z: 0, bearing: 0 }, { x: 3, z: 0, bearing: 0 }) === null);
ok('والاختلاف الضئيل يُرفض', triangulate(shot(0, 0), shot(0.05, 0)) === null);
ok('وما خلفك يُرفض',
   triangulate({ x: 0, z: 0, bearing: 0 }, { x: 3, z: 0, bearing: 200 }) === null);

const far = triangulate(
    { x: 0, z: 0, bearing: bearingTo({ x: 0, z: 0 }, { x: 0, z: 40 }) },
    { x: 2.9, z: 0, bearing: bearingTo({ x: 2.9, z: 0 }, { x: 0, z: 40 }) }
);
ok('البعيد يُقاس لكن بثقة أقلّ', far && far.quality < 0.2, `${far && far.quality}`);

const finder = createRangeFinder();
ok('بلا أرصاد لا تقدير', finder.estimate === null);

finder.push({ x: 0, z: 0, bearing: bearingTo({ x: 0, z: 0 }, target) });
ok('ورصد واحد لا يكفي', finder.estimate === null);

finder.push({ x: 0.2, z: 0, bearing: bearingTo({ x: 0.2, z: 0 }, target) });
ok('وقاعدة قصيرة لا تكفي', finder.estimate === null);

finder.push({ x: 3, z: 0, bearing: bearingTo({ x: 3, z: 0 }, target) });
const est = finder.estimate;
ok('وخطوتان تكفيان', est !== null);
ok('ويُصيب الهدف', est && near(est.x, 0, 1e-3) && near(est.z, 10, 1e-3));
ok('ويرفع الثقة مع اتّساع القاعدة', est && est.quality > 0.2, `${est && est.quality}`);

finder.reset();
ok('والتصفير يُنسيه كل شيء', finder.estimate === null);

const other = { x: -6, z: 4 };
for (const x of [0, 1.2, 2.4]) finder.push({ x, z: 0, bearing: bearingTo({ x, z: 0 }, other) });
const second = finder.estimate;
ok('ويقيس هدفاً جديداً نظيفاً',
   second && near(second.x, -6, 1e-3) && near(second.z, 4, 1e-3));

// ── ١١) تقطيع المشية ──
head('١١) تقطيع المشية');

const walk = [{ x: 0, z: 0 }, { x: 0, z: 4 }, { x: 0, z: 10 }];

let cutOut = slicePath(walk, 0, 10);
ok('القطعة الكاملة تُعيد الطول كلّه', near(polylineLength(cutOut), 10, 1e-9));
ok('وتبدأ من البداية وتنتهي عند النهاية',
   near(cutOut[0].z, 0) && near(cutOut[cutOut.length - 1].z, 10));

cutOut = slicePath(walk, 3, 7);
ok('والقطعة الوسطى طولها ما طُلب', near(polylineLength(cutOut), 4, 1e-9));
ok('وتبدأ وتنتهي حيث طُلبت',
   near(cutOut[0].z, 3, 1e-9) && near(cutOut[cutOut.length - 1].z, 7, 1e-9));
ok('وتحفظ رأس المقطع الواقع داخلها', cutOut.some(q => near(q.z, 4, 1e-9)));

const bend = [{ x: 0, z: 0 }, { x: 0, z: 5 }, { x: 5, z: 5 }];
const piece = slicePath(bend, 2, 8);
ok('والمنعطفة تُقصّ بطولها لا بوترها', near(polylineLength(piece), 6, 1e-9));
ok('والزاوية تبقى فيها', piece.some(q => near(q.x, 0, 1e-9) && near(q.z, 5, 1e-9)));

ok('والطول الصفر لا يُنتج ممرّاً', slicePath(walk, 5, 5).length <= 2);
ok('وما وراء النهاية يُقصّ عندها', near(polylineLength(slicePath(walk, 8, 99)), 2, 1e-9));
ok('وخطّ من نقطة واحدة يُعيد لا شيء', slicePath([{ x: 1, z: 1 }], 0, 5).length === 0);

let strayWorst = 0;
for (const q of slicePath(bend, 1.3, 7.4)) strayWorst = Math.max(strayWorst, projectOnPath(bend, q).offset);
ok('وكل نقاطها على المشية نفسها', strayWorst < 1e-9, `${strayWorst}`);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
