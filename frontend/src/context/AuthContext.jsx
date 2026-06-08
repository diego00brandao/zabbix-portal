import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedConnection, setSelectedConnection] = useState(() => {
    try { return JSON.parse(localStorage.getItem('selectedConnection')); } catch { return null; }
  });
  const [needsConnectionSelect, setNeedsConnectionSelect] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/api/auth/me')
        .then(r => setUser(r.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username, password) {
    const res = await api.post('/api/auth/login', { username, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    setUser(user);
    // Check connections after setting token
    const saved = localStorage.getItem('selectedConnection');
    if (!saved) {
      try {
        const connsRes = await api.get('/api/connections');
        const conns = connsRes.data;
        if (conns.length === 1) {
          selectConnection(conns[0]);
        } else if (conns.length > 1) {
          setNeedsConnectionSelect(true);
        }
      } catch {}
    }
    return user;
  }

  async function logout() {
    try { await api.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('selectedConnection');
    setUser(null);
    setSelectedConnection(null);
    setNeedsConnectionSelect(false);
  }

  function selectConnection(conn) {
    localStorage.setItem('selectedConnection', JSON.stringify(conn));
    setSelectedConnection(conn);
    setNeedsConnectionSelect(false);
    // Tell backend which connection to use
    api.post('/api/connections/select', { id: conn.id }).catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, selectedConnection, selectConnection, needsConnectionSelect, setNeedsConnectionSelect }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);