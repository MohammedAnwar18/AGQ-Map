'use strict';

const pool = require('../config/database');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RETURNING_FIELDS = `
  id,
  latitude::float8  AS latitude,
  longitude::float8 AS longitude,
  title,
  content,
  subtitle,
  shape,
  bearing,
  pitch,
  type,
  model_url,
  image_url,
  trigger_radius,
  fov_angle,
  scale_x,
  scale_y,
  scale_z,
  elevation,
  era_year,
  tags,
  created_at,
  owner_id
`.trim();

async function isAdmin(userId) {
  if (!userId) return false;
  const { rows } = await pool.query(
    'SELECT role FROM users WHERE id = $1',
    [userId]
  );
  return rows[0]?.role === 'admin';
}

function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

// ---------------------------------------------------------------------------
// GET /api/ar/nearby  (also mounted at GET /api/ar/)
// Query params: lat, lng, radius (default 500, max 10 000), type
// ---------------------------------------------------------------------------
async function getNearbyARContents(req, res) {
  try {
    const lat    = parseFloat(req.query.lat);
    const lng    = parseFloat(req.query.lng);
    const radius = Math.min(parseFloat(req.query.radius) || 500, 10000);
    const type   = req.query.type || null; // 'building' | 'story' | 'nav_point' | null

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required' });
    }

    // Haversine distance in metres
    const distanceExpr = `
      6371000 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
          + sin(radians($1)) * sin(radians(latitude))
        ))
      )
    `;

    const params = [lat, lng, radius];
    let typeClause = '';
    if (type) {
      params.push(type);
      typeClause = `AND type = $${params.length}`;
    }

    const sql = `
      SELECT
        ${RETURNING_FIELDS},
        ROUND((${distanceExpr})::numeric, 2) AS distance_meters
      FROM ar_contents
      WHERE (${distanceExpr}) <= $3
        ${typeClause}
      ORDER BY distance_meters ASC
      LIMIT 150
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ contents: rows, count: rows.length });
  } catch (err) {
    console.error('[getNearbyARContents]', err);
    return res.status(500).json({ error: 'Failed to fetch nearby AR contents' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ar/  — legacy, backward-compatible (type = 'story')
// ---------------------------------------------------------------------------
async function createARContent(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      latitude, longitude, title, content, subtitle,
      shape, bearing, pitch,
      image_url, era_year, trigger_radius, fov_angle, tags,
    } = req.body;

    if (!latitude || !longitude || !title) {
      return res.status(400).json({ error: 'latitude, longitude and title are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ar_contents
         (latitude, longitude, title, content, subtitle,
          shape, bearing, pitch,
          type, image_url, era_year, trigger_radius, fov_angle, tags, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'story',$9,$10,$11,$12,$13,$14)
       RETURNING ${RETURNING_FIELDS}`,
      [
        latitude, longitude, title, content || null, subtitle || null,
        shape || 'panel', bearing || 0, pitch || 0,
        image_url || null, era_year || null,
        trigger_radius || 50, fov_angle || 25,
        tags || null, userId,
      ]
    );

    return res.status(201).json({ content: rows[0] });
  } catch (err) {
    console.error('[createARContent]', err);
    return res.status(500).json({ error: 'Failed to create AR content' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ar/building  — historical buildings
// ---------------------------------------------------------------------------
async function createBuilding(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      latitude, longitude, title, content, subtitle,
      bearing, pitch, elevation,
      scale_x, scale_y, scale_z,
      era_year, model_url, image_url,
      trigger_radius, fov_angle, tags,
    } = req.body;

    if (!latitude || !longitude || !title) {
      return res.status(400).json({ error: 'latitude, longitude and title are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ar_contents
         (latitude, longitude, title, content, subtitle,
          shape, bearing, pitch, elevation,
          scale_x, scale_y, scale_z,
          type, era_year, model_url, image_url,
          trigger_radius, fov_angle, tags, owner_id)
       VALUES ($1,$2,$3,$4,$5,'building',$6,$7,$8,$9,$10,$11,'building',$12,$13,$14,$15,$16,$17,$18)
       RETURNING ${RETURNING_FIELDS}`,
      [
        latitude, longitude, title, content || null, subtitle || null,
        bearing || 0, pitch || 0, elevation || 0,
        scale_x || 1, scale_y || 1, scale_z || 1,
        era_year || null, model_url || null, image_url || null,
        trigger_radius || 50, fov_angle || 25,
        tags || null, userId,
      ]
    );

    return res.status(201).json({ content: rows[0] });
  } catch (err) {
    console.error('[createBuilding]', err);
    return res.status(500).json({ error: 'Failed to create building AR content' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ar/story  — spatial stories
// ---------------------------------------------------------------------------
async function createStory(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      latitude, longitude, title, content, subtitle,
      bearing, image_url, era_year,
      trigger_radius, fov_angle, tags,
    } = req.body;

    if (!latitude || !longitude || !title) {
      return res.status(400).json({ error: 'latitude, longitude and title are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ar_contents
         (latitude, longitude, title, content, subtitle,
          shape, bearing,
          type, image_url, era_year,
          trigger_radius, fov_angle, tags, owner_id)
       VALUES ($1,$2,$3,$4,$5,'panel',$6,'story',$7,$8,$9,$10,$11,$12)
       RETURNING ${RETURNING_FIELDS}`,
      [
        latitude, longitude, title, content || null, subtitle || null,
        bearing || 0,
        image_url || null, era_year || null,
        trigger_radius || 50, fov_angle || 25,
        tags || null, userId,
      ]
    );

    return res.status(201).json({ content: rows[0] });
  } catch (err) {
    console.error('[createStory]', err);
    return res.status(500).json({ error: 'Failed to create story AR content' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ar/nav-point  — navigation points
// ---------------------------------------------------------------------------
async function createNavPoint(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      latitude, longitude, title, content,
      trigger_radius, tags,
    } = req.body;

    if (!latitude || !longitude || !title) {
      return res.status(400).json({ error: 'latitude, longitude and title are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO ar_contents
         (latitude, longitude, title, content,
          shape, bearing,
          type, trigger_radius, tags, owner_id)
       VALUES ($1,$2,$3,$4,'arrow',0,'nav_point',$5,$6,$7)
       RETURNING ${RETURNING_FIELDS}`,
      [
        latitude, longitude, title, content || null,
        trigger_radius || 50, tags || null, userId,
      ]
    );

    return res.status(201).json({ content: rows[0] });
  } catch (err) {
    console.error('[createNavPoint]', err);
    return res.status(500).json({ error: 'Failed to create nav_point AR content' });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/ar/:id  — update any field (admin only)
// ---------------------------------------------------------------------------
async function updateARContent(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Verify the record exists
    const existing = await pool.query('SELECT id FROM ar_contents WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'AR content not found' });
    }

    const {
      latitude, longitude, title, content, subtitle,
      shape, bearing, pitch, elevation,
      type, model_url, image_url,
      trigger_radius, fov_angle,
      scale_x, scale_y, scale_z,
      era_year, tags,
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE ar_contents SET
         latitude      = COALESCE($1,  latitude),
         longitude     = COALESCE($2,  longitude),
         title         = COALESCE($3,  title),
         content       = COALESCE($4,  content),
         subtitle      = COALESCE($5,  subtitle),
         shape         = COALESCE($6,  shape),
         bearing       = COALESCE($7,  bearing),
         pitch         = COALESCE($8,  pitch),
         elevation     = COALESCE($9,  elevation),
         type          = COALESCE($10, type),
         model_url     = COALESCE($11, model_url),
         image_url     = COALESCE($12, image_url),
         trigger_radius= COALESCE($13, trigger_radius),
         fov_angle     = COALESCE($14, fov_angle),
         scale_x       = COALESCE($15, scale_x),
         scale_y       = COALESCE($16, scale_y),
         scale_z       = COALESCE($17, scale_z),
         era_year      = COALESCE($18, era_year),
         tags          = COALESCE($19, tags)
       WHERE id = $20
       RETURNING ${RETURNING_FIELDS}`,
      [
        latitude    != null ? latitude    : null,
        longitude   != null ? longitude   : null,
        title       != null ? title       : null,
        content     != null ? content     : null,
        subtitle    != null ? subtitle    : null,
        shape       != null ? shape       : null,
        bearing     != null ? bearing     : null,
        pitch       != null ? pitch       : null,
        elevation   != null ? elevation   : null,
        type        != null ? type        : null,
        model_url   != null ? model_url   : null,
        image_url   != null ? image_url   : null,
        trigger_radius != null ? trigger_radius : null,
        fov_angle   != null ? fov_angle   : null,
        scale_x     != null ? scale_x     : null,
        scale_y     != null ? scale_y     : null,
        scale_z     != null ? scale_z     : null,
        era_year    != null ? era_year    : null,
        tags        != null ? tags        : null,
        id,
      ]
    );

    return res.json({ content: rows[0] });
  } catch (err) {
    console.error('[updateARContent]', err);
    return res.status(500).json({ error: 'Failed to update AR content' });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/ar/:id  (admin only)
// ---------------------------------------------------------------------------
async function deleteARContent(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM ar_contents WHERE id = $1', [id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'AR content not found' });
    }

    return res.json({ message: 'AR content deleted successfully', id });
  } catch (err) {
    console.error('[deleteARContent]', err);
    return res.status(500).json({ error: 'Failed to delete AR content' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ar/stats  (admin only)
// ---------------------------------------------------------------------------
async function getARStats(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE type = 'building')        AS buildings,
        COUNT(*) FILTER (WHERE type = 'story')           AS stories,
        COUNT(*) FILTER (WHERE type = 'nav_point')       AS nav_points,
        COUNT(*) FILTER (WHERE type = 'photo_marker')    AS photo_markers
      FROM ar_contents
    `);

    const stats = rows[0];
    return res.json({
      total:      parseInt(stats.total,      10),
      buildings:  parseInt(stats.buildings,  10),
      stories:    parseInt(stats.stories,    10),
      nav_points: parseInt(stats.nav_points, 10),
      photo_markers: parseInt(stats.photo_markers, 10),
    });
  } catch (err) {
    console.error('[getARStats]', err);
    return res.status(500).json({ error: 'Failed to fetch AR stats' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ar/all  (admin only) — returns every record for management UI
// ---------------------------------------------------------------------------
async function getAllARContents(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { rows } = await pool.query(
      `SELECT ${RETURNING_FIELDS}
       FROM ar_contents
       ORDER BY created_at DESC`
    );

    return res.json({ contents: rows, count: rows.length });
  } catch (err) {
    console.error('[getAllARContents]', err);
    return res.status(500).json({ error: 'Failed to fetch all AR contents' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ar/photo-marker — Admin captures photo + GPS + title/desc
// ---------------------------------------------------------------------------
async function createPhotoMarker(req, res) {
  try {
    const userId = getUserId(req);
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { title, content, latitude, longitude, bearing } = req.body;

    if (!latitude || !longitude || !title) {
      return res.status(400).json({ error: 'latitude, longitude and title are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file (photo) is required' });
    }

    // Upload to Cloudflare R2
    const { uploadToCloud } = require('../utils/storage');
    const imageUrl = await uploadToCloud(req.file.buffer, req.file.originalname, req.file.mimetype);

    const { rows } = await pool.query(
      `INSERT INTO ar_contents
         (latitude, longitude, title, content,
          type, image_url, bearing, owner_id)
       VALUES ($1, $2, $3, $4, 'photo_marker', $5, $6, $7)
       RETURNING ${RETURNING_FIELDS}`,
      [
        parseFloat(latitude),
        parseFloat(longitude),
        title,
        content || null,
        imageUrl,
        bearing ? parseFloat(bearing) : 0,
        userId,
      ]
    );

    return res.status(201).json({ content: rows[0] });
  } catch (err) {
    console.error('[createPhotoMarker]', err);
    return res.status(500).json({ error: 'Failed to create photo marker AR content', details: err.message });
  }
}

// ---------------------------------------------------------------------------
// GET /api/ar/:id — Get details of a single marker by ID (used by QR scanner)
// ---------------------------------------------------------------------------
async function getARContentById(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT ${RETURNING_FIELDS} FROM ar_contents WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'المعلم غير موجود' });
    }

    return res.json({ content: rows[0] });
  } catch (err) {
    console.error('[getARContentById]', err);
    return res.status(500).json({ error: 'Failed to fetch AR content details' });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  getNearbyARContents,
  createARContent,
  createBuilding,
  createStory,
  createNavPoint,
  updateARContent,
  deleteARContent,
  getARStats,
  getAllARContents,
  createPhotoMarker,
  getARContentById,
};
