#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
FICHIER="${1:?Usage : scripts/restore_test.sh backups/fichier.dump}"
docker compose exec -T db dropdb -U "$POSTGRES_USER" --if-exists helpdesk_restore_test
docker compose exec -T db createdb -U "$POSTGRES_USER" helpdesk_restore_test
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d helpdesk_restore_test --no-owner --no-privileges < "$FICHIER"
docker compose exec -T db psql -U "$POSTGRES_USER" -d helpdesk_restore_test -c 'SELECT (SELECT count(*) FROM incident) AS incidents, (SELECT count(*) FROM historique_statut) AS historique;'
docker compose exec -T db dropdb -U "$POSTGRES_USER" helpdesk_restore_test
echo 'Restauration testee avec succes'
