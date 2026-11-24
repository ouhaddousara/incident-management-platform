import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Page d'accueil par rôle (identique à la table de redirection de l'API).
export const HOME = {
  etudiant: '/dashboard',
  enseignant: '/dashboard',
  technicien: '/dashboard',
  superviseur: '/dashboard',
  admin: '/dashboard',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Au chargement : y a-t-il déjà une session ?
  useEffect(() => {
    api.me()
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // 401 reçu pendant l'utilisation : la session a expiré, retour à la connexion.
  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener('session-expiree', expire);
    return () => window.removeEventListener('session-expiree', expire);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data.redirection ?? HOME[data.user.role] ?? '/';
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
