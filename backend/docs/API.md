# API HelpDesk – routes disponibles (étape 4)

Document destiné au Front-end · Responsable : Adnane (Back-end) · Version 0.1

## Principes
- Base de l'API : `http://localhost:3000` en local. Les routes d'authentification et de démonstration sont préfixées par `/api`.
- Format : JSON (`Content-Type: application/json`).
- **Session par cookie** `helpdesk_session` (httpOnly, valable 8 h). Le navigateur doit envoyer les cookies : avec `fetch`, ajouter `credentials: 'include'` ; avec axios, `withCredentials: true`. Le Front ne lit jamais le cookie.
- Erreurs : toujours `{ "error": "CODE", "message": "Texte lisible" }`.
- Rôles : `etudiant`, `enseignant`, `technicien`, `superviseur`, `admin`. Le compte « client invité » a le rôle `superviseur`.

## Codes d'erreur communs
| Code HTTP | Signification |
|---|---|
| 400 | Requête invalide (champ manquant, règle RG non respectée) |
| 401 | Non connecté ou session expirée → rediriger vers la page de connexion |
| 403 | Connecté mais droit insuffisant (rôle ou règle RG) |
| 409 | Conflit (transition de statut interdite, etc.) |
| 429 | Trop de tentatives de connexion |
| 503 | Base de données indisponible (`/health`) |

## Routes

### POST /api/auth/login
Connexion par e-mail et mot de passe.

Corps : `{ "email": "superviseur@demo.local", "password": "..." }`

Réponse 200 :
```json
{ "user": { "id": 3, "nom": "Superviseur Démo", "email": "superviseur@demo.local", "role": "superviseur" },
  "redirection": "/superviseur" }
```
Le cookie de session est posé dans la réponse. `redirection` indique la page d'accueil du rôle.

Erreurs :
| HTTP | error | Cas |
|---|---|---|
| 400 | CHAMPS_OBLIGATOIRES | e-mail ou mot de passe vide |
| 401 | IDENTIFIANTS_INCORRECTS | e-mail inconnu ou mauvais mot de passe (même message dans les deux cas) |
| 403 | COMPTE_DESACTIVE | mot de passe correct mais compte désactivé (RG15) |
| 429 | TROP_DE_TENTATIVES | 5 échecs en 15 minutes pour la même IP et le même e-mail |

### POST /api/auth/logout
Supprime le cookie de session. Réponse 200 : `{ "message": "Déconnecté." }`.

### GET /api/auth/me
Renvoie l'utilisateur connecté. À appeler au chargement de l'application pour savoir s'il y a une session et quel espace afficher.

Réponse 200 : même format que le login (`user` + `redirection`). Réponse 401 si non connecté.

### GET /health
Sans authentification. 200 `{ "status": "ok", "db": "ok", "uptime": 123 }` si l'API et la base répondent, sinon 503.

### Routes de démonstration (test du contrôle d'accès)
Réponse 200 `{ "message": "...", "user": {...} }`, 401 si non connecté, 403 si le rôle ne convient pas.

| Route | Rôle autorisé |
|---|---|
| GET /api/ping | tout utilisateur connecté |
| GET /api/declarant/ping | etudiant, enseignant |
| GET /api/technicien/ping | technicien |
| GET /api/superviseur/ping | superviseur |
| GET /api/admin/ping | admin |

## Redirection selon le rôle
| Rôle | `redirection` |
|---|---|
| etudiant, enseignant | `/mes-incidents` |
| technicien | `/technicien` |
| superviseur (dont client invité) | `/superviseur` |
| admin | `/admin` |

## Exemple Front-end (fetch)
```js
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
});
const data = await res.json();
if (!res.ok) afficherErreur(data.message);
else navigate(data.redirection);
```

## À venir (après le lancement)
Routes des incidents, de l'affectation et des statuts : mêmes middlewares d'accès, mêmes formats d'erreur.
