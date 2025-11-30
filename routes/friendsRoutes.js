const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Suche
router.get('/friends/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();

  try {
    const result = await pool.query(
      `
      SELECT id, username 
      FROM users
      WHERE username ILIKE $1
      LIMIT 20
      `,
      [`%${q}%`]
    );

    res.json({ users: result.rows });
  } catch (err) {
    console.error('Friend search error:', err);
    res.status(500).json({ message: 'Fehler bei Suche.' });
  }
});

// Anfrage senden
router.post('/friends/request/:id', authMiddleware, async (req, res) => {
  const friendId = parseInt(req.params.id, 10);

  if (friendId === req.user.id) {
    return res.status(400).json({ message: 'Du kannst dich nicht selbst hinzufügen.' });
  }

  try {
    await pool.query(
      `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT DO NOTHING
      `,
      [req.user.id, friendId]
    );

    res.json({ message: 'Anfrage gesendet.' });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ message: 'Fehler beim Senden.' });
  }
});

// Anfrage annehmen
router.post('/friends/accept/:id', authMiddleware, async (req, res) => {
  const friendId = parseInt(req.params.id, 10);

  try {
    await pool.query(
      `
      UPDATE friendships
      SET status = 'accepted'
      WHERE user_id = $1 AND friend_id = $2
      `,
      [friendId, req.user.id]
    );

    res.json({ message: 'Freundschaft bestätigt.' });
  } catch (err) {
    console.error('Friend accept error:', err);
    res.status(500).json({ message: 'Fehler beim Bestätigen.' });
  }
});

// Freunde Liste
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        u.id, u.username
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'accepted'

      UNION

      SELECT 
        u.id, u.username
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = $1 AND f.status = 'accepted'
      `,
      [req.user.id]
    );

    res.json({ friends: result.rows });
  } catch (err) {
    console.error('Friend list error:', err);
    res.status(500).json({ message: 'Fehler beim Laden.' });
  }
});

module.exports = router;
