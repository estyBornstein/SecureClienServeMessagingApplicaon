const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const messageService = require('../services/messageService');
const { VALIDATION_RULES, ERROR_MESSAGES } = require('../utils/validation');
const { RATE_LIMIT_WINDOW_MS, MESSAGE_RATE_LIMIT } = require('../config/constants');

const messageLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: MESSAGE_RATE_LIMIT,
  message: { error: 'יותר מדי הודעות, אנא האט' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// POST /api/messages/send — Send an E2E encrypted message
router.post('/send', authenticateToken, messageLimiter, async (req, res, next) => {
  try {
    const { encryptedContent, iv, keys } = req.body;

    if (!encryptedContent || !iv || !keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'נדרשים נתוני הודעה מוצפנת (encryptedContent, iv, keys[])' });
    }

    for (const k of keys) {
      if (!k.userId || !k.encryptedKey) {
        return res.status(400).json({ error: 'כל רשומת מפתח חייבת לכלול userId ו-encryptedKey' });
      }
    }

    if (encryptedContent.length > VALIDATION_RULES.message.maxEncryptedLength) {
      return res.status(400).json({ error: ERROR_MESSAGES.message.tooLong });
    }

    const message = messageService.createMessage(
      req.user.userId,
      req.user.username,
      encryptedContent,
      iv,
      keys
    );

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// GET /api/messages/poll — Long Polling for new messages
router.get('/poll', authenticateToken, (req, res, next) => {
  try {
    // First check for any undelivered messages
    const pending = messageService.getMessagesForUser(req.user.userId);
    if (pending.length > 0) {
      return res.json({ messages: pending });
    }

    // No pending messages — hold the connection (Long Polling)
    messageService.registerPollingClient(req.user.userId, res);
  } catch (err) {
    next(err);
  }
});

// GET /api/messages/history — Paginated message history (per-user E2E keys)
router.get('/history', authenticateToken, (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(
      VALIDATION_RULES.pagination.maxPageSize,
      Math.max(1, parseInt(req.query.pageSize) || VALIDATION_RULES.pagination.defaultPageSize)
    );

    const result = messageService.getMessageHistory(req.user.userId, page, pageSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
