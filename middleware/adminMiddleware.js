// backend/middleware/adminMiddleware.js
function adminMiddleware(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Adminrechte erforderlich.' });
    }
    next();
  }
  
  module.exports = adminMiddleware;
  