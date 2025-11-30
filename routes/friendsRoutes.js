// backend/routes/friendsRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * GET /friends
 * Liste aller akzeptierten Freunde (beide Richtungen).
 */
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT DISTINCT u.id, u.username
      FROM friendships f
      JOIN users u
        ON (f.friend_id = u.id AND f.user_id = $1)
        OR (f.user_id = u.id AND f.friend_id = $1)
      WHERE f.status = 'accepted'
      ORDER BY u.username ASC
      `,
      [req.user.id]
    );

    res.json({ friends: result.rows });
  } catch (err) {
    console.error('Friend list error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Freundesliste.' });
  }
});

/**
 * GET /friends/search?q=...
 * Suche nach Benutzernamen + Status der Freundschaft/Anfrage relativ zum aktuellen User.
 */
router.get('/friends/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.json({ users: [] });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username,
        f.status
      FROM users u
      LEFT JOIN friendships f
        ON (
              (f.user_id = $2 AND f.friend_id = u.id)
           OR (f.friend_id = $2 AND f.user_id = u.id)
        )
      WHERE u.username ILIKE $1
        AND u.id <> $2
      ORDER BY u.username ASC
      LIMIT 20
      `,
      [`%${q}%`, req.user.id]
    );

    res.json({ users: result.rows });
  } catch (err) {
    console.error('Friend search error:', err);
    res.status(500).json({ message: 'Fehler bei der Freundesuche.' });
  }
});

/**
 * POST /friends/request/:friendId
 * Freundschaftsanfrage senden (status = 'pending')
 */
router.post('/friends/request/:friendId', authMiddleware, async (req, res) => {
  const friendId = parseInt(req.params.friendId, 10);

  if (!Number.isFinite(friendId)) {
    return res.status(400).json({ message: 'Ungültige Benutzer-ID.' });
  }

  if (friendId === req.user.id) {
    return res
      .status(400)
      .json({ message: 'Du kannst dich nicht selbst als Freund hinzufügen.' });
  }

  try {
    // Existiert der User?
    const userRes = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [friendId]
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }

    // Gibt es schon eine Beziehung?
    const existing = await pool.query(
      `
      SELECT id, status, user_id, friend_id
      FROM friendships
      WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)
      `,
      [req.user.id, friendId]
    );

    if (existing.rowCount > 0) {
      const rel = existing.rows[0];
      if (rel.status === 'accepted') {
        return res.status(400).json({ message: 'Ihr seid bereits Freunde.' });
      }
      if (rel.status === 'pending') {
        return res
          .status(400)
          .json({ message: 'Es besteht bereits eine offene Anfrage.' });
      }
    }

    // Neue Anfrage anlegen
    await pool.query(
      `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
      `,
      [req.user.id, friendId]
    );

    res.json({ message: 'Freundschaftsanfrage gesendet.' });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ message: 'Fehler beim Senden der Anfrage.' });
  }
});

/**
 * POST /friends/accept/:friendId
 * Eingehende Freundschaftsanfrage akzeptieren.
 */
router.post('/friends/accept/:friendId', authMiddleware, async (req, res) => {
  const friendId = parseInt(req.params.friendId, 10);

  if (!Number.isFinite(friendId)) {
    return res.status(400).json({ message: 'Ungültige Benutzer-ID.' });
  }

  try {
    const result = await pool.query(
      `
      UPDATE friendships
      SET status = 'accepted'
      WHERE user_id = $1
        AND friend_id = $2
        AND status = 'pending'
      `,
      [friendId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res
        .status(400)
        .json({ message: 'Keine passende Anfrage zum Bestätigen gefunden.' });
    }

    res.json({ message: 'Freundschaft bestätigt.' });
  } catch (err) {
    console.error('Friend accept error:', err);
    res.status(500).json({ message: 'Fehler beim Bestätigen der Freundschaft.' });
  }
});

module.exports = router;
