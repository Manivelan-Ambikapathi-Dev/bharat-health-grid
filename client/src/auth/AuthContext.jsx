import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, loginRequest } from '../services/api.js';

const STORAGE_KEY = 'bhg_auth';
const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function AuthProvider({ children }) {
  const stored = readStoredSession();
  const [token, setToken] = useState(stored?.token || '');
  const [user, setUser] = useState(stored?.user || null);
  const [ready, setReady] = useState(!stored?.token);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return undefined;
    }
    let ignore = false;
    getCurrentUser()
      .then((nextUser) => {
        if (ignore) {
          return;
        }
        setUser(nextUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: nextUser }));
      })
      .catch(() => {
        if (!ignore) {
          localStorage.removeItem(STORAGE_KEY);
          setToken('');
          setUser(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setReady(true);
        }
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  const value = useMemo(() => ({
    ready,
    token,
    user,
    role: user?.role || '',
    stateId: user?.state_id ?? null,
    districtId: user?.district_id ?? null,
    phcId: user?.phc_id ?? null,
    isAuthenticated: Boolean(token && user),
    async login(username, password) {
      const data = await loginRequest(username, password);
      const session = { token: data.token, user: data.user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setToken(data.token);
      setUser(data.user);
      setReady(true);
      return data.user;
    },
    logout() {
      localStorage.removeItem(STORAGE_KEY);
      setToken('');
      setUser(null);
      setReady(true);
    },
  }), [ready, token, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { AuthProvider, useAuth };
