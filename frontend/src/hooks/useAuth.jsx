import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { disconnectSocket } from './useSocket';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || '';

function resolveApiErrorMessage(data, fallbackMessage) {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallbackMessage;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      const stored = localStorage.getItem('onechat_auth');
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!parsed?.token) throw new Error('Missing token');

        const res = await fetch(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${parsed.token}`,
          },
        });

        if (!res.ok) throw new Error('Session expired');

        const data = await res.json();
        if (cancelled) return;

        setUser(data.user);
        setToken(parsed.token);
        localStorage.setItem('onechat_auth', JSON.stringify({ token: parsed.token, user: data.user }));
      } catch {
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('onechat_auth');
          disconnectSocket();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(resolveApiErrorMessage(data, 'Login failed'));
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('onechat_auth', JSON.stringify(data));
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(resolveApiErrorMessage(data, 'Registration failed'));
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('onechat_auth', JSON.stringify(data));
    return data;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('onechat_auth');
    disconnectSocket();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
