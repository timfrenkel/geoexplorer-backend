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
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Liste aktiver Sehenswürdigkeiten
router.get('/locations', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         name,
         description,
         latitude,
         longitude,
         radius_m,
         image_url,
         category
       FROM locations
       WHERE is_active = true
       ORDER BY id`
    );

    res.json({ locations: result.rows });
  } catch (err) {
    console.error('Get locations error:', err);
    res
      .status(500)
      .json({ message: 'Fehler beim Laden der Sehenswürdigkeiten.' });
  }
});

// Check-in
router.post('/locations/:id/checkin', authMiddleware, async (req, res) => {
  const locationId = parseInt(req.params.id, 10);
  const { latitude, longitude } = req.body || {};

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res
      .status(400)
      .json({ message: 'Ungültige Geokoordinaten für Check-in.' });
  }

  try {
    const locRes = await pool.query(
      `SELECT id, name, latitude, longitude, radius_m
       FROM locations
       WHERE id = $1 AND is_active = true`,
      [locationId]
    );

    if (locRes.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Sehenswürdigkeit nicht gefunden oder nicht aktiv.' });
    }

    const location = locRes.rows[0];

    const existing = await pool.query(
      'SELECT id FROM checkins WHERE user_id = $1 AND location_id = $2',
      [req.user.id, locationId]
    );

    if (existing.rowCount > 0) {
      return res
        .status(400)
        .json({ message: 'Du hast hier bereits eingecheckt.' });
    }

    const distance = getDistanceMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance > location.radius_m) {
      return res.status(400).json({
        message: `Du bist zu weit entfernt (${Math.round(
          distance
        )}m). Erlaubter Radius: ${location.radius_m}m.`
      });
    }

    // Check-in speichern
    await pool.query(
      'INSERT INTO checkins (user_id, location_id) VALUES ($1, $2)',
      [req.user.id, locationId]
    );

    // Gesamtzahl Check-ins als Punkte
    const totalCheckinsRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = $1',
      [req.user.id]
    );
    const totalCheckins = parseInt(totalCheckinsRes.rows[0].cnt, 10);

    // Streak updaten
    const streakRes = await pool.query(
      `
      UPDATE users
      SET
        last_checkin_date = CURRENT_DATE,
        checkin_streak_days =
          CASE
            WHEN last_checkin_date IS NULL THEN 1
            WHEN last_checkin_date = CURRENT_DATE THEN checkin_streak_days
            WHEN last_checkin_date = CURRENT_DATE - INTERVAL '1 day'
              THEN checkin_streak_days + 1
            ELSE 1
          END
      WHERE id = $1
      RETURNING checkin_streak_days
      `,
      [req.user.id]
    );

    const streakDays = streakRes.rows[0]?.checkin_streak_days || 1;

    // Achievement "first_checkin" verleihen (falls noch nicht)
    if (totalCheckins === 1) {
      try {
        let achId;
        const achRes = await pool.query(
          'SELECT id FROM achievements WHERE code = $1',
          ['first_checkin']
        );

        if (achRes.rowCount === 0) {
          const insertAch = await pool.query(
            `
            INSERT INTO achievements (code, name, description, icon)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            `,
            [
              'first_checkin',
              'Erster Check-in',
              'Du hast deinen ersten Ort entdeckt!',
              '🌍'
            ]
          );
          achId = insertAch.rows[0].id;
        } else {
          achId = achRes.rows[0].id;
        }

        await pool.query(
          `
          INSERT INTO user_achievements (user_id, achievement_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, achievement_id) DO NOTHING
          `,
          [req.user.id, achId]
        );
      } catch (achErr) {
        console.error('Achievement first_checkin error:', achErr);
        // Kein Hard-Fail, Check-in bleibt gültig
      }
    }

    res.json({
      message: `Erfolgreich bei "${location.name}" eingecheckt!`,
      distance,
      points: totalCheckins,
      streakDays
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Fehler beim Check-in.' });
  }
});

module.exports = router;
