/**
 * Regional Events Route — /api/regional-events
 * تضيف مسار API كامل لخدمة الأحداث الإقليمية (فلسطين + الشرق الأوسط)
 */

const express = require('express');
const router = express.Router();
const { fetchAllRegionalEvents, reverseGeocode } = require('../services/regionalEventsService');
const pool = require('../config/database');

/**
 * GET /api/regional-events
 * Query params:
 *  - westBank (boolean, default true)
 *  - gaza (boolean, default true)
 *  - middleEast (boolean, default false)
 *  - thermal (boolean, default true)
 *  - earthquake (boolean, default true)
 *  - humanitarian (boolean, default true)
 *  - social (boolean, default true)
 *  - news (boolean, default false)
 */
router.get('/', async (req, res) => {
  try {
    const toBool = (val, def = true) => {
      if (val === undefined || val === null) return def;
      if (typeof val === 'boolean') return val;
      return String(val).toLowerCase() !== 'false';
    };

    const options = {
      westBank:    toBool(req.query.westBank, true),
      gaza:        toBool(req.query.gaza, true),
      middleEast:  toBool(req.query.middleEast, false),
      thermal:     toBool(req.query.thermal, true),
      earthquake:  toBool(req.query.earthquake, true),
      humanitarian: toBool(req.query.humanitarian, true),
      social:      toBool(req.query.social, true),
      news:        toBool(req.query.news, false),
      pool,
    };

    const data = await fetchAllRegionalEvents(options);

    res.set('Cache-Control', 'public, max-age=300'); // 5 دقائق cache في المتصفح
    return res.json(data);
  } catch (err) {
    console.error('[regional-events] Error:', err);
    return res.status(500).json({
      error: 'فشل في جلب الأحداث الإقليمية',
      details: err.message,
    });
  }
});

/**
 * GET /api/regional-events/geocode
 * Reverse geocoding — تحويل إحداثيات لاسم قرية/بلدة دقيق
 * Query: lat, lon
 */
router.get('/geocode', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat و lon مطلوبان ويجب أن يكونا أرقاماً صحيحة' });
    }
    const result = await reverseGeocode(lat, lon);
    return res.json(result);
  } catch (err) {
    console.error('[regional-events/geocode] Error:', err);
    return res.status(500).json({ error: 'فشل في الترميز الجغرافي', details: err.message });
  }
});

module.exports = router;
