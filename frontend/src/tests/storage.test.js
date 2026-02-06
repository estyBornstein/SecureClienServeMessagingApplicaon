import { describe, it, expect, beforeEach } from 'vitest';
import {
  getToken, setToken, removeToken,
  getUser, setUser, removeUser,
  getPrivateKey, setPrivateKey, removePrivateKey,
  clearAuth,
} from '../utils/storage';

describe('Storage Utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token', () => {
    it('stores and retrieves token', () => {
      setToken('test-token-123');
      expect(getToken()).toBe('test-token-123');
    });

    it('returns null when no token', () => {
      expect(getToken()).toBeNull();
    });

    it('removes token', () => {
      setToken('test-token');
      removeToken();
      expect(getToken()).toBeNull();
    });
  });

  describe('User', () => {
    it('stores and retrieves user object', () => {
      const user = { id: 1, username: 'alice' };
      setUser(user);
      expect(getUser()).toEqual(user);
    });

    it('returns null when no user', () => {
      expect(getUser()).toBeNull();
    });

    it('removes user', () => {
      setUser({ id: 1, username: 'alice' });
      removeUser();
      expect(getUser()).toBeNull();
    });
  });

  describe('Private Key', () => {
    it('stores and retrieves private key', () => {
      setPrivateKey('-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----');
      expect(getPrivateKey()).toContain('BEGIN PRIVATE KEY');
    });

    it('returns null when no key', () => {
      expect(getPrivateKey()).toBeNull();
    });

    it('removes private key', () => {
      setPrivateKey('test-key');
      removePrivateKey();
      expect(getPrivateKey()).toBeNull();
    });
  });

  describe('clearAuth', () => {
    it('clears token, user, and private key', () => {
      setToken('token');
      setUser({ id: 1, username: 'test' });
      setPrivateKey('key');

      clearAuth();

      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
      expect(getPrivateKey()).toBeNull();
    });
  });
});
