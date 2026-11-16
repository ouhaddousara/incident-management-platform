#!/usr/bin/env bash
# Test rapide de l'authentification et des droits (cas AUT-01 à AUT-04 de la QA).
# Usage : DEMO_PASSWORD='...' ./scripts/smoke.sh [http://localhost:3000]
# (mot de passe de démo : voir db/init/05_seed_demo.sql, développement seulement)
BASE="${1:-http://localhost:3000}"
PW="${DEMO_PASSWORD:?Définir DEMO_PASSWORD}"
J=$(mktemp)
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
check() { [ "$2" = "$3" ] && echo "OK    $1 ($2)" || echo "ECHEC $1 (attendu $3, obtenu $2)"; }

check "health"                          "$(code $BASE/health)" 200
check "page protégée sans connexion"    "$(code $BASE/api/auth/me)" 401
check "mauvais mot de passe"            "$(code -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"superviseur@demo.local","password":"faux"}')" 401
check "champs vides"                    "$(code -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"","password":""}')" 400

check "connexion superviseur"           "$(code -c $J -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"superviseur@demo.local\",\"password\":\"$PW\"}")" 200
check "/me connecté"                    "$(code -b $J $BASE/api/auth/me)" 200
check "superviseur -> espace superviseur" "$(code -b $J $BASE/api/superviseur/ping)" 200
check "superviseur -> espace admin"     "$(code -b $J $BASE/api/admin/ping)" 403
check "superviseur -> espace technicien" "$(code -b $J $BASE/api/technicien/ping)" 403
curl -s -b $J -c $J -X POST $BASE/api/auth/logout >/dev/null
check "après déconnexion"               "$(code -b $J $BASE/api/auth/me)" 401

for r in etudiant:declarant technicien:technicien admin:admin; do
  U=${r%%:*}; S=${r##*:}
  check "connexion $U" "$(code -c $J -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$U@demo.local\",\"password\":\"$PW\"}")" 200
  check "$U -> espace $S" "$(code -b $J $BASE/api/$S/ping)" 200
  check "$U -> espace superviseur interdit" "$(code -b $J $BASE/api/superviseur/ping)" 403
done
rm -f $J
