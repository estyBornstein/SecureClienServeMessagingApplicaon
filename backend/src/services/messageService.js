const { getDatabase } = require('../data');
const logger = require('../utils/logger');
const { POLL_TIMEOUT_MS } = require('../config/constants');

// In-memory map for Long Polling clients: Map<userId, { res, timeout }>
const waitingClients = new Map();

// ── Message Operations (E2E — server never decrypts) ──

function createMessage(senderId, senderUsername, encryptedContent, iv, keys) {
  const db = getDatabase();

  // Store encrypted content as-is (no server-side encryption)
  const message = db.createMessage(senderId, encryptedContent, iv);

  // Create delivery records with per-user encrypted keys
  for (const { userId, encryptedKey } of keys) {
    db.createDeliveryWithKey(message.id, userId, encryptedKey);
  }

  // Mark sender's own delivery as already delivered
  db.markDelivered(message.id, senderId);

  logger.info('Message sent (E2E encrypted)', {
    messageId: message.id,
    senderId,
    senderUsername,
    recipientCount: keys.length,
  });

  const broadcastData = {
    id: message.id,
    senderId,
    senderUsername,
    encryptedContent,
    iv,
    createdAt: message.createdAt,
  };

  // Broadcast to waiting long-poll clients
  broadcastToClientsE2E(broadcastData, keys);

  return {
    id: message.id,
    senderId,
    senderUsername,
    createdAt: message.createdAt,
  };
}

function getMessagesForUser(userId) {
  const db = getDatabase();
  const messages = db.getUndeliveredForUserE2E(userId);

  const result = messages.map((msg) => {
    db.markDelivered(msg.id, userId);
    return {
      id: msg.id,
      senderId: msg.sender_id,
      senderUsername: msg.sender_username,
      encryptedContent: msg.encrypted_content,
      iv: msg.encryption_iv,
      encryptedKey: msg.encrypted_key,
      createdAt: msg.created_at,
    };
  });

  if (result.length > 0) {
    logger.info('E2E messages delivered', { userId, count: result.length });
  }

  return result;
}

function getMessageHistory(userId, page = 1, pageSize = 50) {
  const db = getDatabase();
  const { messages, total } = db.getMessageHistoryForUser(userId, page, pageSize);

  const result = messages.map((msg) => ({
    id: msg.id,
    senderId: msg.sender_id,
    senderUsername: msg.sender_username,
    encryptedContent: msg.encrypted_content,
    iv: msg.encryption_iv,
    encryptedKey: msg.encrypted_key,
    createdAt: msg.created_at,
  }));

  return { messages: result, total, page, pageSize };
}

// ── Long Polling ──

function registerPollingClient(userId, res) {
  // If user already waiting, respond to old connection with empty array
  const existing = waitingClients.get(userId);
  if (existing) {
    clearTimeout(existing.timeout);
    try {
      existing.res.json({ messages: [] });
    } catch (err) {
      // Connection already closed
    }
  }

  const timeout = setTimeout(() => {
    waitingClients.delete(userId);
    try {
      res.json({ messages: [] });
    } catch (err) {
      // Connection already closed
    }
    logger.info('Poll timeout', { userId });
  }, POLL_TIMEOUT_MS);

  waitingClients.set(userId, { res, timeout });

  // Cleanup on client disconnect
  res.on('close', () => {
    const client = waitingClients.get(userId);
    if (client && client.res === res) {
      clearTimeout(client.timeout);
      waitingClients.delete(userId);
    }
  });

  logger.info('Poll registered', { userId, waitingClients: waitingClients.size });
}

function removePollingClient(userId) {
  const client = waitingClients.get(userId);
  if (client) {
    clearTimeout(client.timeout);
    waitingClients.delete(userId);
  }
}

function broadcastToClientsE2E(messageData, keys) {
  const db = getDatabase();
  let delivered = 0;

  // Build a map of userId -> encryptedKey for quick lookup
  const keyMap = new Map();
  for (const { userId, encryptedKey } of keys) {
    keyMap.set(userId, encryptedKey);
  }

  for (const [userId, client] of waitingClients) {
    // Skip sender (they already have the plaintext)
    if (userId === messageData.senderId) continue;

    const userEncryptedKey = keyMap.get(userId);
    if (!userEncryptedKey) continue;

    try {
      clearTimeout(client.timeout);
      client.res.json({
        messages: [
          {
            id: messageData.id,
            senderId: messageData.senderId,
            senderUsername: messageData.senderUsername,
            encryptedContent: messageData.encryptedContent,
            iv: messageData.iv,
            encryptedKey: userEncryptedKey,
            createdAt: messageData.createdAt,
          },
        ],
      });
      waitingClients.delete(userId);
      db.markDelivered(messageData.id, userId);
      delivered++;
    } catch (err) {
      logger.error('Failed to send to polling client', { userId, error: err.message });
      waitingClients.delete(userId);
    }
  }

  if (delivered > 0) {
    logger.info('E2E broadcast sent', { messageId: messageData.id, deliveredTo: delivered });
  }
}

module.exports = {
  createMessage,
  getMessagesForUser,
  getMessageHistory,
  registerPollingClient,
  removePollingClient,
};
