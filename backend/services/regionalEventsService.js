/**
 * Regional Events Service — Palestine & Middle East
 * ===================================================
 * جلب وتصنيف الأحداث الإقليمية والمحلية لفلسطين والشرق الأوسط
 * مع ترميز جغرافي شامل لكافة القرى والبلدات والمخيمات في الضفة الغربية وغزة
 *
 * المصادر المستخدمة (بيانات مفتوحة للعموم):
 *  - GDELT Project (أحداث عالمية + منطقة MENA)
 *  - NASA FIRMS VIIRS/MODIS (بؤر حرارية)
 *  - USGS Earthquakes (زلازل)
 *  - OpenStreetMap Nominatim (reverse geocoding دقيق)
 *  - ACLED (Armed Conflict Location & Event Data) — إذا متوفر المفتاح
 *  - ReliefWeb (أحداث إنسانية)
 */

const axios = require('axios');

// ─── حدود الضفة الغربية البولغونية (Bounding Box الكامل) ──────────────────────
// min_lon, min_lat, max_lon, max_lat
const WEST_BANK_BBOX = {
  minLon: 34.88,
  minLat: 31.33,
  maxLon: 35.65,
  maxLat: 32.55,
};

// ─── قطاع غزة ───────────────────────────────────────────────────────────────────
const GAZA_BBOX = {
  minLon: 34.21,
  minLat: 31.21,
  maxLon: 34.56,
  maxLat: 31.60,
};

// ─── منطقة الشرق الأوسط الموسعة ─────────────────────────────────────────────────
const MIDDLE_EAST_BBOX = {
  minLon: 29.0,
  minLat: 25.0,
  maxLon: 55.0,
  maxLat: 42.0,
};

// ─── دالة التحقق هل نقطة داخل حدود الضفة الغربية أو غزة ────────────────────────
function isInWestBank(lon, lat) {
  return (
    lon >= WEST_BANK_BBOX.minLon &&
    lon <= WEST_BANK_BBOX.maxLon &&
    lat >= WEST_BANK_BBOX.minLat &&
    lat <= WEST_BANK_BBOX.maxLat
  );
}

function isInGaza(lon, lat) {
  return (
    lon >= GAZA_BBOX.minLon &&
    lon <= GAZA_BBOX.maxLon &&
    lat >= GAZA_BBOX.minLat &&
    lat <= GAZA_BBOX.maxLat
  );
}

function isInMiddleEast(lon, lat) {
  return (
    lon >= MIDDLE_EAST_BBOX.minLon &&
    lon <= MIDDLE_EAST_BBOX.maxLon &&
    lat >= MIDDLE_EAST_BBOX.minLat &&
    lat <= MIDDLE_EAST_BBOX.maxLat
  );
}

// ─── Cache بسيط في الذاكرة ────────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 دقائق

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { ts: Date.now(), data });
}

// ─── Reverse Geocoding عبر Nominatim (OSM) ─────────────────────────────────────
// يُعيد اسم المنطقة (قرية/بلدة/حي/مخيم) من الإحداثيات
async function reverseGeocode(lat, lon) {
  try {
    const cacheKey = `geo_${lat.toFixed(3)}_${lon.toFixed(3)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json',
        zoom: 14,       // مستوى تفصيل القرية
        'accept-language': 'ar,en',
      },
      headers: {
        'User-Agent': 'PalNovaaApp/1.0 (regional-events-service)',
        'Accept-Language': 'ar,en',
      },
      timeout: 4000,
    });

    const addr = res.data.address || {};
    // استخراج الاسم الأدق المتاح — نبحث من القرية للمدينة
    const locationName =
      addr.village ||
      addr.town ||
      addr.suburb ||
      addr.hamlet ||
      addr.neighbourhood ||
      addr.city ||
      addr.municipality ||
      addr.county ||
      addr.state ||
      res.data.display_name?.split(',')[0] ||
      'موقع غير معروف';

    const country = addr.country || '';
    const result = { locationName, country, address: addr };
    cacheSet(cacheKey, result);
    return result;
  } catch {
    return { locationName: 'موقع', country: '', address: {} };
  }
}

// ─── 1. GDELT Events — أحداث من مشروع GDELT ────────────────────────────────────
async function fetchGdeltEvents() {
  const cacheKey = 'gdelt_events';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // GDELT API v2 — آخر 24 ساعة، منطقة Palestine + Middle East
    const query = encodeURIComponent(
      '(Palestine OR Gaza OR "West Bank" OR "Jenin" OR "Nablus" OR "Hebron" OR "Ramallah" OR "Bethlehem" OR "Jericho" OR "Tulkarm" OR "Qalqilya" OR "Salfit" OR "Tubas" OR "Jerusalem") sourcecountry:IS OR sourcecountry:PS'
    );
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=50&sort=datedesc&format=json`;

    const res = await axios.get(url, { timeout: 15000 });
    const articles = res.data?.articles || [];

    const features = articles
      .filter((a) => a.url && a.title)
      .map((a, idx) => ({
        type: 'Feature',
        id: `gdelt_${idx}`,
        geometry: {
          type: 'Point',
          coordinates: [
            parseFloat(a.sourcecountry === 'IS' ? 35.2137 : 35.2),
            parseFloat(a.sourcecountry === 'IS' ? 31.7683 : 31.9),
          ],
        },
        properties: {
          id: `gdelt_${idx}`,
          type: 'news',
          title: a.title,
          description: a.seendate || '',
          url: a.url,
          source: a.domain || 'GDELT',
          date: a.seendate,
          category: 'أخبار وتحديثات',
          region: 'فلسطين',
          icon: '📰',
          color: '#f59e0b',
        },
      }));

    const result = features;
    cacheSet(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[RegionalEvents] GDELT fetch failed:', err.message);
    return [];
  }
}

// ─── 2. NASA FIRMS — بؤر حرارية (حرائق / انبعاثات حرارية) ────────────────────
async function fetchNasaFirms() {
  const cacheKey = 'nasa_firms_pal';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const API_KEY = process.env.NASA_FIRMS_API_KEY || 'DEMO_KEY';
    // VIIRS/MODIS — الضفة الغربية + غزة + منطقة الشرق الأوسط
    const bbox = `${MIDDLE_EAST_BBOX.minLon},${MIDDLE_EAST_BBOX.minLat},${MIDDLE_EAST_BBOX.maxLon},${MIDDLE_EAST_BBOX.maxLat}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${API_KEY}/VIIRS_SNPP_NRT/${bbox}/1`;

    const res = await axios.get(url, { timeout: 10000 });
    const lines = res.data.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const latIdx = headers.indexOf('latitude');
    const lonIdx = headers.indexOf('longitude');
    const frpIdx = headers.indexOf('frp');
    const dateIdx = headers.indexOf('acq_date');
    const timeIdx = headers.indexOf('acq_time');
    const confIdx = headers.indexOf('confidence');

    const features = lines
      .slice(1)
      .map((line, idx) => {
        const cols = line.split(',');
        const lat = parseFloat(cols[latIdx]);
        const lon = parseFloat(cols[lonIdx]);
        const frp = parseFloat(cols[frpIdx]) || 0;
        const date = cols[dateIdx] || '';
        const time = cols[timeIdx] || '';
        const conf = cols[confIdx] || '';

        if (isNaN(lat) || isNaN(lon)) return null;

        let region = 'الشرق الأوسط';
        if (isInWestBank(lon, lat)) region = 'الضفة الغربية';
        else if (isInGaza(lon, lat)) region = 'قطاع غزة';

        return {
          type: 'Feature',
          id: `firms_${idx}`,
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: `firms_${idx}`,
            type: 'thermal',
            title: `🔥 بؤرة حرارية — ${region}`,
            description: `قوة الإشعاع الحراري: ${frp.toFixed(1)} MW | الثقة: ${conf}%`,
            source: 'NASA FIRMS VIIRS',
            date: `${date} ${time}`,
            category: 'بؤرة حرارية',
            region,
            frp,
            icon: '🔥',
            color: frp > 50 ? '#ef4444' : frp > 10 ? '#f97316' : '#fbbf24',
          },
        };
      })
      .filter(Boolean);

    cacheSet(cacheKey, features);
    return features;
  } catch (err) {
    console.warn('[RegionalEvents] NASA FIRMS fetch failed:', err.message);
    return [];
  }
}

// ─── 3. USGS Earthquakes — زلازل في المنطقة ────────────────────────────────────
async function fetchEarthquakes() {
  const cacheKey = 'usgs_earthquakes_me';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
    const params = {
      format: 'geojson',
      minmagnitude: 2.0,
      minlatitude: MIDDLE_EAST_BBOX.minLat,
      maxlatitude: MIDDLE_EAST_BBOX.maxLat,
      minlongitude: MIDDLE_EAST_BBOX.minLon,
      maxlongitude: MIDDLE_EAST_BBOX.maxLon,
      orderby: 'time',
      limit: 50,
    };

    const res = await axios.get(url, { params, timeout: 8000 });
    const features = (res.data?.features || []).map((f) => {
      const props = f.properties;
      const [lon, lat] = f.geometry.coordinates;
      const mag = props.mag || 0;
      const place = props.place || 'غير محدد';

      let region = 'الشرق الأوسط';
      if (isInWestBank(lon, lat)) region = 'الضفة الغربية';
      else if (isInGaza(lon, lat)) region = 'قطاع غزة';

      return {
        type: 'Feature',
        id: `eq_${f.id}`,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          id: `eq_${f.id}`,
          type: 'earthquake',
          title: `🌍 زلزال ${mag.toFixed(1)} ريختر`,
          description: `الموقع: ${place}`,
          source: 'USGS Earthquakes',
          date: new Date(props.time).toISOString(),
          category: 'زلزال',
          region,
          magnitude: mag,
          icon: mag >= 4.5 ? '⚠️🌍' : '🌍',
          color: mag >= 5 ? '#ef4444' : mag >= 3.5 ? '#f97316' : '#a78bfa',
        },
      };
    });

    cacheSet(cacheKey, features);
    return features;
  } catch (err) {
    console.warn('[RegionalEvents] USGS Earthquakes fetch failed:', err.message);
    return [];
  }
}

// ─── 4. ReliefWeb — أحداث إنسانية ──────────────────────────────────────────────
async function fetchReliefWebEvents() {
  const cacheKey = 'reliefweb_events';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // v1 was decommissioned by ReliefWeb; v2 requires a pre-approved appname
    // (see https://apidoc.reliefweb.int/parameters#appname). Without one this
    // call returns 403 and the catch below yields [] — request an appname and
    // set RELIEFWEB_APPNAME to enable this source.
    const url = 'https://api.reliefweb.int/v2/disasters';
    const payload = {
      appname: process.env.RELIEFWEB_APPNAME || 'PalNovaaApp',
      profile: 'minimal',
      preset: 'latest',
      limit: 30,
      filter: {
        operator: 'AND',
        conditions: [
          {
            field: 'country.name',
            value: ['Palestine', 'Israel', 'Syria', 'Lebanon', 'Jordan', 'Iraq', 'Yemen'],
            operator: 'OR',
          },
        ],
      },
      fields: { include: ['name', 'date.created', 'type.name', 'country.name', 'country.location', 'url_alias', 'status'] },
    };

    const res = await axios.post(url, payload, { timeout: 8000 });
    const items = res.data?.data || [];

    const features = items
      .map((item, idx) => {
        const fields = item.fields;
        const countryLoc = fields?.country?.[0]?.location;
        if (!countryLoc) return null;

        const lat = parseFloat(countryLoc.lat);
        const lon = parseFloat(countryLoc.lon);
        if (isNaN(lat) || isNaN(lon)) return null;

        const countryName = fields?.country?.[0]?.name || '';
        let region = countryName;
        if (isInWestBank(lon, lat)) region = 'الضفة الغربية';
        else if (isInGaza(lon, lat)) region = 'قطاع غزة';

        const typeName = fields?.type?.[0]?.name || 'حدث';
        const status = fields?.status || '';

        return {
          type: 'Feature',
          id: `rw_${item.id}`,
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: {
            id: `rw_${item.id}`,
            type: 'humanitarian',
            title: fields.name || 'حدث إنساني',
            description: `النوع: ${typeName} | الحالة: ${status}`,
            url: fields.url_alias ? `https://reliefweb.int${fields.url_alias}` : '',
            source: 'ReliefWeb',
            date: fields?.date?.created || '',
            category: 'حدث إنساني',
            region,
            icon: '🏥',
            color: '#10b981',
          },
        };
      })
      .filter(Boolean);

    cacheSet(cacheKey, features);
    return features;
  } catch (err) {
    console.warn('[RegionalEvents] ReliefWeb fetch failed:', err.message);
    return [];
  }
}

// ─── 5. أحداث اجتماعية محلية — قادمة من قاعدة البيانات المحلية للتطبيق ─────────
async function fetchLocalSocialEvents(pool) {
  if (!pool) return [];
  const cacheKey = 'local_social_events';
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    // جلب المنشورات الحديثة (آخر 7 أيام) في نطاق الضفة الغربية وغزة
    const query = `
      SELECT
        p.id, p.content, p.created_at, p.latitude, p.longitude,
        u.username, u.full_name, u.profile_picture,
        p.category, p.location_name
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE
        p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.created_at >= NOW() - INTERVAL '7 days'
        AND (
          (p.latitude BETWEEN $1 AND $2 AND p.longitude BETWEEN $3 AND $4)
          OR
          (p.latitude BETWEEN $5 AND $6 AND p.longitude BETWEEN $7 AND $8)
        )
      ORDER BY p.created_at DESC
      LIMIT 200
    `;
    const res = await pool.query(query, [
      WEST_BANK_BBOX.minLat, WEST_BANK_BBOX.maxLat,
      WEST_BANK_BBOX.minLon, WEST_BANK_BBOX.maxLon,
      GAZA_BBOX.minLat, GAZA_BBOX.maxLat,
      GAZA_BBOX.minLon, GAZA_BBOX.maxLon,
    ]);

    const features = res.rows.map((row) => {
      const lat = parseFloat(row.latitude);
      const lon = parseFloat(row.longitude);
      let region = 'فلسطين';
      if (isInWestBank(lon, lat)) region = 'الضفة الغربية';
      else if (isInGaza(lon, lat)) region = 'قطاع غزة';

      return {
        type: 'Feature',
        id: `local_${row.id}`,
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          id: `local_${row.id}`,
          type: 'social',
          title: row.content?.substring(0, 80) || 'منشور محلي',
          description: `${row.full_name || row.username} — ${row.location_name || ''}`,
          source: 'PalNovaa Community',
          date: row.created_at,
          category: row.category || 'منشور اجتماعي',
          region,
          username: row.username,
          profile_picture: row.profile_picture,
          icon: '💬',
          color: '#3b82f6',
        },
      };
    });

    cacheSet(cacheKey, features);
    return features;
  } catch (err) {
    console.warn('[RegionalEvents] Local social events fetch failed:', err.message);
    return [];
  }
}

// ─── 6. الدالة الرئيسية — تجميع كل المصادر ─────────────────────────────────────
/**
 * @param {Object} options
 * @param {boolean} options.westBank - تضمين أحداث الضفة الغربية
 * @param {boolean} options.gaza - تضمين أحداث غزة
 * @param {boolean} options.middleEast - تضمين أحداث الشرق الأوسط
 * @param {boolean} options.thermal - تضمين البؤر الحرارية
 * @param {boolean} options.earthquake - تضمين الزلازل
 * @param {boolean} options.humanitarian - تضمين الأحداث الإنسانية
 * @param {boolean} options.social - تضمين الأحداث الاجتماعية المحلية
 * @param {boolean} options.news - تضمين الأخبار
 * @param {Object|null} options.pool - اتصال DB للمنشورات المحلية
 */
async function fetchAllRegionalEvents(options = {}) {
  const {
    westBank = true,
    gaza = true,
    middleEast = false,
    thermal = true,
    earthquake = true,
    humanitarian = true,
    social = true,
    news = false,
    pool = null,
  } = options;

  const promises = [];

  if (thermal)       promises.push(fetchNasaFirms().catch(() => []));
  if (earthquake)    promises.push(fetchEarthquakes().catch(() => []));
  if (humanitarian)  promises.push(fetchReliefWebEvents().catch(() => []));
  if (news)          promises.push(fetchGdeltEvents().catch(() => []));
  if (social)        promises.push(fetchLocalSocialEvents(pool).catch(() => []));

  const results = await Promise.allSettled(promises);
  let allFeatures = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allFeatures = allFeatures.concat(r.value);
    }
  }

  // ─── تصفية حسب النطاق الجغرافي المطلوب ─────────────────────────────────────
  const filtered = allFeatures.filter((f) => {
    const [lon, lat] = f.geometry?.coordinates || [];
    if (!lon || !lat) return false;

    if (westBank && isInWestBank(lon, lat)) return true;
    if (gaza && isInGaza(lon, lat)) return true;
    if (middleEast && isInMiddleEast(lon, lat)) return true;
    return false;
  });

  return {
    type: 'FeatureCollection',
    features: filtered,
    meta: {
      total: filtered.length,
      generatedAt: new Date().toISOString(),
      sources: { thermal, earthquake, humanitarian, news, social },
    },
  };
}

module.exports = {
  fetchAllRegionalEvents,
  fetchNasaFirms,
  fetchEarthquakes,
  fetchReliefWebEvents,
  fetchGdeltEvents,
  fetchLocalSocialEvents,
  reverseGeocode,
  isInWestBank,
  isInGaza,
  isInMiddleEast,
  WEST_BANK_BBOX,
  GAZA_BBOX,
  MIDDLE_EAST_BBOX,
};
