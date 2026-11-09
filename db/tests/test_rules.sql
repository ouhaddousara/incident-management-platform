\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.doit_echouer(requete text, nom text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE requete;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'OK     % -> %', nom, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'ECHEC  % : la requete aurait du etre refusee', nom;
END $$;

CREATE FUNCTION pg_temp.verifier(cond boolean, nom text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond THEN
    RAISE NOTICE 'OK     %', nom;
  ELSE
    RAISE EXCEPTION 'ECHEC  %', nom;
  END IF;
END $$;

SELECT id AS etu  FROM utilisateur WHERE email = 'etudiant@demo.local'    \gset
SELECT id AS sup  FROM utilisateur WHERE email = 'superviseur@demo.local' \gset
SELECT id AS tech FROM utilisateur WHERE email = 'technicien@demo.local'  \gset
SELECT min(id) AS cat  FROM categorie \gset
SELECT min(id) AS lieu FROM lieu \gset
INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, role_code)
VALUES ('Tech2', 'Demo', 'tech2@demo.local', 'x', 'TECHNICIEN');
SELECT id AS tech2 FROM utilisateur WHERE email = 'tech2@demo.local' \gset

-- Création (RG1, RG3, O4, CA4)
SELECT pg_temp.doit_echouer(format('INSERT INTO incident (titre, description, categorie_id, lieu_id, declarant_id) VALUES (''x'', ''y'', %s, %s, %s)', :cat, :lieu, :sup), 'RG1 un superviseur ne declare pas');
SELECT pg_temp.doit_echouer(format('INSERT INTO incident (titre, description, categorie_id, lieu_id, declarant_id) VALUES (''   '', ''y'', %s, %s, %s)', :cat, :lieu, :etu), 'RG3 titre vide refuse');
INSERT INTO incident (titre, description, categorie_id, lieu_id, urgence, declarant_id)
VALUES ('Projecteur en panne', 'Ne s''allume plus', :cat, :lieu, 'ELEVE', :etu);
SELECT max(id) AS inc FROM incident \gset
SELECT pg_temp.verifier((SELECT count(*) FROM historique_statut WHERE incident_id = :inc) = 1, 'CA4 premiere ligne d''historique creee automatiquement');

-- Transitions interdites (RG6, RG9, RG13)
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''SIGNALE'', ''EXAMINE'', %s)', :inc, :etu), 'RG6 un etudiant ne peut pas examiner');
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''SIGNALE'', ''AFFECTE'', %s)', :inc, :sup), 'RG9 saut de statut refuse');
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''SIGNALE'', ''CLOTURE'', %s)', :inc, :sup), 'RG13 rejet sans motif refuse');

-- Parcours normal : Signalé -> Examiné -> Affecté
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'SIGNALE', 'EXAMINE', :sup);
INSERT INTO affectation (incident_id, technicien_id, superviseur_id) VALUES (:inc, :tech, :sup);
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'EXAMINE', 'AFFECTE', :sup);

-- RG4 : réaffectation = une seule affectation active
INSERT INTO affectation (incident_id, technicien_id, superviseur_id) VALUES (:inc, :tech, :sup);
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id, remarque) VALUES (:inc, 'AFFECTE', 'AFFECTE', :sup, 'Reaffectation');
SELECT pg_temp.verifier((SELECT count(*) FROM affectation WHERE incident_id = :inc AND termine_le IS NULL) = 1 AND (SELECT count(*) FROM affectation WHERE incident_id = :inc) = 2, 'RG4 une seule affectation active, l''ancienne est conservee');

-- RG7 : un autre technicien ne peut pas prendre en charge
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''AFFECTE'', ''EN_COURS'', %s)', :inc, :tech2), 'RG7 technicien non affecte refuse');

-- Traitement par le technicien affecté (RG8)
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'AFFECTE', 'EN_COURS', :tech);
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''EN_COURS'', ''NON_RESOLU'', %s)', :inc, :tech), 'RG8 Non resolu sans remarque refuse');
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id, remarque) VALUES (:inc, 'EN_COURS', 'NON_RESOLU', :tech, 'Piece de rechange introuvable');

-- RG12 : réouverture par le superviseur, puis résolution et clôture
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id, remarque) VALUES (:inc, 'NON_RESOLU', 'AFFECTE', :sup, 'Reouverture');
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'AFFECTE', 'EN_COURS', :tech);
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'EN_COURS', 'RESOLU', :tech);
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc, 'RESOLU', 'CLOTURE', :sup);
SELECT pg_temp.verifier((SELECT statut FROM incident WHERE id = :inc) = 'CLOTURE', 'Le statut courant suit l''historique');
SELECT pg_temp.verifier((SELECT count(*) FROM historique_statut WHERE incident_id = :inc) = 10, 'CA4 10 changements historises');

-- RG10 : historique intouchable
SELECT pg_temp.doit_echouer('UPDATE historique_statut SET remarque = ''falsifie''', 'RG10 modification refusee');
SELECT pg_temp.doit_echouer('DELETE FROM historique_statut', 'RG10 suppression refusee');
SELECT pg_temp.doit_echouer('TRUNCATE historique_statut', 'RG10 vidage refuse');

-- RG11 : incident clôturé figé
SELECT pg_temp.doit_echouer(format('UPDATE incident SET titre = ''modifie'' WHERE id = %s', :inc), 'RG11 modification refusee');
SELECT pg_temp.doit_echouer(format('INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (%s, ''CLOTURE'', ''AFFECTE'', %s)', :inc, :sup), 'RG11 reouverture apres cloture refusee');
SELECT pg_temp.doit_echouer(format('INSERT INTO affectation (incident_id, technicien_id, superviseur_id) VALUES (%s, %s, %s)', :inc, :tech, :sup), 'RG11 affectation apres cloture refusee');

-- RG5 : technicien indisponible, et statut non modifiable à la main
INSERT INTO incident (titre, description, categorie_id, lieu_id, declarant_id) VALUES ('Reseau lent', 'Wifi coupe', :cat, :lieu, :etu);
SELECT max(id) AS inc2 FROM incident \gset
INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id) VALUES (:inc2, 'SIGNALE', 'EXAMINE', :sup);
UPDATE technicien SET disponible = false WHERE utilisateur_id = :tech2;
SELECT pg_temp.doit_echouer(format('INSERT INTO affectation (incident_id, technicien_id, superviseur_id) VALUES (%s, %s, %s)', :inc2, :tech2, :sup), 'RG5 technicien indisponible refuse');
SELECT pg_temp.doit_echouer(format('UPDATE incident SET statut = ''RESOLU'' WHERE id = %s', :inc2), 'RG9 changement de statut direct refuse');

ROLLBACK;
\echo TOUS LES TESTS SONT PASSES
