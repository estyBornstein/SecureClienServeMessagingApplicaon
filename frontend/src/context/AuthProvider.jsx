import { useState, useCallback } from 'react';
import { AuthContext } from './AuthContext.js';
import { getToken, getUser, setToken, setUser, clearAuth } from '../utils/storage';

function getInitialUser() {
  const token = getToken();
  const savedUser = getUser();
  return (token && savedUser) ? savedUser : null;
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getInitialUser);

  const login = useCallback((token, userData) => {
    setToken(token);
    setUser(userData);
    setUserState(userData);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
