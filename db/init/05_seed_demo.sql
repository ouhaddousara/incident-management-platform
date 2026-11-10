-- DEVELOPMENT ONLY. Never load this file on a hosted platform: the password is public.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, role_code) VALUES
  ('Admin', 'Demo', 'admin@demo.local',       crypt('Demo-Only-1234', gen_salt('bf', 10)), 'ADMINISTRATEUR'),
  ('Super', 'Demo', 'superviseur@demo.local', crypt('Demo-Only-1234', gen_salt('bf', 10)), 'SUPERVISEUR'),
  ('Tech',  'Demo', 'technicien@demo.local',  crypt('Demo-Only-1234', gen_salt('bf', 10)), 'TECHNICIEN'),
  ('Etu',   'Demo', 'etudiant@demo.local',    crypt('Demo-Only-1234', gen_salt('bf', 10)), 'ETUDIANT'),
  ('Ens',   'Demo', 'enseignant@demo.local',  crypt('Demo-Only-1234', gen_salt('bf', 10)), 'ENSEIGNANT');
