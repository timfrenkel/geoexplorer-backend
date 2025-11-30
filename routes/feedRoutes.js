// backend/routes/feedRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.created_at,
        c.message,
        c.image_url,

        u.id AS user_id,
        u.username,
        u.profile_image_url,
        u.mood_emoji,
        u.custom_status,
        u.home_city,
        u.home_country,

        l.id          AS location_id,
        l.name        AS location_name,
        l.image_url   AS location_image,
        l.category    AS location_category

      FROM checkins c
      JOIN users u ON u.id = c.user_id
      JOIN locations l ON l.id = c.location_id

      WHERE
        (
          -- eigene Check-ins
          c.user_id = $1
          OR
          -- Check-ins von Freunden
          c.user_id IN (
            SELECT DISTINCT
              CASE
                WHEN f.user_id = $1 THEN f.friend_id
                ELSE f.user_id
              END AS friend_id
            FROM friendships f
            WHERE (f.user_id = $1 OR f.friend_id = $1)
              AND f.status = 'accepted'
          )
        )
        AND (
          c.user_id = $1
          OR u.is_feed_public = TRUE
        )

      ORDER BY c.created_at DESC
      LIMIT 200
      `,
      [req.user.id]
    );

    res.json({ feed: result.rows });
  } catch (err) {
    console.error('Feed error:', err);
    res
      .status(500)
      .json({ message: 'Fehler beim Laden des Feeds.' });
  }
});

module.exports = router;
