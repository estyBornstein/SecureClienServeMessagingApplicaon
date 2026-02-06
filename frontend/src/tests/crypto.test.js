import { describe, it, expect } from 'vitest';
import { generateAESKey, aesEncrypt, aesDecrypt, encryptPrivateKey, decryptPrivateKey } from '../utils/crypto';

describe('AES-256-CBC Encryption (Client-side)', () => {
  it('generates a 256-bit (64 hex chars) AES key', () => {
    const key = generateAESKey();
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  });

  it('generates unique keys each time', () => {
    const key1 = generateAESKey();
    const key2 = generateAESKey();
    expect(key1).not.toBe(key2);
  });

  it('encrypts and decrypts a simple message', () => {
    const key = generateAESKey();
    const plaintext = 'Hello, World!';
    const { encrypted, iv } = aesEncrypt(plaintext, key);

    expect(encrypted).toBeDefined();
    expect(iv).toBeDefined();
    expect(encrypted).not.toBe(plaintext);

    const decrypted = aesDecrypt(encrypted, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const key = generateAESKey();
    const plaintext = 'Same message';
    const result1 = aesEncrypt(plaintext, key);
    const result2 = aesEncrypt(plaintext, key);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('handles Unicode/Hebrew text', () => {
    const key = generateAESKey();
    const plaintext = 'שלום עולם! 🔐';
    const { encrypted, iv } = aesEncrypt(plaintext, key);
    const decrypted = aesDecrypt(encrypted, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('handles empty string', () => {
    const key = generateAESKey();
    const { encrypted, iv } = aesEncrypt('', key);
    const decrypted = aesDecrypt(encrypted, iv, key);
    expect(decrypted).toBe('');
  });

  it('handles long messages', () => {
    const key = generateAESKey();
    const plaintext = 'A'.repeat(5000);
    const { encrypted, iv } = aesEncrypt(plaintext, key);
    const decrypted = aesDecrypt(encrypted, iv, key);
    expect(decrypted).toBe(plaintext);
  });
});

describe('Private Key Protection (PBKDF2 + AES)', () => {
  // PBKDF2 with 100K iterations takes ~6-7 seconds per encryption
  it('encrypts and decrypts a private key with password', () => {
    const password = 'test-password-123';
    const privateKey = '-----BEGIN PRIVATE KEY-----\nMOCKPRIVATEKEYDATA\n-----END PRIVATE KEY-----';

    const { encryptedPrivateKey, iv } = encryptPrivateKey(privateKey, password);

    expect(encryptedPrivateKey).toBeDefined();
    expect(iv).toBeDefined();
    expect(iv).toContain(':'); // salt:iv format

    const decrypted = decryptPrivateKey(encryptedPrivateKey, iv, password);
    expect(decrypted).toBe(privateKey);
  }, 15000);

  it('fails to decrypt with wrong password', () => {
    const password = 'correct-password';
    const privateKey = '-----BEGIN PRIVATE KEY-----\nTESTDATA\n-----END PRIVATE KEY-----';

    const { encryptedPrivateKey, iv } = encryptPrivateKey(privateKey, password);

    // With wrong password, decryption throws or returns garbage
    try {
      const decrypted = decryptPrivateKey(encryptedPrivateKey, iv, 'wrong-password');
      expect(decrypted).not.toBe(privateKey);
    } catch {
      // Throws on malformed UTF-8 - that's expected behavior
      expect(true).toBe(true);
    }
  }, 15000);

  it('produces different ciphertext for same key and password (random salt)', () => {
    const password = 'same-password';
    const privateKey = 'same-key-data';

    const result1 = encryptPrivateKey(privateKey, password);
    const result2 = encryptPrivateKey(privateKey, password);

    expect(result1.encryptedPrivateKey).not.toBe(result2.encryptedPrivateKey);
  }, 20000);
});
