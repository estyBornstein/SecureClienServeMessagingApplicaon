const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.info('Auth attempt without token', { path: req.path });
    return res.status(401).json({ error: 'נדרש טוקן גישה' });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.info('Invalid token presented', { path: req.path, error: err.message });
    return res.status(403).json({ error: 'טוקן לא תקין או פג תוקף' });
  }
}

module.exports = { authenticateToken };
