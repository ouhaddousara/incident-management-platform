// Toutes les requêtes passent ici : cookie de session envoyé avec credentials: 'include'.
const BASE = import.meta.env.VITE_API_URL ?? ''; // vide = proxy Vite

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw { status: 0, error: 'RESEAU', message: "Serveur injoignable. Vérifiez que l'API tourne sur le port 3000." };
  }
  let data = null;
  try { data = await res.json(); } catch { /* réponse sans corps */ }
  if (!res.ok) {
    throw {
      status: res.status,
      error: data?.error ?? 'ERREUR',
      message: data?.message ?? 'Une erreur est survenue.',
    };
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  health: () => request('/health'),
};
