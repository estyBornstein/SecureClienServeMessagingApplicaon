// Set environment variables BEFORE requiring any app modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.ENCRYPTION_KEY = 'integration-test-encryption-key';
process.env.DATABASE_PATH = ':memory:';
process.env.DB_TYPE = 'sqlite';
process.env.LOG_LEVEL = 'error';

const request = require('supertest');
const app = require('../src/app');
const { initializeDatabase, closeDatabase } = require('../src/data');
const crypto = require('crypto');

// Generate a real RSA key pair for testing
function generateTestKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

beforeAll(() => {
  initializeDatabase();
});

afterAll(() => {
  closeDatabase();
});

describe('Integration: Auth Routes', () => {
  const testUser = {
    username: 'integrationuser',
    password: 'testpass123',
    publicKey: null,
    encryptedPrivateKey: 'mock-encrypted-pk',
    encryptedPrivateKeyIv: 'mock-salt:mock-iv',
  };

  beforeAll(() => {
    const keys = generateTestKeyPair();
    testUser.publicKey = keys.publicKey;
  });

  test('POST /api/auth/register — registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: testUser.username,
        password: testUser.password,
        publicKey: testUser.publicKey,
        encryptedPrivateKey: testUser.encryptedPrivateKey,
        encryptedPrivateKeyIv: testUser.encryptedPrivateKeyIv,
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(testUser.username);
  });

  test('POST /api/auth/register — rejects duplicate username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: testUser.username,
        password: testUser.password,
        publicKey: testUser.publicKey,
        encryptedPrivateKey: testUser.encryptedPrivateKey,
        encryptedPrivateKeyIv: testUser.encryptedPrivateKeyIv,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test('POST /api/auth/register — rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'x', password: 'y' });

    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register — rejects short username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ab',
        password: 'testpass123',
        publicKey: testUser.publicKey,
        encryptedPrivateKey: 'x',
        encryptedPrivateKeyIv: 'y',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/3-30/);
  });

  test('POST /api/auth/register — rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'validuser',
        password: '12345',
        publicKey: testUser.publicKey,
        encryptedPrivateKey: 'x',
        encryptedPrivateKeyIv: 'y',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/6/); // Hebrew: "סיסמה חייבת להכיל לפחות 6 תווים"
  });

  test('POST /api/auth/login — logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(testUser.username);
    expect(res.body.encryptedPrivateKey).toBe(testUser.encryptedPrivateKey);
    expect(res.body.encryptedPrivateKeyIv).toBe(testUser.encryptedPrivateKeyIv);
  });

  test('POST /api/auth/login — rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('POST /api/auth/login — rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'nonexistent',
        password: 'testpass123',
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login — rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Integration: Protected Routes (Auth Middleware)', () => {
  test('GET /api/messages/history — rejects request without token', async () => {
    const res = await request(app).get('/api/messages/history');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/טוקן/); // Hebrew: "נדרש טוקן גישה"
  });

  test('GET /api/messages/history — rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/messages/history')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(403);
  });

  test('GET /api/users/public-keys — rejects request without token', async () => {
    const res = await request(app).get('/api/users/public-keys');
    expect(res.status).toBe(401);
  });
});

describe('Integration: Full Message Flow', () => {
  let aliceToken, bobToken;
  let aliceId, bobId;
  const aliceKeys = generateTestKeyPair();
  const bobKeys = generateTestKeyPair();

  beforeAll(async () => {
    // Register Alice
    const aliceRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'alice_integ',
        password: 'alicepass123',
        publicKey: aliceKeys.publicKey,
        encryptedPrivateKey: 'alice-enc-pk',
        encryptedPrivateKeyIv: 'alice-salt:alice-iv',
      });
    aliceToken = aliceRes.body.token;
    aliceId = aliceRes.body.user.id;

    // Register Bob
    const bobRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bob_integ',
        password: 'bobpass123',
        publicKey: bobKeys.publicKey,
        encryptedPrivateKey: 'bob-enc-pk',
        encryptedPrivateKeyIv: 'bob-salt:bob-iv',
      });
    bobToken = bobRes.body.token;
    bobId = bobRes.body.user.id;
  });

  test('GET /api/users/public-keys — returns all users with public keys', async () => {
    const res = await request(app)
      .get('/api/users/public-keys')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);

    const alice = res.body.users.find((u) => u.username === 'alice_integ');
    expect(alice).toBeDefined();
    expect(alice.publicKey).toContain('BEGIN PUBLIC KEY');
  });

  test('POST /api/messages/send — sends an E2E encrypted message', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        encryptedContent: 'aabbccdd',
        iv: '11223344',
        keys: [
          { userId: aliceId, encryptedKey: 'enc-key-for-alice' },
          { userId: bobId, encryptedKey: 'enc-key-for-bob' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.senderId).toBe(aliceId);
  });

  test('POST /api/messages/send — rejects missing encrypted content', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ iv: '1234', keys: [] });

    expect(res.status).toBe(400);
  });

  test('POST /api/messages/send — rejects too-long message', async () => {
    const res = await request(app)
      .post('/api/messages/send')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        encryptedContent: 'a'.repeat(20001),
        iv: '1234',
        keys: [{ userId: bobId, encryptedKey: 'k' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ארוכה מדי/); // Hebrew: "הודעה מוצפנת ארוכה מדי"
  });

  test('GET /api/messages/history — returns paginated history for user', async () => {
    const res = await request(app)
      .get('/api/messages/history?page=1&pageSize=10')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.messages).toBeDefined();
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.total).toBeDefined();

    // Bob should see Alice's message with his encrypted key
    if (res.body.messages.length > 0) {
      const msg = res.body.messages[0];
      expect(msg.encryptedContent).toBe('aabbccdd');
      expect(msg.encryptedKey).toBe('enc-key-for-bob');
    }
  });

  test('GET /api/messages/history — caps page size at 100', async () => {
    const res = await request(app)
      .get('/api/messages/history?page=1&pageSize=500')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
  });
});

describe('Integration: Health & 404', () => {
  test('GET /api/health — returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /api/nonexistent — returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
