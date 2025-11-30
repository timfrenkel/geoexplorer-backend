// backend/routes/gamificationRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Stellt sicher, dass alle benötigten Tabellen existieren (PostgreSQL)
 * UND dass user_missions einen Unique-Index auf (user_id, mission_id) hat.
 */
async function ensureGamificationSchema() {
  // achievements
  await pool.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // user_achievements
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      unlocked_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (achievement_id) REFERENCES achievements(id)
    );
  `);

  // missions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS missions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      target_type TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // user_missions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_missions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      mission_id INTEGER NOT NULL,
      progress_value INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (mission_id) REFERENCES missions(id)
    );
  `);

  // 🔹 WICHTIG: Unique-Index auf (user_id, mission_id), damit ON CONFLICT funktioniert
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'user_missions_user_id_mission_id_key'
      ) THEN
        CREATE UNIQUE INDEX user_missions_user_id_mission_id_key
          ON user_missions (user_id, mission_id);
      END IF;
    END
    $$;
  `);
}

/**
 * Legt Standard-Achievements und -Missions an, falls sie noch nicht existieren.
 */
async function seedGamificationDefaults() {
  await pool.query(`
    INSERT INTO achievements (code, name, description, icon)
    VALUES
      ('FIRST_CHECKIN', 'Erster Check-in', 'Du hast deinen ersten Ort besucht.', '✨'),
      ('CHECKINS_5',    '5 Orte besucht', 'Du hast an 5 verschiedenen Orten eingecheckt.', '🖐️'),
      ('CHECKINS_10',   '10 Orte besucht', 'Du bist richtig unterwegs – 10 Check-ins!', '🔟'),
      ('STREAK_3',      '3-Tage-Streak', 'Du warst 3 Tage in Folge aktiv.', '🔥'),
      ('STREAK_7',      '7-Tage-Streak', 'Eine ganze Woche ohne Pause unterwegs!', '🔥')
    ON CONFLICT (code) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO missions (code, name, description, target_type, target_value)
    VALUES
      ('MISSION_TOTAL_5',  '5 Orte entdecken',  'Mache insgesamt 5 Check-ins.', 'TOTAL_CHECKINS', 5),
      ('MISSION_TOTAL_10', '10 Orte entdecken', 'Mache insgesamt 10 Check-ins.', 'TOTAL_CHECKINS', 10),
      ('MISSION_STREAK_3', '3 Tage in Folge',   'Halte eine 3-tägige Check-in-Streak.', 'STREAK_DAYS', 3)
    ON CONFLICT (code) DO NOTHING;
  `);
}

/**
 * GET /api/gamification/overview
 * - Missions (mit Fortschritt)
 * - freigeschaltete Achievements
 */
router.get('/overview', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    await ensureGamificationSchema();
    await seedGamificationDefaults();

    const missionsRes = await pool.query(
      `
      SELECT
        m.id,
        m.code,
        m.name,
        m.description,
        m.target_type,
        m.target_value,
        COALESCE(um.progress_value, 0) AS progress_value,
        (um.completed_at IS NOT NULL)  AS is_completed,
        um.completed_at
      FROM missions m
      LEFT JOIN user_missions um
        ON um.mission_id = m.id
       AND um.user_id = $1
      ORDER BY m.id
      `,
      [userId]
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
      [userId]
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
