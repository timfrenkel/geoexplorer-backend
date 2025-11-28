// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const pool = require('../db');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: 'Nicht autorisiert (kein Token vorhanden).' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');

    const result = await pool.query(
      'SELECT id, email, username, is_admin FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Benutzer nicht gefunden.' });
    }

    const user = result.rows[0];

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: user.is_admin
    };

    next();
  } catch (err) {
    console.error('authMiddleware error:', err);
    return res.status(401).json({ message: 'Ungültiger oder abgelaufener Token.' });
  }
}

module.exports = authMiddleware;
