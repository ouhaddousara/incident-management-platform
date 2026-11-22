# API HelpDesk – documentation des routes

Document destiné au Front-end et à la QA · Responsable : Adnane (Back-end) · Version 1.0 (étape 7)

## Principes
- Base : `http://localhost:3000` en local. Toutes les routes métier sont préfixées par `/api`. `/health` est sans préfixe.
- Format : JSON (`Content-Type: application/json`), sauf l'envoi de la photo (`multipart/form-data`) et l'export CSV.
- **Session par cookie** `helpdesk_session` (httpOnly, 8 h). Avec `fetch` : `credentials: 'include'` ; avec axios : `withCredentials: true`. Le Front ne lit jamais le cookie.
- Erreurs : toujours `{ "error": "CODE", "message": "Texte lisible" }` (plus `details` pour les champs invalides). Les codes `RGxx` renvoient à une règle de gestion.
- Rôles (minuscules) : `etudiant`, `enseignant`, `technicien`, `superviseur`, `admin`. Le compte « client invité » a le rôle `superviseur`.
- Statuts (comme dans la base) : `SIGNALE`, `EXAMINE`, `AFFECTE`, `EN_COURS`, `RESOLU`, `NON_RESOLU`, `CLOTURE`. Urgences : `FAIBLE`, `MOYEN` (défaut), `ELEVE`.
- Le **statut ne se modifie jamais directement** : chaque action ci-dessous ajoute une ligne d'historique et la base valide la transition.

| Code HTTP | Signification |
|---|---|
| 400 | Champ manquant ou invalide, règle RG non respectée (par ex. motif ou remarque obligatoire) |
| 401 | Non connecté ou session expirée → retour à la page de connexion |
| 403 | Connecté, mais rôle ou droit insuffisant (RG6, RG7, RG16) |
| 404 | Élément introuvable |
| 409 | Conflit : action impossible dans l'état actuel (transition, incident clôturé, technicien indisponible) |
| 429 | Trop de tentatives de connexion |
| 503 | Base indisponible (`/health`) |

## Authentification
| Route | Rôles | Description |
|---|---|---|
| `POST /api/auth/login` | public | Corps `{ "email", "password" }`. Réponse `{ user: { id, nom, email, role }, redirection }`. Erreurs : 400 `CHAMPS_OBLIGATOIRES`, 401 `IDENTIFIANTS_INCORRECTS`, 403 `COMPTE_DESACTIVE`, 429 `TROP_DE_TENTATIVES`. |
| `POST /api/auth/logout` | connecté | Supprime le cookie de session. |
| `GET /api/auth/me` | connecté | Même réponse que le login. À appeler au chargement de l'application. |
| `GET /health` | public | 200 `{ status: "ok", db: "ok" }` si l'API joint la base, sinon 503. |

Redirection selon le rôle : `etudiant` et `enseignant` → `/mes-incidents` ; `technicien` → `/technicien` ; `superviseur` → `/superviseur` ; `admin` → `/admin`.

## Listes pour les formulaires
| Route | Rôles | Réponse |
|---|---|---|
| `GET /api/categories` | tout connecté | `[ { id, libelle } ]` (catégories actives) |
| `GET /api/lieux` | tout connecté | `[ { id, libelle } ]` (lieux actifs) |

## Incidents
### Liste : `GET /api/incidents`
Chaque rôle ne reçoit que ce qu'il a le droit de voir : le déclarant ses incidents (RG16), le technicien ceux qui lui ont été affectés, le superviseur et l'admin tous (l'admin en lecture seule).

Paramètres facultatifs : `statut` (un ou plusieurs séparés par des virgules), `urgence`, `categorie_id`, `lieu_id`, `technicien_id` (superviseur/admin), `q` (numéro ou mot-clé), `du` et `au` (AAAA-MM-JJ), `tri` (`recent` par défaut, `ancien`, `urgence`), `page`, `limit` (20 par défaut, 100 maximum).

Réponse : `{ items: [ { id, titre, description, statut, urgence, doublon_de_id, cree_le, mis_a_jour_le, categorie_id, categorie, lieu_id, lieu, declarant_id, declarant, technicien_id, technicien } ], total, page, limit }`.

### Création : `POST /api/incidents` (etudiant, enseignant)
Corps : `{ "titre", "description", "categorie_id", "lieu_id", "urgence" }` (urgence facultative, `MOYEN` par défaut). Réponse 201 : la fiche complète (voir ci-dessous), statut `SIGNALE`. Les superviseurs reçoivent une notification. Erreurs : 400 `CHAMPS_INVALIDES` (avec `details`), 400 `CATEGORIE_INVALIDE` / `LIEU_INVALIDE`.

### Fiche : `GET /api/incidents/:id`
Réponse : les champs de la liste, plus
- `historique` : `[ { id, ancien_statut, nouveau_statut, date_heure, remarque, auteur_id, auteur } ]` (chronologique, non modifiable) ;
- `affectation_active` : `{ technicien_id, technicien, superviseur_id, affecte_le }` ou `null` ;
- `piece_jointe` : `{ id, nom_fichier, type_mime, taille_octets }` ou `null` ;
- **`actions`** : la liste des actions possibles pour l'utilisateur connecté dans l'état actuel (par ex. `["examiner","rejeter","doublon"]`). **Le Front n'affiche que ces boutons.**

Erreurs : 403 `RG16` (incident d'un autre déclarant), 404.

### Actions du superviseur
Toutes renvoient la fiche mise à jour (200). Rôle : `superviseur`.

| Route | Corps | Passage de statut | Erreurs spécifiques |
|---|---|---|---|
| `POST /api/incidents/:id/examiner` | `{ remarque? }` | `SIGNALE` → `EXAMINE` | 409 si l'incident n'est pas signalé |
| `POST /api/incidents/:id/rejeter` | `{ motif }` | `SIGNALE` → `CLOTURE` | 400 `MOTIF_OBLIGATOIRE` (RG13) |
| `POST /api/incidents/:id/doublon` | `{ doublon_de_id, motif? }` | `SIGNALE` → `CLOTURE` | 400 `ORIGINE_OBLIGATOIRE`, `ORIGINE_INVALIDE`, `ORIGINE_INTROUVABLE` |
| `POST /api/incidents/:id/affecter` | `{ technicien_id, remarque? }` | `EXAMINE` → `AFFECTE` | 409 technicien indisponible (RG5) |
| `POST /api/incidents/:id/reaffecter` | `{ technicien_id, remarque? }` | `AFFECTE`, `EN_COURS` ou `NON_RESOLU` → `AFFECTE` | 409 (RG5, RG14) |
| `POST /api/incidents/:id/rouvrir` | `{ technicien_id, remarque? }` | `NON_RESOLU` → `AFFECTE` | 409 (RG12) |
| `POST /api/incidents/:id/cloturer` | `{ remarque? }` | `RESOLU` ou `NON_RESOLU` → `CLOTURE` | 409 si le statut ne le permet pas |

### Actions du technicien
Rôle : `technicien`, uniquement sur les incidents qui lui sont affectés (RG7, vérifié par la base : 403 sinon).

| Route | Corps | Passage de statut | Erreurs spécifiques |
|---|---|---|---|
| `POST /api/incidents/:id/prendre-en-charge` | – | `AFFECTE` → `EN_COURS` | 409 |
| `POST /api/incidents/:id/resoudre` | `{ remarque? }` | `EN_COURS` → `RESOLU` | 409 |
| `POST /api/incidents/:id/non-resolu` | `{ remarque }` | `EN_COURS` → `NON_RESOLU` | 400 `REMARQUE_OBLIGATOIRE` (RG8) |

Un incident clôturé n'accepte plus aucune action (409, RG11).

### Pièce jointe (RG17)
| Route | Rôles | Description |
|---|---|---|
| `POST /api/incidents/:id/piece-jointe` | déclarant de l'incident | `multipart/form-data`, champ **`photo`**, une image JPEG ou PNG de 5 Mo maximum, tant que l'incident est `SIGNALE`. Réponse 201 `{ id, nom_fichier, type_mime, taille_octets }`. Erreurs : 400 `RG17` (taille ou contenu), 409 `PIECE_JOINTE_EXISTANTE`, 409 `STATUT_INCOMPATIBLE`. |
| `GET /api/incidents/:id/piece-jointe` | mêmes droits de lecture que l'incident | Renvoie l'image. Avec un site sur une autre adresse, la charger avec `fetch(..., { credentials: 'include' })` puis `URL.createObjectURL(blob)`. |

## Techniciens
| Route | Rôles | Description |
|---|---|---|
| `GET /api/techniciens` | superviseur, admin | `[ { id, nom, email, disponible, actif, charge } ]` : techniciens actifs avec leur disponibilité et leur charge (incidents non clôturés). Pour la liste d'affectation. |
| `GET /api/techniciens/moi` | technicien | Son profil. |
| `PATCH /api/techniciens/moi` | technicien | Corps `{ "disponible": true \| false }`. |

## Notifications (dans l'application)
| Route | Description |
|---|---|
| `GET /api/notifications?non_lues=1&limit=20` | `{ non_lues, items: [ { id, incident_id, etape, message, lue, cree_le } ] }` : pour la cloche. |
| `POST /api/notifications/:id/lue` | Marque une notification comme lue. |
| `POST /api/notifications/lues` | Marque tout comme lu. |

## Statistiques (superviseur, admin)
| Route | Description |
|---|---|
| `GET /api/statistiques?du=&au=` | `{ total, a_examiner, par_statut, par_urgence, par_categorie, par_lieu, delai_moyen_resolution_heures, incidents_resolus, charge_par_technicien }`. Le délai va du signalement à la résolution. |
| `GET /api/statistiques/export.csv?du=&au=` | Export CSV (séparateur `;`, accents compatibles Excel). |

## Administration (admin)
| Route | Description |
|---|---|
| `GET /api/admin/utilisateurs` | Liste des comptes. |
| `POST /api/admin/utilisateurs` | `{ nom, prenom, email, role, mot_de_passe }` (8 à 72 caractères). 409 si l'e-mail existe. Seul l'admin crée des comptes. |
| `PATCH /api/admin/utilisateurs/:id` | Parmi `nom`, `prenom`, `email`, `actif`, `role`, `mot_de_passe`. Un compte désactivé ne peut plus se connecter (RG15). L'admin ne peut ni se désactiver ni changer son propre rôle ; un technicien ne peut pas changer de rôle. |
| `GET/POST /api/admin/categories`, `PATCH /api/admin/categories/:id` | `{ libelle }` / `{ libelle?, actif? }`. Pas de suppression : on désactive. |
| `GET/POST /api/admin/lieux`, `PATCH /api/admin/lieux/:id` | Idem pour les lieux. |

## Routes de test des droits
`GET /api/ping` (tout connecté), `/api/declarant/ping`, `/api/technicien/ping`, `/api/superviseur/ping`, `/api/admin/ping` : 200 si le rôle convient, 401 sans session, 403 sinon.

## Exemple (Front-end)
```js
const res = await fetch('http://localhost:3000/api/incidents/12/examiner', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({}),
});
const data = await res.json();
if (!res.ok) afficherErreur(data.message);
else afficherIncident(data); // data.actions donne les boutons à afficher
```
