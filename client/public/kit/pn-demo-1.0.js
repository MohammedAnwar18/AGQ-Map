/* PalNovaa demo data 1.0 — synthetic, illustrative geometry only (not real features). window.PN_DEMO */
(function (w) {
  var C = [35.205, 31.905], seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function P(dx, dy) { return [+(C[0] + dx).toFixed(5), +(C[1] + dy).toFixed(5)]; }
  function ring(cx, cy, rx, ry, n, jit) { var r = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, k = 1 + (rnd() - .5) * (jit || 0);
    r.push(P(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k)); } r.push(r[0]); return [r]; }
  function rect(x0, y0, x1, y1) { return [[P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)]]; }
  function F(geom, props) { return { type: 'Feature', geometry: geom, properties: props || {} }; }
  function FC(a) { return { type: 'FeatureCollection', features: a }; }
  function poly(c, p) { return F({ type: 'Polygon', coordinates: c }, p); }
  function ln(pts, p) { return F({ type: 'LineString', coordinates: pts.map(function (q) { return P(q[0], q[1]); }) }, p); }
  function wave(x0, y0, x1, y1, amp, n) { var a = []; for (var i = 0; i <= n; i++) { var t = i / n; a.push([x0 + (x1 - x0) * t + Math.sin(t * 9) * amp, y0 + (y1 - y0) * t + Math.cos(t * 7) * amp]); } return a; }

  var areas = {
    'pg-governorate': FC([poly(ring(0, 0, .095, .075, 18, .18), { 'الاسم': 'محافظة تجريبية', 'المساحة كم²': 412 })]),
    'pg-city': FC([poly(ring(0, 0, .022, .018, 14, .25), { 'الاسم': 'المدينة المركزية', 'السكان': 38500 })]),
    'pg-village': FC([
      poly(ring(-.055, .03, .011, .009, 10, .3), { 'الاسم': 'قرية الشمال' }),
      poly(ring(.05, .035, .012, .01, 10, .3), { 'الاسم': 'قرية التلّة' }),
      poly(ring(-.045, -.04, .013, .009, 10, .3), { 'الاسم': 'قرية الوادي' }),
      poly(ring(.055, -.03, .01, .009, 10, .3), { 'الاسم': 'قرية الشرق' })]),
    'pg-water': FC([poly(ring(.03, -.052, .009, .005, 16, .15), { 'الاسم': 'بركة تجميع', 'النوع': 'مسطّح مائي' })]),
    'pg-basin': FC([]), 'pg-parcel': FC([])
  };
  var bx = -.07, by = -.012, bw = .018, bh = .014, n = 1;
  for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
    var x0 = bx + i * bw, y0 = by + j * bh;
    areas['pg-basin'].features.push(poly(rect(x0, y0, x0 + bw, y0 + bh), { 'رقم الحوض': 10 + n, 'الاسم': 'حوض ' + (10 + n) }));
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) {
      var px = x0 + a * bw / 3, py = y0 + b * bh / 3;
      areas['pg-parcel'].features.push(poly(rect(px, py, px + bw / 3, py + bh / 3), { 'رقم الحوض': 10 + n, 'رقم القطعة': a * 3 + b + 1, 'المساحة م²': Math.round(9000 + rnd() * 9000) }));
    }
    n++;
  }
  var lines = {
    'ln-motorway': FC([ln(wave(-.09, -.02, .09, .028, .004, 24), { 'الاسم': 'الطريق السريع ٦٠', 'المسارب': 4 })]),
    'ln-main': FC([ln([[-.03, .05], [-.01, .02], [0, 0], [.012, -.03], [.02, -.065]], { 'الاسم': 'الشارع الرئيسي' }),
                   ln([[-.06, 0], [-.025, .003], [0, 0], [.03, -.005], [.065, -.01]], { 'الاسم': 'شارع القدس' })]),
    'ln-regional': FC([ln([[0, 0], [.025, .02], [.05, .035]], { 'الاسم': 'طريق التلّة' }), ln([[0, 0], [-.025, -.02], [-.045, -.04]], { 'الاسم': 'طريق الوادي' }),
                       ln([[0, 0], [-.03, .02], [-.055, .03]], { 'الاسم': 'طريق الشمال' }), ln([[.03, -.005], [.055, -.03]], { 'الاسم': 'طريق الشرق' })]),
    'ln-local': FC([]),
    'ln-railway': FC([ln([[-.09, .055], [-.03, .045], [.03, .05], [.09, .06]], { 'الاسم': 'خط سكة تجريبي' })]),
    'ln-wall': FC([ln(wave(.07, .07, .075, -.07, .006, 20), { 'الاسم': 'جدار الفصل العنصري', 'الحالة': 'قائم' })]),
    'ln-power': FC([ln([[-.08, -.065], [-.04, -.03], [-.01, -.008], [.01, .012], [.04, .06]], { 'الاسم': 'خط ضغط عالٍ', 'الجهد': '33 ك.ف' })]),
    'ln-water': FC([ln([[.03, -.052], [.018, -.03], [.008, -.012], [-.004, .004], [-.02, .015]], { 'الاسم': 'خط ناقل', 'القطر مم': 300 })]),
    'ln-river': FC([ln(wave(-.095, -.06, .02, -.055, .006, 30), { 'الاسم': 'وادٍ موسمي' })]),
    'ln-trail': FC([ln(wave(.035, .02, .06, .06, .004, 14), { 'الاسم': 'مسار التلّة', 'الطول كم': 4.2 })])
  };
  for (var k = -2; k <= 2; k++) {
    lines['ln-local'].features.push(ln([[-.018, k * .006], [.018, k * .006 + .001]], { 'الاسم': 'شارع ' + (k + 3) }));
    lines['ln-local'].features.push(ln([[k * .007, -.015], [k * .007 + .001, .015]], { 'الاسم': 'زقاق ' + (k + 3) }));
  }
  var counts = { 'pn-mosque': 4, 'pn-church': 2, 'pn-supermarket': 4, 'pn-mall': 2, 'pn-hospital': 2, 'pn-park': 3, 'pn-tower': 3, 'pn-police': 2,
    'pn-checkpoint': 3, 'pn-school': 4, 'pn-university': 1, 'pn-bank': 3, 'pn-restaurant': 4, 'pn-hookah': 3, 'pn-bakery': 3, 'pn-butcher': 3,
    'pn-traffic-light': 4, 'pn-camera': 4 };
  var hoods = ['البلدة القديمة', 'حيّ الإرسال', 'حيّ الماصيون', 'الحيّ الشرقي', 'حيّ الجامعة'];
  var points = [];
  Object.keys(counts).forEach(function (id) {
    for (var q = 0; q < counts[id]; q++) {
      var far = id === 'pn-checkpoint' || id === 'pn-tower', r = far ? .03 + rnd() * .03 : rnd() * .02, ang = rnd() * Math.PI * 2;
      points.push(F({ type: 'Point', coordinates: P(Math.cos(ang) * r * 1.2, Math.sin(ang) * r) },
        { _symbol: id, 'الاسم': (w.PN && PN.points[id] ? PN.points[id].ar : id) + ' ' + (q + 1), 'الحيّ': hoods[Math.floor(rnd() * hoods.length)],
          'الحالة': rnd() > .15 ? 'فعّال' : 'قيد المراجعة', 'آخر تحديث': '2026-1' + Math.floor(rnd() * 2) + '-0' + (1 + Math.floor(rnd() * 9)) }));
    }
  });
  var sectors = [], names = ['قطاع أ', 'قطاع ب', 'قطاع ج', 'قطاع د', 'قطاع هـ', 'قطاع و', 'قطاع ز'], hx = .03, hy = .026;
  [[0, 0], [1, 0], [-1, 0], [.5, 1], [-.5, 1], [.5, -1], [-.5, -1]].forEach(function (o, i) {
    var cx = o[0] * hx * 1.75, cy = o[1] * hy * 1.5, r = [];
    for (var s = 0; s < 6; s++) { var an = Math.PI / 6 + s * Math.PI / 3; r.push(P(cx + Math.cos(an) * hx, cy + Math.sin(an) * hy)); }
    r.push(r[0]);
    sectors.push(poly([r], { name: names[i], 'السكان': Math.round(8000 + rnd() * 42000), 'المرافق': Math.round(6 + rnd() * 40) }));
  });
  w.PN_DEMO = { center: [C[1], C[0]], points: FC(points), lines: lines, areas: areas, sectors: FC(sectors) };
})(window);
