// backend/routes/locationRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Haversine-Distanz in Metern
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Liste aktiver Sehenswürdigkeiten
router.get('/locations', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, latitude, longitude, radius_m,
              image_url, category
       FROM locations
       WHERE is_active = true
       ORDER BY id`
    );

    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Get locations error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Sehenswürdigkeiten.' });
  }
});

// Check-in MIT message + image_url
router.post('/locations/:id/checkin', authMiddleware, async (req, res) => {
  const locationId = parseInt(req.params.id, 10);
  const { latitude, longitude, message, imageUrl } = req.body || {};

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ message: 'Ungültige Geokoordinaten.' });
  }

  try {
    // Location laden
    const locRes = await pool.query(
      `SELECT id, name, latitude, longitude, radius_m
       FROM locations
       WHERE id = $1 AND is_active = true`,
      [locationId]
    );

    if (locRes.rowCount === 0) {
      return res.status(404).json({ message: 'Sehenswürdigkeit nicht gefunden.' });
    }

    const location = locRes.rows[0];

    // Hat der User hier schon eingecheckt?
    const exists = await pool.query(
      'SELECT id FROM checkins WHERE user_id=$1 AND location_id=$2',
      [req.user.id, locationId]
    );

    if (exists.rowCount > 0) {
      return res.status(400).json({ message: 'Du hast hier bereits eingecheckt.' });
    }

    // Distanz prüfen
    const distance = getDistanceMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance > location.radius_m) {
      return res.status(400).json({
        message: `Zu weit entfernt (${Math.round(distance)}m). Erlaubter Radius: ${location.radius_m}m.`
      });
    }

    // SPEICHERN
    await pool.query(
      `INSERT INTO checkins (user_id, location_id, message, image_url)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, locationId, message || null, imageUrl || null]
    );

    // Punkte zählen
    const totalCheckinsRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = $1',
      [req.user.id]
    );
    const points = parseInt(totalCheckinsRes.rows[0].cnt, 10);

    res.json({
      message: `Erfolgreich bei "${location.name}" eingecheckt!`,
      distance,
      points
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Fehler beim Check-in.' });
  }
});

module.exports = router;
