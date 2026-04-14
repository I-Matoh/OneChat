import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { disconnectSocket } from './useSocket';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || '';

function resolveApiErrorMessage(data, fallbackMessage) {
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallbackMessage;
}

function parseSupabaseUser(sbUser) {
  if (!sbUser) return null;
  return {
    id: sbUser.id,
    email: sbUser.email,
    name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0],
    avatarUrl: sbUser.user_metadata?.avatar_url,
  };
}

async function fetchUserProfile(token) {
  const res = await fetch(`${API}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usingSupabase, setUsingSupabase] = useState(isSupabaseConfigured);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      if (!cancelled) setUsingSupabase(isSupabaseConfigured);

      if (isSupabaseConfigured) {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session && !cancelled) {
            const parsedUser = parseSupabaseUser(session.user);
            setUser(parsedUser);
            setToken(session.access_token);
            return;
          }
        } catch (err) {
          console.warn('Supabase session restore failed:', err.message);
        }
      }

      const stored = localStorage.getItem('onechat_auth');
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(stored);
        if (!parsed?.token) throw new Error('Missing token');

        if (isSupabaseConfigured && parsed.provider === 'supabase') {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session) {
            setUser(parseSupabaseUser(session.user));
            setToken(session.access_token);
            setUsingSupabase(true);
            if (!cancelled) setLoading(false);
            return;
          }
        }

        const res = await fetch(`${API}/auth/me`, {
          headers: {
            Authorization: `Bearer ${parsed.token}`,
          },
        });

        if (!res.ok) throw new Error('Session expired');

        const contentType = res.headers.get('content-type');
        if (!contentType?.includes('application/json')) {
          throw new Error('Invalid server response');
        }

        const data = await res.json();
        if (cancelled) return;

        setUser(data.user);
        setToken(parsed.token);
        localStorage.setItem('onechat_auth', JSON.stringify({ token: parsed.token, user: data.user }));
      } catch (err) {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(parseSupabaseUser(session.user));
        setToken(session.access_token);
        setUsingSupabase(true);
        localStorage.setItem('onechat_auth', JSON.stringify({ 
          token: session.access_token, 
          user: parseSupabaseUser(session.user),
          provider: 'supabase' 
        }));
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
        setUsingSupabase(false);
        localStorage.removeItem('onechat_auth');
        disconnectSocket();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error(error.message);
      
      const parsedUser = parseSupabaseUser(data.user);
      setUser(parsedUser);
      setToken(data.session.access_token);
      setUsingSupabase(true);
      localStorage.setItem('onechat_auth', JSON.stringify({ 
        token: data.session.access_token, 
        user: parsedUser,
        provider: 'supabase' 
      }));
      return { user: parsedUser, token: data.session.access_token };
    }

    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await res.json();
        throw new Error(resolveApiErrorMessage(data, 'Login failed'));
      }
      throw new Error('Login failed - server may be unavailable');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('onechat_auth', JSON.stringify(data));
    return data;
  }, []);

  const register = useCallback(async (name, email, password) => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });
      if (error) throw new Error(error.message);
      
      const parsedUser = parseSupabaseUser(data.user);
      
      if (data.session) {
        setUser(parsedUser);
        setToken(data.session.access_token);
        setUsingSupabase(true);
        localStorage.setItem('onechat_auth', JSON.stringify({ 
          token: data.session.access_token, 
          user: parsedUser,
          provider: 'supabase' 
        }));
      }
      
      return { user: parsedUser, token: data.session?.access_token };
    }

    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await res.json();
        throw new Error(resolveApiErrorMessage(data, 'Registration failed'));
      }
      throw new Error('Registration failed - server may be unavailable');
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('onechat_auth', JSON.stringify(data));
    return data;
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setToken(null);
    setUsingSupabase(false);
    localStorage.removeItem('onechat_auth');
    disconnectSocket();
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) {
      throw new Error('Password reset not available - configure Supabase first');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, resetPassword, usingSupabase }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}