import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, subscription: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const data = await api('/me');
      setState({ ...data, loading: false });
    } catch {
      setState({ user: null, subscription: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    await api('/auth/login', { method: 'POST', body: { email, password } });
    await refresh();
  };
  const signup = async (name, email, password) => {
    await api('/auth/signup', { method: 'POST', body: { name, email, password } });
    await refresh();
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setState({ user: null, subscription: null, loading: false });
  };

  return <AuthContext.Provider value={{ ...state, refresh, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Gate for signed-in pages; remembers where to come back to
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading" aria-label="Loading" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
