// backend/routes/adminRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/locations - Liste aller Locations
router.get('/locations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              name,
              description,
              latitude,
              longitude,
              radius_m,
              image_url,
              category,
              is_active,
              created_at,
              updated_at
       FROM locations
       ORDER BY id ASC`
    );

    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Admin get locations error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Sehenswürdigkeiten.' });
  }
});

// POST /api/admin/locations - Neue Location anlegen
router.post('/locations', async (req, res) => {
  const {
    name,
    description,
    latitude,
    longitude,
    radius_m,
    image_url,
    category,
    is_active
  } = req.body || {};

  if (!name || latitude == null || longitude == null) {
    return res.status(400).json({
      message: 'Name, Latitude und Longitude sind erforderlich.'
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const radius = radius_m != null ? Number(radius_m) : 100;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res
      .status(400)
      .json({ message: 'Ungültige Geokoordinaten für die Location.' });
  }

  try {
    const insert = await pool.query(
      `INSERT INTO locations
         (name, description, latitude, longitude, radius_m, image_url, category, is_active, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true), NOW(), NOW())
       RETURNING *`,
      [
        name,
        description || '',
        lat,
        lon,
        radius || 100,
        image_url || '',
        category || '',
        typeof is_active === 'boolean' ? is_active : true
      ]
    );

    res.status(201).json({ location: insert.rows[0] });
  } catch (err) {
    console.error('Admin create location error:', err);
    res.status(500).json({ message: 'Fehler beim Erstellen der Sehenswürdigkeit.' });
  }
});

// PUT /api/admin/locations/:id - Location bearbeiten
router.put('/locations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Ungültige Location-ID.' });
  }

  const {
    name,
    description,
    latitude,
    longitude,
    radius_m,
    image_url,
    category,
    is_active
  } = req.body || {};

  if (!name || latitude == null || longitude == null) {
    return res.status(400).json({
      message: 'Name, Latitude und Longitude sind erforderlich.'
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);
  const radius = radius_m != null ? Number(radius_m) : 100;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res
      .status(400)
      .json({ message: 'Ungültige Geokoordinaten für die Location.' });
  }

  try {
    const update = await pool.query(
      `UPDATE locations
       SET name = $1,
           description = $2,
           latitude = $3,
           longitude = $4,
           radius_m = $5,
           image_url = $6,
           category = $7,
           is_active = COALESCE($8, true),
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        name,
        description || '',
        lat,
        lon,
        radius || 100,
        image_url || '',
        category || '',
        typeof is_active === 'boolean' ? is_active : true,
        id
      ]
    );

    if (update.rowCount === 0) {
      return res.status(404).json({ message: 'Sehenswürdigkeit nicht gefunden.' });
    }

    res.json({ location: update.rows[0] });
  } catch (err) {
    console.error('Admin update location error:', err);
    res.status(500).json({ message: 'Fehler beim Aktualisieren der Sehenswürdigkeit.' });
  }
});

// DELETE /api/admin/locations/:id - Location deaktivieren (Soft Delete)
router.delete('/locations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Ungültige Location-ID.' });
  }

  try {
    const result = await pool.query(
      `UPDATE locations
       SET is_active = false,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Sehenswürdigkeit nicht gefunden.' });
    }

    res.json({ message: 'Sehenswürdigkeit deaktiviert.' });
  } catch (err) {
    console.error('Admin delete location error:', err);
    res.status(500).json({ message: 'Fehler beim Deaktivieren der Sehenswürdigkeit.' });
  }
});

// POST /api/admin/locations/bulk - Bulk-Import vieler Locations
router.post('/locations/bulk', async (req, res) => {
  const { locations } = req.body || {};

  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({
      message: 'Keine Locations zum Import vorhanden.',
      inserted: 0,
      errors: ['Leere oder ungültige Liste.']
    });
  }

  const errors = [];
  let inserted = 0;

  for (let index = 0; index < locations.length; index += 1) {
    const raw = locations[index] || {};
    const {
      name,
      description,
      latitude,
      longitude,
      radius_m,
      image_url,
      category,
      is_active
    } = raw;

    if (!name || latitude == null || longitude == null) {
      errors.push(`Zeile ${index + 1}: Name, Latitude und Longitude erforderlich.`);
      continue;
    }

    const lat = Number(latitude);
    const lon = Number(longitude);
    const radius = radius_m != null ? Number(radius_m) : 100;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      errors.push(`Zeile ${index + 1}: Ungültige Geokoordinaten.`);
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO locations
           (name, description, latitude, longitude, radius_m, image_url, category, is_active, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true), NOW(), NOW())`,
        [
          name,
          description || '',
          lat,
          lon,
          radius || 100,
          image_url || '',
          category || '',
          typeof is_active === 'boolean' ? is_active : true
        ]
      );
      inserted += 1;
    } catch (err) {
      console.error(`Bulk insert error (Zeile ${index + 1}):`, err);
      errors.push(`Zeile ${index + 1}: Datenbankfehler (${err.code || err.message}).`);
    }
  }

  res.json({
    message: 'Bulk-Import abgeschlossen.',
    inserted,
    errors
  });
});

// GET /api/admin/stats/summary - einfache Statistiken für AdminStats
router.get('/stats/summary', async (req, res) => {
  try {
    const userCountRes = await pool.query('SELECT COUNT(*) AS cnt FROM users');
    const totalCheckinsRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM checkins'
    );

    const locationStatsRes = await pool.query(
      `
      SELECT
        l.id,
        l.name,
        COUNT(c.id) AS checkins
      FROM locations l
      LEFT JOIN checkins c ON c.location_id = l.id
      GROUP BY l.id
      ORDER BY checkins DESC, l.name ASC
      `
    );

    res.json({
      userCount: parseInt(userCountRes.rows[0].cnt, 10),
      totalCheckins: parseInt(totalCheckinsRes.rows[0].cnt, 10),
      locations: locationStatsRes.rows
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Statistiken.' });
  }
});

module.exports = router;
