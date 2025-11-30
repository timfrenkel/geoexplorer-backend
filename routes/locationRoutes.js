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

// 🔹 Achievement vergeben, falls vorhanden
async function awardAchievement(userId, code) {
  try {
    await pool.query(
      `
      INSERT INTO user_achievements (user_id, achievement_id)
      SELECT $1, a.id
      FROM achievements a
      WHERE a.code = $2
        AND NOT EXISTS (
          SELECT 1
          FROM user_achievements ua
          WHERE ua.user_id = $1
            AND ua.achievement_id = a.id
        )
      `,
      [userId, code]
    );
  } catch (err) {
    console.error('awardAchievement error:', err.message);
  }
}

/**
 * 🔹 Streak in der DB berechnen (nur über CURRENT_DATE)
 * - last_checkin_date & checkin_streak_days liegen in users
 * - Streak-Logik läuft direkt in PostgreSQL, nicht über JS-Dates
 */
async function updateStreak(userId) {
  try {
    const result = await pool.query(
      `
      WITH user_data AS (
        SELECT
          last_checkin_date::date AS last_date,
          COALESCE(checkin_streak_days, 0) AS old_streak
        FROM users
        WHERE id = $1
      ),
      calc AS (
        SELECT
          CASE
            WHEN last_date = CURRENT_DATE THEN old_streak
            WHEN last_date = CURRENT_DATE - INTERVAL '1 day' THEN old_streak + 1
            ELSE 1
          END AS new_streak
        FROM user_data
      )
      UPDATE users
      SET
        last_checkin_date = CURRENT_DATE,
        checkin_streak_days = COALESCE((SELECT new_streak FROM calc), 1)
      WHERE id = $1
      RETURNING checkin_streak_days;
      `,
      [userId]
    );

    if (result.rowCount > 0) {
      return result.rows[0].checkin_streak_days;
    }
    return 1;
  } catch (err) {
    console.error('updateStreak error:', err.message);
    return null;
  }
}

/**
 * 🔹 Missions-Fortschritt nach Check-in updaten
 * Nutzt jetzt sicheren UPSERT mit dem Unique-Index aus gamificationRoutes
 */
async function updateMissionsOnCheckin(userId, totalCheckins, streakDays) {
  try {
    // TOTAL_CHECKINS
    const totalMissionsRes = await pool.query(
      `
      SELECT id, target_value
      FROM missions
      WHERE target_type = 'TOTAL_CHECKINS'
      `
    );

    for (const m of totalMissionsRes.rows) {
      const target = m.target_value || 0;
      const progress = Math.min(totalCheckins, target);

      await pool.query(
        `
        INSERT INTO user_missions (user_id, mission_id, progress_value, completed_at)
        VALUES ($1, $2, $3, CASE WHEN $3 >= $4 THEN NOW() ELSE NULL END)
        ON CONFLICT (user_id, mission_id)
        DO UPDATE SET
          progress_value = EXCLUDED.progress_value,
          completed_at = CASE
            WHEN EXCLUDED.progress_value >= $4 THEN
              COALESCE(user_missions.completed_at, NOW())
            ELSE user_missions.completed_at
          END
        `,
        [userId, m.id, progress, target]
      );
    }

    // STREAK_DAYS
    if (streakDays != null) {
      const streakMissionsRes = await pool.query(
        `
        SELECT id, target_value
        FROM missions
        WHERE target_type = 'STREAK_DAYS'
        `
      );

      for (const m of streakMissionsRes.rows) {
        const target = m.target_value || 0;
        const progress = Math.min(streakDays, target);

        await pool.query(
          `
          INSERT INTO user_missions (user_id, mission_id, progress_value, completed_at)
          VALUES ($1, $2, $3, CASE WHEN $3 >= $4 THEN NOW() ELSE NULL END)
          ON CONFLICT (user_id, mission_id)
          DO UPDATE SET
            progress_value = EXCLUDED.progress_value,
            completed_at = CASE
              WHEN EXCLUDED.progress_value >= $4 THEN
                COALESCE(user_missions.completed_at, NOW())
              ELSE user_missions.completed_at
            END
          `,
          [userId, m.id, progress, target]
        );
      }
    }
  } catch (err) {
    console.error('updateMissionsOnCheckin error:', err.message);
  }
}

// 🔹 Liste aktiver Locations
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
    res
      .status(500)
      .json({ message: 'Fehler beim Laden der Sehenswürdigkeiten.' });
  }
});

// 🔹 Check-in
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
      return res.status(404).json({
        message: 'Sehenswürdigkeit nicht gefunden oder nicht aktiv.'
      });
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

    // Gesamtanzahl Check-ins (= Punkte)
    const totalCheckinsRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM checkins WHERE user_id = $1',
      [req.user.id]
    );
    const totalCheckins = parseInt(totalCheckinsRes.rows[0].cnt, 10);

    // Streak updaten (über CURRENT_DATE)
    const newStreak = await updateStreak(req.user.id);

    // Achievements
    const newlyUnlocked = [];

    if (totalCheckins === 1) {
      await awardAchievement(req.user.id, 'FIRST_CHECKIN');
      newlyUnlocked.push('FIRST_CHECKIN');
    }
    if (totalCheckins === 5) {
      await awardAchievement(req.user.id, 'CHECKINS_5');
      newlyUnlocked.push('CHECKINS_5');
    }
    if (totalCheckins === 10) {
      await awardAchievement(req.user.id, 'CHECKINS_10');
      newlyUnlocked.push('CHECKINS_10');
    }

    if (newStreak === 3) {
      await awardAchievement(req.user.id, 'STREAK_3');
      newlyUnlocked.push('STREAK_3');
    }
    if (newStreak === 7) {
      await awardAchievement(req.user.id, 'STREAK_7');
      newlyUnlocked.push('STREAK_7');
    }

    // Missions-Fortschritt aktualisieren
    await updateMissionsOnCheckin(req.user.id, totalCheckins, newStreak);

    res.json({
      message: `Erfolgreich bei "${location.name}" eingecheckt!`,
      distance,
      points: totalCheckins,
      streakDays: newStreak,
      newAchievements: newlyUnlocked
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Fehler beim Check-in.' });
  }
});

module.exports = router;
