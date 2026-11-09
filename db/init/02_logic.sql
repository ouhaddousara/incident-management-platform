-- RG10 : l'historique est intouchable
CREATE FUNCTION fn_historique_immuable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'RG10 : l''historique n''est ni modifiable ni supprimable';
END $$;

CREATE TRIGGER trg_historique_immuable
  BEFORE UPDATE OR DELETE ON historique_statut
  FOR EACH ROW EXECUTE FUNCTION fn_historique_immuable();
CREATE TRIGGER trg_historique_sans_truncate
  BEFORE TRUNCATE ON historique_statut
  FOR EACH STATEMENT EXECUTE FUNCTION fn_historique_immuable();

-- Un utilisateur technicien reçoit automatiquement son profil
CREATE FUNCTION fn_utilisateur_apres_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role_code = 'TECHNICIEN' THEN
    INSERT INTO technicien (utilisateur_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_utilisateur_apres_insert
  AFTER INSERT ON utilisateur
  FOR EACH ROW EXECUTE FUNCTION fn_utilisateur_apres_insert();

-- Création d'un incident : déclarant valide, statut Signalé forcé (RG1, RG2)
CREATE FUNCTION fn_incident_avant_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_role text;
BEGIN
  SELECT role_code INTO v_role FROM utilisateur WHERE id = NEW.declarant_id AND actif;
  IF v_role IS NULL OR v_role NOT IN ('ETUDIANT','ENSEIGNANT') THEN
    RAISE EXCEPTION 'RG1 : seul un etudiant ou un enseignant actif peut declarer un incident';
  END IF;
  NEW.statut := 'SIGNALE';
  RETURN NEW;
END $$;
CREATE TRIGGER trg_incident_avant_insert
  BEFORE INSERT ON incident
  FOR EACH ROW EXECUTE FUNCTION fn_incident_avant_insert();

-- La première ligne d'historique est créée automatiquement (O4, CA4)
CREATE FUNCTION fn_incident_apres_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO historique_statut (incident_id, ancien_statut, nouveau_statut, auteur_id, remarque)
  VALUES (NEW.id, NULL, 'SIGNALE', NEW.declarant_id, 'Incident signale');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_incident_apres_insert
  AFTER INSERT ON incident
  FOR EACH ROW EXECUTE FUNCTION fn_incident_apres_insert();

-- Chaque ligne d'historique doit être une transition permise (RG6, RG7, RG9, RG11)
CREATE FUNCTION fn_historique_valider() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_courant statut_incident;
  v_role    text;
BEGIN
  SELECT statut INTO v_courant FROM incident WHERE id = NEW.incident_id FOR UPDATE;
  SELECT role_code INTO v_role FROM utilisateur WHERE id = NEW.auteur_id AND actif;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'RG15 : auteur inconnu ou compte desactive';
  END IF;

  IF NEW.ancien_statut IS NULL THEN
    IF NEW.nouveau_statut <> 'SIGNALE'
       OR EXISTS (SELECT 1 FROM historique_statut WHERE incident_id = NEW.incident_id) THEN
      RAISE EXCEPTION 'RG9 : seule la creation ouvre l''historique, au statut SIGNALE';
    END IF;
    RETURN NEW;
  END IF;

  IF v_courant = 'CLOTURE' THEN
    RAISE EXCEPTION 'RG11 : un incident cloture ne peut plus etre modifie';
  END IF;
  IF NEW.ancien_statut <> v_courant THEN
    RAISE EXCEPTION 'RG9 : le statut actuel est %, pas %', v_courant, NEW.ancien_statut;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM transition_autorisee t
                 WHERE t.ancien_statut = NEW.ancien_statut
                   AND t.nouveau_statut = NEW.nouveau_statut
                   AND t.role_code = v_role) THEN
    RAISE EXCEPTION 'RG6/RG9 : transition % -> % interdite pour le role %',
                    NEW.ancien_statut, NEW.nouveau_statut, v_role;
  END IF;
  IF v_role = 'TECHNICIEN' AND NOT EXISTS (
       SELECT 1 FROM affectation
       WHERE incident_id = NEW.incident_id AND technicien_id = NEW.auteur_id AND termine_le IS NULL) THEN
    RAISE EXCEPTION 'RG7 : ce technicien n''est pas affecte a cet incident';
  END IF;
  IF NEW.nouveau_statut = 'AFFECTE' AND NOT EXISTS (
       SELECT 1 FROM affectation WHERE incident_id = NEW.incident_id AND termine_le IS NULL) THEN
    RAISE EXCEPTION 'RG4 : le statut Affecte exige une affectation active';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_historique_valider
  BEFORE INSERT ON historique_statut
  FOR EACH ROW EXECUTE FUNCTION fn_historique_valider();

-- Après validation : le statut courant suit l'historique
CREATE FUNCTION fn_historique_appliquer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE incident SET statut = NEW.nouveau_statut, mis_a_jour_le = now()
  WHERE id = NEW.incident_id;
  IF NEW.nouveau_statut = 'CLOTURE' THEN
    UPDATE affectation SET termine_le = now()
    WHERE incident_id = NEW.incident_id AND termine_le IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_historique_appliquer
  AFTER INSERT ON historique_statut
  FOR EACH ROW EXECUTE FUNCTION fn_historique_appliquer();

-- RG11 + le statut ne se change que via l'historique
CREATE FUNCTION fn_incident_avant_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.statut = 'CLOTURE' THEN
    RAISE EXCEPTION 'RG11 : un incident cloture ne peut plus etre modifie';
  END IF;
  IF NEW.statut IS DISTINCT FROM OLD.statut AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Le statut ne change que par une ligne d''historique (RG9, RG10)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_incident_avant_update
  BEFORE UPDATE ON incident
  FOR EACH ROW EXECUTE FUNCTION fn_incident_avant_update();

-- Affectation : superviseur (RG6), technicien disponible (RG5),
-- une seule affectation active (RG4) : l'ancienne est close automatiquement
CREATE FUNCTION fn_affectation_avant_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_statut statut_incident;
  v_dispo  boolean;
  v_actif  boolean;
BEGIN
  SELECT statut INTO v_statut FROM incident WHERE id = NEW.incident_id FOR UPDATE;
  IF v_statut = 'CLOTURE' THEN
    RAISE EXCEPTION 'RG11 : un incident cloture ne peut plus etre affecte';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM utilisateur
                 WHERE id = NEW.superviseur_id AND role_code = 'SUPERVISEUR' AND actif) THEN
    RAISE EXCEPTION 'RG6 : seul un superviseur actif peut affecter';
  END IF;
  SELECT t.disponible, u.actif INTO v_dispo, v_actif
  FROM technicien t JOIN utilisateur u ON u.id = t.utilisateur_id
  WHERE t.utilisateur_id = NEW.technicien_id;
  IF NOT COALESCE(v_dispo, false) OR NOT COALESCE(v_actif, false) THEN
    RAISE EXCEPTION 'RG5/RG14 : le technicien est indisponible ou inactif';
  END IF;
  UPDATE affectation SET termine_le = now()
  WHERE incident_id = NEW.incident_id AND termine_le IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_affectation_avant_insert
  BEFORE INSERT ON affectation
  FOR EACH ROW EXECUTE FUNCTION fn_affectation_avant_insert();
