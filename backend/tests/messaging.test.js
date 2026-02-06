process.env.ENCRYPTION_KEY = 'test-encryption-key-for-messaging';

const mockMessages = [];
const mockDeliveries = [];
let mockMsgId = 1;
const mockUsers = [
  { id: 1, username: 'alice', public_key: 'pk-alice' },
  { id: 2, username: 'bob', public_key: 'pk-bob' },
  { id: 3, username: 'charlie', public_key: 'pk-charlie' },
];

jest.mock('../src/data', () => ({
  getDatabase: () => ({
    createMessage: (senderId, encryptedContent, iv) => {
      const msg = {
        id: mockMsgId++,
        senderId,
        encrypted_content: encryptedContent,
        encryption_iv: iv,
        created_at: new Date().toISOString(),
      };
      mockMessages.push(msg);
      return { id: msg.id, senderId, createdAt: msg.created_at };
    },
    getAllUsers: () => mockUsers,
    createDeliveryWithKey: (messageId, userId, encryptedKey) => {
      mockDeliveries.push({ messageId, userId, encryptedKey, delivered: 0 });
    },
    getUndeliveredForUserE2E: (userId) => {
      const undelivered = mockDeliveries.filter(
        (d) => d.userId === userId && !d.delivered
      );
      return undelivered.map((d) => {
        const msg = mockMessages.find((m) => m.id === d.messageId);
        const user = mockUsers.find((u) => u.id === msg.senderId);
        return {
          id: msg.id,
          sender_id: msg.senderId,
          encrypted_content: msg.encrypted_content,
          encryption_iv: msg.encryption_iv,
          encrypted_key: d.encryptedKey,
          created_at: msg.created_at,
          sender_username: user.username,
        };
      });
    },
    markDelivered: (messageId, userId) => {
      const d = mockDeliveries.find(
        (x) => x.messageId === messageId && x.userId === userId
      );
      if (d) d.delivered = 1;
    },
    getMessageHistoryForUser: (userId, page, pageSize) => {
      const userDeliveries = mockDeliveries.filter((d) => d.userId === userId);
      const total = userDeliveries.length;
      const offset = (page - 1) * pageSize;
      const slice = userDeliveries.slice(offset, offset + pageSize);
      return {
        messages: slice.map((d) => {
          const msg = mockMessages.find((m) => m.id === d.messageId);
          const user = mockUsers.find((u) => u.id === msg.senderId);
          return {
            ...msg,
            sender_username: user.username,
            encrypted_key: d.encryptedKey,
          };
        }),
        total,
      };
    },
  }),
  initializeDatabase: jest.fn(),
}));

const messageService = require('../src/services/messageService');

describe('E2E Message Creation', () => {
  test('creates a message and stores encrypted content as-is', () => {
    const keys = [
      { userId: 1, encryptedKey: 'enc-key-for-alice' },
      { userId: 2, encryptedKey: 'enc-key-for-bob' },
      { userId: 3, encryptedKey: 'enc-key-for-charlie' },
    ];

    const msg = messageService.createMessage(1, 'alice', 'encrypted-content-hex', 'iv-hex', keys);

    expect(msg.id).toBeDefined();
    expect(msg.senderId).toBe(1);
    expect(msg.senderUsername).toBe('alice');
    expect(msg.createdAt).toBeDefined();
    // Server does NOT return plaintext content
    expect(msg.content).toBeUndefined();
  });

  test('stores encrypted content in database without decryption', () => {
    const lastMsg = mockMessages[mockMessages.length - 1];
    expect(lastMsg.encrypted_content).toBe('encrypted-content-hex');
    expect(lastMsg.encryption_iv).toBe('iv-hex');
  });

  test('creates delivery records with per-user encrypted keys', () => {
    const deliveriesForMsg = mockDeliveries.filter((d) => d.messageId === 1);
    expect(deliveriesForMsg.length).toBe(3); // All users including sender
    expect(deliveriesForMsg.find((d) => d.userId === 1).encryptedKey).toBe('enc-key-for-alice');
    expect(deliveriesForMsg.find((d) => d.userId === 2).encryptedKey).toBe('enc-key-for-bob');
    expect(deliveriesForMsg.find((d) => d.userId === 3).encryptedKey).toBe('enc-key-for-charlie');
  });

  test('marks sender delivery as already delivered', () => {
    const senderDelivery = mockDeliveries.find((d) => d.messageId === 1 && d.userId === 1);
    expect(senderDelivery.delivered).toBe(1);
  });
});

describe('E2E Message Retrieval', () => {
  test('returns encrypted messages with per-user key', () => {
    const msgs = messageService.getMessagesForUser(2);

    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].encryptedContent).toBe('encrypted-content-hex');
    expect(msgs[0].iv).toBe('iv-hex');
    expect(msgs[0].encryptedKey).toBe('enc-key-for-bob');
    expect(msgs[0].senderUsername).toBe('alice');
    // No plaintext content from server
    expect(msgs[0].content).toBeUndefined();
  });

  test('marks messages as delivered after retrieval', () => {
    const msgs = messageService.getMessagesForUser(2);
    expect(msgs.length).toBe(0);
  });

  test('different users get their own encrypted keys', () => {
    const msgs = messageService.getMessagesForUser(3);
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].encryptedKey).toBe('enc-key-for-charlie');
  });
});

describe('E2E Message Broadcasting', () => {
  test('new message creates keyed deliveries for all users', () => {
    const initialDeliveryCount = mockDeliveries.length;
    const keys = [
      { userId: 1, encryptedKey: 'bob-msg-key-alice' },
      { userId: 2, encryptedKey: 'bob-msg-key-bob' },
      { userId: 3, encryptedKey: 'bob-msg-key-charlie' },
    ];
    messageService.createMessage(2, 'bob', 'bobs-encrypted-msg', 'bobs-iv', keys);

    const newDeliveries = mockDeliveries.slice(initialDeliveryCount);
    expect(newDeliveries.length).toBe(3);
    expect(newDeliveries.find((d) => d.userId === 1).encryptedKey).toBe('bob-msg-key-alice');
    expect(newDeliveries.find((d) => d.userId === 3).encryptedKey).toBe('bob-msg-key-charlie');
  });

  test('recipient receives encrypted broadcast message with their key', () => {
    const msgs = messageService.getMessagesForUser(1);
    const bobsMsg = msgs.find((m) => m.senderUsername === 'bob');
    expect(bobsMsg).toBeDefined();
    expect(bobsMsg.encryptedContent).toBe('bobs-encrypted-msg');
    expect(bobsMsg.encryptedKey).toBe('bob-msg-key-alice');
  });
});

describe('E2E Message History', () => {
  test('returns paginated encrypted history for specific user', () => {
    // User 3 (charlie) should have history entries
    const history = messageService.getMessageHistory(3, 1, 10);

    expect(history.messages.length).toBeGreaterThan(0);
    expect(history.total).toBeDefined();
    expect(history.page).toBe(1);
    expect(history.pageSize).toBe(10);

    history.messages.forEach((msg) => {
      expect(msg.encryptedContent).toBeDefined();
      expect(msg.iv).toBeDefined();
      expect(msg.encryptedKey).toBeDefined();
      // No plaintext
      expect(msg.content).toBeUndefined();
    });
  });

  test('respects pagination parameters', () => {
    const history = messageService.getMessageHistory(3, 1, 1);
    expect(history.messages.length).toBe(1);
    expect(history.total).toBeGreaterThan(1);
  });
});
