#!/usr/bin/env bash
# Usage : DATABASE_URL=... USER_PASSWORD=... ./scripts/create_user.sh email nom prenom ROLE
set -euo pipefail
EMAIL="${1:?email}"; NOM="${2:?nom}"; PRENOM="${3:?prenom}"; ROLE="${4:?role}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pw="$USER_PASSWORD" -v email="$EMAIL" -v nom="$NOM" -v prenom="$PRENOM" -v role="$ROLE" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO utilisateur (nom, prenom, email, mot_de_passe_hash, role_code)
VALUES (:'nom', :'prenom', :'email', crypt(:'pw', gen_salt('bf', 10)), :'role');
SQL
echo "Compte cree : $EMAIL ($ROLE)"
