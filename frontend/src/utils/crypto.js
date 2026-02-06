/**
 * Client-side cryptographic utilities for end-to-end encryption.
 *
 * Implements a hybrid encryption scheme:
 * - RSA-OAEP (2048-bit) for encrypting symmetric keys
 * - AES-256-CBC for encrypting message content
 * - PBKDF2 for deriving keys from passwords (iterations configured in constants)
 *
 * @module utils/crypto
 */

import CryptoJS from 'crypto-js';
import { PBKDF2_ITERATIONS } from '../config/constants';

// ══════════════════════════════════════════════════════════════════════════════
// PEM Parsing Utilities
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a PEM-formatted key to an ArrayBuffer.
 * Strips PEM headers/footers and decodes base64 content.
 * @private
 * @param {string} pem - PEM-formatted key string
 * @returns {ArrayBuffer} Raw key bytes
 */
function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 * @private
 * @param {ArrayBuffer} buffer - Raw bytes
 * @returns {string} Base64-encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64 string to an ArrayBuffer.
 * @private
 * @param {string} base64 - Base64-encoded string
 * @returns {ArrayBuffer} Raw bytes
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ══════════════════════════════════════════════════════════════════════════════
// RSA Operations (Web Crypto API)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Imports a PEM-formatted public key for RSA-OAEP encryption.
 * @private
 * @param {string} pem - PEM-formatted public key
 * @returns {Promise<CryptoKey>} Web Crypto public key object
 */
async function importPublicKey(pem) {
  const buffer = pemToArrayBuffer(pem);
  return window.crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

/**
 * Imports a PEM-formatted private key for RSA-OAEP decryption.
 * @private
 * @param {string} pem - PEM-formatted private key
 * @returns {Promise<CryptoKey>} Web Crypto private key object
 */
async function importPrivateKey(pem) {
  const buffer = pemToArrayBuffer(pem);
  return window.crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

/**
 * Encrypts data using RSA-OAEP with SHA-256.
 * Used to encrypt AES keys for each recipient.
 * @param {string} publicKeyPem - Recipient's PEM-formatted public key
 * @param {Uint8Array} data - Data to encrypt (typically a 32-byte AES key)
 * @returns {Promise<string>} Base64-encoded ciphertext
 * @example
 * const encryptedKey = await rsaEncrypt(recipientPublicKey, aesKeyBytes);
 */
export async function rsaEncrypt(publicKeyPem, data) {
  const key = await importPublicKey(publicKeyPem);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    data
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Decrypts RSA-OAEP encrypted data.
 * Used to recover AES keys from received messages.
 * @param {string} privateKeyPem - User's PEM-formatted private key
 * @param {string} encryptedBase64 - Base64-encoded ciphertext
 * @returns {Promise<Uint8Array>} Decrypted data bytes
 * @example
 * const aesKeyBytes = await rsaDecrypt(myPrivateKey, encryptedKey);
 */
export async function rsaDecrypt(privateKeyPem, encryptedBase64) {
  const key = await importPrivateKey(privateKeyPem);
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    key,
    encrypted
  );
  return new Uint8Array(decrypted);
}

/**
 * Generates a new 2048-bit RSA key pair for E2E encryption.
 * Called during user registration to create the user's encryption keys.
 * @returns {Promise<{publicKey: string, privateKey: string}>} PEM-formatted key pair
 * @example
 * const { publicKey, privateKey } = await generateRSAKeyPair();
 * // publicKey sent to server for other users to encrypt messages to this user
 * // privateKey stored locally and used to decrypt incoming messages
 */
export async function generateRSAKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyPem =
    '-----BEGIN PUBLIC KEY-----\n' +
    arrayBufferToBase64(publicKeyBuffer).match(/.{1,64}/g).join('\n') +
    '\n-----END PUBLIC KEY-----';

  const privateKeyPem =
    '-----BEGIN PRIVATE KEY-----\n' +
    arrayBufferToBase64(privateKeyBuffer).match(/.{1,64}/g).join('\n') +
    '\n-----END PRIVATE KEY-----';

  return { publicKey: publicKeyPem, privateKey: privateKeyPem };
}

// ══════════════════════════════════════════════════════════════════════════════
// AES-256-CBC Operations (CryptoJS)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a random 256-bit AES key.
 * A new key is generated for each message to ensure forward secrecy.
 * @returns {string} 64-character hex string (256 bits)
 * @example
 * const aesKey = generateAESKey();
 * // aesKey: 'a1b2c3d4e5f6...' (64 hex chars)
 */
export function generateAESKey() {
  const keyWords = CryptoJS.lib.WordArray.random(32);
  return keyWords.toString(CryptoJS.enc.Hex);
}

/**
 * Encrypts plaintext using AES-256-CBC with PKCS7 padding.
 * Generates a random 128-bit IV for each encryption.
 * @param {string} plaintext - Message content to encrypt
 * @param {string} keyHex - 64-character hex AES key
 * @returns {{encrypted: string, iv: string}} Hex-encoded ciphertext and IV
 * @example
 * const { encrypted, iv } = aesEncrypt('Hello!', aesKey);
 */
export function aesEncrypt(plaintext, keyHex) {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
    iv: iv.toString(CryptoJS.enc.Hex),
  };
}

/**
 * Decrypts AES-256-CBC encrypted data.
 * @param {string} encryptedHex - Hex-encoded ciphertext
 * @param {string} ivHex - Hex-encoded 128-bit IV
 * @param {string} keyHex - Hex-encoded 256-bit AES key
 * @returns {string} Decrypted plaintext
 * @example
 * const message = aesDecrypt(encrypted, iv, aesKey);
 */
export function aesDecrypt(encryptedHex, ivHex, keyHex) {
  const key = CryptoJS.enc.Hex.parse(keyHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const ciphertext = CryptoJS.enc.Hex.parse(encryptedHex);
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// ══════════════════════════════════════════════════════════════════════════════
// Private Key Protection (PBKDF2 + AES)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Encrypts the user's private key using a password-derived key.
 * Uses PBKDF2 with 100,000 iterations and SHA-256 for key derivation.
 * The encrypted key is stored on the server as a backup.
 * @param {string} privateKeyPem - PEM-formatted private key
 * @param {string} password - User's password
 * @returns {{encryptedPrivateKey: string, iv: string}} Encrypted key and composite IV (salt:iv)
 * @example
 * const { encryptedPrivateKey, iv } = encryptPrivateKey(privateKey, password);
 * // iv format: 'saltHex:ivHex'
 */
export function encryptPrivateKey(privateKeyPem, password) {
  const salt = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  const keyHex = key.toString(CryptoJS.enc.Hex);
  const { encrypted, iv } = aesEncrypt(privateKeyPem, keyHex);
  const saltHex = salt.toString(CryptoJS.enc.Hex);
  return {
    encryptedPrivateKey: encrypted,
    iv: `${saltHex}:${iv}`,
  };
}

/**
 * Decrypts the user's private key using a password-derived key.
 * Called during login to recover the private key from server backup.
 * @param {string} encryptedPrivateKey - Hex-encoded encrypted private key
 * @param {string} ivComposite - Composite IV in format 'saltHex:ivHex'
 * @param {string} password - User's password
 * @returns {string} PEM-formatted private key
 * @throws {Error} If password is incorrect
 * @example
 * const privateKey = decryptPrivateKey(encrypted, iv, password);
 */
export function decryptPrivateKey(encryptedPrivateKey, ivComposite, password) {
  const [saltHex, ivHex] = ivComposite.split(':');
  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  const keyHex = key.toString(CryptoJS.enc.Hex);
  return aesDecrypt(encryptedPrivateKey, ivHex, keyHex);
}

// ══════════════════════════════════════════════════════════════════════════════
// High-Level E2E Encryption Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Converts a hex string to a Uint8Array.
 * @private
 * @param {string} hex - Hex-encoded string
 * @returns {Uint8Array} Raw bytes
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a hex string.
 * @private
 * @param {Uint8Array} bytes - Raw bytes
 * @returns {string} Hex-encoded string
 */
function bytesToHex(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Encrypts a message for multiple recipients using hybrid encryption.
 *
 * Encryption flow:
 * 1. Generate a random AES-256 key
 * 2. Encrypt the message with AES-CBC
 * 3. Encrypt the AES key with each recipient's RSA public key
 *
 * @param {string} plaintext - Message content to encrypt
 * @param {Array<{userId: number, publicKey: string}>} recipients - List of recipients with their public keys
 * @returns {Promise<{encryptedContent: string, iv: string, keys: Array<{userId: number, encryptedKey: string}>}>}
 *          Encrypted message data ready to send to server
 * @example
 * const encrypted = await encryptMessageForRecipients('Hello!', [
 *   { userId: 1, publicKey: '-----BEGIN PUBLIC KEY-----...' },
 *   { userId: 2, publicKey: '-----BEGIN PUBLIC KEY-----...' }
 * ]);
 * // Server stores encryptedContent once, but each user gets their own encryptedKey
 */
export async function encryptMessageForRecipients(plaintext, recipients) {
  const aesKeyHex = generateAESKey();
  const { encrypted, iv } = aesEncrypt(plaintext, aesKeyHex);
  const aesKeyBytes = hexToBytes(aesKeyHex);

  const keys = [];
  for (const recipient of recipients) {
    const encryptedKey = await rsaEncrypt(recipient.publicKey, aesKeyBytes);
    keys.push({ userId: recipient.userId, encryptedKey });
  }

  return { encryptedContent: encrypted, iv, keys };
}

/**
 * Decrypts a received message using the user's private key.
 *
 * Decryption flow:
 * 1. Decrypt the AES key using RSA private key
 * 2. Decrypt the message content using the recovered AES key
 *
 * @param {string} encryptedContent - Hex-encoded encrypted message
 * @param {string} iv - Hex-encoded AES initialization vector
 * @param {string} encryptedKey - Base64-encoded RSA-encrypted AES key (specific to this user)
 * @param {string} privateKeyPem - User's PEM-formatted private key
 * @returns {Promise<string>} Decrypted message plaintext
 * @throws {Error} If decryption fails (wrong key or corrupted data)
 * @example
 * const message = await decryptMessage(
 *   msg.encryptedContent,
 *   msg.iv,
 *   msg.encryptedKey,
 *   myPrivateKey
 * );
 */
export async function decryptMessage(encryptedContent, iv, encryptedKey, privateKeyPem) {
  const aesKeyBytes = await rsaDecrypt(privateKeyPem, encryptedKey);
  const aesKeyHex = bytesToHex(aesKeyBytes);
  return aesDecrypt(encryptedContent, iv, aesKeyHex);
}
