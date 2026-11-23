// Rôles de l'application (cahier des charges : étudiant, enseignant, technicien, superviseur, administrateur)
const ALIASES = {
  etudiant: 'etudiant',
  enseignant: 'enseignant',
  technicien: 'technicien',
  superviseur: 'superviseur',
  admin: 'admin',
  administrateur: 'admin',
};

// Page d'accueil par rôle (alignée sur la contribution Front-end, section 5)
const HOME = {
  etudiant: '/mes-incidents',
  enseignant: '/mes-incidents',
  technicien: '/technicien',
  superviseur: '/superviseur', // le compte « client invité » a ce rôle
  admin: '/admin',
};

function normalizeRole(value) {
  const key = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return ALIASES[key] || null;
}

// Code de rôle dans la base de données (table role) pour chaque rôle de l'API
const DB_ROLE = {
  etudiant: 'ETUDIANT',
  enseignant: 'ENSEIGNANT',
  technicien: 'TECHNICIEN',
  superviseur: 'SUPERVISEUR',
  admin: 'ADMINISTRATEUR',
};

module.exports = { normalizeRole, HOME, DB_ROLE };
