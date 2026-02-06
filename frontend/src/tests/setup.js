import '@testing-library/jest-dom/vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.crypto.subtle for RSA operations
Object.defineProperty(window, 'crypto', {
  value: {
    subtle: {
      generateKey: async () => ({
        publicKey: 'mock-public-key',
        privateKey: 'mock-private-key',
      }),
      exportKey: async () => {
        // Return a mock ArrayBuffer that looks like a valid key
        const mockData = new Uint8Array(256);
        for (let i = 0; i < 256; i++) mockData[i] = i % 256;
        return mockData.buffer;
      },
      importKey: async () => 'mock-crypto-key',
      encrypt: async () => new Uint8Array(256).buffer,
      decrypt: async () => new Uint8Array(32).buffer,
    },
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  },
});
