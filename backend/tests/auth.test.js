process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-key';

const mockUsers = [];
let mockNextId = 1;

jest.mock('../src/data', () => ({
  getDatabase: () => ({
    findUserByUsername: (username) =>
      mockUsers.find((u) => u.username === username) || null,
    createUser: (username, passwordHash) => {
      const user = { id: mockNextId++, username, password_hash: passwordHash };
      mockUsers.push(user);
      return { id: user.id, username };
    },
    updateUserPublicKey: jest.fn(),
    updateUserEncryptedPrivateKey: jest.fn(),
  }),
  initializeDatabase: jest.fn(),
}));

const { registerUser, loginUser } = require('../src/services/authService');

const mockPublicKey = '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----';
const mockEncPrivKey = 'abcdef0123456789';
const mockEncPrivKeyIv = 'aabb:ccdd';

describe('User Registration', () => {
  test('registers a new user successfully', async () => {
    const result = await registerUser('testuser', 'password123', mockPublicKey, mockEncPrivKey, mockEncPrivKeyIv);

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('testuser');
  });

  test('rejects duplicate username', async () => {
    await expect(registerUser('testuser', 'password123', mockPublicKey, mockEncPrivKey, mockEncPrivKeyIv)).rejects.toThrow(
      'Username already exists'
    );
  });

  test('returns JWT token on registration', async () => {
    const result = await registerUser('newuser', 'password123', mockPublicKey, mockEncPrivKey, mockEncPrivKeyIv);
    const parts = result.token.split('.');
    expect(parts).toHaveLength(3);
  });
});

describe('User Login', () => {
  test('logs in with correct credentials', async () => {
    const result = await loginUser('testuser', 'password123');

    expect(result.token).toBeDefined();
    expect(result.user.username).toBe('testuser');
  });

  test('returns encrypted private key on login', async () => {
    // Add encrypted private key to mock user
    const user = mockUsers.find((u) => u.username === 'testuser');
    user.encrypted_private_key = mockEncPrivKey;
    user.encrypted_private_key_iv = mockEncPrivKeyIv;

    const result = await loginUser('testuser', 'password123');
    expect(result.encryptedPrivateKey).toBe(mockEncPrivKey);
    expect(result.encryptedPrivateKeyIv).toBe(mockEncPrivKeyIv);
  });

  test('rejects wrong password', async () => {
    await expect(loginUser('testuser', 'wrongpassword')).rejects.toThrow(
      'Invalid username or password'
    );
  });

  test('rejects non-existent user', async () => {
    await expect(loginUser('nobody', 'password123')).rejects.toThrow(
      'Invalid username or password'
    );
  });

  test('returns valid JWT token', async () => {
    const jwt = require('jsonwebtoken');
    const result = await loginUser('testuser', 'password123');
    const decoded = jwt.verify(result.token, process.env.JWT_SECRET);

    expect(decoded.username).toBe('testuser');
    expect(decoded.userId).toBeDefined();
  });
});
