# Back-end HelpDesk

API REST (Node.js, Express) : authentification par cookie, contrôle d'accès par rôle, gestion des incidents (workflow complet), pièces jointes, notifications, statistiques, administration.

## Installation
```bash
cd backend
cp .env.example .env     # puis renseigner APP_DB_PASSWORD et SESSION_SECRET (openssl rand -hex 32)
npm install
npm run dev              # http://localhost:3000
```
La base PostgreSQL doit tourner (`docker compose up -d` à la racine du dépôt).

## Principes
- Le statut d'un incident ne change jamais par `UPDATE` : l'API ajoute **une ligne dans `historique_statut`** (dans une transaction) et la base valide la transition. Une réaffectation = une ligne dans `affectation` + la ligne d'historique.
- Les erreurs de règle de la base (`RG4`, `RG8`...) sont traduites en messages clairs (`src/lib/errors.js`).
- L'API se connecte avec le compte `helpdesk_app`, jamais avec le compte propriétaire.

## Tester
```bash
DEMO_PASSWORD='<mot de passe de db/init/05_seed_demo.sql>' npm run e2e      # parcours complet, droits, règles
DEMO_PASSWORD='<...>' ./scripts/smoke.sh                                     # connexion et droits (étape 4)
```
Le test `e2e` crée quelques incidents de test dans la base locale : ne pas le lancer sur la base de production.

## Documentation
- Routes : `docs/API.md`
- Déploiement et variables d'environnement : `docs/DEPLOIEMENT.md`
