require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { initializeDatabase, getDatabase, closeDatabase } = require('./data');
const { SALT_ROUNDS, PBKDF2_ITERATIONS } = require('./config/constants');
const logger = require('./utils/logger');

const USERS = [
  { username: 'alice', password: 'Test@123' },
  { username: 'bob', password: 'Test@123' },
  { username: 'charlie', password: 'Test@123' },
  { username: 'diana', password: 'Test@123' },
  { username: 'eve', password: 'Test@123' },
];

const MESSAGES = [
  { senderIndex: 0, content: 'Hey everyone! Welcome to the secure chat.' },
  { senderIndex: 1, content: 'Hi Alice! Great to be here.' },
  { senderIndex: 2, content: 'This encryption is impressive!' },
  { senderIndex: 3, content: 'I agree, the security features are solid.' },
  { senderIndex: 4, content: 'Hello from Eve! Nice to meet you all.' },
  { senderIndex: 0, content: 'How is everyone doing today?' },
  { senderIndex: 1, content: 'Doing great! Working on some new features.' },
  { senderIndex: 2, content: 'Just finished reviewing the security audit.' },
  { senderIndex: 3, content: 'The long polling works really smoothly.' },
  { senderIndex: 4, content: 'I love how messages are end-to-end encrypted.' },
  { senderIndex: 0, content: 'Remember, all passwords are hashed with bcrypt!' },
  { senderIndex: 1, content: 'And messages use hybrid RSA+AES encryption.' },
  { senderIndex: 2, content: 'The database adapter pattern is very clean.' },
  { senderIndex: 3, content: 'Makes it easy to switch databases later.' },
  { senderIndex: 4, content: 'Great architecture decisions all around!' },
];

// ── Crypto helpers (simulating client-side encryption in Node.js) ──

function encryptPrivateKeyWithPassword(privateKeyPem, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(privateKeyPem, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encryptedPrivateKey: encrypted,
    iv: `${salt.toString('hex')}:${iv.toString('hex')}`,
  };
}

function aesEncrypt(text, aesKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

function rsaEncryptKey(publicKeyPem, aesKeyBuffer) {
  return crypto
    .publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKeyBuffer
    )
    .toString('base64');
}

async function seed() {
  initializeDatabase();
  const db = getDatabase();

  logger.info('Starting database seed (E2E encryption)...');

  // Create users with RSA key pairs
  const userData = [];
  for (const u of USERS) {
    const existing = db.findUserByUsername(u.username);
    if (existing) {
      userData.push({
        id: existing.id,
        username: u.username,
        publicKey: existing.public_key,
        privateKey: null,
      });
      logger.info(`User "${u.username}" already exists, skipping`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, SALT_ROUNDS);
    const user = db.createUser(u.username, hash);

    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    db.updateUserPublicKey(user.id, publicKey);

    // Encrypt private key with password and store
    const { encryptedPrivateKey, iv } = encryptPrivateKeyWithPassword(privateKey, u.password);
    db.updateUserEncryptedPrivateKey(user.id, encryptedPrivateKey, iv);

    userData.push({ id: user.id, username: u.username, publicKey, privateKey });
    logger.info(`Created user: ${u.username} (ID: ${user.id})`);
  }

  logger.info(`${USERS.length} users processed`);

  // Only seed messages if we have private keys (fresh seed)
  const usersWithKeys = userData.filter((u) => u.privateKey !== null);
  if (usersWithKeys.length < USERS.length) {
    logger.info('Skipping message seeding (some users existed without known keys)');
    closeDatabase();
    return;
  }

  // Create E2E encrypted messages
  let messageCount = 0;
  for (const msg of MESSAGES) {
    const sender = userData[msg.senderIndex];

    // Generate random AES-256 key
    const aesKey = crypto.randomBytes(32);

    // Encrypt message content with AES
    const { encrypted, iv } = aesEncrypt(msg.content, aesKey);

    // Store encrypted message
    const message = db.createMessage(sender.id, encrypted, iv);

    // Encrypt AES key for each user (including sender) with their RSA public key
    for (const recipient of userData) {
      const encryptedKey = rsaEncryptKey(recipient.publicKey, aesKey);
      db.createDeliveryWithKey(message.id, recipient.id, encryptedKey);
      db.markDelivered(message.id, recipient.id);
    }

    messageCount++;
  }

  logger.info(`${messageCount} E2E encrypted messages created`);
  logger.info('Seed completed successfully!');
  logger.info('Login credentials: username/Test@123 (alice, bob, charlie, diana, eve)');

  closeDatabase();
}

seed().catch((err) => {
  logger.error('Seed failed:', { error: err.message });
  process.exit(1);
});
