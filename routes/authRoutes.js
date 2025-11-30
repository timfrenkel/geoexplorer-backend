const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function generateToken(user) {
  const payload = {
    id: user.id,
    isAdmin: user.is_admin
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: '7d'
  });
}

// Registrierung
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body || {};

  if (!email || !username || !password) {
    return res.status(400).json({ message: 'Email, Benutzername und Passwort sind erforderlich.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing.rowCount > 0) {
      return res.status(400).json({ message: 'Email oder Benutzername bereits vergeben.' });
    }

    const hash = bcrypt.hashSync(password, 10);

    const insert = await pool.query(
      'INSERT INTO users (email, username, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, username, is_admin',
      [email, username, hash, false]
    );

    const user = insert.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Serverfehler bei der Registrierung.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { emailOrUsername, password } = req.body || {};

  if (!emailOrUsername || !password) {
    return res.status(400).json({ message: 'Login-Daten unvollständig.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, username, password_hash, is_admin FROM users WHERE email = $1 OR username = $1',
      [emailOrUsername]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'Ungültige Login-Daten.' });
    }

    const user = result.rows[0];
    const valid = bcrypt.compareSync(password, user.password_hash);

    if (!valid) {
      return res.status(400).json({ message: 'Ungültige Login-Daten.' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Serverfehler beim Login.' });
  }
});

// /me – Profil + Badges erweitert
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT id, email, username, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden.' });
    }

    const user = userRes.rows[0];

    const checkinsRes = await pool.query(
      `SELECT 
         c.id,
         c.created_at,
         c.message,
         c.image_url,
         l.id AS location_id,
         l.name,
         l.description,
         l.category
       FROM checkins c
       JOIN locations l ON c.location_id = l.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    const badges = checkinsRes.rows;
    const points = badges.length;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin,
        createdAt: user.created_at
      },
      points,
      badges
    });
  } catch (err) {
    console.error('/me error:', err);
    res.status(500).json({ message: 'Fehler beim Laden des Profils.' });
  }
});

module.exports = router;
