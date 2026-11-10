-- Types
CREATE TYPE statut_incident AS ENUM
  ('SIGNALE','EXAMINE','AFFECTE','EN_COURS','RESOLU','NON_RESOLU','CLOTURE');
CREATE TYPE niveau_urgence AS ENUM ('FAIBLE','MOYEN','ELEVE');

-- Utilisateurs et rôles
CREATE TABLE role (
  code    text PRIMARY KEY,
  libelle text NOT NULL
);

CREATE TABLE utilisateur (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom               text NOT NULL CHECK (length(trim(nom)) > 0),
  prenom            text NOT NULL CHECK (length(trim(prenom)) > 0),
  email             text NOT NULL,
  mot_de_passe_hash text NOT NULL,
  role_code         text NOT NULL REFERENCES role (code),
  actif             boolean NOT NULL DEFAULT true,
  cree_le           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, role_code)
);
CREATE UNIQUE INDEX uq_utilisateur_email ON utilisateur (lower(email));

-- Profil technicien : la clé étrangère composée garantit que
-- seul un utilisateur de rôle TECHNICIEN peut avoir un profil
CREATE TABLE technicien (
  utilisateur_id bigint PRIMARY KEY,
  role_code      text NOT NULL DEFAULT 'TECHNICIEN' CHECK (role_code = 'TECHNICIEN'),
  disponible     boolean NOT NULL DEFAULT true,
  FOREIGN KEY (utilisateur_id, role_code) REFERENCES utilisateur (id, role_code)
);

-- Référentiels gérés par l'administrateur
CREATE TABLE categorie (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libelle text NOT NULL UNIQUE CHECK (length(trim(libelle)) > 0),
  actif   boolean NOT NULL DEFAULT true
);
CREATE TABLE lieu (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libelle text NOT NULL UNIQUE CHECK (length(trim(libelle)) > 0),
  actif   boolean NOT NULL DEFAULT true
);

-- Incident (RG2, RG3)
CREATE TABLE incident (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  titre         text NOT NULL CHECK (length(trim(titre)) > 0),
  description   text NOT NULL CHECK (length(trim(description)) > 0),
  categorie_id  bigint NOT NULL REFERENCES categorie (id),
  lieu_id       bigint NOT NULL REFERENCES lieu (id),
  urgence       niveau_urgence NOT NULL DEFAULT 'MOYEN',
  statut        statut_incident NOT NULL DEFAULT 'SIGNALE',
  declarant_id  bigint NOT NULL REFERENCES utilisateur (id),
  doublon_de_id bigint REFERENCES incident (id),
  cree_le       timestamptz NOT NULL DEFAULT now(),
  mis_a_jour_le timestamptz NOT NULL DEFAULT now(),
  CHECK (doublon_de_id IS NULL OR doublon_de_id <> id)
);

-- Pièce jointe : une seule photo, type et taille limités (RG17)
CREATE TABLE piece_jointe (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id   bigint NOT NULL UNIQUE REFERENCES incident (id),
  nom_fichier   text NOT NULL,
  type_mime     text NOT NULL CHECK (type_mime IN ('image/jpeg','image/png')),
  taille_octets integer NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 5242880),
  chemin        text NOT NULL,
  cree_le       timestamptz NOT NULL DEFAULT now()
);

-- Affectations (RG4, RG5)
CREATE TABLE affectation (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id    bigint NOT NULL REFERENCES incident (id),
  technicien_id  bigint NOT NULL REFERENCES technicien (utilisateur_id),
  superviseur_id bigint NOT NULL REFERENCES utilisateur (id),
  affecte_le     timestamptz NOT NULL DEFAULT now(),
  termine_le     timestamptz,
  CHECK (termine_le IS NULL OR termine_le >= affecte_le)
);
-- RG4 : au plus UNE affectation active par incident
CREATE UNIQUE INDEX uq_affectation_active ON affectation (incident_id) WHERE termine_le IS NULL;

-- Historique (RG8, RG10, RG13)
CREATE TABLE historique_statut (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id    bigint NOT NULL REFERENCES incident (id),
  ancien_statut  statut_incident,
  nouveau_statut statut_incident NOT NULL,
  auteur_id      bigint NOT NULL REFERENCES utilisateur (id),
  date_heure     timestamptz NOT NULL DEFAULT now(),
  remarque       text,
  -- RG8 : Non résolu exige une remarque
  CHECK (nouveau_statut <> 'NON_RESOLU' OR length(trim(coalesce(remarque, ''))) > 0),
  -- RG13 : un rejet ou un doublon (Signalé -> Clôturé) exige un motif
  CHECK (NOT (ancien_statut = 'SIGNALE' AND nouveau_statut = 'CLOTURE')
         OR length(trim(coalesce(remarque, ''))) > 0)
);

CREATE TABLE notification (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destinataire_id bigint NOT NULL REFERENCES utilisateur (id),
  incident_id     bigint NOT NULL REFERENCES incident (id),
  etape           statut_incident NOT NULL,
  message         text NOT NULL,
  lue             boolean NOT NULL DEFAULT false,
  cree_le         timestamptz NOT NULL DEFAULT now()
);

-- Table de référence du workflow (RG6, RG9)
CREATE TABLE transition_autorisee (
  ancien_statut  statut_incident NOT NULL,
  nouveau_statut statut_incident NOT NULL,
  role_code      text NOT NULL REFERENCES role (code),
  PRIMARY KEY (ancien_statut, nouveau_statut, role_code)
);

-- Index (BF8, BF10, BF17, BF19, BF20, BF21)
CREATE INDEX ix_incident_statut        ON incident (statut);
CREATE INDEX ix_incident_declarant     ON incident (declarant_id);
CREATE INDEX ix_incident_categorie     ON incident (categorie_id);
CREATE INDEX ix_incident_lieu          ON incident (lieu_id);
CREATE INDEX ix_incident_urgence       ON incident (urgence);
CREATE INDEX ix_incident_cree_le       ON incident (cree_le);
CREATE INDEX ix_historique_incident    ON historique_statut (incident_id, date_heure);
CREATE INDEX ix_affectation_tech_actif ON affectation (technicien_id) WHERE termine_le IS NULL;
CREATE INDEX ix_notification_dest      ON notification (destinataire_id, lue, cree_le DESC);
