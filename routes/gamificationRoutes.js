// backend/routes/gamificationRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Übersicht: Missions + Achievements für den eingeloggten User
router.get('/gamification/overview', authMiddleware, async (req, res) => {
  try {
    const missionsRes = await pool.query(
      `
      SELECT
        m.id,
        m.code,
        m.name,
        m.description,
        m.target_type,
        m.target_value,
        m.is_repeatable,
        m.is_active,
        COALESCE(um.progress_value, 0) AS progress_value,
        (um.completed_at IS NOT NULL) AS is_completed,
        um.completed_at
      FROM missions m
      LEFT JOIN user_missions um
        ON um.mission_id = m.id
       AND um.user_id = $1
      WHERE m.is_active = TRUE
      ORDER BY m.id
      `,
      [req.user.id]
    );

    const achievementsRes = await pool.query(
      `
      SELECT
        a.id,
        a.code,
        a.name,
        a.description,
        a.icon,
        ua.unlocked_at
      FROM achievements a
      JOIN user_achievements ua
        ON ua.achievement_id = a.id
      WHERE ua.user_id = $1
      ORDER BY ua.unlocked_at DESC
      `,
      [req.user.id]
    );

    res.json({
      missions: missionsRes.rows,
      achievements: achievementsRes.rows
    });
  } catch (err) {
    console.error('Gamification overview error:', err);
    res
      .status(500)
      .json({ message: 'Fehler beim Laden der Gamification-Daten.' });
  }
});

module.exports = router;
