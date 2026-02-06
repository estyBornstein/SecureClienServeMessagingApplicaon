const TOKEN_KEY = 'messaging_auth_token';
const USER_KEY = 'messaging_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function removeUser() {
  localStorage.removeItem(USER_KEY);
}

const PRIVATE_KEY = 'messaging_private_key';

export function getPrivateKey() {
  return localStorage.getItem(PRIVATE_KEY);
}

export function setPrivateKey(key) {
  localStorage.setItem(PRIVATE_KEY, key);
}

export function removePrivateKey() {
  localStorage.removeItem(PRIVATE_KEY);
}

export function clearAuth() {
  removeToken();
  removeUser();
  removePrivateKey();
}
