import api from './api';

export async function login(username, password) {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
}

export async function register(username, password, publicKey, encryptedPrivateKey, encryptedPrivateKeyIv) {
  const response = await api.post('/auth/register', {
    username,
    password,
    publicKey,
    encryptedPrivateKey,
    encryptedPrivateKeyIv,
  });
  return response.data;
}
