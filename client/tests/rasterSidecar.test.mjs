/* اختبارات الإحداثيات من الملفّات المجاورة — وهي ما جعل تيف الأدمن يُرفض */
import {
    makeTransform, affineFromWorldFile, affineFromGdal,
    affineFromMatrix, affineFromBounds
} from '../src/components/raster/rasterGeo.js';
import {
    parseWorldFile, parseAuxXml, parsePrj, sidecarKind, stemOf
} from '../src/components/raster/rasterSidecar.js';

let p = 0, f = 0;
const ok = (n, c, d = '') => { if (c) { p++; console.log('  ✓ ' + n); } else { f++; console.log('  ✗ ' + n + '  ' + d); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const head = (t) => console.log('\n' + t);

// ── ١) التحويل الأفيني الكامل ───────────────────────────────
head('١) التحويل الأفيني الكامل');

// شمال-أعلى بالشكل المختصر — وهو ما كان مدعوماً وحده
const plain = makeTransform({ originX: 700000, originY: 3540000, scaleX: 0.5, scaleY: 0.5 });
ok('المختصر لا يزال يعمل', plain && !plain.rotated);
ok('ومقاس بكسله صحيح', near(plain.pixelWidth, 0.5) && near(plain.pixelHeight, 0.5));

// مُدار ثلاثين درجة: هذا ما كان يُرفض
const rad = (30 * Math.PI) / 180;
const turned = makeTransform({
    a: 0.5 * Math.cos(rad), b: 0.5 * Math.sin(rad), c: 700000,
    d: 0.5 * Math.sin(rad), e: -0.5 * Math.cos(rad), f: 3540000
});

ok('المُدار يُقبل لا يُرفض', turned !== null);
ok('ويُعلن أنّه مُدار', turned.rotated === true);
ok('ومقاس بكسله يبقى نصف متر', near(turned.pixelWidth, 0.5, 1e-12) && near(turned.pixelHeight, 0.5, 1e-12));

// والأهمّ: ينعكس بالضبط — وعليه يقوم التبليط كلّه
let worst = 0;
for (const t of [plain, turned]) {
    for (let col = 0; col < 2000; col += 97) {
        for (let row = 0; row < 2000; row += 131) {
            const q = t.toProjected(col, row);
            const back = t.toPixel(q.x, q.y);
            worst = Math.max(worst, Math.abs(back.col - col), Math.abs(back.row - row));
        }
    }
}
ok('وينعكس بكسلاً ببكسل', worst < 1e-6, `${worst.toExponential(2)}`);

ok('المحدّد الصفر يُرفض', makeTransform({ a: 1, b: 2, c: 0, d: 2, e: 4, f: 0 }) === null);
ok('والمقياس المعدوم كذلك', makeTransform({ originX: 0, originY: 0, scaleX: 0, scaleY: 1 }) === null);

// ── ٢) ملفّ العالم ──────────────────────────────────────────
head('٢) ملفّ العالم .tfw');

// ‎.tfw‎ نموذجي: نصف متر، شمال-أعلى
const tfw = '0.5\n0.0\n0.0\n-0.5\n700000.25\n3539999.75\n';
const world = parseWorldFile(tfw);
ok('يُقرأ', Boolean(world.transform));

/*
 * الفخّ: أرقام ‎.tfw‎ تشير إلى مركز البكسل الأوّل، ووسوم ‎GeoTIFF‎
 * إلى زاويته. فلو أُخذت كما هي أزاحت الصورة نصف بكسل — وهو ربع متر
 * هنا، وأمتارٌ في ملفّ خشن.
 */
const atCorner = world.transform.toProjected(0, 0);
ok('وتُطرح منه نصف بكسل فيصير زاويّاً',
    near(atCorner.x, 700000) && near(atCorner.y, 3540000),
    `${atCorner.x}, ${atCorner.y}`);

ok('ومركز البكسل الأوّل يعود كما كُتب', (() => {
    const c = world.transform.toProjected(0.5, 0.5);
    return near(c.x, 700000.25) && near(c.y, 3539999.75);
})());

// الفاصلة العشرية الأوروبية — ملفّات ويندوز بإعدادات عربية
const euro = parseWorldFile('0,5\n0\n0\n-0,5\n700000,25\n3539999,75');
ok('والفاصلة العشرية الأوروبية تُقبل', Boolean(euro.transform) && near(euro.transform.pixelWidth, 0.5));

// ‎.tfw‎ مُدار: أرقام الدوران في السطرين الثاني والثالث
const turnedTfw = parseWorldFile('0.433\n0.25\n0.25\n-0.433\n700000\n3540000');
ok('والمُدار يُقرأ', Boolean(turnedTfw.transform) && turnedTfw.transform.rotated);

ok('والناقص يُرفض بوضوح', parseWorldFile('0.5\n0\n0').error?.includes('ستّة'));
ok('والفارغ كذلك', Boolean(parseWorldFile('').error));
ok('والنصّ غير الرقمي كذلك', Boolean(parseWorldFile('a\nb\nc\nd\ne\nf').error));

// ── ٣) ملفّ GDAL المساعد ───────────────────────────────────
head('٣) ملفّ aux.xml');

const aux = [
    '<PAMDataset>',
    '  <SRS dataAxisToSRSAxisMapping="1,2">PROJCS["WGS_1984_UTM_Zone_36N",',
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257]],',
    'PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],',
    'PROJECTION["Transverse_Mercator"],AUTHORITY["EPSG","32636"]]</SRS>',
    '  <GeoTransform>  7.0000000000000000e+05,  5.0000000000000000e-01,  0.0000000000000000e+00,',
    '  3.5400000000000000e+06,  0.0000000000000000e+00, -5.0000000000000000e-01</GeoTransform>',
    '  <Metadata><MDI key="STATISTICS_MAXIMUM">255</MDI></Metadata>',
    '</PAMDataset>'
].join('\n');

const parsedAux = parseAuxXml(aux);
ok('يُقرأ التحويل', Boolean(parsedAux.transform));
ok('ويُقرأ المرجع', parsedAux.crs === 'EPSG:32636', `${parsedAux.crs}`);

// ترتيب GDAL زاويّ أصلاً — فلا إزاحة نصف بكسل هنا
ok('والأصل زاويّ بلا إزاحة', (() => {
    const at = parsedAux.transform.toProjected(0, 0);
    return near(at.x, 700000) && near(at.y, 3540000);
})());

ok('والمقياس نصف متر', near(parsedAux.transform.pixelWidth, 0.5));

// ملفّ فيه مرجع بلا تحويل — وارد جداً
const srsOnly = parseAuxXml('<PAMDataset><SRS>PROJCS["x",AUTHORITY["EPSG","2039"]]</SRS></PAMDataset>');
ok('والمرجع وحده يُقبل', srsOnly.crs === 'EPSG:2039' && !srsOnly.transform);

ok('والخالي يُرفض', Boolean(parseAuxXml('<PAMDataset></PAMDataset>').error));

// ── ٤) ملفّ المرجع ─────────────────────────────────────────
head('٤) ملفّ .prj');

ok('WKT1 يُقرأ',
    parsePrj('PROJCS["UTM36N",GEOGCS["WGS84",AUTHORITY["EPSG","4326"]],AUTHORITY["EPSG","32636"]]').crs === 'EPSG:32636');

// آخر AUTHORITY هو مرجع المسقط لا مرجع نظام الإحداثيات الجغرافي
// داخله — وأخذ الأوّل يعطي 4326 فتقع الصورة في خليج غينيا
ok('ويُؤخذ الأخير لا الأوّل',
    parsePrj('PROJCS["x",GEOGCS["y",AUTHORITY["EPSG","4326"]],AUTHORITY["EPSG","2039"]]').crs === 'EPSG:2039');

ok('وWKT2 كذلك',
    parsePrj('PROJCRS["UTM zone 36N",BASEGEOGCRS["WGS 84",ID["EPSG",4326]],ID["EPSG",32636]]').crs === 'EPSG:32636');

ok('وبلا EPSG يُرفض', Boolean(parsePrj('PROJCS["something custom"]').error));

// ── ٥) اقتران الملفّات ─────────────────────────────────────
head('٥) اقتران الملفّات');

ok('يميّز ملفّ العالم', sidecarKind('map.tfw') === 'world');
ok('ويميّز المساعد', sidecarKind('map.tif.aux.xml') === 'aux');
ok('ويميّز المرجع', sidecarKind('map.prj') === 'prj');
ok('والتيف نفسه ليس مجاوراً', sidecarKind('map.tif') === null);
ok('ويقبل الامتدادات الكبيرة', sidecarKind('MAP.TFW') === 'world');
ok('و.wld كذلك', sidecarKind('map.wld') === 'world');

ok('الجذر يجمع العائلة', (() => {
    const want = stemOf('ortho.tif');
    return stemOf('ortho.tfw') === want
        && stemOf('ortho.prj') === want
        && stemOf('ortho.tif.aux.xml') === want;
})(), `${stemOf('ortho.tif')} / ${stemOf('ortho.tif.aux.xml')}`);

// ── ٦) الحدود المكتوبة باليد ───────────────────────────────
head('٦) الحدود المكتوبة باليد');

const manual = affineFromBounds({ west: 35.18, south: 31.95, east: 35.19, north: 31.96 }, 1000, 800);
ok('تُنتج تحويلاً', manual !== null);
ok('وزاويته العليا اليسرى هي الشمال الغربي', (() => {
    const at = manual.toProjected(0, 0);
    return near(at.x, 35.18) && near(at.y, 31.96);
})());
ok('وزاويته السفلى اليمنى هي الجنوب الشرقي', (() => {
    const at = manual.toProjected(1000, 800);
    return near(at.x, 35.19, 1e-12) && near(at.y, 31.95, 1e-12);
})());
ok('وغير مُدارة', manual.rotated === false);

ok('والحدود المقلوبة تُرفض',
    affineFromBounds({ west: 35.19, south: 31.95, east: 35.18, north: 31.96 }, 100, 100) === null);
ok('والأبعاد الصفر تُرفض',
    affineFromBounds({ west: 35.18, south: 31.95, east: 35.19, north: 31.96 }, 0, 100) === null);

// ── ٧) المصفوفة الكاملة ────────────────────────────────────
head('٧) مصفوفة ModelTransformation');

// شمال-أعلى مكتوبة كمصفوفة
const matrix = affineFromMatrix([0.5, 0, 0, 700000, 0, -0.5, 0, 3540000, 0, 0, 0, 0, 0, 0, 0, 1]);
ok('تُقرأ', matrix !== null);
ok('وأصلها صحيح', (() => {
    const at = matrix.toProjected(0, 0);
    return near(at.x, 700000) && near(at.y, 3540000);
})());
ok('وغير مُدارة حين لا دوران فيها', matrix.rotated === false);

const spun = affineFromMatrix([0.433, 0.25, 0, 700000, 0.25, -0.433, 0, 3540000]);
ok('والمُدارة تُقرأ وتُعلَن', spun !== null && spun.rotated === true);
ok('والقصيرة تُرفض', affineFromMatrix([1, 2, 3]) === null);

// ── ٨) المصادر تتّفق ───────────────────────────────────────
// نفس الراستر موصوفاً بأربع طرائق مختلفة يجب أن يقع في موضع واحد.
head('٨) المصادر تتّفق');

const tags = makeTransform({ originX: 700000, originY: 3540000, scaleX: 0.5, scaleY: 0.5 });
const viaWorld = parseWorldFile('0.5\n0\n0\n-0.5\n700000.25\n3539999.75').transform;
const viaGdal = affineFromGdal([700000, 0.5, 0, 3540000, 0, -0.5]);
const viaMatrix = affineFromMatrix([0.5, 0, 0, 700000, 0, -0.5, 0, 3540000]);

let spread = 0;
for (const t of [viaWorld, viaGdal, viaMatrix]) {
    for (const [col, row] of [[0, 0], [1000, 700], [2048, 2048]]) {
        const want = tags.toProjected(col, row);
        const got = t.toProjected(col, row);
        spread = Math.max(spread, Math.abs(got.x - want.x), Math.abs(got.y - want.y));
    }
}
ok('الوسوم و.tfw وaux.xml والمصفوفة تتّفق تماماً',
    spread < 1e-9, `${spread.toExponential(2)} وحدة`);

console.log(`\n${'='.repeat(46)}\nنجح ${p}   فشل ${f}`);
process.exit(f ? 1 : 0);
