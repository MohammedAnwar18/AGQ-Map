/* جيوبورتال — بياناتٌ توضيحيّةٌ مصطنعةٌ للقالب فقط (ليست معالمَ حقيقيّة).
   استبدلها بـGP.load(url) من مكتبة بيانات PalNovaa أو من خادمك. window.GP_DATA */
(function (w) {
  'use strict';
  var C = [35.206, 31.902], seed = 11;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function P(dx, dy) { return [+(C[0] + dx).toFixed(5), +(C[1] + dy).toFixed(5)]; }
  function ring(cx, cy, rx, ry, n, jit) {
    var r = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, k = 1 + (rnd() - .5) * (jit || 0);
      r.push(P(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k));
    }
    r.push(r[0]); return [r];
  }
  function ln(pts) { return pts.map(function (q) { return P(q[0], q[1]); }); }
  function F(geom, props) { return { type: 'Feature', geometry: geom, properties: props || {} }; }
  function FC(a) { return { type: 'FeatureCollection', features: a }; }
  function poly(c, p) { return F({ type: 'Polygon', coordinates: c }, p); }
  function line(p, q) { return F({ type: 'LineString', coordinates: ln(p) }, q); }
  function pt(dx, dy, p) { return F({ type: 'Point', coordinates: P(dx, dy) }, p); }

  var towns = ['رام الله', 'البيرة', 'بيتونيا', 'بيرزيت', 'سلواد', 'دير دبوان'];
  function town() { return towns[Math.floor(rnd() * towns.length)]; }

  /* ─ الحدود الإداريّة ─ */
  var gov = FC([poly(ring(0, 0, .085, .066, 20, .16), { name: 'محافظة رام الله والبيرة', area_km2: 855 })]);
  var muni = FC([
    poly(ring(-.012, .004, .020, .016, 14, .22), { name: 'بلدية رام الله', pop: 38998 }),
    poly(ring(.018, -.004, .019, .015, 14, .22), { name: 'بلدية البيرة', pop: 46208 }),
    poly(ring(-.044, -.010, .016, .013, 12, .24), { name: 'بلدية بيتونيا', pop: 27000 })]);
  var vill = FC([
    poly(ring(-.030, .046, .011, .009, 10, .3), { name: 'بيرزيت' }),
    poly(ring(.052, .040, .010, .008, 10, .3), { name: 'سلواد' }),
    poly(ring(.046, -.044, .011, .009, 10, .3), { name: 'دير دبوان' }),
    poly(ring(-.058, .030, .009, .008, 10, .3), { name: 'عين سينيا' })]);

  /* ─ البنية التحتيّة ─ */
  var roadMain = FC([
    line([[-.082, -.016], [-.040, -.006], [0, 0], [.040, .008], [.082, .020]], { name: 'طريق 60', lanes: 4, len_km: 18.4 }),
    line([[-.010, .062], [-.004, .028], [0, 0], [.006, -.030], [.012, -.062]], { name: 'شارع القدس', lanes: 2, len_km: 13.1 })]);
  var roadSec = FC([
    line([[0, 0], [.026, .022], [.050, .038]], { name: 'طريق سلواد', len_km: 7.2 }),
    line([[0, 0], [-.026, .026], [-.032, .046]], { name: 'طريق بيرزيت', len_km: 6.4 }),
    line([[0, 0], [.024, -.026], [.046, -.044]], { name: 'طريق دير دبوان', len_km: 6.9 }),
    line([[0, 0], [-.030, -.008], [-.046, -.012]], { name: 'طريق بيتونيا', len_km: 4.8 })]);
  var water = FC([
    line([[.030, -.052], [.016, -.028], [.004, -.008], [-.010, .010], [-.026, .020]], { name: 'خط ناقل رئيسي', dia_mm: 400 }),
    line([[-.044, -.010], [-.024, -.004], [-.006, .002]], { name: 'خط بيتونيا', dia_mm: 250 })]);
  var power = FC([
    line([[-.078, -.058], [-.038, -.026], [-.008, -.004], [.014, .016], [.044, .056]], { name: 'خط 33 ك.ف', kv: 33 })]);

  /* ─ الخدمات العامّة ─ */
  function pts(n, kind, near) {
    var a = [];
    for (var i = 0; i < n; i++) {
      var r = (near || .030) * Math.sqrt(rnd()), g = rnd() * Math.PI * 2;
      a.push(pt(Math.cos(g) * r * 1.2, Math.sin(g) * r, {
        name: kind + ' ' + (i + 1), town: town(),
        status: rnd() > .12 ? 'فعّال' : 'قيد المراجعة'
      }));
    }
    return FC(a);
  }
  var schools = pts(14, 'مدرسة');
  var clinics = pts(8, 'مركز صحّي');
  var mosques = pts(11, 'مسجد');

  /* ─ البيئة والموارد ─ */
  var green = FC([
    poly(ring(-.024, .028, .013, .010, 12, .28), { name: 'حرش رام الله', area_du: 420 }),
    poly(ring(.034, .018, .011, .009, 12, .28), { name: 'غابة الطيبة', area_du: 310 })]);
  var wells = pts(6, 'بئر مياه', .055);

  /* ─ تعريفُ الطبقات: المجموعة · النوع · اللون · البيانات ─ */
  var layers = [
    { id: 'gov',     name: 'حدود المحافظة',   group: 'الحدود الإدارية', geom: 'polygon', color: '#7A5AC0', on: true,  data: gov,      kind: 'مضلّع' },
    { id: 'muni',    name: 'حدود البلديات',   group: 'الحدود الإدارية', geom: 'polygon', color: '#2563EB', on: true,  data: muni,     kind: 'مضلّع' },
    { id: 'vill',    name: 'حدود القرى',      group: 'الحدود الإدارية', geom: 'polygon', color: '#3A80C2', on: false, data: vill,     kind: 'مضلّع' },
    { id: 'road1',   name: 'الطرق الرئيسية',  group: 'البنية التحتية',  geom: 'line',    color: '#E07B39', on: true,  data: roadMain, kind: 'خطّ' },
    { id: 'road2',   name: 'الطرق الفرعية',   group: 'البنية التحتية',  geom: 'line',    color: '#B07A2A', on: false, data: roadSec,  kind: 'خطّ' },
    { id: 'water',   name: 'شبكة المياه',     group: 'البنية التحتية',  geom: 'line',    color: '#3A80C2', on: false, data: water,    kind: 'خطّ' },
    { id: 'power',   name: 'شبكة الكهرباء',   group: 'البنية التحتية',  geom: 'line',    color: '#D63A3A', on: false, data: power,    kind: 'خطّ' },
    { id: 'schools', name: 'المدارس',         group: 'الخدمات العامة',  geom: 'point',   color: '#0E7C66', on: true,  data: schools,  kind: 'نقطة' },
    { id: 'clinics', name: 'المراكز الصحية',  group: 'الخدمات العامة',  geom: 'point',   color: '#D63A3A', on: true,  data: clinics,  kind: 'نقطة' },
    { id: 'mosques', name: 'المساجد',         group: 'الخدمات العامة',  geom: 'point',   color: '#6E9D5A', on: false, data: mosques,  kind: 'نقطة' },
    { id: 'green',   name: 'المساحات الخضراء', group: 'البيئة والموارد', geom: 'polygon', color: '#6E9D5A', on: false, data: green,   kind: 'مضلّع' },
    { id: 'wells',   name: 'آبار المياه',     group: 'البيئة والموارد', geom: 'point',   color: '#3FD1AE', on: false, data: wells,    kind: 'نقطة' }
  ];
  layers.forEach(function (l) { l.count = l.data.features.length; l.published = l.id !== 'power'; });

  w.GP_DATA = { center: [C[1], C[0]], zoom: 12, layers: layers, updated: '2026-11-24' };
})(window);
