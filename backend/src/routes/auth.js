const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { registerUser, loginUser } = require('../services/authService');
const { VALIDATION_RULES, ERROR_MESSAGES } = require('../utils/validation');
const { RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT } = require('../config/constants');

const isTest = process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT,
  message: { error: 'יותר מדי ניסיונות התחברות, נסה שוב מאוחר יותר' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

const registerLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: REGISTER_RATE_LIMIT,
  message: { error: 'יותר מדי ניסיונות הרשמה, נסה שוב מאוחר יותר' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
});

router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { username, password, publicKey, encryptedPrivateKey, encryptedPrivateKeyIv } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: ERROR_MESSAGES.username.required });
    }
    if (username.length < VALIDATION_RULES.username.minLength || username.length > VALIDATION_RULES.username.maxLength) {
      return res.status(400).json({ error: ERROR_MESSAGES.username.invalidLength });
    }
    if (password.length < VALIDATION_RULES.password.minLength) {
      return res.status(400).json({ error: ERROR_MESSAGES.password.tooShort });
    }
    if (!publicKey || !encryptedPrivateKey || !encryptedPrivateKeyIv) {
      return res.status(400).json({ error: 'מפתחות הצפנה נדרשים' });
    }

    const result = await registerUser(username, password, publicKey, encryptedPrivateKey, encryptedPrivateKeyIv);
    res.status(201).json({ message: 'User registered successfully', ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'שם משתמש וסיסמה נדרשים' });
    }

    const result = await loginUser(username, password);
    res.json({ message: 'Login successful', ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
