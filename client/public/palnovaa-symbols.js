/*!
 * PalNovaa Engine — Symbol Library v1.0
 * Cartographic symbols for interactive maps: point icons, line styles,
 * fill patterns, basemap themes and colour ramps.
 *
 * Every entry is defined once and can be emitted as:
 *   - SVG              PNSymbols.toSVG(id)
 *   - MapLibre GL      PNSymbols.toMapLibre(id, { source, sourceLayer })
 *   - Live on a map    await PNSymbols.addToMap(map, id, { source, sourceLayer })
 *   - Plain JSON       PNSymbols.get(id)  /  PNSymbols.exportAll()
 *
 * Works as a classic <script> (window.PNSymbols) and in Node (require).
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.PNSymbols = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ------------------------------------------------------------------ */
  /*  Glyphs — 24×24 stroke icons, drawn for this library               */
  /* ------------------------------------------------------------------ */
  var G = {
    plus: { d: 'M12 6v12M6 12h12', w: 3 },
    pharmacy: { d: 'M8.6 15.4l6.8-6.8a2.6 2.6 0 0 0-3.7-3.7l-6.8 6.8a2.6 2.6 0 0 0 3.7 3.7zM8.3 8.3l3.7 3.7M14 16h6M17 13v6' },
    school: { d: 'M3 9.5l9-4.5 9 4.5-9 4.5zM7 11.5v4c3 2 7 2 10 0v-4M21 9.5v5' },
    university: { d: 'M4 9h16M5 9l7-4.5L19 9M6.5 9v8M10 9v8M14 9v8M17.5 9v8M4 19.5h16' },
    mosque: { d: 'M6 19.5v-6a6 6 0 0 1 12 0v6zM12 7.5V4M10.5 5h3M4 19.5h16' },
    church: { d: 'M12 3v5M9.5 5h5M6.5 20.5v-8l5.5-4 5.5 4v8zM10.5 20.5v-4h3v4' },
    police: { d: 'M12 3l7 3v5c0 5-3 8.2-7 10-4-1.8-7-5-7-10V6zM9.5 12l2 2 3.5-4' },
    fire: { d: 'M12 3c.8 3.6 5 5.2 5 10.2a5 5 0 0 1-10 0c0-2.8 1.8-4 2-6 1 1.2 1.8 2 3 2.2C12 6.8 11.2 5 12 3z' },
    fuel: { d: 'M5 20.5V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15.5M4 20.5h11M5 10h9M14 8l3 2v7a1.5 1.5 0 0 0 3 0V9.5l-3-3' },
    parking: { d: 'M8 20V4h5.2a4.2 4.2 0 0 1 0 8.4H8', w: 2.6 },
    bus: { d: 'M6 4h12a1 1 0 0 1 1 1v11H5V5a1 1 0 0 1 1-1zM5 11h14M7.5 16v3M16.5 16v3M8 13.6h.01M16 13.6h.01' },
    train: { d: 'M7.5 3h9a2.5 2.5 0 0 1 2.5 2.5V14a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5.5A2.5 2.5 0 0 1 7.5 3zM5 10h14M8 21l2-4M16 21l-2-4M8.5 13.6h.01M15.5 13.6h.01' },
    plane: { d: 'M12 2.5c1 0 1.6 1 1.6 2.2v4.2l6.4 3.7v2.1l-6.4-1.9v4.4l2.1 1.6v1.7L12 19.4l-3.7 1.1v-1.7l2.1-1.6v-4.4L4 14.7v-2.1l6.4-3.7V4.7c0-1.2.6-2.2 1.6-2.2z', fill: true },
    well: { d: 'M4.5 9.5h15M7 9.5v10.5h10V9.5M6 9.5l6-5.5 6 5.5M12 13v3.5' },
    tank: { d: 'M6 7.5a6 2.2 0 0 0 12 0a6 2.2 0 0 0-12 0M6 7.5v8.5a6 2.2 0 0 0 12 0V7.5M6 12a6 2.2 0 0 0 12 0' },
    valve: { d: 'M3.5 8v8l8.5-4zM20.5 8v8L12 12zM12 12V5.5M9 5.5h6' },
    hydrant: { d: 'M7.5 20.5h9M9 20.5V10h6v10.5M8 10h8M10 10V7.5a2 2 0 0 1 4 0V10M6 13.5h3M15 13.5h3' },
    manhole: { d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM6.5 9.5h11M6 12h12M6.5 14.5h11' },
    bolt: { d: 'M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z', fill: true },
    tower: { d: 'M12 11v10M8 21l4-10 4 10M9.3 17.5h5.4M8.8 7.2a4.5 4.5 0 0 1 6.4 0M6.3 4.7a8 8 0 0 1 11.4 0M12 9.5h.01' },
    triangle: { d: 'M12 5l7.5 13.5h-15zM12 13.2h.01', w: 2.4 },
    benchmark: { d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 2v5M12 17v5M2 12h5M17 12h5' },
    tree: { d: 'M12 3l6 8.5h-3l4 5.5H5l4-5.5H6zM12 17v4' },
    heritage: { d: 'M4.5 20h15M6.5 20v-9h3v9M14.5 20v-6h3v6M5.5 11l5-4 2 2M14 14l2.5-2.5 2 1.5' },
    food: { d: 'M7 3v7.5a2 2 0 0 0 2 2V21M9 3v6M11 3v7.5a2 2 0 0 1-2 2M17 21V3c-2 1.2-3 4-3 8.5h3' },
    shop: { d: 'M5.5 8h13l-1.2 12.5H6.7zM9 8V6.5a3 3 0 0 1 6 0V8' },
    hotel: { d: 'M3 18.5V6.5M3 14h18v4.5M21 14v-1.5A3.5 3.5 0 0 0 17.5 9H11v5M7 9.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z' },
    gov: { d: 'M4 20h16M6 20v-8.5h12V20M5 11.5l7-5.5 7 5.5M10 20v-4.5h4V20M12 3.5v2.5' },
    factory: { d: 'M3 20.5V10l5 3v-3l5 3v-3l5 3V4.5h3v16zM7 17h2M12 17h2' },
    waste: { d: 'M5 7h14M9.5 7V4.5h5V7M7 7l1 13.5h8L17 7M10.5 10.5v6.5M13.5 10.5v6.5' },
    view: { d: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z' },
    hazard: { d: 'M12 8v5M12 16.4h.01', w: 2.6 },
    info: { d: 'M12 11v6M12 7.6h.01', w: 2.6 },
    pin: { d: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', fill: true },
    camera: { d: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
    wifi: { d: 'M4.5 9.5a11 11 0 0 1 15 0M7.3 12.6a7 7 0 0 1 9.4 0M10 15.6a3 3 0 0 1 4 0M12 18.6h.01' },
    sports: { d: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.8 10c3.4.4 6 3.4 6.2 10.3M20.2 14c-3.4-.4-6-3.4-6.2-10.3' }
  };

  /* ------------------------------------------------------------------ */
  /*  Point symbols                                                     */
  /* ------------------------------------------------------------------ */
  var CAT = {
    health: { ar: 'صحة', color: '#E5484D' },
    education: { ar: 'تعليم', color: '#3E7BD6' },
    worship: { ar: 'دور عبادة', color: '#7C6BD0' },
    safety: { ar: 'أمن وطوارئ', color: '#2F5FB8' },
    transport: { ar: 'نقل', color: '#4B5563' },
    water: { ar: 'مياه', color: '#0E8FCC' },
    energy: { ar: 'طاقة واتصالات', color: '#D99A1E' },
    survey: { ar: 'مساحة', color: '#E7E9EC' },
    nature: { ar: 'طبيعة', color: '#2E9A66' },
    heritage: { ar: 'تراث', color: '#A9733F' },
    commerce: { ar: 'تجارة وخدمات', color: '#E07B39' },
    civic: { ar: 'حكومي وصناعي', color: '#5E6672' }
  };

  var POINTS = [
    ['hospital', 'مستشفى', 'Hospital', 'health', 'square', 'plus'],
    ['pharmacy', 'صيدلية', 'Pharmacy', 'health', 'circle', 'pharmacy'],
    ['school', 'مدرسة', 'School', 'education', 'circle', 'school'],
    ['university', 'جامعة', 'University', 'education', 'square', 'university'],
    ['mosque', 'مسجد', 'Mosque', 'worship', 'circle', 'mosque'],
    ['church', 'كنيسة', 'Church', 'worship', 'circle', 'church'],
    ['police', 'شرطة', 'Police', 'safety', 'circle', 'police'],
    ['fire-station', 'دفاع مدني', 'Fire station', 'safety', 'square', 'fire', '#D94A2B'],
    ['bus-stop', 'موقف حافلات', 'Bus stop', 'transport', 'square', 'bus'],
    ['train-station', 'محطة قطار', 'Train station', 'transport', 'square', 'train'],
    ['airport', 'مطار', 'Airport', 'transport', 'circle', 'plane'],
    ['parking', 'موقف سيارات', 'Parking', 'transport', 'square', 'parking', '#3E7BD6'],
    ['fuel', 'محطة وقود', 'Fuel station', 'transport', 'circle', 'fuel'],
    ['well', 'بئر مياه', 'Water well', 'water', 'circle', 'well'],
    ['reservoir', 'خزان مياه', 'Reservoir', 'water', 'square', 'tank'],
    ['valve', 'محبس', 'Valve', 'water', 'diamond', 'valve'],
    ['hydrant', 'حنفية حريق', 'Fire hydrant', 'water', 'circle', 'hydrant', '#D94A2B'],
    ['manhole', 'منهل صرف', 'Manhole', 'water', 'circle', 'manhole', '#7A5B3A'],
    ['transformer', 'محوّل كهرباء', 'Transformer', 'energy', 'square', 'bolt'],
    ['telecom-tower', 'برج اتصالات', 'Telecom tower', 'energy', 'circle', 'tower', '#7C6BD0'],
    ['control-point', 'نقطة ضبط', 'Survey control point', 'survey', 'triangle', 'triangle'],
    ['benchmark', 'روبير', 'Benchmark', 'survey', 'circle', 'benchmark'],
    ['tree', 'شجرة / حديقة', 'Tree / park', 'nature', 'circle', 'tree'],
    ['viewpoint', 'إطلالة', 'Viewpoint', 'nature', 'circle', 'view'],
    ['heritage', 'موقع أثري', 'Heritage site', 'heritage', 'square', 'heritage'],
    ['restaurant', 'مطعم', 'Restaurant', 'commerce', 'circle', 'food'],
    ['shop', 'متجر', 'Shop', 'commerce', 'circle', 'shop'],
    ['hotel', 'فندق', 'Hotel', 'commerce', 'square', 'hotel'],
    ['sports', 'منشأة رياضية', 'Sports facility', 'nature', 'circle', 'sports', '#2E9A66'],
    ['municipality', 'مبنى حكومي', 'Government', 'civic', 'square', 'gov'],
    ['factory', 'مصنع', 'Factory', 'civic', 'square', 'factory'],
    ['waste', 'نفايات', 'Waste site', 'civic', 'circle', 'waste'],
    ['cctv', 'كاميرا مراقبة', 'CCTV', 'safety', 'circle', 'camera'],
    ['hazard', 'خطر', 'Hazard', 'safety', 'warning', 'hazard', '#E3B341'],
    ['info', 'معلومات', 'Information', 'civic', 'circle', 'info', '#3E7BD6'],
    ['location', 'موقع محدد', 'Location pin', 'commerce', 'pin', 'pin']
  ];

  /* ------------------------------------------------------------------ */
  /*  Marks drawn along lines (direction = +x, centred at 0,0)           */
  /* ------------------------------------------------------------------ */
  var MARKS = {
    tie:     { w: 4, h: 12, svg: function (c) { return '<line x1="2" y1="1" x2="2" y2="11" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/>'; } },
    pylon:   { w: 10, h: 14, svg: function (c) { return '<line x1="5" y1="2" x2="5" y2="12" stroke="' + c + '" stroke-width="1.4" stroke-linecap="round"/><circle cx="5" cy="7" r="2.2" fill="' + c + '"/>'; } },
    arrow:   { w: 10, h: 10, svg: function (c) { return '<path d="M3 2l4 3-4 3" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'; } },
    dot:     { w: 8, h: 8, svg: function (c) { return '<circle cx="4" cy="4" r="2.6" fill="' + c + '" stroke="#0A0B0D" stroke-width="1"/>'; } },
    cross:   { w: 8, h: 8, svg: function (c) { return '<path d="M2 2l4 4M6 2l-4 4" stroke="' + c + '" stroke-width="1.3" stroke-linecap="round"/>'; } },
    tooth:   { w: 8, h: 14, svg: function (c) { return '<path d="M1 7h6L4 13z" fill="' + c + '"/>'; } },
    letterW: { w: 12, h: 12, svg: function (c) { return '<rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="#0A0B0D" stroke="' + c + '"/><path d="M3 4l1.4 4.5L6 5l1.6 3.5L9 4" fill="none" stroke="' + c + '" stroke-width="1.1" stroke-linejoin="round"/>'; } },
    letterG: { w: 12, h: 12, svg: function (c) { return '<rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="#0A0B0D" stroke="' + c + '"/><path d="M8.3 4.6A2.6 2.6 0 1 0 8.6 7.6H6.4" fill="none" stroke="' + c + '" stroke-width="1.1" stroke-linecap="round"/>'; } }
  };

  /* ------------------------------------------------------------------ */
  /*  Line symbols — strokes stacked bottom→top, dashes in px            */
  /* ------------------------------------------------------------------ */
  var LCAT = {
    utility: 'شبكات البنية التحتية',
    transport: 'طرق ونقل',
    hydro: 'مياه سطحية',
    boundary: 'حدود',
    terrain: 'تضاريس ومعالم'
  };
  var LINES = [
    { id: 'water-main', ar: 'خط مياه رئيسي', en: 'Water main', cat: 'utility', strokes: [{ c: '#0E8FCC', w: 3.5 }], marks: [{ m: 'letterW', c: '#38B6F0', spacing: 90 }] },
    { id: 'water-distribution', ar: 'خط مياه فرعي', en: 'Water distribution', cat: 'utility', strokes: [{ c: '#38B6F0', w: 2, dash: [8, 4] }] },
    { id: 'sewer', ar: 'خط صرف صحي', en: 'Sanitary sewer', cat: 'utility', strokes: [{ c: '#9C7550', w: 2.5, dash: [10, 4] }], marks: [{ m: 'arrow', c: '#C9A27A', spacing: 34 }] },
    { id: 'storm-drain', ar: 'تصريف أمطار', en: 'Storm drain', cat: 'utility', strokes: [{ c: '#14A89A', w: 2.2, dash: [3, 4] }], marks: [{ m: 'arrow', c: '#14A89A', spacing: 40 }] },
    { id: 'gas', ar: 'خط غاز', en: 'Gas pipeline', cat: 'utility', strokes: [{ c: '#E3B341', w: 2.5, dash: [12, 4, 2, 4] }], marks: [{ m: 'letterG', c: '#E3B341', spacing: 100 }] },
    { id: 'power-hv', ar: 'ضغط عالٍ (كهرباء)', en: 'High-voltage line', cat: 'utility', strokes: [{ c: '#C9CED6', w: 1.4 }], marks: [{ m: 'pylon', c: '#E3B341', spacing: 36 }] },
    { id: 'power-lv', ar: 'ضغط منخفض (كهرباء)', en: 'Low-voltage line', cat: 'utility', strokes: [{ c: '#D99A1E', w: 1.3, dash: [5, 3] }] },
    { id: 'telecom', ar: 'كابل اتصالات / ألياف', en: 'Telecom / fiber', cat: 'utility', strokes: [{ c: '#A78BFA', w: 2, dash: [0.1, 5], cap: 'round' }] },
    { id: 'railway', ar: 'سكة حديد', en: 'Railway', cat: 'transport', strokes: [{ c: '#E7E9EC', w: 5 }, { c: '#15181D', w: 3, dash: [12, 12] }] },
    { id: 'railway-ties', ar: 'سكة حديد (عوارض)', en: 'Railway (ties)', cat: 'transport', strokes: [{ c: '#C9CED6', w: 1.6 }], marks: [{ m: 'tie', c: '#C9CED6', spacing: 9 }] },
    { id: 'tram', ar: 'ترام / مترو', en: 'Tram / light rail', cat: 'transport', strokes: [{ c: '#D6409F', w: 3 }], marks: [{ m: 'tie', c: '#D6409F', spacing: 16 }] },
    { id: 'motorway', ar: 'طريق سريع', en: 'Motorway', cat: 'transport', strokes: [{ c: '#9A5A2F', w: 10, cap: 'round' }, { c: '#E07B39', w: 7, cap: 'round' }, { c: '#F6C79F', w: 0.8, dash: [8, 8] }] },
    { id: 'primary-road', ar: 'طريق رئيسي', en: 'Primary road', cat: 'transport', strokes: [{ c: '#6A717C', w: 8, cap: 'round' }, { c: '#2E343C', w: 6, cap: 'round' }] },
    { id: 'local-road', ar: 'شارع محلي', en: 'Local street', cat: 'transport', strokes: [{ c: '#4A515B', w: 4, cap: 'round' }] },
    { id: 'track', ar: 'طريق ترابي', en: 'Unpaved track', cat: 'transport', strokes: [{ c: '#A68A64', w: 2, dash: [7, 4] }] },
    { id: 'footpath', ar: 'ممر مشاة', en: 'Footpath', cat: 'transport', strokes: [{ c: '#B9BEC6', w: 1.8, dash: [0.1, 4], cap: 'round' }] },
    { id: 'cycleway', ar: 'مسار دراجات', en: 'Cycle lane', cat: 'transport', strokes: [{ c: '#3DB37E', w: 2.2, dash: [6, 3] }] },
    { id: 'route', ar: 'مسار مقترح', en: 'Proposed route', cat: 'transport', strokes: [{ c: '#E07B39', w: 3, cap: 'round' }], marks: [{ m: 'arrow', c: '#170C04', spacing: 30 }] },
    { id: 'river', ar: 'نهر', en: 'River', cat: 'hydro', strokes: [{ c: '#1F3D5E', w: 8, cap: 'round' }, { c: '#3B82C4', w: 5, cap: 'round' }] },
    { id: 'stream', ar: 'وادٍ موسمي', en: 'Seasonal stream (wadi)', cat: 'hydro', strokes: [{ c: '#4A86CF', w: 1.6, dash: [10, 3, 2, 3] }] },
    { id: 'canal', ar: 'قناة', en: 'Canal', cat: 'hydro', strokes: [{ c: '#4A86CF', w: 5 }, { c: '#10263B', w: 2.5 }] },
    { id: 'shoreline', ar: 'خط الساحل', en: 'Shoreline', cat: 'hydro', strokes: [{ c: '#4A86CF', w: 6, opacity: 0.25 }, { c: '#7FB3E8', w: 1.4 }] },
    { id: 'border-intl', ar: 'حدود دولية', en: 'International border', cat: 'boundary', strokes: [{ c: '#E7E9EC', w: 7, opacity: 0.14 }, { c: '#E7E9EC', w: 2, dash: [10, 4, 2, 4, 2, 4] }] },
    { id: 'border-admin', ar: 'حدود إدارية', en: 'Admin boundary', cat: 'boundary', strokes: [{ c: '#8B929C', w: 1.6, dash: [8, 4, 2, 4] }] },
    { id: 'border-municipal', ar: 'حدود بلدية', en: 'Municipal boundary', cat: 'boundary', strokes: [{ c: '#E07B39', w: 5, opacity: 0.18 }, { c: '#E07B39', w: 1.5, dash: [6, 4] }] },
    { id: 'parcel', ar: 'حد قطعة أرض', en: 'Parcel line', cat: 'boundary', strokes: [{ c: '#8B929C', w: 1 }] },
    { id: 'contour-index', ar: 'خط كنتور رئيسي', en: 'Index contour', cat: 'terrain', strokes: [{ c: '#B07D48', w: 1.5 }] },
    { id: 'contour', ar: 'خط كنتور ثانوي', en: 'Intermediate contour', cat: 'terrain', strokes: [{ c: '#6E5238', w: 0.8 }] },
    { id: 'fence', ar: 'سياج', en: 'Fence', cat: 'terrain', strokes: [{ c: '#8B929C', w: 1 }], marks: [{ m: 'cross', c: '#B9BEC6', spacing: 14 }] },
    { id: 'wall', ar: 'جدار / سور', en: 'Wall', cat: 'terrain', strokes: [{ c: '#B9BEC6', w: 3.2, cap: 'butt' }] },
    { id: 'cliff', ar: 'جرف / منحدر', en: 'Cliff / escarpment', cat: 'terrain', strokes: [{ c: '#B9BEC6', w: 1.5 }], marks: [{ m: 'tooth', c: '#B9BEC6', spacing: 8 }] }
  ];

  /* ------------------------------------------------------------------ */
  /*  Fill symbols — solid + tiled pattern + outline                     */
  /* ------------------------------------------------------------------ */
  var FCAT = { landuse: 'استعمالات الأراضي', landcover: 'غطاء أرضي', analysis: 'تحليل وتخطيط' };
  function hatch(c, sw, step, angle) {
    // diagonal lines across a square tile of size `step`
    if (angle === 45) return '<path d="M0 ' + step + 'L' + step + ' 0M-2 2L2 -2M' + (step - 2) + ' ' + (step + 2) + 'L' + (step + 2) + ' ' + (step - 2) + '" stroke="' + c + '" stroke-width="' + sw + '"/>';
    if (angle === 135) return '<path d="M0 0L' + step + ' ' + step + 'M-2 ' + (step - 2) + 'L2 ' + (step + 2) + 'M' + (step - 2) + ' -2L' + (step + 2) + ' 2" stroke="' + c + '" stroke-width="' + sw + '"/>';
    if (angle === 0) return '<path d="M0 ' + (step / 2) + 'H' + step + '" stroke="' + c + '" stroke-width="' + sw + '"/>';
    return '<path d="M' + (step / 2) + ' 0V' + step + '" stroke="' + c + '" stroke-width="' + sw + '"/>';
  }
  var FILLS = [
    { id: 'residential', ar: 'سكني', en: 'Residential', cat: 'landuse', bg: '#262B33', outline: { c: '#3F4650', w: 1 } },
    { id: 'commercial', ar: 'تجاري', en: 'Commercial', cat: 'landuse', bg: '#352619', outline: { c: '#9A5A2F', w: 1 } },
    { id: 'industrial', ar: 'صناعي', en: 'Industrial', cat: 'landuse', bg: '#24222F', tile: 10, pattern: hatch('#45405C', 1.2, 10, 45), outline: { c: '#5C5577', w: 1 } },
    { id: 'civic', ar: 'خدمات عامة', en: 'Civic / public', cat: 'landuse', bg: '#18222F', outline: { c: '#5B9BF0', w: 1.2, dash: [4, 3] } },
    { id: 'mixed-use', ar: 'استعمال مختلط', en: 'Mixed use', cat: 'landuse', bg: '#2B2420', tile: 12, pattern: hatch('#4A3A2E', 1, 12, 45) + hatch('#3A414B', 1, 12, 135), outline: { c: '#6A5A4A', w: 1 } },
    { id: 'cemetery', ar: 'مقبرة', en: 'Cemetery', cat: 'landuse', bg: '#1A2320', tile: 14, pattern: '<rect x="3" y="3" width="3" height="5" rx="1" fill="#3F5A4C"/><rect x="10" y="9" width="3" height="5" rx="1" fill="#3F5A4C"/>', outline: { c: '#3F5A4C', w: 1 } },
    { id: 'park', ar: 'حديقة عامة', en: 'Park', cat: 'landcover', bg: '#15301F', outline: { c: '#3DB37E', w: 1 } },
    { id: 'forest', ar: 'غابة', en: 'Forest', cat: 'landcover', bg: '#112417', tile: 18, pattern: '<path d="M5 3l3 5H2zM14 11l3 5h-6z" fill="#2E6B44"/>', outline: { c: '#2E6B44', w: 1 } },
    { id: 'olive-grove', ar: 'زيتون / بساتين', en: 'Olive grove / orchard', cat: 'landcover', bg: '#1A2314', tile: 14, pattern: '<circle cx="3.5" cy="3.5" r="2" fill="#5A7A28"/><circle cx="10.5" cy="10.5" r="2" fill="#5A7A28"/>', outline: { c: '#4E6B1E', w: 1 } },
    { id: 'farmland', ar: 'أراضٍ زراعية', en: 'Farmland', cat: 'landcover', bg: '#28261A', tile: 8, pattern: hatch('#4D4728', 1.2, 8, 0), outline: { c: '#5E573A', w: 1 } },
    { id: 'vineyard', ar: 'كروم عنب', en: 'Vineyard', cat: 'landcover', bg: '#24171F', tile: 12, pattern: '<path d="M0 6H12" stroke="#4A2E40" stroke-width="1"/><circle cx="3" cy="6" r="1.6" fill="#8A4A72"/><circle cx="9" cy="6" r="1.6" fill="#8A4A72"/>', outline: { c: '#6B3A5A', w: 1 } },
    { id: 'wetland', ar: 'أراضٍ رطبة', en: 'Wetland / marsh', cat: 'landcover', bg: '#10222A', tile: 20, pattern: '<path d="M3 8h6M6 8V4M4.5 8l-1-3M7.5 8l1-3M12 17h6M15 17v-4M13.5 17l-1-3M16.5 17l1-3" stroke="#2E7A88" stroke-width="1" stroke-linecap="round"/>', outline: { c: '#2E6B78', w: 1 } },
    { id: 'sand', ar: 'رمل / كثبان', en: 'Sand / dunes', cat: 'landcover', bg: '#2D271B', tile: 12, pattern: '<circle cx="2" cy="3" r=".9" fill="#7A6644"/><circle cx="8" cy="2" r=".7" fill="#7A6644"/><circle cx="5" cy="8" r=".9" fill="#7A6644"/><circle cx="10.5" cy="9.5" r=".7" fill="#7A6644"/><circle cx="1" cy="10.5" r=".6" fill="#7A6644"/>', outline: { c: '#6B5A3A', w: 1 } },
    { id: 'rock', ar: 'صخري / أرض جرداء', en: 'Rock / bare ground', cat: 'landcover', bg: '#222429', tile: 16, pattern: '<path d="M2 6l3-3 2 3zM10 13l2.5-3 2 3z" fill="none" stroke="#535963" stroke-width="1" stroke-linejoin="round"/>', outline: { c: '#4A4F57', w: 1 } },
    { id: 'water', ar: 'مسطح مائي', en: 'Water body', cat: 'landcover', bg: '#10283F', tile: 24, pattern: '<path d="M2 8q3-2.5 6 0t6 0M12 18q3-2.5 6 0t6 0" fill="none" stroke="#24578A" stroke-width="1" stroke-linecap="round"/>', outline: { c: '#3B82C4', w: 1.2 } },
    { id: 'flood-zone', ar: 'منطقة فيضان', en: 'Flood zone', cat: 'analysis', bg: 'rgba(91,155,240,0.10)', tile: 10, pattern: hatch('rgba(91,155,240,0.75)', 1.2, 10, 135), outline: { c: '#5B9BF0', w: 1.5 } },
    { id: 'restricted', ar: 'منطقة محظورة', en: 'Restricted area', cat: 'analysis', bg: 'rgba(229,72,77,0.08)', tile: 10, pattern: hatch('rgba(229,72,77,0.8)', 1.4, 10, 45), outline: { c: '#E5484D', w: 1.8 } },
    { id: 'construction', ar: 'منطقة إنشاءات', en: 'Construction zone', cat: 'analysis', bg: '#2A2410', tile: 16, pattern: hatch('#E3B341', 4, 16, 45), outline: { c: '#E3B341', w: 1.5 } },
    { id: 'buffer', ar: 'نطاق تأثير (Buffer)', en: 'Buffer zone', cat: 'analysis', bg: 'rgba(224,123,57,0.10)', outline: { c: '#E07B39', w: 1.5, dash: [6, 4] } },
    { id: 'study-area', ar: 'منطقة الدراسة', en: 'Study area', cat: 'analysis', bg: 'rgba(231,233,236,0.03)', outline: { c: '#E7E9EC', w: 2, dash: [12, 4, 2, 4] } },
    { id: 'cross-hatch', ar: 'تظليل متقاطع', en: 'Cross hatch', cat: 'analysis', bg: '#1A1D22', tile: 10, pattern: hatch('#3F4650', 1, 10, 45) + hatch('#3F4650', 1, 10, 135), outline: { c: '#59606B', w: 1 } },
    { id: 'parcel-fill', ar: 'قطعة أرض (حدود فقط)', en: 'Parcel (outline only)', cat: 'analysis', bg: 'rgba(0,0,0,0)', outline: { c: '#B9BEC6', w: 1 } }
  ];

  /* ------------------------------------------------------------------ */
  /*  Basemap themes                                                    */
  /* ------------------------------------------------------------------ */
  var THEMES = [
    { id: 'night', ar: 'ليلي', en: 'Night', note: 'هوية PalNovaa الأساسية: أرضية داكنة وطرق هادئة.', t: { background: '#0A0B0D', land: '#111317', water: '#10263B', waterLine: '#1F4F7A', park: '#12241A', building: '#1A1E24', buildingLine: '#262B33', road: '#2A3039', roadCasing: '#1A1E24', roadMajor: '#3A414B', boundary: '#5C626B', label: '#B9BEC6', labelHalo: '#0A0B0D', accent: '#E07B39' } },
    { id: 'daylight', ar: 'نهاري', en: 'Daylight', note: 'رمادي فاتح محايد للعروض والتقارير.', t: { background: '#F4F5F6', land: '#ECEEF0', water: '#BFD9F0', waterLine: '#8DB8DE', park: '#D4EAD6', building: '#DADDE2', buildingLine: '#C7CBD1', road: '#FFFFFF', roadCasing: '#D3D7DC', roadMajor: '#F6DDC2', boundary: '#9AA0A8', label: '#3B4048', labelHalo: '#FFFFFF', accent: '#AE4E14' } },
    { id: 'topographic', ar: 'طبوغرافي', en: 'Topographic', note: 'ألوان دافئة للتضاريس والأعمال الميدانية.', t: { background: '#F3EEE4', land: '#EEE6D6', water: '#A9CBE0', waterLine: '#6E9FC4', park: '#CFE0B5', building: '#D9CDB8', buildingLine: '#BFAF95', road: '#FFFFFF', roadCasing: '#CBBBA0', roadMajor: '#F2C38B', boundary: '#8C7E68', label: '#4A3F2E', labelHalo: '#F3EEE4', accent: '#B4561B' } },
    { id: 'blueprint', ar: 'مخطط هندسي', en: 'Blueprint', note: 'أزرق هندسي لشبكات البنية التحتية.', t: { background: '#0B2545', land: '#0E2E55', water: '#081D38', waterLine: '#2D6CB0', park: '#12395F', building: '#154273', buildingLine: '#2D6CB0', road: '#2D5F96', roadCasing: '#0B2545', roadMajor: '#8EC5FF', boundary: '#8EC5FF', label: '#DCEBFF', labelHalo: '#0B2545', accent: '#FFB86B' } },
    { id: 'mono', ar: 'أحادي للطباعة', en: 'Monochrome print', note: 'تدرّج رمادي واضح بالطباعة بالأبيض والأسود.', t: { background: '#FFFFFF', land: '#F7F7F7', water: '#E2E2E2', waterLine: '#B5B5B5', park: '#EDEDED', building: '#E0E0E0', buildingLine: '#C2C2C2', road: '#FFFFFF', roadCasing: '#BDBDBD', roadMajor: '#9E9E9E', boundary: '#6F6F6F', label: '#222222', labelHalo: '#FFFFFF', accent: '#222222' } },
    { id: 'olive', ar: 'زيتوني', en: 'Olive', note: 'أخضر مطفي للتخطيط البيئي والزراعي.', t: { background: '#121611', land: '#171C15', water: '#132A33', waterLine: '#2E5A66', park: '#1F2E19', building: '#22281F', buildingLine: '#30382B', road: '#2C3328', roadCasing: '#171C15', roadMajor: '#4E5B3F', boundary: '#6B7A5A', label: '#C5CEB8', labelHalo: '#121611', accent: '#9CC25B' } }
  ];

  /* ------------------------------------------------------------------ */
  /*  Colour ramps                                                      */
  /* ------------------------------------------------------------------ */
  var RAMPS = [
    { id: 'copper', ar: 'نحاسي متسلسل', en: 'Copper (sequential)', type: 'sequential', colors: ['#2A2F37', '#5C4535', '#9A5A2F', '#D0702F', '#F0954F'] },
    { id: 'blues', ar: 'أزرق متسلسل', en: 'Blues (sequential)', type: 'sequential', colors: ['#0F1E2E', '#1F3D5E', '#2E64A0', '#4A8FDB', '#9CC8F5'] },
    { id: 'greens', ar: 'أخضر متسلسل', en: 'Greens (sequential)', type: 'sequential', colors: ['#122016', '#1E4A2B', '#2E7A45', '#4FB06A', '#A6DDB0'] },
    { id: 'elevation', ar: 'ارتفاعات', en: 'Hypsometric', type: 'sequential', colors: ['#2E6B44', '#7FA35A', '#D8C786', '#B9875A', '#8A5A44', '#E7E1DA'] },
    { id: 'blue-copper', ar: 'متباعد أزرق ← نحاسي', en: 'Blue–Copper (diverging)', type: 'diverging', colors: ['#2E64A0', '#7FA9D6', '#3A3F48', '#D9A27A', '#C2581A'] },
    { id: 'risk', ar: 'مستوى الخطورة', en: 'Risk levels', type: 'qualitative-ordered', colors: ['#3DB37E', '#A8C64A', '#E3B341', '#E07B39', '#E5484D'] },
    { id: 'categorical', ar: 'فئات (8)', en: 'Categorical 8', type: 'qualitative', colors: ['#E07B39', '#3E7BD6', '#2E9A66', '#D6409F', '#E3B341', '#7C6BD0', '#14A89A', '#9C7550'] }
  ];

  /* ================================================================== */
  /*  Builders                                                          */
  /* ================================================================== */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function round(n) { return Math.round(n * 100) / 100; }

  // ---- point SVG ------------------------------------------------------
  function shapePath(shape, s) {
    var h = s / 2;
    switch (shape) {
      case 'square': return '<rect x="2" y="2" width="' + (s - 4) + '" height="' + (s - 4) + '" rx="' + (s * 0.22) + '"';
      case 'diamond': return '<path d="M' + h + ' 1.5L' + (s - 1.5) + ' ' + h + 'L' + h + ' ' + (s - 1.5) + 'L1.5 ' + h + 'Z" stroke-linejoin="round"';
      case 'triangle': return '<path d="M' + h + ' 2L' + (s - 1.5) + ' ' + (s - 3) + 'H1.5Z" stroke-linejoin="round"';
      case 'warning': return '<path d="M' + h + ' 2.5L' + (s - 1.5) + ' ' + (s - 3) + 'H1.5Z" stroke-linejoin="round"';
      default: return '<circle cx="' + h + '" cy="' + h + '" r="' + (h - 2) + '"';
    }
  }
  function pointSVG(p, opts) {
    opts = opts || {};
    var size = opts.size || 32, color = opts.color || p.color;
    var light = p.cat === 'survey' || p.shape === 'warning';
    var ink = opts.ink || (light ? '#0A0B0D' : '#FFFFFF');
    var g = G[p.glyph], body, H = size;
    if (p.shape === 'pin') {
      H = Math.round(size * 1.3);
      var r = size / 2 - 2;
      body = '<path d="M' + size / 2 + ' ' + (H - 1.5) + 'C' + (size / 2 - 3) + ' ' + (H - 7) + ' 2 ' + (size * 0.72) + ' 2 ' + (size / 2) + 'a' + r + ' ' + r + ' 0 0 1 ' + (2 * r) + ' 0C' + (size - 2) + ' ' + (size * 0.72) + ' ' + (size / 2 + 3) + ' ' + (H - 7) + ' ' + size / 2 + ' ' + (H - 1.5) + 'Z" fill="' + color + '" stroke="#0A0B0D" stroke-width="1.5"/>';
    } else {
      body = shapePath(p.shape, size) + ' fill="' + color + '" stroke="#0A0B0D" stroke-width="1.5"/>';
    }
    var gs = p.shape === 'triangle' || p.shape === 'warning' ? 0.56 : 0.66;
    var gy = p.shape === 'triangle' || p.shape === 'warning' ? size * 0.14 : 0;
    var off = (size - 24 * gs) / 2;
    var gl = g.fill
      ? '<path d="' + g.d + '" fill="' + ink + '"/>'
      : '<path d="' + g.d + '" fill="none" stroke="' + ink + '" stroke-width="' + (g.w || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    if (p.glyph === 'triangle') gl = '<circle cx="12" cy="13" r="2.4" fill="' + ink + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + H + '" viewBox="0 0 ' + size + ' ' + H + '">' + body +
      '<g transform="translate(' + round(off) + ' ' + round(off + gy) + ') scale(' + gs + ')">' + gl + '</g></svg>';
  }

  // ---- line geometry for previews ------------------------------------
  var PREVIEW_PATH = 'M14 64 C 60 64, 70 22, 120 26 S 190 52, 226 24';
  function sampleCubic(p0, p1, p2, p3, n, out) {
    for (var i = 1; i <= n; i++) {
      var t = i / n, mt = 1 - t;
      out.push([mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]]);
    }
  }
  var PREVIEW_PTS = (function () {
    var pts = [[14, 64]];
    sampleCubic([14, 64], [60, 64], [70, 22], [120, 26], 80, pts);
    // smooth continuation: reflected control point (170,30)
    sampleCubic([120, 26], [170, 30], [190, 52], [226, 24], 80, pts);
    return pts;
  })();
  function marksAlong(pts, spacing, offset) {
    var out = [], acc = 0, next = offset;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
      while (acc + L >= next) {
        var t = (next - acc) / L;
        out.push({ x: a[0] + dx * t, y: a[1] + dy * t, a: Math.atan2(dy, dx) * 180 / Math.PI });
        next += spacing;
      }
      acc += L;
    }
    return out;
  }
  function markSVG(m, c) {
    var mk = MARKS[m];
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + mk.w + '" height="' + mk.h + '" viewBox="0 0 ' + mk.w + ' ' + mk.h + '">' + mk.svg(c) + '</svg>';
  }
  function lineSVG(l, opts) {
    opts = opts || {};
    var W = opts.width || 240, H = opts.height || 88, s = '';
    l.strokes.forEach(function (st) {
      s += '<path d="' + PREVIEW_PATH + '" fill="none" stroke="' + st.c + '" stroke-width="' + st.w + '"' +
        (st.dash ? ' stroke-dasharray="' + st.dash.join(' ') + '"' : '') +
        ' stroke-linecap="' + (st.cap || (st.dash ? 'butt' : 'round')) + '" stroke-linejoin="round"' +
        (st.opacity != null ? ' stroke-opacity="' + st.opacity + '"' : '') + '/>';
    });
    (l.marks || []).forEach(function (mk) {
      var M = MARKS[mk.m];
      marksAlong(PREVIEW_PTS, mk.spacing, mk.spacing / 2).forEach(function (p) {
        var rot = mk.m === 'letterW' || mk.m === 'letterG' ? 0 : p.a;
        s += '<g transform="translate(' + round(p.x) + ' ' + round(p.y) + ') rotate(' + round(rot) + ') translate(' + (-M.w / 2) + ' ' + (-M.h / 2) + ')">' + M.svg(mk.c) + '</g>';
      });
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 240 88">' + s + '</svg>';
  }

  // ---- fill SVG -------------------------------------------------------
  function fillTileSVG(f) {
    var t = f.tile || 8;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + t + '" height="' + t + '" viewBox="0 0 ' + t + ' ' + t + '"><rect width="' + t + '" height="' + t + '" fill="' + f.bg + '"/>' + (f.pattern || '') + '</svg>';
  }
  var PREVIEW_POLY = 'M24 18 L150 10 L214 42 L196 78 L90 82 L30 64 Z';
  function fillSVG(f, opts) {
    opts = opts || {};
    var W = opts.width || 240, H = opts.height || 88, pid = 'pn-' + f.id + '-' + Math.random().toString(36).slice(2, 7), defs = '', fill = f.bg;
    if (f.pattern) {
      var t = f.tile || 8;
      defs = '<defs><pattern id="' + pid + '" width="' + t + '" height="' + t + '" patternUnits="userSpaceOnUse"><rect width="' + t + '" height="' + t + '" fill="' + f.bg + '"/>' + f.pattern + '</pattern></defs>';
      fill = 'url(#' + pid + ')';
    }
    var o = f.outline || {};
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 240 88">' + defs +
      '<path d="' + PREVIEW_POLY + '" fill="' + fill + '" stroke="' + (o.c || 'none') + '" stroke-width="' + (o.w || 0) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash.join(' ') + '"' : '') + ' stroke-linejoin="round"/></svg>';
  }

  // ---- theme preview SVG ---------------------------------------------
  function themeSVG(th, opts) {
    opts = opts || {};
    var t = th.t, W = opts.width || 240, H = opts.height || 150;
    var b = [[30, 22, 36, 24], [74, 18, 28, 30], [30, 56, 30, 22], [150, 96, 34, 22], [192, 92, 30, 30], [150, 124, 26, 16], [196, 128, 24, 14], [112, 22, 24, 20]];
    var bs = b.map(function (r) { return '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="1.5" fill="' + t.building + '" stroke="' + t.buildingLine + '" stroke-width=".8"/>'; }).join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 240 150">' +
      '<rect width="240" height="150" fill="' + t.land + '"/>' +
      '<path d="M150 0 C 160 30, 210 40, 240 46 V0 Z" fill="' + t.water + '" stroke="' + t.waterLine + '" stroke-width="1"/>' +
      '<path d="M8 96 L64 88 L92 120 L70 146 L14 140 Z" fill="' + t.park + '"/>' + bs +
      '<path d="M0 84 C 60 80, 120 90, 240 72" fill="none" stroke="' + t.roadCasing + '" stroke-width="9"/>' +
      '<path d="M0 84 C 60 80, 120 90, 240 72" fill="none" stroke="' + t.roadMajor + '" stroke-width="6"/>' +
      '<path d="M128 0 C 126 50, 132 100, 124 150" fill="none" stroke="' + t.roadCasing + '" stroke-width="6"/>' +
      '<path d="M128 0 C 126 50, 132 100, 124 150" fill="none" stroke="' + t.road + '" stroke-width="3.5"/>' +
      '<path d="M0 30 H 120" fill="none" stroke="' + t.road + '" stroke-width="2.5"/>' +
      '<path d="M20 4 L 110 140" fill="none" stroke="' + t.boundary + '" stroke-width="1.2" stroke-dasharray="6 3 2 3"/>' +
      '<circle cx="176" cy="68" r="5" fill="' + t.accent + '" stroke="' + t.background + '" stroke-width="2"/>' +
      '<text x="186" y="64" font-family="IBM Plex Sans Arabic, sans-serif" font-size="11" font-weight="600" fill="' + t.label + '" stroke="' + t.labelHalo + '" stroke-width="3" paint-order="stroke">نابلس</text></svg>';
  }

  // ---- ramp SVG -------------------------------------------------------
  function rampSVG(r, opts) {
    opts = opts || {};
    var W = opts.width || 240, H = opts.height || 28, n = r.colors.length, w = 240 / n;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 240 28" preserveAspectRatio="none">' +
      r.colors.map(function (c, i) { return '<rect x="' + round(i * w) + '" y="0" width="' + round(w + 0.5) + '" height="28" fill="' + c + '"/>'; }).join('') + '</svg>';
  }

  /* ================================================================== */
  /*  MapLibre GL output                                                */
  /* ================================================================== */
  function base(id, kind, o) {
    var l = { id: (o.idPrefix || 'pn') + '-' + id.replace(/\./g, '-') + (kind ? '-' + kind : ''), source: o.source || 'data' };
    if (o.sourceLayer) l['source-layer'] = o.sourceLayer;
    if (o.filter) l.filter = o.filter;
    return l;
  }
  function pointML(p, o) {
    var img = 'pn-pt-' + p.key + (o.color ? '-' + o.color.replace(/[^0-9a-z]/gi, '') : '') + (o.size ? '-' + o.size : ''), svg = pointSVG(p, { size: o.size || 32, color: o.color });
    var l = base(p.id, '', o);
    l.type = 'symbol';
    l.layout = { 'icon-image': img, 'icon-size': o.iconSize || 1, 'icon-allow-overlap': true, 'icon-anchor': p.shape === 'pin' ? 'bottom' : 'center' };
    if (o.labelField) {
      l.layout['text-field'] = ['get', o.labelField];
      l.layout['text-font'] = o.font || ['Noto Sans Regular'];
      l.layout['text-size'] = 12; l.layout['text-offset'] = [0, 1.4]; l.layout['text-anchor'] = 'top'; l.layout['text-optional'] = true;
      l.paint = { 'text-color': '#E7E9EC', 'text-halo-color': '#0A0B0D', 'text-halo-width': 1.4 };
    }
    return { images: [{ id: img, svg: svg, pixelRatio: 2 }], layers: [l] };
  }
  function lineML(L, o) {
    var images = [], layers = [], k = o.widthScale || 1;
    L.strokes.forEach(function (st, i) {
      var l = base(L.id, 's' + i, o);
      l.type = 'line';
      l.layout = { 'line-cap': st.cap || (st.dash ? 'butt' : 'round'), 'line-join': 'round' };
      l.paint = { 'line-color': st.c, 'line-width': round(st.w * k) };
      if (st.dash) l.paint['line-dasharray'] = st.dash.map(function (d) { return round(Math.max(d, 0.1) / st.w); });
      if (st.opacity != null) l.paint['line-opacity'] = st.opacity;
      layers.push(l);
    });
    (L.marks || []).forEach(function (mk, i) {
      var img = 'pn-mk-' + mk.m + '-' + mk.c.replace(/[^0-9a-z]/gi, '');
      images.push({ id: img, svg: markSVG(mk.m, mk.c), pixelRatio: 2 });
      var upright = mk.m === 'letterW' || mk.m === 'letterG';
      var l = base(L.id, 'm' + i, o);
      l.type = 'symbol';
      l.layout = { 'symbol-placement': 'line', 'symbol-spacing': mk.spacing, 'icon-image': img, 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-rotation-alignment': upright ? 'viewport' : 'map', 'icon-keep-upright': false };
      layers.push(l);
    });
    return { images: images, layers: layers };
  }
  function fillML(F, o) {
    var images = [], layers = [];
    var l = base(F.id, 'fill', o);
    l.type = 'fill';
    if (F.pattern) {
      var img = 'pn-pat-' + F.id;
      images.push({ id: img, svg: fillTileSVG(F), pixelRatio: 2 });
      l.paint = { 'fill-pattern': img };
    } else {
      l.paint = { 'fill-color': F.bg };
    }
    if (o.opacity != null) l.paint['fill-opacity'] = o.opacity;
    layers.push(l);
    if (F.outline) {
      var ol = base(F.id, 'outline', o);
      ol.type = 'line';
      ol.layout = { 'line-join': 'round' };
      ol.paint = { 'line-color': F.outline.c, 'line-width': F.outline.w };
      if (F.outline.dash) ol.paint['line-dasharray'] = F.outline.dash.map(function (d) { return round(d / F.outline.w); });
      layers.push(ol);
    }
    return { images: images, layers: layers };
  }
  // A ready basemap for any OpenMapTiles-schema vector source
  function themeML(th, o) {
    var t = th.t, src = o.source || 'openmaptiles', P = (o.idPrefix || 'pn') + '-' + th.id + '-';
    function L(id, type, layer, paint, filter, layout) {
      var x = { id: P + id, type: type, source: src, 'source-layer': layer, paint: paint };
      if (filter) x.filter = filter; if (layout) x.layout = layout; return x;
    }
    var major = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false];
    return {
      images: [],
      layers: [
        { id: P + 'background', type: 'background', paint: { 'background-color': t.land } },
        L('park', 'fill', 'park', { 'fill-color': t.park }),
        L('landcover', 'fill', 'landcover', { 'fill-color': t.park, 'fill-opacity': 0.6 }, ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]]),
        L('water', 'fill', 'water', { 'fill-color': t.water }),
        L('waterway', 'line', 'waterway', { 'line-color': t.waterLine, 'line-width': 1.2 }),
        L('building', 'fill', 'building', { 'fill-color': t.building, 'fill-outline-color': t.buildingLine }),
        L('road-casing', 'line', 'transportation', { 'line-color': t.roadCasing, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 12] }, null, { 'line-cap': 'round', 'line-join': 'round' }),
        L('road', 'line', 'transportation', { 'line-color': t.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 16, 9] }, ['!', major], { 'line-cap': 'round', 'line-join': 'round' }),
        L('road-major', 'line', 'transportation', { 'line-color': t.roadMajor, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 16, 10] }, major, { 'line-cap': 'round', 'line-join': 'round' }),
        L('boundary', 'line', 'boundary', { 'line-color': t.boundary, 'line-width': 1.2, 'line-dasharray': [5, 2, 1, 2] }),
        L('place-label', 'symbol', 'place', { 'text-color': t.label, 'text-halo-color': t.labelHalo, 'text-halo-width': 1.5 }, null,
          { 'text-field': ['coalesce', ['get', 'name:ar'], ['get', 'name']], 'text-font': o.font || ['Noto Sans Regular'], 'text-size': 13 })
      ],
      tokens: t
    };
  }
  function rampML(r, o) {
    var field = o.field || 'value', min = o.min != null ? o.min : 0, max = o.max != null ? o.max : 1, n = r.colors.length;
    if (r.type === 'qualitative') {
      var m = ['match', ['get', field]];
      r.colors.forEach(function (c, i) { m.push(i, c); });
      m.push('#5C626B');
      return { expression: m };
    }
    var e = ['interpolate', ['linear'], ['get', field]];
    r.colors.forEach(function (c, i) { e.push(round(min + (max - min) * i / (n - 1)), c); });
    return { expression: e };
  }

  /* ================================================================== */
  /*  Registry                                                          */
  /* ================================================================== */
  var REG = {}, ORDER = [];
  function add(e) { REG[e.id] = e; ORDER.push(e.id); }
  POINTS.forEach(function (p) {
    add({ id: 'point.' + p[0], key: p[0], kind: 'point', ar: p[1], en: p[2], cat: p[3], catAr: CAT[p[3]].ar, shape: p[4], glyph: p[5], color: p[6] || CAT[p[3]].color });
  });
  LINES.forEach(function (l) { l.key = l.id; l.id = 'line.' + l.id; l.kind = 'line'; l.catAr = LCAT[l.cat]; add(l); });
  FILLS.forEach(function (f) { f.key = f.id; f.id = 'fill.' + f.id; f.kind = 'fill'; f.catAr = FCAT[f.cat]; add(f); });
  THEMES.forEach(function (t) { t.key = t.id; t.id = 'theme.' + t.id; t.kind = 'theme'; t.cat = 'theme'; t.catAr = 'ثيمات الخريطة'; add(t); });
  RAMPS.forEach(function (r) { r.key = r.id; r.id = 'ramp.' + r.id; r.kind = 'ramp'; r.cat = r.type; r.catAr = 'تدرّجات الألوان'; add(r); });

  function get(id) { var e = REG[id]; if (!e) throw new Error('PNSymbols: unknown symbol "' + id + '"'); return e; }

  function toSVG(id, opts) {
    var e = get(id);
    switch (e.kind) {
      case 'point': return pointSVG(e, opts);
      case 'line': return lineSVG(e, opts);
      case 'fill': return (opts && opts.tile) ? fillTileSVG(e) : fillSVG(e, opts);
      case 'theme': return themeSVG(e, opts);
      case 'ramp': return rampSVG(e, opts);
    }
  }
  function toMapLibre(id, opts) {
    var e = get(id); opts = opts || {};
    switch (e.kind) {
      case 'point': return pointML(e, opts);
      case 'line': return lineML(e, opts);
      case 'fill': return fillML(e, opts);
      case 'theme': return themeML(e, opts);
      case 'ramp': return rampML(e, opts);
    }
  }
  function toCSS(id) {
    var e = get(id);
    if (e.kind === 'theme') return ':root {\n' + Object.keys(e.t).map(function (k) { return '  --pn-map-' + k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ': ' + e.t[k] + ';'; }).join('\n') + '\n}';
    if (e.kind === 'ramp') return '.pn-ramp-' + e.key + ' { background: linear-gradient(90deg, ' + e.colors.join(', ') + '); }';
    if (e.kind === 'fill') return '.pn-fill-' + e.key + ' {\n  background-color: ' + e.bg + ';\n' + (e.pattern ? '  background-image: url("data:image/svg+xml,' + encodeURIComponent(fillTileSVG(e)) + '");\n' : '') + '  border: ' + (e.outline ? e.outline.w + 'px ' + (e.outline.dash ? 'dashed ' : 'solid ') + e.outline.c : 'none') + ';\n}';
    return '';
  }

  // Load an SVG string as an image MapLibre accepts (browser only)
  function svgImage(svg, pixelRatio) {
    return new Promise(function (resolve, reject) {
      var m = /width="([\d.]+)"\s+height="([\d.]+)"/.exec(svg);
      var w = m ? +m[1] : 32, h = m ? +m[2] : 32, img = new Image(w * pixelRatio, h * pixelRatio);
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  /**
   * Add a symbol to a live MapLibre map.
   * opts: { source, sourceLayer, filter, idPrefix, beforeId, labelField, color, size }
   * Returns the ids of the layers it added.
   */
  function addToMap(map, id, opts) {
    opts = opts || {};
    var spec = toMapLibre(id, opts);
    return Promise.all(spec.images.map(function (im) {
      if (map.hasImage(im.id)) return null;
      return svgImage(im.svg, im.pixelRatio).then(function (img) { if (!map.hasImage(im.id)) map.addImage(im.id, img, { pixelRatio: im.pixelRatio }); });
    })).then(function () {
      spec.layers.forEach(function (l) { if (!map.getLayer(l.id)) map.addLayer(l, opts.beforeId); });
      return spec.layers.map(function (l) { return l.id; });
    });
  }
  function removeFromMap(map, id, opts) {
    toMapLibre(id, opts || {}).layers.forEach(function (l) { if (map.getLayer(l.id)) map.removeLayer(l.id); });
  }

  function list(kind) { return ORDER.map(function (i) { return REG[i]; }).filter(function (e) { return !kind || e.kind === kind; }); }
  function exportAll(opts) {
    opts = opts || {};
    return {
      name: 'PalNovaa Engine Symbol Library', version: VERSION, generated: new Date().toISOString(),
      usage: 'Each symbol carries its SVG and MapLibre GL spec. Replace "data" with your source id; add "source-layer" for vector tiles.',
      symbols: list().map(function (e) {
        var out = { id: e.id, kind: e.kind, category: e.cat, categoryAr: e.catAr, nameAr: e.ar, nameEn: e.en };
        if (e.kind === 'point') { out.shape = e.shape; out.color = e.color; }
        if (e.kind === 'line') { out.strokes = e.strokes; out.marks = e.marks || []; }
        if (e.kind === 'fill') { out.background = e.bg; out.tileSize = e.tile || null; out.outline = e.outline || null; out.tileSVG = e.pattern ? fillTileSVG(e) : null; }
        if (e.kind === 'theme') { out.tokens = e.t; out.css = toCSS(e.id); }
        if (e.kind === 'ramp') { out.type = e.type; out.colors = e.colors; out.css = toCSS(e.id); }
        out.svg = toSVG(e.id);
        out.maplibre = toMapLibre(e.id, { source: opts.source || 'data' });
        return out;
      })
    };
  }

  return {
    version: VERSION,
    categories: { points: CAT, lines: LCAT, fills: FCAT },
    glyphs: G, marks: MARKS,
    list: list, get: get,
    toSVG: toSVG, toMapLibre: toMapLibre, toCSS: toCSS,
    addToMap: addToMap, removeFromMap: removeFromMap,
    exportAll: exportAll,
    markSVG: markSVG
  };
});
