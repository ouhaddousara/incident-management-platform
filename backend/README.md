# Back-end HelpDesk (étape 4)

Authentification (e-mail + mot de passe haché, session par cookie), contrôle d'accès par rôle, route `/health`.

## Installation
```bash
cd backend
cp .env.example .env     # puis renseigner APP_DB_PASSWORD et SESSION_SECRET (openssl rand -hex 32)
npm install
npm run dev              # http://localhost:3000
```
La base PostgreSQL doit tourner (`docker compose up -d` à la racine du dépôt).

## Avant de lancer : vérifier `src/schema.js`
Les noms de la table et des colonnes des utilisateurs doivent correspondre à `db/init/*.sql`. Le hash doit être un hash bcrypt (préfixe `$2a$` ou `$2b$`).

## Tester
```bash
DEMO_PASSWORD='<mot de passe de 05_seed_demo.sql>' ./scripts/smoke.sh
```
Routes documentées : voir `docs/API.md`.
