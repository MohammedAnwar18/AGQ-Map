/* اختبارات تبليط الراستر — وأهمّها أن البلاطة تقع حيث تقول */
import {
    TILE, MAX_LAT,
    tileToLon, tileToLat, lonToTile, latToTile,
    tileRange, tileCountAt, tileBounds,
    nativeZoom, planPyramid, listTiles,
    makeTransform, sourceCorners,
    buildWarpGrid, sampleWarpGrid,
    stretchRange, boundsOfCorners
} from '../src/components/raster/rasterGeo.js';
import proj4 from 'proj4';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

// بير زيت تقريباً — المنطقة التي يُرفع فيها راستر فعلاً
const BIRZEIT = { lon: 35.1839, lat: 31.9617 };

// ── ١) البلاطة والإحداثيات ──────────────────────────────────
head('١) البلاطة والإحداثيات');

ok('بلاطة العالم عند الصفر تبدأ غرباً', near(tileToLon(0, 0), -180));
ok('وتنتهي شرقاً', near(tileToLon(1, 0), 180));
ok('وشمالها حدّ ماسنريتور', near(tileToLat(0, 0), MAX_LAT, 1e-9), `${tileToLat(0, 0)}`);
ok('وجنوبها حدّه سالباً', near(tileToLat(1, 0), -MAX_LAT, 1e-9));
ok('وخطّ الاستواء في منتصفها', near(tileToLat(0.5, 0), 0, 1e-12));
ok('وخطّ غرينتش كذلك', near(tileToLon(0.5, 0), 0));
ok('وحجم البلاطة ٢٥٦', TILE === 256);

// الذهاب والإياب على مواضع ومستويات مختلفة
let worst = 0;
for (const z of [0, 3, 8, 12, 16, 19, 22]) {
    for (const lon of [-179.9, -35.5, 0, 35.1839, 120.4, 179.9]) {
        for (const lat of [-84, -31.5, 0, 31.9617, 60.2, 84]) {
            const back = [
                tileToLon(lonToTile(lon, z), z),
                tileToLat(latToTile(lat, z), z)
            ];
            worst = Math.max(worst, Math.abs(back[0] - lon), Math.abs(back[1] - lat));
        }
    }
}
ok('التحويل وعكسه يعودان بالموضع نفسه', worst < 1e-9, `${worst.toExponential(2)}°`);

// قيمة معروفة: بير زيت عند z=12
const bzX = Math.floor(lonToTile(BIRZEIT.lon, 12));
const bzY = Math.floor(latToTile(BIRZEIT.lat, 12));
ok('بير زيت في بلاطتها عند ١٢', bzX === 2448 && bzY === 1663, `${bzX},${bzY}`);

// الاتّجاه: ‎XYZ‎ أصله أعلى اليسار و‎TMS‎ مقلوب. والخلط بينهما
// يقلب الراستر رأساً على عقب وهو أشهر خطأ في التبليط
ok('النصف الشمالي أعلى الشاشة', Math.floor(latToTile(45, 1)) === 0);
ok('والجنوبي أسفلها', Math.floor(latToTile(-45, 1)) === 1);

// البلاطة تحتوي الموضع الذي حُسبت منه
const bzBounds = tileBounds(12, bzX, bzY);
ok('والبلاطة تحيط بالموضع',
    BIRZEIT.lon >= bzBounds.west && BIRZEIT.lon <= bzBounds.east
    && BIRZEIT.lat <= bzBounds.north && BIRZEIT.lat >= bzBounds.south);

// خطوط العرض فوق الحدّ تُقصّ ولا تنفجر
ok('ما فوق حدّ ماسنريتور يُقصّ', Number.isFinite(latToTile(89.9, 10)));
ok('وما تحته كذلك', Number.isFinite(latToTile(-89.9, 10)));

// ── ٢) مدى البلاطات ─────────────────────────────────────────
head('٢) مدى البلاطات');

const world = { west: -180, east: 180, south: -MAX_LAT, north: MAX_LAT };
ok('العالم بلاطة واحدة عند الصفر', tileCountAt(world, 0) === 1);
ok('وأربع عند الأوّل', tileCountAt(world, 1) === 4, `${tileCountAt(world, 1)}`);
ok('و‎٤^z‎ عند الثالث', tileCountAt(world, 3) === 64, `${tileCountAt(world, 3)}`);

// مستطيل صغير: بلاطة أو اثنتان لا أكثر
const small = { west: 35.18, east: 35.19, south: 31.95, north: 31.96 };
// عرض البلاطة عند ١٢ هو ‎0.088°‎، والمستطيل ‎0.01°‎ — فهو داخل بلاطة
// أو يعبر حدّاً فيلمس أربعاً على الأكثر. وموضعه من الحدّ ليس شيئاً يُشترط
ok('المستطيل الصغير يلمس بلاطات معدودة عند ١٢',
    tileCountAt(small, 12) >= 1 && tileCountAt(small, 12) <= 4, `${tileCountAt(small, 12)}`);
ok('ويكبر العدد مع التكبير', tileCountAt(small, 17) > tileCountAt(small, 14));

// لا بلاطات خارج العالم
for (const z of [0, 1, 5, 14]) {
    const r = tileRange(world, z);
    const span = Math.pow(2, z);
    ok(`لا بلاطة سالبة ولا خارج الحدّ عند ${z}`,
        r.x0 >= 0 && r.y0 >= 0 && r.x1 < span && r.y1 < span,
        `${r.x0},${r.y0}..${r.x1},${r.y1}`);
}

// ── ٣) اختيار المستويات ─────────────────────────────────────
head('٣) اختيار المستويات');

// راستر ٤٠٩٦ بكسلاً على ٠٫٠١° — تقريباً ٢٥ سم للبكسل
const sharp = { west: 35.18, east: 35.19, south: 31.95, north: 31.96 };
const zNative = nativeZoom(sharp, 4096);
ok('الدقّة العالية تعطي مستوىً عالياً', zNative > 18 && zNative < 21, `${zNative.toFixed(2)}`);

// نصف الدقّة يعني مستوىً أقلّ بواحد بالضبط
ok('نصف الدقّة ينزل مستوىً واحداً',
    near(nativeZoom(sharp, 4096) - nativeZoom(sharp, 2048), 1, 1e-12));

const plan = planPyramid(sharp, 4096, { maxTiles: 1200 });
ok('الهرم يبدأ من مستوى يُظهر الراستر كلّه', plan.minZoom <= 13, `${plan.minZoom}`);
ok('وينتهي عند الدقّة الأصلية', plan.maxZoom === plan.nativeZoom, `${plan.maxZoom}/${plan.nativeZoom}`);
ok('وعدده تحت السقف', plan.count <= 1200, `${plan.count}`);
ok('وغير مقصوص', plan.capped === false);

// السقف الضيّق يتنازل عن الأعلى لا عن الأدنى — فيبقى الراستر مرئياً
const tight = planPyramid(sharp, 16384, { maxTiles: 40 });
ok('السقف الضيّق يقصّ', tight.capped === true);
ok('وتحت السقف', tileSum(tight) <= 40, `${tight.count}`);
ok('ويبقى أدنى مستوى كما هو', tight.minZoom === plan.minZoom, `${tight.minZoom} ≠ ${plan.minZoom}`);
ok('وأعلاه أقلّ من الأصلي', tight.maxZoom < tight.nativeZoom);

function tileSum(pl) {
    return listTiles(sharp, pl.minZoom, pl.maxZoom).length;
}

// العدد المعلن هو العدد الحقيقي — وعليه يُبنى شريط التقدّم
ok('العدد المعلن يساوي المرفوع فعلاً',
    plan.count === listTiles(sharp, plan.minZoom, plan.maxZoom).length,
    `${plan.count} ≠ ${listTiles(sharp, plan.minZoom, plan.maxZoom).length}`);

// القائمة مرتّبة تصاعدياً بالتكبير: يُرى شيء قبل أن يكتمل الرفع
const order = listTiles(sharp, plan.minZoom, plan.maxZoom);
let sorted = true;
for (let i = 1; i < order.length; i++) if (order[i].z < order[i - 1].z) sorted = false;
ok('ومرتّبة من الأدنى تكبيراً', sorted);

// راستر بلا امتداد لا يُسقط الحساب
ok('العرض الصفر لا ينفجر', nativeZoom({ west: 35, east: 35, south: 31, north: 31 }, 100) === 0);
ok('والبكسل الصفر كذلك', nativeZoom(sharp, 0) === 0);

// ── ٤) تحويل المصدر ────────────────────────────────────────
head('٤) تحويل المصدر');

// ‎UTM 36N‎ نموذجي: أصل أعلى اليسار، نصف متر للبكسل
const gt = makeTransform({ originX: 700000, originY: 3540000, scaleX: 0.5, scaleY: 0.5 });

ok('الأصل هو البكسل صفر', (() => {
    const q = gt.toPixel(700000, 3540000);
    return near(q.col, 0) && near(q.row, 0);
})());

ok('والشرق يزيد العمود', gt.toPixel(700050, 3540000).col === 100);
ok('والجنوب يزيد السطر', gt.toPixel(700000, 3539950).row === 100);

let gtWorst = 0;
for (let col = 0; col < 3000; col += 137) {
    for (let row = 0; row < 3000; row += 211) {
        const q = gt.toProjected(col, row);
        const back = gt.toPixel(q.x, q.y);
        gtWorst = Math.max(gtWorst, Math.abs(back.col - col), Math.abs(back.row - row));
    }
}
ok('والذهاب والإياب بكسل ببكسل', gtWorst < 1e-9, `${gtWorst.toExponential(2)}`);

ok('المقياس الصفر يُرفض', makeTransform({ originX: 0, originY: 0, scaleX: 0, scaleY: 1 }) === null);

const corners = sourceCorners(gt, 1000, 800);
ok('الزوايا أربع', corners.length === 4);
ok('والأولى هي الأصل', near(corners[0].x, 700000) && near(corners[0].y, 3540000));
ok('والثالثة قطرُه', near(corners[2].x, 700500) && near(corners[2].y, 3539600));

// ── ٥) شبكة الاعتياض ───────────────────────────────────────
// هذه هي المقايضة الوحيدة في التبليط كلّه: نستدعي ‎proj4‎ على عقد
// خشنة ونعتاض بينها. فإن أخطأ الاعتياض بكسلاً، أزاحت الصورة.
head('٥) شبكة الاعتياض');

/*
 * المحوّل المرجعي هو ‎proj4‎ نفسه إلى ‎UTM 36N‎.
 *
 * وكان هنا ماسنريتور كروي، وهو اختيار يُفرغ الاختبار من
 * معناه: ‎tileToLat‎ هو عكس ماسنريتور بالتعريف، فتركيبهما
 * خطّي تماماً في فضاء البلاطة — فالاعتياض الخطّي مضبوط مهما
 * خشُنت الشبكة، وكان الخطأ يقيس دقّة الفاصلة العائمة لا الاعتياض.
 *
 * و‎UTM‎ هو ما تكون عليه ملفات ‎GeoTIFF‎ فعلاً هنا، وهو غير خطّي
 * في فضاء البلاطة فعلاً.
 */
proj4.defs('EPSG:32636', '+proj=utm +zone=36 +ellps=WGS84 +datum=WGS84 +units=m +no_defs');
const toUtm = (lon, lat) => proj4('EPSG:4326', 'EPSG:32636', [lon, lat]);

const z = 17;
const tx = Math.floor(lonToTile(BIRZEIT.lon, z));
const ty = Math.floor(latToTile(BIRZEIT.lat, z));

const grid = buildWarpGrid(z, tx, ty, 16, toUtm);

ok('العقد تساوي ‎(steps+1)²‎', grid.nodes.length === 17 * 17 * 2);

// العقد نفسها مضبوطة تماماً — لا اعتياض عندها
ok('والعقدة الأولى هي التحويل نفسه', (() => {
    const want = toUtm(tileToLon(tx, z), tileToLat(ty, z));
    const got = sampleWarpGrid(grid, 0, 0);
    return near(got[0], want[0], 1e-6) && near(got[1], want[1], 1e-6);
})());

ok('والعقدة الأخيرة كذلك', (() => {
    const want = toUtm(tileToLon(tx + 1, z), tileToLat(ty + 1, z));
    const got = sampleWarpGrid(grid, 1, 1);
    return near(got[0], want[0], 1e-6) && near(got[1], want[1], 1e-6);
})());

// بلاطة ‎z17‎ على هذا العرض: نحسب البكسل فعلاً لا نُخمّنه
const tb = tileBounds(z, tx, ty);
const tileMetres = Math.abs(toUtm(tb.east, tb.north)[0] - toUtm(tb.west, tb.north)[0]);
const pixelMetres = tileMetres / TILE;

// وبين العقد: الخطأ بالأمتار يُقاس ثمّ يُحوّل إلى بكسلات.
// والعينات على ‎27‎ لا ‎64‎: عدد أوّلي لا يقع على العقد فيستريح الاختبار
const errorIn = (g, divisions) => {
    let bad = 0;
    for (let i = 0; i <= divisions; i++) {
        for (let j = 0; j <= divisions; j++) {
            const u = i / divisions;
            const v = j / divisions;
            const want = toUtm(tileToLon(tx + u, z), tileToLat(ty + v, z));
            const got = sampleWarpGrid(g, u, v);
            bad = Math.max(bad, Math.hypot(got[0] - want[0], got[1] - want[1]));
        }
    }
    return bad;
};

const metresWorst = errorIn(grid, 27);
const errorPixels = metresWorst / pixelMetres;

ok('الاعتياض يخطئ أقلّ من عُشر بكسل',
    errorPixels < 0.1, `${errorPixels.toFixed(4)} بكسل (${metresWorst.toFixed(4)} م)`);

// والخشونة تُسيء فعلاً — فالعدد ‎16‎ اختيار لا صدفة
const coarseWorst = errorIn(buildWarpGrid(z, tx, ty, 1, toUtm), 27);
ok('والأخشن أسوأ — فالعدد مقصود',
    coarseWorst > metresWorst,
    `خشن ${coarseWorst.toExponential(2)} م ضد ناعم ${metresWorst.toExponential(2)} م`);

// وتضاعف العقد يُنقّص الخطأ — سلوك الاعتياض الخطّي المتوقّع
const mid = errorIn(buildWarpGrid(z, tx, ty, 4, toUtm), 27);
ok('وكلّما كثرت العقد قلّ الخطأ', coarseWorst > mid && mid > metresWorst,
    `${coarseWorst.toExponential(1)} > ${mid.toExponential(1)} > ${metresWorst.toExponential(1)}`);

// خارج المدى يُقصّ ولا يقرأ ذاكرة ليست له
ok('ما خرج عن البلاطة يُقصّ', (() => {
    const a = sampleWarpGrid(grid, -0.4, 1.7);
    const b = sampleWarpGrid(grid, 0, 1);
    return near(a[0], b[0], 1e-9) && near(a[1], b[1], 1e-9);
})());

// ── ٦) تمدّد التبايُن ──────────────────────────────────────
head('٦) تمدّد التبايُن');

// قيم ١٦-بت معتادة مع بكسل لامع شاذّ: بلا تمدّد تصير الصورة سوداء
const band = new Uint16Array(10000);
for (let i = 0; i < band.length; i++) band[i] = 1000 + (i % 400);
band[0] = 65535;

const range = stretchRange(band, { lowPct: 2, highPct: 98 });
ok('الشاذّ لا يسحب الحدّ الأعلى', range.high < 2000, `${range.high.toFixed(1)}`);
ok('والحدّ الأدنى قريب من القاع', range.low >= 1000 && range.low < 1100, `${range.low.toFixed(1)}`);
ok('والمدى صاعد', range.high > range.low);

// قيمة واحدة لا تُنتج قسمة على صفر
const flat = stretchRange(new Uint16Array(100).fill(700));
ok('المستوي لا يقسم على صفر', flat.high > flat.low);

// ‎nodata‎ تُستثنى من الإحصاء
const withNull = new Int16Array(1000);
for (let i = 0; i < withNull.length; i++) withNull[i] = i < 500 ? -9999 : 300 + (i % 50);
const clean = stretchRange(withNull, { ignore: -9999 });
ok('قيمة الفراغ تُستثنى', clean.low >= 300, `${clean.low.toFixed(1)}`);

// الفارغ تماماً لا يُسقط الحساب
const empty = stretchRange(new Float32Array([NaN, NaN]));
ok('والفارغ يُعيد مدىً صالحاً', empty.high > empty.low);

// المدى الكامل عند ٠..١٠٠ بالمئة
const ramp = new Uint8Array(256);
for (let i = 0; i < 256; i++) ramp[i] = i;
const full = stretchRange(ramp, { lowPct: 0, highPct: 100, bins: 256 });
ok('ومن صفر إلى مئة يأخذ الكلّ', near(full.low, 0, 1) && near(full.high, 255, 1),
    `${full.low}..${full.high}`);

// ── ٧) حدود الزوايا ───────────────────────────────────────
head('٧) حدود الزوايا');

// راستر مُدار قليلاً بعد إعادة الإسقاط — الحدود تحيط به كلّه
const turned = [[35.18, 31.962], [35.191, 31.9605], [35.1895, 31.9495], [35.1785, 31.951]];
const b = boundsOfCorners(turned);
ok('الحدود تحيط بكل زاوية',
    turned.every(c => c[0] >= b.west && c[0] <= b.east && c[1] >= b.south && c[1] <= b.north));
ok('وغربها أصغر من شرقها', b.west < b.east);
ok('وجنوبها أصغر من شمالها', b.south < b.north);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
