// backend/routes/feedRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Global + Friends Feed
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
        
        l.id AS location_id,
        l.name AS location_name,
        l.image_url AS location_image
        
      FROM checkins c
      JOIN users u ON u.id = c.user_id
      JOIN locations l ON l.id = c.location_id

      WHERE 
        c.user_id = $1
        OR c.user_id IN (
          SELECT friend_id FROM friendships
          WHERE user_id = $1 AND status = 'accepted'
        )
        OR c.user_id IN (
          SELECT user_id FROM friendships
          WHERE friend_id = $1 AND status = 'accepted'
        )

      ORDER BY c.created_at DESC
      LIMIT 200
      `,
      [req.user.id]
    );

    res.json({ feed: result.rows });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ message: 'Fehler beim Laden des Feeds.' });
  }
});

// Nur Freunde
router.get('/feed/friends', authMiddleware, async (req, res) => {
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
        
        l.id AS location_id,
        l.name AS location_name,
        l.image_url AS location_image
        
      FROM checkins c
      JOIN users u ON u.id = c.user_id
      JOIN locations l ON l.id = c.location_id

      WHERE 
        c.user_id IN (
          SELECT friend_id FROM friendships
          WHERE user_id = $1 AND status = 'accepted'
        )
        OR c.user_id IN (
          SELECT user_id FROM friendships
          WHERE friend_id = $1 AND status = 'accepted'
        )

      ORDER BY c.created_at DESC
      LIMIT 200
      `,
      [req.user.id]
    );

    res.json({ feed: result.rows });
  } catch (err) {
    console.error('Feed friends error:', err);
    res.status(500).json({ message: 'Fehler beim Laden des Freunde-Feeds.' });
  }
});

module.exports = router;
