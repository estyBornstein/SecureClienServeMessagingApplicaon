const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../data');
const jwtConfig = require('../config/jwt');
const { SALT_ROUNDS } = require('../config/constants');
const logger = require('../utils/logger');

async function registerUser(username, password, publicKey, encryptedPrivateKey, encryptedPrivateKeyIv) {
  const db = getDatabase();

  const existing = db.findUserByUsername(username);
  if (existing) {
    const err = new Error('Username already exists');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = db.createUser(username, passwordHash);

  // Store client-provided RSA public key
  db.updateUserPublicKey(user.id, publicKey);

  // Store encrypted private key backup (encrypted by client with password-derived key)
  db.updateUserEncryptedPrivateKey(user.id, encryptedPrivateKey, encryptedPrivateKeyIv);

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiration, algorithm: jwtConfig.algorithm }
  );

  logger.info('User registered', { userId: user.id, username });
  return {
    token,
    user: { id: user.id, username: user.username },
  };
}

async function loginUser(username, password) {
  const db = getDatabase();

  const user = db.findUserByUsername(username);
  if (!user) {
    logger.info('Login attempt for non-existent user', { username });
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    logger.info('Failed login attempt', { username });
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiration, algorithm: jwtConfig.algorithm }
  );

  logger.info('User logged in', { userId: user.id, username });

  return {
    token,
    user: { id: user.id, username: user.username },
    encryptedPrivateKey: user.encrypted_private_key || null,
    encryptedPrivateKeyIv: user.encrypted_private_key_iv || null,
  };
}

module.exports = { registerUser, loginUser };
