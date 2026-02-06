process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';

const crypto = require('crypto');
const { encrypt, decrypt, generateKeyPair } = require('../src/utils/crypto');

describe('AES-256-CBC Encryption (Server Storage)', () => {
  test('encrypts and decrypts a simple message', () => {
    const original = 'Hello, World!';
    const { encrypted, iv } = encrypt(original);

    expect(encrypted).toBeDefined();
    expect(iv).toBeDefined();
    expect(encrypted).not.toBe(original);

    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(original);
  });

  test('produces different ciphertext for same plaintext (random IV)', () => {
    const text = 'Same message';
    const result1 = encrypt(text);
    const result2 = encrypt(text);

    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  test('handles Unicode/Hebrew text', () => {
    const hebrew = 'שלום עולם! זו הודעה מוצפנת.';
    const { encrypted, iv } = encrypt(hebrew);
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(hebrew);
  });

  test('handles empty string', () => {
    const { encrypted, iv } = encrypt('');
    expect(decrypt(encrypted, iv)).toBe('');
  });

  test('handles long messages', () => {
    const longText = 'A'.repeat(5000);
    const { encrypted, iv } = encrypt(longText);
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(longText);
  });

  test('fails with wrong IV', () => {
    const { encrypted } = encrypt('test message');
    const wrongIv = '00000000000000000000000000000000';
    expect(() => decrypt(encrypted, wrongIv)).toThrow();
  });
});

describe('RSA Key Pair Generation', () => {
  test('generates a valid key pair', () => {
    const { publicKey, privateKey } = generateKeyPair();

    expect(publicKey).toBeDefined();
    expect(privateKey).toBeDefined();
    expect(publicKey).toContain('BEGIN PUBLIC KEY');
    expect(privateKey).toContain('BEGIN PRIVATE KEY');
  });

  test('generates unique key pairs', () => {
    const pair1 = generateKeyPair();
    const pair2 = generateKeyPair();

    expect(pair1.publicKey).not.toBe(pair2.publicKey);
    expect(pair1.privateKey).not.toBe(pair2.privateKey);
  });
});

describe('E2E Encryption Flow (RSA-OAEP + AES-256-CBC)', () => {
  test('RSA-OAEP encrypts and decrypts an AES key', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const aesKey = crypto.randomBytes(32);

    const encrypted = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      aesKey
    );

    const decrypted = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      encrypted
    );

    expect(Buffer.compare(aesKey, decrypted)).toBe(0);
  });

  test('full E2E hybrid cycle: AES encrypt message + RSA encrypt key + decrypt', () => {
    const { publicKey, privateKey } = generateKeyPair();

    // Simulate client-side: generate AES key, encrypt message, encrypt AES key with RSA
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    let encryptedMsg = cipher.update('Hello E2E!', 'utf8', 'hex');
    encryptedMsg += cipher.final('hex');

    const encryptedAesKey = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      aesKey
    );

    // Simulate recipient-side: decrypt AES key with RSA, decrypt message
    const recoveredKey = crypto.privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      encryptedAesKey
    );

    const decipher = crypto.createDecipheriv('aes-256-cbc', recoveredKey, iv);
    let decryptedMsg = decipher.update(encryptedMsg, 'hex', 'utf8');
    decryptedMsg += decipher.final('utf8');

    expect(decryptedMsg).toBe('Hello E2E!');
  });

  test('E2E with multiple recipients uses same ciphertext, different encrypted keys', () => {
    const user1 = generateKeyPair();
    const user2 = generateKeyPair();

    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    let encryptedMsg = cipher.update('Broadcast message', 'utf8', 'hex');
    encryptedMsg += cipher.final('hex');

    // Encrypt AES key for each recipient
    const encKey1 = crypto.publicEncrypt(
      { key: user1.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      aesKey
    );
    const encKey2 = crypto.publicEncrypt(
      { key: user2.publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      aesKey
    );

    // Different encrypted keys (RSA is randomized)
    expect(Buffer.compare(encKey1, encKey2)).not.toBe(0);

    // Both recipients can decrypt
    const key1 = crypto.privateDecrypt(
      { key: user1.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      encKey1
    );
    const key2 = crypto.privateDecrypt(
      { key: user2.privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      encKey2
    );

    const decipher1 = crypto.createDecipheriv('aes-256-cbc', key1, iv);
    let msg1 = decipher1.update(encryptedMsg, 'hex', 'utf8');
    msg1 += decipher1.final('utf8');

    const decipher2 = crypto.createDecipheriv('aes-256-cbc', key2, iv);
    let msg2 = decipher2.update(encryptedMsg, 'hex', 'utf8');
    msg2 += decipher2.final('utf8');

    expect(msg1).toBe('Broadcast message');
    expect(msg2).toBe('Broadcast message');
  });
});
