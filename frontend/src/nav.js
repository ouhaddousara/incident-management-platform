// Menu de la sidebar selon le rôle : [chemin, libellé, icône].
const DASH = ['/dashboard', 'Dashboard', 'dashboard'];
const PARAM = ['/parametres', 'Paramètres', 'settings'];
const MES_TICKETS = ['/mes-tickets', 'Mes tickets', 'ticket'];
const INCIDENTS = ['/incidents', 'Incidents', 'alert'];
const RAPPORTS = ['/rapports', 'Rapports', 'chart'];

export const NAV = {
  etudiant: [DASH, MES_TICKETS, PARAM],
  enseignant: [DASH, MES_TICKETS, PARAM],
  technicien: [DASH, MES_TICKETS, PARAM],
  superviseur: [DASH, INCIDENTS, RAPPORTS, PARAM],
  admin: [DASH, INCIDENTS, ['/utilisateurs', 'Utilisateurs', 'users'], RAPPORTS, PARAM],
};

// Page « liste » de chaque rôle (recherche du header, bouton retour).
export const LISTE = {
  etudiant: '/mes-tickets',
  enseignant: '/mes-tickets',
  technicien: '/mes-tickets',
  superviseur: '/incidents',
  admin: '/incidents',
};
