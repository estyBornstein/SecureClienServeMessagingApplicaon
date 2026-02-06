const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getDatabase } = require('../data');

// GET /api/users/public-keys — returns all users' public keys
router.get('/public-keys', authenticateToken, (req, res, next) => {
  try {
    const db = getDatabase();
    const users = db.getAllUsersWithPublicKeys();

    const keys = users.map((u) => ({
      userId: u.id,
      username: u.username,
      publicKey: u.public_key,
    }));

    res.json({ users: keys });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
