// backend/auth.js
const jwt = require('jsonwebtoken');

function generateToken(user) {
  const payload = {
    id: user.id,
    isAdmin: !!user.is_admin
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', {
    expiresIn: '7d'
  });
}

module.exports = {
  generateToken
};
