import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export function useApi() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const apiFetch = useCallback(async (url, options = {}) => {
    setLoading(true);
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { apiFetch, loading };
}
