#!/usr/bin/env bash
# Crée ou met à jour le compte à droits limités de l'API sur la base en ligne.
# Usage : DATABASE_URL=<url propriétaire> APP_DB_PASSWORD=<mot de passe> ./scripts/setup_app_role.sh
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD manquant}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v pw="$APP_DB_PASSWORD" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'helpdesk_app') THEN
    CREATE ROLE helpdesk_app LOGIN;
  END IF;
END $$;
ALTER ROLE helpdesk_app WITH PASSWORD :'pw';
SELECT format('GRANT CONNECT ON DATABASE %I TO helpdesk_app', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO helpdesk_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO helpdesk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO helpdesk_app;
REVOKE INSERT, UPDATE ON role, transition_autorisee FROM helpdesk_app;
REVOKE UPDATE ON historique_statut FROM helpdesk_app;
SQL
echo 'Compte helpdesk_app configure'
