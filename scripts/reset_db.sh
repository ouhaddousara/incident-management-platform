#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down -v
docker compose up -d
echo 'Base reinitialisee avec les donnees de demonstration'
