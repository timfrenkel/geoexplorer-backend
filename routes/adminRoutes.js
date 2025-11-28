// backend/routes/adminRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// Liste aller Locations
router.get('/locations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, latitude, longitude, radius_m,
              image_url, category, is_active, created_at, updated_at
       FROM locations
       ORDER BY created_at DESC`
    );
    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Admin get locations error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Admin-Sehenswürdigkeiten.' });
  }
});

// Neue Location
router.post('/locations', async (req, res) => {
  let {
    name,
    description,
    latitude,
    longitude,
    radius_m,
    image_url,
    category,
    is_active
  } = req.body || {};

  if (!name || latitude == null || longitude == null || radius_m == null) {
    return res.status(400).json({
      message: 'Name, Latitude, Longitude und Radius sind Pflichtfelder.'
    });
  }

  const normalizeNumber = (val) => {
    if (typeof val === 'string') {
      return val.replace(',', '.');
    }
    return val;
  };

  latitude = parseFloat(normalizeNumber(latitude));
  longitude = parseFloat(normalizeNumber(longitude));
  radius_m = parseInt(normalizeNumber(radius_m), 10);
  is_active = !!is_active;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius_m)) {
    return res.status(400).json({ message: 'Ungültige Koordinaten oder Radius.' });
  }

  try {
    const insert = await pool.query(
      `INSERT INTO locations
       (name, description, latitude, longitude, radius_m, image_url, category, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        name,
        description || '',
        latitude,
        longitude,
        radius_m,
        image_url || '',
        category || '',
        is_active
      ]
    );

    res.status(201).json({ location: insert.rows[0] });
  } catch (err) {
    console.error('Admin create location error:', err);
    res.status(500).json({ message: 'Fehler beim Anlegen der Sehenswürdigkeit.' });
  }
});

// Location bearbeiten
router.put('/locations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let {
    name,
    description,
    latitude,
    longitude,
    radius_m,
    image_url,
    category,
    is_active
  } = req.body || {};

  if (!name || latitude == null || longitude == null || radius_m == null) {
    return res.status(400).json({
      message: 'Name, Latitude, Longitude und Radius sind Pflichtfelder.'
    });
  }

  const normalizeNumber = (val) => {
    if (typeof val === 'string') {
      return val.replace(',', '.');
    }
    return val;
  };

  latitude = parseFloat(normalizeNumber(latitude));
  longitude = parseFloat(normalizeNumber(longitude));
  radius_m = parseInt(normalizeNumber(radius_m), 10);
  is_active = !!is_active;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius_m)) {
    return res.status(400).json({ message: 'Ungültige Koordinaten oder Radius.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM locations WHERE id = $1',
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'Sehenswürdigkeit nicht gefunden.' });
    }

    const update = await pool.query(
      `UPDATE locations
       SET name=$1, description=$2, latitude=$3, longitude=$4, radius_m=$5,
           image_url=$6, category=$7, is_active=$8, updated_at=NOW()
       WHERE id=$9
       RETURNING *`,
      [
        name,
        description || '',
        latitude,
        longitude,
        radius_m,
        image_url || '',
        category || '',
        is_active,
        id
      ]
    );

    res.json({ location: update.rows[0] });
  } catch (err) {
    console.error('Admin update location error:', err);
    res.status(500).json({ message: 'Fehler beim Bearbeiten der Sehenswürdigkeit.' });
  }
});

// Location deaktivieren
router.delete('/locations/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const existing = await pool.query(
      'SELECT id FROM locations WHERE id = $1',
      [id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: 'Sehenswürdigkeit nicht gefunden.' });
    }

    await pool.query(
      'UPDATE locations SET is_active=false, updated_at=NOW() WHERE id=$1',
      [id]
    );

    res.json({ message: 'Sehenswürdigkeit wurde deaktiviert.' });
  } catch (err) {
    console.error('Admin delete location error:', err);
    res.status(500).json({ message: 'Fehler beim Deaktivieren der Sehenswürdigkeit.' });
  }
});

// Statistik
router.get('/stats/summary', async (req, res) => {
  try {
    const userCountRes = await pool.query('SELECT COUNT(*) AS cnt FROM users');
    const totalCheckinsRes = await pool.query('SELECT COUNT(*) AS cnt FROM checkins');
    const locationStatsRes = await pool.query(
      `SELECT l.id, l.name,
              COUNT(c.id) AS checkins
       FROM locations l
       LEFT JOIN checkins c ON c.location_id = l.id
       GROUP BY l.id
       ORDER BY checkins DESC, l.name ASC`
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
