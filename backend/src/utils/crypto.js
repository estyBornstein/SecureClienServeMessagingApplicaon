/**
 * Cryptographic utilities for server-side encryption operations.
 * Uses AES-256-CBC for symmetric encryption and RSA-2048 for key pair generation.
 * @module utils/crypto
 */

const crypto = require('crypto');

// ── AES-256-CBC Encryption ──

/** @constant {string} AES encryption algorithm */
const AES_ALGORITHM = 'aes-256-cbc';

/** @constant {number} Initialization vector length in bytes */
const IV_LENGTH = 16;

/**
 * Derives a 256-bit AES key from the ENCRYPTION_KEY environment variable.
 * Uses SHA-256 hash to ensure consistent key length.
 * @private
 * @returns {Buffer} 32-byte AES key
 * @throws {Error} If ENCRYPTION_KEY environment variable is not set
 */
function getAESKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
  }
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypts plaintext using AES-256-CBC with a random IV.
 * Used for encrypting data at rest in the database.
 * @param {string} text - The plaintext to encrypt
 * @returns {{encrypted: string, iv: string}} Object containing hex-encoded ciphertext and IV
 * @example
 * const { encrypted, iv } = encrypt('Hello, World!');
 * // encrypted: 'a1b2c3d4e5f6...' (hex string)
 * // iv: '1234567890abcdef...' (hex string, 32 chars)
 */
function encrypt(text) {
  const key = getAESKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { encrypted, iv: iv.toString('hex') };
}

/**
 * Decrypts AES-256-CBC encrypted data.
 * @param {string} encryptedHex - Hex-encoded ciphertext
 * @param {string} ivHex - Hex-encoded initialization vector (32 chars)
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails (wrong key or corrupted data)
 * @example
 * const plaintext = decrypt('a1b2c3d4e5f6...', '1234567890abcdef...');
 * // plaintext: 'Hello, World!'
 */
function decrypt(encryptedHex, ivHex) {
  const key = getAESKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ── RSA Key Pair Generation ──

/**
 * Generates a 2048-bit RSA key pair for asymmetric encryption.
 * Keys are returned in PEM format (SPKI for public, PKCS8 for private).
 * Used primarily for seeding test data; client generates its own keys.
 * @returns {{publicKey: string, privateKey: string}} PEM-formatted key pair
 * @example
 * const { publicKey, privateKey } = generateKeyPair();
 * // publicKey: '-----BEGIN PUBLIC KEY-----\n...'
 * // privateKey: '-----BEGIN PRIVATE KEY-----\n...'
 */
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
  return { publicKey, privateKey };
}

module.exports = { encrypt, decrypt, generateKeyPair };
