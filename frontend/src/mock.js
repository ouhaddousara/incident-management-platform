// Données fictives : à remplacer par les vraies routes quand l'API des incidents sera disponible.
export const STATUTS = ['Nouveau', 'Affecté', 'En cours', 'Résolu', 'Clôturé'];
export const CATEGORIES = ['Réseau', 'Matériel', 'Logiciel', 'Électricité', 'Autre'];
export const LIEUX = ['Salle A1', 'Salle B2', 'Amphi 1', 'Laboratoire info', 'Bibliothèque'];
export const TECHNICIENS = ['Youssef B.', 'Salma K.', 'Omar T.'];

export const INCIDENTS = [
  { id: 101, titre: 'Projecteur ne s\'allume pas', categorie: 'Matériel', lieu: 'Amphi 1', statut: 'Nouveau', technicien: null, date: '2026-11-09' },
  { id: 102, titre: 'Wi-Fi coupé au laboratoire', categorie: 'Réseau', lieu: 'Laboratoire info', statut: 'Affecté', technicien: 'Youssef B.', date: '2026-11-09' },
  { id: 103, titre: 'Poste 12 : écran noir', categorie: 'Matériel', lieu: 'Salle B2', statut: 'En cours', technicien: 'Salma K.', date: '2026-11-08' },
  { id: 104, titre: 'Licence logiciel expirée', categorie: 'Logiciel', lieu: 'Salle A1', statut: 'Résolu', technicien: 'Omar T.', date: '2026-11-07' },
  { id: 105, titre: 'Prise électrique défectueuse', categorie: 'Électricité', lieu: 'Bibliothèque', statut: 'Clôturé', technicien: 'Salma K.', date: '2026-11-05' },
];

export const UTILISATEURS = [
  { id: 1, nom: 'Demo Etudiant', email: 'etudiant@demo.local', role: 'etudiant', actif: true },
  { id: 2, nom: 'Demo Tech', email: 'technicien@demo.local', role: 'technicien', actif: true },
  { id: 3, nom: 'Demo Super', email: 'superviseur@demo.local', role: 'superviseur', actif: true },
  { id: 4, nom: 'Ancien Compte', email: 'ancien@demo.local', role: 'enseignant', actif: false },
];
