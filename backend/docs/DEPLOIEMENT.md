# Déploiement de l'API HelpDesk

Ce document décrit ce dont l'API a besoin pour tourner en ligne et se connecter à la base hébergée. Les choix d'hébergement (service, adresse) se décident avec Sara (BD/DevOps).

## 1. Ce que l'API suppose
- **Node.js 20 ou plus** (l'image Docker utilise Node 22) et la commande `npm ci --omit=dev` puis `node src/server.js`.
- Une **base PostgreSQL 18** initialisée avec les scripts de `db/init/` (rôles, schéma, règles, droits, données de base). Sans les comptes de démonstration : `05_seed_demo.sql` est réservé au développement.
- Un **compte de base `helpdesk_app`** (droits limités, créé par `00_roles.sh` et `03_grants.sql`). L'API ne doit **jamais** utiliser le compte propriétaire `helpdesk_owner`.
- Un **dossier persistant** pour les photos jointes (`UPLOAD_DIR`). Sans disque persistant, les photos disparaissent à chaque redémarrage ; c'est acceptable pour une démonstration, à signaler au client.

## 2. Variables d'environnement
| Variable | Valeur en ligne | Remarque |
|---|---|---|
| `NODE_ENV` | `production` | active le cookie sécurisé |
| `PORT` | fourni par l'hébergeur | 3000 par défaut |
| `DATABASE_URL` | `postgresql://helpdesk_app:<mot de passe>@<hôte>:5432/helpdesk` | ou `DB_HOST`, `DB_PORT`, `DB_NAME`, `APP_DB_USER`, `APP_DB_PASSWORD` |
| `DB_SSL` | `true` si la base impose TLS | `DB_SSL_INSECURE=true` seulement si le certificat n'est pas reconnu |
| `SESSION_SECRET` | chaîne aléatoire de 64 caractères | `openssl rand -hex 32` ; différente de celle du poste de développement |
| `COOKIE_SECURE` | `true` | le site est en HTTPS |
| `COOKIE_SAMESITE` | `lax` ou `none` | voir la section 3 |
| `CORS_ORIGIN` | adresse exacte du site (par ex. `https://mon-site.netlify.app`) | sans `/` final |
| `TRUST_PROXY` | `1` | l'API est derrière le proxy de l'hébergeur |
| `UPLOAD_DIR` | chemin du disque persistant | par ex. `/data/uploads` |

Aucun de ces secrets ne se met dans Git : ils se saisissent dans les réglages de l'hébergeur.

## 3. Le point qui casse le plus souvent : le cookie de session
Si le site (Front-end) et l'API sont sur **deux adresses différentes**, le navigateur n'envoie pas le cookie avec le réglage `lax`, et la connexion « marche » mais la page suivante répond 401. Deux solutions :

**A. Même adresse pour le site et l'API (recommandé).** Le site redirige `/api/*` vers l'API. Avec Netlify, un fichier `_redirects` à la racine du site publié contient :
```
/api/*  https://<adresse-de-l-api>/api/:splat  200
```
Le navigateur ne voit alors qu'une seule adresse : `COOKIE_SAMESITE=lax`, et `CORS_ORIGIN` n'a plus d'importance. (À vérifier avec Sara dans les réglages Netlify.)

**B. Deux adresses.** `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, `CORS_ORIGIN` = l'adresse exacte du site, et le Front envoie `credentials: 'include'`. Certains navigateurs bloquent les cookies tiers : la solution A est plus fiable.

## 4. Lancer avec Docker
```bash
cd backend
docker build -t helpdesk-api .
docker run -p 3000:3000 --env-file .env -v helpdesk-uploads:/app/uploads helpdesk-api
```
Sur un hébergeur, choisir « Docker » ou « Node », indiquer le dossier `backend`, la commande de démarrage `node src/server.js` et la route de santé `/health`.

## 5. Vérifier après le déploiement
1. `GET <adresse>/health` répond 200 avec `"db":"ok"`.
2. `DEMO_PASSWORD=... API_URL=<adresse> npm run e2e` (sur une base de test qui contient les comptes de démonstration) : tous les tests doivent être `OK`.
3. Compte « client invité » : créer ce compte avec un **mot de passe différent** de celui de la démonstration (`scripts/create_user.sh`), rôle `SUPERVISEUR`.
4. Ne jamais charger `05_seed_demo.sql` sur la base hébergée : son mot de passe est public.
