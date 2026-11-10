#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a
mkdir -p backups
FICHIER="backups/helpdesk_$(date +%Y%m%d_%H%M%S).dump"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$FICHIER"
find backups -name 'helpdesk_*.dump' -mtime +7 -delete
echo "Sauvegarde OK : $FICHIER ($(du -h "$FICHIER" | cut -f1))"
