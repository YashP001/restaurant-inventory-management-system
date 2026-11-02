import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ub_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ub_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth expiration events from api client
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('ub_auth_expired', handleAuthExpired);

    // Validate active token on initial load
    if (token) {
      authApi.getProfile()
        .then(res => {
          if (res?.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('ub_user', JSON.stringify(res.data.user));
          }
        })
        .catch(() => {
          handleAuthExpired();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => window.removeEventListener('ub_auth_expired', handleAuthExpired);
  }, [token]);

  const login = async (identifier, password) => {
    const res = await authApi.login(identifier, password);
    if (res?.success && res?.data?.token) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      setToken(authToken);
      setUser(authUser);

      localStorage.setItem('ub_token', authToken);
      localStorage.setItem('ub_user', JSON.stringify(authUser));
      return { success: true, user: authUser };
    }
    throw new Error(res?.message || 'Login failed');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ub_token');
    localStorage.removeItem('ub_user');
  };

  const hasRole = (...roles) => {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, isAuthenticated: Boolean(token && user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

