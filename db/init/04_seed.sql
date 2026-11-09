INSERT INTO role (code, libelle) VALUES
  ('ETUDIANT','Étudiant'), ('ENSEIGNANT','Enseignant'), ('SUPERVISEUR','Superviseur'),
  ('TECHNICIEN','Technicien'), ('ADMINISTRATEUR','Administrateur');

INSERT INTO categorie (libelle) VALUES
  ('Réseau'), ('Matériel'), ('Logiciel'), ('Électricité'), ('Mobilier'), ('Autre');

-- Lieux : exemples à remplacer par la liste réelle de l'établissement [non précisé]
INSERT INTO lieu (libelle) VALUES
  ('Salle informatique 1'), ('Salle informatique 2'), ('Amphithéâtre'),
  ('Bibliothèque'), ('Administration');

-- Table des transitions d'Adnane (§2.5) + réaffectation d'un incident en cours (RG14)
INSERT INTO transition_autorisee (ancien_statut, nouveau_statut, role_code) VALUES
  ('SIGNALE',    'EXAMINE',    'SUPERVISEUR'),
  ('SIGNALE',    'CLOTURE',    'SUPERVISEUR'),
  ('EXAMINE',    'AFFECTE',    'SUPERVISEUR'),
  ('AFFECTE',    'AFFECTE',    'SUPERVISEUR'),
  ('AFFECTE',    'EN_COURS',   'TECHNICIEN'),
  ('EN_COURS',   'RESOLU',     'TECHNICIEN'),
  ('EN_COURS',   'NON_RESOLU', 'TECHNICIEN'),
  ('EN_COURS',   'AFFECTE',    'SUPERVISEUR'),
  ('RESOLU',     'CLOTURE',    'SUPERVISEUR'),
  ('NON_RESOLU', 'CLOTURE',    'SUPERVISEUR'),
  ('NON_RESOLU', 'AFFECTE',    'SUPERVISEUR');
