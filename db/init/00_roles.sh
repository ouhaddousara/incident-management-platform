#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 -v app_pw="$APP_DB_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
CREATE ROLE helpdesk_app LOGIN PASSWORD :'app_pw';
EOSQL
