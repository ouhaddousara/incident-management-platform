// Client de l'API HelpDesk (v1.0). Les URLs sont relatives : le proxy de Vite
// les envoie vers http://localhost:3000. Les cookies sont toujours envoyés.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

const detailsTexte = (d) => {
  if (!d) return '';
  const l = Array.isArray(d) ? d : Object.values(d);
  return l.map((x) => (typeof x === 'string' ? x : x?.message ?? x?.msg ?? '')).filter(Boolean).join(' ');
};

const texteErreur = (data) => {
  const base = data?.message ?? 'Erreur inattendue.';
  const det = detailsTexte(data?.details);
  return det ? `${base} ${det}` : base;
};

async function request(path, { method = 'GET', body, form, blob } = {}) {
  const options = { method, credentials: 'include', headers: {} };
  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'RESEAU', "Serveur injoignable. Vérifiez que l'API est lancée.");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    // 401 hors connexion : la session a expiré, on prévient l'application.
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event('session-expiree'));
    }
    throw new ApiError(res.status, data?.error, texteErreur(data), data?.details);
  }
  if (blob) return res.blob();
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

const post = (path, body = {}) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });

export const api = {
  // Authentification
  login: (email, password) => post('/api/auth/login', { email, password }),
  logout: () => post('/api/auth/logout'),
  me: () => request('/api/auth/me'),

  // Listes pour les formulaires
  categories: () => request('/api/categories'),
  lieux: () => request('/api/lieux'),

  // Incidents
  incidents: (params) => request(`/api/incidents${qs(params)}`),
  incident: (id) => request(`/api/incidents/${id}`),
  creerIncident: (body) => post('/api/incidents', body),
  // action : examiner, rejeter, doublon, affecter, reaffecter, rouvrir, cloturer,
  //          prendre-en-charge, resoudre, non-resolu
  action: (id, action, body = {}) => post(`/api/incidents/${id}/${action}`, body),
  envoyerPhoto: (id, fichier) => {
    const form = new FormData();
    form.append('photo', fichier);
    return request(`/api/incidents/${id}/piece-jointe`, { method: 'POST', form });
  },
  photo: (id) => request(`/api/incidents/${id}/piece-jointe`, { blob: true }),

  // Techniciens
  techniciens: () => request('/api/techniciens'),
  technicienMoi: () => request('/api/techniciens/moi'),
  majDisponibilite: (disponible) => patch('/api/techniciens/moi', { disponible }),

  // Notifications
  notifications: (params) => request(`/api/notifications${qs(params)}`),
  notificationLue: (id) => post(`/api/notifications/${id}/lue`),
  notificationsLues: () => post('/api/notifications/lues'),

  // Statistiques
  statistiques: (params) => request(`/api/statistiques${qs(params)}`),
  exportCsvUrl: (params) => `/api/statistiques/export.csv${qs(params)}`,

  // Administration
  utilisateurs: () => request('/api/admin/utilisateurs'),
  creerUtilisateur: (body) => post('/api/admin/utilisateurs', body),
  majUtilisateur: (id, body) => patch(`/api/admin/utilisateurs/${id}`, body),
  adminCategories: () => request('/api/admin/categories'),
  creerCategorie: (libelle) => post('/api/admin/categories', { libelle }),
  majCategorie: (id, body) => patch(`/api/admin/categories/${id}`, body),
  adminLieux: () => request('/api/admin/lieux'),
  creerLieu: (libelle) => post('/api/admin/lieux', { libelle }),
  majLieu: (id, body) => patch(`/api/admin/lieux/${id}`, body),
};
