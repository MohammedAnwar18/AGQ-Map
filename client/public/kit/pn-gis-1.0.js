/* PalNovaa GIS kit 1.0 — pn-gis-1.0.js  (needs Leaflet 1.9.x loaded first)
   Basemaps: satellite (Esri) · google · hybrid · osm
   API: PN.map · PN.loadIcons · PN.marker · PN.line · PN.area · PN.layer · PN.legend
        PN.popup · PN.choropleth · PN.exportCSV · PN.icon · PN.pin
   Data: PN.points · PN.lines · PN.areas · PN.cats  */
(function (w) {
  'use strict';
  var POINTS = {"pn-mosque":{"ar":"مسجد","en":"Mosque","cat":"religious","color":"#0b6e4f"},"pn-church":{"ar":"كنيسة","en":"Church","cat":"religious","color":"#4c3f99"},"pn-supermarket":{"ar":"سوبرماركت","en":"Supermarket","cat":"commerce","color":"#b85c00"},"pn-mall":{"ar":"مجمّع تجاري","en":"Shopping mall","cat":"commerce","color":"#9a4d00"},"pn-hospital":{"ar":"مستشفى","en":"Hospital","cat":"health","color":"#c0262d"},"pn-park":{"ar":"حديقة","en":"Park","cat":"nature","color":"#2f7d32"},"pn-tower":{"ar":"برج اتصالات","en":"Telecom tower","cat":"infrastructure","color":"#475569"},"pn-police":{"ar":"مركز شرطة","en":"Police station","cat":"security","color":"#1e3a8a"},"pn-checkpoint":{"ar":"حاجز / نقطة تفتيش","en":"Checkpoint","cat":"security","color":"#8b1a1a"},"pn-school":{"ar":"مدرسة","en":"School","cat":"education","color":"#1d5fa8"},"pn-university":{"ar":"جامعة","en":"University","cat":"education","color":"#164a85"},"pn-bank":{"ar":"بنك","en":"Bank","cat":"finance","color":"#7a5a00"},"pn-restaurant":{"ar":"مطعم","en":"Restaurant","cat":"food","color":"#b5381b"},"pn-hookah":{"ar":"فيب وأراجيل","en":"Vape & hookah","cat":"food","color":"#6d28d9"},"pn-bakery":{"ar":"مخبز","en":"Bakery","cat":"food","color":"#a35a14"},"pn-butcher":{"ar":"ملحمة","en":"Butcher","cat":"food","color":"#9f1239"},"pn-traffic-light":{"ar":"إشارة مرور","en":"Traffic light","cat":"transport","color":"#334155"},"pn-camera":{"ar":"كاميرا مراقبة","en":"CCTV camera","cat":"transport","color":"#0e6377"}}, LINES = {"ln-motorway":{"ar":"شارع سريع","en":"Motorway","stack":[{"color":"#7d1212","weight":10,"lineCap":"round","lineJoin":"round"},{"color":"#e03131","weight":7,"lineCap":"round","lineJoin":"round"}]},"ln-main":{"ar":"شارع رئيسي","en":"Main road","stack":[{"color":"#8a4b00","weight":8,"lineCap":"round","lineJoin":"round"},{"color":"#f08c00","weight":5.5,"lineCap":"round","lineJoin":"round"}]},"ln-regional":{"ar":"شارع إقليمي","en":"Regional road","stack":[{"color":"#8f6d00","weight":7,"lineCap":"round","lineJoin":"round"},{"color":"#fcc419","weight":4.5,"lineCap":"round","lineJoin":"round"}]},"ln-local":{"ar":"شارع فرعي","en":"Local street","stack":[{"color":"#8b95a1","weight":5.5,"lineCap":"round","lineJoin":"round"},{"color":"#ffffff","weight":3.5,"lineCap":"round","lineJoin":"round"}]},"ln-railway":{"ar":"سكة قطار","en":"Railway","stack":[{"color":"#3b3b3b","weight":5,"lineCap":"butt"},{"color":"#ffffff","weight":3,"dashArray":"10 10","lineCap":"butt"}]},"ln-wall":{"ar":"جدار الفصل العنصري","en":"Separation wall","stack":[{"color":"#1f2328","weight":6,"lineCap":"butt"},{"color":"#e03131","weight":2.5,"dashArray":"2 7","lineCap":"butt"}]},"ln-power":{"ar":"خط كهرباء","en":"Power line","stack":[{"color":"#d97706","weight":2,"dashArray":"14 4 2 4","lineCap":"butt"}]},"ln-water":{"ar":"خط مياه","en":"Water pipe","stack":[{"color":"#1c6fd6","weight":2.5,"dashArray":"8 5","lineCap":"butt"}]},"ln-river":{"ar":"نهر / وادٍ","en":"River","stack":[{"color":"#1971c2","weight":5.5,"opacity":0.35,"lineCap":"round","lineJoin":"round"},{"color":"#4dabf7","weight":3.5,"lineCap":"round","lineJoin":"round"}]},"ln-trail":{"ar":"مسار مشي","en":"Walking trail","stack":[{"color":"#7a5230","weight":2.5,"dashArray":"1 6","lineCap":"round"}]}}, AREAS = {"pg-governorate":{"ar":"حدود محافظة","en":"Governorate","style":{"color":"#6741d9","weight":3,"dashArray":"14 5 3 5","fillColor":"#6741d9","fillOpacity":0.04}},"pg-city":{"ar":"حدود مدينة","en":"City","style":{"color":"#495057","weight":2.2,"dashArray":"9 4","fillColor":"#868e96","fillOpacity":0.12}},"pg-village":{"ar":"حدود قرية","en":"Village","style":{"color":"#6c757d","weight":1.5,"dashArray":"4 4","fillColor":"#adb5bd","fillOpacity":0.1}},"pg-water":{"ar":"مسطّح مائي","en":"Water body","style":{"color":"#1c7ed6","weight":1.2,"fillColor":"#74c0fc","fillOpacity":0.6}},"pg-basin":{"ar":"حوض أراضٍ","en":"Land basin","style":{"color":"#b08900","weight":1.8,"dashArray":"6 3","fillColor":"#ffd43b","fillOpacity":0.14}},"pg-parcel":{"ar":"قطعة أرض","en":"Land parcel","style":{"color":"#8d5524","weight":0.9,"fillColor":"#e8c39e","fillOpacity":0.18}}}, CATS = {"religious":"دينية","commerce":"تجارة","health":"صحة","nature":"طبيعة","infrastructure":"بنية تحتية","security":"أمن","education":"تعليم","finance":"مال","food":"طعام","transport":"مرور"};
  var PIN = 'M16 1.5C8.8 1.5 3 7 3 13.9 3 22.3 16 34.5 16 34.5S29 22.3 29 13.9C29 7 23.2 1.5 16 1.5z';
  /* صورٌ فضائيّةٌ أوّلاً. لكلّ خريطةٍ نطاقاتُها الفرعيّة وأقصى تكبيرٍ خاصٌّ بها. */
  var BASEMAPS = {
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                 attr: 'Tiles &copy; Esri — Maxar, Earthstar Geographics', max: 19 },
    google:    { url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attr: '&copy; Google',
                 subs: ['mt0', 'mt1', 'mt2', 'mt3'], max: 20 },
    hybrid:    { url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attr: '&copy; Google',
                 subs: ['mt0', 'mt1', 'mt2', 'mt3'], max: 20 },
    osm:       { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap', max: 19 }
  };
  BASEMAPS.esri = BASEMAPS.satellite;
  /* مفتاحان قديمان يبقيان ليعملا في أيّ تطبيقٍ بُني قبل هذا التغيير */
  BASEMAPS.dark = BASEMAPS.satellite;
  BASEMAPS.light = BASEMAPS.osm;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  /* Cross-origin <use href="https://…svg#id"> is blocked by browsers even with CORS:
     inline the sprite once, then reference "#pn-…". */
  function loadIcons(url) {
    if (document.getElementById('pn-sprite')) return Promise.resolve();
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (t) {
      var d = document.createElement('div'); d.id = 'pn-sprite'; d.setAttribute('aria-hidden', 'true');
      d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; d.innerHTML = t;
      document.body.insertBefore(d, document.body.firstChild);
    });
  }
  function icon(id, cls) { return '<svg class="pn-i ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function pin(id, size) {
    var p = POINTS[id] || { color: '#475569' }, s = size || 32;
    return '<svg class="pn-pin" width="' + s + '" height="' + Math.round(s * 1.125) + '" viewBox="0 0 32 36" aria-hidden="true">' +
      '<path d="' + PIN + '" fill="' + p.color + '" stroke="#fff" stroke-width="2"/>' +
      '<svg x="6" y="4" width="20" height="20" viewBox="0 0 24 24" color="#fff"><use href="#' + id + '"/></svg></svg>';
  }

  function map(el, o) {
    o = o || {};
    var m = L.map(el, { zoomControl: false, attributionControl: true }).setView(o.center || [31.9, 35.2], o.zoom || 12);
    L.control.zoom({ position: o.zoomPosition || 'bottomleft' }).addTo(m);
    m._pnBase = null;
    m.pnBasemap = function (key) {
      var b = BASEMAPS[key] || BASEMAPS.satellite;
      if (m._pnBase) m.removeLayer(m._pnBase);
      m._pnBase = L.tileLayer(b.url, { attribution: b.attr, maxZoom: b.max || 19, subdomains: b.subs || 'abc' }).addTo(m);
      m._pnBase.bringToBack(); return m;
    };
    if (o.basemap !== false) m.pnBasemap(o.basemap || 'satellite');
    return m;
  }

  function marker(latlng, id, opts) {
    return L.marker(latlng, Object.assign({
      icon: L.divIcon({ className: 'pn-pin-wrap', html: pin(id), iconSize: [32, 36], iconAnchor: [16, 35], popupAnchor: [0, -30] }),
      title: (POINTS[id] || {}).ar
    }, opts || {}));
  }
  function line(geo, id, opts) {
    var stack = (LINES[id] || LINES['ln-local']).stack, g = L.featureGroup();
    stack.forEach(function (s, i) {
      g.addLayer(L.geoJSON(geo, { style: s, interactive: i === stack.length - 1, onEachFeature: opts && opts.onEachFeature }));
    });
    return g;
  }
  function area(geo, id, opts) {
    var s = (AREAS[id] || AREAS['pg-parcel']).style;
    return L.geoJSON(geo, Object.assign({ style: function () { return s; } }, opts || {}));
  }

  function popup(props, title) {
    var rows = Object.keys(props || {}).filter(function (k) { return k.charAt(0) !== '_' && props[k] != null && props[k] !== ''; })
      .map(function (k) { return '<tr><th>' + esc(k) + '</th><td>' + esc(props[k]) + '</td></tr>'; }).join('');
    return '<div class="pn-popup">' + (title ? '<h4>' + esc(title) + '</h4>' : '') + '<table>' + rows + '</table></div>';
  }

  /* layer(url, {map, symbol, status, fit, popupTitle}) — fetch GeoJSON, show loading / error, fitBounds.
     symbol: 'pn-…' (points) | 'ln-…' (lines) | 'pg-…' (areas) | function(feature) → id */
  function layer(src, o) {
    o = o || {};
    var st = typeof o.status === 'string' ? document.querySelector(o.status) : o.status;
    function say(state, msg) { if (st) { st.dataset.state = state; st.innerHTML = state === 'loading' ? '<span class="pn-spinner"></span> ' + esc(msg) : esc(msg); } }
    say('loading', o.loadingText || 'جارٍ التحميل…');
    var p = typeof src === 'string' ? fetch(src).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }) : Promise.resolve(src);
    return p.then(function (geo) {
      var sym = o.symbol, pick = typeof sym === 'function' ? sym : function () { return sym; };
      var group = L.featureGroup(), n = 0;
      (geo.features || []).forEach(function (f) {
        var id = pick(f) || 'pn-tower', lyr, t = f.geometry && f.geometry.type;
        if (/Point/.test(t)) lyr = marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], id);
        else if (/LineString/.test(t)) lyr = line(f, id);
        else lyr = area(f, id);
        lyr.bindPopup(popup(f.properties, o.popupTitle ? o.popupTitle(f) : (f.properties && (f.properties.name || f.properties['الاسم']))));
        lyr.feature = f; group.addLayer(lyr); n++;
      });
      if (o.map) { group.addTo(o.map); if (o.fit !== false && n) o.map.fitBounds(group.getBounds(), { padding: [24, 24] }); }
      say('ok', n + ' معلم'); return group;
    }).catch(function (e) { say('error', (o.errorText || 'تعذّر تحميل الطبقة') + ' — ' + e.message); throw e; });
  }

  /* legend(ids) → HTML rows, any mix of pn-/ln-/pg- ids */
  function legend(ids) {
    return '<div class="pn-legend">' + ids.map(function (id) {
      var sw, label;
      if (POINTS[id]) { sw = pin(id, 22); label = POINTS[id].ar; }
      else if (LINES[id]) {
        sw = '<svg class="pn-sw" viewBox="0 0 36 14">' + LINES[id].stack.map(function (s) {
          return '<path d="M2 7h32" fill="none" stroke="' + s.color + '" stroke-width="' + s.weight + '" stroke-opacity="' + (s.opacity == null ? 1 : s.opacity) +
            '"' + (s.dashArray ? ' stroke-dasharray="' + s.dashArray + '"' : '') + ' stroke-linecap="' + (s.lineCap || 'round') + '"/>'; }).join('') + '</svg>';
        label = LINES[id].ar;
      } else if (AREAS[id]) {
        var a = AREAS[id].style;
        sw = '<svg class="pn-sw" viewBox="0 0 36 14"><rect x="2" y="1.5" width="32" height="11" rx="2" fill="' + a.fillColor + '" fill-opacity="' + Math.max(a.fillOpacity, .15) +
          '" stroke="' + a.color + '" stroke-width="' + Math.min(a.weight, 2.5) + '"' + (a.dashArray ? ' stroke-dasharray="' + a.dashArray.split(' ').map(function (x) { return x / 2; }).join(' ') + '"' : '') + '/></svg>';
        label = AREAS[id].ar;
      } else return '';
      return '<div class="pn-legend__row">' + sw + '<span>' + esc(label) + '</span></div>';
    }).join('') + '</div>';
  }

  /* choropleth(geo, {field, breaks:[…], colors:[…], map}) — quantile-ish classes, returns {layer, legendHTML} */
  function choropleth(geo, o) {
    var vals = geo.features.map(function (f) { return +f.properties[o.field]; }).filter(isFinite).sort(function (a, b) { return a - b; });
    var colors = o.colors || ['#e6f4f1', '#a7dccf', '#5fb8a6', '#23897a', '#0b5e53'];
    var br = o.breaks || colors.slice(1).map(function (_, i) { return vals[Math.floor((i + 1) * vals.length / colors.length)]; });
    function col(v) { for (var i = 0; i < br.length; i++) if (v < br[i]) return colors[i]; return colors[colors.length - 1]; }
    var lyr = L.geoJSON(geo, { style: function (f) { return { color: '#ffffff', weight: 1.2, fillColor: col(+f.properties[o.field]), fillOpacity: .85 }; },
      onEachFeature: function (f, l) { l.bindPopup(popup(f.properties, f.properties.name)); } });
    if (o.map) lyr.addTo(o.map);
    var lo = [vals[0]].concat(br), html = '<div class="pn-legend">' + colors.map(function (c, i) {
      return '<div class="pn-legend__row"><span class="pn-sw pn-sw--fill" style="background:' + c + '"></span><span>' +
        (lo[i] == null ? '' : Math.round(lo[i]).toLocaleString('ar')) + (i < br.length ? ' – ' + Math.round(br[i]).toLocaleString('ar') : '+') + '</span></div>'; }).join('') + '</div>';
    return { layer: lyr, legendHTML: html };
  }

  function exportCSV(rows, name) {
    if (!rows.length) return;
    var keys = Object.keys(rows[0]);
    var csv = '\ufeff' + [keys.join(',')].concat(rows.map(function (r) {
      return keys.map(function (k) { var v = r[k] == null ? '' : String(r[k]); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',');
    })).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = (name || 'export') + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  w.PN = { version: '1.0', points: POINTS, lines: LINES, areas: AREAS, cats: CATS, basemaps: BASEMAPS,
    map: map, loadIcons: loadIcons, icon: icon, pin: pin, marker: marker, line: line, area: area,
    layer: layer, legend: legend, popup: popup, choropleth: choropleth, exportCSV: exportCSV, esc: esc };
})(window);
