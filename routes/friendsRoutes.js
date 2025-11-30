// backend/routes/friendsRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Relation zwischen aktuellem User und anderem User bestimmen
 * (none | friends | pending_outgoing | pending_incoming)
 */
async function getFriendRelation(currentUserId, otherUserId) {
  const res = await pool.query(
    `
    SELECT id, user_id, friend_id, status
    FROM friendships
    WHERE (user_id = $1 AND friend_id = $2)
       OR (user_id = $2 AND friend_id = $1)
    `,
    [currentUserId, otherUserId]
  );

  if (res.rowCount === 0) {
    return { relation: 'none', requestId: null, direction: null };
  }

  const row = res.rows[0];

  if (row.status === 'accepted') {
    return { relation: 'friends', requestId: row.id, direction: 'mutual' };
  }

  if (row.status === 'pending') {
    if (row.user_id === currentUserId) {
      return {
        relation: 'pending_outgoing',
        requestId: row.id,
        direction: 'outgoing'
      };
    }
    if (row.friend_id === currentUserId) {
      return {
        relation: 'pending_incoming',
        requestId: row.id,
        direction: 'incoming'
      };
    }
  }

  return {
    relation: row.status || 'unknown',
    requestId: row.id,
    direction: null
  };
}

// 🔎 Nutzer suchen
router.get('/friends/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();

  if (!q) {
    return res.json({ results: [] });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, username
      FROM users
      WHERE username ILIKE $1
        AND id <> $2
      ORDER BY username ASC
      LIMIT 20
      `,
      [`%${q}%`, req.user.id]
    );

    const users = result.rows;

    const enriched = [];
    for (const u of users) {
      // nacheinander, ist hier ok
      // eslint-disable-next-line no-await-in-loop
      const rel = await getFriendRelation(req.user.id, u.id);
      enriched.push({
        id: u.id,
        username: u.username,
        relation: rel.relation,
        requestId: rel.requestId,
        direction: rel.direction
      });
    }

    res.json({ results: enriched });
  } catch (err) {
    console.error('Friend search error:', err);
    res.status(500).json({ message: 'Fehler bei der Suche.' });
  }
});

// 📩 Freundschaftsanfrage senden
router.post('/friends/requests', authMiddleware, async (req, res) => {
  const { friendId } = req.body || {};
  const currentUserId = req.user.id;

  if (!friendId || friendId === currentUserId) {
    return res.status(400).json({ message: 'Ungültiger Freundes-Target.' });
  }

  try {
    const userRes = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [friendId]
    );
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }

    // Gibt es schon eine Beziehung?
    const relRes = await pool.query(
      `
      SELECT id, user_id, friend_id, status
      FROM friendships
      WHERE (user_id = $1 AND friend_id = $2)
         OR (user_id = $2 AND friend_id = $1)
      `,
      [currentUserId, friendId]
    );

    if (relRes.rowCount > 0) {
      const row = relRes.rows[0];
      if (row.status === 'accepted') {
        return res.status(400).json({ message: 'Ihr seid bereits Freunde.' });
      }
      if (row.status === 'pending') {
        if (row.user_id === currentUserId) {
          return res
            .status(400)
            .json({ message: 'Du hast bereits eine Anfrage gesendet.' });
        }
        if (row.friend_id === currentUserId) {
          return res
            .status(400)
            .json({ message: 'Es existiert bereits eine ausstehende Anfrage.' });
        }
      }
    }

    const insertRes = await pool.query(
      `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING id, user_id, friend_id, status, created_at
      `,
      [currentUserId, friendId]
    );

    const row = insertRes.rows[0];

    res.status(201).json({
      message: 'Freundschaftsanfrage gesendet.',
      request: {
        id: row.id,
        userId: row.user_id,
        friendId: row.friend_id,
        status: row.status,
        createdAt: row.created_at
      }
    });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ message: 'Fehler beim Senden der Anfrage.' });
  }
});

// 📬 Ausstehende Anfragen (eingehend & ausgehend)
router.get('/friends/requests', authMiddleware, async (req, res) => {
  try {
    const incomingRes = await pool.query(
      `
      SELECT
        f.id,
        f.user_id,
        f.friend_id,
        f.status,
        f.created_at,
        u.username
      FROM friendships f
      JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
      [req.user.id]
    );

    const outgoingRes = await pool.query(
      `
      SELECT
        f.id,
        f.user_id,
        f.friend_id,
        f.status,
        f.created_at,
        u.username
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      incoming: incomingRes.rows.map((r) => ({
        id: r.id,
        fromUserId: r.user_id,
        fromUsername: r.username,
        createdAt: r.created_at
      })),
      outgoing: outgoingRes.rows.map((r) => ({
        id: r.id,
        toUserId: r.friend_id,
        toUsername: r.username,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('Friend requests error:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Anfragen.' });
  }
});

// ✅ Anfrage annehmen
router.post('/friends/requests/:id/accept', authMiddleware, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (!requestId) {
    return res.status(400).json({ message: 'Ungültige Anfragen-ID.' });
  }

  try {
    const reqRes = await pool.query(
      `
      SELECT id, user_id, friend_id, status
      FROM friendships
      WHERE id = $1
      `,
      [requestId]
    );

    if (reqRes.rowCount === 0) {
      return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    }

    const row = reqRes.rows[0];

    if (row.friend_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Du kannst diese Anfrage nicht annehmen.' });
    }

    if (row.status !== 'pending') {
      return res
        .status(400)
        .json({ message: 'Diese Anfrage ist nicht mehr ausstehend.' });
    }

    await pool.query(
      `
      UPDATE friendships
      SET status = 'accepted'
      WHERE id = $1
      `,
      [requestId]
    );

    res.json({ message: 'Freundschaftsanfrage angenommen.' });
  } catch (err) {
    console.error('Accept friend request error:', err);
    res.status(500).json({ message: 'Fehler beim Annehmen der Anfrage.' });
  }
});

// ❌ Anfrage ablehnen / zurückziehen
router.post('/friends/requests/:id/reject', authMiddleware, async (req, res) => {
  const requestId = parseInt(req.params.id, 10);
  if (!requestId) {
    return res.status(400).json({ message: 'Ungültige Anfragen-ID.' });
  }

  try {
    const reqRes = await pool.query(
      `
      SELECT id, user_id, friend_id, status
      FROM friendships
      WHERE id = $1
      `,
      [requestId]
    );

    if (reqRes.rowCount === 0) {
      return res.status(404).json({ message: 'Anfrage nicht gefunden.' });
    }

    const row = reqRes.rows[0];

    // Nur Sender oder Empfänger darf ändern
    if (row.user_id !== req.user.id && row.friend_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Du kannst diese Anfrage nicht ändern.' });
    }

    await pool.query('DELETE FROM friendships WHERE id = $1', [requestId]);

    res.json({ message: 'Anfrage abgelehnt/entfernt.' });
  } catch (err) {
    console.error('Reject friend request error:', err);
    res.status(500).json({ message: 'Fehler beim Ändern der Anfrage.' });
  }
});

// 👥 Freundesliste
router.get('/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT DISTINCT
        CASE
          WHEN f.user_id = $1 THEN f.friend_id
          ELSE f.user_id
        END AS friend_id,
        u.username
      FROM friendships f
      JOIN users u
        ON u.id = CASE
                   WHEN f.user_id = $1 THEN f.friend_id
                   ELSE f.user_id
                 END
      WHERE (f.user_id = $1 OR f.friend_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.username ASC
      `,
      [req.user.id]
    );

    res.json({
      friends: result.rows.map((r) => ({
        id: r.friend_id,
        username: r.username
      }))
    });
  } catch (err) {
    console.error('Friend list error:', err);
    res.status(500).json({ message: 'Fehler beim Laden.' });
  }
});

module.exports = router;
