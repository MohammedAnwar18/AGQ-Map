/* ===========================================================================
   جيوبورتال 1.0 — منطقُ البوّابة الجغرافيّة
   يحتاج: Leaflet 1.9.x، و proj4 (اختياريّ، لإحداثيّات فلسطين 1923).
   window.GP: init · addLayers · setBasemap · search · measure · crs
   =========================================================================== */
(function (w) {
  'use strict';

  /* تعريفاتُ الإسناد — مطابقةٌ لِما يستعمله محرّك بالنوفا (Cassini لا TM). */
  var PROJ = {
    'EPSG:28191': ['فلسطين 1923 · Grid', '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs'],
    'EPSG:28192': ['فلسطين 1923 · Belt', '+proj=cass +lat_0=31.73409694444445 +lon_0=35.21208055555556 +x_0=170251.555 +y_0=1126867.909 +ellps=clrk80 +towgs84=-275.722,94.7824,340.894,-8.001,-4.42,-11.821,1 +units=m +no_defs']
  };

  /* خرائطُ الأساس — صورٌ فضائيّةٌ أو شارع، بلا Carto. */
  var BASEMAPS = {
    light: { label: 'شارع', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
             attr: '&copy; OpenStreetMap', max: 19 },
    satellite: { label: 'صورة فضائية', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
             attr: 'Tiles &copy; Esri — Maxar, Earthstar Geographics', max: 19 },
    hybrid: { label: 'صورة بالأسماء', url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
             attr: '&copy; Google', subs: ['mt0', 'mt1', 'mt2', 'mt3'], max: 20 }
  };

  var S = {
    map: null, base: null, labels: null, layers: [], groups: {},
    crs: 'wgs', basemap: 'light', showLabels: true,
    measure: null, mPts: [], mLayer: null, onChange: null
  };

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var num = function (n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };

  /* ───────────────────────── الخريطة ───────────────────────── */
  function init(el, o) {
    o = o || {};
    S.map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 6 })
      .setView(o.center || [31.9, 35.2], o.zoom || 12);
    setBasemap(o.basemap || 'light');
    if (w.proj4) for (var k in PROJ) proj4.defs(k, PROJ[k][1]);
    return S.map;
  }

  function setBasemap(key) {
    var b = BASEMAPS[key] || BASEMAPS.light;
    S.basemap = BASEMAPS[key] ? key : 'light';
    if (S.base) S.map.removeLayer(S.base);
    S.base = L.tileLayer(b.url, { attribution: b.attr, maxZoom: b.max || 19, subdomains: b.subs || 'abc' }).addTo(S.map);
    S.base.bringToBack();
    syncLabels();
    return S.basemap;
  }

  /* طبقةُ الأسماء فوق الصور الفضائيّة فقط — الشارعُ يحمل أسماءه أصلاً */
  function syncLabels() {
    if (S.labels) { S.map.removeLayer(S.labels); S.labels = null; }
    if (!S.showLabels || S.basemap !== 'satellite') return;
    S.labels = L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
      { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'], maxZoom: 20, attribution: '' }).addTo(S.map);
  }
  function setLabels(on) { S.showLabels = !!on; syncLabels(); return S.showLabels; }

  /* ───────────────────────── الطبقات ───────────────────────── */
  function popup(p, title) {
    var rows = Object.keys(p || {}).filter(function (k) { return k !== 'name' && p[k] != null && p[k] !== ''; })
      .map(function (k) { return '<tr><th style="text-align:start;color:#6B7A75;font-weight:500;padding:2px 0;padding-inline-end:12px;vertical-align:top">' + esc(k) + '</th><td style="padding:2px 0">' + esc(p[k]) + '</td></tr>'; }).join('');
    return '<div style="min-width:170px">' + (title ? '<b style="display:block;margin-bottom:6px">' + esc(title) + '</b>' : '')
      + '<table style="border-collapse:collapse;font-size:12.5px">' + rows + '</table></div>';
  }

  function build(def) {
    var color = def.color || '#0E7C66';
    var opts = {
      style: function () {
        return def.geom === 'line'
          ? { color: color, weight: 3.2, opacity: .92, lineCap: 'round', lineJoin: 'round' }
          : { color: color, weight: 1.8, fillColor: color, fillOpacity: .13 };
      },
      pointToLayer: function (f, ll) {
        return L.circleMarker(ll, { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
      },
      onEachFeature: function (f, lyr) {
        var p = f.properties || {};
        lyr.bindPopup(popup(p, p.name || def.name));
        lyr.bindTooltip(String(p.name || def.name), { direction: 'top', opacity: .92 });
      }
    };
    return L.geoJSON(def.data, opts);
  }

  function addLayers(defs) {
    S.layers = defs.map(function (d) {
      var o = Object.assign({}, d);
      o.layer = build(d);
      if (d.on) o.layer.addTo(S.map);
      return o;
    });
    S.groups = {};
    S.layers.forEach(function (l) { (S.groups[l.group] = S.groups[l.group] || []).push(l); });
    fit();
    return S.layers;
  }
  function toggle(id, on) {
    var l = S.layers.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    l.on = on == null ? !l.on : !!on;
    if (l.on) l.layer.addTo(S.map); else S.map.removeLayer(l.layer);
    if (S.onChange) S.onChange();
    return l.on;
  }
  function toggleAll(on) {
    S.layers.forEach(function (l) {
      l.on = !!on;
      if (on) l.layer.addTo(S.map); else S.map.removeLayer(l.layer);
    });
    if (S.onChange) S.onChange();
  }
  function visibleCount() { return S.layers.filter(function (l) { return l.on; }).length; }
  function fit() {
    var g = L.featureGroup(S.layers.filter(function (l) { return l.on; }).map(function (l) { return l.layer; }));
    try { var b = g.getBounds(); if (b.isValid()) S.map.fitBounds(b, { padding: [28, 28] }); } catch (e) { /* */ }
  }

  /* ───────────────────────── البحث ───────────────────────── */
  function search(q, limit) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 2) return [];
    var out = [];
    S.layers.forEach(function (l) {
      l.data.features.forEach(function (f) {
        var p = f.properties || {}, n = String(p.name || '');
        if (n.toLowerCase().indexOf(q) < 0) return;
        out.push({ name: n, kind: l.name, color: l.color, layerId: l.id, feature: f });
      });
    });
    return out.slice(0, limit || 12);
  }
  function goTo(hit) {
    var g = hit.feature.geometry;
    if (g.type === 'Point') S.map.setView([g.coordinates[1], g.coordinates[0]], Math.max(S.map.getZoom(), 15));
    else { try { S.map.fitBounds(L.geoJSON(hit.feature).getBounds(), { padding: [40, 40] }); } catch (e) { /* */ } }
    var l = S.layers.filter(function (x) { return x.id === hit.layerId; })[0];
    if (l && !l.on) toggle(l.id, true);
  }

  /* ───────────────────────── القياس ───────────────────────── */
  var R = 6371008.8, rad = function (d) { return d * Math.PI / 180; };
  function dist(a, b) {
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function ringArea(ll) {
    var n = ll.length, a = 0;
    if (n < 3) return 0;
    for (var i = 0; i < n; i++) {
      var p1 = ll[i], p2 = ll[(i + 1) % n];
      a += rad(p2.lng - p1.lng) * (2 + Math.sin(rad(p1.lat)) + Math.sin(rad(p2.lat)));
    }
    return Math.abs(a * R * R / 2);
  }
  function fmtLen(m) { return m >= 1000 ? num(m / 1000, 3) + ' كم' : num(m, 1) + ' م'; }
  function fmtArea(m2) {
    return m2 >= 1e6 ? num(m2 / 1e6, 3) + ' كم²' : num(m2 / 1000, m2 < 1e4 ? 3 : 2) + ' دونم';
  }

  function measure(mode) {
    clearMeasure();
    S.measure = mode || null;
    if (S.measure) { S.map.getContainer().style.cursor = 'crosshair'; S.map.on('click', onMeasureClick); }
    return S.measure;
  }
  function onMeasureClick(e) {
    S.mPts.push(e.latlng);
    drawMeasure();
    if (S.onChange) S.onChange();
  }
  function drawMeasure() {
    if (S.mLayer) S.map.removeLayer(S.mLayer);
    if (!S.mPts.length) { S.mLayer = null; return; }
    var g = L.featureGroup();
    if (S.measure === 'area' && S.mPts.length > 2) {
      g.addLayer(L.polygon(S.mPts, { color: '#0E7C66', weight: 2, fillColor: '#3FD1AE', fillOpacity: .18 }));
    } else if (S.mPts.length > 1) {
      g.addLayer(L.polyline(S.mPts, { color: '#0E7C66', weight: 3, dashArray: '6 5' }));
    }
    S.mPts.forEach(function (p) {
      g.addLayer(L.circleMarker(p, { radius: 4.5, color: '#fff', weight: 2, fillColor: '#0E7C66', fillOpacity: 1 }));
    });
    S.mLayer = g.addTo(S.map);
  }
  function measureValue() {
    if (!S.measure) return null;
    if (S.measure === 'area') {
      if (S.mPts.length < 3) return { main: '—', sub: 'اختر ثلاث نقاطٍ على الأقل', count: S.mPts.length };
      var a = ringArea(S.mPts);
      return { main: fmtArea(a), sub: num(a, 0) + ' م²', count: S.mPts.length };
    }
    if (S.mPts.length < 2) return { main: '—', sub: 'اختر نقطتَين على الأقل', count: S.mPts.length };
    var t = 0;
    for (var i = 1; i < S.mPts.length; i++) t += dist(S.mPts[i - 1], S.mPts[i]);
    return { main: fmtLen(t), sub: num(t, 0) + ' م', count: S.mPts.length };
  }
  function clearMeasure() {
    S.mPts = [];
    if (S.mLayer) { S.map.removeLayer(S.mLayer); S.mLayer = null; }
    if (S.map) { S.map.getContainer().style.cursor = ''; S.map.off('click', onMeasureClick); }
    if (S.measure) S.map.on('click', onMeasureClick);
  }
  function stopMeasure() {
    S.measure = null; clearMeasure();
    if (S.map) { S.map.off('click', onMeasureClick); S.map.getContainer().style.cursor = ''; }
    if (S.onChange) S.onChange();
  }

  /* ───────────────────────── الإحداثيّات ───────────────────────── */
  var CRS_LIST = [
    { id: 'wgs', label: 'WGS 84', epsg: 'EPSG:4326' },
    { id: 'grid', label: 'فلسطين 1923 · Grid', epsg: 'EPSG:28191' },
    { id: 'belt', label: 'فلسطين 1923 · Belt', epsg: 'EPSG:28192' }
  ];
  function setCrs(id) { S.crs = CRS_LIST.some(function (c) { return c.id === id; }) ? id : 'wgs'; return S.crs; }
  function readout(latlng) {
    var c = CRS_LIST.filter(function (x) { return x.id === S.crs; })[0] || CRS_LIST[0];
    if (!latlng) return { l1: 'LAT', v1: '—', l2: 'LON', v2: '—', epsg: c.epsg };
    if (c.id === 'wgs' || !w.proj4) {
      return { l1: 'LAT', v1: latlng.lat.toFixed(5) + '° N', l2: 'LON', v2: latlng.lng.toFixed(5) + '° E', epsg: 'EPSG:4326' };
    }
    try {
      var p = proj4('EPSG:4326', c.epsg, [latlng.lng, latlng.lat]);
      return { l1: 'E', v1: num(p[0], 1) + ' م', l2: 'N', v2: num(p[1], 1) + ' م', epsg: c.epsg };
    } catch (e) {
      return { l1: 'LAT', v1: latlng.lat.toFixed(5), l2: 'LON', v2: latlng.lng.toFixed(5), epsg: 'EPSG:4326' };
    }
  }

  /* شريطُ المقياس: أقربُ رقمٍ مستديرٍ لنحو 110 بكسل */
  function scaleBar() {
    if (!S.map) return { label: '—', px: 80 };
    var c = S.map.getCenter(), y = S.map.getSize().y / 2;
    var a = S.map.containerPointToLatLng([0, y]), b = S.map.containerPointToLatLng([110, y]);
    var m = dist(a, b);
    var pow = Math.pow(10, Math.floor(Math.log(m) / Math.LN10));
    var n = m / pow;
    var r = (n >= 5 ? 5 : n >= 3 ? 3 : n >= 2 ? 2 : 1) * pow;
    return { label: r >= 1000 ? num(r / 1000, r % 1000 ? 1 : 0) + ' كم' : num(r, 0) + ' م',
      px: Math.round(110 * r / m), ratio: '1 : ' + num(Math.round(r / (m / 110) * 3779.5 / 10) * 10, 0) };
  }

  w.GP = {
    version: '1.0', state: S, basemaps: BASEMAPS, crsList: CRS_LIST, proj: PROJ,
    init: init, setBasemap: setBasemap, setLabels: setLabels,
    addLayers: addLayers, toggle: toggle, toggleAll: toggleAll, visibleCount: visibleCount, fit: fit,
    search: search, goTo: goTo,
    measure: measure, measureValue: measureValue, clearMeasure: clearMeasure, stopMeasure: stopMeasure,
    setCrs: setCrs, readout: readout, scaleBar: scaleBar,
    fmtLen: fmtLen, fmtArea: fmtArea, num: num, esc: esc, popup: popup
  };
})(window);
